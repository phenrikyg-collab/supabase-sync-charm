import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Drivers, calcularCascata, DRIVER_LABELS, DEFAULT_DRIVERS,
} from "@/hooks/usePlanejamentoCascata";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Trophy } from "lucide-react";
import { toast } from "sonner";

const ANO = 2026;
const DRIVER_KEYS: (keyof Drivers)[] = [
  "ticket_medio", "taxa_conversao", "retencao", "aprovacao",
  "cps_midia", "invest_midia", "invest_vip", "invest_imp", "sessoes_org",
];

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (v: number) => Math.round(v).toLocaleString("pt-BR");

interface Cenario { id?: string; nome: string; descricao: string; drivers: Drivers; }

const DEFAULT_CENARIOS = (base: Drivers): Cenario[] => [
  { nome: "Cenário A — Ticket +30", descricao: "Aumento de ticket médio para R$ 380", drivers: { ...base, ticket_medio: 380 } },
  { nome: "Cenário B — Conversão", descricao: "Conversão sobe para 2.4%", drivers: { ...base, taxa_conversao: 2.4 } },
  { nome: "Cenário C — CPS baixo", descricao: "Redução do CPS para R$ 0,90", drivers: { ...base, cps_midia: 0.9 } },
];

export default function PlanejamentoSimulador() {
  const [base, setBase] = useState<Drivers>(DEFAULT_DRIVERS);
  const [cenarios, setCenarios] = useState<Cenario[]>([]);
  const [loading, setLoading] = useState(true);
  const mesAtual = new Date().getMonth() + 1;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: dBase }, { data: dSims }] = await Promise.all([
        supabase.from("planejamento_drivers" as any).select("*").eq("ano", ANO).eq("mes", mesAtual).maybeSingle(),
        supabase.from("planejamento_simulacoes" as any).select("*").eq("ano", ANO).eq("mes_referencia", mesAtual).order("created_at"),
      ]);
      let baseDrivers = DEFAULT_DRIVERS;
      if (dBase) {
        const dd: any = dBase;
        baseDrivers = {
          retencao: dd.retencao, aprovacao: dd.aprovacao, ticket_medio: dd.ticket_medio,
          taxa_conversao: dd.taxa_conversao, invest_midia: dd.invest_midia, invest_vip: dd.invest_vip,
          invest_imp: dd.invest_imp, sessoes_org: dd.sessoes_org, cps_midia: dd.cps_midia,
        };
      }
      setBase(baseDrivers);
      if (dSims && dSims.length > 0) {
        setCenarios((dSims as any[]).map((s) => ({
          id: s.id, nome: s.nome, descricao: s.descricao ?? "",
          drivers: {
            retencao: s.retencao, aprovacao: s.aprovacao, ticket_medio: s.ticket_medio,
            taxa_conversao: s.taxa_conversao, invest_midia: s.invest_midia, invest_vip: s.invest_vip,
            invest_imp: s.invest_imp, sessoes_org: s.sessoes_org, cps_midia: s.cps_midia,
          },
        })));
      } else {
        setCenarios(DEFAULT_CENARIOS(baseDrivers));
      }
      setLoading(false);
    })();
  }, [mesAtual]);

  const cBase = useMemo(() => calcularCascata(base), [base]);
  const cCens = useMemo(() => cenarios.map((c) => calcularCascata(c.drivers)), [cenarios]);

  const persistCenario = async (idx: number) => {
    const c = cenarios[idx];
    const cc = calcularCascata(c.drivers);
    const impacto = cc.receita_faturada - cBase.receita_faturada;
    const payload: any = {
      ano: ANO, mes_referencia: mesAtual,
      nome: c.nome, descricao: c.descricao,
      ...c.drivers,
      receita_faturada: cc.receita_faturada, roas_faturado: cc.roas_faturado,
      impacto_vs_base: impacto,
      impacto_pct: cBase.receita_faturada > 0 ? (impacto / cBase.receita_faturada) * 100 : 0,
    };
    let res;
    if (c.id) res = await supabase.from("planejamento_simulacoes" as any).update(payload).eq("id", c.id);
    else {
      res = await supabase.from("planejamento_simulacoes" as any).insert(payload).select().single();
      if (res.data) setCenarios((prev) => prev.map((x, i) => i === idx ? { ...x, id: (res.data as any).id } : x));
    }
    if (res.error) toast.error("Erro ao salvar"); else toast.success("Cenário salvo 💛", { duration: 1500 });
  };

  const ranking = useMemo(() => {
    return cenarios
      .map((c, i) => ({ idx: i, nome: c.nome, impacto: cCens[i].receita_faturada - cBase.receita_faturada }))
      .sort((a, b) => b.impacto - a.impacto);
  }, [cenarios, cCens, cBase]);

  const planoAcao = useMemo(() => {
    return cenarios.map((c, i) => {
      const impacto = cCens[i].receita_faturada - cBase.receita_faturada;
      // qual driver mudou
      const changed = DRIVER_KEYS.find((k) => c.drivers[k] !== base[k]);
      const prioridade = impacto > 10000 ? "ALTA" : impacto > 5000 ? "MÉDIA" : "BAIXA";
      return { driver: changed, meta: changed ? c.drivers[changed] : null, impacto, prioridade };
    });
  }, [cenarios, cCens, cBase, base]);

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-96" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <h1 className="text-3xl font-serif">Simulador de Cenários</h1>

      {/* Base */}
      <Card className="bg-sidebar-background text-sidebar-foreground border-sidebar-border">
        <CardHeader><CardTitle className="font-serif text-xl text-sidebar-primary">Cenário Base</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><p className="text-xs uppercase opacity-60">Receita Faturada</p><p className="text-xl font-serif text-sidebar-primary">{fmtBRL(cBase.receita_faturada)}</p></div>
          <div><p className="text-xs uppercase opacity-60">ROAS</p><p className="text-xl font-serif">{cBase.roas_faturado.toFixed(2)}x</p></div>
          <div><p className="text-xs uppercase opacity-60">Pedidos Faturados</p><p className="text-xl font-serif">{fmtNum(cBase.pedidos_faturados)}</p></div>
          <div><p className="text-xs uppercase opacity-60">CAC</p><p className="text-xl font-serif">{fmtBRL(cBase.cac)}</p></div>
        </CardContent>
      </Card>

      {/* Cenários */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {cenarios.map((c, i) => (
          <Card key={i}>
            <CardHeader>
              <Input value={c.nome} onChange={(e) => setCenarios((p) => p.map((x, idx) => idx === i ? { ...x, nome: e.target.value } : x))} onBlur={() => persistCenario(i)} className="font-serif text-lg" />
              <Input value={c.descricao} onChange={(e) => setCenarios((p) => p.map((x, idx) => idx === i ? { ...x, descricao: e.target.value } : x))} onBlur={() => persistCenario(i)} className="text-xs mt-1" placeholder="Descrição" />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {DRIVER_KEYS.map((k) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <label className="text-xs flex-1">{DRIVER_LABELS[k].label}</label>
                  <Input type="number" step="0.01" value={c.drivers[k] as number}
                    onChange={(e) => setCenarios((p) => p.map((x, idx) => idx === i ? { ...x, drivers: { ...x.drivers, [k]: Number(e.target.value.replace(",", ".")) || 0 } } : x))}
                    onBlur={() => persistCenario(i)}
                    className="h-8 w-24 text-xs text-right" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela comparativa */}
      <Card>
        <CardHeader><CardTitle className="font-serif text-xl">Comparativo</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sidebar-background text-sidebar-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Métrica</th>
                <th className="px-3 py-2 text-right">Base</th>
                {cenarios.map((c, i) => <th key={i} className="px-3 py-2 text-right">{c.nome}</th>)}
              </tr>
            </thead>
            <tbody>
              {([
                ["Receita Faturada", (x: any) => x.receita_faturada, fmtBRL],
                ["ROAS", (x: any) => x.roas_faturado, (v: number) => `${v.toFixed(2)}x`],
                ["Pedidos Faturados", (x: any) => x.pedidos_faturados, fmtNum],
                ["CAC", (x: any) => x.cac, fmtBRL],
                ["Sessões", (x: any) => x.sessoes_totais, fmtNum],
                ["AdCost %", (x: any) => x.adcost_pct, (v: number) => `${v.toFixed(1)}%`],
              ] as const).map(([label, fn, fmt]) => (
                <tr key={label as string} className="border-t">
                  <td className="px-3 py-2 font-medium">{label}</td>
                  <td className="px-3 py-2 text-right">{fmt(fn(cBase))}</td>
                  {cCens.map((c, i) => <td key={i} className="px-3 py-2 text-right">{fmt(fn(c))}</td>)}
                </tr>
              ))}
              <tr className="border-t bg-accent/40">
                <td className="px-3 py-2 font-semibold">Impacto vs. Base (Receita)</td>
                <td className="px-3 py-2 text-right">—</td>
                {cCens.map((c, i) => {
                  const delta = c.receita_faturada - cBase.receita_faturada;
                  return <td key={i} className={`px-3 py-2 text-right font-semibold ${delta >= 0 ? "text-success" : "text-destructive"}`}>{delta >= 0 ? "+" : ""}{fmtBRL(delta)}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Impacto Acumulado */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader><CardTitle className="font-serif text-xl">Impacto Acumulado</CardTitle></CardHeader>
        <CardContent>
          {(() => {
            const totalDelta = cCens.reduce((s, c) => s + (c.receita_faturada - cBase.receita_faturada), 0);
            const total = cBase.receita_faturada + totalDelta;
            const pct = cBase.receita_faturada > 0 ? (totalDelta / cBase.receita_faturada) * 100 : 0;
            return (
              <div className="space-y-2">
                <p className="text-lg">
                  <span>{fmtBRL(cBase.receita_faturada)}</span>
                  {cCens.map((c, i) => {
                    const d = c.receita_faturada - cBase.receita_faturada;
                    return <span key={i} className={d >= 0 ? "text-success" : "text-destructive"}> {d >= 0 ? "+" : "−"} {fmtBRL(Math.abs(d))}</span>;
                  })}
                  <span className="font-serif text-primary"> = {fmtBRL(total)}</span>
                </p>
                <p className="text-sm">Crescimento total vs. base: <strong className={pct >= 0 ? "text-success" : "text-destructive"}>{pct.toFixed(1)}%</strong></p>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Ranking */}
      <Card>
        <CardHeader><CardTitle className="font-serif text-xl flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Ranking de Cenários</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {ranking.map((r, i) => {
            const medals = ["🥇", "🥈", "🥉"];
            const colors = ["bg-primary/20", "bg-muted", "bg-accent/40"];
            return (
              <div key={r.idx} className={`flex items-center justify-between p-3 rounded border ${colors[i] ?? ""}`}>
                <span className="font-medium">{medals[i] ?? `${i + 1}º`} {r.nome}</span>
                <span className={`font-semibold ${r.impacto >= 0 ? "text-success" : "text-destructive"}`}>{r.impacto >= 0 ? "+" : ""}{fmtBRL(r.impacto)}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Plano de ação */}
      <Card>
        <CardHeader><CardTitle className="font-serif text-xl">Plano de Ação por Driver</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="bg-sidebar-background text-sidebar-foreground">
              <tr><th className="px-3 py-2 text-left">Driver</th><th className="px-3 py-2 text-right">Meta</th><th className="px-3 py-2 text-right">Impacto Estimado</th><th className="px-3 py-2 text-center">Prioridade</th></tr>
            </thead>
            <tbody>
              {planoAcao.map((p, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{p.driver ? DRIVER_LABELS[p.driver].label : "—"}</td>
                  <td className="px-3 py-2 text-right">{p.meta ?? "—"}</td>
                  <td className={`px-3 py-2 text-right ${p.impacto >= 0 ? "text-success" : "text-destructive"}`}>{fmtBRL(p.impacto)}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge className={p.prioridade === "ALTA" ? "bg-destructive text-destructive-foreground" : p.prioridade === "MÉDIA" ? "bg-warning text-warning-foreground" : "bg-muted"}>{p.prioridade}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
