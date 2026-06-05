import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  usePlanejamentoMensal, PlanejamentoMensal as PM,
  MESES, fmtBRL, fmtNum, fmtPct, CAMPOS_MANUAIS,
} from "@/hooks/usePlanejamentoMensal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, ArrowUp, ArrowDown, Minus } from "lucide-react";

type Manual = Partial<Record<typeof CAMPOS_MANUAIS[number], number | null>>;

const calcBadge = (className = "") => (
  <span className={`ml-2 text-[10px] uppercase tracking-wider text-muted-foreground ${className}`}>calc</span>
);

function CalcField({ label, value, format = "num" }: { label: string; value: number | null | undefined; format?: "brl" | "pct" | "num" }) {
  const display = value == null || !isFinite(value as number)
    ? "—"
    : format === "brl" ? fmtBRL(value)
    : format === "pct" ? fmtPct(value)
    : fmtNum(value);
  return (
    <div className="rounded-md px-3 py-2" style={{ background: "#FAF6EE" }}>
      <div className="text-xs text-muted-foreground flex items-center">{label}{calcBadge()}</div>
      <div className="font-semibold text-sm mt-0.5">{display}</div>
    </div>
  );
}

function NumInput({ label, value, onChange, suffix, disabled }: {
  label: string; value: number | null | undefined; onChange: (v: number | null) => void; suffix?: string; disabled?: boolean;
}) {
  const isNeg = typeof value === "number" && value < 0;
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground/80">{label}{suffix ? ` (${suffix})` : ""}</label>
      <Input
        type="number" step="0.01" disabled={disabled}
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        style={{ background: "#FAF8F3", borderColor: isNeg ? "#C0392B" : undefined }}
        className="focus-visible:ring-[#E8CD7E] focus-visible:border-[#E8CD7E]"
      />
    </div>
  );
}

function StatusBadge({ s }: { s: PM["status"] }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    rascunho: { bg: "#E5E5E5", fg: "#444", label: "Rascunho" },
    aprovado: { bg: "#E8CD7E", fg: "#1D1D1B", label: "Aprovado" },
    fechado:  { bg: "#2D7D46", fg: "#fff", label: "Fechado" },
  };
  const c = map[s] ?? map.rascunho;
  return <Badge style={{ background: c.bg, color: c.fg }}>{c.label}</Badge>;
}

function RoasBadge({ v }: { v: number | null | undefined }) {
  if (v == null || !isFinite(v)) return <span className="text-muted-foreground">—</span>;
  const cls = v >= 4 ? { bg: "#D4F5DE", fg: "#2D7D46" } : v >= 2.5 ? { bg: "#FFFBEA", fg: "#A07800" } : { bg: "#FFE8E5", fg: "#C0392B" };
  return <Badge style={{ background: cls.bg, color: cls.fg }}>{v.toFixed(2)}x</Badge>;
}

function Trend({ cur, prev, lowerIsBetter = false }: { cur: number | null; prev: number | null; lowerIsBetter?: boolean }) {
  if (cur == null || prev == null) return <Minus className="inline h-3 w-3 text-muted-foreground" />;
  if (cur === prev) return <Minus className="inline h-3 w-3 text-muted-foreground" />;
  const up = cur > prev;
  const good = lowerIsBetter ? !up : up;
  const cls = good ? "text-emerald-600" : "text-rose-600";
  return up ? <ArrowUp className={`inline h-3 w-3 ${cls}`} /> : <ArrowDown className={`inline h-3 w-3 ${cls}`} />;
}

type PilarStatus = "verde" | "amarelo" | "vermelho";

function pilarDot(s: PilarStatus) {
  const map = { verde: "🟢", amarelo: "🟡", vermelho: "🔴" };
  return map[s];
}

interface Pilar {
  nome: string;
  atual: number | null | undefined;
  meta: string;
  status: PilarStatus;
  fmt: (v: number | null | undefined) => string;
}

function NovePilaresCard({
  atualData, metaValues, metaLabel = "Meta", footnote,
}: {
  atualData: Partial<PM> | null;
  metaValues: Partial<Record<keyof PM, number | null>>;
  metaLabel?: string;
  footnote?: string;
}) {
  const statusAprovacao = (v: number | null | undefined): PilarStatus | "neutro" =>
    v == null ? "neutro" : v >= 90 ? "verde" : v >= 85 ? "amarelo" : "vermelho";
  const statusRoas = (v: number | null | undefined): PilarStatus | "neutro" =>
    v == null ? "neutro" : v >= 3.5 ? "verde" : v >= 2.5 ? "amarelo" : "vermelho";
  const statusConv = (v: number | null | undefined): PilarStatus | "neutro" =>
    v == null ? "neutro" : v >= 0.5 ? "verde" : v >= 0.3 ? "amarelo" : "vermelho";
  const statusAquisicao = (v: number | null | undefined): PilarStatus | "neutro" => {
    if (v == null) return "neutro";
    if (v >= 60 && v <= 75) return "verde";
    if ((v > 75 && v <= 85) || (v >= 50 && v < 60)) return "amarelo";
    return "vermelho";
  };
  const statusGreater = (atual: number | null | undefined, meta: number | null | undefined): PilarStatus | "neutro" => {
    if (atual == null || !isFinite(atual)) return "neutro";
    if (meta == null || !isFinite(meta) || meta === 0) return "neutro";
    if (atual >= meta) return "verde";
    if (atual >= meta * 0.9) return "amarelo";
    return "vermelho";
  };
  const statusLess = (atual: number | null | undefined, meta: number | null | undefined, tol = 0.1): PilarStatus | "neutro" => {
    if (atual == null || !isFinite(atual)) return "neutro";
    if (meta == null || !isFinite(meta) || meta === 0) return "neutro";
    if (atual <= meta) return "verde";
    if (atual <= meta * (1 + tol)) return "amarelo";
    return "vermelho";
  };

  const dot = (s: PilarStatus | "neutro") => {
    if (s === "verde") return <span>🟢</span>;
    if (s === "amarelo") return <span>🟡</span>;
    if (s === "vermelho") return <span>🔴</span>;
    return <span className="inline-block w-3 h-3 rounded-full bg-muted-foreground/30" />;
  };

  const fmtRoas = (v: number | null | undefined) => v == null || !isFinite(v) ? "—" : v.toFixed(2) + "x";
  const fmtConv = (v: number | null | undefined) => v == null || !isFinite(v) ? "—" : v.toFixed(2) + "%";

  const a = atualData ?? {};
  const m = metaValues ?? {};
  const pilares = [
    { nome: "Receita Captada", atual: a.receita_captada, meta: m.receita_captada, fmt: fmtBRL,
      status: statusGreater(a.receita_captada, m.receita_captada) },
    { nome: "Taxa de Aprovação", atual: a.taxa_aprovacao, meta: m.taxa_aprovacao, fmt: fmtPct,
      status: statusAprovacao(a.taxa_aprovacao) },
    { nome: "Pedidos Captados", atual: a.pedidos_captados, meta: m.pedidos_captados, fmt: fmtNum,
      status: statusGreater(a.pedidos_captados, m.pedidos_captados) },
    { nome: "Taxa de Aquisição", atual: a.taxa_aquisicao, meta: m.taxa_aquisicao, fmt: fmtPct,
      status: statusAquisicao(a.taxa_aquisicao) },
    { nome: "Taxa de Conversão", atual: a.taxa_conversao, meta: m.taxa_conversao, fmt: fmtConv,
      status: statusConv(a.taxa_conversao) },
    { nome: "Sessões Totais", atual: a.sessoes_totais, meta: m.sessoes_totais, fmt: fmtNum,
      status: statusGreater(a.sessoes_totais, m.sessoes_totais) },
    { nome: "Investimento Total", atual: a.investimento_total, meta: m.investimento_total, fmt: fmtBRL,
      status: statusLess(a.investimento_total, m.investimento_total, 0.1) },
    { nome: "ROAS Faturado", atual: a.roas_faturado, meta: m.roas_faturado, fmt: fmtRoas,
      status: statusRoas(a.roas_faturado) },
    { nome: "CAC Novos", atual: a.cac_novos, meta: m.cac_novos, fmt: fmtBRL,
      status: statusLess(a.cac_novos, m.cac_novos, 0.2) },
  ];

  return (
    <Card style={{ borderColor: "#E8CD7E" }}>
      <CardHeader><CardTitle className="font-serif text-lg">9 Pilares do Planejamento</CardTitle></CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead style={{ background: "#1D1D1B", color: "#E8CD7E" }}>
            <tr>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">Pilar</th>
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wider">Atual</th>
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wider">{metaLabel}</th>
              <th className="px-3 py-2 text-center text-xs uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {pilares.map((p, i) => (
              <tr key={p.nome} className={i % 2 ? "bg-[#FAF8F3]" : "bg-white"}>
                <td className="px-3 py-2 font-medium">{p.nome}</td>
                <td className="px-3 py-2 text-right">{p.fmt(p.atual as any)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{p.fmt(p.meta as any)}</td>
                <td className="px-3 py-2 text-center text-base">{dot(p.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {footnote && <p className="text-[11px] text-muted-foreground px-3 py-2">{footnote}</p>}
      </CardContent>
    </Card>
  );
}

export default function PlanejamentoMensal() {
  const [search, setSearch] = useSearchParams();
  const now = new Date();
  const [ano, setAno] = useState(Number(search.get("ano")) || now.getFullYear());
  const [mes, setMes] = useState(Number(search.get("mes")) || now.getMonth() + 1);
  const [tipo, setTipo] = useState<"planejado" | "realizado">((search.get("tipo") as any) || "planejado");

  const { data, isLoading, isSaving, salvarCamposManuais, aprovarMes } = usePlanejamentoMensal(ano, mes, tipo);
  const [form, setForm] = useState<Manual>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm({
      receita_captada: data?.receita_captada ?? null,
      taxa_aprovacao: data?.taxa_aprovacao ?? null,
      pedidos_captados: data?.pedidos_captados ?? null,
      taxa_aquisicao: data?.taxa_aquisicao ?? null,
      sessoes_totais: data?.sessoes_totais ?? null,
      sessoes_midia: data?.sessoes_midia ?? null,
      investimento_total: data?.investimento_total ?? null,
    });
    setDirty(false);
  }, [data]);

  // Preview local dos cálculos (apenas exibição enquanto edita)
  const preview = useMemo(() => {
    const rc = form.receita_captada ?? 0;
    const ta = form.taxa_aprovacao ?? 0;
    const pc = form.pedidos_captados ?? 0;
    const tq = form.taxa_aquisicao ?? 0;
    const st = form.sessoes_totais ?? 0;
    const sm = form.sessoes_midia ?? 0;
    const it = form.investimento_total ?? 0;
    const rf = rc * ta / 100;
    const pf = pc * ta / 100;
    const pa = pf * tq / 100;
    const ra = rf * tq / 100;
    const pr = pf - pa;
    const rr = rc - ra;
    return {
      receita_faturada: rf,
      receita_cancelada: rc - rf,
      pedidos_faturados: pf,
      pedidos_aquisicao: pa, receita_aquisicao: ra,
      pedidos_retencao: pr, receita_retencao: rr,
      taxa_retencao: 100 - tq,
      taxa_conversao: st > 0 ? (pc / st) * 100 : null,
      ticket_medio_aquisicao: pa > 0 ? ra / pa : null,
      ticket_medio_retencao: pr > 0 ? rr / pr : null,
      ticket_medio_geral: pf > 0 ? rf / pf : null,
      cps_geral: st > 0 ? it / st : null,
      cps_midia: sm > 0 ? it / sm : null,
      cac_novos: pa > 0 ? it / pa : null,
      cac_geral: pf > 0 ? it / pf : null,
      roas_faturado: it > 0 ? rf / it : null,
      adcost_pct: rf > 0 ? it / rf * 100 : null,
    };
  }, [form]);

  const setField = (k: keyof Manual, v: number | null) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const navMes = (delta: number) => {
    let m = mes + delta, a = ano;
    if (m > 12) { m = 1; a++; } else if (m < 1) { m = 12; a--; }
    setMes(m); setAno(a);
    setSearch({ ano: String(a), mes: String(m), tipo });
  };

  const switchTipo = (t: "planejado" | "realizado") => {
    setTipo(t);
    setSearch({ ano: String(ano), mes: String(mes), tipo: t });
  };

  const salvar = () => salvarCamposManuais(form as any);

  // Red flags baseado nos dados persistidos
  const flags = useMemo(() => {
    if (!data) return [];
    const f: string[] = [];
    if ((data.roas_faturado ?? 99) < 2.5) f.push("ROAS abaixo do mínimo");
    if ((data.taxa_aprovacao ?? 99) < 85) f.push("Aprovação baixa — audite gateway");
    if ((data.taxa_retencao ?? 99) < 30) f.push("Retenção fraca — ative régua CRM");
    if ((data.cps_midia ?? 0) > 1.30) f.push("CPS alto — refresh criativos");
    const ta = data.ticket_medio_aquisicao, tr = data.ticket_medio_retencao;
    if (ta && tr && ta < tr * 0.7) f.push("Novos comprando menos");
    return f;
  }, [data]);

  // Histórico (últimos 6 meses realizados)
  const [historico, setHistorico] = useState<PM[]>([]);
  // Registro planejado do mês atual (usado como Meta nos 9 pilares e na tabela)
  const [planejadoMes, setPlanejadoMes] = useState<PM | null>(null);
  // Registro realizado do mês atual (para preencher coluna ATUAL quando tipo='planejado')
  const [realizadoMes, setRealizadoMes] = useState<PM | null>(null);

  useEffect(() => {
    (async () => {
      const { data: rows } = await (supabase as any)
        .from("planejamento_mensal")
        .select("*")
        .eq("tipo", "realizado")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(6);
      setHistorico(((rows as PM[]) ?? []).reverse());
    })();
  }, [data]);

  useEffect(() => {
    (async () => {
      const [{ data: pln }, { data: rea }] = await Promise.all([
        (supabase as any).from("planejamento_mensal").select("*")
          .eq("ano", ano).eq("mes", mes).eq("tipo", "planejado").maybeSingle(),
        (supabase as any).from("planejamento_mensal").select("*")
          .eq("ano", ano).eq("mes", mes).eq("tipo", "realizado").maybeSingle(),
      ]);
      setPlanejadoMes((pln as PM) ?? null);
      setRealizadoMes((rea as PM) ?? null);
    })();
  }, [ano, mes, data]);

  // Média histórica baseada nos últimos meses realizados carregados
  const histAvgFor = (k: keyof PM): number | null => {
    const xs = historico
      .map((r) => r[k] as number | null)
      .filter((v): v is number => v != null && isFinite(v));
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };

  // Para campos do planejado: usa o valor salvo; se null, tenta derivar das fórmulas
  const planejadoVal = (k: keyof PM): number | null => {
    if (!planejadoMes) return null;
    const v = planejadoMes[k] as number | null;
    if (v != null && isFinite(v as number)) return v as number;
    const it = planejadoMes.investimento_total ?? null;
    const rf = planejadoMes.receita_faturada ?? null;
    const pa = planejadoMes.pedidos_aquisicao ?? null;
    const pc = planejadoMes.pedidos_captados ?? null;
    const st = planejadoMes.sessoes_totais ?? null;
    if (k === "roas_faturado" && rf && it) return rf / it;
    if (k === "cac_novos" && it && pa) return it / pa;
    if (k === "taxa_conversao" && pc && st) return (pc / st) * 100;
    return null;
  };

  const PILAR_KEYS: (keyof PM)[] = [
    "receita_captada", "taxa_aprovacao", "pedidos_captados", "taxa_aquisicao",
    "taxa_conversao", "sessoes_totais", "investimento_total", "roas_faturado", "cac_novos",
  ];

  const pilaresAtual: Partial<PM> = tipo === "realizado"
    ? ((realizadoMes ?? data ?? {}) as Partial<PM>)
    : ((data ?? planejadoMes ?? {}) as Partial<PM>);

  const pilaresMeta: Partial<Record<keyof PM, number | null>> = {};
  if (tipo === "realizado") {
    for (const k of PILAR_KEYS) pilaresMeta[k] = planejadoVal(k) ?? histAvgFor(k);
  } else {
    for (const k of PILAR_KEYS) pilaresMeta[k] = histAvgFor(k);
  }
  const metaLabel = tipo === "realizado" ? "Meta" : "Média Histórica";
  const metaFootnote = tipo === "realizado"
    ? "Meta = registro planejado do mês (fallback: média dos realizados anteriores)."
    : "Média histórica calculada a partir dos últimos meses realizados.";


  if (isLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-12 w-72" /><div className="grid lg:grid-cols-2 gap-6"><Skeleton className="h-[600px]" /><Skeleton className="h-[600px]" /></div></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-serif text-[#1D1D1B]">Planejamento Mensal</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navMes(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="px-4 py-2 border rounded-md min-w-[160px] text-center font-medium" style={{ borderColor: "#F5E9B8" }}>
              {MESES[mes - 1]} {ano}
            </div>
            <Button variant="outline" size="icon" onClick={() => navMes(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex rounded-md overflow-hidden border" style={{ borderColor: "#E8CD7E" }}>
            {(["planejado", "realizado"] as const).map((t) => (
              <button key={t} onClick={() => switchTipo(t)}
                className={`px-4 py-2 text-xs uppercase tracking-wider transition ${tipo === t ? "bg-[#1D1D1B] text-[#E8CD7E]" : "bg-white text-[#1D1D1B] hover:bg-[#FAF8F3]"}`}>
                {t}
              </button>
            ))}
          </div>
          {data && <StatusBadge s={data.status} />}
          {data?.status === "rascunho" && <Button onClick={aprovarMes} style={{ background: "#E8CD7E", color: "#1D1D1B" }}>Aprovar Mês</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLUNA ESQUERDA — FORM */}
        <div className="space-y-4">
          <Card style={{ borderColor: "#F5E9B8" }}>
            <CardHeader><CardTitle className="font-serif text-lg">Receita</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <NumInput label="Receita Captada" suffix="R$" value={form.receita_captada} onChange={(v) => setField("receita_captada", v)} disabled={isSaving} />
              <NumInput label="Taxa de Aprovação" suffix="%" value={form.taxa_aprovacao} onChange={(v) => setField("taxa_aprovacao", v)} disabled={isSaving} />
              <CalcField label="Receita Faturada = Captada × Aprovação%" value={preview.receita_faturada} format="brl" />
              <CalcField label="Receita Cancelada = Captada − Faturada" value={preview.receita_cancelada} format="brl" />
            </CardContent>
          </Card>

          <Card style={{ borderColor: "#F5E9B8" }}>
            <CardHeader><CardTitle className="font-serif text-lg">Pedidos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <NumInput label="Pedidos Captados" value={form.pedidos_captados} onChange={(v) => setField("pedidos_captados", v)} disabled={isSaving} />
              <CalcField label="Pedidos Faturados = Captados × Aprovação%" value={preview.pedidos_faturados} />
            </CardContent>
          </Card>

          <Card style={{ borderColor: "#F5E9B8" }}>
            <CardHeader><CardTitle className="font-serif text-lg">Aquisição vs Retenção</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <NumInput label="Taxa de Aquisição" suffix="%" value={form.taxa_aquisicao} onChange={(v) => setField("taxa_aquisicao", v)} disabled={isSaving} />
              <CalcField label="Taxa de Retenção = 100 − Aquisição" value={preview.taxa_retencao} format="pct" />
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-2">Aquisição</div>
              <div className="grid grid-cols-2 gap-2">
                <CalcField label="Pedidos Aquisição" value={preview.pedidos_aquisicao} />
                <CalcField label="Receita Aquisição" value={preview.receita_aquisicao} format="brl" />
              </div>
              <CalcField label="Ticket Médio Aquisição" value={preview.ticket_medio_aquisicao} format="brl" />
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-2">Retenção</div>
              <div className="grid grid-cols-2 gap-2">
                <CalcField label="Pedidos Retenção" value={preview.pedidos_retencao} />
                <CalcField label="Receita Retenção" value={preview.receita_retencao} format="brl" />
              </div>
              <CalcField label="Ticket Médio Retenção" value={preview.ticket_medio_retencao} format="brl" />
            </CardContent>
          </Card>

          <Card style={{ borderColor: "#F5E9B8" }}>
            <CardHeader><CardTitle className="font-serif text-lg">Tráfego & Investimento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <NumInput label="Sessões Totais" value={form.sessoes_totais} onChange={(v) => setField("sessoes_totais", v)} disabled={isSaving} />
              <NumInput label="Sessões Mídia" value={form.sessoes_midia} onChange={(v) => setField("sessoes_midia", v)} disabled={isSaving} />
              <CalcField label="Taxa de Conversão = Pedidos Captados / Sessões × 100" value={preview.taxa_conversao} format="pct" />
              <NumInput label="Investimento Total" suffix="R$" value={form.investimento_total} onChange={(v) => setField("investimento_total", v)} disabled={isSaving} />
              <div className="grid grid-cols-2 gap-2">
                <CalcField label="CPS Geral" value={preview.cps_geral} format="brl" />
                <CalcField label="CPS Mídia" value={preview.cps_midia} format="brl" />
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-2 pt-2">
            <Button onClick={salvar} disabled={!dirty || isSaving}
              className="w-full" style={{ background: "#1D1D1B", color: "#E8CD7E" }}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        {/* COLUNA DIREITA — RESULTADOS */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Receita Faturada", value: fmtBRL(data?.receita_faturada) },
              { label: "ROAS Faturado", custom: <RoasBadge v={data?.roas_faturado} /> },
              { label: "CAC Novos", value: fmtBRL(data?.cac_novos) },
              { label: "AdCost %", value: fmtPct(data?.adcost_pct) },
            ].map((k, i) => (
              <Card key={i} style={{ background: "#1D1D1B", borderColor: "#1D1D1B" }}>
                <CardContent className="p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#E8CD7E]/70">{k.label}</div>
                  <div className="text-2xl font-serif mt-1 text-[#E8CD7E]">
                    {k.custom ?? k.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <NovePilaresCard atualData={pilaresAtual} metaValues={pilaresMeta} metaLabel={metaLabel} footnote={metaFootnote} />


          <Card style={{ borderColor: "#F5E9B8" }}>
            <CardHeader><CardTitle className="font-serif text-lg">Eficiência</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">CAC Geral</div><div className="font-semibold">{fmtBRL(data?.cac_geral)}</div></div>
                <div><div className="text-xs text-muted-foreground">CAC Novos</div><div className="font-semibold">{fmtBRL(data?.cac_novos)}</div></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><div className="text-xs text-muted-foreground">Ticket Geral</div><div className="font-semibold">{fmtBRL(data?.ticket_medio_geral)}</div></div>
                <div><div className="text-xs text-muted-foreground">Ticket Aquisição</div><div className="font-semibold">{fmtBRL(data?.ticket_medio_aquisicao)}</div></div>
                <div><div className="text-xs text-muted-foreground">Ticket Retenção</div><div className="font-semibold">{fmtBRL(data?.ticket_medio_retencao)}</div></div>
              </div>
              {(() => {
                const st = data?.sessoes_totais ?? 0;
                const sm = data?.sessoes_midia ?? 0;
                const pct = st > 0 ? (sm / st) * 100 : 0;
                return (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Sessões Mídia vs Orgânicas</div>
                    <div className="h-3 rounded-full overflow-hidden flex" style={{ background: "#FAF6EE" }}>
                      <div style={{ width: `${pct}%`, background: "#E8CD7E" }} />
                      <div style={{ width: `${100 - pct}%`, background: "#8B6914" }} />
                    </div>
                    <div className="flex justify-between text-[10px] mt-1 text-muted-foreground">
                      <span>Mídia {pct.toFixed(0)}%</span><span>Orgânico {(100 - pct).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card style={{ borderColor: "#F5E9B8" }}>
            <CardHeader><CardTitle className="font-serif text-lg">Cascata Visual</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Sessões Totais</span><strong>{fmtNum(data?.sessoes_totais)}</strong></div>
              <div className="text-[10px] text-center text-muted-foreground">↓ conversão {data?.sessoes_totais && data?.pedidos_captados ? ((data.pedidos_captados / data.sessoes_totais) * 100).toFixed(2) + "%" : "—"}</div>
              <div className="flex justify-between"><span>Pedidos Captados</span><strong>{fmtNum(data?.pedidos_captados)}</strong></div>
              <div className="text-[10px] text-center text-muted-foreground">↓ aprovação {fmtPct(data?.taxa_aprovacao)}</div>
              <div className="flex justify-between"><span>Pedidos Faturados</span><strong>{fmtNum(data?.pedidos_faturados)}</strong></div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="rounded p-2" style={{ background: "#FAF6EE" }}>
                  <div className="text-[10px] uppercase text-muted-foreground">Novos</div>
                  <div className="text-xs"><strong>{fmtNum(data?.pedidos_aquisicao)}</strong> ped | {fmtBRL(data?.receita_aquisicao)}</div>
                </div>
                <div className="rounded p-2" style={{ background: "#FAF6EE" }}>
                  <div className="text-[10px] uppercase text-muted-foreground">Recorrentes</div>
                  <div className="text-xs"><strong>{fmtNum(data?.pedidos_retencao)}</strong> ped | {fmtBRL(data?.receita_retencao)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card style={{ borderColor: flags.length ? "#FFE8E5" : "#D4F5DE" }}>
            <CardHeader><CardTitle className="font-serif text-lg flex items-center gap-2">
              {flags.length ? <AlertTriangle className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              Red Flags
            </CardTitle></CardHeader>
            <CardContent>
              {flags.length === 0 ? (
                <p className="text-sm text-emerald-700">Todos os indicadores saudáveis 💛</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {flags.map((f, i) => <li key={i} className="flex gap-2"><span className="text-rose-600">•</span>{f}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* HISTÓRICO — KPIs nas linhas, meses nas colunas */}
      <Card style={{ borderColor: "#F5E9B8" }}>
        <CardHeader>
          <CardTitle className="font-serif text-lg">
            Histórico — Últimos 6 Meses Realizados ({historico.length} {historico.length === 1 ? "mês" : "meses"})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Nenhum mês realizado registrado ainda</p>
          ) : (() => {
            type Row = {
              key: keyof PM;
              label: string;
              fmt: (v: number | null | undefined) => string;
              lowerIsBetter?: boolean;
            };
            type Group = { label: string; rows: Row[]; bg?: string };
            const fmtRoas = (v: number | null | undefined) => v == null || !isFinite(v) ? "—" : v.toFixed(2) + "x";

            const groups: Group[] = [
              { label: "Receitas", bg: "#FBF7EC", rows: [
                { key: "receita_captada", label: "Receita Captada", fmt: fmtBRL },
                { key: "receita_faturada", label: "Receita Faturada", fmt: fmtBRL },
                { key: "receita_cancelada", label: "Receita Cancelada", fmt: fmtBRL, lowerIsBetter: true },
              ]},
              { label: "Pedidos", rows: [
                { key: "pedidos_captados", label: "Pedidos Captados", fmt: (v) => fmtNum(v) },
                { key: "pedidos_faturados", label: "Pedidos Faturados", fmt: (v) => fmtNum(v) },
              ]},
              { label: "Taxas", bg: "#FBF7EC", rows: [
                { key: "taxa_aprovacao", label: "Tx. Aprovação", fmt: fmtPct },
                { key: "taxa_aquisicao", label: "Tx. Aquisição", fmt: fmtPct, lowerIsBetter: true },
                { key: "taxa_retencao", label: "Tx. Retenção", fmt: fmtPct },
                { key: "taxa_conversao", label: "Tx. Conversão", fmt: fmtPct },
              ]},
              { label: "Tráfego", rows: [
                { key: "sessoes_totais", label: "Sessões Totais", fmt: (v) => fmtNum(v) },
                { key: "sessoes_midia", label: "Sessões Mídia", fmt: (v) => fmtNum(v) },
              ]},
              { label: "Investimento & Eficiência", bg: "#FBF7EC", rows: [
                { key: "investimento_total", label: "Invest. Total", fmt: fmtBRL, lowerIsBetter: true },
                { key: "cps_geral", label: "CPS Geral", fmt: fmtBRL, lowerIsBetter: true },
                { key: "cps_midia", label: "CPS Mídia", fmt: fmtBRL, lowerIsBetter: true },
                { key: "cac_novos", label: "CAC Novos", fmt: fmtBRL, lowerIsBetter: true },
                { key: "cac_geral", label: "CAC Geral", fmt: fmtBRL, lowerIsBetter: true },
              ]},
              { label: "Resultados", rows: [
                { key: "roas_faturado", label: "ROAS Faturado", fmt: fmtRoas },
                { key: "adcost_pct", label: "AdCost %", fmt: fmtPct, lowerIsBetter: true },
                { key: "ticket_medio_geral", label: "Ticket Geral", fmt: fmtBRL },
                { key: "ticket_medio_aquisicao", label: "Ticket Aquisição", fmt: fmtBRL },
                { key: "ticket_medio_retencao", label: "Ticket Retenção", fmt: fmtBRL },
                { key: "peso_mes_pct", label: "Peso do Mês %", fmt: fmtPct },
              ]},
            ];

            const avg = (k: keyof PM) => {
              const xs = historico.map((r) => r[k] as number | null).filter((v): v is number => v != null && isFinite(v));
              return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
            };

            const stickyKpiBase: React.CSSProperties = {
              position: "sticky", left: 0, zIndex: 2, minWidth: 180,
            };
            const cellPad = "10px 14px";
            const headPad = "12px 14px";
            const monthIsCurrent = (m: PM) => m.ano === ano && m.mes === mes;
            const totalCols = 1 + historico.length + 2; // KPI + meses + Média + Meta

            return (
              <div className="overflow-auto max-h-[640px]" style={{ borderTop: "1px solid #F5E9B8" }}>
                <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 5 }}>
                    <tr style={{ background: "#1D1D1B", color: "#E8CD7E" }}>
                      <th className="text-left uppercase whitespace-nowrap"
                          style={{ ...stickyKpiBase, background: "#1D1D1B", zIndex: 6, padding: headPad, letterSpacing: 1 }}>
                        KPI / Métrica
                      </th>
                      {historico.map((m) => (
                        <th key={m.id}
                            className="text-right uppercase whitespace-nowrap"
                            style={{
                              padding: headPad, letterSpacing: 1, minWidth: 110, width: 110,
                              borderLeft: monthIsCurrent(m) ? "2px solid #E8CD7E" : undefined,
                              borderRight: monthIsCurrent(m) ? "2px solid #E8CD7E" : undefined,
                            }}>
                          {MESES[m.mes - 1].slice(0, 3)}/{String(m.ano).slice(-2)}
                        </th>
                      ))}
                      <th className="text-right uppercase whitespace-nowrap"
                          style={{ padding: headPad, letterSpacing: 1, minWidth: 110, background: "#FAF6EE", color: "#1D1D1B" }}>
                        Média
                      </th>
                      <th className="text-right uppercase whitespace-nowrap"
                          style={{ padding: headPad, letterSpacing: 1, minWidth: 110, background: "#FFF8E8", color: "#8B6914" }}>
                        Meta Planejada
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g, gi) => (
                      <>
                        <tr key={`g-${gi}`}>
                          <td colSpan={totalCols}
                              style={{
                                background: "#1D1D1B", color: "#E8CD7E",
                                padding: "4px 14px", fontSize: 10,
                                textTransform: "uppercase", letterSpacing: 1, fontWeight: 600,
                              }}>
                            {g.label}
                          </td>
                        </tr>
                        {g.rows.map((r, ri) => {
                          const rowBg = g.bg ?? (ri % 2 ? "#FAF8F3" : "#FFFFFF");
                          const mediaVal = avg(r.key);
                          const metaVal = planejadoMes ? planejadoVal(r.key) : null;
                          return (
                            <tr key={r.key as string} style={{ background: rowBg, minHeight: 44 }}>
                              <td className="font-medium whitespace-nowrap"
                                  style={{ ...stickyKpiBase, background: rowBg, padding: cellPad }}>
                                {r.label}
                              </td>
                              {historico.map((m, mi) => {
                                const v = m[r.key] as number | null;
                                const pv = mi > 0 ? (historico[mi - 1][r.key] as number | null) : null;
                                const cur = monthIsCurrent(m);
                                return (
                                  <td key={m.id} className="text-right whitespace-nowrap"
                                      style={{
                                        padding: cellPad,
                                        borderLeft: cur ? "2px solid #E8CD7E" : undefined,
                                        borderRight: cur ? "2px solid #E8CD7E" : undefined,
                                      }}>
                                    <span>{r.fmt(v)}</span>
                                    <span style={{ fontSize: 11, marginLeft: 4 }}>
                                      <Trend cur={v} prev={pv} lowerIsBetter={r.lowerIsBetter} />
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="text-right whitespace-nowrap"
                                  style={{ padding: cellPad, background: "#FAF6EE", fontWeight: 700 }}>
                                {r.fmt(mediaVal)}
                              </td>
                              <td className="text-right whitespace-nowrap"
                                  style={{ padding: cellPad, background: "#FFF8E8", color: "#8B6914", fontWeight: 600 }}>
                                {r.fmt(metaVal)}
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
