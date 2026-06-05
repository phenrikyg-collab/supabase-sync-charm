import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PlanejamentoMensal as PM, MESES, fmtBRL, fmtNum, fmtPct } from "@/hooks/usePlanejamentoMensal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const GOLD = "#E8CD7E";
const DARK = "#1D1D1B";
const MUTED = "#6B6555";

const avgNonZero = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => x != null && x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const sum = (xs: (number | null | undefined)[]) =>
  xs.reduce((s: number, x) => s + (x ?? 0), 0);

const statusBadge = (st?: string) => {
  if (st === "fechado") return { bg: "#D4F5DE", fg: "#2D7D46" };
  if (st === "aprovado") return { bg: "#F5E9B8", fg: "#7A5C00" };
  return { bg: "#E5E5E5", fg: "#444" };
};

export default function PlanejamentoAnual() {
  const navigate = useNavigate();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<PM[]>([]);
  const [loading, setLoading] = useState(true);
  const hoje = new Date();
  const mesAtual = hoje.getFullYear() === ano ? hoje.getMonth() + 1 : 0;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("planejamento_mensal")
        .select("*")
        .eq("ano", ano)
        .order("mes", { ascending: true });
      setRows((data as PM[]) ?? []);
      setLoading(false);
    })();
  }, [ano]);

  const byMonth = useMemo(() => {
    const m: Record<number, { real?: PM; plan?: PM }> = {};
    for (const r of rows) {
      m[r.mes] = m[r.mes] ?? {};
      if (r.tipo === "realizado") m[r.mes].real = r;
      else m[r.mes].plan = r;
    }
    return m;
  }, [rows]);

  const realizados = useMemo(() => rows.filter((r) => r.tipo === "realizado"), [rows]);
  const planejados = useMemo(() => rows.filter((r) => r.tipo === "planejado"), [rows]);

  // KPIs anuais
  const realizadosValidos = realizados.filter(
    (r) => (r.receita_faturada ?? 0) > 0 && (r.investimento_total ?? 0) > 0
  );

  const recReal = sum(realizados.map((r) => r.receita_faturada));
  const recPlan = sum(planejados.map((r) => r.receita_faturada));
  const kpis = {
    receita: recReal + recPlan,
    receitaReal: recReal,
    receitaPlan: recPlan,
    roas: avgNonZero(realizadosValidos.map((r) => r.roas_faturado)),
    cac: avgNonZero(realizadosValidos.map((r) => r.cac_novos)),
    pedidos: sum(rows.map((r) => r.pedidos_faturados)),
  };

  // Sub-blocos
  const blocoReal = {
    receita: recReal,
    roas: avgNonZero(realizados.map((r) => r.roas_faturado)),
    cac: avgNonZero(realizados.map((r) => r.cac_novos)),
    label: realizados.length
      ? `${MESES[Math.min(...realizados.map((r) => r.mes)) - 1].slice(0, 3)}–${MESES[Math.max(...realizados.map((r) => r.mes)) - 1].slice(0, 3)}`
      : "—",
  };
  const blocoPlan = {
    receita: recPlan,
    roas: avgNonZero(planejados.map((r) => r.roas_faturado)),
    cac: avgNonZero(planejados.map((r) => r.cac_novos)),
    label: planejados.length
      ? `${MESES[Math.min(...planejados.map((r) => r.mes)) - 1].slice(0, 3)}–${MESES[Math.max(...planejados.map((r) => r.mes)) - 1].slice(0, 3)}`
      : "—",
  };

  // Calibração
  const recsReal = realizados.map((r) => r.receita_faturada ?? 0);
  const maiorIdx = recsReal.length ? recsReal.indexOf(Math.max(...recsReal)) : -1;
  const menorIdx = recsReal.length
    ? recsReal.indexOf(Math.min(...recsReal.filter((v) => v > 0).concat(recsReal[0] || 0)))
    : -1;
  const calib = {
    media: recsReal.length ? recReal / recsReal.length : 0,
    maior: maiorIdx >= 0 ? realizados[maiorIdx] : null,
    menor: menorIdx >= 0 ? realizados[menorIdx] : null,
    roas: avgNonZero(realizados.map((r) => r.roas_faturado)),
    cac: avgNonZero(realizados.map((r) => r.cac_novos)),
    adcost: avgNonZero(realizados.map((r) => r.adcost_pct)),
    aprov: avgNonZero(realizados.map((r) => r.taxa_aprovacao)),
    reten: avgNonZero(realizados.map((r) => r.taxa_retencao)),
    ticket: avgNonZero(realizados.map((r) => r.ticket_medio_geral)),
  };

  // Dados gráfico
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      mes: MESES[i].slice(0, 3),
      mesNum: m,
      Realizado: byMonth[m]?.real?.receita_faturada ?? 0,
      Planejado: byMonth[m]?.plan?.receita_faturada ?? 0,
    };
  });

  if (loading)
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96" />
      </div>
    );

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-serif text-[#1D1D1B]">Visão Anual {ano}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAno(ano - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="px-4 py-2 border rounded-md min-w-[100px] text-center font-medium" style={{ borderColor: "#F5E9B8" }}>{ano}</div>
          <Button variant="outline" size="icon" onClick={() => setAno(ano + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card style={{ background: DARK, borderColor: DARK }}>
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-[#E8CD7E]/70">Receita Faturada Total</div>
            <div className="text-2xl font-serif mt-1 text-[#E8CD7E]">{fmtBRL(kpis.receita)}</div>
            <div className="text-[10px] text-[#E8CD7E]/60 mt-1">
              {fmtBRL(kpis.receitaReal)} reais + {fmtBRL(kpis.receitaPlan)} planejados
            </div>
          </CardContent>
        </Card>
        <Card style={{ background: DARK, borderColor: DARK }}>
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-[#E8CD7E]/70">ROAS Médio (realizados)</div>
            <div className="text-2xl font-serif mt-1 text-[#E8CD7E]">
              {kpis.roas != null ? `${kpis.roas.toFixed(2)}x` : "—"}
            </div>
            {kpis.roas != null && (
              <Badge className="mt-2" style={{
                background: kpis.roas >= 3.5 ? "#2D7D46" : kpis.roas >= 2.5 ? "#B58900" : "#A1252C",
                color: "white",
              }}>
                {kpis.roas >= 3.5 ? "Ótimo" : kpis.roas >= 2.5 ? "Atenção" : "Crítico"}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card style={{ background: DARK, borderColor: DARK }}>
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-[#E8CD7E]/70">CAC Novos Médio (realizados)</div>
            <div className="text-2xl font-serif mt-1 text-[#E8CD7E]">{fmtBRL(kpis.cac)}</div>
          </CardContent>
        </Card>
        <Card style={{ background: DARK, borderColor: DARK }}>
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-[#E8CD7E]/70">Pedidos Faturados Total</div>
            <div className="text-2xl font-serif mt-1 text-[#E8CD7E]">{fmtNum(kpis.pedidos)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { titulo: `Realizados (${blocoReal.label})`, b: blocoReal, accent: "#2D7D46" },
          { titulo: `Planejados (${blocoPlan.label})`, b: blocoPlan, accent: "#8B6914" },
        ].map((c, i) => (
          <Card key={i} style={{ borderColor: "#F5E9B8" }}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wider font-medium" style={{ color: c.accent }}>{c.titulo}</div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm">
                <span>Receita: <strong>{fmtBRL(c.b.receita)}</strong></span>
                <span>ROAS médio: <strong>{c.b.roas != null ? `${c.b.roas.toFixed(2)}x` : "—"}</strong></span>
                <span>CAC médio: <strong>{fmtBRL(c.b.cac)}</strong></span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico */}
      <Card style={{ borderColor: "#F5E9B8" }}>
        <CardHeader><CardTitle className="font-serif text-lg">Receita Faturada por mês</CardTitle></CardHeader>
        <CardContent>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={MUTED} strokeOpacity={0.15} vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: MUTED, fontSize: 12 }} stroke={MUTED} />
                <YAxis
                  tick={{ fill: MUTED, fontSize: 12 }}
                  stroke={MUTED}
                  tickFormatter={(v: number) => `R$${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(v: any) => fmtBRL(Number(v))}
                  contentStyle={{ background: "white", border: `1px solid ${GOLD}` }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Realizado" fill={GOLD} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Planejado" fill={GOLD} fillOpacity={0.3} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Anual */}
      <Card style={{ borderColor: "#F5E9B8" }}>
        <CardHeader><CardTitle className="font-serif text-lg">Tabela Anual</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead style={{ background: DARK, color: GOLD }}>
              <tr>
                {[
                  "Mês", "Status",
                  "Rec.Cap.Real", "Rec.Fat.Real", "ROAS Real", "CAC Real", "Tx.Ret.Real", "Ticket Real", "Invest.Real",
                  "Rec.Fat.Plan", "ROAS Plan", "Invest.Plan",
                  "Desvio Rec", "Desvio ROAS", "Peso%",
                ].map((h) => (
                  <th key={h} className="px-2 py-2 text-left uppercase tracking-wider whitespace-nowrap text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={15} className="p-6 text-center text-muted-foreground">Sem dados em {ano}</td></tr>
              )}
              {Array.from({ length: 12 }, (_, i) => {
                const m = i + 1;
                const real = byMonth[m]?.real;
                const plan = byMonth[m]?.plan;
                if (!real && !plan) return null;
                const isAtual = m === mesAtual;
                const isFechado = real?.status === "fechado";
                const status = real?.status || plan?.status || "—";
                const sb = statusBadge(status);
                const realBg = isFechado ? "#F0FAF4" : "transparent";

                const desvioRec = real?.receita_faturada && plan?.receita_faturada
                  ? ((real.receita_faturada - plan.receita_faturada) / plan.receita_faturada) * 100
                  : null;
                const desvioRoas = real?.roas_faturado && plan?.roas_faturado
                  ? ((real.roas_faturado - plan.roas_faturado) / plan.roas_faturado) * 100
                  : null;
                const peso = real?.peso_mes_pct ?? plan?.peso_mes_pct;

                const ref = real || plan!;
                const showSep = m === 6 && realizados.some((r) => r.mes <= 5) && planejados.some((p) => p.mes >= 6);

                return (
                  <>
                    {showSep && (
                      <tr key={`sep-${m}`}>
                        <td colSpan={15} className="text-center text-[11px] uppercase tracking-widest text-muted-foreground py-2 border-y" style={{ background: "#FAF6E8" }}>
                          — Meses Futuros —
                        </td>
                      </tr>
                    )}
                    <tr
                      key={ref.id}
                      onClick={() => navigate(`/planejamento/mensal?ano=${ano}&mes=${m}&tipo=${real ? "realizado" : "planejado"}`)}
                      className="cursor-pointer hover:bg-[#FFFCEF] border-b"
                      style={{ borderLeft: isAtual ? `3px solid ${GOLD}` : "3px solid transparent" }}
                    >
                      <td className="px-2 py-2 font-medium whitespace-nowrap">{MESES[i].slice(0, 3)}</td>
                      <td className="px-2 py-2">
                        <Badge style={{ background: sb.bg, color: sb.fg }}>{status}</Badge>
                      </td>
                      <td className="px-2 py-2" style={{ background: realBg }}>{real ? fmtBRL(real.receita_captada) : "—"}</td>
                      <td className="px-2 py-2" style={{ background: realBg }}>{real ? fmtBRL(real.receita_faturada) : "—"}</td>
                      <td className="px-2 py-2" style={{ background: realBg }}>{real?.roas_faturado != null ? `${real.roas_faturado.toFixed(2)}x` : "—"}</td>
                      <td className="px-2 py-2" style={{ background: realBg }}>{real ? fmtBRL(real.cac_novos) : "—"}</td>
                      <td className="px-2 py-2" style={{ background: realBg }}>{real ? fmtPct(real.taxa_retencao) : "—"}</td>
                      <td className="px-2 py-2" style={{ background: realBg }}>{real ? fmtBRL(real.ticket_medio_geral) : "—"}</td>
                      <td className="px-2 py-2" style={{ background: realBg }}>{real ? fmtBRL(real.investimento_total) : "—"}</td>
                      <td className="px-2 py-2">{plan ? fmtBRL(plan.receita_faturada) : "—"}</td>
                      <td className="px-2 py-2">{plan?.roas_faturado != null ? `${plan.roas_faturado.toFixed(2)}x` : "—"}</td>
                      <td className="px-2 py-2">{plan ? fmtBRL(plan.investimento_total) : "—"}</td>
                      <td className="px-2 py-2 font-medium" style={{ color: desvioRec == null ? undefined : desvioRec >= 0 ? "#2D7D46" : "#A1252C" }}>
                        {desvioRec == null ? "—" : `${desvioRec >= 0 ? "+" : ""}${desvioRec.toFixed(1)}%`}
                      </td>
                      <td className="px-2 py-2 font-medium" style={{ color: desvioRoas == null ? undefined : desvioRoas >= 0 ? "#2D7D46" : "#A1252C" }}>
                        {desvioRoas == null ? "—" : `${desvioRoas >= 0 ? "+" : ""}${desvioRoas.toFixed(1)}%`}
                      </td>
                      <td className="px-2 py-2">{fmtPct(peso)}</td>
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Calibração Histórica */}
      <Card style={{ background: DARK, borderColor: DARK }}>
        <CardHeader>
          <CardTitle className="font-serif text-lg text-[#E8CD7E]">📊 Base Histórica Real — {blocoReal.label} {ano}</CardTitle>
          <p className="text-xs text-[#E8CD7E]/70 mt-1">Os meses planejados foram calibrados com estes valores reais</p>
        </CardHeader>
        <CardContent className="text-sm text-[#FAF8F3]">
          {realizados.length === 0 ? (
            <p>Nenhum mês realizado registrado ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <div className="text-[#E8CD7E] text-xs uppercase tracking-wider mb-1">Receita</div>
                <p>Média mensal: <strong>{fmtBRL(calib.media)}</strong></p>
                {calib.maior && <p>Maior mês: <strong>{MESES[calib.maior.mes - 1]} ({fmtBRL(calib.maior.receita_faturada)})</strong></p>}
                {calib.menor && <p>Menor mês: <strong>{MESES[calib.menor.mes - 1]} ({fmtBRL(calib.menor.receita_faturada)})</strong></p>}
              </div>
              <div className="space-y-1">
                <div className="text-[#E8CD7E] text-xs uppercase tracking-wider mb-1">Eficiência</div>
                <p>ROAS médio real: <strong>{calib.roas != null ? `${calib.roas.toFixed(2)}x` : "—"}</strong></p>
                <p>CAC Novos médio: <strong>{fmtBRL(calib.cac)}</strong></p>
                <p>AdCost médio: <strong>{calib.adcost != null ? `${calib.adcost.toFixed(1)}%` : "—"}</strong></p>
              </div>
              <div className="space-y-1">
                <div className="text-[#E8CD7E] text-xs uppercase tracking-wider mb-1">Operação</div>
                <p>Taxa aprovação média: <strong>{fmtPct(calib.aprov)}</strong></p>
                <p>Taxa retenção média: <strong>{fmtPct(calib.reten)}</strong></p>
                <p>Ticket médio: <strong>{fmtBRL(calib.ticket)}</strong></p>
              </div>
            </div>
          )}
          <p className="text-xs text-[#E8CD7E]/60 mt-4">Quanto mais meses realizados, mais precisa fica a calibração.</p>
        </CardContent>
      </Card>
    </div>
  );
}
