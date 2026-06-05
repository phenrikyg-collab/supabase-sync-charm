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

function Trend({ cur, prev }: { cur: number | null; prev: number | null }) {
  if (cur == null || prev == null) return <Minus className="inline h-3 w-3 text-muted-foreground" />;
  if (cur > prev) return <ArrowUp className="inline h-3 w-3 text-emerald-600" />;
  if (cur < prev) return <ArrowDown className="inline h-3 w-3 text-rose-600" />;
  return <Minus className="inline h-3 w-3 text-muted-foreground" />;
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

      {/* HISTÓRICO */}
      <Card style={{ borderColor: "#F5E9B8" }}>
        <CardHeader><CardTitle className="font-serif text-lg">Histórico — Últimos 6 Meses Realizados</CardTitle></CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum mês realizado registrado ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#1D1D1B", color: "#E8CD7E" }}>
                  <tr>
                    {["Mês", "Rec. Faturada", "ROAS", "CAC Novos", "Taxa Ret.", "Ticket Geral", "AdCost"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historico.map((row, i) => {
                    const prev = historico[i - 1];
                    const atual = row.ano === ano && row.mes === mes;
                    return (
                      <tr key={row.id} className={i % 2 ? "bg-[#FAF8F3]" : "bg-white"}
                        style={atual ? { boxShadow: "inset 0 0 0 2px #E8CD7E" } : {}}>
                        <td className="px-3 py-2 font-medium">{MESES[row.mes - 1].slice(0, 3)}/{row.ano}</td>
                        <td className="px-3 py-2">{fmtBRL(row.receita_faturada)} <Trend cur={row.receita_faturada} prev={prev?.receita_faturada ?? null} /></td>
                        <td className="px-3 py-2"><RoasBadge v={row.roas_faturado} /></td>
                        <td className="px-3 py-2">{fmtBRL(row.cac_novos)} <Trend cur={row.cac_novos} prev={prev?.cac_novos ?? null} /></td>
                        <td className="px-3 py-2">{fmtPct(row.taxa_retencao)}</td>
                        <td className="px-3 py-2">{fmtBRL(row.ticket_medio_geral)}</td>
                        <td className="px-3 py-2">{fmtPct(row.adcost_pct)}</td>
                      </tr>
                    );
                  })}
                  {historico.length > 0 && (() => {
                    const avg = (k: keyof PM) => {
                      const xs = historico.map((r) => r[k] as number | null).filter((v): v is number => v != null);
                      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
                    };
                    return (
                      <tr style={{ background: "#FAF6EE", fontWeight: 600 }}>
                        <td className="px-3 py-2">Média</td>
                        <td className="px-3 py-2">{fmtBRL(avg("receita_faturada"))}</td>
                        <td className="px-3 py-2">{avg("roas_faturado") != null ? (avg("roas_faturado") as number).toFixed(2) + "x" : "—"}</td>
                        <td className="px-3 py-2">{fmtBRL(avg("cac_novos"))}</td>
                        <td className="px-3 py-2">{fmtPct(avg("taxa_retencao"))}</td>
                        <td className="px-3 py-2">{fmtBRL(avg("ticket_medio_geral"))}</td>
                        <td className="px-3 py-2">{fmtPct(avg("adcost_pct"))}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-2">Próximos meses planejados com base nessa média histórica.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
