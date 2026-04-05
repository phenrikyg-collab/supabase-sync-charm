import { useState, useCallback, useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
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
          />
        );
      case 'config':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
                ⚙️ Configurações
              </h2>
              <p className="text-muted-foreground">Em breve: configurações de integração, templates e automações.</p>
            </div>
          </div>
        );
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
