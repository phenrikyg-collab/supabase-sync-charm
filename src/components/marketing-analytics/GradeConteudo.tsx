import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertaConfianca, BlocoLoading, C, Card, ImgSafe, SANS, SectionTitle, SemDado, dataInicioISO, fmtInt, fmtNum } from './shared';

export interface ConteudoRow {
  media_id: string;
  data_publicacao: string;
  data_br: string;
  dia_semana: number | null;
  hora_br: number | null;
  formato: string;
  permalink: string | null;
  imagem: string | null;
  caption: string | null;
  tam_legenda: number | null;
  qtd_hashtags: number | null;
  pilar: string | null;
  angulo: string | null;
  persona: string | null;
  funcao_funil: string | null;
  tem_cta: boolean | null;
  tema: string | null;
  classificacao_confianca: string | null;
  reach: number | null;
  views: number | null;
  saves: number | null;
  shares: number | null;
  like_count: number | null;
  comments_count: number | null;
  skip_rate: number | null;
  avg_watch_time_ms: number | null;
  total_watch_time_ms: number | null;
  interacoes: number | null;
  taxa_engajamento: number | null;
  save_rate: number | null;
  share_rate: number | null;
  watch_medio_s: number | null;
  watch_total_h: number | null;
  retencao_inicial: number | null;
  quartil_alcance: number | null;
  percentil_alcance: number | null;
  quartil_skip: number | null;
}

export const FORMATOS_FEED = ['FEED', 'CAROUSEL_ALBUM', 'IMAGE'];

// Listas fixas de valores válidos da classificação — os seletores nunca devem
// esconder uma opção só porque ela não aparece no recorte atual.
export const PILARES_VALIDOS = ['Ângulos', 'Conceito', 'DSB', 'Full Funnel', 'UGC/Creator', 'Prova Social', 'Bastidores', 'Anúncio/Teaser'];
export const ANGULOS_VALIDOS = ['Econômico', 'Prático', 'Premium', 'Emocional'];
export const FUNCOES_VALIDAS: { value: string; label: string }[] = [
  { value: 'Alcance', label: 'Alcance' },
  { value: 'Relacionamento', label: 'Relacionamento' },
  { value: 'Conversao', label: 'Conversão' },
];
export const SEM_CLASSIFICACAO = '__sem_classificacao__';

export interface FiltroGrade {
  pilar?: string | null;
  angulo?: string | null;
  funcao?: string | null;
  chave?: number;
}

export function useConteudo(dias: number, formato: 'REELS' | 'FEED' | 'TODOS') {
  const [data, setData] = useState<ConteudoRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro('');
    const q = (supabase.from('vw_ig_conteudo' as any).select('*') as any)
      .gte('data_br', dataInicioISO(dias))
      .order('reach', { ascending: false });
    const filtrada =
      formato === 'REELS' ? q.eq('formato', 'REELS')
        : formato === 'FEED' ? q.in('formato', FORMATOS_FEED)
          : q;
    filtrada.then(({ data, error }: any) => {
      if (!ativo) return;
      if (error) setErro(error.message);
      setData((data as ConteudoRow[]) || []);
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [dias, formato]);

  return { data, loading, erro };
}

const ORDENACOES_BASE = [
  { value: 'reach', label: 'Alcance' },
  { value: 'views', label: 'Views' },
  { value: 'saves', label: 'Saves' },
  { value: 'shares', label: 'Shares' },
  { value: 'taxa_engajamento', label: 'Engajamento' },
];
const ORDENACOES_REELS = [
  { value: 'skip_asc', label: 'Skip rate (menor)' },
  { value: 'watch_medio_s', label: 'Watch time' },
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: C.tabBg, color: C.textSec }}>{children}</span>
  );
}

const contar = (posts: ConteudoRow[], campo: 'pilar' | 'angulo' | 'funcao_funil', valor: string) =>
  posts.filter(p => (valor === SEM_CLASSIFICACAO ? !p[campo] : p[campo] === valor)).length;

export function GradeConteudo({
  posts, loading, isReels, id = 'grade-conteudo', filtro, titulo = 'Grade de conteúdo', porFormato,
}: {
  posts: ConteudoRow[];
  loading: boolean;
  isReels: boolean;
  id?: string;
  filtro?: FiltroGrade;
  titulo?: string;
  /** Quando true, as métricas de vídeo aparecem só nos cards de Reels. */
  porFormato?: boolean;
}) {
  const [ordem, setOrdem] = useState('reach');
  const [pilar, setPilar] = useState('');
  const [angulo, setAngulo] = useState('');
  const [funcao, setFuncao] = useState('');
  const [soMelhores, setSoMelhores] = useState(false);

  // Filtro vindo de fora (cards clicáveis de "o que replicar / evitar")
  useEffect(() => {
    if (!filtro) return;
    setPilar(filtro.pilar ?? '');
    setAngulo(filtro.angulo ?? '');
    setFuncao(filtro.funcao ?? '');
  }, [filtro?.chave]);

  const lista = useMemo(() => {
    let l = posts.slice();
    if (pilar) l = l.filter(p => (pilar === SEM_CLASSIFICACAO ? !p.pilar : p.pilar === pilar));
    if (angulo) l = l.filter(p => (angulo === SEM_CLASSIFICACAO ? !p.angulo : p.angulo === angulo));
    if (funcao) l = l.filter(p => (funcao === SEM_CLASSIFICACAO ? !p.funcao_funil : p.funcao_funil === funcao));
    if (soMelhores) l = l.filter(p => p.quartil_alcance === 1);
    l.sort((a, b) => {
      if (ordem === 'skip_asc') return (a.skip_rate ?? 999) - (b.skip_rate ?? 999);
      const k = ordem as keyof ConteudoRow;
      return ((b[k] as number) ?? -1) - ((a[k] as number) ?? -1);
    });
    return l;
  }, [posts, ordem, pilar, angulo, funcao, soMelhores]);

  const opcoes = isReels ? [...ORDENACOES_BASE, ...ORDENACOES_REELS] : ORDENACOES_BASE;
  const selStyle = { border: `1px solid ${C.border}`, color: C.text, background: C.card, fontFamily: SANS } as const;

  const opcao = (campo: 'pilar' | 'angulo' | 'funcao_funil', value: string, label: string) => {
    const n = contar(posts, campo, value);
    return <option key={value} value={value} disabled={n === 0}>{label} ({n})</option>;
  };

  return (
    <Card accent={C.gold}>
      <div id={id} style={{ scrollMarginTop: 90 }} />
      <SectionTitle subtitle={`${lista.length} publicações no recorte atual`}>{titulo}</SectionTitle>

      <div className="flex flex-wrap gap-2 mb-5 text-sm">
        <select value={ordem} onChange={e => setOrdem(e.target.value)} className="px-3 py-1.5 rounded-lg" style={selStyle}>
          {opcoes.map(o => <option key={o.value} value={o.value}>Ordenar: {o.label}</option>)}
        </select>
        <select value={pilar} onChange={e => setPilar(e.target.value)} className="px-3 py-1.5 rounded-lg" style={selStyle}>
          <option value="">Todos os pilares</option>
          {PILARES_VALIDOS.map(p => opcao('pilar', p, p))}
          {opcao('pilar', SEM_CLASSIFICACAO, 'Sem classificação')}
        </select>
        <select value={angulo} onChange={e => setAngulo(e.target.value)} className="px-3 py-1.5 rounded-lg" style={selStyle}>
          <option value="">Todos os ângulos</option>
          {ANGULOS_VALIDOS.map(a => opcao('angulo', a, a))}
          {opcao('angulo', SEM_CLASSIFICACAO, 'Sem classificação')}
        </select>
        <select value={funcao} onChange={e => setFuncao(e.target.value)} className="px-3 py-1.5 rounded-lg" style={selStyle}>
          <option value="">Todas as funções</option>
          {FUNCOES_VALIDAS.map(f => opcao('funcao_funil', f.value, f.label))}
          {opcao('funcao_funil', SEM_CLASSIFICACAO, 'Sem classificação')}
        </select>
        <button
          onClick={() => setSoMelhores(v => !v)}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{
            background: soMelhores ? C.text : 'transparent',
            color: soMelhores ? C.gold : C.textSec,
            border: `1px solid ${soMelhores ? C.text : C.border}`,
            fontFamily: SANS,
          }}
        >
          Só os melhores (quartil 1)
        </button>
        {(pilar || angulo || funcao || soMelhores) && (
          <button
            onClick={() => { setPilar(''); setAngulo(''); setFuncao(''); setSoMelhores(false); }}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: 'transparent', color: C.textSec, border: `1px dashed ${C.border}`, fontFamily: SANS }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {loading ? (
        <BlocoLoading altura={220} />
      ) : lista.length === 0 ? (
        <SemDado />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map(p => {
            const reels = porFormato ? p.formato === 'REELS' : isReels;
            return (
              <a
                key={p.media_id}
                href={p.permalink || undefined}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg overflow-hidden block transition hover:shadow-md"
                style={{ border: `1px solid ${C.border}`, background: C.card }}
              >
                <div className="relative">
                  <ImgSafe src={p.imagem} alt={p.caption?.slice(0, 60)} className="w-full object-cover" style={{ height: 200 }} />
                  <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded font-semibold"
                    style={{ background: 'rgba(29,29,27,0.85)', color: C.gold }}>
                    {p.formato === 'REELS' ? 'Reels' : p.formato === 'CAROUSEL_ALBUM' ? 'Carrossel' : 'Feed'}
                  </span>
                  {p.quartil_alcance === 1 && (
                    <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: C.green, color: '#fff' }}>
                      Top 25%
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs line-clamp-2 flex-1" style={{ color: C.text }}>
                      {p.caption || 'Sem legenda'}
                    </p>
                    {p.classificacao_confianca === 'baixa' && <AlertaConfianca />}
                  </div>
                  <p className="text-[11px] mt-2" style={{ color: C.textSec }}>
                    {new Date(p.data_br + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                  <div className="grid grid-cols-3 gap-1 mt-2 text-[11px]" style={{ color: C.textSec }}>
                    <span>Alcance<br /><b style={{ color: C.text }}>{fmtInt(p.reach)}</b></span>
                    <span>Saves<br /><b style={{ color: C.text }}>{fmtInt(p.saves)}</b></span>
                    <span>Eng.<br /><b style={{ color: C.text }}>{fmtNum(p.taxa_engajamento, 2)}%</b></span>
                    {reels && <span>Skip<br /><b style={{ color: C.text }}>{fmtNum(p.skip_rate)}%</b></span>}
                    {reels && <span>Watch<br /><b style={{ color: C.text }}>{fmtNum(p.watch_medio_s)}s</b></span>}
                    {reels && (
                      <span title="Retenção inicial = 100 − skip rate. Percentual de quem não pulou nos primeiros segundos.">
                        Retenção inicial<br /><b style={{ color: C.text }}>{fmtNum(p.retencao_inicial)}%</b>
                      </span>
                    )}
                    {!reels && <span>Shares<br /><b style={{ color: C.text }}>{fmtInt(p.shares)}</b></span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {[p.funcao_funil, p.pilar, p.angulo].filter(Boolean).map((t, i) => <Chip key={i}>{t}</Chip>)}
                    {!p.funcao_funil && <Chip>sem função</Chip>}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </Card>
  );
}
