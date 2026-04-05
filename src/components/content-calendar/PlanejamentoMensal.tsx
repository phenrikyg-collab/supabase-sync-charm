import { useState, useCallback, useEffect } from 'react';
import { addMonths, format, getDaysInMonth, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { callClaude, safeParseJSON } from '@/lib/claudeApi';
import { BrandConfig } from '@/lib/brandContext';
import { ContentItem } from './types';
import { Step1MesDatas } from './planner/Step1MesDatas';
import { Step2Produtos } from './planner/Step2Produtos';
import { Step3Funil } from './planner/Step3Funil';
import { Step4Gerar } from './planner/Step4Gerar';
import { GenerationOverlay } from './planner/GenerationOverlay';
import { getHolidaysForMonth } from './planner/brazilianHolidays';
import {
  PlanConfig, PlannerChannel, BrandDate, ProductItem, ProductEvent,
  FunnelConfig, DEFAULT_CHANNELS, DEFAULT_PRODUCTS,
} from './planner/plannerTypes';

interface PlanejamentoMensalProps {
  onContentGenerated: (items: ContentItem[]) => void;
  onNavigateToCalendar: () => void;
}

const STEPS = ['Mês & Datas', 'Produtos', 'Estratégia de Funil', 'Gerar Calendário'];

// Helper: build date list for the month
function buildDateList(year: number, month: number) {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
  const yearStr = String(year);
  const monthStr = String(month).padStart(2, '0');
  const dates: { dateStr: string; dayOfWeek: number; dayName: string; day: number }[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    dates.push({
      dateStr: `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`,
      dayOfWeek: getDay(d),
      dayName: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][getDay(d)],
      day,
    });
  }
  return dates;
}

function sharedContext(config: {
  holidays: { date: string; label: string; included: boolean }[];
  products: ProductItem[];
  productEvents: ProductEvent[];
  funnel: FunnelConfig;
  coupon: string;
}) {
  const importantDatesStr = config.holidays
    .filter(d => d.included)
    .map(d => `${d.date}: ${d.label}`)
    .join('\n');
  const productsStr = config.products
    .filter(p => p.included)
    .map(p => `${p.name} (prioridade: ${p.priority})`)
    .join(', ');
  const productEventsStr = config.productEvents
    .map(e => `${e.date}: ${e.productName} - ${e.type}`)
    .join('\n');
  return { importantDatesStr, productsStr, productEventsStr };
}

// --- Call 1: Stories (1x/day, every day) ---
function buildStoriesPrompt(year: number, month: number, config: {
  holidays: { date: string; label: string; included: boolean }[];
  products: ProductItem[];
  productEvents: ProductEvent[];
  funnel: FunnelConfig;
  coupon: string;
}): string {
  const dates = buildDateList(year, month);
  const monthName = format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: ptBR });
  const { importantDatesStr, productsStr, productEventsStr } = sharedContext(config);
  const daysInMonth = dates.length;

  const schedule = dates.map(d => {
    const extra = d.dayOfWeek === 2 ? ' ⚡ DIA DE LIVE — Stories deve ser "Hoje tem live!"' : '';
    return `${d.dateStr} (${d.dayName})${extra}`;
  }).join('\n');

  return `Crie EXATAMENTE ${daysInMonth} Stories para Instagram para ${monthName}.

REGRAS:
1. UM Story por dia, sem pular nenhum dia — total: ${daysInMonth} itens
2. Horário: sempre 09:00
3. Toda terça-feira: o Story DEVE ser "Hoje tem live!" com tema da live
4. Caption curta (formato Stories: punchy, máx 3 linhas)
5. Mix de funil: ${config.funnel.topo}% topo / ${config.funnel.meio}% meio / ${config.funnel.fundo}% fundo
6. Distribua produtos equilibradamente

CRONOGRAMA (gere 1 item para cada linha):
${schedule}

DATAS IMPORTANTES: ${importantDatesStr || 'Nenhuma'}
EVENTOS: ${productEventsStr || 'Nenhum'}
PRODUTOS: ${productsStr}
CUPOM: ${config.coupon || 'nenhum'}

Retorne SOMENTE um JSON array com EXATAMENTE ${daysInMonth} objetos:
[{"date":"YYYY-MM-DD","channel":"Instagram Stories","funnel_stage":"topo"|"meio"|"fundo","product":"nome ou null","theme":"tema curto","caption":"caption curta Stories","hashtags":[],"cta":"string","time":"09:00","type":"Stories","isLive":false,"status":"rascunho"}]

Para terças-feiras de live, use isLive: true.`;
}

// --- Call 2: Reels (2x/day, every day) ---
function buildReelsPrompt(year: number, month: number, config: {
  holidays: { date: string; label: string; included: boolean }[];
  products: ProductItem[];
  productEvents: ProductEvent[];
  funnel: FunnelConfig;
  coupon: string;
}): string {
  const dates = buildDateList(year, month);
  const monthName = format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: ptBR });
  const { importantDatesStr, productsStr, productEventsStr } = sharedContext(config);
  const totalItems = dates.length * 2;

  const schedule = dates.map(d => {
    const extra = d.dayOfWeek === 2 ? ' ⚡ TERÇA DE LIVE — Reels 20:00 deve ser teaser/review da live' : '';
    return `${d.dateStr} (${d.dayName}): Reels 11:00 + Reels 20:00${extra}`;
  }).join('\n');

  return `Crie EXATAMENTE ${totalItems} Reels para Instagram para ${monthName}.

REGRAS:
1. DOIS Reels por dia (manhã 11:00 + noite 20:00) — total: ${totalItems} itens
2. Toda terça: o Reels das 20:00 deve ser teaser/bastidor da live ou review pós-live (isLive: true)
3. Mix de funil: ${config.funnel.topo}% topo / ${config.funnel.meio}% meio / ${config.funnel.fundo}% fundo
4. Primeira semana: foque em topo (alcance, descoberta)
5. Última semana: foque em fundo (conversão, urgência)
6. Distribua produtos equilibradamente

CRONOGRAMA (gere 2 itens para cada dia):
${schedule}

DATAS IMPORTANTES: ${importantDatesStr || 'Nenhuma'}
EVENTOS: ${productEventsStr || 'Nenhum'}
PRODUTOS: ${productsStr}
CUPOM: ${config.coupon || 'nenhum'}

Retorne SOMENTE um JSON array com EXATAMENTE ${totalItems} objetos:
[{"date":"YYYY-MM-DD","channel":"Instagram Reels","funnel_stage":"topo"|"meio"|"fundo","product":"nome ou null","theme":"tema até 60 chars","caption":"legenda completa","hashtags":["h1","h2"],"cta":"string","time":"11:00"|"20:00","type":"Reels","isLive":false,"status":"rascunho"}]

Para Reels de terça 20:00 (live), use isLive: true e type: "Live".`;
}

// --- Call 3: Feed (3x/week: Mon, Wed, Fri) + Live support (Tue) ---
function buildFeedLivePrompt(year: number, month: number, config: {
  holidays: { date: string; label: string; included: boolean }[];
  products: ProductItem[];
  productEvents: ProductEvent[];
  funnel: FunnelConfig;
  coupon: string;
}): string {
  const dates = buildDateList(year, month);
  const monthName = format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: ptBR });
  const { importantDatesStr, productsStr, productEventsStr } = sharedContext(config);

  const feedDays = dates.filter(d => [1, 3, 5].includes(d.dayOfWeek)); // Mon, Wed, Fri
  const liveTuesdays = dates.filter(d => d.dayOfWeek === 2);
  const totalItems = feedDays.length + liveTuesdays.length;

  const schedule = [
    ...feedDays.map(d => `${d.dateStr} (${d.dayName}): Feed 11:00`),
    ...liveTuesdays.map(d => `${d.dateStr} (${d.dayName}): Feed 11:00 — POST DE AQUECIMENTO DA LIVE`),
  ].sort();

  return `Crie EXATAMENTE ${totalItems} posts de Feed para Instagram para ${monthName}.

REGRAS:
1. Feed normal: segunda, quarta e sexta às 11:00
2. Feed de live: toda terça às 11:00 — post de aquecimento com tema e horário da live (isLive: true)
3. Total: ${feedDays.length} feeds normais + ${liveTuesdays.length} feeds de live = ${totalItems}
4. Mix de funil: ${config.funnel.topo}% topo / ${config.funnel.meio}% meio / ${config.funnel.fundo}% fundo
5. Primeira semana: foque em topo. Última semana: foque em fundo
6. Datas de lançamento: teaser D-7, antecipação D-3, lançamento D0, prova social D+2

CRONOGRAMA (gere 1 item para cada linha):
${schedule.join('\n')}

DATAS IMPORTANTES: ${importantDatesStr || 'Nenhuma'}
EVENTOS: ${productEventsStr || 'Nenhum'}
PRODUTOS: ${productsStr}
CUPOM: ${config.coupon || 'nenhum'}

Retorne SOMENTE um JSON array com EXATAMENTE ${totalItems} objetos:
[{"date":"YYYY-MM-DD","channel":"Instagram Feed","funnel_stage":"topo"|"meio"|"fundo","product":"nome ou null","theme":"tema até 60 chars","caption":"legenda completa com emojis e storytelling","hashtags":["h1","h2","h3"],"cta":"chamada para ação","time":"11:00","type":"Feed","isLive":false,"status":"rascunho"}]

Para posts de terça (live), use isLive: true e type: "Live".`;
}

const channelMap: Record<string, ContentItem['channel']> = {
  'instagram-feed': 'instagram-feed',
  'instagram-reels': 'instagram-reels',
  'instagram-stories': 'instagram-stories',
  'Instagram Feed': 'instagram-feed',
  'Instagram Reels': 'instagram-reels',
  'Instagram Stories': 'instagram-stories',
};

function parseIGItems(parsed: any[], year: number, month: number): (ContentItem & { funnelStage?: string; isLive?: boolean })[] {
  return parsed.map((p: any) => ({
    id: crypto.randomUUID(),
    date: p.date || `${year}-${String(month).padStart(2, '0')}-01`,
    channel: channelMap[p.channel] || 'instagram-feed',
    type: p.type || 'post',
    title: (p.theme || p.caption || '').substring(0, 60),
    caption: p.caption || '',
    hashtags: p.hashtags || [],
    cta: p.cta || '',
    suggestedTime: p.time || '11:00',
    status: 'rascunho' as const,
    objective: 'engajamento' as const,
    tone: 'inspiracional' as const,
    audience: 'fas-marca' as const,
    product: p.product || undefined,
    createdAt: new Date().toISOString(),
    funnelStage: p.funnel_stage,
    isLive: p.isLive || false,
  }));
}

export function PlanejamentoMensal({ onContentGenerated, onNavigateToCalendar }: PlanejamentoMensalProps) {
  const nextMonth = addMonths(new Date(), 1);
  const [step, setStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [generatedCount, setGeneratedCount] = useState({ instagram: 0, email: 0, whatsapp: 0 });

  const [month, setMonth] = useState(nextMonth.getMonth() + 1);
  const [year, setYear] = useState(nextMonth.getFullYear());
  const [channels, setChannels] = useState<PlannerChannel[]>(DEFAULT_CHANNELS);
  const [holidays, setHolidays] = useState(getHolidaysForMonth(nextMonth.getMonth() + 1, nextMonth.getFullYear()));
  const [brandDates, setBrandDates] = useState<BrandDate[]>([]);
  const [avoidDays, setAvoidDays] = useState<number[]>([]);

  const [products, setProducts] = useState<ProductItem[]>(DEFAULT_PRODUCTS);
  const [productEvents, setProductEvents] = useState<ProductEvent[]>([]);

  const [funnel, setFunnel] = useState<FunnelConfig>({ topo: 30, meio: 40, fundo: 30 });
  const [audiences, setAudiences] = useState<string[]>(['fas-marca', 'clientes-recentes']);
  const [emailGoal, setEmailGoal] = useState('relacionamento');
  const [whatsappGoal, setWhatsappGoal] = useState('lancamento');
  const [coupon, setCoupon] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  useEffect(() => {
    setHolidays(getHolidaysForMonth(month, year));
  }, [month, year]);

  const config: PlanConfig = {
    month, year, channels, holidays, brandDates, avoidDays,
    products, productEvents, funnel, audiences, emailGoal, whatsappGoal, coupon, customNotes,
  };

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setProgress(5);

    const enabledChannels = channels.filter(c => c.enabled);
    const activeProducts = products.filter(p => p.included).map(p => p.name).join(', ');
    const importantDates = [
      ...holidays.filter(h => h.included).map(h => `${h.date}: ${h.label}`),
      ...brandDates.map(bd => `${bd.date}: ${bd.label} (${bd.type})`),
    ].join('; ');
    const events = productEvents.map(e => `${e.date}: ${e.productName} (${e.type})`).join('; ');
    const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: ptBR });
    const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));

    const allItems: ContentItem[] = [];
    const igConfig = { holidays, products, productEvents, funnel, coupon };

    const brandConfig: BrandConfig = {
      activeProducts: products.filter(p => p.included).map(p => p.name),
      coupon: coupon || undefined,
      monthName: monthLabel,
      funnelTop: funnel.topo,
      funnelMid: funnel.meio,
      funnelBottom: funnel.fundo,
      emailGoal,
      wppGoal: whatsappGoal,
      customNotes: customNotes || undefined,
    };

    const callAI = async (prompt: string): Promise<string> => {
      return await callClaude(prompt, brandConfig);
    };

    // ========== INSTAGRAM: 3 SEPARATE CALLS ==========
    const hasIG = enabledChannels.some(c => c.channel.startsWith('Instagram'));
    if (hasIG) {
      // Call 1: Stories (1x/day)
      setProgress(10);
      try {
        const prompt = buildStoriesPrompt(year, month, igConfig);
        const raw = await callAI(prompt);
        const parsed = safeParseJSON(raw);
        const items = parseIGItems(parsed, year, month);
        if (parsed.length < daysInMonth) {
          toast.warning(`Stories: esperado ${daysInMonth}, recebido ${parsed.length}. Revise na tela de revisão.`);
        }
        allItems.push(...items);
        console.log(`✅ Stories: ${parsed.length} itens gerados`);
      } catch (e) {
        console.error('Stories generation failed:', e);
        toast.error('Falha ao gerar Stories. Tente novamente.');
      }

      // Call 2: Reels (2x/day)
      setProgress(30);
      try {
        const prompt = buildReelsPrompt(year, month, igConfig);
        const raw = await callAI(prompt);
        const parsed = safeParseJSON(raw);
        const items = parseIGItems(parsed, year, month);
        const expectedReels = daysInMonth * 2;
        if (parsed.length < expectedReels * 0.8) {
          toast.warning(`Reels: esperado ~${expectedReels}, recebido ${parsed.length}.`);
        }
        allItems.push(...items);
        console.log(`✅ Reels: ${parsed.length} itens gerados`);
      } catch (e) {
        console.error('Reels generation failed:', e);
        toast.error('Falha ao gerar Reels. Tente novamente.');
      }

      // Call 3: Feed + Live support
      setProgress(50);
      try {
        const prompt = buildFeedLivePrompt(year, month, igConfig);
        const raw = await callAI(prompt);
        const parsed = safeParseJSON(raw);
        const items = parseIGItems(parsed, year, month);
        allItems.push(...items);
        console.log(`✅ Feed+Live: ${parsed.length} itens gerados`);
      } catch (e) {
        console.error('Feed generation failed:', e);
        toast.error('Falha ao gerar Feed. Tente novamente.');
      }
    }

    // ========== EMAIL (2x/week) ==========
    const hasEmail = enabledChannels.some(c => c.channel === 'E-mail');
    if (hasEmail) {
      setProgress(65);
      try {
        const emailFreq = enabledChannels.find(c => c.channel === 'E-mail')?.frequency || '2x/week';
        const weeks = Math.ceil(daysInMonth / 7);
        const expectedEmails = emailFreq === '2x/week' ? weeks * 2 : emailFreq === '1x/week' ? weeks : weeks * 2;
        const prompt = `Crie EXATAMENTE ${expectedEmails} e-mails para ${monthLabel} (frequência: ${emailFreq}).

REGRAS:
1. Distribua os e-mails uniformemente ao longo do mês (${emailFreq})
2. Foco: ${emailGoal}
3. Alterne entre terças e quintas para envio
4. Mix: nutrição, promoção, relacionamento
5. Cada e-mail deve ter assunto atrativo e corpo completo

Produtos: ${activeProducts}
Datas âncora: ${importantDates || 'nenhuma'}
Cupom do mês: ${coupon || 'nenhum'}
Eventos: ${events || 'nenhum'}

Retorne SOMENTE um JSON array com EXATAMENTE ${expectedEmails} objetos:
[{"date":"YYYY-MM-DD","channel":"email","subject":"assunto do email","preview_text":"texto de preview","body":"corpo completo do email com formatação","cta":"chamada para ação","audience":"segmento","funnel_stage":"topo"|"meio"|"fundo","time":"09:00"|"14:00"}]`;
        const raw = await callAI(prompt);
        const parsed = safeParseJSON(raw);
        parsed.forEach((p: any) => {
          allItems.push({
            id: crypto.randomUUID(),
            date: p.date || `${year}-${String(month).padStart(2, '0')}-01`,
            channel: 'email',
            type: 'email',
            title: p.subject || 'E-mail',
            caption: p.body || '',
            hashtags: [],
            cta: p.cta || '',
            suggestedTime: p.time || '09:00',
            status: 'rascunho',
            objective: 'conversao',
            tone: 'inspiracional',
            audience: 'fas-marca',
            subjectLine: p.subject,
            previewText: p.preview_text,
            product: undefined,
            createdAt: new Date().toISOString(),
            funnelStage: p.funnel_stage,
          } as ContentItem & { funnelStage?: string });
        });
        console.log(`✅ E-mails: ${parsed.length} itens gerados`);
      } catch (e) {
        console.error('Email generation failed:', e);
        toast.error('Falha ao gerar e-mails. Tente novamente.');
      }
    }

    // ========== WHATSAPP (2x/week) ==========
    const hasWpp = enabledChannels.some(c => c.channel === 'WhatsApp');
    if (hasWpp) {
      setProgress(80);
      try {
        const wppFreq = enabledChannels.find(c => c.channel === 'WhatsApp')?.frequency || '2x/week';
        const weeks = Math.ceil(daysInMonth / 7);
        const expectedWpp = wppFreq === '2x/week' ? weeks * 2 : wppFreq === '3x/week' ? weeks * 3 : weeks;
        const prompt = `Crie EXATAMENTE ${expectedWpp} campanhas WhatsApp para ${monthLabel} (frequência: ${wppFreq}).

REGRAS:
1. Distribua uniformemente ao longo do mês
2. Foco: ${whatsappGoal}
3. Alterne entre segundas e quintas para envio
4. Tom: direto, pessoal, com urgência quando necessário
5. Inclua emoji e linguagem informal mas sofisticada

Produtos: ${activeProducts}
Eventos: ${events || 'nenhum'}
Cupom: ${coupon || 'nenhum'}

Retorne SOMENTE um JSON array com EXATAMENTE ${expectedWpp} objetos:
[{"date":"YYYY-MM-DD","channel":"whatsapp","audience":"segmento","message":"mensagem completa com emojis","coupon":"código ou null","time":"14:00"|"15:00"|"21:00","funnel_stage":"topo"|"meio"|"fundo"}]`;
        const raw = await callAI(prompt);
        const parsed = safeParseJSON(raw);
        parsed.forEach((p: any) => {
          allItems.push({
            id: crypto.randomUUID(),
            date: p.date || `${year}-${String(month).padStart(2, '0')}-01`,
            channel: 'whatsapp',
            type: 'whatsapp',
            title: `WPP — ${p.audience || 'Campanha'}`,
            caption: p.message || '',
            hashtags: [],
            cta: '',
            suggestedTime: p.time || '21:00',
            status: 'rascunho',
            objective: 'conversao',
            tone: 'urgencia',
            audience: 'fas-marca',
            product: undefined,
            createdAt: new Date().toISOString(),
            funnelStage: p.funnel_stage,
          } as ContentItem & { funnelStage?: string });
        });
        console.log(`✅ WhatsApp: ${parsed.length} itens gerados`);
      } catch (e) {
        console.error('WhatsApp generation failed:', e);
        toast.error('Falha ao gerar campanhas WhatsApp. Tente novamente.');
      }
    }

    setProgress(100);
    setIsGenerating(false);

    if (allItems.length > 0) {
      onContentGenerated(allItems);
      setGeneratedCount({
        instagram: allItems.filter(i => i.channel.startsWith('instagram')).length,
        email: allItems.filter(i => i.channel === 'email').length,
        whatsapp: allItems.filter(i => i.channel === 'whatsapp').length,
      });
      setShowSuccess(true);
      toast.success(`${allItems.length} conteúdos gerados com sucesso!`);
    } else {
      toast.error('Nenhum conteúdo foi gerado. Verifique as configurações e tente novamente.');
    }
  }, [channels, products, holidays, brandDates, productEvents, funnel, avoidDays, month, year, emailGoal, whatsappGoal, coupon, onContentGenerated]);

  if (showSuccess) {
    const total = generatedCount.instagram + generatedCount.email + generatedCount.whatsapp;
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#F5F5F5' }}>
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: 'rgba(232,205,126,0.2)' }}>
            <Check className="h-10 w-10" style={{ color: '#8B6914' }} />
          </div>
          <h2 className="text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
            Calendário Gerado! ✨
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong>{total}</strong> conteúdos gerados</p>
            {generatedCount.instagram > 0 && <p>📷 {generatedCount.instagram} posts Instagram (Stories + Reels + Feed)</p>}
            {generatedCount.email > 0 && <p>📧 {generatedCount.email} e-mails</p>}
            {generatedCount.whatsapp > 0 && <p>💬 {generatedCount.whatsapp} campanhas WhatsApp</p>}
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={onNavigateToCalendar} style={{ backgroundColor: '#8B6914' }} className="text-white">
              📅 Ver Calendário
            </Button>
            <Button variant="outline" onClick={() => onNavigateToCalendar()} className="border-[#E8CD7E]/50 text-[#8B6914]">
              📋 Revisar e Editar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full" style={{ backgroundColor: '#F5F5F5' }}>
      <GenerationOverlay isVisible={isGenerating} progress={progress} />

      {/* Progress bar */}
      <div className="px-6 py-5 border-b bg-white" style={{ borderColor: 'rgba(232,205,126,0.15)' }}>
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <button
                onClick={() => i <= step && setStep(i)}
                className="flex items-center gap-2 text-xs font-medium transition-all"
                style={{ color: i <= step ? '#8B6914' : '#999', fontFamily: "'Cormorant Garamond', serif", cursor: i <= step ? 'pointer' : 'default' }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    backgroundColor: i < step ? '#8B6914' : i === step ? '#E8CD7E' : 'rgba(0,0,0,0.05)',
                    color: i < step ? 'white' : i === step ? '#1D1D1B' : '#999',
                  }}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="hidden sm:inline">{s}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2" style={{ backgroundColor: i < step ? '#E8CD7E' : 'rgba(0,0,0,0.08)' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {step === 0 && (
            <Step1MesDatas
              month={month} year={year} onMonthChange={(m, y) => { setMonth(m); setYear(y); }}
              channels={channels} onChannelsChange={setChannels}
              holidays={holidays} onHolidaysChange={setHolidays}
              brandDates={brandDates} onBrandDatesChange={setBrandDates}
              avoidDays={avoidDays} onAvoidDaysChange={setAvoidDays}
            />
          )}
          {step === 1 && (
            <Step2Produtos
              products={products} onProductsChange={setProducts}
              productEvents={productEvents} onProductEventsChange={setProductEvents}
            />
          )}
          {step === 2 && (
            <Step3Funil
              funnel={funnel} onFunnelChange={setFunnel}
              audiences={audiences} onAudiencesChange={setAudiences}
              emailGoal={emailGoal} onEmailGoalChange={setEmailGoal}
              whatsappGoal={whatsappGoal} onWhatsappGoalChange={setWhatsappGoal}
              coupon={coupon} onCouponChange={setCoupon}
              customNotes={customNotes} onCustomNotesChange={setCustomNotes}
            />
          )}
          {step === 3 && (
            <Step4Gerar config={config} onGenerate={handleGenerate} isGenerating={isGenerating} />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t bg-white" style={{ borderColor: 'rgba(232,205,126,0.15)' }}>
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0} className="border-[#E8CD7E]/30">
          ← Anterior
        </Button>
        {step < STEPS.length - 1 && (
          <Button onClick={() => setStep(s => s + 1)} style={{ backgroundColor: '#8B6914' }} className="text-white">
            Próximo →
          </Button>
        )}
      </div>
    </div>
  );
}
