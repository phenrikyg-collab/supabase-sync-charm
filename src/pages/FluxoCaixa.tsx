import { useState, useMemo } from "react";
import { useMovimentacoesFinanceiras, useCategorias } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, CalendarDays,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Area, AreaChart,
} from "recharts";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, addMonths, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatCurrencyShort(v: number) {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return formatCurrency(v);
}

type Visao = "diario" | "semanal" | "mensal";

export default function FluxoCaixa() {
  const { data: movs, isLoading } = useMovimentacoesFinanceiras();
  const { data: categorias } = useCategorias();

  const now = new Date();
  const currentMonth = format(now, "yyyy-MM");
  const [mesSelecionado, setMesSelecionado] = useState(currentMonth);
  const [visao, setVisao] = useState<Visao>("diario");

  const catMap = useMemo(() => {
    const map: Record<string, string> = {};
    (categorias ?? []).forEach((c) => { map[c.id] = c.descricao_categoria || c.nome_categoria || "Sem categoria"; });
    return map;
  }, [categorias]);

  // Only transactions that impact cash flow
  const fluxoMovs = useMemo(() =>
    (movs ?? []).filter((m: any) => m.impacta_fluxo !== false),
    [movs]
  );

  // Use data_vencimento for cash flow timing; fallback to data
  const getFluxoDate = (m: any): string => m.data_vencimento || m.data;

  // Available months from fluxo dates
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    fluxoMovs.forEach((m: any) => {
      const d = getFluxoDate(m);
      if (d) set.add(d.substring(0, 7));
    });
    if (!set.has(currentMonth)) set.add(currentMonth);
    return [...set].sort().reverse();
  }, [fluxoMovs, currentMonth]);

  // Transactions for selected month
  const mesMovs = useMemo(() =>
    fluxoMovs.filter((m: any) => getFluxoDate(m)?.startsWith(mesSelecionado)),
    [fluxoMovs, mesSelecionado]
  );

  // KPIs
  const kpis = useMemo(() => {
    const entradas = mesMovs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);
    const saidas = mesMovs.filter((m) => m.tipo === "saida").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);
    const saldo = entradas - saidas;

    // Saldo acumulado (all months up to selected)
    const allPrior = fluxoMovs.filter((m: any) => {
      const d = getFluxoDate(m);
      return d && d.substring(0, 7) <= mesSelecionado;
    });
    const acumEntradas = allPrior.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);
    const acumSaidas = allPrior.filter((m) => m.tipo === "saida").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);
    const saldoAcumulado = acumEntradas - acumSaidas;

    // Pending (em_aberto)
    const pendentes = mesMovs.filter((m: any) => m.status_pagamento === "em_aberto");
    const totalPendente = pendentes.reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);

    return { entradas, saidas, saldo, saldoAcumulado, totalPendente, numPendentes: pendentes.length };
  }, [mesMovs, fluxoMovs, mesSelecionado]);

  // Chart data
  const chartData = useMemo(() => {
    const [year, month] = mesSelecionado.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);

    if (visao === "diario") {
      const days = eachDayOfInterval({ start, end });
      return days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const dayMovs = mesMovs.filter((m: any) => getFluxoDate(m) === key);
        const entradas = dayMovs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);
        const saidas = dayMovs.filter((m) => m.tipo === "saida").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);
        return { label: format(day, "dd"), entradas, saidas, saldo: entradas - saidas };
      });
    }

    if (visao === "semanal") {
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      return weeks.map((weekStart, idx) => {
        const weekEnd = new Date(Math.min(new Date(weekStart.getTime() + 6 * 86400000).getTime(), end.getTime()));
        const weekMovs = mesMovs.filter((m: any) => {
          const d = getFluxoDate(m);
          return d && d >= format(weekStart, "yyyy-MM-dd") && d <= format(weekEnd, "yyyy-MM-dd");
        });
        const entradas = weekMovs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);
        const saidas = weekMovs.filter((m) => m.tipo === "saida").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);
        return { label: `Sem ${idx + 1}`, entradas, saidas, saldo: entradas - saidas };
      });
    }

    // mensal - last 6 months
    const months: { label: string; entradas: number; saidas: number; saldo: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = addMonths(start, -i);
      const key = format(d, "yyyy-MM");
      const mMovs = fluxoMovs.filter((m: any) => getFluxoDate(m)?.startsWith(key));
      const entradas = mMovs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);
      const saidas = mMovs.filter((m) => m.tipo === "saida").reduce((s, m) => s + Math.abs(m.valor ?? 0), 0);
      months.push({ label: format(d, "MMM/yy", { locale: ptBR }), entradas, saidas, saldo: entradas - saidas });
    }
    return months;
  }, [mesMovs, fluxoMovs, mesSelecionado, visao]);

  // Accumulated balance chart
  const saldoAcumuladoData = useMemo(() => {
    const [year, month] = mesSelecionado.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    const days = eachDayOfInterval({ start, end });

    // Prior balance
    const priorMovs = fluxoMovs.filter((m: any) => {
      const d = getFluxoDate(m);
      return d && d < format(start, "yyyy-MM-dd");
    });
    let acum = priorMovs.reduce((s, m) => {
      const v = Math.abs(m.valor ?? 0);
      return s + (m.tipo === "entrada" ? v : -v);
    }, 0);

    return days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const dayMovs = mesMovs.filter((m: any) => getFluxoDate(m) === key);
      dayMovs.forEach((m) => {
        const v = Math.abs(m.valor ?? 0);
        acum += m.tipo === "entrada" ? v : -v;
      });
      return { label: format(day, "dd"), saldo: acum };
    });
  }, [mesMovs, fluxoMovs, mesSelecionado]);

  // Detailed transactions sorted by date
  const transacoes = useMemo(() =>
    [...mesMovs].sort((a: any, b: any) => (getFluxoDate(a) ?? "").localeCompare(getFluxoDate(b) ?? "")),
    [mesMovs]
  );

  const formatDateBR = (d: string) => {
    try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle de entradas e saídas efetivas do caixa</p>
        </div>
        <div className="flex gap-3">
          <Select value={visao} onValueChange={(v) => setVisao(v as Visao)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diário</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mesesDisponiveis.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Entradas</span>
              <ArrowUpRight className="h-4 w-4 text-success" />
            </div>
            <p className="text-xl font-bold text-success">{formatCurrency(kpis.entradas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Saídas</span>
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-xl font-bold text-destructive">{formatCurrency(kpis.saidas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Saldo do Mês</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className={`text-xl font-bold ${kpis.saldo >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(kpis.saldo)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Saldo Acumulado</span>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <p className={`text-xl font-bold ${kpis.saldoAcumulado >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(kpis.saldoAcumulado)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Pendentes</span>
              <CalendarDays className="h-4 w-4 text-warning" />
            </div>
            <p className="text-xl font-bold text-warning">{kpis.numPendentes}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpis.totalPendente)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entradas vs Saídas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saldo Acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={saldoAcumuladoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <defs>
                  <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" fill="url(#saldoGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Transaction List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentações do Mês</CardTitle>
        </CardHeader>
        <CardContent>
          {transacoes.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhuma movimentação com impacto no caixa neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Caixa</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transacoes.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateBR(getFluxoDate(m))}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{m.descricao || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {m.categoria_id ? catMap[m.categoria_id] || "—" : "—"}
                    </TableCell>
                    <TableCell>
                      {m.status_pagamento === "pago" ? (
                        <Badge className="bg-success/10 text-success border-success/30" variant="outline">Pago</Badge>
                      ) : (
                        <Badge variant="outline" className="border-warning/30 text-warning">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.conta_tipo === "pagamento_cartao" ? "Pgto Fatura" : m.origem || "—"}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${m.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                      {m.tipo === "saida" ? "-" : ""}{formatCurrency(Math.abs(m.valor ?? 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
