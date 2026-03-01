import { useState, useEffect } from "react";
import { useOrdensProducao, useOficinas, useProdutos, useCores, useOrdensCorte, useCreateOrdemProducao } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function OrdensProducao() {
  const { data: ordens, isLoading } = useOrdensProducao();
  const { data: oficinas } = useOficinas();
  const { data: produtos } = useProdutos();
  const { data: cores } = useCores();
  const { data: ordensCorte } = useOrdensCorte();
  const createMut = useCreateOrdemProducao();

  const [open, setOpen] = useState(false);
  const [ocId, setOcId] = useState("");
  const [oficinaId, setOficinaId] = useState("");
  const [quantidade, setQuantidade] = useState(0);
  const [ocInfo, setOcInfo] = useState<{ produto: string; cor: string; grade: string } | null>(null);

  const oficinaMap = Object.fromEntries((oficinas ?? []).map((o) => [o.id, o]));
  const corMap = Object.fromEntries((cores ?? []).map((c) => [c.id, c]));

  // Filter OCs that are in "Planejada" status
  const ocsDisponiveis = ordensCorte?.filter((oc) => oc.status === "Planejada") ?? [];

  useEffect(() => {
    if (!ocId) { setOcInfo(null); return; }
    Promise.all([
      supabase.from("ordens_corte_produtos").select("*").eq("ordem_corte_id", ocId),
      supabase.from("ordens_corte_grade").select("*").eq("ordem_corte_id", ocId),
    ]).then(([prodRes, gradeRes]) => {
      const prods = prodRes.data ?? [];
      const grades = gradeRes.data ?? [];
      const totalPecas = grades.reduce((a: number, g: any) => a + (g.quantidade ?? 0), 0);
      setQuantidade(totalPecas);
      const corId = grades[0]?.cor_id;
      setOcInfo({
        produto: prods.map((p: any) => p.nome_produto).join(", ") || "—",
        cor: corId && corMap[corId] ? corMap[corId].nome_cor ?? "—" : "—",
        grade: grades.map((g: any) => `${g.tamanho}: ${g.quantidade}`).join(", "),
      });
    });
  }, [ocId]);

  const handleCreate = async () => {
    if (!ocId || !oficinaId) { toast.error("Selecione OC e Oficina"); return; }
    try {
      const oc = ordensCorte?.find((o) => o.id === ocId);
      const prodRes = await supabase.from("ordens_corte_produtos").select("*").eq("ordem_corte_id", ocId).limit(1);
      const prod = prodRes.data?.[0];

      await createMut.mutateAsync({
        ordem_corte_id: ocId,
        produto_id: prod?.produto_id ?? null,
        nome_produto: prod?.nome_produto ?? "",
        oficina_id: oficinaId,
        quantidade,
        quantidade_pecas_ordem: quantidade,
        status_ordem: "Corte",
        data_inicio: new Date().toISOString().split("T")[0],
      });
      toast.success("Ordem de produção criada!");
      setOpen(false);
      setOcId(""); setOficinaId("");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            Ordens de <span className="text-primary">Produção</span>
          </h1>
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
                    <TableCell className="font-medium">{o.nome_produto ?? "—"}</TableCell>
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
          <DialogHeader><DialogTitle>Nova Ordem de Produção</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ordem de Corte</Label>
              <Select value={ocId} onValueChange={setOcId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma OC..." /></SelectTrigger>
                <SelectContent>
                  {ocsDisponiveis.map((oc) => (
                    <SelectItem key={oc.id} value={oc.id}>{oc.numero_oc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {ocInfo && (
              <div className="p-3 bg-muted/50 rounded-lg border border-border space-y-1 text-sm">
                <p><span className="text-muted-foreground">Produto:</span> {ocInfo.produto}</p>
                <p><span className="text-muted-foreground">Cor:</span> {ocInfo.cor}</p>
                <p><span className="text-muted-foreground">Grade:</span> {ocInfo.grade}</p>
                <p><span className="text-muted-foreground">Total Peças:</span> {quantidade}</p>
              </div>
            )}
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
