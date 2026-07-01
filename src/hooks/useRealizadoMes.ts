import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PilarKey =
  | "receita_captada"
  | "receita_faturada"
  | "sessoes_totais"
  | "sessoes_organicas"
  | "sessoes_midia"
  | "taxa_conversao"
  | "taxa_aprovacao"
  | "taxa_aquisicao"
  | "pedidos_captados"
  | "investimento_total"
  | "adcost_pct"
  | "cpc_medio"
  | "cac_novos"
  | "roas_faturado";

export type PilarStatus = "verde" | "amarelo" | "vermelho" | "neutro";

export interface RealizadoMes {
  meta: Partial<Record<PilarKey, number | null>>;
  realizado: Partial<Record<PilarKey, number | null>>;
  projecao: Partial<Record<PilarKey, number | null>>;
  statusPorPilar: Record<PilarKey, PilarStatus>;
  ritmoMes: {
    diasDecorridos: number;
    diasTotais: number;
    pctDecorrido: number;
    pctReceita: number | null;
    pctSessoes: number | null;
  };
  canaisAtual: { grupo: string; sessoes: number; participacao: number }[];
  canaisHistoricos: Record<string, number>; // participação média
  campanhasBaixoRoas: { campaign: string; spend: number; roas: number }[];
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
}

// Substring match para separar mídia paga de orgânico/direto no windsor_canais
const isPaidChannelGroup = (g: string | null | undefined) => {
  if (!g) return false;
  const s = String(g).toLowerCase();
  return (
    s.includes("paid") ||
    s.includes("display") ||
    s.includes("video") ||
    s.includes("cross-network") ||
    s.includes("cross network") ||
    s.includes("shopping")
  );
};

const num = (v: any) => (typeof v === "number" ? v : Number(v) || 0);

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function fetchAll<T = any>(
  table: string,
  select: string,
  filters: (q: any) => any,
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  while (true) {
    let q: any = (supabase.from(table as any) as any).select(select);
    q = filters(q).range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function statusVolume(atual: number | null, meta: number | null, pctDecorrido: number): PilarStatus {
  if (atual == null || meta == null || meta === 0) return "neutro";
  const pctAtingido = atual / meta;
  if (pctAtingido >= pctDecorrido) return "verde";
  if (pctAtingido >= pctDecorrido * 0.85) return "amarelo";
  return "vermelho";
}
function statusMaiorEhMelhor(atual: number | null, meta: number | null): PilarStatus {
  if (atual == null || meta == null || meta === 0) return "neutro";
  if (atual >= meta) return "verde";
  if (atual >= meta * 0.9) return "amarelo";
  return "vermelho";
}
function statusMenorEhMelhor(atual: number | null, meta: number | null, tol = 0.1): PilarStatus {
  if (atual == null || meta == null || meta === 0) return "neutro";
  if (atual <= meta) return "verde";
  if (atual <= meta * (1 + tol)) return "amarelo";
  return "vermelho";
}

export function useRealizadoMes(ano: number, mes: number): RealizadoMes {
  const [meta, setMeta] = useState<Partial<Record<PilarKey, number | null>>>({});
  const [realizado, setRealizado] = useState<Partial<Record<PilarKey, number | null>>>({});
  const [canaisAtual, setCanaisAtual] = useState<{ grupo: string; sessoes: number; participacao: number }[]>([]);
  const [canaisHistoricos, setCanaisHistoricos] = useState<Record<string, number>>({});
  const [campanhasBaixoRoas, setCampanhasBaixoRoas] = useState<{ campaign: string; spend: number; roas: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const range = useMemo(() => {
    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0);
    const hoje = new Date();
    const ateHoje = hoje < fimMes && hoje >= inicioMes ? hoje : fimMes;
    const diasTotais = fimMes.getDate();
    const diasDecorridos = Math.max(
      1,
      Math.min(
        diasTotais,
        Math.floor((ateHoje.getTime() - inicioMes.getTime()) / 86400000) + 1,
      ),
    );
    // histórico: últimos 3 meses cheios anteriores
    const iniHist = new Date(ano, mes - 4, 1);
    const fimHist = new Date(ano, mes - 1, 0);
    return {
      inicio: ymd(inicioMes),
      fimAte: ymd(ateHoje),
      fimMes: ymd(fimMes),
      diasTotais,
      diasDecorridos,
      iniHist: ymd(iniHist),
      fimHist: ymd(fimHist),
    };
  }, [ano, mes]);

  const load = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [canaisRows, metaAdsRows, movRows, planejadoRow, canaisHistRows] = await Promise.all([
        fetchAll<any>(
          "windsor_canais",
          "date, session_custom_channel_group, sessions, purchase_revenue, items_purchased",
          (q) => q.gte("date", range.inicio).lte("date", range.fimAte),
        ),
        fetchAll<any>(
          "windsor_meta_ads",
          "date, campaign, spend, clicks, cpc, purchase_roas",
          (q) => q.gte("date", range.inicio).lte("date", range.fimAte),
        ),
        fetchAll<any>(
          "movimentacoes_financeiras",
          "id, tipo, valor, data, origem, status_pagamento, cliente",
          (q) =>
            q
              .gte("data", range.inicio)
              .lte("data", range.fimAte)
              .eq("tipo", "entrada"),
        ),
        (supabase as any)
          .from("planejamento_mensal")
          .select("*")
          .eq("ano", ano)
          .eq("mes", mes)
          .eq("tipo", "planejado")
          .maybeSingle()
          .then((r: any) => r.data),
        fetchAll<any>(
          "windsor_canais",
          "date, session_custom_channel_group, sessions",
          (q) => q.gte("date", range.iniHist).lte("date", range.fimHist),
        ),
      ]);

      // ===== Sessões =====
      let sessoesTotais = 0;
      let sessoesMidia = 0;
      const canaisAgg = new Map<string, number>();
      for (const r of canaisRows) {
        const s = num(r.sessions);
        sessoesTotais += s;
        if (isPaidChannelGroup(r.session_custom_channel_group)) sessoesMidia += s;
        const g = r.session_custom_channel_group || "—";
        canaisAgg.set(g, (canaisAgg.get(g) || 0) + s);
      }
      const sessoesOrganicas = Math.max(sessoesTotais - sessoesMidia, 0);
      const canaisArr = [...canaisAgg.entries()]
        .map(([grupo, sessoes]) => ({
          grupo,
          sessoes,
          participacao: sessoesTotais > 0 ? (sessoes / sessoesTotais) * 100 : 0,
        }))
        .sort((a, b) => b.sessoes - a.sessoes);
      setCanaisAtual(canaisArr);

      // ===== Meta Ads =====
      let spend = 0;
      let clicks = 0;
      let spendRoas = 0;
      const campanhas = new Map<string, { spend: number; spendRoas: number }>();
      for (const r of metaAdsRows) {
        const sp = num(r.spend);
        const cl = num(r.clicks);
        const ro = num(r.purchase_roas);
        spend += sp;
        clicks += cl;
        spendRoas += sp * ro;
        const key = r.campaign || "—";
        const cur = campanhas.get(key) || { spend: 0, spendRoas: 0 };
        cur.spend += sp;
        cur.spendRoas += sp * ro;
        campanhas.set(key, cur);
      }
      const cpcMedio = clicks > 0 ? spend / clicks : 0;
      const roasFaturado = spend > 0 ? spendRoas / spend : 0;
      const receitaAtribuida = spendRoas; // spend × roas = receita
      setCampanhasBaixoRoas(
        [...campanhas.entries()]
          .map(([campaign, v]) => ({
            campaign,
            spend: v.spend,
            roas: v.spend > 0 ? v.spendRoas / v.spend : 0,
          }))
          .filter((c) => c.spend > 50 && c.roas < 2)
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 3),
      );

      // ===== Vendas (movimentacoes_financeiras) =====
      // Assumindo: origem ∈ {vindi, bling} = pedidos captados; status_pagamento='pago' = aprovado
      const vendas = movRows.filter((r) => {
        const o = String(r.origem || "").toLowerCase();
        return o === "vindi" || o === "bling" || o === "manual_vendas";
      });
      const receitaCaptada = vendas.reduce((s, r) => s + Math.abs(num(r.valor)), 0);
      const pedidosCaptados = vendas.length;
      const aprovados = vendas.filter((r) => String(r.status_pagamento || "").toLowerCase() === "pago");
      const receitaFaturada = aprovados.reduce((s, r) => s + Math.abs(num(r.valor)), 0);
      const taxaAprovacao = pedidosCaptados > 0 ? (aprovados.length / pedidosCaptados) * 100 : null;
      // Taxa de aquisição: novos vs recorrentes por cliente único no mês (aproximação)
      const clientesVistos = new Set<string>();
      for (const r of vendas) if (r.cliente) clientesVistos.add(r.cliente);
      // Aproximação: taxa_aquisicao vem da meta se não conseguimos calcular
      let taxaAquisicao: number | null = null;
      if (aprovados.length > 0) {
        // Cliente é "novo" se é a primeira vez que aparece no histórico
        const historicoClientes = await fetchAll<any>(
          "movimentacoes_financeiras",
          "cliente, data",
          (q) =>
            q
              .lt("data", range.inicio)
              .eq("tipo", "entrada")
              .not("cliente", "is", null),
        ).catch(() => []);
        const antigos = new Set(historicoClientes.map((r: any) => r.cliente));
        const novosPed = aprovados.filter((r) => r.cliente && !antigos.has(r.cliente)).length;
        taxaAquisicao = (novosPed / aprovados.length) * 100;
      }

      const taxaConversao = sessoesTotais > 0 ? (pedidosCaptados / sessoesTotais) * 100 : null;
      const pedidosAquisicao = taxaAquisicao != null
        ? Math.round((aprovados.length * taxaAquisicao) / 100)
        : null;
      const cacNovos = pedidosAquisicao && pedidosAquisicao > 0 ? spend / pedidosAquisicao : null;
      const adcostPct = receitaFaturada > 0 ? (spend / receitaFaturada) * 100 : null;

      setRealizado({
        receita_captada: receitaCaptada,
        receita_faturada: receitaFaturada,
        sessoes_totais: sessoesTotais,
        sessoes_organicas: sessoesOrganicas,
        sessoes_midia: sessoesMidia,
        taxa_conversao: taxaConversao,
        taxa_aprovacao: taxaAprovacao,
        taxa_aquisicao: taxaAquisicao,
        pedidos_captados: pedidosCaptados,
        investimento_total: spend,
        adcost_pct: adcostPct,
        cpc_medio: cpcMedio,
        cac_novos: cacNovos,
        roas_faturado: roasFaturado,
      });

      const p = planejadoRow || {};
      setMeta({
        receita_captada: p.receita_captada ?? null,
        receita_faturada: p.receita_faturada ?? null,
        sessoes_totais: p.sessoes_totais ?? null,
        sessoes_organicas: p.sessoes_organicas ?? null,
        sessoes_midia: p.sessoes_midia ?? null,
        taxa_conversao: p.taxa_conversao ?? p.premissa_taxa_conversao ?? null,
        taxa_aprovacao: p.taxa_aprovacao ?? p.premissa_taxa_aprovacao ?? null,
        taxa_aquisicao: p.taxa_aquisicao ?? p.premissa_taxa_aquisicao ?? null,
        pedidos_captados: p.pedidos_captados ?? null,
        investimento_total: p.investimento_total ?? null,
        adcost_pct: p.adcost_pct ?? null,
        cpc_medio: null,
        cac_novos: p.cac_novos ?? null,
        roas_faturado: p.roas_faturado ?? null,
      });

      // Canais históricos (participação média)
      const histTot = canaisHistRows.reduce((s: number, r: any) => s + num(r.sessions), 0);
      const histAgg: Record<string, number> = {};
      for (const r of canaisHistRows) {
        const g = r.session_custom_channel_group || "—";
        histAgg[g] = (histAgg[g] || 0) + num(r.sessions);
      }
      const histParticip: Record<string, number> = {};
      if (histTot > 0) for (const k of Object.keys(histAgg)) histParticip[k] = (histAgg[k] / histTot) * 100;
      setCanaisHistoricos(histParticip);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [ano, mes, range]);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  const projecao = useMemo(() => {
    const fator = range.diasTotais / range.diasDecorridos;
    const out: Partial<Record<PilarKey, number | null>> = {};
    for (const k of Object.keys(realizado) as PilarKey[]) {
      const v = realizado[k];
      if (v == null) { out[k] = null; continue; }
      const isTaxa = k.startsWith("taxa_") || k === "adcost_pct" || k === "roas_faturado" || k === "cac_novos" || k === "cpc_medio";
      out[k] = isTaxa ? v : v * fator;
    }
    return out;
  }, [realizado, range]);

  const statusPorPilar = useMemo(() => {
    const pctDec = range.diasDecorridos / range.diasTotais;
    const s: Record<PilarKey, PilarStatus> = {} as any;
    const proj = projecao;
    // Volume: comparar projeção vs meta
    (["receita_captada","receita_faturada","sessoes_totais","sessoes_midia","sessoes_organicas","pedidos_captados"] as PilarKey[])
      .forEach((k) => (s[k] = statusVolume(realizado[k] ?? null, meta[k] ?? null, pctDec)));
    // Taxas maior-melhor
    (["taxa_conversao","taxa_aprovacao","roas_faturado"] as PilarKey[])
      .forEach((k) => (s[k] = statusMaiorEhMelhor(realizado[k] ?? null, meta[k] ?? null)));
    // Aquisição: metas específicas – tratamos como maior-melhor comparado à meta
    s.taxa_aquisicao = statusMaiorEhMelhor(realizado.taxa_aquisicao ?? null, meta.taxa_aquisicao ?? null);
    // Menor-melhor
    s.investimento_total = statusMenorEhMelhor(proj.investimento_total ?? null, meta.investimento_total ?? null, 0.1);
    s.adcost_pct = statusMenorEhMelhor(realizado.adcost_pct ?? null, meta.adcost_pct ?? null, 0.15);
    s.cpc_medio = "neutro";
    s.cac_novos = statusMenorEhMelhor(realizado.cac_novos ?? null, meta.cac_novos ?? null, 0.2);
    return s;
  }, [realizado, meta, projecao, range]);

  const ritmoMes = useMemo(() => {
    const pctDecorrido = (range.diasDecorridos / range.diasTotais) * 100;
    const pctReceita =
      meta.receita_captada && meta.receita_captada > 0 && realizado.receita_captada != null
        ? (realizado.receita_captada / meta.receita_captada) * 100
        : null;
    const pctSessoes =
      meta.sessoes_totais && meta.sessoes_totais > 0 && realizado.sessoes_totais != null
        ? (realizado.sessoes_totais / meta.sessoes_totais) * 100
        : null;
    return {
      diasDecorridos: range.diasDecorridos,
      diasTotais: range.diasTotais,
      pctDecorrido,
      pctReceita,
      pctSessoes,
    };
  }, [meta, realizado, range]);

  return {
    meta,
    realizado,
    projecao,
    statusPorPilar,
    ritmoMes,
    canaisAtual,
    canaisHistoricos,
    campanhasBaixoRoas,
    isLoading,
    isRefreshing,
    refetch: load,
  };
}

export const PILAR_LABELS: Record<PilarKey, string> = {
  receita_captada: "Receita Captada",
  receita_faturada: "Receita Faturada",
  sessoes_totais: "Sessões Totais",
  sessoes_organicas: "Sessões Orgânicas",
  sessoes_midia: "Sessões de Mídia",
  taxa_conversao: "Taxa de Conversão",
  taxa_aprovacao: "Taxa de Aprovação",
  taxa_aquisicao: "Taxa de Aquisição",
  pedidos_captados: "Pedidos Captados",
  investimento_total: "Investimento Total",
  adcost_pct: "AdCost %",
  cpc_medio: "CPC Médio",
  cac_novos: "CAC Novos",
  roas_faturado: "ROAS Faturado",
};

export const PILAR_FORMATOS: Record<PilarKey, "brl" | "pct" | "num" | "roas"> = {
  receita_captada: "brl",
  receita_faturada: "brl",
  sessoes_totais: "num",
  sessoes_organicas: "num",
  sessoes_midia: "num",
  taxa_conversao: "pct",
  taxa_aprovacao: "pct",
  taxa_aquisicao: "pct",
  pedidos_captados: "num",
  investimento_total: "brl",
  adcost_pct: "pct",
  cpc_medio: "brl",
  cac_novos: "brl",
  roas_faturado: "roas",
};

export function formatPilar(v: number | null | undefined, fmt: "brl" | "pct" | "num" | "roas"): string {
  if (v == null || !isFinite(v)) return "—";
  if (fmt === "brl") return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (fmt === "pct") return `${v.toFixed(2)}%`;
  if (fmt === "roas") return `${v.toFixed(2)}x`;
  return Math.round(v).toLocaleString("pt-BR");
}
