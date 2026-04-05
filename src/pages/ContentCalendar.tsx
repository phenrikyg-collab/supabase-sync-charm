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
import { callClaude, safeParseJSON } from '@/lib/claudeApi';

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
      const selectedMonth = reviewMonth || now;
      const monthLabel = format(selectedMonth, 'MMMM yyyy', { locale: ptBR });
      const yr = format(selectedMonth, 'yyyy');
      const mo = format(selectedMonth, 'MM');
      const dim = getDaysInMonth(selectedMonth);

      // Remove existing items for this channel in the month first
      const monthStart2 = startOfMonth(selectedMonth);
      const monthEnd2 = endOfMonth(selectedMonth);
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

      const chMap: Record<string, ContentItem['channel']> = {
        'Instagram Feed': 'instagram-feed', 'Instagram Reels': 'instagram-reels', 'Instagram Stories': 'instagram-stories',
        'instagram-feed': 'instagram-feed', 'instagram-reels': 'instagram-reels', 'instagram-stories': 'instagram-stories',
        'email': 'email', 'whatsapp': 'whatsapp',
      };

      const addParsedItems = (parsed: any[], ch: string) => {
        parsed.forEach((p: any) => {
          store.addContent({
            id: crypto.randomUUID(),
            date: p.date,
            channel: chMap[p.channel] || (ch === 'email' ? 'email' : ch === 'whatsapp' ? 'whatsapp' : 'instagram-feed'),
            type: p.type || ch,
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
      };

      let totalGenerated = 0;

      if (channel === 'instagram') {
        // Split into 3 calls like main generation
        const buildDates = () => {
          const dates: { ds: string; dn: string; dow: number }[] = [];
          for (let day = 1; day <= dim; day++) {
            const d = new Date(parseInt(yr), parseInt(mo) - 1, day);
            const dow = getDay(d);
            dates.push({
              ds: `${yr}-${mo}-${String(day).padStart(2, '0')}`,
              dn: ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][dow],
              dow,
            });
          }
          return dates;
        };
        const dates = buildDates();

        // Stories
        const storiesSchedule = dates.map(d => `${d.ds} (${d.dn})${d.dow === 2 ? ' ⚡ LIVE' : ''}`).join('\n');
        const storiesPrompt = `Crie EXATAMENTE ${dim} Stories para Instagram para ${monthLabel}. 1 por dia, 09:00. Terças: "Hoje tem live!". CRONOGRAMA:\n${storiesSchedule}\nRetorne JSON array: [{"date":"YYYY-MM-DD","channel":"Instagram Stories","funnel_stage":"topo"|"meio"|"fundo","product":"nome ou null","theme":"string","caption":"caption curta","hashtags":[],"cta":"string","time":"09:00","type":"Stories","isLive":false,"status":"rascunho"}]`;
        const storiesRaw = await callClaude(storiesPrompt);
        const storiesParsed = safeParseJSON(storiesRaw);
        addParsedItems(storiesParsed, 'instagram');
        totalGenerated += storiesParsed.length;

        // Reels (2x/day)
        const reelsSchedule = dates.map(d => `${d.ds} (${d.dn}): 11:00 + 20:00${d.dow === 2 ? ' ⚡ 20:00=Live teaser' : ''}`).join('\n');
        const reelsPrompt = `Crie EXATAMENTE ${dim * 2} Reels para ${monthLabel}. 2 por dia (11:00 + 20:00). Terças 20:00: teaser live (isLive:true). CRONOGRAMA:\n${reelsSchedule}\nRetorne JSON array: [{"date":"YYYY-MM-DD","channel":"Instagram Reels","funnel_stage":"topo"|"meio"|"fundo","product":"nome ou null","theme":"string","caption":"string","hashtags":[],"cta":"string","time":"11:00"|"20:00","type":"Reels","isLive":false,"status":"rascunho"}]`;
        const reelsRaw = await callClaude(ANNA_SYSTEM_PROMPT, reelsPrompt);
        const reelsParsed = safeParseJSON(reelsRaw);
        addParsedItems(reelsParsed, 'instagram');
        totalGenerated += reelsParsed.length;

        // Feed (Mon,Wed,Fri) + Live Tue
        const feedDays = dates.filter(d => [1, 3, 5].includes(d.dow));
        const liveDays = dates.filter(d => d.dow === 2);
        const feedTotal = feedDays.length + liveDays.length;
        const feedSchedule = [...feedDays.map(d => `${d.ds} (${d.dn}): Feed 11:00`), ...liveDays.map(d => `${d.ds} (${d.dn}): Feed Live 11:00`)].sort().join('\n');
        const feedPrompt = `Crie EXATAMENTE ${feedTotal} posts Feed para ${monthLabel}. Seg/Qua/Sex + terça (live). CRONOGRAMA:\n${feedSchedule}\nRetorne JSON array: [{"date":"YYYY-MM-DD","channel":"Instagram Feed","funnel_stage":"topo"|"meio"|"fundo","product":"nome ou null","theme":"string","caption":"string","hashtags":[],"cta":"string","time":"11:00","type":"Feed","isLive":false,"status":"rascunho"}]`;
        const feedRaw = await callClaude(ANNA_SYSTEM_PROMPT, feedPrompt);
        const feedParsed = safeParseJSON(feedRaw);
        addParsedItems(feedParsed, 'instagram');
        totalGenerated += feedParsed.length;
      } else if (channel === 'email') {
        const weeks = Math.ceil(dim / 7);
        const expectedEmails = weeks * 2;
        const prompt = `Crie EXATAMENTE ${expectedEmails} e-mails para ${monthLabel} (2x/semana). Distribua uniformemente. Retorne JSON array: [{"date":"YYYY-MM-DD","channel":"email","subject":"string","preview_text":"string","body":"string","cta":"string","audience":"string","funnel_stage":"topo"|"meio"|"fundo","time":"09:00"|"14:00"}]`;
        const raw = await callClaude(ANNA_SYSTEM_PROMPT, prompt);
        const parsed = safeParseJSON(raw);
        addParsedItems(parsed, 'email');
        totalGenerated = parsed.length;
      } else {
        const weeks = Math.ceil(dim / 7);
        const expectedWpp = weeks * 2;
        const prompt = `Crie EXATAMENTE ${expectedWpp} campanhas WhatsApp para ${monthLabel} (2x/semana). Retorne JSON array: [{"date":"YYYY-MM-DD","channel":"whatsapp","audience":"string","message":"string","coupon":"string ou null","time":"14:00"|"15:00"|"21:00","funnel_stage":"topo"|"meio"|"fundo"}]`;
        const raw = await callClaude(ANNA_SYSTEM_PROMPT, prompt);
        const parsed = safeParseJSON(raw);
        addParsedItems(parsed, 'whatsapp');
        totalGenerated = parsed.length;
      }

      toast.success(`${totalGenerated} itens regenerados para ${channel === 'instagram' ? 'Instagram' : channel === 'email' ? 'E-mail' : 'WhatsApp'}`);
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
