import { useState } from "react";
import { useOrdensProducao, useOficinas, useProdutos, useCores, useCreateOrdemProducao } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function OrdensProducao() {
  const { data: ordens, isLoading } = useOrdensProducao();
  const { data: oficinas } = useOficinas();
  const { data: produtos } = useProdutos();
  const { data: cores } = useCores();
  const createMut = useCreateOrdemProducao();

  const [open, setOpen] = useState(false);
  const [produtoId, setProdutoId] = useState("");
  const [corId, setCorId] = useState("");
  const [oficinaId, setOficinaId] = useState("");
  const [quantidade, setQuantidade] = useState(0);

  const oficinaMap = Object.fromEntries((oficinas ?? []).map((o) => [o.id, o]));
  const corMap = Object.fromEntries((cores ?? []).map((c) => [c.id, c]));
  const produtoMap = Object.fromEntries((produtos ?? []).map((p) => [p.id, p]));

  const handleCreate = async () => {
    try {
      const prod = produtoMap[produtoId];
      await createMut.mutateAsync({
        produto_id: produtoId,
        cor_id: corId || null,
        oficina_id: oficinaId || null,
        nome_produto: prod?.nome_do_produto ?? "",
        quantidade,
        quantidade_pecas_ordem: quantidade,
        status_ordem: "Corte",
        data_inicio: new Date().toISOString().split("T")[0],
      });
      toast.success("Ordem de produção criada!");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Ordens de Produção</h1>
          <p className="text-sm text-muted-foreground mt-1">{ordens?.length ?? 0} ordens</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Nova Ordem</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Oficina</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordens?.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.nome_produto ?? produtoMap[o.produto_id ?? ""]?.nome_do_produto ?? "—"}</TableCell>
                    <TableCell>
                      {o.cor_id && corMap[o.cor_id] ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: corMap[o.cor_id].cor_hex ?? "#ccc" }} />
                          {corMap[o.cor_id].nome_cor}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{o.oficina_id ? oficinaMap[o.oficina_id]?.nome_oficina ?? "—" : "—"}</TableCell>
                    <TableCell className="text-right">{o.quantidade ?? o.quantidade_pecas_ordem ?? 0}</TableCell>
                    <TableCell><StatusBadge status={o.status_ordem ?? ""} /></TableCell>
                    <TableCell className="text-muted-foreground">{o.data_inicio ?? "—"}</TableCell>
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
            <DialogTitle>Nova Ordem de Produção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {produtos?.filter((p) => p.ativo).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome_do_produto}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Select value={corId} onValueChange={setCorId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {cores?.filter((c) => c.ativo).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_cor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Oficina de Costura</Label>
              <Select value={oficinaId} onValueChange={setOficinaId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {oficinas?.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nome_oficina}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade de Peças</Label>
              <Input type="number" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
