import { useState, useCallback, useEffect } from 'react';
import { addMonths, format, getDaysInMonth, getDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { callClaude, safeParseJSON, ANNA_SYSTEM_PROMPT } from '@/lib/claudeApi';
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

const buildInstagramPrompt = (config: {
  month: number;
  year: number;
  holidays: { date: string; label: string; included: boolean }[];
  products: ProductItem[];
  productEvents: ProductEvent[];
  funnel: FunnelConfig;
  coupon: string;
}): string => {
  const selectedMonth = new Date(config.year, config.month - 1, 1);
  const monthName = format(selectedMonth, 'MMMM yyyy', { locale: ptBR });
  const yearStr = format(selectedMonth, 'yyyy');
  const monthNum = format(selectedMonth, 'MM');
  const daysInMonth = getDaysInMonth(selectedMonth);

  const schedule: string[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(config.year, config.month - 1, day);
    const dayOfWeek = getDay(date);
    const dateStr = `${yearStr}-${monthNum}-${String(day).padStart(2, '0')}`;
    const dayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dayOfWeek];

    const dayEntries: string[] = [];
    // Stories: EVERY day
    dayEntries.push(`${dateStr} (${dayName}): Stories`);
    // Feed: Mon, Wed, Fri, Sun (4x/week)
    if ([0, 1, 3, 5].includes(dayOfWeek)) {
      dayEntries.push(`${dateStr} (${dayName}): Feed`);
    }
    // Reels: Tue, Thu, Sat (3x/week)
    if ([2, 4, 6].includes(dayOfWeek)) {
      dayEntries.push(`${dateStr} (${dayName}): Reels`);
    }
    // Live: EVERY Tuesday (mandatory)
    if (dayOfWeek === 2) {
      dayEntries.push(`${dateStr} (${dayName}): LIVE OBRIGATÓRIA - divulgação prévia`);
    }
    schedule.push(dayEntries.join(' | '));
  }

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

  return `Crie conteúdo para Instagram para ${monthName} seguindo RIGOROSAMENTE o cronograma abaixo.

REGRAS ABSOLUTAS:
1. Gere UM item para CADA entrada do cronograma abaixo — NÃO pule nenhum dia
2. Stories: todos os dias sem exceção, horário 09:00
3. Feed: segunda, quarta, sexta e domingo, horário 11:00
4. Reels: terça, quinta e sábado, horário 20:00
5. LIVE toda terça-feira: gere post de divulgação da live (Stories às 09:00 + Feed às 11:00 + Reels de teaser às 20:00)
6. Mix de funil: ${config.funnel.topo}% topo / ${config.funnel.meio}% meio / ${config.funnel.fundo}% fundo
7. Distribua os produtos de forma equilibrada ao longo do mês
8. Primeira semana: foque em topo (alcance, descoberta)
9. Última semana: foque em fundo (conversão, urgência, "últimas peças")
10. Datas de lançamento/reposição: gere teaser D-7, antecipação D-3, lançamento D0, prova social D+2

CRONOGRAMA OBRIGATÓRIO (gere exatamente estes itens):
${schedule.join('\n')}

DATAS IMPORTANTES:
${importantDatesStr || 'Nenhuma específica'}

EVENTOS DE PRODUTO:
${productEventsStr || 'Nenhum'}

PRODUTOS DISPONÍVEIS: ${productsStr}

CUPOM DO MÊS: ${config.coupon || 'nenhum'}

IMPORTANTE PARA LIVES (toda terça-feira):
- Stories 09:00: "Hoje tem live! [tema da live relacionado ao produto da semana] ✨"
- Feed 11:00: post de aquecimento com tema e horário da live
- Reels 20:00: teaser/bastidor pré-live OU review pós-live
- O tema da live deve girar em torno dos produtos ativos do mês

Retorne SOMENTE um JSON array válido com TODOS os itens do cronograma acima (sem pular nenhum):
[
  {
    "date": "YYYY-MM-DD",
    "channel": "Instagram Feed" | "Instagram Reels" | "Instagram Stories",
    "funnel_stage": "topo" | "meio" | "fundo",
    "product": "nome do produto ou null",
    "theme": "tema em até 60 caracteres",
    "caption": "legenda completa",
    "hashtags": ["hashtag1", "hashtag2"],
    "cta": "chamada para ação",
    "time": "09:00" | "11:00" | "20:00",
    "type": "Stories" | "Feed" | "Reels" | "Live",
    "isLive": true | false,
    "status": "rascunho"
  }
]`;
};

export function PlanejamentoMensal({ onContentGenerated, onNavigateToCalendar }: PlanejamentoMensalProps) {
  const nextMonth = addMonths(new Date(), 1);
  const [step, setStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [generatedCount, setGeneratedCount] = useState({ instagram: 0, email: 0, whatsapp: 0 });

  // Step 1
  const [month, setMonth] = useState(nextMonth.getMonth() + 1);
  const [year, setYear] = useState(nextMonth.getFullYear());
  const [channels, setChannels] = useState<PlannerChannel[]>(DEFAULT_CHANNELS);
  const [holidays, setHolidays] = useState(getHolidaysForMonth(nextMonth.getMonth() + 1, nextMonth.getFullYear()));
  const [brandDates, setBrandDates] = useState<BrandDate[]>([]);
  const [avoidDays, setAvoidDays] = useState<number[]>([4]); // Thursday

  // Step 2
  const [products, setProducts] = useState<ProductItem[]>(DEFAULT_PRODUCTS);
  const [productEvents, setProductEvents] = useState<ProductEvent[]>([]);

  // Step 3
  const [funnel, setFunnel] = useState<FunnelConfig>({ topo: 30, meio: 40, fundo: 30 });
  const [audiences, setAudiences] = useState<string[]>(['fas-marca', 'clientes-recentes']);
  const [emailGoal, setEmailGoal] = useState('relacionamento');
  const [whatsappGoal, setWhatsappGoal] = useState('lancamento');
  const [coupon, setCoupon] = useState('');

  useEffect(() => {
    setHolidays(getHolidaysForMonth(month, year));
  }, [month, year]);

  const config: PlanConfig = {
    month, year, channels, holidays, brandDates, avoidDays,
    products, productEvents, funnel, audiences, emailGoal, whatsappGoal, coupon,
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

    const parseJsonResponse = (text: string): any[] => {
      return safeParseJSON(text);
    };

    const callAI = async (prompt: string): Promise<string> => {
      return await callClaude(ANNA_SYSTEM_PROMPT, prompt);
    };

    // Instagram - using strict prompt
    const hasIG = enabledChannels.some(c => c.channel.startsWith('Instagram'));
    if (hasIG) {
      setProgress(15);
      try {
        const prompt = buildInstagramPrompt({
          month, year, holidays, products, productEvents, funnel, coupon,
        });
        const raw = await callAI(prompt);
        const parsed = parseJsonResponse(raw);

        // Validate generation count
        const expectedMinimum = daysInMonth * 1; // at least 1 per day (Stories)
        if (parsed.length < expectedMinimum) {
          console.warn(`Instagram: esperado mínimo ${expectedMinimum} itens, recebido ${parsed.length}`);
          toast.warning(`Atenção: foram gerados ${parsed.length} posts. Você pode regenerar conteúdos individuais na revisão.`);
        }

        parsed.forEach((p: any) => {
          const channelMap: Record<string, ContentItem['channel']> = {
            'instagram-feed': 'instagram-feed',
            'instagram-reels': 'instagram-reels',
            'instagram-stories': 'instagram-stories',
            'Instagram Feed': 'instagram-feed',
            'Instagram Reels': 'instagram-reels',
            'Instagram Stories': 'instagram-stories',
          };
          allItems.push({
            id: crypto.randomUUID(),
            date: p.date || `${year}-${String(month).padStart(2,'0')}-01`,
            channel: channelMap[p.channel] || 'instagram-feed',
            type: p.type || 'post',
            title: (p.theme || p.caption || '').substring(0, 60),
            caption: p.caption || '',
            hashtags: p.hashtags || [],
            cta: p.cta || '',
            suggestedTime: p.time || '11:00',
            status: 'rascunho',
            objective: 'engajamento',
            tone: 'inspiracional',
            audience: 'fas-marca',
            product: p.product || undefined,
            createdAt: new Date().toISOString(),
            funnelStage: p.funnel_stage,
            isLive: p.isLive || false,
          } as ContentItem & { funnelStage?: string; isLive?: boolean });
        });
      } catch (e) {
        console.error('IG generation failed:', e);
        toast.error('Falha ao gerar conteúdo para Instagram. Tente novamente.');
      }
    }

    // Email
    const hasEmail = enabledChannels.some(c => c.channel === 'E-mail');
    if (hasEmail) {
      setProgress(50);
      try {
        const emailFreq = enabledChannels.find(c => c.channel === 'E-mail')?.frequency || '1x/week';
        const prompt = `Crie ${emailFreq} e-mails para ${monthLabel}. Foco: ${emailGoal}. Produtos: ${activeProducts}. Datas âncora: ${importantDates || 'nenhuma'}. Cupom do mês: ${coupon || 'nenhum'}. Retorne SOMENTE JSON array: { "date": "YYYY-MM-DD", "channel": "email", "subject": "string", "preview_text": "string", "body": "string com corpo do email", "cta": "string", "audience": "string", "funnel_stage": "topo|meio|fundo", "time": "09:00"|"14:00" }. Gere TODOS os emails do mês.`;
        const raw = await callAI(prompt);
        const parsed = parseJsonResponse(raw);
        parsed.forEach((p: any) => {
          allItems.push({
            id: crypto.randomUUID(),
            date: p.date || `${year}-${String(month).padStart(2,'0')}-01`,
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
      } catch (e) {
        console.error('Email generation failed:', e);
        toast.error('Falha ao gerar e-mails. Tente novamente.');
      }
    }

    // WhatsApp
    const hasWpp = enabledChannels.some(c => c.channel === 'WhatsApp');
    if (hasWpp) {
      setProgress(75);
      try {
        const wppFreq = enabledChannels.find(c => c.channel === 'WhatsApp')?.frequency || '1x/week';
        const prompt = `Crie ${wppFreq} campanhas WhatsApp para ${monthLabel}. Foco: ${whatsappGoal}. Produtos: ${activeProducts}. Eventos: ${events || 'nenhum'}. Cupom: ${coupon || 'nenhum'}. Retorne SOMENTE JSON array: { "date": "YYYY-MM-DD", "channel": "whatsapp", "audience": "string", "message": "string com mensagem completa", "coupon": "string ou null", "time": "14:00"|"15:00"|"21:00", "funnel_stage": "topo|meio|fundo" }. Gere TODAS as campanhas do mês.`;
        const raw = await callAI(prompt);
        const parsed = parseJsonResponse(raw);
        parsed.forEach((p: any) => {
          allItems.push({
            id: crypto.randomUUID(),
            date: p.date || `${year}-${String(month).padStart(2,'0')}-01`,
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
            {generatedCount.instagram > 0 && <p>📷 {generatedCount.instagram} posts Instagram</p>}
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
