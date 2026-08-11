import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aviso, BlocoLoading, C, Card, SANS, SectionTitle, SemDado, fmtNum } from './shared';

export interface MetricaComparativa {
  nome: string;
  atual: number | null;
  anterior: number | null;
  unidade?: string;
  so_reels?: boolean;
  inverso?: boolean;
  referencia?: string;
  variacao_pct?: number | null;
  variacao_pp?: number | null;
}

interface Comparativo {
  aviso: string | null;
  formato?: string;
  periodo_dias: number;
  metricas: MetricaComparativa[];
}

function useComparativo(fn: string, args: Record<string, unknown>) {
  const [data, setData] = useState<Comparativo | null>(null);
  const [loading, setLoading] = useState(true);
  const chave = JSON.stringify(args);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    supabase.rpc(fn as any, JSON.parse(chave)).then(({ data }: any) => {
      if (!ativo) return;
      setData((data as Comparativo) || null);
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [fn, chave]);

  return { data, loading };
}

function formatarValor(m: MetricaComparativa) {
  if (m.atual === null || m.atual === undefined) return '—';
  const casas = m.unidade === '%' || m.unidade === 's' || m.unidade === 'h' ? (m.unidade === '%' ? 2 : 1) : (Number.isInteger(m.atual) ? 0 : 1);
  return `${fmtNum(m.atual, casas)}${m.unidade || ''}`;
}

function Variacao({ m }: { m: MetricaComparativa }) {
  const pp = m.variacao_pp !== null && m.variacao_pp !== undefined;
  const valor = pp ? m.variacao_pp : m.variacao_pct;
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) {
    return <span className="text-xs" style={{ color: C.grey }}>sem base de comparação</span>;
  }
  const v = Number(valor);
  const sobe = v >= 0;
  // Quando inverso, cair é bom: seta para baixo fica verde.
  const bom = m.inverso ? !sobe : sobe;
  const cor = v === 0 ? C.grey : bom ? C.green : C.red;
  return (
    <span className="text-xs font-semibold" style={{ color: cor }}>
      {sobe ? '▲' : '▼'} {Math.abs(v).toFixed(pp ? 2 : 1)}{pp ? ' p.p.' : '%'}
    </span>
  );
}

function Faixa({ data, loading, titulo, subtitulo, soReels }: {
  data: Comparativo | null; loading: boolean; titulo: string; subtitulo: string; soReels: boolean;
}) {
  const metricas = (data?.metricas || []).filter(m => (m.so_reels ? soReels : true));

  return (
    <Card accent={C.gold}>
      <SectionTitle subtitle={subtitulo}>{titulo}</SectionTitle>
      {loading ? <BlocoLoading altura={120} /> : metricas.length === 0 ? <SemDado /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {metricas.map(m => (
              <div key={m.nome} className="rounded-lg p-3" style={{ background: C.tabBg }}>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: C.textSec, fontFamily: SANS }}>{m.nome}</p>
                <p className="text-xl mt-1" style={{ color: C.text, fontFamily: SANS, fontWeight: 700 }}>{formatarValor(m)}</p>
                <div className="mt-1"><Variacao m={m} /></div>
                {m.referencia && <p className="text-[10px] mt-1" style={{ color: C.grey }}>{m.referencia}</p>}
              </div>
            ))}
          </div>
          {data?.aviso && <Aviso>{data.aviso}</Aviso>}
        </>
      )}
    </Card>
  );
}

export function ComparativoFormato({ dias, formato }: { dias: number; formato: 'REELS' | 'FEED' }) {
  const { data, loading } = useComparativo('fn_ig_comparativo_formato', { p_dias: dias, p_formato: formato });
  return (
    <Faixa
      data={data}
      loading={loading}
      soReels={formato === 'REELS'}
      titulo="Comparativo com o período anterior"
      subtitulo={`Últimos ${dias} dias contra os ${dias} dias imediatamente anteriores`}
    />
  );
}

export function ComparativoStories({ dias }: { dias: number }) {
  const { data, loading } = useComparativo('fn_ig_comparativo_stories', { p_dias: dias });
  return (
    <Faixa
      data={data}
      loading={loading}
      soReels={false}
      titulo="Comparativo com o período anterior"
      subtitulo={`Últimos ${dias} dias contra os ${dias} dias imediatamente anteriores`}
    />
  );
}
