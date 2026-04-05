import { useState, useCallback, useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, getDaysInMonth, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ContentSidebar } from '@/components/content-calendar/ContentSidebar';
import { CalendarView } from '@/components/content-calendar/CalendarView';
import { CriarConteudo } from '@/components/content-calendar/CriarConteudo';
import { Biblioteca } from '@/components/content-calendar/Biblioteca';
import { EmailsCRM } from '@/components/content-calendar/EmailsCRM';
import { WhatsAppCRM } from '@/components/content-calendar/WhatsAppCRM';
import { PlanejamentoMensal } from '@/components/content-calendar/PlanejamentoMensal';
import { ReviewMode } from '@/components/content-calendar/planner/ReviewMode';
import { useContentStore } from '@/hooks/useContentStore';
import { ContentItem } from '@/components/content-calendar/types';
import { ConfiguracoesView } from '@/components/content-calendar/ConfiguracoesView';
import { callClaude, safeParseJSON, ANNA_SYSTEM_PROMPT } from '@/lib/claudeApi';

export default function ContentCalendar() {
  const [activeView, setActiveView] = useState('calendario');
  const [createDate, setCreateDate] = useState<string | undefined>();
  const [reviewMonth, setReviewMonth] = useState<Date | null>(null);
  const store = useContentStore();

  const handleCreateForDate = useCallback((date: string) => {
    setCreateDate(date);
    setActiveView('criar');
  }, []);

  const handleSaveOrSchedule = useCallback((item: ContentItem) => {
    store.addContent(item);
  }, [store]);

  const handleBulkGenerated = useCallback((items: ContentItem[]) => {
    items.forEach(item => store.addContent(item));
  }, [store]);

  const handleNavigateToCalendar = useCallback(() => {
    setActiveView('calendario');
  }, []);

  const reviewItems = useMemo(() => {
    if (!reviewMonth) return store.contentItems;
    const start = startOfMonth(reviewMonth);
    const end = endOfMonth(reviewMonth);
    return store.contentItems.filter(item => {
      try {
        const d = parseISO(item.date);
        return isWithinInterval(d, { start, end });
      } catch { return false; }
    });
  }, [store.contentItems, reviewMonth]);

  const handleExportCsv = useCallback(() => {
    const headers = ['Data', 'Canal', 'Título', 'Caption', 'Horário', 'Status'];
    const rows = reviewItems.map(item => [
      item.date, item.channel, item.title, `"${item.caption.replace(/"/g, '""')}"`, item.suggestedTime, item.status,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `calendario-conteudo-${format(new Date(), 'yyyy-MM')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [reviewItems]);

  const handleRegenerateChannel = useCallback(async (channel: 'instagram' | 'email' | 'whatsapp') => {
    toast.info(`Regenerando conteúdo de ${channel === 'instagram' ? 'Instagram' : channel === 'email' ? 'E-mail' : 'WhatsApp'}...`);
    try {
      const now = new Date();
      const monthLabel = format(reviewMonth || now, 'MMMM yyyy', { locale: ptBR });
      let prompt = '';

      if (channel === 'instagram') {
        const selectedMonth = reviewMonth || now;
        const yr = format(selectedMonth, 'yyyy');
        const mo = format(selectedMonth, 'MM');
        const dim = getDaysInMonth(selectedMonth);
        const schedule: string[] = [];
        for (let day = 1; day <= dim; day++) {
          const d = new Date(parseInt(yr), parseInt(mo) - 1, day);
          const dow = getDay(d);
          const ds = `${yr}-${mo}-${String(day).padStart(2, '0')}`;
          const dn = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][dow];
          const entries: string[] = [`${ds} (${dn}): Stories`];
          if ([0,1,3,5].includes(dow)) entries.push(`${ds} (${dn}): Feed`);
          if ([2,4,6].includes(dow)) entries.push(`${ds} (${dn}): Reels`);
          if (dow === 2) entries.push(`${ds} (${dn}): LIVE`);
          schedule.push(entries.join(' | '));
        }
        prompt = `Regenere todo o conteúdo Instagram para ${monthLabel}. CRONOGRAMA:\n${schedule.join('\n')}\nRetorne JSON array: [{"date":"YYYY-MM-DD","channel":"Instagram Feed"|"Instagram Reels"|"Instagram Stories","funnel_stage":"topo"|"meio"|"fundo","product":"string ou null","theme":"string","caption":"string","hashtags":[],"cta":"string","time":"09:00"|"11:00"|"20:00","type":"Stories"|"Feed"|"Reels"|"Live","isLive":true|false,"status":"rascunho"}]`;
      } else if (channel === 'email') {
        prompt = `Regenere os e-mails para ${monthLabel}. Gere 4-8 e-mails distribuídos no mês. Retorne JSON array: [{"date":"YYYY-MM-DD","channel":"email","subject":"string","preview_text":"string","body":"string","cta":"string","audience":"string","funnel_stage":"topo"|"meio"|"fundo","time":"09:00"|"14:00"}]`;
      } else {
        prompt = `Regenere as campanhas WhatsApp para ${monthLabel}. Gere 4-8 campanhas. Retorne JSON array: [{"date":"YYYY-MM-DD","channel":"whatsapp","audience":"string","message":"string","coupon":"string ou null","time":"14:00"|"15:00"|"21:00","funnel_stage":"topo"|"meio"|"fundo"}]`;
      }

      const raw = await callClaude(ANNA_SYSTEM_PROMPT, prompt);
      const parsed = safeParseJSON(raw);

      // Remove existing items for this channel in the month
      const monthStart2 = startOfMonth(reviewMonth || now);
      const monthEnd2 = endOfMonth(reviewMonth || now);
      const existingIds = store.contentItems
        .filter(i => {
          const matchChannel = channel === 'instagram' ? i.channel.startsWith('instagram') : i.channel === channel;
          if (!matchChannel) return false;
          try {
            const d = parseISO(i.date);
            return isWithinInterval(d, { start: monthStart2, end: monthEnd2 });
          } catch { return false; }
        })
        .map(i => i.id);
      existingIds.forEach(id => store.deleteContent(id));

      // Add new items
      const channelMap: Record<string, ContentItem['channel']> = {
        'Instagram Feed': 'instagram-feed', 'Instagram Reels': 'instagram-reels', 'Instagram Stories': 'instagram-stories',
        'instagram-feed': 'instagram-feed', 'instagram-reels': 'instagram-reels', 'instagram-stories': 'instagram-stories',
        'email': 'email', 'whatsapp': 'whatsapp',
      };
      parsed.forEach((p: any) => {
        store.addContent({
          id: crypto.randomUUID(),
          date: p.date,
          channel: channelMap[p.channel] || (channel === 'email' ? 'email' : channel === 'whatsapp' ? 'whatsapp' : 'instagram-feed'),
          type: p.type || channel,
          title: (p.theme || p.subject || p.audience || p.caption || '').substring(0, 60),
          caption: p.caption || p.body || p.message || '',
          hashtags: p.hashtags || [],
          cta: p.cta || '',
          suggestedTime: p.time || '11:00',
          status: 'rascunho',
          objective: 'engajamento',
          tone: 'inspiracional',
          audience: 'fas-marca',
          product: p.product || undefined,
          subjectLine: p.subject,
          previewText: p.preview_text,
          createdAt: new Date().toISOString(),
          funnelStage: p.funnel_stage,
          isLive: p.isLive || false,
        } as any);
      });

      toast.success(`${parsed.length} itens regenerados para ${channel === 'instagram' ? 'Instagram' : channel === 'email' ? 'E-mail' : 'WhatsApp'}`);
    } catch (e) {
      console.error('Regenerate channel error:', e);
      toast.error('Falha ao regenerar. Tente novamente.');
    }
  }, [reviewMonth, store]);

  const renderView = () => {
    switch (activeView) {
      case 'calendario':
        return (
          <CalendarView
            contentItems={store.contentItems}
            onCreateForDate={handleCreateForDate}
            onUpdateContent={store.updateContent}
            onDeleteContent={store.deleteContent}
            onOpenReview={() => setActiveView('review')}
          />
        );
      case 'planejamento':
        return (
          <PlanejamentoMensal
            onContentGenerated={handleBulkGenerated}
            onNavigateToCalendar={handleNavigateToCalendar}
          />
        );
      case 'criar':
        return (
          <CriarConteudo
            initialDate={createDate}
            onSaveToLibrary={handleSaveOrSchedule}
            onSchedule={handleSaveOrSchedule}
          />
        );
      case 'biblioteca':
        return (
          <Biblioteca
            contentItems={store.contentItems}
            onUpdate={store.updateContent}
            onDelete={store.deleteContent}
            onClone={store.cloneContent}
            onSchedule={(id) => store.updateContent(id, { status: 'agendado' })}
          />
        );
      case 'emails':
        return (
          <EmailsCRM
            sequences={store.emailSequences}
            onUpdateStep={store.updateEmailStep}
          />
        );
      case 'whatsapp':
        return (
          <WhatsAppCRM
            campaigns={store.whatsappCampaigns}
            onUpdate={store.updateWhatsAppCampaign}
          />
        );
      case 'review':
        return (
          <ReviewMode
            items={reviewItems}
            onApprove={(id) => store.updateContent(id, { status: 'agendado' })}
            onApproveAll={() => {
              reviewItems.filter(i => i.status === 'rascunho').forEach(i => store.updateContent(i.id, { status: 'agendado' }));
            }}
            onRegenerate={(item) => {
              setCreateDate(item.date);
              setActiveView('criar');
            }}
            onExportCsv={handleExportCsv}
            onRegenerateChannel={handleRegenerateChannel}
          />
        );
      case 'config':
        return <ConfiguracoesView />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F5F5F5' }}>
      <ContentSidebar activeView={activeView} onViewChange={(v) => { setActiveView(v); if (v !== 'criar') setCreateDate(undefined); }} />
      {renderView()}
    </div>
  );
}
