import { useState, useMemo } from "react";
import { useOrdensProducao, useOficinas, useCores, useUpdateOrdemProducao } from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, DollarSign, Clock, Factory, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import { motion } from "framer-motion";

export default function PagamentoOficinas() {
  const { data: ordens, isLoading } = useOrdensProducao();
  const { data: oficinas } = useOficinas();
  const { data: cores } = useCores();
  const updateOP = useUpdateOrdemProducao();

  const [filtroOficina, setFiltroOficina] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const oficinaMap = Object.fromEntries((oficinas ?? []).map((o) => [o.id, o]));
  const corMap = Object.fromEntries((cores ?? []).map((c) => [c.id, c]));

  // Filter: only external workshops (not "Interna")
  const oficinasExternas = useMemo(
    () => (oficinas ?? []).filter((o) => o.tipo_oficina?.toLowerCase() !== "interna"),
    [oficinas]
  );
  const oficinasExternasIds = new Set(oficinasExternas.map((o) => o.id));

  const ordensExternas = useMemo(() => {
    if (!ordens) return [];
    return ordens
      .filter((o) => o.oficina_id && oficinasExternasIds.has(o.oficina_id))
      .filter((o) => filtroOficina === "todas" || o.oficina_id === filtroOficina)
      .filter((o) => {
        if (filtroStatus === "todos") return true;
        if (filtroStatus === "pago") return o.pagamento_oficina_status === "Pago";
        if (filtroStatus === "pendente") return o.pagamento_oficina_status !== "Pago";
        return true;
      });
  }, [ordens, oficinasExternasIds, filtroOficina, filtroStatus]);

  const calcDias = (dataInicio: string | null, dataFim: string | null) => {
    if (!dataInicio) return null;
    const fim = dataFim ? parseISO(dataFim) : new Date();
    return differenceInDays(fim, parseISO(dataInicio));
  };

  const calcTotal = (ordem: any) => {
    const oficina = ordem.oficina_id ? oficinaMap[ordem.oficina_id] : null;
    const custoPorPeca = oficina?.custo_por_peca ?? 0;
    const qty = ordem.quantidade ?? ordem.quantidade_pecas_ordem ?? 0;
    return custoPorPeca * qty;
  };

  // Summary stats
  const totalPendente = ordensExternas
    .filter((o) => o.pagamento_oficina_status !== "Pago")
    .reduce((sum, o) => sum + calcTotal(o), 0);

  const totalPago = ordensExternas
    .filter((o) => o.pagamento_oficina_status === "Pago")
    .reduce((sum, o) => sum + calcTotal(o), 0);

  const totalOrdens = ordensExternas.length;
  const ordensPendentes = ordensExternas.filter((o) => o.pagamento_oficina_status !== "Pago").length;

  const handleMarcarPago = async (ordem: any) => {
    try {
      // Update status
      await updateOP.mutateAsync({ id: ordem.id, pagamento_oficina_status: "Pago" } as any);

      // Generate financial entry
      const oficina = ordem.oficina_id ? oficinaMap[ordem.oficina_id] : null;
      const total = calcTotal(ordem);

      await supabase.from("movimentacoes_financeiras").insert({
        tipo: "Saída",
        descricao: `Pagamento oficina ${oficina?.nome_oficina ?? "—"} - ${ordem.nome_produto ?? "OP"}`,
        valor: total,
        data: new Date().toISOString().split("T")[0],
        origem: "Pagamento Oficina",
      });

      toast.success(`Pagamento de R$ ${total.toFixed(2)} registrado e lançamento financeiro criado!`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Pagamento de <span className="text-primary">Oficinas</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Controle de pagamentos das oficinas externas
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="border-l-4 border-l-warning">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">A Pagar</p>
                  <p className="text-2xl font-bold text-warning">R$ {totalPendente.toFixed(2)}</p>
                </div>
                <div className="p-2 rounded-full bg-warning/10">
                  <AlertCircle className="h-5 w-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-l-4 border-l-success">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Pago</p>
                  <p className="text-2xl font-bold text-success">R$ {totalPago.toFixed(2)}</p>
                </div>
                <div className="p-2 rounded-full bg-success/10">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Ordens Externas</p>
                  <p className="text-2xl font-bold text-foreground">{totalOrdens}</p>
                </div>
                <div className="p-2 rounded-full bg-primary/10">
                  <Factory className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-l-4 border-l-danger">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Pendentes</p>
                  <p className="text-2xl font-bold text-danger">{ordensPendentes}</p>
                </div>
                <div className="p-2 rounded-full bg-danger/10">
                  <Clock className="h-5 w-5 text-danger" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Oficina</label>
              <Select value={filtroOficina} onValueChange={setFiltroOficina}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as oficinas</SelectItem>
                  {oficinasExternas.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nome_oficina}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status Pgto</label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : ordensExternas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Factory className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma ordem de produção externa encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Oficina</TableHead>
                  <TableHead className="text-right">Qtd Peças</TableHead>
                  <TableHead className="text-right">Custo/Peça</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Envio</TableHead>
                  <TableHead>Devolução</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead>Status Prod.</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordensExternas.map((o) => {
                  const oficina = o.oficina_id ? oficinaMap[o.oficina_id] : null;
                  const custoPorPeca = oficina?.custo_por_peca ?? 0;
                  const qty = o.quantidade ?? o.quantidade_pecas_ordem ?? 0;
                  const total = custoPorPeca * qty;
                  const dias = calcDias(o.data_inicio, o.data_fim);
                  const isPago = o.pagamento_oficina_status === "Pago";

                  return (
                    <TableRow key={o.id} className={isPago ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{o.nome_produto ?? "—"}</TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{oficina?.nome_oficina ?? "—"}</span>
                      </TableCell>
                      <TableCell className="text-right">{qty}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        R$ {custoPorPeca.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {o.data_inicio ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {o.data_fim ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {dias !== null ? (
                          <Badge variant={dias > 10 ? "destructive" : "secondary"} className="text-xs">
                            {dias}d
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.status_ordem ?? ""} />
                      </TableCell>
                      <TableCell>
                        {isPago ? (
                          <Badge className="bg-success/15 text-success border-success/30 text-xs gap-1">
                            <CheckCircle className="h-3 w-3" /> Pago
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!isPago && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs h-8 border-success/30 text-success hover:bg-success/10 hover:text-success"
                            onClick={() => handleMarcarPago(o)}
                            disabled={updateOP.isPending}
                          >
                            <DollarSign className="h-3 w-3" />
                            Pagar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
