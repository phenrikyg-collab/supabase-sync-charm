import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aviso, BlocoLoading, C, Card, SANS, SectionTitle, SemDado, fmtInt, fmtNum } from './shared';

interface ValorSeguidor {
  saldo: number | null;
  avisos: string[];
  seguidores: number | null;
  periodo_dias: number;
  novos_no_periodo: number | null;
  perdidos_no_periodo: number | null;
  custo_estimado_do_churn: number | null;
  valor_de_um_novo_seguidor: number | null;
  valor_por_seguidor: {
    real: number | null;
    posicao: string | null;
    benchmark_min: number | null;
    benchmark_max: number | null;
  } | null;
  potencial_mensal: {
    conservador: number | null;
    medio: number | null;
    otimista: number | null;
    gap_ate_faixa_minima: number | null;
  } | null;
  receita: {
    fonte_da_atribuicao: string | null;
    receita_atribuida_social: number | null;
    receita_bruta_total: number | null;
    share_pct: number | null;
    ticket_medio: number | null;
    total_pedidos: number | null;
    mes_referencia: string | null;
    mes_fechado?: boolean;
    mes_parcial?: boolean;
    dias_decorridos_no_mes?: number | null;
  } | null;
}

const brl = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: d, maximumFractionDigits: d });

export function CalculadoraValorSeguidor({ dias }: { dias: number }) {
  const [receitaInput, setReceitaInput] = useState('');
  const [receitaAplicada, setReceitaAplicada] = useState<number | null>(null);
  const [mesFechado, setMesFechado] = useState(true);
  const [data, setData] = useState<ValorSeguidor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    const args: Record<string, unknown> = { p_dias: dias, p_usar_mes_fechado: mesFechado };
    if (receitaAplicada !== null) args.p_receita_social = receitaAplicada;
    supabase.rpc('fn_ig_valor_seguidor' as any, args).then(({ data }: any) => {
      if (!ativo) return;
      setData((data as ValorSeguidor) || null);
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [dias, receitaAplicada, mesFechado]);


  const posicao = data?.valor_por_seguidor?.posicao;
  const corPosicao = posicao === 'abaixo' ? C.red : posicao === 'acima' ? C.green : C.yellow;

  const aplicar = () => {
    const n = Number(receitaInput.replace(/\./g, '').replace(',', '.'));
    setReceitaAplicada(Number.isFinite(n) && n > 0 ? n : null);
  };

  const cards = useMemo(() => ([
    { label: 'Valor por seguidor', valor: brl(data?.valor_por_seguidor?.real), sub: data?.valor_por_seguidor ? `benchmark ${brl(data.valor_por_seguidor.benchmark_min)} a ${brl(data.valor_por_seguidor.benchmark_max)}` : undefined, cor: corPosicao },
    { label: 'Seguidores', valor: fmtInt(data?.seguidores), sub: `saldo ${fmtInt(data?.saldo)} no período`, cor: C.bronze },
    { label: 'Novos no período', valor: fmtInt(data?.novos_no_periodo), sub: `perdidos ${fmtInt(data?.perdidos_no_periodo)}`, cor: C.gold },
    { label: 'Custo estimado do churn', valor: brl(data?.custo_estimado_do_churn), sub: 'receita deixada na mesa', cor: C.red },
    { label: 'Potencial mensal (médio)', valor: brl(data?.potencial_mensal?.medio, 0), sub: `conservador ${brl(data?.potencial_mensal?.conservador, 0)} · otimista ${brl(data?.potencial_mensal?.otimista, 0)}`, cor: C.blue },
    { label: 'Gap até a faixa mínima', valor: brl(data?.potencial_mensal?.gap_ate_faixa_minima, 0), sub: 'para chegar em R$ 0,50 por seguidor', cor: C.bronze },
  ]), [data, corPosicao]);

  return (
    <Card accent={C.green}>
      <SectionTitle subtitle="Quanto cada seguidor vale em receita. Deixe o campo vazio para a estimativa automática do banco.">
        Calculadora de valor do seguidor
      </SectionTitle>

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: C.textSec, fontFamily: SANS }}>
            Receita atribuída ao social (opcional)
          </label>
          <input
            value={receitaInput}
            onChange={e => setReceitaInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') aplicar(); }}
            placeholder="ex.: 25.000,00"
            inputMode="decimal"
            className="px-3 py-2 rounded-lg text-sm w-56 outline-none"
            style={{ border: `1px solid ${C.border}`, color: C.text, background: C.card, fontFamily: SANS }}
          />
        </div>
        <button
          onClick={aplicar}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: C.text, color: C.gold, fontFamily: SANS }}
        >
          Recalcular
        </button>
        {receitaAplicada !== null && (
          <button
            onClick={() => { setReceitaInput(''); setReceitaAplicada(null); }}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ border: `1px solid ${C.border}`, color: C.textSec, fontFamily: SANS }}
          >
            Voltar para a estimativa automática
          </button>
        )}
        <label className="flex items-center gap-2 text-xs" style={{ color: C.textSec, fontFamily: SANS }}>
          <input type="checkbox" checked={mesFechado} onChange={e => setMesFechado(e.target.checked)} />
          Usar último mês fechado
        </label>
      </div>

      {loading ? <BlocoLoading altura={200} /> : !data ? <SemDado /> : (
        <>
          <div className="p-4 rounded-lg mb-4" style={{ background: C.tabBg }}>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: C.textSec, fontFamily: SANS }}>Receita considerada</p>
            <p className="text-2xl mt-1" style={{ color: C.text, fontFamily: SANS, fontWeight: 700 }}>
              {brl(data.receita?.receita_atribuida_social, 0)}
            </p>
            <p className="text-xs mt-1" style={{ color: C.textSec }}>
              {data.receita?.fonte_da_atribuicao || 'fonte não informada'}
            </p>
            {data.receita?.mes_referencia && (
              <p className="text-xs mt-1" style={{ color: C.grey }}>
                mês {data.receita.mes_referencia} · {fmtInt(data.receita.total_pedidos)} pedidos · ticket médio {brl(data.receita.ticket_medio)}
                {data.receita.share_pct != null && ` · share de sessões ${fmtNum(data.receita.share_pct)}%`}
              </p>
            )}
            <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded"
              style={{ background: data.receita?.mes_parcial ? '#FBEAE5' : '#E8F5EE', color: data.receita?.mes_parcial ? C.red : C.green, fontFamily: SANS }}>
              {data.receita?.mes_parcial
                ? `mês parcial${data.receita?.dias_decorridos_no_mes ? ` · ${data.receita.dias_decorridos_no_mes} dias decorridos` : ''}`
                : 'mês fechado'}
            </span>
          </div>

          {data.valor_por_seguidor?.real != null && (
            <div className="p-4 rounded-lg mb-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wider" style={{ color: C.textSec, fontFamily: SANS }}>Onde a conta está na régua</p>
                <p className="text-sm font-semibold" style={{ color: corPosicao, fontFamily: SANS }}>
                  {brl(data.valor_por_seguidor.real)} por seguidor · {posicao === 'abaixo' ? 'abaixo do benchmark' : posicao === 'acima' ? 'acima do benchmark' : 'dentro do benchmark'}
                </p>
              </div>
              <div className="relative h-3 rounded-full" style={{ background: `linear-gradient(90deg, ${C.red} 0%, ${C.yellow} 25%, ${C.green} 100%)` }}>
                <div
                  className="absolute -top-1 w-1.5 h-5 rounded"
                  style={{
                    left: `${Math.min(100, Math.max(0, ((data.valor_por_seguidor.real || 0) / (data.valor_por_seguidor.benchmark_max || 2)) * 100))}%`,
                    background: C.text,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] mt-1.5" style={{ color: C.grey, fontFamily: SANS }}>
                <span>R$ 0,00</span>
                <span>mínimo {brl(data.valor_por_seguidor.benchmark_min)}</span>
                <span>{brl(data.valor_por_seguidor.benchmark_max)}</span>
              </div>
            </div>
          )}


          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map(c => (
              <div key={c.label} className="rounded-lg p-4" style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${c.cor}` }}>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: C.textSec, fontFamily: SANS }}>{c.label}</p>
                <p className="text-xl mt-1" style={{ color: C.text, fontFamily: SANS, fontWeight: 700 }}>{c.valor}</p>
                {c.sub && <p className="text-xs mt-1" style={{ color: C.textSec }}>{c.sub}</p>}
              </div>
            ))}
          </div>

          {data.avisos?.length > 0 && (
            <div className="mt-4 space-y-1">
              {data.avisos.map((a, i) => <Aviso key={i}>{a}</Aviso>)}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
