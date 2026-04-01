import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trophy } from "lucide-react";
import { toast } from "sonner";
import TabFichasTecnicas from "@/components/bonificacao/TabFichasTecnicas";

/* ───── Costureiras ───── */

function TabProducao() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", funcao: "Reta", participacao_pct: 20 });

  const { data: costureiras = [], isLoading } = useQuery({
    queryKey: ["costureiras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("costureiras")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("costureiras").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("costureiras").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["costureiras"] });
      toast.success(editId ? "Costureira atualizada" : "Costureira adicionada");
      closeModal();
    },
    onError: () => toast.error("Erro ao salvar costureira"),
  });

  const toggleAtiva = useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) => {
      const { error } = await supabase.from("costureiras").update({ ativa }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["costureiras"] }),
  });

  function openNew() {
    setEditId(null);
    setForm({ nome: "", funcao: "Reta", participacao_pct: 20 });
    setOpen(true);
  }

  function openEdit(c: any) {
    setEditId(c.id);
    setForm({ nome: c.nome, funcao: c.funcao, participacao_pct: c.participacao_pct });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditId(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg text-primary">Costureiras</CardTitle>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nova Costureira
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>% Participação</TableHead>
              <TableHead>Ativa</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : costureiras.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma costureira cadastrada</TableCell></TableRow>
            ) : (
              costureiras.map((c: any, i: number) => (
                <TableRow key={c.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.funcao}</TableCell>
                  <TableCell>{c.participacao_pct}%</TableCell>
                  <TableCell>
                    <Switch checked={c.ativa} onCheckedChange={(v) => toggleAtiva.mutate({ id: c.id, ativa: v })} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Costureira" : "Nova Costureira"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Função</Label>
              <Select value={form.funcao} onValueChange={(v) => setForm({ ...form, funcao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reta">Reta</SelectItem>
                  <SelectItem value="Overloque">Overloque</SelectItem>
                  <SelectItem value="Galoneira">Galoneira</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>% Participação</Label>
              <Input type="number" value={form.participacao_pct} onChange={(e) => setForm({ ...form, participacao_pct: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={() => upsert.mutate()} disabled={!form.nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ───── Revisoras ───── */

function TabRevisao() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");

  const { data: revisoras = [], isLoading } = useQuery({
    queryKey: ["revisoras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("revisoras").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const insert = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("revisoras").insert({ nome });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revisoras"] });
      toast.success("Revisora adicionada");
      setOpen(false);
      setNome("");
    },
    onError: () => toast.error("Erro ao salvar revisora"),
  });

  const toggleAtiva = useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) => {
      const { error } = await supabase.from("revisoras").update({ ativa }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revisoras"] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg text-primary">Revisoras</CardTitle>
        <Button size="sm" onClick={() => { setNome(""); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Revisora
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Ativa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : revisoras.length === 0 ? (
              <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Nenhuma revisora cadastrada</TableCell></TableRow>
            ) : (
              revisoras.map((r: any, i: number) => (
                <TableRow key={r.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell>
                    <Switch checked={r.ativa} onCheckedChange={(v) => toggleAtiva.mutate({ id: r.id, ativa: v })} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Revisora</DialogTitle></DialogHeader>
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => insert.mutate()} disabled={!nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ───── Página Principal ───── */

export default function Bonificacao() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-primary">Bonificação</h1>
      </div>

      <Tabs defaultValue="fichas" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fichas">Fichas Técnicas</TabsTrigger>
          <TabsTrigger value="producao">Produção</TabsTrigger>
          <TabsTrigger value="revisao">Revisão</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="fichas">
          <TabFichasTecnicas />
        </TabsContent>

        <TabsContent value="producao">
          <TabProducao />
        </TabsContent>

        <TabsContent value="revisao">
          <TabRevisao />
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader><CardTitle className="text-lg text-primary">Configurações</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Em breve.</p></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
