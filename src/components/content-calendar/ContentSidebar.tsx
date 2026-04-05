import { useState } from 'react';
import { Calendar, CalendarRange, PenTool, Library, Mail, MessageCircle, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { id: 'calendario', label: 'Calendário', icon: Calendar },
  { id: 'planejamento', label: 'Planejamento Mensal', icon: CalendarRange },
  { id: 'criar', label: 'Criar Conteúdo', icon: PenTool },
  { id: 'biblioteca', label: 'Biblioteca', icon: Library },
  { id: 'emails', label: 'E-mails CRM', icon: Mail },
  { id: 'whatsapp', label: 'WhatsApp CRM', icon: MessageCircle },
  { id: 'config', label: 'Configurações', icon: Settings },
];

interface ContentSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export function ContentSidebar({ activeView, onViewChange }: ContentSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        'h-full flex flex-col transition-all duration-300 border-r',
        collapsed ? 'w-16' : 'w-60'
      )}
      style={{
        backgroundColor: '#1D1D1B',
        borderColor: 'rgba(232,205,126,0.15)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-5 flex items-center gap-3">
        {!collapsed && (
          <div>
            <h1
              className="text-lg font-bold tracking-tight"
              style={{ color: '#E8CD7E', fontFamily: "'Cormorant Garamond', serif" }}
            >
              Conteúdo & CRM
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Use Mariana Cardoso
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded hover:bg-white/10 transition-colors"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-1 mt-2">
        {navItems.map(item => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                isActive
                  ? 'font-medium'
                  : 'hover:bg-white/5'
              )}
              style={{
                backgroundColor: isActive ? 'rgba(232,205,126,0.15)' : undefined,
                color: isActive ? '#E8CD7E' : 'rgba(255,255,255,0.6)',
              }}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span style={{ fontFamily: "'DM Sans', sans-serif" }}>{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
