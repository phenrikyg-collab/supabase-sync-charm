import { useOrdensCorte, useProdutos, useCores } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Printer, X, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { printHTML, statusBadgeHTML, formatDateBR } from "@/lib/printUtils";

interface OrdemCorteEnriched {
  id: string;
  numero_oc: string;
  status: string | null;
  grade_tamanhos: string[];
  metragem_risco: number;
  quantidade_folhas: number | null;
  created_at: string | null;
  produtos: { id: string; produto_id: string | null; nome_produto: string | null }[];
  grade: { tamanho: string; quantidade: number; cor_id: string | null }[];
}

export default function OrdensCorte() {
  const { data: ordens, isLoading, refetch } = useOrdensCorte();
  const { data: allProdutos } = useProdutos();
  const { data: allCores } = useCores();
  const coresMap = useMemo(() => {
    const map = new Map<string, { nome_cor: string; cor_hex: string }>();
    (allCores ?? []).forEach((c) => map.set(c.id, { nome_cor: c.nome_cor ?? "Sem cor", cor_hex: c.cor_hex ?? "#ccc" }));
    return map;
  }, [allCores]);
  const navigate = useNavigate();
  const [enriched, setEnriched] = useState<OrdemCorteEnriched[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editOrdem, setEditOrdem] = useState<OrdemCorteEnriched | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editMetragem, setEditMetragem] = useState(0);
  const [editFolhas, setEditFolhas] = useState(0);
  const [editProdutos, setEditProdutos] = useState<{ produto_id: string; nome_produto: string }[]>([]);
  const [searchProduto, setSearchProduto] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
          <div class="info-item"><label>Data</label><span>${formatDateBR(o.created_at)}</span></div>
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
    setEditProdutos(o.produtos.map((p) => ({ produto_id: p.produto_id ?? "", nome_produto: p.nome_produto ?? "" })));
    setSearchProduto("");
    setEditOpen(true);
  };

  const produtosFiltrados = useMemo(() => {
    if (!allProdutos || !searchProduto) return [];
    const selectedIds = new Set(editProdutos.map((p) => p.produto_id));
    const term = searchProduto.toLowerCase();
    return allProdutos.filter((p) => p.ativo && !selectedIds.has(p.id) && (
      p.nome_do_produto?.toLowerCase().includes(term) || p.codigo_sku?.toLowerCase().includes(term)
    ));
  }, [allProdutos, searchProduto, editProdutos]);

  const addEditProduto = (id: string) => {
    const p = allProdutos?.find((pr) => pr.id === id);
    if (!p) return;
    setEditProdutos((prev) => [...prev, { produto_id: p.id, nome_produto: p.nome_do_produto }]);
    setSearchProduto("");
  };

  const removeEditProduto = (produtoId: string) => {
    setEditProdutos((prev) => prev.filter((p) => p.produto_id !== produtoId));
  };

  const handleEdit = async () => {
    if (!editOrdem) return;
    if (editProdutos.length === 0) { toast.error("Selecione ao menos um produto"); return; }
    setSaving(true);
    try {
      // Update ordem fields
      const { error } = await supabase.from("ordens_corte").update({
        status: editStatus,
        metragem_risco: editMetragem,
        quantidade_folhas: editFolhas,
      }).eq("id", editOrdem.id);
      if (error) throw error;

      // Replace produtos: delete old, insert new
      await supabase.from("ordens_corte_produtos").delete().eq("ordem_corte_id", editOrdem.id);
      if (editProdutos.length > 0) {
        const { error: prodErr } = await supabase.from("ordens_corte_produtos").insert(
          editProdutos.map((p) => ({
            ordem_corte_id: editOrdem.id,
            produto_id: p.produto_id,
            nome_produto: p.nome_produto,
          }))
        );
        if (prodErr) throw prodErr;
      }

      toast.success("Ordem atualizada!");
      setEditOpen(false);
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { data: rolosUsados } = await supabase
        .from("ordens_corte_rolos")
        .select("rolo_id, metragem_utilizada")
        .eq("ordem_corte_id", deleteId);

      if (rolosUsados?.length) {
        for (const ru of rolosUsados) {
          if (!ru.rolo_id) continue;
          const { data: rolo } = await supabase
            .from("rolos_tecido")
            .select("metragem_disponivel")
            .eq("id", ru.rolo_id)
            .single();
          if (rolo) {
            const novaMetragem = (rolo.metragem_disponivel ?? 0) + (ru.metragem_utilizada ?? 0);
            await supabase.from("rolos_tecido").update({ metragem_disponivel: novaMetragem }).eq("id", ru.rolo_id);
          }
        }
      }

      await supabase.from("ordens_corte_grade").delete().eq("ordem_corte_id", deleteId);
      await supabase.from("ordens_corte_produtos").delete().eq("ordem_corte_id", deleteId);
      await supabase.from("ordens_corte_rolos").delete().eq("ordem_corte_id", deleteId);
      const { error } = await supabase.from("ordens_corte").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Ordem excluída e estoque restaurado!");
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
        <DialogContent className="max-w-lg">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Metragem do Risco</Label>
                <Input type="number" step="0.01" value={editMetragem} onChange={(e) => setEditMetragem(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Quantidade de Folhas</Label>
                <Input type="number" value={editFolhas} onChange={(e) => setEditFolhas(Number(e.target.value))} />
              </div>
            </div>

            {/* Products section */}
            <div className="space-y-3">
              <Label>Produtos ({editProdutos.length})</Label>
              {editProdutos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editProdutos.map((p) => (
                    <div key={p.produto_id} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 text-sm">
                      <span className="font-medium text-foreground">{p.nome_produto}</span>
                      <button onClick={() => removeEditProduto(p.produto_id)} className="ml-1 text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto para adicionar..."
                  value={searchProduto}
                  onChange={(e) => setSearchProduto(e.target.value)}
                  className="pl-9"
                />
              </div>
              {searchProduto && produtosFiltrados.length > 0 && (
                <div className="border border-border rounded-lg max-h-36 overflow-y-auto bg-popover shadow-md">
                  {produtosFiltrados.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-4 py-2 hover:bg-accent text-sm flex items-center justify-between"
                      onClick={() => addEditProduto(p.id)}
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium text-popover-foreground">{p.nome_do_produto}</span>
                      </span>
                      {p.codigo_sku && <span className="text-muted-foreground text-xs">{p.codigo_sku}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={saving}>Salvar</Button>
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
