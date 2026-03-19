import { useState, useMemo, useRef } from "react";
import { useMovimentacoesFinanceiras, useCategorias, useCreateMovimentacao, useUpdateMovimentacao } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatDateBR } from "@/lib/printUtils";
import { format, parseISO } from "date-fns";
import {
  DollarSign, Upload, Search, CircleCheck, Clock, AlertTriangle,
  Loader2, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const ITEMS_PER_PAGE = 50;
type SortKey = "status" | "data" | "data_vencimento" | "descricao" | "cliente" | "valor";
type SortDir = "asc" | "desc";

interface LancamentoExtrato {
  descricao: string;
  valor: number;
  data: string;
}

export default function ContasReceber() {
  const { data: movs, isLoading } = useMovimentacoesFinanceiras();
  const { data: categorias } = useCategorias();
  const updateMov = useUpdateMovimentacao();
  const createMov = useCreateMovimentacao();
  const queryClient = useQueryClient();
  const csvRef = useRef<HTMLInputElement>(null);

  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState(() => format(new Date(), "yyyy-MM"));
  const [busca, setBusca] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  // Import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importedRows, setImportedRows] = useState<LancamentoExtrato[]>([]);
  const [importSelected, setImportSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  const entradas = useMemo(() => {
    return (movs ?? []).filter((m) => m.tipo === "entrada");
  }, [movs]);

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    entradas.forEach((m) => {
      if (m.data) meses.add(m.data.substring(0, 7));
    });
    return Array.from(meses).sort().reverse();
  }, [entradas]);

  const filtered = useMemo(() => {
    return entradas.filter((m) => {
      if (filtroPeriodo !== "todos" && m.data && !m.data.startsWith(filtroPeriodo)) return false;
      const status = m.status_pagamento ?? "em_aberto";
      if (filtroStatus !== "todos" && status !== filtroStatus) return false;
      if (busca) {
        const search = busca.toLowerCase();
        const desc = (m.descricao ?? "").toLowerCase();
        const cli = (m.cliente ?? "").toLowerCase();
        if (!desc.includes(search) && !cli.includes(search)) return false;
      }
      return true;
    });
  }, [entradas, filtroPeriodo, filtroStatus, busca]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "data": cmp = (a.data ?? "").localeCompare(b.data ?? ""); break;
        case "data_vencimento": cmp = (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""); break;
        case "descricao": cmp = (a.descricao ?? "").localeCompare(b.descricao ?? "", "pt-BR"); break;
        case "cliente": cmp = (a.cliente ?? "").localeCompare(b.cliente ?? "", "pt-BR"); break;
        case "valor": cmp = (a.valor ?? 0) - (b.valor ?? 0); break;
        case "status": cmp = (a.status_pagamento ?? "em_aberto").localeCompare(b.status_pagamento ?? "em_aberto"); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = sorted.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const allPageSelected = paginatedData.length > 0 && paginatedData.every((m) => selectedIds.has(m.id));

  const toggleSelectAll = () => {
    if (allPageSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginatedData.map((m) => m.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkStatus = async (newStatus: "pago" | "em_aberto") => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const updates: Record<string, any> = { status_pagamento: newStatus };
      if (newStatus === "pago") updates.data_envio = today;

      const { error } = await supabase
        .from("movimentacoes_financeiras")
        .update(updates)
        .in("id", Array.from(selectedIds));

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      toast.success(`${selectedIds.size} recebíveis marcados como ${newStatus === "pago" ? "recebidos" : "em aberto"}!`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleToggleRecebido = async (m: any) => {
    const newStatus = (m.status_pagamento ?? "em_aberto") === "pago" ? "em_aberto" : "pago";
    try {
      await updateMov.mutateAsync({
        id: m.id,
        status_pagamento: newStatus,
        data_envio: newStatus === "pago" ? (m.data_envio || new Date().toISOString().split("T")[0]) : null,
      });
      toast.success(newStatus === "pago" ? "Marcado como recebido!" : "Marcado como em aberto!");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    }
  };

  // CSV Import
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const texto = ev.target?.result as string;
      const linhas = texto.trim().split("\n");
      const lancamentos: LancamentoExtrato[] = linhas.slice(1).map((linha, i) => {
        const colunas = linha.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        return {
          descricao: colunas[0] || `Recebimento ${i + 1}`,
          valor: Math.abs(parseFloat(colunas[1]) || 0),
          data: colunas[2] || new Date().toISOString().split("T")[0],
        };
      }).filter((l) => l.descricao && l.valor > 0);

      setImportedRows(lancamentos);
      setImportSelected(new Set(lancamentos.map((_, i) => i)));
      setImportDialogOpen(true);
    };
    reader.readAsText(file);
    if (csvRef.current) csvRef.current.value = "";
  };

  const handleImportConfirm = async () => {
    const selected = importedRows.filter((_, i) => importSelected.has(i));
    if (selected.length === 0) return toast.error("Selecione ao menos um lançamento");

    setImporting(true);
    try {
      for (const row of selected) {
        await createMov.mutateAsync({
          tipo: "entrada",
          descricao: row.descricao,
          valor: row.valor,
          data: row.data,
          origem: "extrato_bancario",
          status_pagamento: "pago",
          data_envio: row.data,
        });
      }
      toast.success(`${selected.length} recebimentos importados como pagos!`);
      setImportDialogOpen(false);
      setImportedRows([]);
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err.message || "erro"));
    } finally {
      setImporting(false);
    }
  };

  // Summary
  const totalRecebido = entradas.filter((e) => (e.status_pagamento ?? "em_aberto") === "pago").reduce((s, e) => s + (e.valor ?? 0), 0);
  const totalEmAberto = entradas.filter((e) => (e.status_pagamento ?? "em_aberto") === "em_aberto").reduce((s, e) => s + (e.valor ?? 0), 0);
  const totalGeral = entradas.reduce((s, e) => s + (e.valor ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Contas a Receber</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} recebíveis</p>
        </div>
        <Button size="sm" onClick={() => csvRef.current?.click()} className="gap-1.5">
          <Upload className="h-4 w-4" /> Importar Extrato
        </Button>
        <input ref={csvRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CircleCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totalRecebido)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em Aberto</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(totalEmAberto)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Geral</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(totalGeral)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Períodos</SelectItem>
            {mesesDisponiveis.map((m) => {
              const [y, mo] = m.split("-");
              return <SelectItem key={m} value={m}>{mo}/{y}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pago">Recebido</SelectItem>
            <SelectItem value="em_aberto">Em Aberto</SelectItem>
          </SelectContent>
        </Select>
        <div className="col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por descrição ou cliente..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
          <span className="text-sm font-medium">{selectedIds.size} selecionada(s)</span>
          <Button size="sm" variant="default" onClick={() => handleBulkStatus("pago")} disabled={bulkUpdating} className="gap-1">
            {bulkUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleCheck className="h-3.5 w-3.5" />}
            Marcar como Recebido
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkStatus("em_aberto")} disabled={bulkUpdating} className="gap-1">
            {bulkUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
            Marcar como Em Aberto
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Limpar</Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} aria-label="Selecionar todos" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>
                    <span className="flex items-center">Status<SortIcon col="status" /></span>
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
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("cliente")}>
                    <span className="flex items-center">Cliente<SortIcon col="cliente" /></span>
                  </TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("valor")}>
                    <span className="flex items-center justify-end">Valor<SortIcon col="valor" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((m) => {
                  const isRecebido = (m.status_pagamento ?? "em_aberto") === "pago";
                  const isSelected = selectedIds.has(m.id);
                  return (
                    <TableRow key={m.id} className={cn(isSelected && "bg-accent/50")}>
                      <TableCell>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(m.id)} />
                      </TableCell>
                      <TableCell>
                        <button onClick={() => handleToggleRecebido(m)} title={isRecebido ? "Marcar como em aberto" : "Marcar como recebido"}>
                          {isRecebido ? (
                            <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700 text-white cursor-pointer">
                              <CircleCheck className="h-3 w-3" /> Recebido
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 cursor-pointer">
                              <Clock className="h-3 w-3" /> Em Aberto
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateBR(m.data)}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {m.data_vencimento ? formatDateBR(m.data_vencimento) : "—"}
                      </TableCell>
                      <TableCell className="font-medium max-w-xs truncate">{m.descricao ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{m.cliente ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{m.origem ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{formatCurrency(m.valor)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                {((safePage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(safePage * ITEMS_PER_PAGE, sorted.length)} de {sorted.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">{safePage} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Recebimentos do Extrato</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {importedRows.length} lançamentos encontrados. Selecione os que deseja importar como recebidos.
          </p>
          <div className="border rounded-lg divide-y max-h-[50vh] overflow-y-auto">
            {importedRows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3">
                <Checkbox
                  checked={importSelected.has(idx)}
                  onCheckedChange={() => {
                    setImportSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(idx)) next.delete(idx); else next.add(idx);
                      return next;
                    });
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{row.descricao}</p>
                  <p className="text-xs text-muted-foreground">{formatDateBR(row.data)}</p>
                </div>
                <span className="text-sm font-bold text-green-600 whitespace-nowrap">{formatCurrency(row.valor)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{importSelected.size} selecionados</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setImportSelected(importSelected.size === importedRows.length ? new Set() : new Set(importedRows.map((_, i) => i)))}
              >
                {importSelected.size === importedRows.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleImportConfirm} disabled={importing || importSelected.size === 0}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Importar {importSelected.size} recebimentos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
