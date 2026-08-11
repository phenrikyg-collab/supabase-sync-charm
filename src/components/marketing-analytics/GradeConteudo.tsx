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

export function useConteudo(dias: number, formato: 'REELS' | 'FEED') {
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
    const filtrada = formato === 'REELS' ? q.eq('formato', 'REELS') : q.in('formato', FORMATOS_FEED);
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

export function GradeConteudo({ posts, loading, isReels }: { posts: ConteudoRow[]; loading: boolean; isReels: boolean }) {
  const [ordem, setOrdem] = useState('reach');
  const [pilar, setPilar] = useState('');
  const [angulo, setAngulo] = useState('');
  const [soMelhores, setSoMelhores] = useState(false);

  const pilares = useMemo(() => Array.from(new Set(posts.map(p => p.pilar).filter(Boolean))) as string[], [posts]);
  const angulos = useMemo(() => Array.from(new Set(posts.map(p => p.angulo).filter(Boolean))) as string[], [posts]);

  const lista = useMemo(() => {
    let l = posts.slice();
    if (pilar) l = l.filter(p => p.pilar === pilar);
    if (angulo) l = l.filter(p => p.angulo === angulo);
    if (soMelhores) l = l.filter(p => p.quartil_alcance === 1);
    l.sort((a, b) => {
      if (ordem === 'skip_asc') return (a.skip_rate ?? 999) - (b.skip_rate ?? 999);
      const k = ordem as keyof ConteudoRow;
      return ((b[k] as number) ?? -1) - ((a[k] as number) ?? -1);
    });
    return l;
  }, [posts, ordem, pilar, angulo, soMelhores]);

  const opcoes = isReels ? [...ORDENACOES_BASE, ...ORDENACOES_REELS] : ORDENACOES_BASE;
  const selStyle = { border: `1px solid ${C.border}`, color: C.text, background: C.card, fontFamily: SANS } as const;

  return (
    <Card accent={C.gold}>
      <SectionTitle subtitle={`${lista.length} publicações no período`}>Grade de conteúdo</SectionTitle>

      <div className="flex flex-wrap gap-2 mb-5 text-sm">
        <select value={ordem} onChange={e => setOrdem(e.target.value)} className="px-3 py-1.5 rounded-lg" style={selStyle}>
          {opcoes.map(o => <option key={o.value} value={o.value}>Ordenar: {o.label}</option>)}
        </select>
        <select value={pilar} onChange={e => setPilar(e.target.value)} className="px-3 py-1.5 rounded-lg" style={selStyle}>
          <option value="">Todos os pilares</option>
          {pilares.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={angulo} onChange={e => setAngulo(e.target.value)} className="px-3 py-1.5 rounded-lg" style={selStyle}>
          <option value="">Todos os ângulos</option>
          {angulos.map(a => <option key={a} value={a}>{a}</option>)}
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
      </div>

      {loading ? (
        <BlocoLoading altura={220} />
      ) : lista.length === 0 ? (
        <SemDado />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map(p => (
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
                  {p.formato === 'REELS' ? 'Reels' : 'Feed'}
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
                  {isReels && <span>Skip<br /><b style={{ color: C.text }}>{fmtNum(p.skip_rate)}%</b></span>}
                  {isReels && <span>Watch<br /><b style={{ color: C.text }}>{fmtNum(p.watch_medio_s)}s</b></span>}
                  {!isReels && <span>Shares<br /><b style={{ color: C.text }}>{fmtInt(p.shares)}</b></span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {[p.pilar, p.angulo].filter(Boolean).map((t, i) => <Chip key={i}>{t}</Chip>)}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
