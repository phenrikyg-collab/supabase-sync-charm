import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FunnelConfig } from './plannerTypes';

interface Step3Props {
  funnel: FunnelConfig;
  onFunnelChange: (f: FunnelConfig) => void;
  audiences: string[];
  onAudiencesChange: (a: string[]) => void;
  emailGoal: string;
  onEmailGoalChange: (g: string) => void;
  whatsappGoal: string;
  onWhatsappGoalChange: (g: string) => void;
  coupon: string;
  onCouponChange: (c: string) => void;
}

const audienceOptions = [
  { id: 'fas-marca', label: 'Fãs da marca (seguidores engajados)' },
  { id: 'leads-quiz', label: 'Leads quiz / Virtual try-on' },
  { id: 'clientes-recentes', label: 'Clientes recentes (pós-compra)' },
  { id: 'inativos-20dias', label: 'Inativos +20 dias' },
  { id: 'leads-frios', label: 'Leads frios' },
];

const funnelExamples = {
  topo: ['Reels de tendência', 'Stories de bastidores', 'Posts educativos', 'Memes de moda'],
  meio: ['Tutorial de looks', '"Como usar"', 'Comparativos', 'Depoimentos', 'Séries de conteúdo'],
  fundo: ['Oferta de produto', 'Lançamento', 'Prova social', 'Urgência', 'CTA direto', 'WPP blast'],
};

export function Step3Funil({
  funnel, onFunnelChange, audiences, onAudiencesChange,
  emailGoal, onEmailGoalChange, whatsappGoal, onWhatsappGoalChange,
  coupon, onCouponChange,
}: Step3Props) {

  const adjustFunnel = (key: keyof FunnelConfig, value: number) => {
    const remaining = 100 - value;
    const otherKeys = (['topo', 'meio', 'fundo'] as const).filter(k => k !== key);
    const currentOtherTotal = otherKeys.reduce((s, k) => s + funnel[k], 0);

    const newFunnel = { ...funnel, [key]: value };
    if (currentOtherTotal > 0) {
      otherKeys.forEach(k => {
        newFunnel[k] = Math.round((funnel[k] / currentOtherTotal) * remaining);
      });
    } else {
      otherKeys.forEach((k, i) => {
        newFunnel[k] = i === 0 ? Math.ceil(remaining / 2) : Math.floor(remaining / 2);
      });
    }

    const total = newFunnel.topo + newFunnel.meio + newFunnel.fundo;
    if (total !== 100) newFunnel[otherKeys[0]] += (100 - total);

    onFunnelChange(newFunnel);
  };

  const toggleAudience = (id: string) => {
    onAudiencesChange(
      audiences.includes(id) ? audiences.filter(a => a !== id) : [...audiences, id]
    );
  };

  const donutSegments = [
    { pct: funnel.topo, color: '#E8CD7E', label: 'Topo' },
    { pct: funnel.meio, color: '#8B6914', label: 'Meio' },
    { pct: funnel.fundo, color: '#1D1D1B', label: 'Fundo' },
  ];

  let cumulativeOffset = 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* LEFT — Funnel */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
          🎯 Mix de Funil
        </h3>

        {/* Donut Chart */}
        <div className="flex items-center gap-8">
          <svg viewBox="0 0 100 100" className="w-32 h-32">
            {donutSegments.map((seg, i) => {
              const circumference = 2 * Math.PI * 40;
              const dashLength = (seg.pct / 100) * circumference;
              const offset = cumulativeOffset;
              cumulativeOffset += dashLength;
              return (
                <circle
                  key={i}
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="12"
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                  className="transition-all duration-300"
                />
              );
            })}
            <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="text-[8px] font-bold fill-current" style={{ fontFamily: "'DM Sans'" }}>
              100%
            </text>
          </svg>
          <div className="space-y-2">
            {donutSegments.map(seg => (
              <div key={seg.label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="text-sm">{seg.label}: <strong>{seg.pct}%</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-5">
          {([
            { key: 'topo' as const, label: 'Topo (Aquisição / Alcance)', color: '#E8CD7E', examples: funnelExamples.topo },
            { key: 'meio' as const, label: 'Meio (Educação / Relacionamento)', color: '#8B6914', examples: funnelExamples.meio },
            { key: 'fundo' as const, label: 'Fundo (Conversão / Vendas)', color: '#1D1D1B', examples: funnelExamples.fundo },
          ]).map(stage => (
            <div key={stage.key}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{stage.label}</span>
                <span className="text-sm font-bold" style={{ color: stage.color }}>{funnel[stage.key]}%</span>
              </div>
              <Slider
                value={[funnel[stage.key]]}
                onValueChange={([v]) => adjustFunnel(stage.key, v)}
                min={0} max={100} step={5}
                className="mb-1"
              />
              <div className="flex flex-wrap gap-1">
                {stage.examples.map(ex => (
                  <span key={ex} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{ex}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — Audiences & Goals */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            👥 Segmentos de Público
          </h3>
          <div className="space-y-2">
            {audienceOptions.map(opt => (
              <label key={opt.id} className="flex items-center gap-3 p-3 rounded-lg bg-white border cursor-pointer transition-all" style={{ borderColor: audiences.includes(opt.id) ? 'rgba(232,205,126,0.5)' : 'rgba(0,0,0,0.05)' }}>
                <Checkbox checked={audiences.includes(opt.id)} onCheckedChange={() => toggleAudience(opt.id)} />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            📧 Foco CRM
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">E-mail — objetivo do mês</label>
              <Select value={emailGoal} onValueChange={onEmailGoalChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="relacionamento">Relacionamento</SelectItem>
                  <SelectItem value="conversao">Conversão</SelectItem>
                  <SelectItem value="reativacao">Reativação</SelectItem>
                  <SelectItem value="boas-vindas">Boas-vindas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">WhatsApp — objetivo do mês</label>
              <Select value={whatsappGoal} onValueChange={onWhatsappGoalChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lancamento">Lançamento</SelectItem>
                  <SelectItem value="reposicao">Reposição</SelectItem>
                  <SelectItem value="urgencia">Urgência</SelectItem>
                  <SelectItem value="cross-sell">Cross-sell</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Cupom do mês (opcional)</label>
              <Input value={coupon} onChange={e => onCouponChange(e.target.value)} placeholder="Ex: ANNA, LOOK15, MALUCO40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
