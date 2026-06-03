import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PlanejamentoMensal as PM, MESES, fmtBRL, fmtNum, fmtPct } from "@/hooks/usePlanejamentoMensal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const avgOf = (rows: PM[], k: keyof PM) => {
  const xs = rows.map((r) => r[k] as number | null).filter((v): v is number => v != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};

export default function PlanejamentoAnual() {
  const navigate = useNavigate();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<PM[]>([]);
  const [loading, setLoading] = useState(true);

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

  const realizados = useMemo(() => rows.filter((r) => r.tipo === "realizado"), [rows]);
  const planejados = useMemo(() => rows.filter((r) => r.tipo === "planejado"), [rows]);

  const kpis = useMemo(() => {
    const totalRec = rows.reduce((s, r) => s + (r.receita_faturada ?? 0), 0);
    const totalPed = rows.reduce((s, r) => s + (r.pedidos_faturados ?? 0), 0);
    return {
      receita: totalRec,
      roas: avgOf(rows, "roas_faturado"),
      cac: avgOf(rows, "cac_novos"),
      pedidos: totalPed,
    };
  }, [rows]);

  const maxRec = useMemo(() => Math.max(1, ...rows.map((r) => r.receita_faturada ?? 0)), [rows]);

  const calib = useMemo(() => ({
    roas: avgOf(realizados, "roas_faturado"),
    cac: avgOf(realizados, "cac_novos"),
    retencao: avgOf(realizados, "taxa_retencao"),
    ticket: avgOf(realizados, "ticket_medio_geral"),
    meses: realizados.map((r) => MESES[r.mes - 1].slice(0, 3)).join(", "),
  }), [realizados]);

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-12 w-72" /><Skeleton className="h-96" /></div>;

  // Agrega por mês para gráfico (planejado + realizado)
  const byMonth: Record<number, { plan?: PM; real?: PM }> = {};
  for (const r of rows) {
    byMonth[r.mes] = byMonth[r.mes] ?? {};
    if (r.tipo === "planejado") byMonth[r.mes].plan = r;
    else byMonth[r.mes].real = r;
  }

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
        {[
          { l: "Receita Faturada Total", v: fmtBRL(kpis.receita) },
          { l: "ROAS Médio", v: kpis.roas != null ? `${kpis.roas.toFixed(2)}x` : "—" },
          { l: "CAC Novos Médio", v: fmtBRL(kpis.cac) },
          { l: "Pedidos Faturados Total", v: fmtNum(kpis.pedidos) },
        ].map((k, i) => (
          <Card key={i} style={{ background: "#1D1D1B", borderColor: "#1D1D1B" }}>
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-[#E8CD7E]/70">{k.l}</div>
              <div className="text-2xl font-serif mt-1 text-[#E8CD7E]">{k.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico */}
      <Card style={{ borderColor: "#F5E9B8" }}>
        <CardHeader><CardTitle className="font-serif text-lg">Receita Faturada por mês</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-56">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const real = byMonth[m]?.real?.receita_faturada ?? 0;
              const plan = byMonth[m]?.plan?.receita_faturada ?? 0;
              return (
                <div key={m} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-0.5 h-full">
                    {plan > 0 && (
                      <div title={`Planejado: ${fmtBRL(plan)}`} style={{ width: "45%", height: `${(plan / maxRec) * 100}%`, border: "1.5px solid #E8CD7E", background: "transparent" }} />
                    )}
                    {real > 0 && (
                      <div title={`Realizado: ${fmtBRL(real)}`} style={{ width: "45%", height: `${(real / maxRec) * 100}%`, background: "#E8CD7E" }} />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{MESES[m - 1].slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-[#E8CD7E]" /> Realizado</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 border border-[#E8CD7E]" /> Planejado</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card style={{ borderColor: "#F5E9B8" }}>
        <CardHeader><CardTitle className="font-serif text-lg">Tabela Anual</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#1D1D1B", color: "#E8CD7E" }}>
              <tr>
                {["Mês","Tipo","Status","Rec.Captada","Rec.Faturada","ROAS","CAC Novos","Taxa Ret.","Ticket Geral","Invest.Total","Peso%"].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (<tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Sem dados em {ano}</td></tr>)}
              {rows.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/planejamento/mensal?ano=${r.ano}&mes=${r.mes}&tipo=${r.tipo}`)}
                  className="cursor-pointer hover:opacity-80"
                  style={{ background: r.tipo === "realizado" ? "#F0FAF4" : "white" }}>
                  <td className="px-2 py-2 font-medium">{MESES[r.mes - 1]}</td>
                  <td className="px-2 py-2"><Badge style={{ background: r.tipo === "realizado" ? "#D4F5DE" : "#E5E5E5", color: r.tipo === "realizado" ? "#2D7D46" : "#444" }}>{r.tipo}</Badge></td>
                  <td className="px-2 py-2 text-xs">{r.status}</td>
                  <td className="px-2 py-2">{fmtBRL(r.receita_captada)}</td>
                  <td className="px-2 py-2">{fmtBRL(r.receita_faturada)}</td>
                  <td className="px-2 py-2">{r.roas_faturado != null ? `${r.roas_faturado.toFixed(2)}x` : "—"}</td>
                  <td className="px-2 py-2">{fmtBRL(r.cac_novos)}</td>
                  <td className="px-2 py-2">{fmtPct(r.taxa_retencao)}</td>
                  <td className="px-2 py-2">{fmtBRL(r.ticket_medio_geral)}</td>
                  <td className="px-2 py-2">{fmtBRL(r.investimento_total)}</td>
                  <td className="px-2 py-2">{fmtPct(r.peso_mes_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Calibração */}
      <Card style={{ background: "#1D1D1B", borderColor: "#1D1D1B" }}>
        <CardHeader><CardTitle className="font-serif text-lg text-[#E8CD7E]">Calibração Histórica</CardTitle></CardHeader>
        <CardContent className="text-sm text-[#FAF8F3] space-y-1">
          {realizados.length === 0 ? (
            <p>Nenhum mês realizado registrado ainda.</p>
          ) : (
            <>
              <p className="text-[#E8CD7E]/80 mb-2">Com base em {calib.meses} {ano} (realizados):</p>
              <p>• ROAS médio realizado: <strong>{calib.roas != null ? calib.roas.toFixed(2) + "x" : "—"}</strong></p>
              <p>• CAC Novos médio: <strong>{fmtBRL(calib.cac)}</strong></p>
              <p>• Taxa de Retenção média: <strong>{fmtPct(calib.retencao)}</strong></p>
              <p>• Ticket Médio Geral: <strong>{fmtBRL(calib.ticket)}</strong></p>
              <p className="text-[#E8CD7E]/80 mt-2">Os meses planejados usam esses valores como referência.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
