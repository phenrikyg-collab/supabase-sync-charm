import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aviso, C, SANS, fmtInt } from './shared';

export interface PadraoResumo {
  dimensao: string;
  categoria: string;
  posts: number;
  indice: number | null;
  pct_volume: number | null;
  alcance_med: number | null;
  save_rate: number | null;
  skip_rate: number | null;
  watch_s: number | null;
}

export interface ResumoPerformance {
  aviso: string | null;
  formato: string | null;
  periodo_dias: number;
  posts_analisados: number;
  replicar: PadraoResumo[];
  evitar: PadraoResumo[];
  oportunidades: PadraoResumo[];
}

export function useResumoPerformance(formato: string | null, dias = 90) {
  const [data, setData] = useState<ResumoPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    const args: Record<string, unknown> = { p_dias: dias };
    if (formato) args.p_formato = formato;
    supabase.rpc('fn_ig_resumo_performance' as any, args).then(({ data }: any) => {
      if (!ativo) return;
      setData((data as ResumoPerformance) || null);
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [formato, dias]);

  return { resumo: data, loading };
}

const cita = (p: PadraoResumo) =>
  `${p.dimensao.toLowerCase()} "${p.categoria}" (índice ${p.indice?.toFixed(2) ?? '—'}, ${p.posts} posts, alcance médio ${fmtInt(p.alcance_med)})`;

const lista = (arr: PadraoResumo[], n = 3) => arr.slice(0, n).map(cita).join('; ');

export function AnaliseEscrita({ formato, dias = 90 }: { formato: string | null; dias?: number }) {
  const { resumo, loading } = useResumoPerformance(formato, dias);

  const texto = useMemo(() => {
    if (!resumo) return null;
    const rep = resumo.replicar || [];
    const evi = resumo.evitar || [];
    const opo = resumo.oportunidades || [];
    if (!rep.length && !evi.length && !opo.length) return null;

    const partes: string[] = [
      `Nos últimos ${resumo.periodo_dias} dias, ${resumo.posts_analisados} publicações${formato ? ` de ${formato === 'REELS' ? 'Reels' : 'feed'}` : ''} entraram na análise.`,
    ];
    if (rep.length) {
      partes.push(`O que está performando acima da média e merece repetição: ${lista(rep)}.`);
    }
    if (evi.length) {
      partes.push(`O que puxa a conta para baixo: ${lista(evi)} — vale reduzir volume ou refazer a abordagem.`);
    }
    if (opo.length) {
      partes.push(`Oportunidades subutilizadas, com índice alto mas pouco volume: ${lista(opo)} — aumentar a frequência aqui é o movimento de maior retorno.`);
    }
    return partes.join(' ');
  }, [resumo, formato]);

  if (loading) {
    return <p className="text-sm mt-4" style={{ color: C.grey, fontFamily: SANS }}>Analisando padrões…</p>;
  }
  if (!texto) return null;

  return (
    <div className="mt-5 p-4 rounded-lg" style={{ background: C.tabBg }}>
      <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: C.textSec, fontFamily: SANS }}>Leitura do período</p>
      <p className="text-sm leading-relaxed" style={{ color: C.text, fontFamily: SANS }}>{texto}</p>
      {resumo?.aviso && <Aviso>{resumo.aviso}</Aviso>}
    </div>
  );
}
