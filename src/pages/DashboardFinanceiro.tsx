import { useState, useMemo } from "react";
import { useMovimentacoesFinanceiras, useCategorias, useMetasFinanceiras } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Wallet, CreditCard, Clock, PieChart,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { format, startOfMonth, endOfMonth, isAfter, isBefore, addDays, parseISO } from "date-fns";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatCurrencyShort(v: number) {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return formatCurrency(v);
}

const CHART_COLORS = [
  "hsl(38, 60%, 50%)",
  "hsl(152, 60%, 40%)",
  "hsl(220, 60%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(280, 60%, 50%)",
  "hsl(190, 60%, 45%)",
  "hsl(340, 60%, 50%)",
  "hsl(60, 60%, 45%)",
];

export default function DashboardFinanceiro() {
  const { data: movs, isLoading } = useMovimentacoesFinanceiras();
  const { data: categorias } = useCategorias();
  const { data: metas } = useMetasFinanceiras();

  const now = new Date();
  const currentMonth = format(now, "yyyy-MM");
  const [mesSelecionado, setMesSelecionado] = useState(currentMonth);

  const catMap = useMemo(() => {
    const map: Record<string, string> = {};
    (categorias ?? []).forEach((c) => { map[c.id] = c.nome_categoria ?? "Sem categoria"; });
    return map;
  }, [categorias]);

  // Available months
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    (movs ?? []).forEach((m) => { if (m.data) set.add(m.data.substring(0, 7)); });
    if (!set.has(currentMonth)) set.add(currentMonth);
    return [...set].sort().reverse();
  }, [movs, currentMonth]);

  // Filtered for selected month
  const mesMovs = useMemo(() =>
    (movs ?? []).filter((m) => m.data?.startsWith(mesSelecionado)),
    [movs, mesSelecionado]
  );

  // ===== KPIs =====
  const kpis = useMemo(() => {
    const receitas = mesMovs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + (m.valor ?? 0), 0);
    const despesas = mesMovs.filter((m) => m.tipo === "saida").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);
    const saldo = receitas - despesas;
    const margemLiquida = receitas > 0 ? ((saldo / receitas) * 100) : 0;

    // Meta do mês
    const meta = metas?.find((m) => m.mes?.startsWith(mesSelecionado));
    const metaValor = meta?.meta_mensal ?? 0;
    const atingimentoMeta = metaValor > 0 ? (receitas / metaValor) * 100 : 0;

    // Contas vencidas (saida, não pago, data < hoje)
    const allMovs = movs ?? [];
    const contasVencidas = allMovs.filter((m) =>
      m.tipo === "saida" &&
      m.status_bling !== "pago" &&
      m.data &&
      isBefore(parseISO(m.data), now)
    );
    const totalVencido = contasVencidas.reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);

    // Próximos 7 dias
    const em7Dias = addDays(now, 7);
    const contasProximas = allMovs.filter((m) =>
      m.tipo === "saida" &&
      m.status_bling !== "pago" &&
      m.data &&
      isAfter(parseISO(m.data), now) &&
      isBefore(parseISO(m.data), em7Dias)
    );
    const totalProximo = contasProximas.reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);

    // Cartão de crédito no mês
    const cartao = mesMovs.filter((m) => m.origem === "cartao_credito").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);

    return { receitas, despesas, saldo, margemLiquida, metaValor, atingimentoMeta, totalVencido, contasVencidas: contasVencidas.length, totalProximo, contasProximas: contasProximas.length, cartao };
  }, [mesMovs, metas, movs, now]);

  // ===== Despesas por Categoria =====
  const despesasPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    mesMovs.filter((m) => m.tipo === "saida").forEach((m) => {
      const cat = m.categoria_id ? catMap[m.categoria_id] ?? "Sem categoria" : "Sem categoria";
      map[cat] = (map[cat] ?? 0) + Math.abs(m.valor ?? 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [mesMovs, catMap]);

  // ===== Evolução mensal (últimos 6 meses) =====
  const evolucaoMensal = useMemo(() => {
    const months = mesesDisponiveis.slice(0, 6).reverse();
    return months.map((mes) => {
      const mMovs = (movs ?? []).filter((m) => m.data?.startsWith(mes));
      const receitas = mMovs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + (m.valor ?? 0), 0);
      const despesas = mMovs.filter((m) => m.tipo === "saida").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);
      const label = mes.substring(5) + "/" + mes.substring(2, 4);
      return { mes: label, Receitas: receitas, Despesas: despesas, Saldo: receitas - despesas };
    });
  }, [movs, mesesDisponiveis]);

  // ===== Top 5 maiores despesas =====
  const top5Despesas = useMemo(() => {
    return mesMovs
      .filter((m) => m.tipo === "saida")
      .sort((a, b) => Math.abs(b.valor ?? 0) - Math.abs(a.valor ?? 0))
      .slice(0, 5);
  }, [mesMovs]);

  const getMonthLabel = (mes: string) => {
    const [y, m] = mes.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(m) - 1]}/${y}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Carregando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Dashboard Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral para tomada de decisão</p>
        </div>
        <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {mesesDisponiveis.map((m) => (
              <SelectItem key={m} value={m}>{getMonthLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receitas</span>
              <div className="p-1.5 rounded-lg bg-success/10">
                <ArrowUpRight className="h-4 w-4 text-success" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.receitas)}</p>
            {kpis.metaValor > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.atingimentoMeta.toFixed(0)}% da meta ({formatCurrencyShort(kpis.metaValor)})
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Despesas</span>
              <div className="p-1.5 rounded-lg bg-destructive/10">
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.despesas)}</p>
            {kpis.cartao > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                💳 {formatCurrencyShort(kpis.cartao)} no cartão
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo</span>
              <div className={`p-1.5 rounded-lg ${kpis.saldo >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                <Wallet className={`h-4 w-4 ${kpis.saldo >= 0 ? "text-success" : "text-destructive"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${kpis.saldo >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(kpis.saldo)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Margem: {kpis.margemLiquida.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contas Vencidas</span>
              <div className={`p-1.5 rounded-lg ${kpis.contasVencidas > 0 ? "bg-destructive/10" : "bg-success/10"}`}>
                <AlertTriangle className={`h-4 w-4 ${kpis.contasVencidas > 0 ? "text-destructive" : "text-success"}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${kpis.contasVencidas > 0 ? "text-destructive" : "text-foreground"}`}>
              {formatCurrency(kpis.totalVencido)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.contasVencidas} conta(s) em atraso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert: próximos vencimentos */}
      {kpis.contasProximas > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-warning/30 bg-warning/5">
          <Clock className="h-4 w-4 text-warning" />
          <span className="text-sm text-warning-foreground">
            <strong>{kpis.contasProximas}</strong> conta(s) vencem nos próximos 7 dias, totalizando <strong>{formatCurrency(kpis.totalProximo)}</strong>
          </span>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução Mensal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Evolução Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evolucaoMensal.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={evolucaoMensal} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={(v) => formatCurrencyShort(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Legend />
                  <Bar dataKey="Receitas" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Despesas por Categoria */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {despesasPorCategoria.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={240}>
                  <RechartsPie>
                    <Pie
                      data={despesasPorCategoria.slice(0, 8)}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={90}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {despesasPorCategoria.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 overflow-hidden">
                  {despesasPorCategoria.slice(0, 6).map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate text-muted-foreground flex-1">{cat.name}</span>
                      <span className="font-medium text-foreground">{formatCurrencyShort(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">Sem despesas</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Saldo acumulado + Top despesas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Saldo acumulado */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Saldo Acumulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evolucaoMensal.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={(v) => formatCurrencyShort(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="Saldo" stroke="hsl(38, 60%, 50%)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(38, 60%, 50%)" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Maiores Despesas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Top 5 Maiores Despesas do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {top5Despesas.length > 0 ? (
              <div className="space-y-3">
                {top5Despesas.map((m, i) => {
                  const pct = kpis.despesas > 0 ? (Math.abs(m.valor ?? 0) / kpis.despesas) * 100 : 0;
                  return (
                    <div key={m.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate max-w-[70%] text-foreground">
                          <span className="text-muted-foreground mr-1.5">#{i + 1}</span>
                          {m.descricao ?? "Sem descrição"}
                        </span>
                        <span className="font-semibold text-foreground">{formatCurrency(Math.abs(m.valor ?? 0))}</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-destructive/70 transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{m.categoria_id ? catMap[m.categoria_id] : "—"}</span>
                        <span>•</span>
                        <span>{pct.toFixed(1)}% do total</span>
                        {m.origem === "cartao_credito" && <Badge variant="outline" className="text-[10px] py-0 px-1.5">💳 Cartão</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">Sem despesas</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
