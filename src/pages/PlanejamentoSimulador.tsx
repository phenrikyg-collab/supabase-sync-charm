import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlanejamentoMensal as PM, fmtBRL, fmtNum, fmtPct } from "@/hooks/usePlanejamentoMensal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Manual {
  receita_captada: number;
  taxa_aprovacao: number;
  pedidos_captados: number;
  taxa_aquisicao: number;
  sessoes_totais: number;
  sessoes_midia: number;
  investimento_total: number;
}

interface Cenario {
  nome: string;
  descricao: string;
  m: Manual;
}

function calc(m: Manual) {
  const rf = m.receita_captada * m.taxa_aprovacao / 100;
  const pf = m.pedidos_captados * m.taxa_aprovacao / 100;
  const pa = pf * m.taxa_aquisicao / 100;
  const ra = rf * m.taxa_aquisicao / 100;
  return {
    receita_faturada: rf,
    pedidos_faturados: pf,
    pedidos_aquisicao: pa,
    receita_aquisicao: ra,
    roas_faturado: m.investimento_total > 0 ? rf / m.investimento_total : 0,
    cac_novos: pa > 0 ? m.investimento_total / pa : 0,
    adcost_pct: rf > 0 ? (m.investimento_total / rf) * 100 : 0,
  };
}

const DEFAULT: Manual = {
  receita_captada: 380000, taxa_aprovacao: 90, pedidos_captados: 1000,
  taxa_aquisicao: 70, sessoes_totais: 80000, sessoes_midia: 30000, investimento_total: 60000,
};

export default function PlanejamentoSimulador() {
  const [base, setBase] = useState<Manual>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [cenarios, setCenarios] = useState<Cenario[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("planejamento_mensal")
        .select("*")
        .eq("ano", 2026).eq("mes", 6).eq("tipo", "planejado")
        .maybeSingle();
      const r = (data as PM | null);
      const b: Manual = r ? {
        receita_captada: r.receita_captada ?? DEFAULT.receita_captada,
        taxa_aprovacao: r.taxa_aprovacao ?? DEFAULT.taxa_aprovacao,
        pedidos_captados: r.pedidos_captados ?? DEFAULT.pedidos_captados,
        taxa_aquisicao: r.taxa_aquisicao ?? DEFAULT.taxa_aquisicao,
        sessoes_totais: r.sessoes_totais ?? DEFAULT.sessoes_totais,
        sessoes_midia: r.sessoes_midia ?? DEFAULT.sessoes_midia,
        investimento_total: r.investimento_total ?? DEFAULT.investimento_total,
      } : DEFAULT;
      setBase(b);
      setCenarios([
        { nome: "Cenário A", descricao: "Crescimento de captação", m: { ...b, receita_captada: 420000 } },
        { nome: "Cenário B", descricao: "Melhora no gateway", m: { ...b, taxa_aprovacao: 92 } },
        { nome: "Cenário C", descricao: "Foco em retenção", m: { ...b, taxa_aquisicao: 60 } },
      ]);
      setLoading(false);
    })();
  }, []);

  const calcs = useMemo(() => ({
    base: calc(base),
    cenarios: cenarios.map((c) => calc(c.m)),
  }), [base, cenarios]);

  const updateCenario = (i: number, patch: Partial<Cenario>) => {
    setCenarios((cs) => cs.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  };
  const updateManual = (i: number, k: keyof Manual, v: number) => {
    setCenarios((cs) => cs.map((c, idx) => idx === i ? { ...c, m: { ...c.m, [k]: v } } : c));
  };

  const salvarSimulacao = async () => {
    const { error } = await (supabase as any).from("planejamento_simulacoes").insert({
      nome: `Simulação ${new Date().toLocaleDateString("pt-BR")}`,
      ano: 2026, mes: 6, base, cenarios,
    });
    if (error) toast.error("Erro ao salvar simulação");
    else toast.success("Simulação salva 💛");
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-12 w-72" /><Skeleton className="h-96" /></div>;

  const linhas: Array<{ label: string; fmt: (v: number) => string; key: keyof ReturnType<typeof calc> }> = [
    { label: "Receita Faturada", key: "receita_faturada", fmt: (v) => fmtBRL(v) },
    { label: "ROAS", key: "roas_faturado", fmt: (v) => v.toFixed(2) + "x" },
    { label: "CAC Novos", key: "cac_novos", fmt: (v) => fmtBRL(v) },
    { label: "Pedidos Fat.", key: "pedidos_faturados", fmt: (v) => fmtNum(v) },
    { label: "AdCost", key: "adcost_pct", fmt: (v) => v.toFixed(1) + "%" },
  ];

  const deltaReceita = calcs.cenarios.reduce((s, c) => s + (c.receita_faturada - calcs.base.receita_faturada), 0);
  const totalAcum = calcs.base.receita_faturada + deltaReceita;

  // Plano de ação
  const acoes = cenarios.flatMap((c, i) => {
    const impacto = calcs.cenarios[i].receita_faturada - calcs.base.receita_faturada;
    const campos = (Object.keys(c.m) as (keyof Manual)[]).filter((k) => c.m[k] !== base[k]);
    return campos.map((k) => ({
      campo: k, atual: base[k], meta: c.m[k], impacto, cenario: c.nome,
    }));
  }).sort((a, b) => Math.abs(b.impacto) - Math.abs(a.impacto));

  const prioridade = (v: number) => Math.abs(v) > 15000 ? "ALTA" : Math.abs(v) > 5000 ? "MÉDIA" : "BAIXA";
  const prioBg = (p: string) => p === "ALTA" ? "#FFE8E5" : p === "MÉDIA" ? "#FFFBEA" : "#D4F5DE";
  const prioFg = (p: string) => p === "ALTA" ? "#C0392B" : p === "MÉDIA" ? "#A07800" : "#2D7D46";

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-serif text-[#1D1D1B]">Simulador</h1>
        <Button onClick={salvarSimulacao} style={{ background: "#1D1D1B", color: "#E8CD7E" }}>Salvar Simulação</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Base */}
        <Card style={{ borderColor: "#F5E9B8" }}>
          <CardHeader><CardTitle className="font-serif text-base">Base (Jun 2026)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            {(Object.keys(base) as (keyof Manual)[]).map((k) => (
              <div key={k} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <strong>{base[k]}</strong>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 space-y-1" style={{ borderColor: "#F5E9B8" }}>
              <div className="flex justify-between"><span>Rec. Faturada</span><strong>{fmtBRL(calcs.base.receita_faturada)}</strong></div>
              <div className="flex justify-between"><span>ROAS</span><strong>{calcs.base.roas_faturado.toFixed(2)}x</strong></div>
              <div className="flex justify-between"><span>CAC Novos</span><strong>{fmtBRL(calcs.base.cac_novos)}</strong></div>
            </div>
          </CardContent>
        </Card>

        {cenarios.map((c, i) => (
          <Card key={i} style={{ borderColor: "#E8CD7E" }}>
            <CardHeader className="space-y-2">
              <Input value={c.nome} onChange={(e) => updateCenario(i, { nome: e.target.value })} className="font-serif text-base h-8" />
              <Input value={c.descricao} onChange={(e) => updateCenario(i, { descricao: e.target.value })} className="text-xs h-7" placeholder="Descrição" />
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs">
              {(Object.keys(c.m) as (keyof Manual)[]).map((k) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground truncate">{k}</span>
                  <Input type="number" value={c.m[k]} onChange={(e) => updateManual(i, k, Number(e.target.value))}
                    className="h-7 w-24 text-right" style={{ background: c.m[k] !== base[k] ? "#FFFBEA" : "#FAF8F3" }} />
                </div>
              ))}
              <div className="border-t pt-2 mt-2 space-y-1" style={{ borderColor: "#F5E9B8" }}>
                <div className="flex justify-between"><span>Rec. Faturada</span><strong>{fmtBRL(calcs.cenarios[i].receita_faturada)}</strong></div>
                <div className="flex justify-between"><span>ROAS</span><strong>{calcs.cenarios[i].roas_faturado.toFixed(2)}x</strong></div>
                <div className="flex justify-between"><span>CAC Novos</span><strong>{fmtBRL(calcs.cenarios[i].cac_novos)}</strong></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela Comparativa */}
      <Card style={{ borderColor: "#F5E9B8" }}>
        <CardHeader><CardTitle className="font-serif text-lg">Tabela Comparativa</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#1D1D1B", color: "#E8CD7E" }}>
              <tr>
                <th className="px-3 py-2 text-left text-xs uppercase">Métrica</th>
                <th className="px-3 py-2 text-left text-xs uppercase">Base</th>
                {cenarios.map((c, i) => (<th key={i} className="px-3 py-2 text-left text-xs uppercase">{c.nome}</th>))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.key} className="border-b" style={{ borderColor: "#F5E9B8" }}>
                  <td className="px-3 py-2 font-medium">{l.label}</td>
                  <td className="px-3 py-2">{l.fmt(calcs.base[l.key])}</td>
                  {calcs.cenarios.map((c, i) => {
                    const delta = c[l.key] - calcs.base[l.key];
                    const pct = calcs.base[l.key] !== 0 ? (delta / calcs.base[l.key]) * 100 : 0;
                    return (
                      <td key={i} className="px-3 py-2">
                        <div>{l.fmt(c[l.key])}</div>
                        <div className={`text-[10px] ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                          Δ {delta > 0 ? "+" : ""}{l.fmt(Math.abs(delta))} ({pct > 0 ? "+" : ""}{pct.toFixed(1)}%)
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Impacto Acumulado */}
      <Card style={{ background: "#1D1D1B", borderColor: "#1D1D1B" }}>
        <CardHeader><CardTitle className="font-serif text-lg text-[#E8CD7E]">Impacto Acumulado</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center flex-wrap gap-3 text-[#FAF8F3]">
            <div className="text-center"><div className="text-xs opacity-70">Base</div><div className="text-xl font-serif text-[#E8CD7E]">{fmtBRL(calcs.base.receita_faturada)}</div></div>
            {calcs.cenarios.map((c, i) => {
              const d = c.receita_faturada - calcs.base.receita_faturada;
              return (
                <div key={i} className="text-center">
                  <div className="text-xs opacity-70">+Δ {cenarios[i].nome}</div>
                  <div className={`text-xl font-serif ${d >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {d >= 0 ? "+" : ""}{fmtBRL(d)}
                  </div>
                </div>
              );
            })}
            <div className="text-center border-l pl-4" style={{ borderColor: "#E8CD7E" }}>
              <div className="text-xs opacity-70">Total</div>
              <div className="text-2xl font-serif text-[#E8CD7E]">{fmtBRL(totalAcum)}</div>
            </div>
          </div>
          <p className="text-center text-xs text-[#E8CD7E]/70 mt-3">
            {calcs.base.receita_faturada > 0 && `+${((deltaReceita / calcs.base.receita_faturada) * 100).toFixed(1)}% vs base se todos os cenários se confirmarem`}
          </p>
        </CardContent>
      </Card>

      {/* Plano de Ação */}
      <Card style={{ borderColor: "#F5E9B8" }}>
        <CardHeader><CardTitle className="font-serif text-lg">Plano de Ação</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#1D1D1B", color: "#E8CD7E" }}>
              <tr>
                {["Campo","Cenário","Valor Atual","Meta","Impacto R$","Prioridade"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {acoes.map((a, i) => {
                const p = prioridade(a.impacto);
                return (
                  <tr key={i} className="border-b" style={{ borderColor: "#F5E9B8" }}>
                    <td className="px-3 py-2 font-medium">{a.campo}</td>
                    <td className="px-3 py-2">{a.cenario}</td>
                    <td className="px-3 py-2">{a.atual}</td>
                    <td className="px-3 py-2">{a.meta}</td>
                    <td className={`px-3 py-2 ${a.impacto > 0 ? "text-emerald-600" : "text-rose-600"}`}>{a.impacto > 0 ? "+" : ""}{fmtBRL(a.impacto)}</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: prioBg(p), color: prioFg(p) }}>{p}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
