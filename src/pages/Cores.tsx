import { useState } from "react";
import { useCores, useCreateCor, useUpdateCor, useDeleteCor } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Cor } from "@/types/database";

export default function Cores() {
  const { data: cores, isLoading } = useCores();
  const createMut = useCreateCor();
  const updateMut = useUpdateCor();
  const deleteMut = useDeleteCor();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cor | null>(null);
  const [nome, setNome] = useState("");
  const [hex, setHex] = useState("#000000");

  const openNew = () => { setEditing(null); setNome(""); setHex("#000000"); setOpen(true); };
  const openEdit = (c: Cor) => { setEditing(c); setNome(c.nome_cor ?? ""); setHex(c.cor_hex ?? "#000000"); setOpen(true); };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, nome_cor: nome, cor_hex: hex });
        toast.success("Cor atualizada!");
      } else {
        await createMut.mutateAsync({ nome_cor: nome, cor_hex: hex, ativo: true });
        toast.success("Cor criada!");
      }
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Cor removida!");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Cores</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerenciar paleta de cores</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nova Cor</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cor</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Hex</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cores?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="w-8 h-8 rounded-full border border-border" style={{ backgroundColor: c.cor_hex ?? "#ccc" }} />
                    </TableCell>
                    <TableCell className="font-medium">{c.nome_cor}</TableCell>
                    <TableCell className="text-muted-foreground">{c.cor_hex}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cor" : "Nova Cor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Cor</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Preto" />
            </div>
            <div className="space-y-2">
              <Label>Cor (Hex)</Label>
              <div className="flex gap-3 items-center">
                <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="w-12 h-10 rounded border border-border cursor-pointer" />
                <Input value={hex} onChange={(e) => setHex(e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
