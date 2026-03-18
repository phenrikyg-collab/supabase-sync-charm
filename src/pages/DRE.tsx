import { useState, useMemo } from "react";
import { useMovimentacoesFinanceiras, useCategorias } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, AlertTriangle, ChevronDown, ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatPercent(v: number) {
  return `${v.toFixed(1)}%`;
}

function getMonthLabel(mes: string) {
  const [y, m] = mes.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]}/${y}`;
}

// DRE structure for garment manufacturing + e-commerce
type DreRowType = "header" | "item" | "subtotal" | "percent" | "total";

interface DreRow {
  key: string;
  label: string;
  type: DreRowType;
  sign?: "+" | "-";
}

const DRE_STRUCTURE: DreRow[] = [
  { key: "receita_bruta", label: "(+) Receita Bruta", type: "header", sign: "+" },
  { key: "receita_vendas", label: "1 - Receita com Vendas", type: "item" },

  { key: "deducoes_vendas", label: "(-) Deduções Sobre Vendas", type: "header", sign: "-" },
  { key: "impostos_vendas", label: "2 - Impostos Sobre Vendas", type: "item" },
  { key: "importacao", label: "99 - Importação", type: "item" },
  { key: "taxas_gateway", label: "101 - Taxas de Gateway", type: "item" },
  { key: "estornos", label: "102 - Estornos", type: "item" },

  { key: "receita_liquida", label: "(=) Receita Líquida", type: "subtotal" },

  { key: "custos_variaveis_header", label: "(-) Custos Variáveis", type: "header", sign: "-" },
  { key: "custos_variaveis", label: "4 - Custos Variáveis", type: "item" },
  { key: "servicos_terceiros", label: "7 - Gastos com Serviços de Terceiros", type: "item" },
  { key: "manutencao_producao", label: "17 - Gastos com manutenção - produção", type: "item" },
  { key: "brindes_presentes", label: "18 - Despesas com brindes e presentes", type: "item" },
  { key: "embalagem_geral", label: "19 - Embalagem geral", type: "item" },
  { key: "logistica_vendas", label: "103 - Logística de vendas", type: "item" },
  { key: "comissao_vendedores", label: "104 - Comissão de vendedores", type: "item" },

  { key: "margem_contribuicao", label: "(=) Margem de Contribuição", type: "subtotal" },
  { key: "pct_margem_contribuicao", label: "(=) % Margem de Contribuição", type: "percent" },

  { key: "custos_fixos_header", label: "(-) Custos Fixos", type: "header", sign: "-" },
  { key: "gastos_pessoal", label: "5 - Gastos com Pessoal", type: "item" },
  { key: "gastos_ocupacao", label: "6 - Gastos com Ocupação", type: "item" },
  { key: "gastos_marketing", label: "8 - Gastos com Marketing", type: "item" },
  { key: "logistica_operacional", label: "15 - Logística operacional", type: "item" },
  { key: "gastos_sistemas", label: "16 - Gastos com sistemas, site e aplicativos", type: "item" },
  { key: "despesas_administrativas", label: "106 - Despesas administrativas", type: "item" },

  { key: "resultado_operacional", label: "(=) Resultado Operacional", type: "subtotal" },

  { key: "resultado_nao_op_header", label: "Resultado Não Operacional", type: "header" },
  { key: "receitas_nao_operacionais", label: "9 - Receitas não Operacionais", type: "item" },
  { key: "gastos_nao_operacionais", label: "10 - Gastos não Operacionais", type: "item" },

  { key: "lair", label: "(=) Lucro Antes do Imposto de Renda (LAIR)", type: "subtotal" },

  { key: "ir_csll_header", label: "(-) Imposto de Renda e CSLL", type: "header", sign: "-" },
  { key: "ir_csll", label: "11 - Imposto de Renda e CSLL", type: "item" },

  { key: "lucro_liquido", label: "(=) Lucro Líquido", type: "total" },
  { key: "pct_margem_liquida", label: "(=) % Margem Líquida", type: "percent" },
];

function mapCategoriaToDreKey(grupoDre: string | null, nomeCategoria: string | null): string {
  if (!grupoDre && !nomeCategoria) return "custos_variaveis";
  
  const gd = grupoDre?.toLowerCase() ?? "";
  const nome = nomeCategoria?.toLowerCase() ?? "";

  if (gd === "impostos_vendas" || nome.includes("imposto") && nome.includes("venda")) return "impostos_vendas";
  if (gd === "importacao" || nome.includes("importa")) return "importacao";
  if (gd === "taxas_gateway" || nome.includes("gateway") || nome.includes("taxa")) return "taxas_gateway";
  if (gd === "estornos" || nome.includes("estorno")) return "estornos";
  if (gd === "deducoes" || gd === "deducoes_vendas") return "impostos_vendas";

  if (gd === "custos_variaveis" || gd === "cmv") return "custos_variaveis";
  if (gd === "servicos_terceiros" || nome.includes("terceiro") || nome.includes("oficina")) return "servicos_terceiros";
  if (gd === "manutencao_producao" || nome.includes("manuten") && nome.includes("produ")) return "manutencao_producao";
  if (gd === "brindes_presentes" || nome.includes("brinde") || nome.includes("presente")) return "brindes_presentes";
  if (gd === "embalagem" || gd === "embalagem_geral" || nome.includes("embalag")) return "embalagem_geral";
  if (gd === "logistica_vendas" || nome.includes("logística de venda") || nome.includes("frete")) return "logistica_vendas";
  if (gd === "comissao" || gd === "comissao_vendedores" || nome.includes("comiss")) return "comissao_vendedores";

  if (gd === "despesas_pessoal" || gd === "gastos_pessoal" || nome.includes("pessoal") || nome.includes("salár") || nome.includes("folha")) return "gastos_pessoal";
  if (gd === "gastos_ocupacao" || nome.includes("ocupação") || nome.includes("aluguel")) return "gastos_ocupacao";
  if (gd === "gastos_marketing" || nome.includes("marketing") || nome.includes("publicidade")) return "gastos_marketing";
  if (gd === "logistica_operacional" || nome.includes("logística operacional")) return "logistica_operacional";
  if (gd === "gastos_sistemas" || nome.includes("sistema") || nome.includes("software") || nome.includes("aplicativo")) return "gastos_sistemas";
  if (gd === "despesas_administrativas" || gd === "despesas_fixas" || nome.includes("administrat")) return "despesas_administrativas";

  if (gd === "receitas_nao_operacionais" || nome.includes("receita") && nome.includes("não operacional")) return "receitas_nao_operacionais";
  if (gd === "gastos_nao_operacionais" || nome.includes("gasto") && nome.includes("não operacional")) return "gastos_nao_operacionais";
  if (gd === "resultado_financeiro") return "receitas_nao_operacionais";

  if (gd === "ir_csll" || nome.includes("imposto de renda") || nome.includes("csll")) return "ir_csll";

  if (gd === "despesas_operacionais" || gd === "despesas_variaveis") return "custos_variaveis";

  return "custos_variaveis";
}

const CUSTOS_VARIAVEIS_KEYS = ["custos_variaveis", "servicos_terceiros", "manutencao_producao", "brindes_presentes", "embalagem_geral", "logistica_vendas", "comissao_vendedores"];
const CUSTOS_FIXOS_KEYS = ["gastos_pessoal", "gastos_ocupacao", "gastos_marketing", "logistica_operacional", "gastos_sistemas", "despesas_administrativas"];
const DEDUCOES_KEYS = ["impostos_vendas", "importacao", "taxas_gateway", "estornos"];

interface DetailEntry {
  descricaoCategoria: string;
  nomeCategoria: string;
  valor: number;
  count: number;
}

function calculateDre(
  movs: any[],
  catMap: Record<string, { nome: string; grupoDre: string; descricao: string }>
) {
  const values: Record<string, number> = {};
  const details: Record<string, DetailEntry[]> = {};

  DRE_STRUCTURE.forEach((r) => { values[r.key] = 0; details[r.key] = []; });

  const detailAcc: Record<string, Record<string, DetailEntry>> = {};

  movs.forEach((m) => {
    if (m.tipo === "entrada" && m.origem === "bling") {
      values["receita_vendas"] += m.valor ?? 0;
      accDetail(detailAcc, "receita_vendas", "Vendas", "Venda de produtos", m.valor ?? 0);

      const desconto = m.valor_desconto ?? 0;
      if (desconto > 0) {
        values["estornos"] += desconto;
        accDetail(detailAcc, "estornos", "Descontos Concedidos", "Descontos aplicados em vendas", desconto);
      }
    } else if (m.tipo === "saida" || m.tipo !== "entrada") {
      const cat = m.categoria_id ? catMap[m.categoria_id] : null;
      const dreKey = mapCategoriaToDreKey(cat?.grupoDre ?? null, cat?.nome ?? m.descricao ?? null);
      const valor = Math.abs(m.valor ?? 0);
      const catNome = cat?.nome ?? "Sem categoria";
      const catDesc = cat?.descricao ?? m.descricao ?? "Outros";

      values[dreKey] = (values[dreKey] ?? 0) + valor;
      accDetail(detailAcc, dreKey, catNome, catDesc, valor);
    }
  });

  // Convert accumulated details to sorted arrays
  Object.keys(detailAcc).forEach((key) => {
    details[key] = Object.values(detailAcc[key]).sort((a, b) => b.valor - a.valor);
  });

  values["receita_bruta"] = values["receita_vendas"];
  const totalDeducoes = DEDUCOES_KEYS.reduce((s, k) => s + (values[k] ?? 0), 0);
  values["deducoes_vendas"] = totalDeducoes;
  values["receita_liquida"] = values["receita_bruta"] - totalDeducoes;

  const totalCustosVar = CUSTOS_VARIAVEIS_KEYS.reduce((s, k) => s + (values[k] ?? 0), 0);
  values["custos_variaveis_header"] = totalCustosVar;

  values["margem_contribuicao"] = values["receita_liquida"] - totalCustosVar;
  values["pct_margem_contribuicao"] = values["receita_bruta"] > 0
    ? (values["margem_contribuicao"] / values["receita_bruta"]) * 100 : 0;

  const totalCustosFixos = CUSTOS_FIXOS_KEYS.reduce((s, k) => s + (values[k] ?? 0), 0);
  values["custos_fixos_header"] = totalCustosFixos;

  values["resultado_operacional"] = values["margem_contribuicao"] - totalCustosFixos;

  const resultadoNaoOp = (values["receitas_nao_operacionais"] ?? 0) - (values["gastos_nao_operacionais"] ?? 0);
  values["resultado_nao_op_header"] = resultadoNaoOp;

  values["lair"] = values["resultado_operacional"] + resultadoNaoOp;
  values["ir_csll_header"] = values["ir_csll"] ?? 0;
  values["lucro_liquido"] = values["lair"] - (values["ir_csll"] ?? 0);
  values["pct_margem_liquida"] = values["receita_bruta"] > 0
    ? (values["lucro_liquido"] / values["receita_bruta"]) * 100 : 0;

  return { values, details };
}

function accDetail(
  acc: Record<string, Record<string, DetailEntry>>,
  key: string,
  nomeCategoria: string,
  descricaoCategoria: string,
  valor: number
) {
  if (!acc[key]) acc[key] = {};
  const detailKey = `${nomeCategoria}||${descricaoCategoria}`;
  if (!acc[key][detailKey]) {
    acc[key][detailKey] = { nomeCategoria, descricaoCategoria, valor: 0, count: 0 };
  }
  acc[key][detailKey].valor += valor;
  acc[key][detailKey].count += 1;
}

export default function DRE() {
  const { data: movs, isLoading } = useMovimentacoesFinanceiras();
  const { data: categorias } = useCategorias();
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString());
  const [mesSelecionado, setMesSelecionado] = useState("todos");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const allKeys = DRE_STRUCTURE.filter((r) => r.type === "item").map((r) => r.key);
    setExpandedRows(new Set(allKeys));
  };

  const collapseAll = () => setExpandedRows(new Set());

  const catMap = useMemo(() => {
    const map: Record<string, { nome: string; grupoDre: string; descricao: string }> = {};
    (categorias ?? []).forEach((c) => {
      map[c.id] = {
        nome: c.nome_categoria ?? "Sem categoria",
        grupoDre: c.grupo_dre ?? "",
        descricao: c.descricao_categoria ?? c.nome_categoria ?? "",
      };
    });
    return map;
  }, [categorias]);

  const anos = useMemo(() => {
    const set = new Set<string>();
    (movs ?? []).forEach((m) => { if (m.data) set.add(m.data.substring(0, 4)); });
    if (set.size === 0) set.add(new Date().getFullYear().toString());
    return [...set].sort().reverse();
  }, [movs]);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    (movs ?? []).forEach((m) => {
      if (m.data && m.data.startsWith(anoSelecionado)) set.add(m.data.substring(0, 7));
    });
    return [...set].sort();
  }, [movs, anoSelecionado]);

  // DRE uses transaction date (m.data = data base / competência)
  const filtered = useMemo(() => {
    return (movs ?? []).filter((m) => {
      if (!m.data || !m.data.startsWith(anoSelecionado)) return false;
      if (mesSelecionado !== "todos" && !m.data.startsWith(mesSelecionado)) return false;
      return true;
    });
  }, [movs, anoSelecionado, mesSelecionado]);

  const dreData = useMemo(() => calculateDre(filtered, catMap), [filtered, catMap]);

  const monthlyDre = useMemo(() => {
    if (mesSelecionado !== "todos") return null;
    const data: Record<string, Record<string, number>> = {};
    mesesDisponiveis.forEach((mes) => {
      const mMovs = filtered.filter((m) => m.data?.startsWith(mes));
      const { values } = calculateDre(mMovs, catMap);
      data[mes] = values;
    });
    return data;
  }, [filtered, mesSelecionado, mesesDisponiveis, catMap]);

  const insights = useMemo(() => {
    const tips: { icon: React.ReactNode; text: string; type: "success" | "warning" | "danger" }[] = [];
    const v = dreData.values;

    if (v["receita_bruta"] > 0) {
      const mc = v["pct_margem_contribuicao"];
      if (mc < 30) {
        tips.push({ icon: <AlertTriangle className="h-4 w-4" />, text: `Margem de contribuição de ${mc.toFixed(1)}% está baixa. Revise custos variáveis e deduções.`, type: "danger" });
      } else if (mc < 50) {
        tips.push({ icon: <TrendingDown className="h-4 w-4" />, text: `Margem de contribuição de ${mc.toFixed(1)}%. Há espaço para otimização.`, type: "warning" });
      } else {
        tips.push({ icon: <TrendingUp className="h-4 w-4" />, text: `Margem de contribuição saudável de ${mc.toFixed(1)}%.`, type: "success" });
      }

      const deducPct = (v["deducoes_vendas"] / v["receita_bruta"]) * 100;
      if (deducPct > 20) {
        tips.push({ icon: <AlertTriangle className="h-4 w-4" />, text: `Deduções representam ${deducPct.toFixed(1)}% da receita bruta. Verifique taxas e impostos.`, type: "warning" });
      }
    }

    if (v["lucro_liquido"] < 0) {
      tips.push({ icon: <AlertTriangle className="h-4 w-4" />, text: "Resultado líquido negativo! Ação urgente necessária.", type: "danger" });
    }

    return tips;
  }, [dreData]);

  const getRowStyle = (type: DreRowType) => {
    switch (type) {
      case "header": return "font-semibold text-destructive bg-accent/20";
      case "item": return "text-foreground pl-6";
      case "subtotal": return "font-semibold text-foreground border-t border-border bg-accent/30";
      case "percent": return "font-semibold text-primary bg-accent/10";
      case "total": return "font-bold text-lg border-t-2 border-foreground bg-accent/50";
      default: return "";
    }
  };

  const getValueColor = (key: string, value: number) => {
    if (["lucro_liquido", "lair", "resultado_operacional", "margem_contribuicao", "receita_liquida"].includes(key)) {
      return value >= 0 ? "text-success" : "text-destructive";
    }
    if (["receita_bruta", "receita_vendas", "receitas_nao_operacionais"].includes(key)) return "";
    if (["pct_margem_contribuicao", "pct_margem_liquida"].includes(key)) {
      return value >= 0 ? "text-primary" : "text-destructive";
    }
    return "";
  };

  const renderValue = (row: DreRow, value: number) => {
    if (row.type === "percent") return formatPercent(value);
    if (row.type === "header" && row.sign === "-") return value > 0 ? `(${formatCurrency(value)})` : formatCurrency(0);
    if (row.type === "item" && DEDUCOES_KEYS.includes(row.key)) return value > 0 ? `(${formatCurrency(value)})` : "-";
    if (row.type === "item" && [...CUSTOS_VARIAVEIS_KEYS, ...CUSTOS_FIXOS_KEYS, "gastos_nao_operacionais", "ir_csll"].includes(row.key)) {
      return value > 0 ? `(${formatCurrency(value)})` : "-";
    }
    return value !== 0 ? formatCurrency(value) : "-";
  };

  const calcAV = (value: number, receitaBruta: number) => {
    if (receitaBruta === 0) return "0%";
    return `${((value / receitaBruta) * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">DRE</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Demonstrativo de Resultado do Exercício — Confecção
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Baseado na data de competência das transações (regime de competência)
          </p>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                DRE {mesSelecionado === "todos" ? `Anual ${anoSelecionado}` : getMonthLabel(mesSelecionado)}
              </CardTitle>
              <div className="flex gap-2">
                <button onClick={expandAll} className="text-xs text-primary hover:underline">Expandir tudo</button>
                <span className="text-muted-foreground text-xs">|</span>
                <button onClick={collapseAll} className="text-xs text-primary hover:underline">Recolher tudo</button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : (
                <div className="space-y-0">
                  <div className="flex justify-between items-center px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                    <span>Descrição</span>
                    <div className="flex gap-8">
                      <span className="w-32 text-right">{mesSelecionado === "todos" ? anoSelecionado : getMonthLabel(mesSelecionado)}</span>
                      <span className="w-16 text-right">AV%</span>
                    </div>
                  </div>

                  {DRE_STRUCTURE.map((row) => {
                    const val = dreData.values[row.key] ?? 0;
                    const detailsList = dreData.details[row.key] ?? [];
                    const hasDetails = detailsList.length > 0 && row.type === "item";
                    const isExpanded = expandedRows.has(row.key);
                    const rb = dreData.values["receita_bruta"] ?? 0;

                    return (
                      <div key={row.key}>
                        <div
                          className={`flex justify-between items-center px-4 py-2.5 rounded ${getRowStyle(row.type)} ${hasDetails ? "cursor-pointer hover:bg-accent/40 transition-colors" : ""}`}
                          onClick={hasDetails ? () => toggleRow(row.key) : undefined}
                        >
                          <span className="text-sm flex items-center gap-1.5">
                            {hasDetails && (
                              isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {row.label}
                            {hasDetails && (
                              <span className="text-xs text-muted-foreground ml-1">({detailsList.length})</span>
                            )}
                          </span>
                          <div className="flex gap-8 items-center">
                            <span className={`w-32 text-right font-mono text-sm ${getValueColor(row.key, val)}`}>
                              {renderValue(row, val)}
                            </span>
                            <span className={`w-16 text-right font-mono text-xs ${getValueColor(row.key, val)}`}>
                              {row.type === "percent" ? formatPercent(val) : (rb > 0 && row.type !== "header" ? calcAV(Math.abs(val), rb) : "0%")}
                            </span>
                          </div>
                        </div>

                        {hasDetails && isExpanded && (
                          <div className="ml-10 border-l-2 border-accent/50 mb-1">
                            {detailsList.map((d, idx) => (
                              <TooltipProvider key={idx}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex justify-between items-center px-4 py-1.5 text-xs hover:bg-accent/10 rounded-r transition-colors">
                                      <div className="flex flex-col">
                                        <span className="text-foreground/80 font-medium">{d.descricaoCategoria}</span>
                                        <span className="text-muted-foreground text-[10px]">
                                          {d.nomeCategoria} • {d.count} lançamento{d.count > 1 ? "s" : ""}
                                        </span>
                                      </div>
                                      <div className="flex gap-8 items-center">
                                        <span className="font-mono w-32 text-right">{formatCurrency(d.valor)}</span>
                                        <span className="font-mono w-16 text-right text-muted-foreground">
                                          {rb > 0 ? calcAV(d.valor, rb) : "0%"}
                                        </span>
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    <p className="font-semibold">{d.nomeCategoria}</p>
                                    <p className="text-xs">{d.descricaoCategoria}</p>
                                    <p className="text-xs mt-1">{d.count} lançamento(s) totalizando {formatCurrency(d.valor)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
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
                      <th className="text-left py-2 px-3 min-w-[220px]">Descrição</th>
                      {mesesDisponiveis.map((m) => (
                        <th key={m} className="text-right py-2 px-3 min-w-[110px]">{getMonthLabel(m)}</th>
                      ))}
                      <th className="text-right py-2 px-3 min-w-[120px] font-bold">{anoSelecionado}</th>
                      <th className="text-right py-2 px-3 min-w-[60px]">AV%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DRE_STRUCTURE.map((row) => {
                      const totalVal = dreData.values[row.key] ?? 0;
                      const rb = dreData.values["receita_bruta"] ?? 0;

                      return (
                        <tr key={row.key} className={`border-b border-border/50 ${getRowStyle(row.type)}`}>
                          <td className="py-2 px-3 text-sm">{row.label}</td>
                          {mesesDisponiveis.map((m) => {
                            const val = monthlyDre[m]?.[row.key] ?? 0;
                            return (
                              <td key={m} className={`text-right py-2 px-3 font-mono text-xs ${getValueColor(row.key, val)}`}>
                                {renderValue(row, val)}
                              </td>
                            );
                          })}
                          <td className={`text-right py-2 px-3 font-mono font-bold text-xs ${getValueColor(row.key, totalVal)}`}>
                            {renderValue(row, totalVal)}
                          </td>
                          <td className={`text-right py-2 px-3 font-mono text-xs ${getValueColor(row.key, totalVal)}`}>
                            {row.type === "percent" ? formatPercent(totalVal) : (rb > 0 ? calcAV(Math.abs(totalVal), rb) : "0%")}
                          </td>
                        </tr>
                      );
                    })}
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
