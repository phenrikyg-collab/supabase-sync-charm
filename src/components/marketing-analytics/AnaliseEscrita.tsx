import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aviso, C, SANS, fmtInt, fmtNum } from './shared';

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

const frase = (p: PadraoResumo, comVolume = false) => {
  const base = `${p.dimensao} · ${p.categoria}: índice ${p.indice === null ? '—' : fmtNum(p.indice, 2)} em ${p.posts} publicações, alcance médio de ${fmtInt(p.alcance_med)}`;
  const extra = comVolume && p.pct_volume !== null ? ` — ocupa ${fmtNum(p.pct_volume)}% do volume publicado` : '';
  return base + extra + '.';
};

function BlocoLista({ titulo, cor, itens, comVolume, vazio }: {
  titulo: string; cor: string; itens: PadraoResumo[]; comVolume?: boolean; vazio: string;
}) {
  return (
    <div className="p-4 rounded-lg" style={{ background: C.tabBg, borderLeft: `3px solid ${cor}` }}>
      <p className="text-sm font-semibold mb-2" style={{ color: C.text, fontFamily: SANS }}>{titulo}</p>
      {!itens.length ? (
        <p className="text-xs" style={{ color: C.grey, fontFamily: SANS }}>{vazio}</p>
      ) : (
        <ul className="space-y-1.5">
          {itens.map((p, i) => (
            <li key={`${p.dimensao}-${p.categoria}-${i}`} className="text-sm leading-relaxed" style={{ color: C.text, fontFamily: SANS }}>
              {frase(p, comVolume)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnaliseEscrita({ formato, dias = 90 }: { formato: string | null; dias?: number }) {
  const { resumo, loading } = useResumoPerformance(formato, dias);

  if (loading) {
    return <p className="text-sm mb-4" style={{ color: C.grey, fontFamily: SANS }}>Analisando padrões…</p>;
  }
  if (!resumo) return null;

  const rep = resumo.replicar || [];
  const evi = resumo.evitar || [];
  const opo = resumo.oportunidades || [];

  return (
    <div className="mb-5 space-y-3">
      {resumo.aviso && <Aviso>{resumo.aviso}</Aviso>}
      <p className="text-sm" style={{ color: C.textSec, fontFamily: SANS }}>
        Nos últimos {resumo.periodo_dias} dias, {resumo.posts_analisados} publicações
        {formato ? ` de ${formato === 'REELS' ? 'Reels' : 'feed'}` : ''} entraram na análise.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BlocoLista titulo="✅ O que replicar" cor={C.green} itens={rep} vazio="Nenhum padrão passou do corte de relevância no período." />
        <BlocoLista titulo="⛔ O que evitar" cor={C.red} itens={evi} comVolume vazio="Nenhum padrão ficou abaixo do corte no período." />
      </div>

      <div className="p-4 rounded-lg" style={{ background: '#FFFBEF', borderLeft: `3px solid ${C.gold}` }}>
        <p className="text-sm font-semibold mb-1" style={{ color: C.text, fontFamily: SANS }}>⭐ Oportunidades subutilizadas</p>
        <p className="text-xs mb-2" style={{ color: C.textSec, fontFamily: SANS }}>
          Índice alto com pouco volume — funciona e está sendo pouco usado. É a ação de maior retorno.
        </p>
        {!opo.length ? (
          <p className="text-xs" style={{ color: C.grey, fontFamily: SANS }}>Nenhuma oportunidade subutilizada identificada.</p>
        ) : (
          <ul className="space-y-1.5">
            {opo.map((p, i) => (
              <li key={`${p.dimensao}-${p.categoria}-${i}`} className="text-sm leading-relaxed" style={{ color: C.text, fontFamily: SANS }}>
                {frase(p, true)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
