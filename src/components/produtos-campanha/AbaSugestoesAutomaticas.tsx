import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Plus, Star } from "lucide-react";

interface ProdutoCampanhaRow {
  id: any;
  nome_produto: string;
  preco: number | null;
  estoque_total: number | null;
  total_vendas: number | null;
  url_produto: string | null;
  total_variantes: number | null;
  variantes_zeradas: number | null;
  percentual_abaixo_media: number | null;
  status_campanha: string | null;
  apto_campanha: boolean | null;
  dias_desde_criacao?: number | null;
  urgencia_score?: number;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  apto_campanha: { label: "Apto ✓", className: "bg-green-100 text-green-800 border-green-300" },
  quebra_grade: { label: "Quebra de grade", className: "bg-red-100 text-red-800 border-red-300" },
  estoque_baixo: { label: "Estoque baixo", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  vendendo_bem: { label: "Vendendo bem", className: "bg-blue-100 text-blue-800 border-blue-300" },
  urgente_antigo: { label: "Urgente (antigo)", className: "bg-orange-100 text-orange-800 border-orange-300" },
};

const PAGE_SIZE = 20;

function brl(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AbaSugestoesAutomaticas() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProdutoCampanhaRow[]>([]);
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [modalProduto, setModalProduto] = useState<ProdutoCampanhaRow | null>(null);
  const [form, setForm] = useState({ motivo: "", prioridade: 3, meta_vendas: "", observacao: "" });
  const [saving, setSaving] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vw_produtos_campanha" as any)
        .select("*")
        .order("percentual_abaixo_media", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const base = ((data as any[]) || []) as ProdutoCampanhaRow[];

      // Busca datas de criação dos produtos para calcular idade/urgência
      const ids = base.map(r => r.id).filter(Boolean);
      const datasMap = new Map<string, string>();
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { data: prods } = await supabase
          .from("produtos")
          .select("id, created_at")
          .in("id", slice as any);
        (prods || []).forEach((p: any) => datasMap.set(String(p.id), p.created_at));
      }

      const hoje = Date.now();
      const enriquecidos = base.map(r => {
        const dt = datasMap.get(String(r.id));
        const dias = dt ? Math.floor((hoje - new Date(dt).getTime()) / 86400000) : null;
        const vendas = r.total_vendas ?? 0;
        const estoque = r.estoque_total ?? 0;
        // Urgência: produto antigo + pouca venda + ainda com estoque
        const urgencia_score = dias != null
          ? Math.round((dias / 30) * Math.max(0, 10 - vendas) * (estoque > 0 ? 1 : 0))
          : 0;
        let status = r.status_campanha;
        // Marca como urgente_antigo se tem >180 dias, <5 vendas e estoque disponível
        if (dias != null && dias >= 180 && vendas < 5 && estoque >= 1) {
          status = "urgente_antigo";
        }
        return { ...r, dias_desde_criacao: dias, urgencia_score, status_campanha: status };
      });

      // Ordena urgentes primeiro
      enriquecidos.sort((a, b) => (b.urgencia_score || 0) - (a.urgencia_score || 0));
      setRows(enriquecidos);
    } catch (e: any) {
      toast.error("Erro ao carregar produtos: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const metricas = useMemo(() => ({
    apto: rows.filter(r => r.apto_campanha).length,
    quebra: rows.filter(r => r.status_campanha === "quebra_grade").length,
    baixo: rows.filter(r => r.status_campanha === "estoque_baixo").length,
    bem: rows.filter(r => r.status_campanha === "vendendo_bem").length,
    urgente: rows.filter(r => r.status_campanha === "urgente_antigo").length,
  }), [rows]);

  const filtered = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== "todos" && r.status_campanha !== statusFilter) return false;
      if (b && !r.nome_produto?.toLowerCase().includes(b)) return false;
      return true;
    });
  }, [rows, busca, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [busca, statusFilter]);

  function abrirModal(p: ProdutoCampanhaRow) {
    setModalProduto(p);
    setForm({ motivo: "", prioridade: 3, meta_vendas: "", observacao: "" });
  }

  async function confirmar() {
    if (!modalProduto) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("produtos_campanha" as any).insert({
        product_id: String(modalProduto.id),
        nome_produto: modalProduto.nome_produto,
        motivo: form.motivo || null,
        prioridade: form.prioridade,
        meta_vendas: form.meta_vendas ? Number(form.meta_vendas) : null,
        observacao: form.observacao || null,
        status: "ativo",
        adicionado_por: "manual",
      });
      if (error) throw error;
      toast.success("Produto adicionado à campanha!");
      setModalProduto(null);
    } catch (e: any) {
      toast.error("Erro ao adicionar: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  }

  const estoqueBadge = (n: number | null) => {
    const v = n ?? 0;
    const cls = v >= 20 ? "bg-green-100 text-green-800" :
                v >= 5 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";
    return <Badge variant="outline" className={cls}>{v}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card className="bg-muted/40">
        <CardContent className="py-4 text-sm text-muted-foreground">
          Produtos identificados automaticamente como aptos para campanha: estoque ≥ 5 unidades,
          no máximo 2 variantes zeradas e vendas abaixo da média geral da loja.
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Aptos para campanha" value={metricas.apto} cls="border-green-300 text-green-700" />
        <MetricCard label="Quebra de grade" value={metricas.quebra} cls="border-red-300 text-red-700" />
        <MetricCard label="Estoque baixo" value={metricas.baixo} cls="border-yellow-300 text-yellow-700" />
        <MetricCard label="Vendendo bem" value={metricas.bem} cls="border-blue-300 text-blue-700" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar por nome do produto..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="sm:max-w-md"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="apto_campanha">Apto para campanha</SelectItem>
            <SelectItem value="quebra_grade">Quebra de grade</SelectItem>
            <SelectItem value="estoque_baixo">Estoque baixo</SelectItem>
            <SelectItem value="vendendo_bem">Vendendo bem</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Vendas</TableHead>
                  <TableHead className="min-w-[160px]">% abaixo média</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.map((p) => {
                  const status = p.status_campanha || "";
                  const cfg = STATUS_CONFIG[status];
                  const pct = Math.max(0, Math.min(100, Number(p.percentual_abaixo_media) || 0));
                  return (
                    <TableRow key={String(p.id)}>
                      <TableCell className="max-w-[280px]">
                        {p.url_produto ? (
                          <a href={p.url_produto} target="_blank" rel="noreferrer"
                             className="text-primary hover:underline inline-flex items-center gap-1">
                            {p.nome_produto} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : p.nome_produto}
                      </TableCell>
                      <TableCell>{brl(p.preco)}</TableCell>
                      <TableCell>{estoqueBadge(p.estoque_total)}</TableCell>
                      <TableCell>{p.total_vendas ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 w-24 [&>div]:bg-red-500" />
                          <span className="text-xs tabular-nums">{pct.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span>{p.total_variantes ?? 0} var | </span>
                        <Badge variant="outline" className={
                          (p.variantes_zeradas ?? 0) > 2 ? "bg-red-100 text-red-800" : ""
                        }>
                          {p.variantes_zeradas ?? 0} zeradas
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {cfg ? <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => abrirModal(p)}>
                          <Plus className="h-3 w-3 mr-1" /> Campanha
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!pagedRows.length && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {filtered.length} produtos • Página {page} de {pageCount}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      <Dialog open={!!modalProduto} onOpenChange={(o) => !o && setModalProduto(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar à campanha</DialogTitle></DialogHeader>
          {modalProduto && (
            <div className="space-y-4">
              <div>
                <Label>Produto</Label>
                <Input value={modalProduto.nome_produto} readOnly />
              </div>
              <div>
                <Label>Motivo da campanha</Label>
                <Textarea
                  placeholder="Ex: Estoque parado, precisa girar"
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                />
              </div>
              <div>
                <Label>Prioridade</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setForm({ ...form, prioridade: n })}>
                      <Star className={`h-6 w-6 ${n <= form.prioridade ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Meta de vendas (unidades)</Label>
                <Input type="number" min={0} value={form.meta_vendas}
                  onChange={(e) => setForm({ ...form, meta_vendas: e.target.value })} />
              </div>
              <div>
                <Label>Observação</Label>
                <Textarea value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalProduto(null)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={saving}>{saving ? "Salvando..." : "Confirmar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <Card className={`border ${cls}`}>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-3xl font-serif mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
