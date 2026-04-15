import { useState } from "react";
import { useRolosTecido, useTecidos } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DollarSign, Search, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function EstoqueTecidos() {
  const { data: rolos, isLoading } = useRolosTecido();
  const { data: tecidos } = useTecidos();
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editRolo, setEditRolo] = useState<any>(null);
  const [editFields, setEditFields] = useState({
    codigo_rolo: "",
    lote: "",
    cor_nome: "",
    cor_hex: "",
    metragem_disponivel: 0,
    metragem_inicial: 0,
    peso_kg: 0,
    custo_por_metro: 0,
  });
  const [saving, setSaving] = useState(false);

  const tecidoMap = Object.fromEntries((tecidos ?? []).map((t) => [t.id, t]));
  const todosRolos = rolos ?? [];

  const filtered = todosRolos.filter((r) => {
    const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
    const text = `${r.codigo_rolo} ${tecido?.nome_tecido} ${r.cor_nome} ${r.lote}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const custoTotal = filtered.reduce((a, r) => {
    const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
    return a + (r.metragem_disponivel ?? 0) * (r.custo_por_metro ?? tecido?.custo_por_metro ?? 0);
  }, 0);

  const openEdit = (r: any) => {
    const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
    setEditRolo(r);
    setEditFields({
      codigo_rolo: r.codigo_rolo ?? "",
      lote: r.lote ?? "",
      cor_nome: r.cor_nome ?? "",
      cor_hex: r.cor_hex ?? "",
      metragem_disponivel: r.metragem_disponivel ?? 0,
      metragem_inicial: r.metragem_inicial ?? 0,
      peso_kg: r.peso_kg ?? 0,
      custo_por_metro: r.custo_por_metro ?? tecido?.custo_por_metro ?? 0,
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editRolo) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("rolos_tecido").update({
        codigo_rolo: editFields.codigo_rolo || null,
        lote: editFields.lote || null,
        cor_nome: editFields.cor_nome || null,
        cor_hex: editFields.cor_hex || null,
        metragem_disponivel: editFields.metragem_disponivel,
        metragem_inicial: editFields.metragem_inicial,
        peso_kg: editFields.peso_kg || null,
        custo_por_metro: editFields.custo_por_metro || null,
      }).eq("id", editRolo.id);
      if (error) throw error;
      toast.success("Rolo atualizado!");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["rolos-tecido"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Estoque de <span className="text-primary">Tecidos</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Controle de rolos e metragem disponível</p>
      </div>

      <Card>
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Custo Total de Tecido em Estoque</p>
              <p className="text-2xl font-serif font-bold text-foreground mt-1">{formatCurrency(custoTotal)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground/30" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif font-bold text-lg text-foreground">Rolos Disponíveis</h2>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar tecido, cor ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Tecido</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Custo/M</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-center w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
                  const custoMetro = r.custo_por_metro ?? tecido?.custo_por_metro ?? 0;
                  const custoRolo = (r.metragem_disponivel ?? 0) * custoMetro;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-primary font-medium">{r.codigo_rolo ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{(r as any).lote ?? "—"}</TableCell>
                      <TableCell className="font-medium">{tecido?.nome_tecido ?? "—"}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          {r.cor_hex && <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: r.cor_hex }} />}
                          {r.cor_nome ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{(r.metragem_disponivel ?? 0).toFixed(1)}m</TableCell>
                      <TableCell>
                        {(r.metragem_disponivel ?? 0) > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">Disponível</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">Usado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(custoMetro)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(custoRolo)}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Rolo Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Rolo {editFields.codigo_rolo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código do Rolo</Label>
                <Input value={editFields.codigo_rolo} onChange={(e) => setEditFields({ ...editFields, codigo_rolo: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Lote</Label>
                <Input value={editFields.lote} onChange={(e) => setEditFields({ ...editFields, lote: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input value={editFields.cor_nome} onChange={(e) => setEditFields({ ...editFields, cor_nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cor (hex)</Label>
                <div className="flex gap-2">
                  <Input value={editFields.cor_hex} onChange={(e) => setEditFields({ ...editFields, cor_hex: e.target.value })} />
                  {editFields.cor_hex && <div className="w-10 h-10 rounded border border-border shrink-0" style={{ backgroundColor: editFields.cor_hex }} />}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Metragem Disponível</Label>
                <Input type="number" step="0.01" value={editFields.metragem_disponivel} onChange={(e) => setEditFields({ ...editFields, metragem_disponivel: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Metragem Inicial</Label>
                <Input type="number" step="0.01" value={editFields.metragem_inicial} onChange={(e) => setEditFields({ ...editFields, metragem_inicial: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input type="number" step="0.01" value={editFields.peso_kg} onChange={(e) => setEditFields({ ...editFields, peso_kg: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Custo por Metro (R$)</Label>
                <Input type="number" step="0.01" value={editFields.custo_por_metro} onChange={(e) => setEditFields({ ...editFields, custo_por_metro: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
