import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useMovimentacoesFinanceiras, useCategorias, useCentrosCusto, useUpdateMovimentacao, useDeleteMovimentacao } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatDateBR } from "@/lib/printUtils";
import { Pencil, Trash2, Loader2, Check, ChevronsUpDown, CircleCheck, Clock, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const ITEMS_PER_PAGE = 50;

type SortKey = "status_pagamento" | "data" | "data_vencimento" | "descricao" | "tipo" | "categoria" | "origem" | "valor";
type SortDir = "asc" | "desc";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function Financeiro() {
  const { data: movs, isLoading } = useMovimentacoesFinanceiras();
  const { data: categorias } = useCategorias();
  const { data: centros } = useCentrosCusto();
  const updateMov = useUpdateMovimentacao();
  const deleteMov = useDeleteMovimentacao();
  const queryClient = useQueryClient();

  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroCentro, setFiltroCentro] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState(() => format(new Date(), "yyyy-MM"));
  const [editingMov, setEditingMov] = useState<any | null>(null);
  const [catComboOpen, setCatComboOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkCatOpen, setBulkCatOpen] = useState(false);
  const [bulkCatUpdating, setBulkCatUpdating] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    (movs ?? []).forEach((m) => {
      if (m.data) meses.add(m.data.substring(0, 7));
    });
    return Array.from(meses).sort().reverse();
  }, [movs]);

  const sortedCategorias = useMemo(() => 
    [...(categorias ?? [])].sort((a, b) => (a.nome_categoria ?? "").localeCompare(b.nome_categoria ?? "", "pt-BR")),
    [categorias]
  );

  const catGrouped = useMemo(() => {
    const groups: Record<string, { id: string; label: string }[]> = {};
    (categorias ?? []).forEach((c: any) => {
      const grupo = c.grupo_dre || "Outros";
      if (!groups[grupo]) groups[grupo] = [];
      const label = c.descricao_categoria || c.nome_categoria || "";
      if (label && label !== grupo) {
        groups[grupo].push({ id: c.id, label });
      }
    });
    return groups;
  }, [categorias]);

  const catMap = Object.fromEntries((categorias ?? []).map((c) => [c.id, c.nome_categoria]));
  const catDescMap = Object.fromEntries((categorias ?? []).map((c) => [c.id, c.descricao_categoria]));

  const filtered = useMemo(() => {
    return (movs ?? []).filter((m) => {
      if (filtroPeriodo !== "todos" && m.data && !m.data.startsWith(filtroPeriodo)) return false;
      if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
      if (filtroCategoria !== "todos" && m.categoria_id !== filtroCategoria) return false;
      if (filtroCentro !== "todos" && m.centro_custo_id !== filtroCentro) return false;
      if (filtroOrigem !== "todos" && m.origem !== filtroOrigem) return false;
      if (filtroStatus !== "todos" && (m.status_pagamento ?? "em_aberto") !== filtroStatus) return false;
      return true;
    });
  }, [movs, filtroPeriodo, filtroTipo, filtroCategoria, filtroCentro, filtroOrigem, filtroStatus]);

  const origens = [...new Set(movs?.map((m) => m.origem).filter(Boolean) ?? [])];
  const tipos = [...new Set(movs?.map((m) => m.tipo).filter(Boolean) ?? [])];

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "data": cmp = (a.data ?? "").localeCompare(b.data ?? ""); break;
        case "data_vencimento": cmp = (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""); break;
        case "descricao": cmp = (a.descricao ?? "").localeCompare(b.descricao ?? "", "pt-BR"); break;
        case "tipo": cmp = (a.tipo ?? "").localeCompare(b.tipo ?? ""); break;
        case "categoria": cmp = (catMap[a.categoria_id ?? ""] ?? "").localeCompare(catMap[b.categoria_id ?? ""] ?? "", "pt-BR"); break;
        case "origem": cmp = (a.origem ?? "").localeCompare(b.origem ?? ""); break;
        case "valor": cmp = (a.valor ?? 0) - (b.valor ?? 0); break;
        case "status_pagamento": cmp = (a.status_pagamento ?? "em_aberto").localeCompare(b.status_pagamento ?? "em_aberto"); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir, catMap]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = sorted.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const allFilteredSelected = paginatedData.length > 0 && paginatedData.every((m) => selectedIds.has(m.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedData.map((m) => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkStatus = async (newStatus: "pago" | "em_aberto") => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const updates: Record<string, any> = {
        status_pagamento: newStatus,
      };
      if (newStatus === "pago") {
        updates.data_envio = today;
      }

      const { error } = await supabase
        .from("movimentacoes_financeiras")
        .update(updates)
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      toast.success(`${selectedIds.size} transações marcadas como ${newStatus === "pago" ? "pagas" : "em aberto"}!`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error("Erro na atualização em massa: " + (err.message || "erro"));
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMov) return;
    try {
      await updateMov.mutateAsync({
        id: editingMov.id,
        descricao: editingMov.descricao,
        valor: editingMov.valor,
        tipo: editingMov.tipo,
        categoria_id: editingMov.categoria_id,
        data: editingMov.data,
        data_vencimento: editingMov.data_vencimento || null,
        status_pagamento: editingMov.status_pagamento,
        data_envio: editingMov.status_pagamento === "pago" ? (editingMov.data_envio || new Date().toISOString().split("T")[0]) : null,
      });
      toast.success("Transação atualizada!");
      setEditingMov(null);
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + (err.message || "erro"));
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMov.mutateAsync(deletingId);
      toast.success("Transação excluída!");
      setDeletingId(null);
    } catch (err: any) {
      toast.error("Erro ao excluir: " + (err.message || "erro"));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const { error } = await supabase
        .from("movimentacoes_financeiras")
        .delete()
        .in("id", Array.from(selectedIds));
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      toast.success(`${selectedIds.size} transações excluídas!`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } catch (err: any) {
      toast.error("Erro na exclusão em massa: " + (err.message || "erro"));
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleTogglePago = async (m: any) => {
    const newStatus = (m.status_pagamento ?? "em_aberto") === "pago" ? "em_aberto" : "pago";
    try {
      await updateMov.mutateAsync({
        id: m.id,
        status_pagamento: newStatus,
        data_envio: newStatus === "pago" ? (m.data_envio || new Date().toISOString().split("T")[0]) : null,
      });
      toast.success(newStatus === "pago" ? "Marcada como paga!" : "Marcada como em aberto!");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Transações</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} transações</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Períodos</SelectItem>
            {mesesDisponiveis.map((m) => {
              const [y, mo] = m.split("-");
              const label = `${mo}/${y}`;
              return <SelectItem key={m} value={m}>{label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tipos</SelectItem>
            {tipos.map((t) => <SelectItem key={t} value={t!}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {categorias?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_categoria}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCentro} onValueChange={setFiltroCentro}>
          <SelectTrigger><SelectValue placeholder="Centro Custo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {centros?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_centro}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
          <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {origens.map((o) => <SelectItem key={o} value={o!}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger><SelectValue placeholder="Status Pgto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="em_aberto">Em Aberto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
          <span className="text-sm font-medium">{selectedIds.size} selecionada(s)</span>
          <Button
            size="sm"
            variant="default"
            onClick={() => handleBulkStatus("pago")}
            disabled={bulkUpdating || bulkDeleting}
            className="gap-1"
          >
            {bulkUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleCheck className="h-3.5 w-3.5" />}
            Marcar como Pago
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkStatus("em_aberto")}
            disabled={bulkUpdating || bulkDeleting}
            className="gap-1"
          >
            {bulkUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
            Marcar como Em Aberto
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkDeleteOpen(true)}
            disabled={bulkUpdating || bulkDeleting}
            className="gap-1"
          >
            {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Excluir Selecionadas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Limpar seleção
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status_pagamento")}>
                    <span className="flex items-center">Status<SortIcon col="status_pagamento" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("data")}>
                    <span className="flex items-center">Competência<SortIcon col="data" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("data_vencimento")}>
                    <span className="flex items-center">Vencimento<SortIcon col="data_vencimento" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("descricao")}>
                    <span className="flex items-center">Descrição<SortIcon col="descricao" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("tipo")}>
                    <span className="flex items-center">Tipo<SortIcon col="tipo" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("categoria")}>
                    <span className="flex items-center">Categoria<SortIcon col="categoria" /></span>
                  </TableHead>
                  <TableHead>Desc. Categoria</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("origem")}>
                    <span className="flex items-center">Origem<SortIcon col="origem" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("valor")}>
                    <span className="flex items-center justify-end">Valor<SortIcon col="valor" /></span>
                  </TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((m) => {
                  const isPago = (m.status_pagamento ?? "em_aberto") === "pago";
                  const isVencido = !isPago && m.data_vencimento && new Date(m.data_vencimento + "T00:00:00") < new Date(new Date().toISOString().split("T")[0] + "T00:00:00");
                  const isSelected = selectedIds.has(m.id);
                  return (
                    <TableRow key={m.id} className={cn(isVencido && "bg-destructive/5", isSelected && "bg-accent/50")}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(m.id)}
                          aria-label={`Selecionar ${m.descricao}`}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleTogglePago(m)}
                          className="flex items-center gap-1.5"
                          title={isPago ? "Marcar como em aberto" : "Marcar como pago"}
                        >
                          {isPago ? (
                            <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700 text-white cursor-pointer">
                              <CircleCheck className="h-3 w-3" /> Pago
                            </Badge>
                          ) : (
                            <Badge variant={isVencido ? "destructive" : "outline"} className="gap-1 cursor-pointer">
                              <Clock className="h-3 w-3" /> {isVencido ? "Vencido" : "Em Aberto"}
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateBR(m.data)}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {m.data_vencimento ? formatDateBR(m.data_vencimento) : "—"}
                      </TableCell>
                      <TableCell className="font-medium max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{m.descricao ?? "—"}</span>
                          {(m as any).conta_tipo === "cartao_fatura" && (
                            <Badge variant="outline" className="shrink-0 text-[10px] py-0 px-1.5 gap-0.5 border-primary/30 text-primary">
                              <CreditCard className="h-2.5 w-2.5" /> Cartão
                            </Badge>
                          )}
                          {(m as any).conta_tipo === "pagamento_cartao" && (
                            <Badge variant="outline" className="shrink-0 text-[10px] py-0 px-1.5 gap-0.5 border-success/30 text-success">
                              <CreditCard className="h-2.5 w-2.5" /> Pgto Fatura
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.tipo === "entrada" ? "default" : "secondary"}>
                          {m.tipo ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.categoria_id ? catMap[m.categoria_id] ?? "—" : "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{m.categoria_id ? catDescMap[m.categoria_id] ?? "—" : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{m.origem ?? "—"}</TableCell>
                      <TableCell className={`text-right font-medium ${m.tipo === "entrada" ? "text-success" : "text-danger"}`}>
                        {formatCurrency(m.valor)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingMov({ ...m })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(m.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {((safePage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(safePage * ITEMS_PER_PAGE, sorted.length)} de {sorted.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingMov} onOpenChange={(open) => !open && setEditingMov(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
          </DialogHeader>
          {editingMov && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Data Competência</label>
                  <Input type="date" value={editingMov.data} onChange={(e) => setEditingMov({ ...editingMov, data: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Data Vencimento</label>
                  <Input type="date" value={editingMov.data_vencimento ?? ""} onChange={(e) => setEditingMov({ ...editingMov, data_vencimento: e.target.value || null })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Input value={editingMov.descricao ?? ""} onChange={(e) => setEditingMov({ ...editingMov, descricao: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Valor</label>
                  <Input type="number" step="0.01" value={editingMov.valor} onChange={(e) => setEditingMov({ ...editingMov, valor: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Status Pagamento</label>
                  <Select value={editingMov.status_pagamento ?? "em_aberto"} onValueChange={(v) => setEditingMov({ ...editingMov, status_pagamento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em_aberto">Em Aberto</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select value={editingMov.tipo ?? ""} onValueChange={(v) => setEditingMov({ ...editingMov, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Popover open={catComboOpen} onOpenChange={setCatComboOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={catComboOpen} className="w-full justify-between font-normal">
                      {editingMov.categoria_id
                        ? (() => {
                            const cat = sortedCategorias.find(c => c.id === editingMov.categoria_id);
                            return cat ? `${cat.nome_categoria}${cat.descricao_categoria ? ` — ${cat.descricao_categoria}` : ""}` : "Sem categoria";
                          })()
                        : "Sem categoria"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar categoria..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="sem-categoria"
                            onSelect={() => {
                              setEditingMov({ ...editingMov, categoria_id: null });
                              setCatComboOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", !editingMov.categoria_id ? "opacity-100" : "opacity-0")} />
                            Sem categoria
                          </CommandItem>
                          {sortedCategorias.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.nome_categoria ?? ""} ${c.descricao_categoria ?? ""}`}
                              onSelect={() => {
                                setEditingMov({ ...editingMov, categoria_id: c.id });
                                setCatComboOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", editingMov.categoria_id === c.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-medium">{c.nome_categoria}</span>
                                {c.descricao_categoria && <span className="text-xs text-muted-foreground">{c.descricao_categoria}</span>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMov(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updateMov.isPending}>
              {updateMov.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMov.isPending}>
              {deleteMov.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} transações?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Todas as transações selecionadas serão removidas permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir {selectedIds.size} transações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
