import { useMemo } from 'react';
import { format, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlanConfig } from './plannerTypes';
import { buildSystemPrompt, BrandConfig } from '@/lib/brandContext';

interface Step4Props {
  config: PlanConfig;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function Step4Gerar({ config, onGenerate, isGenerating }: Step4Props) {
  const monthDate = new Date(config.year, config.month - 1, 1);
  const daysInMonth = getDaysInMonth(monthDate);

  const estimatedPosts = useMemo(() => {
    let total = 0;
    const weeks = Math.ceil(daysInMonth / 7);
    config.channels.filter(c => c.enabled).forEach(ch => {
      const f = ch.frequency;
      if (f === 'daily' || f === '1x/day') total += daysInMonth;
      else if (f === '2x/day') total += daysInMonth * 2;
      else if (f === '3x/day') total += daysInMonth * 3;
      else if (f === '3x/week') total += weeks * 3;
      else if (f === '2x/week') total += weeks * 2;
      else if (f === '1x/week') total += weeks;
    });
    return total;
  }, [config, daysInMonth]);

  const enabledChannels = config.channels.filter(c => c.enabled);
  const activeProducts = config.products.filter(p => p.included);
  const includedHolidays = config.holidays.filter(h => h.included);

  const brandConfig: BrandConfig = {
    activeProducts: activeProducts.map(p => p.name),
    coupon: config.coupon || undefined,
    monthName: format(monthDate, 'MMMM yyyy', { locale: ptBR }),
    funnelTop: config.funnel.topo,
    funnelMid: config.funnel.meio,
    funnelBottom: config.funnel.fundo,
    emailGoal: config.emailGoal,
    wppGoal: config.whatsappGoal,
    customNotes: config.customNotes || undefined,
  };

  const systemPromptPreview = useMemo(() => buildSystemPrompt(brandConfig), [brandConfig]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h3 className="text-2xl font-bold text-center" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
        Resumo do Planejamento
      </h3>
      <p className="text-center text-muted-foreground text-sm capitalize">
        {format(monthDate, 'MMMM yyyy', { locale: ptBR })}
      </p>

      <div className="grid grid-cols-2 gap-4">
        <SummaryCard label="Canais ativos" value={enabledChannels.length.toString()} detail={enabledChannels.map(c => c.channel).join(', ')} />
        <SummaryCard label="Frequência" value={enabledChannels.map(c => `${c.channel}: ${c.frequency}`).join(' · ')} />
        <SummaryCard label="Datas importantes" value={String(includedHolidays.length + config.brandDates.length)} detail={`${includedHolidays.length} feriados + ${config.brandDates.length} da marca`} />
        <SummaryCard label="Produtos ativos" value={String(activeProducts.length)} detail={activeProducts.map(p => p.name).slice(0, 3).join(', ') + (activeProducts.length > 3 ? '...' : '')} />
        <SummaryCard label="Eventos de produto" value={String(config.productEvents.length)} />
        <SummaryCard label="Mix de funil" value={`${config.funnel.topo}% / ${config.funnel.meio}% / ${config.funnel.fundo}%`} detail="Topo / Meio / Fundo" />
      </div>

      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl" style={{ backgroundColor: 'rgba(232,205,126,0.15)', border: '1px solid rgba(232,205,126,0.3)' }}>
          <span className="text-3xl font-bold" style={{ color: '#8B6914', fontFamily: "'Cormorant Garamond', serif" }}>
            ~{estimatedPosts}
          </span>
          <span className="text-sm text-muted-foreground">posts estimados</span>
        </div>
      </div>

      {/* Brand context preview */}
      <details className="border rounded-lg overflow-hidden" style={{ borderColor: 'rgba(232,205,126,0.3)' }}>
        <summary className="px-4 py-3 text-sm cursor-pointer select-none" style={{ backgroundColor: 'rgba(232,205,126,0.1)', color: '#8B6914' }}>
          🔍 Ver contexto da marca enviado para a IA
        </summary>
        <pre className="p-4 text-xs font-mono bg-white overflow-auto max-h-64 whitespace-pre-wrap" style={{ color: 'rgba(29,29,27,0.7)' }}>
          {systemPromptPreview}
        </pre>
      </details>

      <Button
        onClick={onGenerate}
        disabled={isGenerating}
        className="w-full h-14 text-lg font-semibold text-white rounded-xl transition-all hover:shadow-lg hover:shadow-[#E8CD7E]/30 group"
        style={{ backgroundColor: '#8B6914' }}
      >
        <Sparkles className="h-5 w-5 mr-2 group-hover:animate-pulse" style={{ color: '#E8CD7E' }} />
        Gerar Calendário Completo com IA
      </Button>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="p-4 rounded-lg bg-white border" style={{ borderColor: 'rgba(232,205,126,0.2)' }}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold" style={{ color: '#1D1D1B' }}>{value}</p>
      {detail && <p className="text-[10px] text-muted-foreground mt-1">{detail}</p>}
    </div>
  );
}
