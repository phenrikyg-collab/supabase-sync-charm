import { useOrdensCorte } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { printHTML, statusBadgeHTML } from "@/lib/printUtils";

interface OrdemCorteEnriched {
  id: string;
  numero_oc: string;
  status: string | null;
  grade_tamanhos: string[];
  metragem_risco: number;
  quantidade_folhas: number | null;
  created_at: string | null;
  produtos: { nome_produto: string | null }[];
  grade: { tamanho: string; quantidade: number; cor_id: string | null }[];
}

export default function OrdensCorte() {
  const { data: ordens, isLoading, refetch } = useOrdensCorte();
  const navigate = useNavigate();
  const [enriched, setEnriched] = useState<OrdemCorteEnriched[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editOrdem, setEditOrdem] = useState<OrdemCorteEnriched | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editMetragem, setEditMetragem] = useState(0);
  const [editFolhas, setEditFolhas] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!ordens?.length) { setEnriched([]); return; }
    const ids = ordens.map((o) => o.id);

    Promise.all([
      supabase.from("ordens_corte_produtos").select("*").in("ordem_corte_id", ids),
      supabase.from("ordens_corte_grade").select("*").in("ordem_corte_id", ids),
    ]).then(([prodRes, gradeRes]) => {
      const prodByOrdem = new Map<string, any[]>();
      (prodRes.data ?? []).forEach((p: any) => {
        const list = prodByOrdem.get(p.ordem_corte_id) ?? [];
        list.push(p);
        prodByOrdem.set(p.ordem_corte_id, list);
      });

      const gradeByOrdem = new Map<string, any[]>();
      (gradeRes.data ?? []).forEach((g: any) => {
        const list = gradeByOrdem.get(g.ordem_corte_id) ?? [];
        list.push(g);
        gradeByOrdem.set(g.ordem_corte_id, list);
      });

      setEnriched(
        ordens.map((o) => ({
          ...o,
          produtos: prodByOrdem.get(o.id) ?? [],
          grade: gradeByOrdem.get(o.id) ?? [],
        }))
      );
    });
  }, [ordens]);

  const totalPecas = (grade: { quantidade: number }[]) => grade.reduce((a, g) => a + g.quantidade, 0);

  const printOrdem = (o: OrdemCorteEnriched) => {
    const gradeRows = o.grade.map((g) => `<tr><td>${g.tamanho}</td><td>${g.quantidade}</td></tr>`).join("");
    const total = totalPecas(o.grade);
    printHTML(`Ordem de Corte - ${o.numero_oc}`, `
      <div class="header">
        <div>
          <h1>Ordem de Corte — ${o.numero_oc}</h1>
          <div class="subtitle">Ficha de produção</div>
        </div>
        <div class="company"><img src="/images/logo.png" class="logo" alt="MC" /><br/>Gestão - Mariana Cardoso</div>
      </div>
      <div class="section">
        <div class="section-title">Informações Gerais</div>
        <div class="info-grid">
          <div class="info-item"><label>Número</label><span>${o.numero_oc}</span></div>
          <div class="info-item"><label>Status</label>${statusBadgeHTML(o.status ?? "Planejada")}</div>
          <div class="info-item"><label>Data</label><span>${o.created_at ? new Date(o.created_at).toLocaleDateString("pt-BR") : "—"}</span></div>
          <div class="info-item"><label>Produto(s)</label><span>${o.produtos.map((p) => p.nome_produto).join(", ") || "—"}</span></div>
          <div class="info-item"><label>Metragem Risco</label><span>${o.metragem_risco}m</span></div>
          <div class="info-item"><label>Folhas</label><span>${o.quantidade_folhas ?? "—"}</span></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Grade de Tamanhos</div>
        <table>
          <thead><tr><th>Tamanho</th><th>Quantidade</th></tr></thead>
          <tbody>${gradeRows}<tr class="total-row"><td>Total</td><td>${total}</td></tr></tbody>
        </table>
      </div>
    `);
  };

  const openEdit = (o: OrdemCorteEnriched) => {
    setEditOrdem(o);
    setEditStatus(o.status ?? "Planejada");
    setEditMetragem(o.metragem_risco);
    setEditFolhas(o.quantidade_folhas ?? 0);
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editOrdem) return;
    try {
      const { error } = await supabase.from("ordens_corte").update({
        status: editStatus,
        metragem_risco: editMetragem,
        quantidade_folhas: editFolhas,
      }).eq("id", editOrdem.id);
      if (error) throw error;
      toast.success("Ordem atualizada!");
      setEditOpen(false);
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      // Delete related records first
      await supabase.from("ordens_corte_grade").delete().eq("ordem_corte_id", deleteId);
      await supabase.from("ordens_corte_produtos").delete().eq("ordem_corte_id", deleteId);
      await supabase.from("ordens_corte_rolos").delete().eq("ordem_corte_id", deleteId);
      const { error } = await supabase.from("ordens_corte").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Ordem excluída!");
      setDeleteOpen(false);
      setDeleteId(null);
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Ordens de Corte</h1>
          <p className="text-sm text-muted-foreground mt-1">{enriched.length} ordens</p>
        </div>
        <Button onClick={() => navigate("/ordens-corte/nova")} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Ordem
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          enriched.map((o, i) => (
            <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-lg text-card-foreground">{o.numero_oc}</span>
                    <StatusBadge status={o.status ?? "planejada"} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {o.produtos.map((p) => p.nome_produto).join(", ") || "—"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {o.grade.map((g, j) => (
                      <span key={j} className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">
                        {g.tamanho}: {g.quantidade}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total de Peças</span>
                    <span className="font-bold text-card-foreground">{totalPecas(o.grade)}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => openEdit(o)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => printOrdem(o)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 flex-1 text-destructive hover:text-destructive" onClick={() => { setDeleteId(o.id); setDeleteOpen(true); }}>
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Ordem {editOrdem?.numero_oc}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Planejada", "Em Corte", "Finalizada"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Metragem do Risco</Label>
              <Input type="number" step="0.01" value={editMetragem} onChange={(e) => setEditMetragem(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Quantidade de Folhas</Label>
              <Input type="number" value={editFolhas} onChange={(e) => setEditFolhas(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir esta ordem de corte? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
