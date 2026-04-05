import { useMemo, useState } from 'react';
import { format, parseISO, startOfWeek, getWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ContentItem, CHANNEL_ICONS } from '../types';

interface ReviewModeProps {
  items: ContentItem[];
  onApprove: (id: string) => void;
  onApproveAll: () => void;
  onRegenerate: (item: ContentItem) => void;
  onExportCsv: () => void;
}

const funnelColors: Record<string, { bg: string; text: string }> = {
  topo: { bg: 'rgba(232,205,126,0.2)', text: '#8B6914' },
  meio: { bg: 'rgba(139,105,20,0.15)', text: '#8B6914' },
  fundo: { bg: 'rgba(29,29,27,0.1)', text: '#1D1D1B' },
};

export function ReviewMode({ items, onApprove, onApproveAll, onRegenerate, onExportCsv }: ReviewModeProps) {
  const grouped = useMemo(() => {
    const weeks: Record<number, ContentItem[]> = {};
    items.forEach(item => {
      const d = parseISO(item.date);
      const w = getWeek(d, { weekStartsOn: 0 });
      if (!weeks[w]) weeks[w] = [];
      weeks[w].push(item);
    });
    Object.values(weeks).forEach(arr => arr.sort((a, b) => a.date.localeCompare(b.date)));
    return weeks;
  }, [items]);

  const approvedCount = items.filter(i => i.status === 'agendado').length;
  const pendingCount = items.filter(i => i.status === 'rascunho').length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(232,205,126,0.15)' }}>
        <div>
          <h2 className="text-xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            📋 Revisão do Mês
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {approvedCount} aprovados · {pendingCount} pendentes · {items.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onApproveAll} className="text-xs border-green-300 text-green-700 hover:bg-green-50">
            <Check className="h-3 w-3 mr-1" /> Aprovar Todos
          </Button>
          <Button size="sm" variant="outline" onClick={onExportCsv} className="text-xs border-[#E8CD7E]/50 text-[#8B6914]">
            <Download className="h-3 w-3 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([week, weekItems]) => (
          <div key={week}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Semana {week}</h3>
            <div className="space-y-2">
              {weekItems.map(item => {
                const funnelStage = (item as any).funnelStage || 'meio';
                const fc = funnelColors[funnelStage] || funnelColors.meio;
                const isApproved = item.status === 'agendado';

                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-white border transition-all" style={{ borderColor: isApproved ? 'rgba(34,197,94,0.3)' : 'rgba(232,205,126,0.2)', borderLeftWidth: '3px', borderLeftColor: funnelStage === 'topo' ? '#E8CD7E' : funnelStage === 'meio' ? '#8B6914' : '#1D1D1B' }}>
                    <div className="text-xs text-muted-foreground w-16 shrink-0">
                      <div className="font-medium">{format(parseISO(item.date), 'dd/MM')}</div>
                      <div className="capitalize">{format(parseISO(item.date), 'EEE', { locale: ptBR })}</div>
                    </div>
                    <span className="text-base shrink-0">{CHANNEL_ICONS[item.channel]}</span>
                    <Badge className="text-[10px] shrink-0" style={{ backgroundColor: fc.bg, color: fc.text }}>
                      {funnelStage}
                    </Badge>
                    {item.product && <Badge variant="outline" className="text-[10px] shrink-0">{item.product}</Badge>}
                    <p className="text-sm truncate flex-1 min-w-0">{item.caption.substring(0, 80)}...</p>
                    <div className="flex gap-1 shrink-0">
                      {!isApproved && (
                        <Button size="sm" variant="outline" onClick={() => onApprove(item.id)} className="h-7 text-[10px] border-green-300 text-green-700 hover:bg-green-50">
                          <Check className="h-3 w-3 mr-0.5" /> Aprovar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => onRegenerate(item)} className="h-7 text-[10px] border-[#E8CD7E]/50 text-[#8B6914]">
                        <RefreshCw className="h-3 w-3 mr-0.5" /> Regenerar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
