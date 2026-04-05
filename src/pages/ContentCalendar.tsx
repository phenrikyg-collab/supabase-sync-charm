import { useState, useCallback } from 'react';
import { ContentSidebar } from '@/components/content-calendar/ContentSidebar';
import { CalendarView } from '@/components/content-calendar/CalendarView';
import { CriarConteudo } from '@/components/content-calendar/CriarConteudo';
import { Biblioteca } from '@/components/content-calendar/Biblioteca';
import { EmailsCRM } from '@/components/content-calendar/EmailsCRM';
import { WhatsAppCRM } from '@/components/content-calendar/WhatsAppCRM';
import { useContentStore } from '@/hooks/useContentStore';
import { ContentItem } from '@/components/content-calendar/types';

export default function ContentCalendar() {
  const [activeView, setActiveView] = useState('calendario');
  const [createDate, setCreateDate] = useState<string | undefined>();
  const store = useContentStore();

  const handleCreateForDate = useCallback((date: string) => {
    setCreateDate(date);
    setActiveView('criar');
  }, []);

  const handleSaveOrSchedule = useCallback((item: ContentItem) => {
    store.addContent(item);
  }, [store]);

  const renderView = () => {
    switch (activeView) {
      case 'calendario':
        return (
          <CalendarView
            contentItems={store.contentItems}
            onCreateForDate={handleCreateForDate}
            onUpdateContent={store.updateContent}
            onDeleteContent={store.deleteContent}
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
