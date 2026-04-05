import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Sparkles, RefreshCw, Save, CalendarPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ContentItem, ContentChannel, ContentObjective, ContentTone, ContentAudience, CHANNEL_LABELS } from './types';
import { callClaude, ANNA_SYSTEM_PROMPT } from '@/lib/claudeApi';
import { toast } from 'sonner';

interface CriarConteudoProps {
  initialDate?: string;
  onSaveToLibrary: (item: ContentItem) => void;
  onSchedule: (item: ContentItem) => void;
}

const contentTypes: Record<string, string[]> = {
  'instagram-feed': ['Carrossel', 'Foto única', 'Collab'],
  'instagram-reels': ['Tutorial', 'Trend', 'Bastidores', 'Before/After'],
  'instagram-stories': ['Enquete', 'Caixinha', 'Countdown', 'Bastidores'],
  'email': ['Newsletter', 'Promoção', 'Lançamento', 'Reengajamento'],
  'whatsapp': ['Oferta flash', 'Novidade', 'Reativação', 'Cross-sell'],
};

const suggestedTimes: Record<string, string> = {
  'instagram-feed': '11:00',
  'instagram-reels': '20:00',
  'instagram-stories': '11:00',
  'email': '09:00',
  'whatsapp': '21:00',
};

export function CriarConteudo({ initialDate, onSaveToLibrary, onSchedule }: CriarConteudoProps) {
  const [date, setDate] = useState<Date | undefined>(initialDate ? new Date(initialDate + 'T12:00:00') : undefined);
  const [channel, setChannel] = useState<ContentChannel>('instagram-feed');
  const [tipo, setTipo] = useState('');
  const [tema, setTema] = useState('');
  const [produto, setProduto] = useState('');
  const [objetivo, setObjetivo] = useState<ContentObjective>('engajamento');
  const [tom, setTom] = useState<ContentTone>('inspiracional');
  const [publico, setPublico] = useState<ContentAudience>('fas-marca');

  // AI output
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [cta, setCta] = useState('');
  const [suggestedTime, setSuggestedTime] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async (regenerate = false) => {
    if (!tema.trim()) {
      toast.error('Preencha o tema/assunto');
      return;
    }
    setLoading(true);

    try {
      const userPrompt = `Canal: ${CHANNEL_LABELS[channel]}. Tipo: ${tipo || 'Geral'}. Tema: ${tema}. Produto: ${produto || 'nenhum específico'}. Objetivo: ${objetivo}. Tom: ${tom}. Público: ${publico}. Gere: caption completa, hashtags (15-20 para Instagram ou nenhuma para Email/WPP), CTA, horário sugerido. Para e-mail, gere também: assunto (máx 50 chars) e preview text (máx 90 chars).${regenerate ? ' Gere uma variação diferente da anterior.' : ''}

Retorne SOMENTE JSON válido:
{
  "caption": "...",
  "hashtags": ["..."],
  "cta": "...",
  "suggestedTime": "HH:MM",
  "subjectLine": "...",
  "previewText": "..."
}`;

      const raw = await callClaude(ANNA_SYSTEM_PROMPT, userPrompt);
      const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const result = JSON.parse(clean);
      setCaption(result.caption || '');
      setHashtags(result.hashtags || []);
      setCta(result.cta || '');
      setSuggestedTime(result.suggestedTime || suggestedTimes[channel]);
      setSubjectLine(result.subjectLine || '');
      setPreviewText(result.previewText || '');
      setGenerated(true);
    } catch (err: any) {
      console.error('AI generation error:', err);
      toast.error('Erro ao gerar conteúdo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const buildContentItem = (status: 'rascunho' | 'agendado'): ContentItem => ({
    id: crypto.randomUUID(),
    date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    channel,
    type: tipo,
    title: tema.substring(0, 60),
    caption,
    hashtags,
    cta,
    suggestedTime: suggestedTime || suggestedTimes[channel],
    status,
    objective: objetivo,
    tone: tom,
    audience: publico,
    product: produto,
    subjectLine,
    previewText,
    createdAt: new Date().toISOString(),
  });

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* LEFT - Form */}
      <div className="w-1/2 border-r p-6 overflow-y-auto" style={{ borderColor: 'rgba(232,205,126,0.15)' }}>
        <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
          ✍️ Criar Conteúdo
        </h2>

        <div className="space-y-4">
          {/* Date */}
          <div>
            <Label className="text-xs font-medium">Data de publicação</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal mt-1', !date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Channel */}
          <div>
            <Label className="text-xs font-medium">Canal</Label>
            <Select value={channel} onValueChange={(v) => { setChannel(v as ContentChannel); setTipo(''); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content type */}
          <div>
            <Label className="text-xs font-medium">Tipo de conteúdo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
              <SelectContent>
                {(contentTypes[channel] || []).map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Theme */}
          <div>
            <Label className="text-xs font-medium">Tema / Assunto</Label>
            <Input value={tema} onChange={e => setTema(e.target.value)} placeholder="Ex: Lançamento Calça Anna em linho" className="mt-1" />
          </div>

          {/* Product */}
          <div>
            <Label className="text-xs font-medium">Produto em destaque (opcional)</Label>
            <Input value={produto} onChange={e => setProduto(e.target.value)} placeholder="Ex: Calça Anna" className="mt-1" />
          </div>

          {/* Objective */}
          <div>
            <Label className="text-xs font-medium">Objetivo</Label>
            <Select value={objetivo} onValueChange={v => setObjetivo(v as ContentObjective)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="engajamento">Engajamento</SelectItem>
                <SelectItem value="conversao">Conversão</SelectItem>
                <SelectItem value="relacionamento">Relacionamento</SelectItem>
                <SelectItem value="lancamento">Lançamento</SelectItem>
                <SelectItem value="reativacao">Reativação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tone */}
          <div>
            <Label className="text-xs font-medium">Tom</Label>
            <Select value={tom} onValueChange={v => setTom(v as ContentTone)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inspiracional">Inspiracional</SelectItem>
                <SelectItem value="urgencia">Urgência</SelectItem>
                <SelectItem value="educativo">Educativo</SelectItem>
                <SelectItem value="emocional">Emocional</SelectItem>
                <SelectItem value="divertido">Divertido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Audience */}
          <div>
            <Label className="text-xs font-medium">Público-alvo</Label>
            <Select value={publico} onValueChange={v => setPublico(v as ContentAudience)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fas-marca">Fãs da marca</SelectItem>
                <SelectItem value="leads-frios">Leads frios</SelectItem>
                <SelectItem value="clientes-recentes">Clientes recentes</SelectItem>
                <SelectItem value="inativos-20dias">Inativos +20 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generate button */}
          <Button
            onClick={() => handleGenerate(false)}
            disabled={loading}
            className="w-full mt-4 text-white font-medium"
            style={{ backgroundColor: '#8B6914' }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Gerando...' : '✨ Gerar Conteúdo com IA'}
          </Button>
        </div>
      </div>

      {/* RIGHT - AI Output */}
      <div className="w-1/2 p-6 overflow-y-auto" style={{ backgroundColor: '#FAFAF8' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1D1D1B' }}>
          Resultado da IA
        </h3>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 rounded-full animate-pulse" style={{ backgroundColor: '#E8CD7E' }} />
            <p className="text-sm text-muted-foreground mt-4">Gerando conteúdo incrível...</p>
          </div>
        )}

        {!loading && !generated && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Sparkles className="h-12 w-12 mb-4" style={{ color: '#E8CD7E' }} />
            <p className="text-muted-foreground">Preencha os campos ao lado e clique em <strong>"Gerar Conteúdo com IA"</strong></p>
          </div>
        )}

        {!loading && generated && (
          <div className="space-y-5">
            {(channel === 'email') && subjectLine && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Assunto do E-mail</Label>
                <Input value={subjectLine} onChange={e => setSubjectLine(e.target.value)} className="mt-1" />
              </div>
            )}
            {(channel === 'email') && previewText && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Preview Text</Label>
                <Input value={previewText} onChange={e => setPreviewText(e.target.value)} className="mt-1" />
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-muted-foreground">Caption / Conteúdo</Label>
              <Textarea value={caption} onChange={e => setCaption(e.target.value)} className="mt-1 min-h-[200px]" />
            </div>

            {hashtags.length > 0 && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Hashtags</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {hashtags.map((h, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-full cursor-pointer hover:line-through" style={{ backgroundColor: 'rgba(232,205,126,0.2)', color: '#8B6914' }}>
                      #{h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-muted-foreground">CTA</Label>
              <Input value={cta} onChange={e => setCta(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground">Horário sugerido</Label>
              <Input value={suggestedTime} onChange={e => setSuggestedTime(e.target.value)} className="mt-1 w-24" />
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-4 border-t" style={{ borderColor: 'rgba(232,205,126,0.2)' }}>
              <Button variant="outline" size="sm" onClick={() => handleGenerate(true)} className="border-[#E8CD7E]/50 text-[#8B6914]">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerar
              </Button>
              <Button variant="outline" size="sm" onClick={() => { onSaveToLibrary(buildContentItem('rascunho')); toast.success('Salvo na biblioteca!'); }} className="border-[#E8CD7E]/50 text-[#8B6914]">
                <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar na Biblioteca
              </Button>
              <Button size="sm" onClick={() => { onSchedule(buildContentItem('agendado')); toast.success('Agendado no calendário!'); }} className="text-white" style={{ backgroundColor: '#8B6914' }}>
                <CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Agendar no Calendário
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
