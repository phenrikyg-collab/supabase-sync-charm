import { useState, useMemo } from "react";
import { useMovimentacoesFinanceiras, useCategorias } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function getMonthLabel(mes: string) {
  const [y, m] = mes.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]}/${y}`;
}

// DRE groups hierarchy (hybrid model)
const DRE_STRUCTURE = [
  { key: "receita_bruta", label: "Receita Bruta", type: "header" },
  { key: "deducoes", label: "(-) Deduções sobre Receita", type: "deduction" },
  { key: "receita_liquida", label: "= Receita Líquida", type: "subtotal" },
  { key: "cmv", label: "(-) Custo da Mercadoria Vendida (CMV)", type: "deduction" },
  { key: "lucro_bruto", label: "= Lucro Bruto", type: "subtotal" },
  { key: "despesas_operacionais", label: "(-) Despesas Operacionais", type: "deduction" },
  { key: "despesas_fixas", label: "  Despesas Fixas", type: "sub-deduction" },
  { key: "despesas_variaveis", label: "  Despesas Variáveis", type: "sub-deduction" },
  { key: "despesas_pessoal", label: "  Despesas com Pessoal", type: "sub-deduction" },
  { key: "resultado_operacional", label: "= Resultado Operacional (EBITDA)", type: "subtotal" },
  { key: "resultado_financeiro", label: "(+/-) Resultado Financeiro", type: "deduction" },
  { key: "lucro_liquido", label: "= Lucro Líquido", type: "total" },
];

// Map grupo_dre from categories to DRE lines
function mapCategoriaToDreGroup(grupoDre: string | null): string {
  if (!grupoDre) return "despesas_operacionais";
  const map: Record<string, string> = {
    "receita_bruta": "receita_bruta",
    "deducoes": "deducoes",
    "cmv": "cmv",
    "despesas_fixas": "despesas_fixas",
    "despesas_variaveis": "despesas_variaveis",
    "despesas_pessoal": "despesas_pessoal",
    "despesas_operacionais": "despesas_operacionais",
    "resultado_financeiro": "resultado_financeiro",
  };
  return map[grupoDre] || "despesas_operacionais";
}

export default function DRE() {
  const { data: movs, isLoading } = useMovimentacoesFinanceiras();
  const { data: categorias } = useCategorias();
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString());
  const [mesSelecionado, setMesSelecionado] = useState("todos");

  const catMap = useMemo(() => {
    const map: Record<string, { nome: string; grupoDre: string }> = {};
    (categorias ?? []).forEach((c) => {
      map[c.id] = { nome: c.nome_categoria ?? "Sem categoria", grupoDre: c.grupo_dre ?? "despesas_operacionais" };
    });
    return map;
  }, [categorias]);

  // Available years
  const anos = useMemo(() => {
    const set = new Set<string>();
    (movs ?? []).forEach((m) => {
      if (m.data) set.add(m.data.substring(0, 4));
    });
    if (set.size === 0) set.add(new Date().getFullYear().toString());
    return [...set].sort().reverse();
  }, [movs]);

  // Available months for selected year
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    (movs ?? []).forEach((m) => {
      if (m.data && m.data.startsWith(anoSelecionado)) {
        set.add(m.data.substring(0, 7));
      }
    });
    return [...set].sort();
  }, [movs, anoSelecionado]);

  // Filter movimentações
  const filtered = useMemo(() => {
    return (movs ?? []).filter((m) => {
      if (!m.data) return false;
      if (!m.data.startsWith(anoSelecionado)) return false;
      if (mesSelecionado !== "todos" && !m.data.startsWith(mesSelecionado)) return false;
      return true;
    });
  }, [movs, anoSelecionado, mesSelecionado]);

  // Calculate DRE values
  const dreValues = useMemo(() => {
    const groups: Record<string, number> = {};
    const groupDetails: Record<string, Record<string, number>> = {};

    // Initialize
    DRE_STRUCTURE.forEach((s) => {
      groups[s.key] = 0;
      groupDetails[s.key] = {};
    });

    // Receita bruta = all "entrada" from bling
    filtered.forEach((m) => {
      if (m.tipo === "entrada" && m.origem === "bling") {
        groups["receita_bruta"] += m.valor ?? 0;
        const label = "Vendas";
        groupDetails["receita_bruta"][label] = (groupDetails["receita_bruta"][label] ?? 0) + (m.valor ?? 0);

        // Deductions: discounts + freight costs
        const desconto = m.valor_desconto ?? 0;
        if (desconto > 0) {
          groups["deducoes"] += desconto;
          groupDetails["deducoes"]["Descontos Concedidos"] = (groupDetails["deducoes"]["Descontos Concedidos"] ?? 0) + desconto;
        }
      } else if (m.tipo === "saida" || (m.tipo !== "entrada")) {
        // Classify expenses by category
        const cat = m.categoria_id ? catMap[m.categoria_id] : null;
        const grupoDre = cat ? mapCategoriaToDreGroup(cat.grupoDre) : "despesas_operacionais";
        const catNome = cat?.nome ?? m.descricao ?? "Outros";
        const valor = Math.abs(m.valor ?? 0);

        groups[grupoDre] += valor;
        groupDetails[grupoDre][catNome] = (groupDetails[grupoDre][catNome] ?? 0) + valor;
      }
    });

    // Calculate subtotals
    groups["receita_liquida"] = groups["receita_bruta"] - groups["deducoes"];
    groups["lucro_bruto"] = groups["receita_liquida"] - groups["cmv"];
    const totalDespOp = groups["despesas_fixas"] + groups["despesas_variaveis"] + groups["despesas_pessoal"] + groups["despesas_operacionais"];
    groups["resultado_operacional"] = groups["lucro_bruto"] - totalDespOp;
    groups["lucro_liquido"] = groups["resultado_operacional"] + groups["resultado_financeiro"];

    return { groups, groupDetails };
  }, [filtered, catMap]);

  // Monthly breakdown for annual view
  const monthlyDre = useMemo(() => {
    if (mesSelecionado !== "todos") return null;
    const monthlyData: Record<string, Record<string, number>> = {};

    mesesDisponiveis.forEach((mes) => {
      const monthMovs = filtered.filter((m) => m.data?.startsWith(mes));
      const g: Record<string, number> = {};
      DRE_STRUCTURE.forEach((s) => { g[s.key] = 0; });

      monthMovs.forEach((m) => {
        if (m.tipo === "entrada" && m.origem === "bling") {
          g["receita_bruta"] += m.valor ?? 0;
          g["deducoes"] += m.valor_desconto ?? 0;
        } else if (m.tipo === "saida" || m.tipo !== "entrada") {
          const cat = m.categoria_id ? catMap[m.categoria_id] : null;
          const grupoDre = cat ? mapCategoriaToDreGroup(cat.grupoDre) : "despesas_operacionais";
          g[grupoDre] += Math.abs(m.valor ?? 0);
        }
      });

      g["receita_liquida"] = g["receita_bruta"] - g["deducoes"];
      g["lucro_bruto"] = g["receita_liquida"] - g["cmv"];
      const totalDespOp = g["despesas_fixas"] + g["despesas_variaveis"] + g["despesas_pessoal"] + g["despesas_operacionais"];
      g["resultado_operacional"] = g["lucro_bruto"] - totalDespOp;
      g["lucro_liquido"] = g["resultado_operacional"] + g["resultado_financeiro"];

      monthlyData[mes] = g;
    });

    return monthlyData;
  }, [filtered, mesSelecionado, mesesDisponiveis, catMap]);

  // Cost reduction insights
  const insights = useMemo(() => {
    const tips: { icon: React.ReactNode; text: string; type: "success" | "warning" | "danger" }[] = [];
    const { groups } = dreValues;

    if (groups["receita_bruta"] > 0) {
      const margemBruta = (groups["lucro_bruto"] / groups["receita_bruta"]) * 100;
      if (margemBruta < 40) {
        tips.push({ icon: <AlertTriangle className="h-4 w-4" />, text: `Margem bruta de ${margemBruta.toFixed(1)}% está abaixo de 40%. Revise custos de produção.`, type: "danger" });
      } else if (margemBruta < 55) {
        tips.push({ icon: <TrendingDown className="h-4 w-4" />, text: `Margem bruta de ${margemBruta.toFixed(1)}%. Há espaço para otimização de custos.`, type: "warning" });
      } else {
        tips.push({ icon: <TrendingUp className="h-4 w-4" />, text: `Margem bruta saudável de ${margemBruta.toFixed(1)}%.`, type: "success" });
      }

      const descontoPerc = (groups["deducoes"] / groups["receita_bruta"]) * 100;
      if (descontoPerc > 15) {
        tips.push({ icon: <AlertTriangle className="h-4 w-4" />, text: `Descontos representam ${descontoPerc.toFixed(1)}% da receita. Considere reduzir promoções.`, type: "warning" });
      }
    }

    if (groups["lucro_liquido"] < 0) {
      tips.push({ icon: <AlertTriangle className="h-4 w-4" />, text: "Resultado líquido negativo! Ação urgente necessária.", type: "danger" });
    }

    // Find largest expense category
    const { groupDetails } = dreValues;
    const allExpenses = { ...groupDetails["despesas_fixas"], ...groupDetails["despesas_variaveis"], ...groupDetails["despesas_pessoal"], ...groupDetails["despesas_operacionais"] };
    const sorted = Object.entries(allExpenses).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      tips.push({ icon: <TrendingDown className="h-4 w-4" />, text: `Maior despesa: "${sorted[0][0]}" com ${formatCurrency(sorted[0][1])}. Avalie se há oportunidade de redução.`, type: "warning" });
    }

    return tips;
  }, [dreValues]);

  const getRowStyle = (type: string) => {
    switch (type) {
      case "header": return "font-semibold text-foreground bg-accent/30";
      case "subtotal": return "font-semibold text-foreground border-t border-border";
      case "total": return "font-bold text-lg border-t-2 border-foreground bg-accent/50";
      case "deduction": return "text-muted-foreground";
      case "sub-deduction": return "text-muted-foreground text-sm pl-6";
      default: return "";
    }
  };

  const getValueColor = (key: string, value: number) => {
    if (key === "lucro_liquido" || key === "resultado_operacional" || key === "lucro_bruto") {
      return value >= 0 ? "text-success" : "text-destructive";
    }
    if (key.includes("deducoes") || key.includes("despesas") || key === "cmv") {
      return "text-destructive";
    }
    return "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">DRE</h1>
          <p className="text-sm text-muted-foreground mt-1">Demonstração do Resultado do Exercício</p>
        </div>
        <div className="flex gap-3">
          <Select value={anoSelecionado} onValueChange={(v) => { setAnoSelecionado(v); setMesSelecionado("todos"); }}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anos.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Anual</SelectItem>
              {mesesDisponiveis.map((m) => <SelectItem key={m} value={m}>{getMonthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid gap-2">
          {insights.map((tip, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                tip.type === "danger" ? "border-destructive/30 bg-destructive/5 text-destructive" :
                tip.type === "warning" ? "border-warning/30 bg-warning/5 text-warning-foreground" :
                "border-success/30 bg-success/5 text-success"
              }`}
            >
              {tip.icon}
              <span className="text-sm">{tip.text}</span>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="consolidado">
        <TabsList>
          <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
          {mesSelecionado === "todos" && <TabsTrigger value="mensal">Comparativo Mensal</TabsTrigger>}
        </TabsList>

        <TabsContent value="consolidado">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                DRE {mesSelecionado === "todos" ? `Anual ${anoSelecionado}` : getMonthLabel(mesSelecionado)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <div className="space-y-0">
                  {DRE_STRUCTURE.map((row) => {
                    const val = dreValues.groups[row.key] ?? 0;
                    const details = dreValues.groupDetails[row.key] ?? {};
                    const hasDetails = Object.keys(details).length > 0;

                    return (
                      <div key={row.key}>
                        <div className={`flex justify-between items-center px-4 py-3 rounded ${getRowStyle(row.type)}`}>
                          <span>{row.label}</span>
                          <span className={`font-mono ${getValueColor(row.key, val)}`}>
                            {row.type === "deduction" || row.type === "sub-deduction"
                              ? val > 0 ? `(${formatCurrency(val)})` : formatCurrency(0)
                              : formatCurrency(val)}
                          </span>
                        </div>
                        {hasDetails && (
                          <div className="ml-8 space-y-0.5 mb-1">
                            {Object.entries(details).sort((a, b) => b[1] - a[1]).map(([nome, valor]) => (
                              <div key={nome} className="flex justify-between items-center px-4 py-1 text-xs text-muted-foreground">
                                <span>• {nome}</span>
                                <span className="font-mono">{formatCurrency(valor)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {mesSelecionado === "todos" && monthlyDre && (
          <TabsContent value="mensal">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Comparativo Mensal {anoSelecionado}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 min-w-[200px]">Conta</th>
                      {mesesDisponiveis.map((m) => (
                        <th key={m} className="text-right py-2 px-3 min-w-[120px]">{getMonthLabel(m)}</th>
                      ))}
                      <th className="text-right py-2 px-3 min-w-[130px] font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DRE_STRUCTURE.map((row) => (
                      <tr key={row.key} className={`border-b border-border/50 ${getRowStyle(row.type)}`}>
                        <td className="py-2 px-3">{row.label}</td>
                        {mesesDisponiveis.map((m) => {
                          const val = monthlyDre[m]?.[row.key] ?? 0;
                          return (
                            <td key={m} className={`text-right py-2 px-3 font-mono text-xs ${getValueColor(row.key, val)}`}>
                              {formatCurrency(val)}
                            </td>
                          );
                        })}
                        <td className={`text-right py-2 px-3 font-mono font-bold ${getValueColor(row.key, dreValues.groups[row.key] ?? 0)}`}>
                          {formatCurrency(dreValues.groups[row.key] ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
