import { useState, useMemo } from "react";
import { useMovimentacoesFinanceiras, useCategorias, useCentrosCusto, useUpdateMovimentacao, useDeleteMovimentacao } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatDateBR } from "@/lib/printUtils";
import { Pencil, Trash2, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroCentro, setFiltroCentro] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todos");
  const [editingMov, setEditingMov] = useState<any | null>(null);
  const [catComboOpen, setCatComboOpen] = useState(false);


  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sortedCategorias = useMemo(() => 
    [...(categorias ?? [])].sort((a, b) => (a.nome_categoria ?? "").localeCompare(b.nome_categoria ?? "", "pt-BR")),
    [categorias]
  );

  const catMap = Object.fromEntries((categorias ?? []).map((c) => [c.id, c.nome_categoria]));
  const catDescMap = Object.fromEntries((categorias ?? []).map((c) => [c.id, c.descricao_categoria]));
  const centroMap = Object.fromEntries((centros ?? []).map((c) => [c.id, c.nome_centro]));

  const filtered = movs?.filter((m) => {
    if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
    if (filtroCategoria !== "todos" && m.categoria_id !== filtroCategoria) return false;
    if (filtroCentro !== "todos" && m.centro_custo_id !== filtroCentro) return false;
    if (filtroOrigem !== "todos" && m.origem !== filtroOrigem) return false;
    return true;
  }) ?? [];

  const origens = [...new Set(movs?.map((m) => m.origem).filter(Boolean) ?? [])];
  const tipos = [...new Set(movs?.map((m) => m.tipo).filter(Boolean) ?? [])];

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">{filtered.length} movimentações</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Desc. Categoria</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateBR(m.data)}</TableCell>
                    <TableCell className="font-medium max-w-xs truncate">{m.descricao ?? "—"}</TableCell>
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
                ))}
              </TableBody>
            </Table>
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
              <div>
                <label className="text-sm font-medium">Data</label>
                <Input type="date" value={editingMov.data} onChange={(e) => setEditingMov({ ...editingMov, data: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Input value={editingMov.descricao ?? ""} onChange={(e) => setEditingMov({ ...editingMov, descricao: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Valor</label>
                <Input type="number" step="0.01" value={editingMov.valor} onChange={(e) => setEditingMov({ ...editingMov, valor: parseFloat(e.target.value) || 0 })} />
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
                <Select value={editingMov.categoria_id ?? "none"} onValueChange={(v) => setEditingMov({ ...editingMov, categoria_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categorias?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_categoria} {c.descricao_categoria ? `— ${c.descricao_categoria}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
    </div>
  );
}
