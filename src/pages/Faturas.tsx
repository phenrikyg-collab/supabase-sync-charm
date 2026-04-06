import { useState, useMemo } from "react";
import { useCartoesFaturas, useMovimentacoesFinanceiras, useCategorias, useCreateMovimentacao, useCartoesCredito } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateBR } from "@/lib/printUtils";
import { CreditCard, ChevronDown, ChevronRight, DollarSign, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
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
  const { data: cartoes = [], isLoading: loadingCartoes } = useCartoesCredito();
  const createMov = useCreateMovimentacao();
  const queryClient = useQueryClient();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pagamentoFaturaId, setPagamentoFaturaId] = useState<string | null>(null);
  const [valorPagamento, setValorPagamento] = useState("");
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().split("T")[0]);
  const [salvandoPagamento, setSalvandoPagamento] = useState(false);

  // Card management state
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardNome, setCardNome] = useState("");
  const [cardDiaVencimento, setCardDiaVencimento] = useState("10");
  const [savingCard, setSavingCard] = useState(false);

  // State for manual transaction dialog
  const [addTxFaturaId, setAddTxFaturaId] = useState<string | null>(null);
  const [txDescricao, setTxDescricao] = useState("");
  const [txValor, setTxValor] = useState("");
  const [txData, setTxData] = useState(() => new Date().toISOString().split("T")[0]);
  const [txCategoriaId, setTxCategoriaId] = useState("");
  const [salvandoTx, setSalvandoTx] = useState(false);

  // Filter by card
  const [filtroCartao, setFiltroCartao] = useState<string>("todos");

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

  const sortedFaturas = useMemo(() => {
    let list = [...faturas];
    if (filtroCartao !== "todos") {
      list = list.filter((f) => f.cartao_nome === filtroCartao);
    }
    return list.sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia));
  }, [faturas, filtroCartao]);

  const totalAberto = faturas.filter((f) => f.status !== "paga").reduce((s, f) => s + (f.valor_total - f.valor_pago), 0);

  // Card CRUD
  const openNewCard = () => {
    setEditingCardId(null);
    setCardNome("");
    setCardDiaVencimento("10");
    setCardDialogOpen(true);
  };

  const openEditCard = (card: any) => {
    setEditingCardId(card.id);
    setCardNome(card.nome);
    setCardDiaVencimento(String(card.dia_vencimento));
    setCardDialogOpen(true);
  };

  const handleSaveCard = async () => {
    if (!cardNome.trim()) return toast.error("Informe o nome do cartão");
    const dia = parseInt(cardDiaVencimento);
    if (!dia || dia < 1 || dia > 31) return toast.error("Dia de vencimento inválido (1-31)");

    setSavingCard(true);
    try {
      if (editingCardId) {
        const { error } = await supabase.from("cartoes_credito").update({ nome: cardNome.trim(), dia_vencimento: dia }).eq("id", editingCardId);
        if (error) throw error;
        toast.success("Cartão atualizado!");
      } else {
        const { error } = await supabase.from("cartoes_credito").insert({ nome: cardNome.trim(), dia_vencimento: dia });
        if (error) throw error;
        toast.success("Cartão criado!");
      }
      queryClient.invalidateQueries({ queryKey: ["cartoes_credito"] });
      setCardDialogOpen(false);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    } finally {
      setSavingCard(false);
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm("Deseja excluir este cartão?")) return;
    const { error } = await supabase.from("cartoes_credito").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Cartão excluído!");
      queryClient.invalidateQueries({ queryKey: ["cartoes_credito"] });
    }
  };

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

  // Unique card names from faturas for filtering
  const uniqueCardNames = useMemo(() => {
    const names = new Set(faturas.map((f) => f.cartao_nome));
    return Array.from(names).sort();
  }, [faturas]);

  // Previsão por cartão: soma das faturas futuras (em_aberto) agrupado por mês
  const previsaoCartao = useMemo(() => {
    const mesAtual = new Date().toISOString().substring(0, 7);
    const futuras = faturas.filter((f) => f.mes_referencia >= mesAtual && f.status !== "paga");
    const byCartaoMes: Record<string, Record<string, number>> = {};
    futuras.forEach((f) => {
      if (!byCartaoMes[f.cartao_nome]) byCartaoMes[f.cartao_nome] = {};
      byCartaoMes[f.cartao_nome][f.mes_referencia] = (byCartaoMes[f.cartao_nome][f.mes_referencia] || 0) + (f.valor_total - f.valor_pago);
    });
    return byCartaoMes;
  }, [faturas]);

  const mesesPrevisao = useMemo(() => {
    const meses = new Set<string>();
    Object.values(previsaoCartao).forEach((m) => Object.keys(m).forEach((k) => meses.add(k)));
    return Array.from(meses).sort();
  }, [previsaoCartao]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Cartões de Crédito</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seus cartões, faturas e previsão de gastos</p>
      </div>

      <Tabs defaultValue="faturas">
        <TabsList>
          <TabsTrigger value="faturas">Faturas</TabsTrigger>
          <TabsTrigger value="cartoes">Meus Cartões</TabsTrigger>
          <TabsTrigger value="previsao">Previsão</TabsTrigger>
        </TabsList>

        {/* TAB: FATURAS */}
        <TabsContent value="faturas" className="space-y-4 mt-4">
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

          {/* Filter */}
          <div className="flex items-center gap-3">
            <Label className="text-sm">Filtrar por cartão:</Label>
            <Select value={filtroCartao} onValueChange={setFiltroCartao}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os cartões</SelectItem>
                {uniqueCardNames.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Faturas list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Faturas</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : sortedFaturas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhuma fatura encontrada. Importe um extrato de cartão para criar.</div>
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
                                    <TableHead>Parcela</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>Grupo DRE</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {faturaMovs.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum item vinculado</TableCell></TableRow>
                                  ) : (
                                    faturaMovs.map((m: any) => (
                                      <TableRow key={m.id}>
                                        <TableCell>{m.descricao ?? "—"}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{m.parcela_info || "—"}</TableCell>
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
        </TabsContent>

        {/* TAB: MEUS CARTÕES */}
        <TabsContent value="cartoes" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openNewCard}>
              <Plus className="h-4 w-4 mr-1" /> Novo Cartão
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {loadingCartoes ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : cartoes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum cartão cadastrado. Clique em "Novo Cartão" para adicionar.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Dia Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cartoes.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-primary" />
                          {c.nome}
                        </TableCell>
                        <TableCell>Dia {c.dia_vencimento}</TableCell>
                        <TableCell>
                          <Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEditCard(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteCard(c.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: PREVISÃO */}
        <TabsContent value="previsao" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Previsão de Gastos por Cartão</CardTitle>
            </CardHeader>
            <CardContent>
              {mesesPrevisao.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhuma fatura futura em aberto. Importe faturas com parcelamentos para ver a previsão.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cartão</TableHead>
                      {mesesPrevisao.map((m) => (
                        <TableHead key={m} className="text-right">{m}</TableHead>
                      ))}
                      <TableHead className="text-right font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(previsaoCartao).map(([cartao, meses]) => {
                      const total = Object.values(meses).reduce((s, v) => s + v, 0);
                      return (
                        <TableRow key={cartao}>
                          <TableCell className="font-medium flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" /> {cartao}
                          </TableCell>
                          {mesesPrevisao.map((m) => (
                            <TableCell key={m} className="text-right font-mono">
                              {meses[m] ? formatCurrency(meses[m]) : "—"}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono font-bold">{formatCurrency(total)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">Total</TableCell>
                      {mesesPrevisao.map((m) => {
                        const total = Object.values(previsaoCartao).reduce((s, meses) => s + (meses[m] || 0), 0);
                        return <TableCell key={m} className="text-right font-mono font-bold">{formatCurrency(total)}</TableCell>;
                      })}
                      <TableCell className="text-right font-mono font-bold text-destructive">
                        {formatCurrency(Object.values(previsaoCartao).reduce((s, meses) => s + Object.values(meses).reduce((a, b) => a + b, 0), 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Cartão */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCardId ? "Editar Cartão" : "Novo Cartão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Cartão</Label>
              <Input value={cardNome} onChange={(e) => setCardNome(e.target.value)} placeholder="Ex: Nubank, Itaú..." />
            </div>
            <div className="space-y-2">
              <Label>Dia de Vencimento da Fatura</Label>
              <Input type="number" min={1} max={31} value={cardDiaVencimento} onChange={(e) => setCardDiaVencimento(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCard} disabled={savingCard}>
              {savingCard ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
