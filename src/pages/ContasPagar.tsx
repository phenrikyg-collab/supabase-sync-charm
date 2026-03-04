import { useState, useMemo } from "react";
import { useMovimentacoesFinanceiras, useCategorias, useCentrosCusto, useCreateMovimentacao } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateBR } from "@/lib/printUtils";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths, parseISO, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, TrendingDown, AlertTriangle, Calendar as CalendarIcon, Search, Plus } from "lucide-react";
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line } from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function getStatusPagamento(mov: { data: string; tipo: string | null }) {
  if (mov.tipo === "entrada") return "recebido";
  const hoje = new Date();
  const dataMov = parseISO(mov.data);
  if (isBefore(dataMov, hoje)) return "vencido";
  const em7dias = new Date(hoje);
  em7dias.setDate(hoje.getDate() + 7);
  if (isBefore(dataMov, em7dias)) return "proximo";
  return "pendente";
}

function NovaContaDialog({ categorias }: { categorias: { id: string; nome_categoria: string | null }[] }) {
  const createMov = useCreateMovimentacao();
  const [open, setOpen] = useState(false);
  const [fornecedor, setFornecedor] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [valor, setValor] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [vencimento, setVencimento] = useState<Date>();
  const [recorrencia, setRecorrencia] = useState("unica");
  const [qtdMeses, setQtdMeses] = useState("12");
  const [salvando, setSalvando] = useState(false);

  const resetForm = () => {
    setFornecedor("");
    setNotaFiscal("");
    setValor("");
    setCategoriaId("");
    setVencimento(undefined);
    setRecorrencia("unica");
    setQtdMeses("12");
  };

  const handleSubmit = async () => {
    const valorNum = parseFloat(valor.replace(",", "."));
    if (!fornecedor.trim()) return toast.error("Informe o fornecedor");
    if (!valorNum || valorNum <= 0) return toast.error("Informe um valor válido");
    if (!vencimento) return toast.error("Informe a data de vencimento");

    setSalvando(true);
    try {
      const descricao = notaFiscal.trim()
        ? `${fornecedor.trim()} - NF ${notaFiscal.trim()}`
        : fornecedor.trim();

      const meses = recorrencia === "mensal" ? Math.min(Math.max(parseInt(qtdMeses) || 1, 1), 60) : 1;

      for (let i = 0; i < meses; i++) {
        const dataVenc = addMonths(vencimento, i);
        const descFinal = meses > 1 ? `${descricao} (${i + 1}/${meses})` : descricao;
        await createMov.mutateAsync({
          tipo: "saida",
          descricao: descFinal,
          valor: valorNum,
          data: format(dataVenc, "yyyy-MM-dd"),
          categoria_id: categoriaId || null,
          origem: "manual",
        });
      }

      toast.success(meses > 1
        ? `${meses} parcelas cadastradas com sucesso`
        : "Conta a pagar cadastrada com sucesso"
      );
      resetForm();
      setOpen(false);
    } catch {
      toast.error("Erro ao cadastrar conta");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nova Conta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conta a Pagar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Fornecedor *</Label>
            <Input
              placeholder="Nome do fornecedor"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label>Nota Fiscal</Label>
            <Input
              placeholder="Número da NF (opcional)"
              value={notaFiscal}
              onChange={(e) => setNotaFiscal(e.target.value)}
              maxLength={50}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ""))}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !vencimento && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {vencimento ? format(vencimento, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={vencimento}
                    onSelect={setVencimento}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome_categoria}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Recorrência</Label>
            <Select value={recorrencia} onValueChange={setRecorrencia}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unica">Pagamento único</SelectItem>
                <SelectItem value="mensal">Repetir mensalmente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {recorrencia === "mensal" && (
            <div className="space-y-2">
              <Label>Quantidade de meses</Label>
              <Input
                type="number"
                min={2}
                max={60}
                value={qtdMeses}
                onChange={(e) => setQtdMeses(e.target.value)}
                placeholder="12"
              />
              <p className="text-xs text-muted-foreground">
                Serão criadas {parseInt(qtdMeses) || 0} parcelas de {valor ? formatCurrency(parseFloat(valor.replace(",", ".")) || 0) : "R$ 0,00"} com vencimento mensal
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={salvando}>
            {salvando ? "Salvando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ContasPagar() {
  const { data: movs, isLoading } = useMovimentacoesFinanceiras();
  const { data: categorias } = useCategorias();
  const { data: centros } = useCentrosCusto();

  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");

  const catMap = Object.fromEntries((categorias ?? []).map((c) => [c.id, c.nome_categoria]));

  const saidas = useMemo(() => {
    return (movs ?? [])
      .filter((m) => m.tipo === "saida")
      .map((m) => ({ ...m, statusPagamento: getStatusPagamento(m) }));
  }, [movs]);

  const filtered = useMemo(() => {
    return saidas.filter((m) => {
      if (filtroCategoria !== "todos" && m.categoria_id !== filtroCategoria) return false;
      if (filtroStatus !== "todos" && m.statusPagamento !== filtroStatus) return false;
      if (busca) {
        const search = busca.toLowerCase();
        const desc = (m.descricao ?? "").toLowerCase();
        const cat = (m.categoria_id ? catMap[m.categoria_id] ?? "" : "").toLowerCase();
        if (!desc.includes(search) && !cat.includes(search)) return false;
      }
      return true;
    });
  }, [saidas, filtroCategoria, filtroStatus, busca, catMap]);

  const totalPendente = saidas.filter((s) => s.statusPagamento === "pendente").reduce((acc, s) => acc + (s.valor ?? 0), 0);
  const totalVencido = saidas.filter((s) => s.statusPagamento === "vencido").reduce((acc, s) => acc + (s.valor ?? 0), 0);
  const totalProximo = saidas.filter((s) => s.statusPagamento === "proximo").reduce((acc, s) => acc + (s.valor ?? 0), 0);
  const totalMes = saidas
    .filter((s) => {
      const d = parseISO(s.data);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((acc, s) => acc + (s.valor ?? 0), 0);

  const fluxoCaixa = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(subMonths(now, 5));
    const end = endOfMonth(addMonths(now, 2));
    const months = eachMonthOfInterval({ start, end });
    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const movsDoMes = (movs ?? []).filter((m) => {
        const d = parseISO(m.data);
        return !isBefore(d, monthStart) && !isAfter(d, monthEnd);
      });
      const entradas = movsDoMes.filter((m) => m.tipo === "entrada").reduce((acc, m) => acc + (m.valor ?? 0), 0);
      const saidasMes = movsDoMes.filter((m) => m.tipo === "saida").reduce((acc, m) => acc + (m.valor ?? 0), 0);
      return { mes: format(month, "MMM/yy", { locale: ptBR }), entradas, saidas: saidasMes, saldo: entradas - saidasMes };
    });
  }, [movs]);

  const fluxoComSaldo = useMemo(() => {
    let acumulado = 0;
    return fluxoCaixa.map((item) => {
      acumulado += item.saldo;
      return { ...item, saldoAcumulado: acumulado };
    });
  }, [fluxoCaixa]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "vencido": return <Badge variant="destructive">Vencido</Badge>;
      case "proximo": return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Próximo</Badge>;
      case "pendente": return <Badge variant="secondary">Pendente</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle de pagamentos e fluxo de caixa</p>
        </div>
        <NovaContaDialog categorias={categorias ?? []} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencidos</p>
                <p className="text-lg font-bold text-destructive">{formatCurrency(totalVencido)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <CalendarIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Próximos 7 dias</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(totalProximo)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-lg font-bold">{formatCurrency(totalPendente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingDown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Mês</p>
                <p className="text-lg font-bold">{formatCurrency(totalMes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="contas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contas">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
            </div>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Categorias</SelectItem>
                {categorias?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_categoria}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
                <SelectItem value="proximo">Próximos 7 dias</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">
                {filtered.length} pagamento{filtered.length !== 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum pagamento encontrado</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m) => (
                      <TableRow key={m.id} className={m.statusPagamento === "vencido" ? "bg-destructive/5" : ""}>
                        <TableCell className="text-muted-foreground">{formatDateBR(m.data)}</TableCell>
                        <TableCell className="font-medium max-w-xs truncate">{m.descricao ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.categoria_id ? catMap[m.categoria_id] ?? "—" : "—"}</TableCell>
                        <TableCell>{statusBadge(m.statusPagamento)}</TableCell>
                        <TableCell className="text-right font-semibold text-destructive">{formatCurrency(m.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fluxo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Fluxo de Caixa — Últimos 6 meses + Projeção</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={fluxoComSaldo}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="saldoAcumulado" name="Saldo Acumulado" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Resumo Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Saídas</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fluxoComSaldo.map((item) => (
                    <TableRow key={item.mes}>
                      <TableCell className="font-medium capitalize">{item.mes}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatCurrency(item.entradas)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(item.saidas)}</TableCell>
                      <TableCell className={`text-right font-medium ${item.saldo >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatCurrency(item.saldo)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${item.saldoAcumulado >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatCurrency(item.saldoAcumulado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
