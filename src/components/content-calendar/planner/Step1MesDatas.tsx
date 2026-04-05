import { useState } from 'react';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getHolidaysForMonth, HolidayDate } from './brazilianHolidays';
import {
  PlannerChannel, BrandDate, DEFAULT_CHANNELS, CHANNEL_FREQUENCY_OPTIONS,
  BRAND_DATE_TYPE_COLORS, BRAND_DATE_TYPE_LABELS,
} from './plannerTypes';

interface Step1Props {
  month: number;
  year: number;
  onMonthChange: (m: number, y: number) => void;
  channels: PlannerChannel[];
  onChannelsChange: (c: PlannerChannel[]) => void;
  holidays: HolidayDate[];
  onHolidaysChange: (h: HolidayDate[]) => void;
  brandDates: BrandDate[];
  onBrandDatesChange: (d: BrandDate[]) => void;
  avoidDays: number[];
  onAvoidDaysChange: (d: number[]) => void;
}

const weekDayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function Step1MesDatas({
  month, year, onMonthChange, channels, onChannelsChange,
  holidays, onHolidaysChange, brandDates, onBrandDatesChange,
  avoidDays, onAvoidDaysChange,
}: Step1Props) {
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [newBrand, setNewBrand] = useState({ date: '', label: '', type: 'lancamento' as BrandDate['type'] });

  const currentDate = new Date(year, month - 1, 1);

  const navigateMonth = (dir: number) => {
    const next = addMonths(currentDate, dir);
    onMonthChange(next.getMonth() + 1, next.getFullYear());
  };

  const toggleChannel = (idx: number) => {
    const updated = [...channels];
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
    onChannelsChange(updated);
  };

  const setFrequency = (idx: number, freq: string) => {
    const updated = [...channels];
    updated[idx] = { ...updated[idx], frequency: freq };
    onChannelsChange(updated);
  };

  const toggleHoliday = (id: string) => {
    onHolidaysChange(holidays.map(h => h.id === id ? { ...h, included: !h.included } : h));
  };

  const removeHoliday = (id: string) => {
    onHolidaysChange(holidays.filter(h => h.id !== id));
  };

  const addBrandDate = () => {
    if (!newBrand.date || !newBrand.label) return;
    const bd: BrandDate = {
      id: crypto.randomUUID(),
      date: newBrand.date,
      label: newBrand.label,
      type: newBrand.type,
      color: BRAND_DATE_TYPE_COLORS[newBrand.type],
    };
    onBrandDatesChange([...brandDates, bd]);
    setNewBrand({ date: '', label: '', type: 'lancamento' });
    setShowBrandModal(false);
  };

  const toggleAvoidDay = (day: number) => {
    onAvoidDaysChange(
      avoidDays.includes(day) ? avoidDays.filter(d => d !== day) : [...avoidDays, day]
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* LEFT — Month & Channels */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            Selecionar Mês
          </h3>
          <div className="flex items-center gap-3 mb-6">
            <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)} className="border-[#E8CD7E]/30">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xl font-semibold capitalize min-w-[180px] text-center" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={() => navigateMonth(1)} className="border-[#E8CD7E]/30">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            Canais e Frequência
          </h3>
          <div className="space-y-3">
            {channels.map((ch, idx) => (
              <div key={ch.channel} className="flex items-center gap-3 p-3 rounded-lg bg-white border" style={{ borderColor: 'rgba(232,205,126,0.2)' }}>
                <Checkbox checked={ch.enabled} onCheckedChange={() => toggleChannel(idx)} />
                <span className="text-sm font-medium flex-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>{ch.channel}</span>
                {ch.enabled && (
                  <Select value={ch.frequency} onValueChange={(v) => setFrequency(idx, v)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(CHANNEL_FREQUENCY_OPTIONS[ch.channel] || []).map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — Dates */}
      <div className="space-y-6">
        {/* Holidays */}
        <div>
          <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            🇧🇷 Feriados e Datas Nacionais
          </h3>
          <div className="flex flex-wrap gap-2">
            {holidays.map(h => (
              <div
                key={h.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all cursor-pointer"
                style={{
                  borderColor: h.included ? '#E8CD7E' : 'rgba(0,0,0,0.1)',
                  backgroundColor: h.included ? 'rgba(232,205,126,0.15)' : 'rgba(0,0,0,0.03)',
                  color: h.included ? '#8B6914' : '#999',
                }}
                onClick={() => toggleHoliday(h.id)}
              >
                <span>{h.date.substring(8, 10)}/{h.date.substring(5, 7)}</span>
                <span className="font-medium">{h.label}</span>
                <button onClick={(e) => { e.stopPropagation(); removeHoliday(h.id); }} className="ml-1 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {holidays.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma data para este mês.</p>
            )}
          </div>
        </div>

        {/* Brand Dates */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
              🏷️ Datas da Marca
            </h3>
            <Button size="sm" variant="outline" onClick={() => setShowBrandModal(true)} className="text-xs border-[#E8CD7E]/50 text-[#8B6914]">
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {brandDates.map(bd => (
              <div key={bd.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border" style={{ borderColor: bd.color + '50', backgroundColor: bd.color + '15', color: bd.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bd.color }} />
                <span>{bd.date.substring(8, 10)}/{bd.date.substring(5, 7)}</span>
                <span className="font-medium">{bd.label}</span>
                <span className="opacity-60">({BRAND_DATE_TYPE_LABELS[bd.type]})</span>
                <button onClick={() => onBrandDatesChange(brandDates.filter(d => d.id !== bd.id))} className="ml-1 hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Avoid Days */}
        <div>
          <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            🚫 Dias da Semana a Evitar
          </h3>
          <TooltipProvider>
            <div className="flex gap-2">
              {weekDayLabels.map((label, idx) => (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => toggleAvoidDay(idx)}
                      className="w-12 h-10 rounded-lg text-xs font-medium border transition-all"
                      style={{
                        borderColor: avoidDays.includes(idx) ? '#ef4444' : 'rgba(232,205,126,0.3)',
                        backgroundColor: avoidDays.includes(idx) ? 'rgba(239,68,68,0.1)' : 'white',
                        color: avoidDays.includes(idx) ? '#ef4444' : '#666',
                      }}
                    >
                      {label}
                    </button>
                  </TooltipTrigger>
                  {idx === 4 && <TooltipContent>Quinta tem historicamente menor conversão</TooltipContent>}
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>
      </div>

      {/* Brand Date Modal */}
      <Dialog open={showBrandModal} onOpenChange={setShowBrandModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Cormorant Garamond', serif" }}>Adicionar Data da Marca</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Data</label>
              <Input type="date" value={newBrand.date} onChange={e => setNewBrand({ ...newBrand, date: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Nome / Label</label>
              <Input value={newBrand.label} onChange={e => setNewBrand({ ...newBrand, label: e.target.value })} placeholder="Ex: Lançamento Coleção Outono" />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <Select value={newBrand.type} onValueChange={(v: BrandDate['type']) => setNewBrand({ ...newBrand, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BRAND_DATE_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addBrandDate} style={{ backgroundColor: '#8B6914' }} className="text-white">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
