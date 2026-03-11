import { useState } from "react";
import { useTecidos, useCreateTecido, useUpdateTecido, useDeleteTecido } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import type { Tecido } from "@/types/database";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

interface TecidoForm {
  nome_tecido: string;
  custo_por_metro: string;
  fornecedor: string;
  rendimento_metro_por_kg: string;
}

const emptyForm: TecidoForm = {
  nome_tecido: "",
  custo_por_metro: "",
  fornecedor: "",
  rendimento_metro_por_kg: "",
};

export default function CadastroTecidos() {
  const { data: tecidos, isLoading } = useTecidos();
  const createMut = useCreateTecido();
  const updateMut = useUpdateTecido();
  const deleteMut = useDeleteTecido();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TecidoForm>(emptyForm);

  const filtered = (tecidos ?? []).filter((t) =>
    `${t.nome_tecido} ${t.fornecedor}`.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: Tecido) => {
    setEditingId(t.id);
    setForm({
      nome_tecido: t.nome_tecido ?? "",
      custo_por_metro: t.custo_por_metro?.toString() ?? "",
      fornecedor: t.fornecedor ?? "",
      rendimento_metro_por_kg: t.rendimento_metro_por_kg?.toString() ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome_tecido.trim()) {
      toast.error("Nome do tecido é obrigatório");
      return;
    }

    const payload = {
      nome_tecido: form.nome_tecido.trim(),
      custo_por_metro: form.custo_por_metro ? parseFloat(form.custo_por_metro) : null,
      fornecedor: form.fornecedor.trim() || null,
      rendimento_metro_por_kg: form.rendimento_metro_por_kg ? parseFloat(form.rendimento_metro_por_kg) : null,
    };

    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, ...payload });
        toast.success("Tecido atualizado!");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Tecido cadastrado!");
      }
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Tecido removido!");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            Cadastro de <span className="text-primary">Tecidos</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os tecidos disponíveis para produção</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Tecido
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Tecido" : "Novo Tecido"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome do Tecido *</Label>
                <Input
                  value={form.nome_tecido}
                  onChange={(e) => setForm({ ...form, nome_tecido: e.target.value })}
                  placeholder="Ex: Viscose Lisa"
                />
              </div>
              <div className="space-y-2">
                <Label>Custo por Metro (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.custo_por_metro}
                  onChange={(e) => setForm({ ...form, custo_por_metro: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input
                  value={form.fornecedor}
                  onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div className="space-y-2">
                <Label>Rendimento (m/kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.rendimento_metro_por_kg}
                  onChange={(e) => setForm({ ...form, rendimento_metro_por_kg: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={createMut.isPending || updateMut.isPending}
              >
                {editingId ? "Salvar Alterações" : "Cadastrar Tecido"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Buscar tecido ou fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum tecido encontrado</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Custo/Metro</TableHead>
                  <TableHead className="text-right">Rendimento (m/kg)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.nome_tecido ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.fornecedor ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(t.custo_por_metro)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {t.rendimento_metro_por_kg?.toFixed(2) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir tecido?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Essa ação não pode ser desfeita. O tecido "{t.nome_tecido}" será removido permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(t.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
