import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aviso, C, SANS, SERIF } from './shared';

export interface PadraoResumo {
  dimensao: string;
  categoria: string;
  titulo?: string | null;
  frase?: string | null;
  impacto?: string | null;
  impacto_pct?: number | null;
  confianca?: 'alta' | 'media' | 'baixa' | string | null;
  posts: number;
  indice: number | null;
  pct_volume: number | null;
  pct_volume_txt?: string | null;
  alcance_med: number | null;
  alcance_txt?: string | null;
}

export interface AlertaLeitura {
  titulo: string;
  texto: string;
}

export interface ResumoPerformance {
  aviso: string | null;
  resumo: string | null;
  formato: string | null;
  periodo_dias: number;
  posts_analisados: number;
  alcance_medio_txt?: string | null;
  replicar: PadraoResumo[];
  evitar: PadraoResumo[];
  oportunidades: PadraoResumo[];
  alertas_de_leitura?: AlertaLeitura[];
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

const CONF_META: Record<string, { label: string; cor: string; opacidade: number }> = {
  alta: { label: 'confiança alta', cor: C.green, opacidade: 1 },
  media: { label: 'confiança média', cor: C.yellow, opacidade: 1 },
  baixa: { label: 'confiança baixa', cor: C.grey, opacidade: 0.6 },
};

function Confianca({ valor }: { valor?: string | null }) {
  if (!valor) return null;
  const m = CONF_META[valor] ?? CONF_META.baixa;
  return (
    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: C.grey, fontFamily: SANS }}>
      <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: m.cor }} />
      {m.label}
    </span>
  );
}

function CardPadrao({ p, cor }: { p: PadraoResumo; cor: string }) {
  const conf = CONF_META[p.confianca || ''] ?? CONF_META.baixa;
  return (
    <div
      className="rounded-lg p-3.5"
      style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${cor}`, background: C.card, opacity: conf.opacidade }}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <p className="text-[15px] font-semibold leading-snug" style={{ color: C.text, fontFamily: SANS }}>
          {p.titulo || `${p.dimensao} · ${p.categoria}`}
        </p>
        {p.impacto && (
          <span
            className="text-[11px] px-2 py-0.5 rounded font-semibold whitespace-nowrap"
            style={{ background: cor === C.green ? '#E8F5EE' : '#FBEAE5', color: cor }}
          >
            {p.impacto}
          </span>
        )}
      </div>
      <p className="text-[13px] leading-relaxed" style={{ color: C.textSec, fontFamily: SANS }}>
        {p.frase}
      </p>
      <div className="flex items-center gap-3 mt-2">
        <Confianca valor={p.confianca} />
        <span className="text-[11px]" style={{ color: C.grey, fontFamily: SANS }}>
          {p.posts} posts{p.pct_volume_txt ? ` · ${p.pct_volume_txt}% do volume` : ''}
        </span>
      </div>
    </div>
  );
}

function Coluna({ titulo, cor, itens, vazio }: { titulo: string; cor: string; itens: PadraoResumo[]; vazio: string }) {
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-semibold" style={{ color: C.text, fontFamily: SANS }}>{titulo}</p>
      {!itens.length
        ? <p className="text-xs" style={{ color: C.grey, fontFamily: SANS }}>{vazio}</p>
        : itens.map((p, i) => <CardPadrao key={`${p.dimensao}-${p.categoria}-${i}`} p={p} cor={cor} />)}
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
  const alertas = resumo.alertas_de_leitura || [];

  return (
    <div className="space-y-5">
      {resumo.aviso && <Aviso>{resumo.aviso}</Aviso>}

      {resumo.resumo && (
        <div className="p-5 rounded-lg" style={{ background: C.tabBg }}>
          <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: C.textSec, fontFamily: SANS }}>
            Resumo do período · {resumo.periodo_dias} dias · {resumo.posts_analisados} publicações
          </p>
          <p className="text-lg md:text-xl leading-relaxed" style={{ color: C.text, fontFamily: SERIF, fontWeight: 500 }}>
            {resumo.resumo}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Coluna titulo="✅ O que replicar" cor={C.green} itens={rep} vazio="Nenhum padrão passou do corte de relevância no período." />
        <Coluna titulo="⛔ O que evitar" cor={C.red} itens={evi} vazio="Nenhum padrão ficou abaixo do corte no período." />
      </div>

      <div className="p-4 rounded-lg" style={{ background: '#FFFBEF', borderLeft: `3px solid ${C.gold}` }}>
        <p className="text-sm font-semibold mb-1" style={{ color: C.text, fontFamily: SANS }}>⭐ Oportunidades subutilizadas</p>
        <p className="text-xs mb-3" style={{ color: C.textSec, fontFamily: SANS }}>
          Índice alto com pouco volume — funciona e está sendo pouco usado. É a ação de maior retorno.
        </p>
        {!opo.length ? (
          <p className="text-xs" style={{ color: C.grey, fontFamily: SANS }}>Nenhuma oportunidade subutilizada identificada.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {opo.map((p, i) => <CardPadrao key={`${p.dimensao}-${p.categoria}-${i}`} p={p} cor={C.gold} />)}
          </div>
        )}
      </div>

      {alertas.length > 0 && (
        <div className="p-4 rounded-lg space-y-3" style={{ background: C.tabBg, borderLeft: `3px solid ${C.blue}` }}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: C.textSec, fontFamily: SANS }}>Alertas de leitura</p>
          {alertas.map((a, i) => (
            <div key={i}>
              <p className="text-sm font-semibold" style={{ color: C.text, fontFamily: SANS }}>{a.titulo}</p>
              <p className="text-[13px] leading-relaxed mt-0.5" style={{ color: C.textSec, fontFamily: SANS }}>{a.texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
