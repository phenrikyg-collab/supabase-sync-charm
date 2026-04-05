import { useState, useMemo } from 'react';
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday, parseISO, getDay,
  getWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContentItem, CHANNEL_ICONS, STATUS_COLORS, ContentChannel } from './types';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CalendarViewProps {
  contentItems: ContentItem[];
  onCreateForDate: (date: string) => void;
  onUpdateContent: (id: string, updates: Partial<ContentItem>) => void;
  onDeleteContent: (id: string) => void;
  onOpenReview?: () => void;
}

const channelFilterOptions: { value: ContentChannel | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'instagram-feed', label: '📷 Feed' },
  { value: 'instagram-reels', label: '🎬 Reels' },
  { value: 'instagram-stories', label: '📱 Stories' },
  { value: 'email', label: '📧 E-mail' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
];

interface WeekSummary {
  number: number;
  instagramCount: number;
  livesCount: number;
  emailCount: number;
  wppCount: number;
  hasTuesdayLive: boolean;
}

function computeWeeklySummary(items: ContentItem[], currentDate: Date): WeekSummary[] {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthItems = items.filter(item => {
    try {
      const d = parseISO(item.date);
      return d >= monthStart && d <= monthEnd;
    } catch { return false; }
  });

  const weekMap: Record<number, ContentItem[]> = {};
  monthItems.forEach(item => {
    const d = parseISO(item.date);
    const w = getWeek(d, { weekStartsOn: 0 });
    if (!weekMap[w]) weekMap[w] = [];
    weekMap[w].push(item);
  });

  return Object.entries(weekMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([weekNum, weekItems]) => {
      const tuesdayItems = weekItems.filter(i => {
        try { return getDay(parseISO(i.date)) === 2; } catch { return false; }
      });
      const hasLive = tuesdayItems.some(i => (i as any).isLive || (i as any).type === 'Live');

      return {
        number: Number(weekNum),
        instagramCount: weekItems.filter(i => i.channel.startsWith('instagram')).length,
        livesCount: weekItems.filter(i => (i as any).isLive || (i as any).type === 'Live').length,
        emailCount: weekItems.filter(i => i.channel === 'email').length,
        wppCount: weekItems.filter(i => i.channel === 'whatsapp').length,
        hasTuesdayLive: hasLive,
      };
    });
}

export function CalendarView({ contentItems, onCreateForDate, onUpdateContent, onDeleteContent, onOpenReview }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [channelFilter, setChannelFilter] = useState<ContentChannel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [weekSummaryOpen, setWeekSummaryOpen] = useState(true);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const filtered = useMemo(() => {
    return contentItems.filter(item => {
      if (channelFilter !== 'all' && item.channel !== channelFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      return true;
    });
  }, [contentItems, channelFilter, statusFilter]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, ContentItem[]> = {};
    filtered.forEach(item => {
      const key = item.date.substring(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [filtered]);

  const weeklySummary = useMemo(() => computeWeeklySummary(contentItems, currentDate), [contentItems, currentDate]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Stats bar */}
      {contentItems.length > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 border-b bg-white" style={{ borderColor: 'rgba(232,205,126,0.1)' }}>
          <span className="text-xs text-muted-foreground">{contentItems.length} posts</span>
          <span className="text-xs">📷 {contentItems.filter(i => i.channel.startsWith('instagram')).length}</span>
          <span className="text-xs">📧 {contentItems.filter(i => i.channel === 'email').length}</span>
          <span className="text-xs">💬 {contentItems.filter(i => i.channel === 'whatsapp').length}</span>
          <div className="flex h-2 flex-1 max-w-[120px] rounded-full overflow-hidden bg-muted">
            {(() => {
              const total = contentItems.length || 1;
              const topo = contentItems.filter(i => (i as any).funnelStage === 'topo').length;
              const meio = contentItems.filter(i => (i as any).funnelStage === 'meio').length;
              const fundo = contentItems.filter(i => (i as any).funnelStage === 'fundo').length;
              return (
                <>
                  <div style={{ width: `${(topo/total)*100}%`, backgroundColor: '#E8CD7E' }} />
                  <div style={{ width: `${(meio/total)*100}%`, backgroundColor: '#8B6914' }} />
                  <div style={{ width: `${(fundo/total)*100}%`, backgroundColor: '#1D1D1B' }} />
                </>
              );
            })()}
          </div>
          <span className="text-xs text-green-600">{contentItems.filter(i => i.status === 'agendado').length} aprovados</span>
          <span className="text-xs text-muted-foreground">{contentItems.filter(i => i.status === 'rascunho').length} pendentes</span>
          {onOpenReview && contentItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={onOpenReview} className="ml-auto text-xs border-[#E8CD7E]/50 text-[#8B6914]">
              📋 Revisar Mês
            </Button>
          )}
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(232,205,126,0.15)' }}>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="border-[#E8CD7E]/30 hover:bg-[#E8CD7E]/10">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold min-w-[200px] text-center capitalize" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="border-[#E8CD7E]/30 hover:bg-[#E8CD7E]/10">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="ml-2 border-[#E8CD7E]/30 hover:bg-[#E8CD7E]/10 text-xs">
            Hoje
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-6 py-3 border-b" style={{ borderColor: 'rgba(232,205,126,0.1)' }}>
        {channelFilterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setChannelFilter(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              channelFilter === opt.value
                ? 'text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            style={channelFilter === opt.value ? { backgroundColor: '#8B6914' } : undefined}
          >
            {opt.label}
          </button>
        ))}
        <div className="w-px h-5 bg-border mx-2" />
        {(['all', 'rascunho', 'agendado', 'publicado'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              statusFilter === s
                ? 'text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            style={statusFilter === s ? { backgroundColor: '#8B6914' } : undefined}
          >
            {s === 'all' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Weekly Summary Widget */}
      {contentItems.length > 0 && weeklySummary.length > 0 && (
        <Collapsible open={weekSummaryOpen} onOpenChange={setWeekSummaryOpen}>
          <div className="px-6 py-2 border-b bg-white" style={{ borderColor: 'rgba(232,205,126,0.1)' }}>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full">
              {weekSummaryOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Resumo Semanal
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1 pb-1">
              {weeklySummary.map(week => (
                <div key={week.number} className="flex items-center gap-4 text-xs" style={{ color: '#8B6914' }}>
                  <span className="font-semibold w-16">Sem {week.number}</span>
                  <span>📷 {week.instagramCount} posts</span>
                  <span>🎥 {week.livesCount} lives</span>
                  <span>📧 {week.emailCount} e-mails</span>
                  <span>💬 {week.wppCount} WPP</span>
                  <span className={week.hasTuesdayLive ? 'text-purple-600' : 'text-red-400'}>
                    {week.hasTuesdayLive ? '✅ Live terça' : '⚠️ Sem live terça'}
                  </span>
                </div>
              ))}
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(232,205,126,0.1)' }}>
          {/* Week day headers */}
          {weekDays.map((d, idx) => (
            <div key={d} className="bg-card px-2 py-2 text-center text-xs font-medium text-muted-foreground relative">
              {d}
              {idx === 2 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-500" title="Live toda terça" />
              )}
            </div>
          ))}

          {/* Day cells */}
          {days.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayItems = itemsByDate[dateKey] || [];
            const inMonth = isSameMonth(day, currentDate);
            const today = isToday(day);
            const isTuesday = getDay(day) === 2;

            return (
              <div
                key={dateKey}
                onClick={() => {
                  if (dayItems.length === 0) onCreateForDate(dateKey);
                }}
                className={cn(
                  'bg-card min-h-[110px] p-1.5 cursor-pointer transition-all hover:ring-1 hover:ring-inset relative',
                  !inMonth && 'opacity-40',
                  today && 'ring-2 ring-inset'
                )}
                style={{
                  ...(today ? { '--tw-ring-color': '#E8CD7E' } as any : {}),
                  ...((!today) ? { '--tw-ring-color': 'rgba(232,205,126,0.5)' } as any : {}),
                }}
              >
                <div className="flex items-center gap-1">
                  <div className={cn(
                    'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                    today && 'text-white'
                  )} style={today ? { backgroundColor: '#E8CD7E' } : undefined}>
                    {format(day, 'd')}
                  </div>
                  {isTuesday && inMonth && (
                    <span className="w-2 h-2 rounded-full bg-purple-500 mb-1" title="Live toda terça" />
                  )}
                </div>
                <div className="space-y-1">
                  {dayItems.slice(0, 3).map(item => {
                    const sc = STATUS_COLORS[item.status];
                    const isLive = (item as any).isLive || (item as any).type === 'Live';
                    return (
                      <button
                        key={item.id}
                        onClick={e => { e.stopPropagation(); setSelectedItem(item); }}
                        className="w-full text-left px-1.5 py-1 rounded text-[10px] leading-tight truncate flex items-center gap-1 hover:-translate-y-0.5 transition-transform border"
                        style={{
                          borderColor: isLive ? 'rgba(147,51,234,0.4)' : 'rgba(232,205,126,0.3)',
                          backgroundColor: isLive ? 'rgba(147,51,234,0.05)' : 'white',
                          borderLeftWidth: '3px',
                          borderLeftColor: isLive ? '#9333ea' : (item as any).funnelStage === 'topo' ? '#E8CD7E' : (item as any).funnelStage === 'fundo' ? '#1D1D1B' : '#8B6914',
                        }}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', sc.dot)} />
                        {isLive ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-purple-600 text-white px-1 py-0 rounded-full shrink-0">
                            🎥 LIVE
                          </span>
                        ) : (
                          <span className="shrink-0">{CHANNEL_ICONS[item.channel]}</span>
                        )}
                        <span className="truncate">{item.title.substring(0, 40)}</span>
                      </button>
                    );
                  })}
                  {dayItems.length > 3 && (
                    <div className="text-[10px] text-muted-foreground text-center">+{dayItems.length - 3} mais</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail drawer */}
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  {(selectedItem as any).isLive ? '🎥' : CHANNEL_ICONS[selectedItem.channel]} {selectedItem.title}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{selectedItem.channel.replace('-', ' ')}</Badge>
                  <Badge className={cn('text-xs', STATUS_COLORS[selectedItem.status].bg, STATUS_COLORS[selectedItem.status].text)}>
                    {selectedItem.status}
                  </Badge>
                  {(selectedItem as any).isLive && (
                    <Badge className="text-xs bg-purple-600 text-white">🎥 LIVE</Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(parseISO(selectedItem.date), 'dd/MM/yyyy')} · {selectedItem.suggestedTime}
                  </span>
                </div>

                {selectedItem.subjectLine && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Assunto</label>
                    <p className="text-sm mt-1">{selectedItem.subjectLine}</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Caption / Conteúdo</label>
                  <Textarea
                    value={selectedItem.caption}
                    onChange={(e) => {
                      const updated = { ...selectedItem, caption: e.target.value };
                      setSelectedItem(updated);
                      onUpdateContent(selectedItem.id, { caption: e.target.value });
                    }}
                    className="mt-1 min-h-[150px] text-sm"
                  />
                </div>

                {selectedItem.hashtags.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Hashtags</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedItem.hashtags.map((h, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[#E8CD7E]/20 text-[#8B6914]">
                          #{h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItem.cta && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">CTA</label>
                    <p className="text-sm mt-1">{selectedItem.cta}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onUpdateContent(selectedItem.id, { status: 'agendado' });
                      setSelectedItem({ ...selectedItem, status: 'agendado' });
                    }}
                    className="border-[#E8CD7E]/50 text-[#8B6914] hover:bg-[#E8CD7E]/10"
                  >
                    📅 Agendar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onUpdateContent(selectedItem.id, { status: 'publicado' });
                      setSelectedItem({ ...selectedItem, status: 'publicado' });
                    }}
                    className="border-green-300 text-green-700 hover:bg-green-50"
                  >
                    ✅ Publicado
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onDeleteContent(selectedItem.id);
                      setSelectedItem(null);
                    }}
                    className="ml-auto border-destructive/50 text-destructive hover:bg-destructive/10"
                  >
                    🗑 Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
