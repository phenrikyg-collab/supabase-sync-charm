import { useMemo, useState } from "react";
import { format, addMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMovimentacoesFinanceiras, useCategorias, useMetasFinanceiras } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Target, AlertTriangle, BarChart3, ArrowUpRight, Percent } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart, ReferenceLine } from "recharts";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatPercent(v: number) {
  return `${v.toFixed(1)}%`;
}

export default function CustosFixos() {
  const { data: movs, isLoading } = useMovimentacoesFinanceiras();
  const { data: categorias } = useCategorias();
  const { data: metas } = useMetasFinanceiras();

  const hoje = new Date();
  const mesAtual = format(hoje, "yyyy-MM");

  // Build 3 months of projection: current + 3 future
  const mesesProjecao = useMemo(() => {
    const meses: string[] = [];
    for (let i = 0; i < 4; i++) {
      meses.push(format(addMonths(hoje, i), "yyyy-MM"));
    }
    return meses;
  }, []);

  // Identify recurring (fixed) expenses
  const custosFixos = useMemo(() => {
    if (!movs) return [];
    return movs.filter(m =>
      m.tipo === "saida" &&
      (m.frequencia === "Mensal" || m.frequencia === "mensal" ||
       (m as any).frequencia_tipo === "indeterminada" ||
       (m as any).frequencia_tipo === "por_periodo")
    );
  }, [movs]);

  // Group by recorrencia_grupo_id or description for grouping
  const gruposRecorrentes = useMemo(() => {
    const map: Record<string, { descricao: string; valor: number; categoria_id: string | null; frequencia_tipo: string | null; frequencia_meses: number | null; meses: Set<string> }> = {};
    custosFixos.forEach(m => {
      const key = (m as any).recorrencia_grupo_id || m.descricao || m.id;
      if (!map[key]) {
        map[key] = {
          descricao: (m.descricao || "").replace(/\s*\(\d+\/[∞\d]+\)\s*$/, ""),
          valor: Math.abs(m.valor),
          categoria_id: m.categoria_id,
          frequencia_tipo: (m as any).frequencia_tipo || null,
          frequencia_meses: (m as any).frequencia_meses || null,
          meses: new Set(),
        };
      }
      if (m.data) map[key].meses.add(m.data.substring(0, 7));
    });
    return Object.values(map);
  }, [custosFixos]);

  // Total custos fixos mensais projetados por mês
  const projecaoPorMes = useMemo(() => {
    return mesesProjecao.map(mes => {
      let totalFixo = 0;
      gruposRecorrentes.forEach(g => {
        // Check if this expense applies to this month
        if (g.frequencia_tipo === "por_periodo") {
          // Only count if within the defined period
          if (g.meses.has(mes)) totalFixo += g.valor;
        } else {
          // indeterminada or legacy "Mensal" - always project
          totalFixo += g.valor;
        }
      });
      return { mes, totalFixo };
    });
  }, [mesesProjecao, gruposRecorrentes]);

  // Get meta mensal for break-even
  const metaAtual = useMemo(() => {
    if (!metas) return null;
    return metas.find(m => m.mes === mesAtual) || metas[metas.length - 1] || null;
  }, [metas, mesAtual]);

  const receitaMeta = metaAtual?.meta_mensal || 0;

  // Actual expenses from current month (all saida types)
  const despesasMesAtual = useMemo(() => {
    if (!movs) return { fixo: 0, variavel: 0, total: 0 };
    const mesMovs = movs.filter(m => m.tipo === "saida" && m.data?.startsWith(mesAtual));
    let fixo = 0, variavel = 0;
    mesMovs.forEach(m => {
      const isFixo = m.frequencia === "Mensal" || m.frequencia === "mensal" ||
        (m as any).frequencia_tipo === "indeterminada" || (m as any).frequencia_tipo === "por_periodo";
      if (isFixo) fixo += Math.abs(m.valor);
      else variavel += Math.abs(m.valor);
    });
    return { fixo, variavel, total: fixo + variavel };
  }, [movs, mesAtual]);

  // KPIs
  const totalFixoMensal = projecaoPorMes[0]?.totalFixo || 0;
  const pontoEquilibrio = receitaMeta > 0 ? totalFixoMensal : 0;
  const margemContribuicao = receitaMeta > 0 ? ((receitaMeta - totalFixoMensal) / receitaMeta) * 100 : 0;
  const comprometimentoReceita = receitaMeta > 0 ? (totalFixoMensal / receitaMeta) * 100 : 0;
  const folga = receitaMeta - totalFixoMensal;

  // Category breakdown
  const catMap = Object.fromEntries((categorias ?? []).map(c => [c.id, c.descricao_categoria || c.nome_categoria || "Sem categoria"]));

  const custosPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    gruposRecorrentes.forEach(g => {
      const cat = g.categoria_id ? (catMap[g.categoria_id] || "Sem categoria") : "Sem categoria";
      map[cat] = (map[cat] || 0) + g.valor;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [gruposRecorrentes, catMap]);

  // Chart data
  const chartData = projecaoPorMes.map(p => ({
    mes: format(parseISO(p.mes + "-01"), "MMM/yy", { locale: ptBR }),
    "Custos Fixos": p.totalFixo,
    "Meta Receita": receitaMeta,
    "Ponto de Equilíbrio": p.totalFixo,
  }));

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--destructive))",
    "hsl(210, 70%, 55%)",
    "hsl(30, 80%, 55%)",
    "hsl(280, 60%, 55%)",
    "hsl(160, 60%, 45%)",
  ];

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Custos Fixos & Projeção</h1>
          <p className="text-sm text-muted-foreground">
            Análise de despesas recorrentes com projeção de 3 meses
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              Custos Fixos / Mês
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalFixoMensal)}</p>
            <p className="text-xs text-muted-foreground mt-1">{gruposRecorrentes.length} despesas recorrentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Target className="h-3.5 w-3.5" />
              Ponto de Equilíbrio
            </div>
            <p className="text-xl font-bold">{formatCurrency(pontoEquilibrio)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Receita mínima para cobrir fixos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Percent className="h-3.5 w-3.5" />
              Margem de Contribuição
            </div>
            <p className={`text-xl font-bold ${margemContribuicao < 30 ? "text-destructive" : margemContribuicao < 50 ? "text-warning" : "text-success"}`}>
              {formatPercent(margemContribuicao)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Meta: {formatCurrency(receitaMeta)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Folga Financeira
            </div>
            <p className={`text-xl font-bold ${folga < 0 ? "text-destructive" : "text-success"}`}>
              {formatCurrency(folga)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {comprometimentoReceita > 0 ? `${formatPercent(comprometimentoReceita)} comprometido` : "Sem meta definida"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Category breakdown */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Projeção Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="Custos Fixos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  {receitaMeta > 0 && (
                    <ReferenceLine y={receitaMeta} stroke="hsl(var(--primary))" strokeDasharray="5 5" label={{ value: `Meta: ${formatCurrency(receitaMeta)}`, position: "top", fill: "hsl(var(--primary))" }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {custosPorCategoria.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma despesa recorrente encontrada</p>
              )}
              {custosPorCategoria.map(([cat, valor], idx) => (
                <div key={cat} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-sm truncate max-w-[150px]">{cat}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{formatCurrency(valor)}</span>
                    {totalFixoMensal > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({((valor / totalFixoMensal) * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projection Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Projeção de Custos Fixos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Custos Fixos</TableHead>
                <TableHead className="text-right">Meta Receita</TableHead>
                <TableHead className="text-right">Margem Contribuição</TableHead>
                <TableHead className="text-right">Comprometimento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projecaoPorMes.map(p => {
                const mc = receitaMeta > 0 ? ((receitaMeta - p.totalFixo) / receitaMeta) * 100 : 0;
                const comp = receitaMeta > 0 ? (p.totalFixo / receitaMeta) * 100 : 0;
                const isFuturo = p.mes > mesAtual;
                return (
                  <TableRow key={p.mes} className={isFuturo ? "opacity-75" : ""}>
                    <TableCell className="font-medium">
                      {format(parseISO(p.mes + "-01"), "MMMM/yyyy", { locale: ptBR })}
                      {isFuturo && <Badge variant="outline" className="ml-2 text-xs">Projeção</Badge>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-destructive">{formatCurrency(p.totalFixo)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(receitaMeta)}</TableCell>
                    <TableCell className={`text-right font-mono ${mc < 30 ? "text-destructive" : "text-success"}`}>
                      {formatPercent(mc)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${comp > 70 ? "text-destructive" : ""}`}>
                      {formatPercent(comp)}
                    </TableCell>
                    <TableCell>
                      {comp > 80 ? (
                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Crítico</Badge>
                      ) : comp > 60 ? (
                        <Badge variant="outline" className="gap-1 border-warning/50 text-warning"><AlertTriangle className="h-3 w-3" /> Atenção</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-success/50 text-success"><ArrowUpRight className="h-3 w-3" /> Saudável</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail: Recurring expenses list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Despesas Recorrentes Ativas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor Mensal</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gruposRecorrentes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma despesa recorrente cadastrada. Marque uma despesa como "Mensal" ao inserir ou importar.
                  </TableCell>
                </TableRow>
              )}
              {gruposRecorrentes
                .sort((a, b) => b.valor - a.valor)
                .map((g, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{g.descricao}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {g.categoria_id ? catMap[g.categoria_id] || "—" : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(g.valor)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {g.frequencia_tipo === "por_periodo" ? `${g.frequencia_meses || "?"} meses` : "Até cancelar"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {totalFixoMensal > 0 ? formatPercent((g.valor / totalFixoMensal) * 100) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
