import { useState, useMemo } from "react";
import { useCartoesFaturas, useMovimentacoesFinanceiras, useCategorias, useCreateMovimentacao } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDateBR } from "@/lib/printUtils";
import { CreditCard, ChevronDown, ChevronRight, DollarSign, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function StatusBadgeFatura({ status }: { status: string }) {
  if (status === "paga") return <Badge className="bg-success text-success-foreground">Paga</Badge>;
  if (status === "parcial") return <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">Parcial</Badge>;
  return <Badge variant="outline" className="border-destructive/30 text-destructive">Aberta</Badge>;
}

export default function Faturas() {
  const { data: faturas = [], isLoading } = useCartoesFaturas();
  const { data: movs = [] } = useMovimentacoesFinanceiras();
  const { data: categorias = [] } = useCategorias();
  const createMov = useCreateMovimentacao();
  const queryClient = useQueryClient();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pagamentoFaturaId, setPagamentoFaturaId] = useState<string | null>(null);
  const [valorPagamento, setValorPagamento] = useState("");
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().split("T")[0]);
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  // State for manual transaction dialog
  const [addTxFaturaId, setAddTxFaturaId] = useState<string | null>(null);
  const [txDescricao, setTxDescricao] = useState("");
  const [txValor, setTxValor] = useState("");
  const [txData, setTxData] = useState(() => new Date().toISOString().split("T")[0]);
  const [txCategoriaId, setTxCategoriaId] = useState("");
  const [salvandoTx, setSalvandoTx] = useState(false);

  const catMap = useMemo(() => {
    const m: Record<string, { nome: string; grupoDre: string }> = {};
    categorias.forEach((c: any) => { m[c.id] = { nome: c.nome_categoria ?? "", grupoDre: c.grupo_dre ?? "" }; });
    return m;
  }, [categorias]);

  const catGrouped = useMemo(() => {
    const groups: Record<string, { id: string; label: string }[]> = {};
    categorias.forEach((c: any) => {
      const grupo = c.grupo_dre || "Outros";
      if (!groups[grupo]) groups[grupo] = [];
      const label = c.descricao_categoria || c.nome_categoria || "";
      if (label && label !== grupo) {
        groups[grupo].push({ id: c.id, label });
      }
    });
    return groups;
  }, [categorias]);

  const movsPorFatura = useMemo(() => {
    const map: Record<string, any[]> = {};
    movs.forEach((m: any) => {
      if (m.fatura_id && m.conta_tipo === "cartao_fatura") {
        if (!map[m.fatura_id]) map[m.fatura_id] = [];
        map[m.fatura_id].push(m);
      }
    });
    return map;
  }, [movs]);

  const sortedFaturas = useMemo(() =>
    [...faturas].sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia)),
    [faturas]
  );

  const totalAberto = faturas.filter((f) => f.status !== "paga").reduce((s, f) => s + (f.valor_total - f.valor_pago), 0);

  const handlePagamento = async () => {
    if (!pagamentoFaturaId) return;
    const valor = parseFloat(valorPagamento.replace(",", "."));
    if (!valor || valor <= 0) return toast.error("Informe um valor válido");

    const fatura = faturas.find((f) => f.id === pagamentoFaturaId);
    if (!fatura) return;

    setSalvandoPagamento(true);
    try {
      await createMov.mutateAsync({
        descricao: `Pagamento fatura ${fatura.cartao_nome} — ${fatura.mes_referencia}`,
        tipo: "saida",
        valor,
        data: dataPagamento,
        data_vencimento: fatura.data_vencimento,
        conta_tipo: "pagamento_cartao",
        fatura_id: pagamentoFaturaId,
        impacta_dre: false,
        impacta_fluxo: true,
        origem: "pagamento_fatura",
        status_pagamento: "pago",
        data_envio: dataPagamento,
      } as any);

      await queryClient.invalidateQueries({ queryKey: ["cartoes_faturas"] });
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      toast.success("Pagamento registrado com sucesso!");
      setPagamentoFaturaId(null);
      setValorPagamento("");
    } catch (err: any) {
      toast.error("Erro ao registrar pagamento: " + (err.message || "erro"));
    } finally {
      setSalvandoPagamento(false);
    }
  };

  const openAddTx = (faturaId: string) => {
    setAddTxFaturaId(faturaId);
    setTxDescricao("");
    setTxValor("");
    setTxData(new Date().toISOString().split("T")[0]);
    setTxCategoriaId("");
  };

  const handleAddTx = async () => {
    if (!addTxFaturaId) return;
    const valor = parseFloat(txValor.replace(",", "."));
    if (!txDescricao.trim()) return toast.error("Informe a descrição");
    if (!valor || valor <= 0) return toast.error("Informe um valor válido");

    const fatura = faturas.find((f) => f.id === addTxFaturaId);
    if (!fatura) return;

    setSalvandoTx(true);
    try {
      // Create the transaction linked to this invoice
      await createMov.mutateAsync({
        descricao: txDescricao.trim(),
        tipo: "saida",
        valor,
        data: txData,
        data_vencimento: fatura.data_vencimento,
        conta_tipo: "cartao_fatura",
        fatura_id: addTxFaturaId,
        categoria_id: txCategoriaId || null,
        impacta_dre: true,
        impacta_fluxo: false,
        origem: "manual",
        status_pagamento: "em_aberto",
      } as any);

      // Update the invoice total — recalculate from current DB value
      const { data: currentFatura } = await supabase.from("cartoes_faturas").select("valor_total, valor_pago").eq("id", addTxFaturaId).single();
      if (currentFatura) {
        const newTotal = (currentFatura.valor_total ?? 0) + valor;
        const newSaldo = newTotal - (currentFatura.valor_pago ?? 0);
        const newStatus = (currentFatura.valor_pago ?? 0) >= newTotal && newTotal > 0 ? "paga" : (currentFatura.valor_pago ?? 0) > 0 ? "parcial" : "aberta";
        await supabase.from("cartoes_faturas").update({ 
          valor_total: newTotal, 
          saldo_em_aberto: newSaldo,
          status: newStatus 
        }).eq("id", addTxFaturaId);
      }

      await queryClient.invalidateQueries({ queryKey: ["cartoes_faturas"] });
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      toast.success("Lançamento adicionado à fatura!");
      setAddTxFaturaId(null);
    } catch (err: any) {
      toast.error("Erro ao adicionar lançamento: " + (err.message || "erro"));
    } finally {
      setSalvandoTx(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Faturas de Cartão</h1>
        <p className="text-sm text-muted-foreground mt-1">Controle de faturas e pagamentos de cartão de crédito</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Total Faturas</span>
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{faturas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Saldo em Aberto</span>
              <DollarSign className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(totalAberto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Faturas Pagas</span>
              <CreditCard className="h-4 w-4 text-success" />
            </div>
            <p className="text-2xl font-bold text-success">{faturas.filter((f) => f.status === "paga").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de faturas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Faturas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : sortedFaturas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma fatura cadastrada. Importe um extrato de cartão para criar.</div>
          ) : (
            <div className="space-y-2">
              {sortedFaturas.map((f) => {
                const isExpanded = expandedId === f.id;
                const faturaMovs = movsPorFatura[f.id] ?? [];
                const saldo = f.valor_total - f.valor_pago;

                return (
                  <Collapsible key={f.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : f.id)}>
                    <div className="border rounded-lg">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-4">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <div>
                              <p className="font-medium">{f.cartao_nome}</p>
                              <p className="text-xs text-muted-foreground">
                                Ref: {f.mes_referencia} · Venc: {f.data_vencimento ? formatDateBR(f.data_vencimento) : "—"} · {faturaMovs.length} itens
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold">{formatCurrency(f.valor_total)}</p>
                              {f.valor_pago > 0 && (
                                <p className="text-xs text-muted-foreground">Pago: {formatCurrency(f.valor_pago)}</p>
                              )}
                              {saldo > 0 && (
                                <p className="text-xs text-destructive">Saldo: {formatCurrency(saldo)}</p>
                              )}
                            </div>
                            <StatusBadgeFatura status={f.status} />
                            {f.status !== "paga" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPagamentoFaturaId(f.id);
                                  setValorPagamento(saldo.toFixed(2).replace(".", ","));
                                }}
                              >
                                <DollarSign className="h-3.5 w-3.5 mr-1" /> Pagar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t px-4 pb-4">
                          <div className="flex justify-end pt-3 pb-2">
                            <Button size="sm" variant="outline" onClick={() => openAddTx(f.id)}>
                              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Lançamento
                            </Button>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Grupo DRE</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {faturaMovs.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum item vinculado</TableCell></TableRow>
                              ) : (
                                faturaMovs.map((m: any) => (
                                  <TableRow key={m.id}>
                                    <TableCell>{m.descricao ?? "—"}</TableCell>
                                    <TableCell className="text-muted-foreground">{m.categoria_id ? catMap[m.categoria_id]?.nome ?? "—" : "—"}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs">{m.categoria_id ? catMap[m.categoria_id]?.grupoDre ?? "—" : "—"}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(m.valor)}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Pagamento */}
      <Dialog open={!!pagamentoFaturaId} onOpenChange={(open) => !open && setPagamentoFaturaId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento de Fatura</DialogTitle>
          </DialogHeader>
          {pagamentoFaturaId && (() => {
            const f = faturas.find((x) => x.id === pagamentoFaturaId);
            if (!f) return null;
            const saldo = f.valor_total - f.valor_pago;
            return (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-sm font-medium">{f.cartao_nome} — {f.mes_referencia}</p>
                  <p className="text-xs text-muted-foreground">Total: {formatCurrency(f.valor_total)} · Pago: {formatCurrency(f.valor_pago)}</p>
                  <p className="text-lg font-bold text-destructive">Saldo: {formatCurrency(saldo)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Valor do Pagamento (R$)</Label>
                  <Input
                    value={valorPagamento}
                    onChange={(e) => setValorPagamento(e.target.value.replace(/[^0-9.,]/g, ""))}
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data do Pagamento</Label>
                  <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagamentoFaturaId(null)}>Cancelar</Button>
            <Button onClick={handlePagamento} disabled={salvandoPagamento}>
              {salvandoPagamento ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Adicionar Lançamento Manual */}
      <Dialog open={!!addTxFaturaId} onOpenChange={(open) => !open && setAddTxFaturaId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Lançamento à Fatura</DialogTitle>
          </DialogHeader>
          {addTxFaturaId && (() => {
            const f = faturas.find((x) => x.id === addTxFaturaId);
            if (!f) return null;
            return (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-sm font-medium">{f.cartao_nome} — {f.mes_referencia}</p>
                  <p className="text-xs text-muted-foreground">Total atual: {formatCurrency(f.valor_total)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={txDescricao}
                    onChange={(e) => setTxDescricao(e.target.value)}
                    placeholder="Ex: Assinatura Adobe"
                    maxLength={200}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input
                      value={txValor}
                      onChange={(e) => setTxValor(e.target.value.replace(/[^0-9.,]/g, ""))}
                      inputMode="decimal"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={txData} onChange={(e) => setTxData(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={txCategoriaId} onValueChange={setTxCategoriaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(catGrouped).map(([grupo, items]) => (
                        <div key={grupo}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{grupo}</div>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTxFaturaId(null)}>Cancelar</Button>
            <Button onClick={handleAddTx} disabled={salvandoTx}>
              {salvandoTx ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}