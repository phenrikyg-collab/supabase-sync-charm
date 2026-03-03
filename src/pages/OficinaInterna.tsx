import { useState, useMemo } from "react";
import { useOrdensProducao, useOficinas, useCustosFixosOficina, useCreateCustoFixoOficina, useUpdateCustoFixoOficina } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, AlertTriangle, CheckCircle, XCircle, Plus, Edit, Factory } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function getMonthOptions() {
  const months: string[] = [];
  const now = new Date();
  for (let i = -3; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(format(d, "yyyy-MM"));
  }
  return months;
}

function getStatusInfo(custoReal: number, custoEstimado: number) {
  if (custoEstimado <= 0) return { level: "sem_meta", label: "Sem Meta", color: "bg-muted text-muted-foreground", icon: null };
  const ratio = custoReal / custoEstimado;
  if (ratio <= 0.9) return { level: "ok", label: "No Prazo", color: "bg-success/15 text-success border-success/30", icon: CheckCircle };
  if (ratio <= 1.0) return { level: "alerta", label: "Alerta", color: "bg-warning/15 text-warning border-warning/30", icon: AlertTriangle };
  return { level: "critico", label: "Crítico", color: "bg-danger/15 text-danger border-danger/30", icon: XCircle };
}

export default function OficinaInterna() {
  const { data: oficinas } = useOficinas();
  const { data: ordens } = useOrdensProducao();
  const { data: custosFixos } = useCustosFixosOficina();
  const createCusto = useCreateCustoFixoOficina();
  const updateCusto = useUpdateCustoFixoOficina();

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [custoMes, setCustoMes] = useState("");
  const [custoValor, setCustoValor] = useState(0);

  const oficinasInternas = useMemo(() => oficinas?.filter(o => o.is_interna) ?? [], [oficinas]);
  const oficinasInternasIds = useMemo(() => new Set(oficinasInternas.map(o => o.id)), [oficinasInternas]);

  const custoFixoAtual = useMemo(() => 
    custosFixos?.find(c => c.mes === selectedMonth), [custosFixos, selectedMonth]);

  // Ordens vinculadas a oficinas internas no mês selecionado
  const ordensInternas = useMemo(() => {
    if (!ordens) return [];
    const monthStart = startOfMonth(parseISO(selectedMonth + "-01"));
    const monthEnd = endOfMonth(monthStart);
    return ordens.filter(o => {
      if (!o.oficina_id || !oficinasInternasIds.has(o.oficina_id)) return false;
      const dataOrdem = o.created_at ? parseISO(o.created_at) : null;
      if (!dataOrdem) return false;
      return dataOrdem >= monthStart && dataOrdem <= monthEnd;
    });
  }, [ordens, oficinasInternasIds, selectedMonth]);

  const totalPecas = useMemo(() => 
    ordensInternas.reduce((sum, o) => sum + (o.quantidade_pecas_ordem ?? o.quantidade ?? 0), 0),
    [ordensInternas]
  );

  const custoFixoValor = custoFixoAtual?.valor ?? 0;
  const custoRealPorPeca = totalPecas > 0 ? custoFixoValor / totalPecas : 0;
  
  // Custo estimado = média do custo_por_peca das oficinas internas
  const custoEstimadoPorPeca = useMemo(() => {
    const vals = oficinasInternas.filter(o => o.custo_por_peca != null).map(o => o.custo_por_peca!);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [oficinasInternas]);

  const status = getStatusInfo(custoRealPorPeca, custoEstimadoPorPeca);

  const openNewCusto = () => {
    setEditId(null);
    setCustoMes(selectedMonth);
    setCustoValor(custoFixoAtual?.valor ?? 0);
    setDialogOpen(true);
  };

  const openEditCusto = (c: any) => {
    setEditId(c.id);
    setCustoMes(c.mes);
    setCustoValor(c.valor);
    setDialogOpen(true);
  };

  const handleSaveCusto = async () => {
    try {
      if (editId) {
        await updateCusto.mutateAsync({ id: editId, mes: custoMes, valor: custoValor });
        toast.success("Custo atualizado!");
      } else {
        await createCusto.mutateAsync({ mes: custoMes, valor: custoValor });
        toast.success("Custo cadastrado!");
      }
      setDialogOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const monthLabel = format(parseISO(selectedMonth + "-01"), "MMMM yyyy", { locale: ptBR });

  // Per-order breakdown
  const ordensComCusto = useMemo(() => {
    if (totalPecas <= 0) return [];
    return ordensInternas.map(o => {
      const pecas = o.quantidade_pecas_ordem ?? o.quantidade ?? 0;
      const custoProporcional = pecas > 0 ? (pecas / totalPecas) * custoFixoValor : 0;
      const custoPorPeca = pecas > 0 ? custoProporcional / pecas : 0;
      const statusOP = getStatusInfo(custoPorPeca, custoEstimadoPorPeca);
      return { ...o, pecas, custoProporcional, custoPorPeca, statusOP };
    });
  }, [ordensInternas, totalPecas, custoFixoValor, custoEstimadoPorPeca]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            <span className="text-primary">Oficina Interna</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Controle de custos da produção interna</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map(m => (
                <SelectItem key={m} value={m}>
                  {format(parseISO(m + "-01"), "MMMM yyyy", { locale: ptBR })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openNewCusto} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            {custoFixoAtual ? "Editar Custo Fixo" : "Cadastrar Custo Fixo"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Custo Fixo Mensal</p>
                  <p className="text-2xl font-serif font-bold">{formatCurrency(custoFixoValor)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Factory className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Peças no Mês</p>
                  <p className="text-2xl font-serif font-bold">{totalPecas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <DollarSign className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Custo Real/Peça</p>
                  <p className="text-2xl font-serif font-bold">{formatCurrency(custoRealPorPeca)}</p>
                  <p className="text-[10px] text-muted-foreground">Meta: {formatCurrency(custoEstimadoPorPeca)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className={`border ${status.level === 'ok' ? 'border-success/30' : status.level === 'alerta' ? 'border-warning/30' : status.level === 'critico' ? 'border-danger/30' : ''}`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {status.icon && (
                  <div className={`p-2 rounded-lg ${status.level === 'ok' ? 'bg-success/10' : status.level === 'alerta' ? 'bg-warning/10' : 'bg-danger/10'}`}>
                    <status.icon className={`h-5 w-5 ${status.level === 'ok' ? 'text-success' : status.level === 'alerta' ? 'text-warning' : 'text-danger'}`} />
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Status do Custo</p>
                  <p className={`text-2xl font-serif font-bold ${status.level === 'ok' ? 'text-success' : status.level === 'alerta' ? 'text-warning' : status.level === 'critico' ? 'text-danger' : ''}`}>
                    {status.label}
                  </p>
                  {custoEstimadoPorPeca > 0 && totalPecas > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      {((custoRealPorPeca / custoEstimadoPorPeca) * 100).toFixed(0)}% do estimado
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Progress bar */}
      {custoEstimadoPorPeca > 0 && totalPecas > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Custo Real vs Estimado — {monthLabel}</span>
              <span className="text-sm text-muted-foreground">
                {formatCurrency(custoRealPorPeca)} / {formatCurrency(custoEstimadoPorPeca)}
              </span>
            </div>
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden relative">
              {/* 90% marker */}
              <div className="absolute top-0 bottom-0 w-px bg-warning/60 z-10" style={{ left: '90%' }} />
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  status.level === 'ok' ? 'bg-success' : status.level === 'alerta' ? 'bg-warning' : 'bg-danger'
                }`}
                style={{ width: `${Math.min(100, (custoRealPorPeca / custoEstimadoPorPeca) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">0%</span>
              <span className="text-[10px] text-warning">90%</span>
              <span className="text-[10px] text-muted-foreground">100%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custos Fixos cadastrados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">Custos Fixos Mensais</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custosFixos?.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium capitalize">
                    {format(parseISO(c.mes + "-01"), "MMMM yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(c.valor)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditCusto(c)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!custosFixos || custosFixos.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Nenhum custo fixo cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detalhamento por OP */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">Ordens de Produção — {monthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Peças</TableHead>
                <TableHead className="text-right">Custo Proporcional</TableHead>
                <TableHead className="text-right">Custo/Peça</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordensComCusto.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.nome_produto ?? "—"}</TableCell>
                  <TableCell className="text-right">{o.pecas}</TableCell>
                  <TableCell className="text-right">{formatCurrency(o.custoProporcional)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(o.custoPorPeca)}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={`${o.statusOP.color} border text-xs`}>
                      {o.statusOP.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {ordensComCusto.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma ordem de produção interna neste mês
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog cadastro custo fixo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Custo Fixo" : "Cadastrar Custo Fixo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={custoMes} onValueChange={setCustoMes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map(m => (
                    <SelectItem key={m} value={m}>
                      {format(parseISO(m + "-01"), "MMMM yyyy", { locale: ptBR })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={custoValor} onChange={e => setCustoValor(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCusto}>{editId ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}