import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Search, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

type Aviamento = {
  id: string;
  nome_aviamento: string;
  unidade_medida: string | null;
  estoque_atual: number | null;
  custo_aviamento: number | null;
  created_at?: string;
};

const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

export default function Aviamentos() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [editando, setEditando] = useState<Aviamento | null>(null);

  const { data: aviamentos = [], isLoading } = useQuery({
    queryKey: ["aviamentos-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aviamentos" as any)
        .select("id, nome_aviamento, unidade_medida, estoque_atual, custo_aviamento, created_at")
        .order("nome_aviamento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Aviamento[];
    },
  });

  const { data: usoMap = {} } = useQuery({
    queryKey: ["aviamentos-uso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_aviamentos" as any)
        .select("aviamento_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        if (!r.aviamento_id) return;
        map[r.aviamento_id] = (map[r.aviamento_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return aviamentos;
    return aviamentos.filter((a) => (a.nome_aviamento || "").toLowerCase().includes(q));
  }, [aviamentos, busca]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["aviamentos-list"] });
    qc.invalidateQueries({ queryKey: ["aviamentos-uso"] });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Aviamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão centralizada de aviamentos. O custo é propagado automaticamente aos produtos vinculados.
          </p>
        </div>
        <Button onClick={() => setNovoOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Aviamento
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Estoque Atual</TableHead>
              <TableHead className="text-right">Custo Unitário</TableHead>
              <TableHead className="text-right">Qtd. Produtos que usam</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Nenhum aviamento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((a) => {
                const uso = usoMap[a.id] ?? 0;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.nome_aviamento}</TableCell>
                    <TableCell>{a.unidade_medida || "—"}</TableCell>
                    <TableCell className="text-right">
                      {Number(a.estoque_atual ?? 0).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => setEditando(a)}
                    >
                      {fmtMoney(a.custo_aviamento)}
                    </TableCell>
                    <TableCell className="text-right">{uso}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditando(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <NovoAviamentoDialog open={novoOpen} onOpenChange={setNovoOpen} onSaved={refresh} />
      <EditarCustoDialog
        aviamento={editando}
        usoCount={editando ? (usoMap[editando.id] ?? 0) : 0}
        onOpenChange={(o) => !o && setEditando(null)}
        onSaved={refresh}
      />
    </div>
  );
}

function NovoAviamentoDialog({
  open, onOpenChange, onSaved,
}: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("");
  const [estoque, setEstoque] = useState<string>("0");
  const [custo, setCusto] = useState<string>("0");
  const [saving, setSaving] = useState(false);

  const reset = () => { setNome(""); setUnidade(""); setEstoque("0"); setCusto("0"); };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Informe o nome."); return; }
    if (!unidade.trim()) { toast.error("Informe a unidade de medida."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("aviamentos" as any).insert({
        nome_aviamento: nome.trim(),
        unidade_medida: unidade.trim(),
        estoque_atual: Number(estoque) || 0,
        custo_aviamento: Number(custo) || 0,
      });
      if (error) throw error;
      toast.success("Aviamento cadastrado!");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cadastrar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Novo Aviamento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Unidade de medida *</Label>
            <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, m, kg..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estoque atual</Label>
              <Input type="number" step="0.01" value={estoque} onChange={(e) => setEstoque(e.target.value)} />
            </div>
            <div>
              <Label>Custo unitário (R$)</Label>
              <Input type="number" step="0.0001" value={custo} onChange={(e) => setCusto(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarCustoDialog({
  aviamento, usoCount, onOpenChange, onSaved,
}: {
  aviamento: Aviamento | null;
  usoCount: number;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [custo, setCusto] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (aviamento) setCusto(String(aviamento.custo_aviamento ?? 0));
  }, [aviamento]);

  const handleSave = async () => {
    if (!aviamento) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("aviamentos" as any)
        .update({ custo_aviamento: Number(custo) || 0 })
        .eq("id", aviamento.id);
      if (error) throw error;
      toast.success("Custo atualizado! Propagação em andamento nos produtos vinculados.");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!aviamento} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar custo — {aviamento?.nome_aviamento}</DialogTitle>
          <DialogDescription>
            Este aviamento é usado em <strong>{usoCount}</strong> {usoCount === 1 ? "produto" : "produtos"}.
            O custo será atualizado automaticamente em todos eles.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Custo unitário (R$)</Label>
          <Input
            type="number"
            step="0.0001"
            value={custo}
            onChange={(e) => setCusto(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirmar e propagar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
