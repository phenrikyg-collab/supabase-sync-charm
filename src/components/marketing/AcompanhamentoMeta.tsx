import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { MESES } from "@/hooks/usePlanejamentoMensal";
import { useRealizadoMes } from "@/hooks/useRealizadoMes";

// ─── helpers ────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const num = (v: any) => (typeof v === "number" ? v : Number(v) || 0);
const fmtBRL0 = (v: number | null | undefined) =>
  v == null || !isFinite(v as number)
    ? "—"
    : (v as number).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRL2 = (v: number | null | undefined) =>
  v == null || !isFinite(v as number)
    ? "—"
    : (v as number).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtInt = (v: number | null | undefined) =>
  v == null || !isFinite(v as number) ? "—" : Math.round(v as number).toLocaleString("pt-BR");
const fmtPct = (v: number | null | undefined, digits = 2) =>
  v == null || !isFinite(v as number) ? "—" : `${(v as number).toFixed(digits)}%`;
const fmtRoas = (v: number | null | undefined) =>
  v == null || !isFinite(v as number) ? "—" : `${(v as number).toFixed(2)}x`;

const MIDIA_GROUPS = new Set([
  "01. Facebook CPC",
  "02. Google CPC",
  "03. IGShopping",
  "09. TikTok",
]);

// Recursive fetch to bypass PostgREST 1000-row limit
async function fetchAll(table: string, select: string, filters: (q: any) => any) {
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
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

type Status = "verde" | "amarelo" | "vermelho" | "neutro";
const dot = (s: Status) => (s === "verde" ? "🟢" : s === "amarelo" ? "🟡" : s === "vermelho" ? "🔴" : "⚪");
const dotClass = (s: Status) =>
  s === "verde"
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : s === "amarelo"
    ? "bg-amber-100 text-amber-800 border-amber-200"
    : s === "vermelho"
    ? "bg-rose-100 text-rose-800 border-rose-200"
    : "bg-muted text-muted-foreground";

// projecao vs meta
function statusVsMeta(proj: number | null, meta: number | null): Status {
  if (proj == null || meta == null || meta === 0) return "neutro";
  const pct = proj / meta;
  if (pct >= 0.95) return "verde";
  if (pct >= 0.8) return "amarelo";
  return "vermelho";
}
// menor-é-melhor (custos): proj > meta é ruim
function statusMenorMelhor(proj: number | null, meta: number | null): Status {
  if (proj == null || meta == null || meta === 0) return "neutro";
  const pct = proj / meta;
  if (pct <= 1.05) return "verde";
  if (pct <= 1.2) return "amarelo";
  return "vermelho";
}

interface Fetched {
  meta: any | null;
  tray: { pedidos_captados: number; receita_captada: number; receita_faturada: number } | null;
  sessoesTotais: number;
  sessoesMidia: number;
  sessoesOrganicas: number;
  taxaConversao: number | null;
  taxaAprovacaoView: number | null;
  pedidosCaptadosView: number | null;
  sessoesMesView: number | null;
  investimentoTotal: number;
  clicksTotal: number;
  receitaAtribuida: number;
  roasMedio: number;
  cpcMedio: number;
  atualizadoEm: string | null;
  errors: { meta?: boolean; tray?: boolean; canais?: boolean; metaAds?: boolean; taxa?: boolean };
}

export function AcompanhamentoMeta({ ano, mes }: { ano: number; mes: number }) {
  const [data, setData] = useState<Fetched | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const hoje = useMemo(() => new Date(), []);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const diasDecorridos =
    ano === hoje.getFullYear() && mes === hoje.getMonth() + 1
      ? hoje.getDate()
      : diasNoMes;
  const fatorProjecao = diasNoMes / diasDecorridos;
  const pctDecorrido = Math.round((diasDecorridos / diasNoMes) * 100);

  const dataInicio = `${ano}-${pad(mes)}-01`;
  const dataFim =
    ano === hoje.getFullYear() && mes === hoje.getMonth() + 1
      ? hoje.toISOString().split("T")[0]
      : `${ano}-${pad(mes)}-${pad(diasNoMes)}`;

  const load = useCallback(async () => {
    setRefreshing(true);
    const errs: Fetched["errors"] = {};

    // queries em paralelo
    const mesKey = `${ano}-${pad(mes)}`;
    const [metaRes, canaisRows, metaAdsRows, traySummary, taxaRow] = await Promise.all([
      // 1. Meta do mês
      (supabase as any)
        .from("planejamento_mensal")
        .select(
          "receita_captada, receita_faturada, sessoes_totais, sessoes_midia, sessoes_organicas, premissa_taxa_conversao, premissa_taxa_aprovacao, premissa_taxa_aquisicao, investimento_total, pedidos_captados, roas_faturado, premissa_cps_midia",
        )
        .eq("ano", ano)
        .eq("mes", mes)
        .eq("tipo", "planejado")
        .maybeSingle()
        .then((r: any) => {
          if (r.error) errs.meta = true;
          return r.data;
        }),
      // 3. Sessões (windsor_canais)
      fetchAll(
        "windsor_canais",
        "sessions, items_purchased, session_custom_channel_group",
        (q) => q.gte("date", dataInicio).lte("date", dataFim),
      ).catch(() => {
        errs.canais = true;
        return [] as any[];
      }),
      // 4. Meta Ads (windsor_meta_ads) — inclui atualizado_em
      fetchAll(
        "windsor_meta_ads",
        "spend, clicks, purchase_roas, atualizado_em",
        (q) => q.gte("date", dataInicio).lte("date", dataFim),
      ).catch(() => {
        errs.metaAds = true;
        return [] as any[];
      }),
      // 2. Tray (via .from — sem RPC): busca ids cancelados recuperados + pedidos do mês
      (async () => {
        try {
          // ids cancelados que já foram recuperados no mês
          const { data: recuperados, error: eRec } = await (supabase as any)
            .from("vw_pedidos_recuperados")
            .select("pedido_cancelado, data_cancelado")
            .gte("data_cancelado", dataInicio)
            .lte("data_cancelado", dataFim);
          if (eRec) throw eRec;
          const excluidos = new Set(
            (recuperados || []).map((r: any) => String(r.pedido_cancelado)),
          );
          // pedidos tray do mês
          const orders = await fetchAll(
            "tray_orders",
            "id, total, orderstatus_type, date",
            (q) => q.gte("date", dataInicio).lte("date", dataFim + "T23:59:59"),
          );
          const filtrados = orders.filter((o: any) => !excluidos.has(String(o.id)));
          const receitaCaptada = filtrados.reduce((s: number, o: any) => s + num(o.total), 0);
          const receitaFaturada = filtrados
            .filter((o: any) => o.orderstatus_type !== "canceled")
            .reduce((s: number, o: any) => s + num(o.total), 0);
          return {
            pedidos_captados: filtrados.length,
            receita_captada: Math.round(receitaCaptada * 100) / 100,
            receita_faturada: Math.round(receitaFaturada * 100) / 100,
          };
        } catch {
          errs.tray = true;
          return null;
        }
      })(),
      // 5. Taxa de conversão da view
      (supabase as any)
        .from("vw_taxa_conversao_mensal")
        .select("mes, total_pedidos, pedidos, cancelados_reais, taxa_aprovacao, sessoes, taxa_conversao, clientes_novos, clientes_recorrentes")
        .eq("mes", mesKey)
        .maybeSingle()
        .then((r: any) => {
          if (r.error) errs.taxa = true;
          return r.data;
        }),
    ]);

    // ── sessões ──
    const sessoesTotais = canaisRows.reduce((s: number, r: any) => s + num(r.sessions), 0);
    const sessoesMidia = canaisRows
      .filter((r: any) => MIDIA_GROUPS.has(r.session_custom_channel_group))
      .reduce((s: number, r: any) => s + num(r.sessions), 0);
    const sessoesOrganicas = Math.max(sessoesTotais - sessoesMidia, 0);
    const comprasAtribuidas = canaisRows.reduce(
      (s: number, r: any) => s + num(r.items_purchased),
      0,
    );
    const taxaConversao =
      taxaRow?.taxa_conversao != null
        ? num(taxaRow.taxa_conversao)
        : sessoesTotais > 0
        ? (comprasAtribuidas / sessoesTotais) * 100
        : null;
    const pedidosCaptadosView = taxaRow?.pedidos != null ? num(taxaRow.pedidos) : null;
    const sessoesMesView = taxaRow?.sessoes != null ? num(taxaRow.sessoes) : null;
    const taxaAprovacaoView = taxaRow?.taxa_aprovacao != null ? num(taxaRow.taxa_aprovacao) : null;
    const clientesNovos = taxaRow?.clientes_novos != null ? num(taxaRow.clientes_novos) : 0;
    const clientesRecorrentes = taxaRow?.clientes_recorrentes != null ? num(taxaRow.clientes_recorrentes) : 0;

    // ── meta ads ──
    const investimentoTotal = metaAdsRows.reduce((s: number, r: any) => s + num(r.spend), 0);
    const clicksTotal = metaAdsRows.reduce((s: number, r: any) => s + num(r.clicks), 0);
    const receitaAtribuida = metaAdsRows.reduce(
      (s: number, r: any) => s + num(r.spend) * num(r.purchase_roas),
      0,
    );
    const roasMedio = investimentoTotal > 0 ? receitaAtribuida / investimentoTotal : 0;
    const cpcMedio = clicksTotal > 0 ? investimentoTotal / clicksTotal : 0;
    const atualizadoEm =
      metaAdsRows
        .map((r: any) => r.atualizado_em)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || null;

    setData({
      meta: metaRes || null,
      tray: traySummary,
      sessoesTotais,
      sessoesMidia,
      sessoesOrganicas,
      taxaConversao,
      taxaAprovacaoView,
      pedidosCaptadosView,
      sessoesMesView,
      investimentoTotal,
      clicksTotal,
      receitaAtribuida,
      roasMedio,
      cpcMedio,
      atualizadoEm,
      errors: errs,
    });
    setLoading(false);
    setRefreshing(false);
  }, [ano, mes, dataInicio, dataFim]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // ── linhas da tabela ──
  type Row = {
    label: string;
    fmt: (v: any) => string;
    meta: number | null;
    realizado: number | null;
    projecao: number | null;
    status: Status;
    tooltip?: string;
    noProject?: boolean; // status neutro se sem dado
  };

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const m = data.meta || {};
    const trayR = data.tray?.receita_faturada ?? null;
    const trayC = data.tray?.receita_captada ?? null;
    const trayP = data.tray?.pedidos_captados ?? null;

    const proj = (v: number | null) => (v == null ? null : v * fatorProjecao);

    const metaAdcost =
      m.investimento_total && m.receita_captada
        ? (m.investimento_total / m.receita_captada) * 100
        : null;
    const realAdcost =
      data.tray?.receita_captada && data.tray.receita_captada > 0
        ? (data.investimentoTotal / data.tray.receita_captada) * 100
        : null;

    return [
      {
        label: "Receita Faturada",
        fmt: fmtBRL0,
        meta: m.receita_faturada ?? null,
        realizado: trayR,
        projecao: proj(trayR),
        status: statusVsMeta(proj(trayR), m.receita_faturada ?? null),
      },
      {
        label: "Receita Captada",
        fmt: fmtBRL0,
        meta: m.receita_captada ?? null,
        realizado: trayC,
        projecao: proj(trayC),
        status: statusVsMeta(proj(trayC), m.receita_captada ?? null),
      },
      {
        label: "Sessões Totais",
        fmt: fmtInt,
        meta: m.sessoes_totais ?? null,
        realizado: data.sessoesMesView ?? data.sessoesTotais,
        projecao: (data.sessoesMesView ?? data.sessoesTotais) * fatorProjecao,
        status: statusVsMeta((data.sessoesMesView ?? data.sessoesTotais) * fatorProjecao, m.sessoes_totais ?? null),
        tooltip: data.sessoesMesView != null ? "Fonte: vw_taxa_conversao_mensal" : undefined,
      },
      {
        label: "Sessões Orgânicas",
        fmt: fmtInt,
        meta: m.sessoes_organicas ?? null,
        realizado: data.sessoesOrganicas,
        projecao: data.sessoesOrganicas * fatorProjecao,
        status: statusVsMeta(data.sessoesOrganicas * fatorProjecao, m.sessoes_organicas ?? null),
      },
      {
        label: "Sessões de Mídia",
        fmt: fmtInt,
        meta: m.sessoes_midia ?? null,
        realizado: data.sessoesMidia,
        projecao: data.sessoesMidia * fatorProjecao,
        status: statusVsMeta(data.sessoesMidia * fatorProjecao, m.sessoes_midia ?? null),
      },
      {
        label: "Taxa de Conversão",
        fmt: (v) => fmtPct(v),
        meta: m.premissa_taxa_conversao ?? null,
        realizado: data.taxaConversao,
        projecao: data.taxaConversao,
        status: statusVsMeta(data.taxaConversao, m.premissa_taxa_conversao ?? null),
        tooltip: "Fonte: vw_taxa_conversao_mensal (pedidos / sessões × 100)",
      },
      {
        label: "Taxa de Aprovação",
        fmt: (v) => fmtPct(v),
        meta: m.premissa_taxa_aprovacao ?? null,
        realizado: data.taxaAprovacaoView,
        projecao: data.taxaAprovacaoView,
        status: statusVsMeta(data.taxaAprovacaoView, m.premissa_taxa_aprovacao ?? null),
        tooltip: "Fonte: vw_taxa_conversao_mensal",
        noProject: true,
      },
      {
        label: "Taxa de Aquisição",
        fmt: (v) => fmtPct(v),
        meta: m.premissa_taxa_aquisicao ?? null,
        realizado: null,
        projecao: null,
        status: "neutro",
        tooltip: "Sem dado automático ainda",
        noProject: true,
      },
      {
        label: "Pedidos Captados",
        fmt: fmtInt,
        meta: m.pedidos_captados ?? null,
        realizado: data.pedidosCaptadosView ?? trayP,
        projecao: proj(data.pedidosCaptadosView ?? trayP),
        status: statusVsMeta(proj(data.pedidosCaptadosView ?? trayP), m.pedidos_captados ?? null),
        tooltip: data.pedidosCaptadosView != null ? "Fonte: vw_taxa_conversao_mensal" : undefined,
      },
      {
        label: "Investimento Total",
        fmt: fmtBRL0,
        meta: m.investimento_total ?? null,
        realizado: data.investimentoTotal,
        projecao: data.investimentoTotal * fatorProjecao,
        status: statusMenorMelhor(data.investimentoTotal * fatorProjecao, m.investimento_total ?? null),
      },
      {
        label: "AdCost %",
        fmt: (v) => fmtPct(v),
        meta: metaAdcost,
        realizado: realAdcost,
        projecao: realAdcost,
        status: statusMenorMelhor(realAdcost, metaAdcost),
      },
      {
        label: "CPC Médio",
        fmt: fmtBRL2,
        meta: null,
        realizado: data.cpcMedio || null,
        projecao: data.cpcMedio || null,
        status: "neutro",
      },
      {
        label: "ROAS Faturado",
        fmt: fmtRoas,
        meta: m.roas_faturado ?? null,
        realizado: data.roasMedio || null,
        projecao: data.roasMedio || null,
        status: statusVsMeta(data.roasMedio || null, m.roas_faturado ?? null),
      },
      {
        label: "CAC Novos",
        fmt: fmtBRL0,
        meta: 65,
        realizado: null,
        projecao: null,
        status: "neutro",
        tooltip: "Meta hardcoded temporariamente (R$ 65)",
        noProject: true,
      },
    ];
  }, [data, fatorProjecao]);

  // ── cards de ritmo ──
  const receitaAtingidaPct =
    data?.tray?.receita_faturada && data.meta?.receita_faturada
      ? Math.round((data.tray.receita_faturada / data.meta.receita_faturada) * 100)
      : null;
  const sessoesAtingidasPct =
    data?.sessoesTotais && data.meta?.sessoes_totais
      ? Math.round((data.sessoesTotais / data.meta.sessoes_totais) * 100)
      : null;

  const corRitmo = (pct: number | null) => {
    if (pct == null) return "bg-muted";
    if (pct >= pctDecorrido) return "bg-emerald-50 border-emerald-200";
    if (pct >= pctDecorrido * 0.8) return "bg-amber-50 border-amber-200";
    return "bg-rose-50 border-rose-200";
  };

  const RitmoCard = ({ titulo, valor, cor }: { titulo: string; valor: string; cor: string }) => (
    <div className={`rounded-lg border p-3 ${cor}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{titulo}</div>
      <div className="text-xl font-serif mt-1">{valor}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        mês decorrido: {pctDecorrido}%
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <Card style={{ borderColor: "#E8CD7E" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="font-serif text-lg">
              Acompanhamento da Meta — {MESES[mes - 1]} {ano}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Meta do Planejamento Mensal × Realizado até hoje × Projeção de fechamento
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={refreshing || loading}
            className="gap-1"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <RitmoCard
              titulo="Ritmo do Mês"
              valor={`${pctDecorrido}%`}
              cor="bg-emerald-50 border-emerald-200"
            />
            <RitmoCard
              titulo="Receita Atingida"
              valor={receitaAtingidaPct == null ? "—" : `${receitaAtingidaPct}%`}
              cor={corRitmo(receitaAtingidaPct)}
            />
            <RitmoCard
              titulo="Sessões Atingidas"
              valor={sessoesAtingidasPct == null ? "—" : `${sessoesAtingidasPct}%`}
              cor={corRitmo(sessoesAtingidasPct)}
            />
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow style={{ background: "#1D1D1B" }}>
                  <TableHead className="text-[#E8CD7E] uppercase text-[10px] tracking-wider">Pilar</TableHead>
                  <TableHead className="text-[#E8CD7E] uppercase text-[10px] tracking-wider text-right">Meta</TableHead>
                  <TableHead className="text-[#E8CD7E] uppercase text-[10px] tracking-wider text-right">Realizado</TableHead>
                  <TableHead className="text-[#E8CD7E] uppercase text-[10px] tracking-wider text-right">Projeção</TableHead>
                  <TableHead className="text-[#E8CD7E] uppercase text-[10px] tracking-wider text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 14 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : rows.map((r, i) => (
                      <TableRow key={r.label} className={i % 2 ? "bg-[#FAF8F3]" : "bg-white"}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            {r.label}
                            {r.tooltip && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <span className="text-xs">{r.tooltip}</span>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.fmt(r.meta)}</TableCell>
                        <TableCell className="text-right font-semibold">{r.fmt(r.realizado)}</TableCell>
                        <TableCell className="text-right">
                          {r.noProject ? "—" : r.fmt(r.projecao)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={dotClass(r.status)}>
                            {dot(r.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>

          <div className="text-[11px] text-muted-foreground space-y-1">
            <p>
              Fontes: Tray Commerce (pedidos/receita) · GA4 via Windsor (sessões/conversão) · Meta Ads via Windsor
              (investimento/ROAS)
            </p>
            <p>
              Atualizado em:{" "}
              {data?.atualizadoEm
                ? new Date(data.atualizadoEm).toLocaleString("pt-BR")
                : "—"}
            </p>
            {data?.errors && Object.keys(data.errors).length > 0 && (
              <p className="text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Algumas fontes falharam — verifique a sincronização.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// ─── Diagnóstico do mês (mantém uso do hook useRealizadoMes) ─────
export function DiagnosticoMes({ ano, mes }: { ano: number; mes: number }) {
  const r = useRealizadoMes(ano, mes);
  const diagnosticos: { titulo: string; evidencia: string; acao: string; cor: string }[] = [];
  const pctDec = r.ritmoMes.pctDecorrido;

  const sT = r.realizado.sessoes_totais ?? 0;
  const sMeta = r.meta.sessoes_totais ?? 0;
  if (sMeta > 0 && (sT / sMeta) * 100 < pctDec * 0.95) {
    const quedas = r.canaisAtual
      .map((c) => ({
        grupo: c.grupo,
        atual: c.participacao,
        hist: r.canaisHistoricos[c.grupo] ?? 0,
        queda: (r.canaisHistoricos[c.grupo] ?? 0) - c.participacao,
      }))
      .filter((q) => q.hist > 5)
      .sort((a, b) => b.queda - a.queda);
    const pior = quedas[0];
    diagnosticos.push({
      titulo: "Sessões abaixo do ritmo da meta",
      evidencia: pior
        ? `Canal com maior queda de participação: ${pior.grupo} (${pior.atual.toFixed(1)}% atual vs ${pior.hist.toFixed(1)}% histórico).`
        : `Volume acumulado ${((sT / sMeta) * 100).toFixed(0)}% da meta com ${pctDec.toFixed(0)}% do mês decorrido.`,
      acao: pior
        ? `Escalar campanhas ou revisar SEO/criativos em ${pior.grupo}.`
        : "Aumentar investimento em mídia paga ou intensificar publicações orgânicas.",
      cor: "border-rose-200 bg-rose-50",
    });
  }

  const tc = r.realizado.taxa_conversao ?? null;
  const tcMeta = r.meta.taxa_conversao ?? null;
  if (tc != null && tcMeta != null && tc < tcMeta * 0.9) {
    diagnosticos.push({
      titulo: "Taxa de conversão abaixo da meta",
      evidencia: `Conversão atual ${tc.toFixed(2)}% vs meta ${tcMeta.toFixed(2)}%.`,
      acao: "Revisar funil de checkout, testar novos CTAs, revisar preço/frete e provas sociais.",
      cor: "border-amber-200 bg-amber-50",
    });
  }

  const roas = r.realizado.roas_faturado ?? 0;
  if (roas > 0 && roas < 2 && r.campanhasBaixoRoas.length > 0) {
    diagnosticos.push({
      titulo: "ROAS abaixo do ponto de equilíbrio",
      evidencia: `Top campanhas com pior ROAS: ${r.campanhasBaixoRoas.map((c) => `${c.campaign} (${c.roas.toFixed(2)}x)`).join(", ")}.`,
      acao: "Pausar ou reduzir orçamento dessas campanhas; realocar para as com melhor performance.",
      cor: "border-rose-200 bg-rose-50",
    });
  }

  const cac = r.realizado.cac_novos ?? null;
  const cacMeta = r.meta.cac_novos ?? null;
  if (cac != null && cacMeta != null && cac > cacMeta * 1.2) {
    diagnosticos.push({
      titulo: "CAC de novos acima da meta",
      evidencia: `CAC atual R$ ${cac.toFixed(0)} vs meta R$ ${cacMeta.toFixed(0)}.`,
      acao: "Revisar mix de canais: reduzir gasto em canais caros, escalar canais eficientes.",
      cor: "border-amber-200 bg-amber-50",
    });
  }

  const inv = r.projecao.investimento_total ?? null;
  const invMeta = r.meta.investimento_total ?? null;
  if (inv != null && invMeta != null && invMeta > 0 && inv > invMeta * 1.15) {
    diagnosticos.push({
      titulo: "Projeção de investimento acima do orçado",
      evidencia: `Projeção R$ ${inv.toFixed(0)} vs meta R$ ${invMeta.toFixed(0)}.`,
      acao: "Ajustar ritmo diário de gasto ou revisar campanhas com maior consumo.",
      cor: "border-rose-200 bg-rose-50",
    });
  }

  return (
    <Card style={{ borderColor: "#F5E9B8" }}>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Diagnóstico do Mês</CardTitle>
        <p className="text-xs text-muted-foreground">
          Regras determinísticas baseadas nos dados reais do sistema.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {r.isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Analisando…
          </div>
        ) : diagnosticos.length === 0 ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm">
            ✅ Todos os pilares estão dentro do esperado para o ritmo do mês.
          </div>
        ) : (
          diagnosticos.map((d, i) => (
            <div key={i} className={`rounded-md border p-4 ${d.cor}`}>
              <div className="font-semibold text-sm">{d.titulo}</div>
              <div className="text-xs text-muted-foreground mt-1">{d.evidencia}</div>
              <div className="text-xs mt-2">
                <strong>Ação sugerida:</strong> {d.acao}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
