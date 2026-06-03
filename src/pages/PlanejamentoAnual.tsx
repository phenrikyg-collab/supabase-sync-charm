import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Drivers, calcularCascata, checkDriverFlags, identificarGargalo,
  DRIVER_LABELS, MESES, DEFAULT_DRIVERS, CascataResultado,
} from "@/hooks/usePlanejamentoCascata";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const ANO = 2026;
const DRIVER_KEYS: (keyof Drivers)[] = [
  "ticket_medio", "taxa_conversao", "retencao", "aprovacao",
  "cps_midia", "invest_midia", "invest_vip", "invest_imp", "sessoes_org",
];

interface DriverRow extends Drivers { id?: string; ano: number; mes: number; }

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (v: number) => Math.round(v).toLocaleString("pt-BR");
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function roasBadge(v: number) {
  if (v >= 4) return <Badge className="bg-success text-success-foreground">{v.toFixed(2)}x</Badge>;
  if (v >= 2.5) return <Badge className="bg-warning text-warning-foreground">{v.toFixed(2)}x</Badge>;
  return <Badge className="bg-destructive text-destructive-foreground">{v.toFixed(2)}x</Badge>;
}

function cellColor(driver: keyof Drivers, v: number) {
  if (driver === "retencao" && (v < 10 || v > 60)) return "bg-destructive/15";
  if (driver === "aprovacao" && v < 70) return "bg-destructive/15";
  if (driver === "aprovacao" && v < 80) return "bg-warning/20";
  if (driver === "cps_midia" && v > 1.2) return "bg-warning/20";
  return "";
}

export default function PlanejamentoAnual() {
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("planejamento_drivers" as any)
        .select("*")
        .eq("ano", ANO)
        .order("mes");
      if (error) {
        toast.error("Erro ao carregar dados. Tente novamente.");
        setLoading(false);
        return;
      }
      const map = new Map<number, DriverRow>();
      (data ?? []).forEach((r: any) => map.set(r.mes, r));
      const full: DriverRow[] = [];
      for (let m = 1; m <= 12; m++) {
        const r = map.get(m);
        full.push(r ? (r as DriverRow) : { ...DEFAULT_DRIVERS, ano: ANO, mes: m });
      }
      setRows(full);
      setLoading(false);
    })();
  }, []);

  const cascatas = useMemo(() => rows.map((r) => calcularCascata(r)), [rows]);

  const totals = useMemo(() => {
    const receita = cascatas.reduce((s, c) => s + c.receita_faturada, 0);
    const invest = cascatas.reduce((s, c) => s + c.invest_total, 0);
    const pedidos = cascatas.reduce((s, c) => s + c.pedidos_faturados, 0);
    const roas = invest > 0 ? receita / invest : 0;
    return { receita, invest, pedidos, roas };
  }, [cascatas]);

  const handleEdit = (mes: number, key: keyof Drivers, val: string) => {
    const num = Number(val.replace(",", "."));
    setRows((prev) => prev.map((r) => (r.mes === mes ? { ...r, [key]: isNaN(num) ? 0 : num } : r)));
    const dKey = `${mes}-${key}`;
    if (debounceRef.current[dKey]) clearTimeout(debounceRef.current[dKey]);
    debounceRef.current[dKey] = setTimeout(async () => {
      const row = rows.find((r) => r.mes === mes);
      if (!row) return;
      const payload: any = { ano: ANO, mes, ...DRIVER_KEYS.reduce((a, k) => ({ ...a, [k]: row[k] }), {}), [key]: isNaN(num) ? 0 : num };
      const { error } = await supabase.from("planejamento_drivers" as any).upsert(payload, { onConflict: "ano,mes" });
      if (error) toast.error("Erro ao salvar");
      else toast.success("Drivers salvos 💛", { duration: 2000 });
    }, 800);
  };

  const allFlags = useMemo(
    () => rows.flatMap((r, i) => checkDriverFlags(r, cascatas[i], r.mes)),
    [rows, cascatas]
  );

  const gargalo = useMemo(() => {
    // gargalo agregando média do ano
    if (rows.length === 0) return null;
    const avg: Drivers = DRIVER_KEYS.reduce((acc, k) => {
      (acc as any)[k] = rows.reduce((s, r) => s + (r[k] as number), 0) / rows.length;
      return acc;
    }, {} as Drivers);
    return identificarGargalo(avg);
  }, [rows]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-3xl font-serif text-foreground">Planejamento Estratégico — Visão Anual</h1>
        <p className="text-muted-foreground text-sm mt-1">Ano {ANO} · 9 drivers × 12 meses</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Receita Faturada Anual", val: fmtBRL(totals.receita), gold: true },
          { label: "Investimento Total Anual", val: fmtBRL(totals.invest) },
          { label: "ROAS Médio Anual", val: `${totals.roas.toFixed(2)}x` },
          { label: "Pedidos Faturados Anual", val: fmtNum(totals.pedidos) },
        ].map((k) => (
          <Card key={k.label} className="bg-sidebar-background text-sidebar-foreground border-sidebar-border">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wider text-sidebar-foreground/60">{k.label}</p>
              <p className={`text-2xl font-serif mt-2 ${k.gold ? "text-sidebar-primary" : "text-sidebar-foreground"}`}>{k.val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Drivers Table */}
      <Card>
        <CardHeader><CardTitle className="text-xl font-serif">Drivers — Editável</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-sidebar-background text-sidebar-foreground">
                <th className="sticky left-0 bg-sidebar-background px-3 py-2 text-left z-10">Driver</th>
                {MESES.map((m) => <th key={m} className="px-2 py-2 text-center min-w-[80px]">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {DRIVER_KEYS.map((k) => (
                <tr key={k} className="odd:bg-background even:bg-accent/40">
                  <td className="sticky left-0 px-3 py-2 font-medium bg-inherit z-10 whitespace-nowrap">
                    {DRIVER_LABELS[k].label} <span className="text-muted-foreground">({DRIVER_LABELS[k].unit})</span>
                  </td>
                  {rows.map((r) => (
                    <td key={r.mes} className={`px-1 py-1 ${cellColor(k, r[k] as number)}`}>
                      <Input
                        type="number"
                        step="0.01"
                        value={r[k] as number}
                        onChange={(e) => handleEdit(r.mes, k, e.target.value)}
                        className="h-8 text-xs text-center px-1"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Resultados Cascata */}
      <Card>
        <CardHeader><CardTitle className="text-xl font-serif">Resultados da Cascata</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-sidebar-background text-sidebar-foreground">
                <th className="sticky left-0 bg-sidebar-background px-3 py-2 text-left z-10">Métrica</th>
                {MESES.map((m) => <th key={m} className="px-2 py-2 text-center min-w-[90px]">{m}</th>)}
                <th className="px-2 py-2 text-center min-w-[100px]">TOTAL/MÉD.</th>
              </tr>
            </thead>
            <tbody>
              {([
                ["Invest. Total", (c: CascataResultado) => fmtBRL(c.invest_total), "sum"],
                ["Sessões Totais", (c: CascataResultado) => fmtNum(c.sessoes_totais), "sum"],
                ["Pedidos Captados", (c: CascataResultado) => fmtNum(c.pedidos_captados), "sum"],
                ["Pedidos Faturados", (c: CascataResultado) => fmtNum(c.pedidos_faturados), "sum"],
                ["Receita Captada", (c: CascataResultado) => fmtBRL(c.receita_captada), "sum"],
                ["Receita Faturada", (c: CascataResultado) => fmtBRL(c.receita_faturada), "sum", "gold"],
                ["Receita Cancelada", (c: CascataResultado) => fmtBRL(c.receita_cancelada), "sum", "danger"],
                ["CAC", (c: CascataResultado) => fmtBRL(c.cac), "avg"],
                ["ROAS Faturado", (c: CascataResultado) => roasBadge(c.roas_faturado), "avg"],
                ["AdCost %", (c: CascataResultado) => fmtPct(c.adcost_pct), "avg"],
              ] as const).map(([label, fn, agg, style]) => {
                let total: string | JSX.Element = "—";
                if (label === "ROAS Faturado") {
                  const inv = cascatas.reduce((s, c) => s + c.invest_total, 0);
                  const rec = cascatas.reduce((s, c) => s + c.receita_faturada, 0);
                  total = roasBadge(inv > 0 ? rec / inv : 0);
                } else if (agg === "sum") {
                  const t = cascatas.reduce((s, c) => s + Number((fn as any)(c).toString().replace(/[^\d.-]/g, "")) || 0, 0);
                  // recompute properly:
                  const numericMap: any = {
                    "Invest. Total": (c: CascataResultado) => c.invest_total,
                    "Sessões Totais": (c: CascataResultado) => c.sessoes_totais,
                    "Pedidos Captados": (c: CascataResultado) => c.pedidos_captados,
                    "Pedidos Faturados": (c: CascataResultado) => c.pedidos_faturados,
                    "Receita Captada": (c: CascataResultado) => c.receita_captada,
                    "Receita Faturada": (c: CascataResultado) => c.receita_faturada,
                    "Receita Cancelada": (c: CascataResultado) => c.receita_cancelada,
                  };
                  const sum = cascatas.reduce((s, c) => s + (numericMap[label]?.(c) ?? 0), 0);
                  total = label.includes("Sessões") || label.includes("Pedidos") ? fmtNum(sum) : fmtBRL(sum);
                  void t;
                } else if (agg === "avg") {
                  const numericMap: any = {
                    "CAC": (c: CascataResultado) => c.cac,
                    "AdCost %": (c: CascataResultado) => c.adcost_pct,
                  };
                  const avg = cascatas.reduce((s, c) => s + (numericMap[label]?.(c) ?? 0), 0) / cascatas.length;
                  total = label === "AdCost %" ? fmtPct(avg) : fmtBRL(avg);
                }
                return (
                  <tr key={label as string} className="odd:bg-background even:bg-accent/40 border-t">
                    <td className={`sticky left-0 px-3 py-2 bg-inherit z-10 whitespace-nowrap ${style === "gold" ? "font-bold text-primary" : style === "danger" ? "text-destructive" : ""}`}>{label}</td>
                    {cascatas.map((c, i) => (
                      <td key={i} className={`px-2 py-2 text-center ${style === "gold" ? "font-bold text-primary" : style === "danger" ? "text-destructive" : ""}`}>
                        {(fn as any)(c)}
                      </td>
                    ))}
                    <td className={`px-2 py-2 text-center font-semibold ${style === "gold" ? "text-primary" : ""}`}>{total}</td>
                  </tr>
                );
              })}
              {/* Peso */}
              <tr className="border-t bg-accent/30">
                <td className="sticky left-0 px-3 py-2 bg-inherit z-10 font-medium">Peso do Mês %</td>
                {cascatas.map((c, i) => {
                  const total = cascatas.reduce((s, x) => s + x.receita_faturada, 0);
                  const pct = total > 0 ? (c.receita_faturada / total) * 100 : 0;
                  return <td key={i} className="px-2 py-2 text-center">{pct.toFixed(1)}%</td>;
                })}
                <td className="px-2 py-2 text-center">100%</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Gráfico Receita */}
      <Card>
        <CardHeader><CardTitle className="text-xl font-serif">Receita Faturada por Mês</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-64">
            {cascatas.map((c, i) => {
              const max = Math.max(...cascatas.map((x) => x.receita_faturada), 1);
              const h = (c.receita_faturada / max) * 100;
              const total = cascatas.reduce((s, x) => s + x.receita_faturada, 0);
              const pct = total > 0 ? (c.receita_faturada / total) * 100 : 0;
              const isGold = i === 4 || i === 10 || i === 11;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                  <div
                    className={`w-full rounded-t ${isGold ? "bg-primary" : "bg-sidebar-background"}`}
                    style={{ height: `${h}%` }}
                    title={fmtBRL(c.receita_faturada)}
                  />
                  <span className="text-[10px] font-medium">{MESES[i]}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Red Flags */}
      <Card>
        <CardHeader><CardTitle className="text-xl font-serif">Red Flags</CardTitle></CardHeader>
        <CardContent>
          {allFlags.length === 0 ? (
            <p className="text-muted-foreground">Todos os drivers dentro das faixas saudáveis 💛</p>
          ) : (
            <div className="space-y-2">
              {allFlags.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-2 border rounded">
                  <Badge className={f.severity === "danger" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}>
                    {f.severity === "danger" ? "🔴" : "⚠️"} {MESES[(f.mes ?? 1) - 1]}
                  </Badge>
                  <span className="font-medium">{f.driver}</span>
                  <span className="text-sm text-muted-foreground">valor: {f.valor.toFixed(2)} · faixa: {f.faixa}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gargalo */}
      {gargalo && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-xl font-serif flex items-center gap-2">
              <Badge className="bg-destructive text-destructive-foreground">GARGALO</Badge>
              Driver Gargalo do Momento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-medium">{DRIVER_LABELS[gargalo.driver as keyof Drivers]?.label ?? gargalo.driver}</p>
            <p className="text-sm">Valor médio atual: <strong>{gargalo.valor.toFixed(2)}</strong> · Benchmark ideal: <strong>{gargalo.ideal}</strong></p>
            <p className="text-sm">Impacto estimado se corrigido: <strong className="text-primary">{fmtBRL(gargalo.impacto)}/mês</strong></p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
