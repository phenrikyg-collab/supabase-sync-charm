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
  taxaAquisicaoView: number | null;
  pedidosCaptadosView: number | null;
  sessoesMesView: number | null;
  clientesNovos: number;
  clientesRecorrentes: number;
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
        .select("mes, total_pedidos, pedidos, cancelados_reais, taxa_aprovacao, taxa_aquisicao, sessoes, taxa_conversao, clientes_novos, clientes_recorrentes")
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
    const taxaAquisicaoView = taxaRow?.taxa_aquisicao != null ? num(taxaRow.taxa_aquisicao) : null;
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
      taxaAquisicaoView,
      pedidosCaptadosView,
      sessoesMesView,
      clientesNovos,
      clientesRecorrentes,
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
        realizado: data.taxaAquisicaoView,
        projecao: data.taxaAquisicaoView,
        status: statusVsMeta(data.taxaAquisicaoView, m.premissa_taxa_aquisicao ?? null),
        tooltip: "Fonte: vw_taxa_conversao_mensal",
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
        meta: m.premissa_cps_midia ?? null,
        realizado: data.cpcMedio || null,
        projecao: data.cpcMedio || null,
        status: statusMenorMelhor(data.cpcMedio || null, m.premissa_cps_midia ?? null),
        tooltip: "Meta: premissa_cps_midia (planejamento_mensal)",
      },
      {
        label: "ROAS Faturado",
        fmt: fmtRoas,
        meta: m.roas_faturado ?? null,
        realizado: data.investimentoTotal > 0 && trayR != null ? trayR / data.investimentoTotal : null,
        projecao: data.investimentoTotal > 0 && trayR != null ? trayR / data.investimentoTotal : null,
        status: statusVsMeta(
          data.investimentoTotal > 0 && trayR != null ? trayR / data.investimentoTotal : null,
          m.roas_faturado ?? null,
        ),
        tooltip: "receita_faturada (tray_orders) / investimento (windsor_meta_ads)",
      },
      {
        label: "CAC Novos",
        fmt: fmtBRL0,
        meta: m.cac_novos ?? 65,
        realizado: data.clientesNovos > 0 ? data.investimentoTotal / data.clientesNovos : null,
        projecao: data.clientesNovos > 0 ? data.investimentoTotal / data.clientesNovos : null,
        status: statusMenorMelhor(
          data.clientesNovos > 0 ? data.investimentoTotal / data.clientesNovos : null,
          m.cac_novos ?? 65,
        ),
        tooltip: "investimentoTotal / clientes_novos (vw_taxa_conversao_mensal)",
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

      {/* Mix de Clientes */}
      {data && (() => {
        const cn = data.clientesNovos;
        const cr = data.clientesRecorrentes;
        const cu = cn + cr;
        const pn = cu > 0 ? (cn / cu) * 100 : 0;
        const pr = cu > 0 ? (cr / cu) * 100 : 0;
        const recCor = pr >= 60 ? "#16a34a" : pr >= 40 ? "#ca8a04" : "#dc2626";
        return (
          <Card style={{ borderColor: "#E8CD7E" }}>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Mix de Clientes</CardTitle>
              <p className="text-xs text-muted-foreground">Fonte: vw_taxa_conversao_mensal</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border p-4 bg-white">
                  <p className="text-xs text-muted-foreground">Clientes Únicos</p>
                  <p className="text-2xl font-serif mt-1">{cu.toLocaleString("pt-BR")}</p>
                </div>
                <div className="rounded-lg border p-4 bg-white">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Clientes Novos</p>
                    <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: "#2563eb" }}>
                      {pn.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-2xl font-serif mt-1">{cn.toLocaleString("pt-BR")}</p>
                </div>
                <div className="rounded-lg border p-4 bg-white">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Clientes Recorrentes</p>
                    <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: "#16a34a" }}>
                      {pr.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-2xl font-serif mt-1">{cr.toLocaleString("pt-BR")}</p>
                </div>
                <div className="rounded-lg border p-4 bg-white">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Taxa de Recorrência</p>
                    <span className="text-xs" style={{ color: recCor }}>
                      {pr >= 60 ? "▲ ótimo" : pr >= 40 ? "◆ ok" : "▼ baixo"}
                    </span>
                  </div>
                  <p className="text-2xl font-serif mt-1" style={{ color: recCor }}>{pr.toFixed(1)}%</p>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full" style={{ width: `${Math.min(pr, 100)}%`, background: recCor }} />
                  </div>
                </div>
              </div>
              {/* Barra de proporção Novos vs Recorrentes */}
              <div className="mt-4">
                <div className="flex h-3 rounded-full overflow-hidden border">
                  <div style={{ width: `${pn}%`, background: "#2563eb" }} title={`Novos ${pn.toFixed(1)}%`} />
                  <div style={{ width: `${pr}%`, background: "#16a34a" }} title={`Recorrentes ${pr.toFixed(1)}%`} />
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span style={{ color: "#2563eb" }}>Novos {pn.toFixed(1)}%</span>
                  <span style={{ color: "#16a34a" }}>Recorrentes {pr.toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </TooltipProvider>
  );
}

// ─── Diagnóstico por Driver (9 drivers do planejamento) ─────
type DiagTipo = "danger" | "warning" | "info" | "success";
interface Diag {
  tipo: DiagTipo;
  driver: string;
  mensagem: string;
}

export function DiagnosticoMes({ ano, mes }: { ano: number; mes: number }) {
  const [diagnosticos, setDiagnosticos] = useState<Diag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const mesStr = `${ano}-${pad(mes)}`;
      const diasNoMes = new Date(ano, mes, 0).getDate();
      const dataInicio = `${mesStr}-01`;
      const dataFim = `${mesStr}-${pad(diasNoMes)}`;

      const [taxaRes, histRes, adsRes, canaisRes, trayRes] = await Promise.all([
        (supabase as any)
          .from("vw_taxa_conversao_mensal")
          .select("*")
          .eq("mes", mesStr)
          .maybeSingle(),
        (supabase as any)
          .from("vw_taxa_conversao_mensal")
          .select("*")
          .lt("mes", mesStr)
          .order("mes", { ascending: false })
          .limit(3),
        fetchAll("windsor_meta_ads", "spend", (q) =>
          q.gte("date", dataInicio).lte("date", dataFim),
        ).catch(() => [] as any[]),
        fetchAll(
          "windsor_canais",
          "sessions, session_custom_channel_group",
          (q) => q.gte("date", dataInicio).lte("date", dataFim),
        ).catch(() => [] as any[]),
        fetchAll("tray_orders", "total, orderstatus_type", (q) =>
          q.gte("date", dataInicio).lte("date", dataFim + "T23:59:59"),
        ).catch(() => [] as any[]),
      ]);

      const taxaData = taxaRes?.data ?? null;
      const historico = histRes?.data ?? [];
      const mesAnterior = historico[0] ?? null;

      const investimentoTotal = adsRes.reduce((s: number, r: any) => s + num(r.spend), 0);
      const sessoesMidia = canaisRes
        .filter((r: any) => MIDIA_GROUPS.has(r.session_custom_channel_group))
        .reduce((s: number, r: any) => s + num(r.sessions), 0);
      const receitaFaturada = trayRes
        .filter((o: any) => o.orderstatus_type !== "canceled")
        .reduce((s: number, o: any) => s + num(o.total), 0);
      const pedidos = num(taxaData?.pedidos);

      const cpsMidia = sessoesMidia > 0 ? investimentoTotal / sessoesMidia : 0;
      const ticketMedio = pedidos > 0 ? receitaFaturada / pedidos : 0;

      const cn = num(taxaData?.clientes_novos);
      const cr = num(taxaData?.clientes_recorrentes);
      const cu = cn + cr;
      const retencaoAtual = cu > 0 ? (cr / cu) * 100 : 0;

      const cnA = num(mesAnterior?.clientes_novos);
      const crA = num(mesAnterior?.clientes_recorrentes);
      const cuA = cnA + crA;
      const retencaoAnterior = cuA > 0 ? (crA / cuA) * 100 : null;

      const diags: Diag[] = [];

      // 01. Retenção
      if (cu > 0) {
        if (retencaoAtual < 10)
          diags.push({ tipo: "danger", driver: "01. Retenção", mensagem: `Retenção em ${retencaoAtual.toFixed(1)}% — abaixo do mínimo saudável de 10%. Ativar estratégia de recompra: WhatsApp VIP, e-mail e cashback.` });
        else if (retencaoAtual > 38)
          diags.push({ tipo: "warning", driver: "01. Retenção", mensagem: `Retenção em ${retencaoAtual.toFixed(1)}% — acima de 38% sinaliza aquisição parada. Aumentar investimento em novos clientes.` });
        else if (retencaoAnterior != null && Math.abs(retencaoAtual - retencaoAnterior) > 2)
          diags.push({ tipo: "warning", driver: "01. Retenção", mensagem: `Variação de ${(retencaoAtual - retencaoAnterior).toFixed(1)}pp vs mês anterior — acima do teto de ±2pp/mês.` });
      }

      // 02. Aprovação
      const aprovacao = num(taxaData?.taxa_aprovacao);
      const aprovacaoAnterior = mesAnterior?.taxa_aprovacao != null ? num(mesAnterior.taxa_aprovacao) : null;
      if (taxaData?.taxa_aprovacao != null) {
        if (aprovacao < 70)
          diags.push({ tipo: "danger", driver: "02. Aprovação", mensagem: `Taxa de aprovação em ${aprovacao.toFixed(2)}% — crítico, abaixo de 70%. Revisar gateway de pagamento e ofertas de parcelamento.` });
        else if (aprovacao < 85)
          diags.push({ tipo: "warning", driver: "02. Aprovação", mensagem: `Taxa de aprovação em ${aprovacao.toFixed(2)}% — abaixo do alvo de 90%. Revisar opções de pagamento e follow-up de boletos.` });
        else if (aprovacaoAnterior != null && Math.abs(aprovacao - aprovacaoAnterior) > 1)
          diags.push({ tipo: "warning", driver: "02. Aprovação", mensagem: `Variação de ${(aprovacao - aprovacaoAnterior).toFixed(1)}pp vs mês anterior — acima do teto de ±1pp/mês.` });
      }

      // 03. Ticket Médio
      if (ticketMedio > 0 && ticketMedio < 150)
        diags.push({ tipo: "warning", driver: "03. Ticket Médio", mensagem: `Ticket médio em R$ ${ticketMedio.toFixed(0)} — verificar mix de produtos e ofertas de combo/upsell.` });

      // 04. Conversão
      const conversao = num(taxaData?.taxa_conversao);
      const conversaoAnterior = mesAnterior?.taxa_conversao != null ? num(mesAnterior.taxa_conversao) : null;
      if (taxaData?.taxa_conversao != null) {
        if (conversao < 0.3)
          diags.push({ tipo: "danger", driver: "04. Conversão", mensagem: `Taxa de conversão em ${conversao.toFixed(2)}% — abaixo do mínimo de 0,3%. Revisar funil completo: landing pages, checkout e provas sociais.` });
        else if (conversao < 1.5)
          diags.push({ tipo: "warning", driver: "04. Conversão", mensagem: `Taxa de conversão em ${conversao.toFixed(2)}% — abaixo de 1,5%. Testar novos CTAs, urgência e frete grátis progressivo.` });
        else if (conversaoAnterior != null && Math.abs(conversao - conversaoAnterior) > 0.25)
          diags.push({ tipo: "warning", driver: "04. Conversão", mensagem: `Variação de ${(conversao - conversaoAnterior).toFixed(2)}pp vs mês anterior — acima do teto de ±0,25pp/mês.` });
      }

      // 05. Mídia
      if (investimentoTotal === 0)
        diags.push({ tipo: "danger", driver: "05. Mídia", mensagem: `Sem investimento em mídia registrado. Verificar sincronização do Meta Ads.` });

      // 09. CPS Mídia
      if (cpsMidia > 5)
        diags.push({ tipo: "danger", driver: "09. CPS Mídia", mensagem: `CPS em R$ ${cpsMidia.toFixed(2)} — acima do teto de R$ 5,00. Revisar segmentação e criativos urgentemente.` });
      else if (cpsMidia > 1.2)
        diags.push({ tipo: "warning", driver: "09. CPS Mídia", mensagem: `CPS em R$ ${cpsMidia.toFixed(2)} — acima do ideal de R$ 1,20. Otimizar audiências e testar novos criativos.` });
      else if (cpsMidia > 0 && cpsMidia < 0.1)
        diags.push({ tipo: "info", driver: "09. CPS Mídia", mensagem: `CPS em R$ ${cpsMidia.toFixed(2)} — abaixo de R$ 0,10, verificar se o tráfego é qualificado.` });

      if (diags.length === 0)
        diags.push({ tipo: "success", driver: "Geral", mensagem: "Todos os drivers dentro das faixas saudáveis. Manter ritmo e monitorar variações." });

      const ordem: Record<DiagTipo, number> = { danger: 0, warning: 1, info: 2, success: 3 };
      diags.sort((a, b) => ordem[a.tipo] - ordem[b.tipo]);

      if (!cancelled) {
        setDiagnosticos(diags);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ano, mes]);

  const estilo = (t: DiagTipo) => {
    switch (t) {
      case "danger":
        return { icone: "🔴", cls: "border-rose-200 bg-rose-50" };
      case "warning":
        return { icone: "🟡", cls: "border-amber-200 bg-amber-50" };
      case "info":
        return { icone: "🔵", cls: "border-sky-200 bg-sky-50" };
      case "success":
        return { icone: "🟢", cls: "border-emerald-200 bg-emerald-50" };
    }
  };

  return (
    <Card style={{ borderColor: "#F5E9B8" }}>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Diagnóstico por Driver</CardTitle>
        <p className="text-xs text-muted-foreground">
          Baseado nos 9 drivers do planejamento — faixas saudáveis e variações mensais.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Analisando…
          </div>
        ) : (
          diagnosticos.map((d, i) => {
            const s = estilo(d.tipo);
            return (
              <div key={i} className={`rounded-md border p-4 ${s.cls}`}>
                <div className="text-sm flex items-start gap-2">
                  <span>{s.icone}</span>
                  <div>
                    <strong>{d.driver}</strong>
                    <div className="text-xs text-muted-foreground mt-1">{d.mensagem}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

