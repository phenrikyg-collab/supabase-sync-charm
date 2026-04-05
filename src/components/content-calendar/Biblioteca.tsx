import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, Copy, Trash2, CalendarPlus, Edit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ContentItem, CHANNEL_ICONS, CHANNEL_LABELS, STATUS_COLORS, ContentChannel } from './types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BibliotecaProps {
  contentItems: ContentItem[];
  onUpdate: (id: string, updates: Partial<ContentItem>) => void;
  onDelete: (id: string) => void;
  onClone: (id: string) => void;
  onSchedule: (id: string) => void;
}

export function Biblioteca({ contentItems, onUpdate, onDelete, onClone, onSchedule }: BibliotecaProps) {
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<ContentChannel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'created'>('created');

  const filtered = useMemo(() => {
    let items = [...contentItems];
    if (search) items = items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()) || i.caption.toLowerCase().includes(search.toLowerCase()));
    if (channelFilter !== 'all') items = items.filter(i => i.channel === channelFilter);
    if (statusFilter !== 'all') items = items.filter(i => i.status === statusFilter);
    items.sort((a, b) => {
      const da = sortBy === 'date' ? a.date : a.createdAt;
      const db = sortBy === 'date' ? b.date : b.createdAt;
      return db.localeCompare(da);
    });
    return items;
  }, [contentItems, search, channelFilter, statusFilter, sortBy]);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(232,205,126,0.15)' }}>
        <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
          📋 Biblioteca de Conteúdo
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conteúdo..." className="pl-9" />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'instagram-feed', 'instagram-reels', 'instagram-stories', 'email', 'whatsapp'] as const).map(ch => (
              <button key={ch} onClick={() => setChannelFilter(ch)} className={cn('px-2.5 py-1 rounded-full text-xs font-medium transition-all', channelFilter === ch ? 'text-white' : 'bg-muted text-muted-foreground')} style={channelFilter === ch ? { backgroundColor: '#8B6914' } : undefined}>
                {ch === 'all' ? 'Todos' : CHANNEL_ICONS[ch]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground">Nenhum conteúdo encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => {
              const sc = STATUS_COLORS[item.status];
              return (
                <div key={item.id} className="bg-card rounded-lg border p-4 hover:-translate-y-0.5 transition-all hover:shadow-md" style={{ borderColor: 'rgba(232,205,126,0.3)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{CHANNEL_ICONS[item.channel]}</span>
                    <Badge variant="outline" className="text-[10px]">{item.type || CHANNEL_LABELS[item.channel]}</Badge>
                    <Badge className={cn('text-[10px] ml-auto', sc.bg, sc.text)}>{item.status}</Badge>
                  </div>
                  <h3 className="font-medium text-sm mb-1 line-clamp-2" style={{ color: '#1D1D1B' }}>{item.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{item.caption.substring(0, 100)}...</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{item.date ? format(parseISO(item.date), 'dd/MM/yyyy') : 'Sem data'}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onClone(item.id); toast.success('Conteúdo clonado!'); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onUpdate(item.id, { status: 'agendado' }); toast.success('Agendado!'); }}>
                        <CalendarPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { onDelete(item.id); toast.success('Excluído!'); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
