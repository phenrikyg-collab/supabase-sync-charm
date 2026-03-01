import { useState } from "react";
import { useOficinas, useCreateOficina, useUpdateOficina, useDeleteOficina } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function Oficinas() {
  const { data: oficinas, isLoading } = useOficinas();
  const createMut = useCreateOficina();
  const updateMut = useUpdateOficina();
  const deleteMut = useDeleteOficina();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [custo, setCusto] = useState(0);
  const [contato, setContato] = useState("");
  const [obs, setObs] = useState("");

  const openNew = () => { setEditId(null); setNome(""); setTipo(""); setCusto(0); setContato(""); setObs(""); setOpen(true); };
  const openEdit = (o: any) => { setEditId(o.id); setNome(o.nome_oficina ?? ""); setTipo(o.tipo_oficina ?? ""); setCusto(o.custo_por_peca ?? 0); setContato(o.contato ?? ""); setObs(o.observacao ?? ""); setOpen(true); };

  const handleSave = async () => {
    try {
      const payload = { nome_oficina: nome, tipo_oficina: tipo, custo_por_peca: custo, contato, observacao: obs };
      if (editId) {
        await updateMut.mutateAsync({ id: editId, ...payload });
        toast.success("Oficina atualizada!");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Oficina criada!");
      }
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir oficina?")) return;
    try { await deleteMut.mutateAsync(id); toast.success("Oficina excluída!"); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            <span className="text-primary">Oficinas</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de oficinas de costura</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nova Oficina</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Custo/Peça</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oficinas?.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.nome_oficina}</TableCell>
                    <TableCell className="text-muted-foreground">{o.tipo_oficina ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(o.custo_por_peca)}</TableCell>
                    <TableCell className="text-muted-foreground">{o.contato ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)}><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editId ? "Editar Oficina" : "Nova Oficina"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div className="space-y-2"><Label>Tipo</Label><Input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Costura, Acabamento..." /></div>
            <div className="space-y-2"><Label>Custo por Peça</Label><Input type="number" step="0.01" value={custo} onChange={(e) => setCusto(Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Contato</Label><Input value={contato} onChange={(e) => setContato(e.target.value)} /></div>
            <div className="space-y-2"><Label>Observação</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
