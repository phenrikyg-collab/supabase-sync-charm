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

// Ordered Faixas for DRE display
const FAIXA_ORDER = [
  "RECEITAS",
  "DEDUÇÕES SOBRE VENDAS",
  "CUSTOS VARIÁVEIS",
  "DESPESAS",
  "RESULTADO NÃO OPERACIONAL",
  "IMPOSTOS DIRETOS",
];

const FAIXA_SIGN: Record<string, "+" | "-" | "±"> = {
  "RECEITAS": "+",
  "DEDUÇÕES SOBRE VENDAS": "-",
  "CUSTOS VARIÁVEIS": "-",
  "DESPESAS": "-",
  "RESULTADO NÃO OPERACIONAL": "±",
  "IMPOSTOS DIRETOS": "-",
};

// Normalize DB grupo_dre values to standard FAIXA_ORDER names
function normalizeFaixa(grupoDre: string): string {
  const upper = grupoDre.toUpperCase().trim();
  // Direct match
  if (FAIXA_ORDER.includes(upper)) return upper;
  // Map known DB variants
  const FAIXA_MAP: Record<string, string> = {
    "CUSTOS FIXOS": "DESPESAS",
    "CUSTOS VARIÁVEIS": "CUSTOS VARIÁVEIS",
    "DEDUÇÕES SOBRE VENDAS": "DEDUÇÕES SOBRE VENDAS",
    "RECEITAS": "RECEITAS",
    "RESULTADO NÃO OPERACIONAL": "RESULTADO NÃO OPERACIONAL",
    "IMPOSTOS DIRETOS": "IMPOSTOS DIRETOS",
  };
  return FAIXA_MAP[upper] || "";
}

interface CatInfo {
  id: string;
  grupoDre: string;
  nomeCategoria: string;
  descricaoCategoria: string;
  tipo: string;
  categoriaPaiId: string | null;
}

interface PlanoTransaction {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  dataVencimento: string | null;
  parcela: string | null;
}

interface PlanoEntry {
  descricao: string;
  valor: number;
  count: number;
  transactions: PlanoTransaction[];
}

interface CategoriaGroup {
  nomeCategoria: string;
  valor: number;
  planos: PlanoEntry[];
}

interface FaixaGroup {
  faixa: string;
  valor: number;
  categorias: CategoriaGroup[];
}

function buildDreData(
  movs: any[],
  catMap: Record<string, CatInfo>,
) {
  // Accumulate: faixa → categoria → plano → { valor, count, transactions }
  const acc: Record<string, Record<string, Record<string, { valor: number; count: number; transactions: PlanoTransaction[] }>>> = {};

  const addEntry = (f: string, c: string, p: string, val: number, m: any) => {
    if (!acc[f]) acc[f] = {};
    if (!acc[f][c]) acc[f][c] = {};
    if (!acc[f][c][p]) acc[f][c][p] = { valor: 0, count: 0, transactions: [] };
    acc[f][c][p].valor += val;
    acc[f][c][p].count += 1;
    acc[f][c][p].transactions.push({
      id: m.id,
      descricao: m.descricao || "—",
      valor: val,
      data: m.data,
      dataVencimento: m.data_vencimento || null,
      parcela: m.parcela_info || null,
    });
  };

  movs.forEach((m) => {
    if (m.impacta_dre === false) return;

    const cat = m.categoria_id ? catMap[m.categoria_id] : null;
    const faixa = cat?.grupoDre || "";
    const categoria = cat?.nomeCategoria || "Sem categoria";
    const plano = cat?.descricaoCategoria || m.descricao || "Outros";
    const isReceita = m.tipo === "entrada";

    // Handle Bling sales specially
    if (isReceita && m.origem === "bling") {
      addEntry("RECEITAS", "Receita com Vendas", "Venda de produtos", m.valor ?? 0, m);

      // Descontos go to deduções
      const desconto = m.valor_desconto ?? 0;
      if (desconto > 0) {
        addEntry("DEDUÇÕES SOBRE VENDAS", "Estornos", "Descontos em vendas", desconto, m);
      }
      return;
    }

    // For receita entries not from bling
    if (isReceita && faixa) {
      addEntry(faixa, categoria, plano, Math.abs(m.valor ?? 0), m);
      return;
    }

    // Despesas / saídas
    if (!faixa) return; // skip uncategorized for DRE
    addEntry(faixa, categoria, plano, Math.abs(m.valor ?? 0), m);
  });

  // Build structured groups
  const faixas: FaixaGroup[] = FAIXA_ORDER.map((faixa) => {
    const catAcc = acc[faixa] || {};
    const categorias: CategoriaGroup[] = Object.entries(catAcc)
      .map(([nomeCategoria, planoAcc]) => {
        const planos: PlanoEntry[] = Object.entries(planoAcc)
          .map(([descricao, { valor, count, transactions }]) => ({ descricao, valor, count, transactions }))
          .sort((a, b) => b.valor - a.valor);
        const valor = planos.reduce((s, p) => s + p.valor, 0);
        return { nomeCategoria, valor, planos };
      })
      .sort((a, b) => b.valor - a.valor);
    const valor = categorias.reduce((s, c) => s + c.valor, 0);
    return { faixa, valor, categorias };
  });

  // Calculate subtotals
  const receita = faixas.find((f) => f.faixa === "RECEITAS")?.valor ?? 0;
  const deducoes = faixas.find((f) => f.faixa === "DEDUÇÕES SOBRE VENDAS")?.valor ?? 0;
  const receitaLiquida = receita - deducoes;
  const custosVar = faixas.find((f) => f.faixa === "CUSTOS VARIÁVEIS")?.valor ?? 0;
  const margemContribuicao = receitaLiquida - custosVar;
  const pctMargemContribuicao = receita > 0 ? (margemContribuicao / receita) * 100 : 0;
  const despesas = faixas.find((f) => f.faixa === "DESPESAS")?.valor ?? 0;
  const resultadoOperacional = margemContribuicao - despesas;

  const faixaNaoOp = faixas.find((f) => f.faixa === "RESULTADO NÃO OPERACIONAL");
  const receitasNaoOp = faixaNaoOp?.categorias.find((c) => c.nomeCategoria === "Receitas não Operacionais")?.valor ?? 0;
  const gastosNaoOp = faixaNaoOp?.categorias.find((c) => c.nomeCategoria === "Gastos não Operacionais")?.valor ?? 0;
  const resultadoNaoOp = receitasNaoOp - gastosNaoOp;

  const lair = resultadoOperacional + resultadoNaoOp;
  const impostos = faixas.find((f) => f.faixa === "IMPOSTOS DIRETOS")?.valor ?? 0;
  const lucroLiquido = lair - impostos;
  const pctMargemLiquida = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

  return {
    faixas,
    receita,
    deducoes,
    receitaLiquida,
    custosVar,
    margemContribuicao,
    pctMargemContribuicao,
    despesas,
    resultadoOperacional,
    receitasNaoOp,
    gastosNaoOp,
    resultadoNaoOp,
    lair,
    impostos,
    lucroLiquido,
    pctMargemLiquida,
  };
}

export default function DRE() {
  const { data: movs, isLoading } = useMovimentacoesFinanceiras();
  const { data: categorias } = useCategorias();
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString());
  const [mesSelecionado, setMesSelecionado] = useState("todos");
  const [expandedFaixas, setExpandedFaixas] = useState<Set<string>>(new Set());
  const [expandedCategorias, setExpandedCategorias] = useState<Set<string>>(new Set());

  const toggleFaixa = (key: string) => {
    setExpandedFaixas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleCategoria = (key: string) => {
    setExpandedCategorias((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedFaixas(new Set(FAIXA_ORDER));
    const allCats = new Set<string>();
    dreData.faixas.forEach((f) => f.categorias.forEach((c) => allCats.add(`${f.faixa}||${c.nomeCategoria}`)));
    setExpandedCategorias(allCats);
  };

  const collapseAll = () => {
    setExpandedFaixas(new Set());
    setExpandedCategorias(new Set());
  };

  const catMap = useMemo(() => {
    const map: Record<string, CatInfo> = {};
    (categorias ?? []).forEach((c) => {
      const rawGrupo = c.grupo_dre ?? "";
      const normalized = normalizeFaixa(rawGrupo);
      // Skip categories marked as "Não listar no DRE"
      if (rawGrupo.toUpperCase().includes("NÃO LISTAR")) return;
      map[c.id] = {
        id: c.id,
        grupoDre: normalized,
        nomeCategoria: c.nome_categoria ?? "Sem categoria",
        descricaoCategoria: c.descricao_categoria ?? c.nome_categoria ?? "",
        tipo: c.tipo ?? "despesa",
        categoriaPaiId: c.categoria_pai_id ?? null,
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

  const filtered = useMemo(() => {
    return (movs ?? []).filter((m) => {
      if (!m.data || !m.data.startsWith(anoSelecionado)) return false;
      if (mesSelecionado !== "todos" && !m.data.startsWith(mesSelecionado)) return false;
      return true;
    });
  }, [movs, anoSelecionado, mesSelecionado]);

  const dreData = useMemo(() => buildDreData(filtered, catMap), [filtered, catMap]);

  const insights = useMemo(() => {
    const tips: { icon: React.ReactNode; text: string; type: "success" | "warning" | "danger" }[] = [];
    const mc = dreData.pctMargemContribuicao;
    if (dreData.receita > 0) {
      if (mc < 30) {
        tips.push({ icon: <AlertTriangle className="h-4 w-4" />, text: `Margem de contribuição de ${mc.toFixed(1)}% está baixa. Revise custos variáveis e deduções.`, type: "danger" });
      } else if (mc < 50) {
        tips.push({ icon: <TrendingDown className="h-4 w-4" />, text: `Margem de contribuição de ${mc.toFixed(1)}%. Há espaço para otimização.`, type: "warning" });
      } else {
        tips.push({ icon: <TrendingUp className="h-4 w-4" />, text: `Margem de contribuição saudável de ${mc.toFixed(1)}%.`, type: "success" });
      }

      const deducPct = (dreData.deducoes / dreData.receita) * 100;
      if (deducPct > 20) {
        tips.push({ icon: <AlertTriangle className="h-4 w-4" />, text: `Deduções representam ${deducPct.toFixed(1)}% da receita bruta. Verifique taxas e impostos.`, type: "warning" });
      }
    }
    if (dreData.lucroLiquido < 0) {
      tips.push({ icon: <AlertTriangle className="h-4 w-4" />, text: "Resultado líquido negativo! Ação urgente necessária.", type: "danger" });
    }
    return tips;
  }, [dreData]);

  const calcAV = (value: number) => {
    if (dreData.receita === 0) return "0%";
    return `${((value / dreData.receita) * 100).toFixed(1)}%`;
  };

  const getValueColor = (value: number, isResult: boolean) => {
    if (isResult) return value >= 0 ? "text-success" : "text-destructive";
    return "";
  };

  const renderSubtotalRow = (label: string, value: number, isResult = true, isBold = false, isPercent = false) => (
    <div className={`flex justify-between items-center px-4 py-2.5 rounded ${isBold ? "font-bold text-lg border-t-2 border-foreground bg-accent/50" : "font-semibold border-t border-border bg-accent/30"}`}>
      <span className="text-sm">{label}</span>
      <div className="flex gap-8 items-center">
        <span className={`w-32 text-right font-mono text-sm ${getValueColor(value, isResult)}`}>
          {isPercent ? formatPercent(value) : formatCurrency(value)}
        </span>
        <span className={`w-16 text-right font-mono text-xs ${getValueColor(value, isResult)}`}>
          {isPercent ? formatPercent(value) : calcAV(Math.abs(value))}
        </span>
      </div>
    </div>
  );

  const renderFaixaBlock = (fg: FaixaGroup) => {
    const sign = FAIXA_SIGN[fg.faixa] ?? "-";
    const isFaixaExpanded = expandedFaixas.has(fg.faixa);
    const signLabel = sign === "+" ? "(+)" : sign === "-" ? "(-)" : "(±)";

    return (
      <div key={fg.faixa}>
        {/* Faixa header */}
        <div
          className="flex justify-between items-center px-4 py-2.5 rounded font-semibold text-destructive bg-accent/20 cursor-pointer hover:bg-accent/30 transition-colors"
          onClick={() => toggleFaixa(fg.faixa)}
        >
          <span className="text-sm flex items-center gap-1.5">
            {isFaixaExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            {signLabel} {fg.faixa}
            <span className="text-xs text-muted-foreground ml-1">({fg.categorias.length})</span>
          </span>
          <div className="flex gap-8 items-center">
            <span className="w-32 text-right font-mono text-sm">
              {sign === "-" && fg.valor > 0 ? `(${formatCurrency(fg.valor)})` : formatCurrency(fg.valor)}
            </span>
            <span className="w-16 text-right font-mono text-xs">{calcAV(fg.valor)}</span>
          </div>
        </div>

        {/* Categorias */}
        {isFaixaExpanded && fg.categorias.map((cg) => {
          const catKey = `${fg.faixa}||${cg.nomeCategoria}`;
          const isCatExpanded = expandedCategorias.has(catKey);

          return (
            <div key={catKey}>
              {/* Categoria row */}
              <div
                className="flex justify-between items-center px-4 py-2 pl-8 text-foreground cursor-pointer hover:bg-accent/20 transition-colors"
                onClick={() => toggleCategoria(catKey)}
              >
                <span className="text-sm flex items-center gap-1.5">
                  {cg.planos.length > 1 ? (
                    isCatExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  ) : <span className="w-3" />}
                  {cg.nomeCategoria}
                  <span className="text-xs text-muted-foreground">({cg.planos.reduce((s, p) => s + p.count, 0)})</span>
                </span>
                <div className="flex gap-8 items-center">
                  <span className="w-32 text-right font-mono text-sm">
                    {sign === "-" && cg.valor > 0 ? `(${formatCurrency(cg.valor)})` : formatCurrency(cg.valor)}
                  </span>
                  <span className="w-16 text-right font-mono text-xs text-muted-foreground">{calcAV(cg.valor)}</span>
                </div>
              </div>

              {/* Planos de conta */}
              {isCatExpanded && cg.planos.map((p, idx) => (
                <TooltipProvider key={idx}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex justify-between items-center px-4 py-1.5 pl-14 text-xs hover:bg-accent/10 rounded transition-colors">
                        <div className="flex flex-col">
                          <span className="text-foreground/80 font-medium">{p.descricao}</span>
                          <span className="text-muted-foreground text-[10px]">
                            {p.count} lançamento{p.count > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex gap-8 items-center">
                          <span className="font-mono w-32 text-right">{formatCurrency(p.valor)}</span>
                          <span className="font-mono w-16 text-right text-muted-foreground">{calcAV(p.valor)}</span>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="font-semibold">{cg.nomeCategoria}</p>
                      <p className="text-xs">{p.descricao}</p>
                      <p className="text-xs mt-1">{p.count} lançamento(s) totalizando {formatCurrency(p.valor)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          );
        })}
      </div>
    );
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
              {/* Header */}
              <div className="flex justify-between items-center px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                <span>Descrição</span>
                <div className="flex gap-8">
                  <span className="w-32 text-right">{mesSelecionado === "todos" ? anoSelecionado : getMonthLabel(mesSelecionado)}</span>
                  <span className="w-16 text-right">AV%</span>
                </div>
              </div>

              {/* RECEITAS */}
              {renderFaixaBlock(dreData.faixas[0])}

              {/* DEDUÇÕES SOBRE VENDAS */}
              {renderFaixaBlock(dreData.faixas[1])}

              {/* = Receita Líquida */}
              {renderSubtotalRow("(=) Receita Líquida", dreData.receitaLiquida)}

              {/* CUSTOS VARIÁVEIS */}
              {renderFaixaBlock(dreData.faixas[2])}

              {/* = Margem de Contribuição */}
              {renderSubtotalRow("(=) Margem de Contribuição", dreData.margemContribuicao)}
              {renderSubtotalRow("(=) % Margem de Contribuição", dreData.pctMargemContribuicao, true, false, true)}

              {/* DESPESAS */}
              {renderFaixaBlock(dreData.faixas[3])}

              {/* = Resultado Operacional */}
              {renderSubtotalRow("(=) Resultado Operacional", dreData.resultadoOperacional)}

              {/* RESULTADO NÃO OPERACIONAL */}
              {renderFaixaBlock(dreData.faixas[4])}

              {/* = LAIR */}
              {renderSubtotalRow("(=) Lucro Antes do Imposto de Renda (LAIR)", dreData.lair)}

              {/* IMPOSTOS DIRETOS */}
              {renderFaixaBlock(dreData.faixas[5])}

              {/* = Lucro Líquido */}
              {renderSubtotalRow("(=) Lucro Líquido", dreData.lucroLiquido, true, true)}
              {renderSubtotalRow("(=) % Margem Líquida", dreData.pctMargemLiquida, true, false, true)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
