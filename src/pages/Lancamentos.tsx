import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles, RefreshCw, Plus, ChevronDown, ChevronUp, ExternalLink, Pencil, Ban,
} from "lucide-react";

// ---------- tipos ----------
type Lancamento = {
  id: string;
  nome_peca: string;
  data_lancamento: string;
  tipo_lancamento: string | null;
  colecao: string | null;
  preco: number | null;
  status: string | null;
  descricao: string | null;
};

type ChecklistItem = {
  id: string;
  lancamento_id: string;
  fase: string;
  tipo_item: string;
  texto_item: string;
  canal: string | null;
  ordem: number;
  concluido: boolean;
  observacao: string | null;
  conteudo_aprovado: string | null;
  url_arquivo: string | null;
};

type Detalhes = {
  tecido?: string;
  cores?: string;
  tamanhos?: string[];
  silhueta?: string;
  diferenciais?: string;
  lifestyle?: string;
  referencia_foto?: string;
  canais?: string[];
};

// ---------- consts ----------
const STATUS_COLORS: Record<string, string> = {
  planejado: "bg-gray-400 text-white",
  em_producao_conteudo: "bg-yellow-500 text-white",
  pronto: "bg-blue-600 text-white",
  lancado: "bg-green-600 text-white",
  cancelado: "bg-red-600 text-white",
};

const STATUS_LABELS: Record<string, string> = {
  planejado: "Planejado",
  em_producao_conteudo: "Em produção de conteúdo",
  pronto: "Pronto",
  lancado: "Lançado",
  cancelado: "Cancelado",
};

const TAMANHOS = ["PP", "P", "M", "G", "GG", "EG"];

const CANAIS = [
  { key: "fotos_site", label: "📷 Fotos para o site (fundo branco)" },
  { key: "fotos_lifestyle", label: "🎨 Fotos lifestyle (externas/ambientadas)" },
  { key: "video_site_detalhe", label: "🎬 Vídeo site — detalhe do produto" },
  { key: "video_site_apresentacao", label: "🎬 Vídeo site — apresentação falada" },
  { key: "reels", label: "📱 Reels Instagram" },
  { key: "carrossel", label: "📷 Carrossel Instagram" },
  { key: "email", label: "✉️ E-mail marketing" },
  { key: "whatsapp_vip", label: "💬 WhatsApp VIP" },
];

const FASES = [
  { key: "pre", label: "Pré-lançamento" },
  { key: "lancamento", label: "Dia do lançamento" },
  { key: "pos", label: "Pós-lançamento" },
];

const CANAL_COLORS: Record<string, string> = {
  instagram: "bg-purple-600 text-white",
  email: "bg-blue-600 text-white",
  whatsapp_vip: "bg-green-600 text-white",
  site_fotos: "bg-orange-500 text-white",
  site_videos: "bg-orange-700 text-white",
  anuncio: "bg-red-600 text-white",
  geral: "bg-gray-500 text-white",
};

// ---------- helpers ----------
function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}
function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function parseDetalhes(s: string | null): Detalhes {
  if (!s) return {};
  try { return JSON.parse(s) as Detalhes; } catch { return {}; }
}
function proxTerca(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const diff = (2 - dt.getDay() + 7) % 7; // 2 = terça
  dt.setDate(dt.getDate() + (diff === 0 ? 0 : diff));
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}
function mesRef(iso: string) {
  return iso ? iso.slice(0, 7) : "";
}

// ---------- página ----------
export default function Lancamentos() {
  const [lista, setLista] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, { total: number; concluidos: number }>>({});
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("lancamentos_pecas")
        .select("*")
        .order("data_lancamento", { ascending: true });
      if (error) throw error;
      const list = (data || []) as Lancamento[];
      setLista(list);

      const cs: Record<string, { total: number; concluidos: number }> = {};
      await Promise.all(list.map(async (l) => {
        const { data: ck } = await (supabase as any)
          .from("checklist_lancamento")
          .select("concluido")
          .eq("lancamento_id", l.id);
        const total = (ck || []).length;
        const concluidos = (ck || []).filter((c: any) => c.concluido).length;
        cs[l.id] = { total, concluidos };
      }));
      setCounts(cs);
    } catch (e: any) {
      toast.error("Erro ao carregar lançamentos", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const mesesDisponiveis = Array.from(new Set(lista.map((l) => mesRef(l.data_lancamento)))).filter(Boolean).sort();

  const filtrados = lista.filter((l) => {
    if (filtroTipo !== "todos" && l.tipo_lancamento !== filtroTipo) return false;
    if (filtroStatus !== "todos" && (l.status || "planejado") !== filtroStatus) return false;
    if (filtroMes !== "todos" && mesRef(l.data_lancamento) !== filtroMes) return false;
    return true;
  });

  const cancelar = async (id: string) => {
    if (!confirm("Cancelar este lançamento?")) return;
    const { error } = await (supabase as any)
      .from("lancamentos_pecas").update({ status: "cancelado" }).eq("id", id);
    if (error) { toast.error("Erro", { description: error.message }); return; }
    toast.success("Lançamento cancelado");
    fetchAll();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Lançamentos & Reposições</h1>
          <p className="text-sm text-muted-foreground mt-1">Planejamento antecede a produção</p>
        </div>
        <Button
          onClick={() => { setEditing(null); setOpenForm(true); }}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" /> Novo Lançamento
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <div className="flex gap-1">
            {[
              { v: "todos", l: "Todos" },
              { v: "lancamento", l: "✨ Lançamento" },
              { v: "reposicao", l: "🔄 Reposição" },
            ].map((o) => (
              <Button key={o.v} size="sm" variant={filtroTipo === o.v ? "default" : "outline"} onClick={() => setFiltroTipo(o.v)}>
                {o.l}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Mês</Label>
          <Select value={filtroMes} onValueChange={setFiltroMes}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {mesesDisponiveis.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" size="sm" onClick={fetchAll}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : filtrados.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Nenhum lançamento encontrado. Clique em <strong>Novo Lançamento</strong> para começar.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map((l) => (
            <LancamentoCard
              key={l.id}
              l={l}
              count={counts[l.id] || { total: 0, concluidos: 0 }}
              expanded={expanded === l.id}
              onToggle={() => setExpanded(expanded === l.id ? null : l.id)}
              onEdit={() => { setEditing(l); setOpenForm(true); }}
              onCancel={() => cancelar(l.id)}
              onChecklistChange={fetchAll}
            />
          ))}
        </div>
      )}

      {/* Formulário */}
      <LancamentoForm
        open={openForm}
        onOpenChange={setOpenForm}
        editing={editing}
        onSaved={() => { setOpenForm(false); fetchAll(); }}
      />
    </div>
  );
}

// ---------- card ----------
function LancamentoCard({
  l, count, expanded, onToggle, onEdit, onCancel, onChecklistChange,
}: {
  l: Lancamento;
  count: { total: number; concluidos: number };
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onChecklistChange: () => void;
}) {
  const det = parseDetalhes(l.descricao);
  const pct = count.total > 0 ? (count.concluidos / count.total) * 100 : 0;
  const status = l.status || "planejado";
  const isLanc = l.tipo_lancamento === "lancamento";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-[240px]">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge className={isLanc ? "bg-purple-600 text-white" : "bg-blue-500 text-white"}>
              {isLanc ? "✨ Lançamento" : "🔄 Reposição"}
            </Badge>
            <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
            {l.colecao && <Badge variant="outline">{l.colecao}</Badge>}
          </div>
          <h3 className="font-serif text-xl font-semibold">{l.nome_peca}</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>📅 {fmtDate(l.data_lancamento)}</span>
            <span>💰 {fmtBRL(l.preco)}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3 w-3 mr-1" /> Editar</Button>
            {status !== "cancelado" && (
              <Button size="sm" variant="ghost" className="text-red-600" onClick={onCancel}>
                <Ban className="h-3 w-3 mr-1" /> Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Progresso */}
      <div className="space-y-1">
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div className="bg-primary h-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-xs text-muted-foreground">
          Checklist: {count.concluidos}/{count.total} itens concluídos
        </div>
      </div>

      {/* Canais planejados */}
      {det.canais && det.canais.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {det.canais.map((c) => {
            const lab = CANAIS.find((x) => x.key === c)?.label || c;
            return <Badge key={c} variant="secondary" className="text-[10px]">{lab}</Badge>;
          })}
        </div>
      )}

      <Button size="sm" variant="ghost" onClick={onToggle} className="gap-1">
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Ver checklist
      </Button>

      {expanded && <ChecklistView lancId={l.id} onChange={onChecklistChange} />}
    </Card>
  );
}

// ---------- checklist ----------
function ChecklistView({ lancId, onChange }: { lancId: string; onChange: () => void }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("checklist_lancamento")
      .select("*")
      .eq("lancamento_id", lancId)
      .order("ordem", { ascending: true });
    if (error) toast.error("Erro ao carregar checklist", { description: error.message });
    setItems((data || []) as ChecklistItem[]);
    setLoading(false);
  }, [lancId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const updateItem = async (id: string, patch: Partial<ChecklistItem>) => {
    const payload: any = { ...patch, updated_at: new Date().toISOString() };
    if ("concluido" in patch && patch.concluido) payload.concluido_em = new Date().toISOString();
    const { error } = await (supabase as any).from("checklist_lancamento").update(payload).eq("id", id);
    if (error) { toast.error("Erro ao salvar", { description: error.message }); return; }
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    onChange();
  };

  if (loading) return <Skeleton className="h-40 mt-2" />;
  if (items.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Sem itens no checklist.</p>;

  return (
    <Tabs defaultValue="pre" className="pt-2 border-t">
      <TabsList className="grid grid-cols-3 w-full">
        {FASES.map((f) => <TabsTrigger key={f.key} value={f.key} className="text-xs">{f.label}</TabsTrigger>)}
      </TabsList>
      {FASES.map((f) => {
        const fItems = items.filter((it) => it.fase === f.key);
        const fDone = fItems.filter((it) => it.concluido).length;
        const fPct = fItems.length > 0 ? (fDone / fItems.length) * 100 : 0;
        return (
          <TabsContent key={f.key} value={f.key} className="space-y-3 mt-3">
            <div className="space-y-1">
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${fPct}%` }} />
              </div>
              <div className="text-[11px] text-muted-foreground">{fDone}/{fItems.length}</div>
            </div>
            {fItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem itens nesta fase.</p>
            ) : fItems.map((it) => <ChecklistRow key={it.id} item={it} onUpdate={updateItem} />)}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function ChecklistRow({ item, onUpdate }: { item: ChecklistItem; onUpdate: (id: string, p: Partial<ChecklistItem>) => void }) {
  const [local, setLocal] = useState(item);
  useEffect(() => setLocal(item), [item.id, item.concluido]);
  const icon = item.tipo_item === "copy" ? "✍️" : item.tipo_item === "foto" ? "📷" : item.tipo_item === "video" ? "🎬" : "";
  const canalCls = item.canal ? (CANAL_COLORS[item.canal] || "bg-gray-500 text-white") : "";
  const blur = (field: keyof ChecklistItem) => {
    if ((local as any)[field] !== (item as any)[field]) onUpdate(item.id, { [field]: (local as any)[field] } as any);
  };
  return (
    <div className="border rounded-md p-3 space-y-2 bg-card">
      <div className="flex items-start gap-2">
        <Checkbox checked={local.concluido} onCheckedChange={(v) => { setLocal({ ...local, concluido: !!v }); onUpdate(item.id, { concluido: !!v }); }} />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm">{icon} {item.texto_item}</span>
            {item.canal && <Badge className={`text-[10px] ${canalCls}`}>{item.canal}</Badge>}
          </div>
        </div>
      </div>
      {item.tipo_item === "copy" && (
        <Textarea rows={3} placeholder="Cole aqui a copy aprovada..." value={local.conteudo_aprovado || ""}
          onChange={(e) => setLocal({ ...local, conteudo_aprovado: e.target.value })} onBlur={() => blur("conteudo_aprovado")} />
      )}
      {(item.tipo_item === "foto" || item.tipo_item === "video") && (
        <div>
          <Input placeholder="Cole o link do arquivo (Google Drive, etc)" value={local.url_arquivo || ""}
            onChange={(e) => setLocal({ ...local, url_arquivo: e.target.value })} onBlur={() => blur("url_arquivo")} />
          {local.url_arquivo && (
            <a href={local.url_arquivo} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
              Abrir arquivo <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
      <Textarea rows={2} placeholder="Observação" value={local.observacao || ""}
        onChange={(e) => setLocal({ ...local, observacao: e.target.value })} onBlur={() => blur("observacao")} className="text-xs" />
    </div>
  );
}

// ---------- formulário ----------
type ProdutoOpt = {
  id: string;
  nome_do_produto: string;
  codigo_sku: string | null;
  preco_venda: number | null;
  tipo_do_produto: string | null;
  tecido_do_produto: string | null;
};

type TrayProd = {
  id: string;                 // "tray-{variant_product_id}"
  variant_product_id: number;
  nome: string;               // derivado do slug da URL
  reference: string | null;   // ex. PREGA-AZ
  custo: number | null;       // variant_cost_price (mín. > 0)
  preco: number | null;       // variant_price (máx.)
  cores: string[];
  tamanhos: string[];
  qtdVariantes: number;
  jaCadastrado: boolean;      // match com produtos pelo nome/SKU
};

// decodifica escapes do dict-python (\xf3 → ó)
function decodePy(s: string): string {
  return s.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16))
  );
}
function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function extrairNomeTray(url: string | null): string {
  if (!url) return "";
  const m = url.match(/\/([a-z0-9-]+)\?variant_id=/i);
  if (!m) return "";
  return m[1].split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
function extrairCorTray(sku: string | null): string | null {
  if (!sku) return null;
  const m = sku.match(/'type':\s*u?'Cor'[^}]*'value':\s*u?'([^']+)'/i);
  return m ? decodePy(m[1]).trim() : null;
}
function extrairTamanhoTray(sku: string | null): string | null {
  if (!sku) return null;
  const m = sku.match(/'type':\s*u?'Tamanho'[^}]*'value':\s*u?'([^']+)'/i);
  return m ? decodePy(m[1]).trim() : null;
}

function LancamentoForm({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Lancamento | null;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<string>("lancamento");
  const [data, setData] = useState("");
  const [colecao, setColecao] = useState("");
  const [preco, setPreco] = useState<string>("");
  const [status, setStatus] = useState<string>("planejado");
  const [tecido, setTecido] = useState("");
  const [cores, setCores] = useState("");
  const [tamanhos, setTamanhos] = useState<string[]>([]);
  const [silhueta, setSilhueta] = useState("");
  const [diferenciais, setDiferenciais] = useState("");
  const [lifestyle, setLifestyle] = useState("");
  const [referencia, setReferencia] = useState("");
  const [canais, setCanais] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // produtos cadastrados (para pré-preencher o formulário)
  const [produtos, setProdutos] = useState<ProdutoOpt[]>([]);
  const [produtoBusca, setProdutoBusca] = useState("");
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const d = parseDetalhes(editing?.descricao || null);
    setNome(editing?.nome_peca || "");
    setTipo(editing?.tipo_lancamento || "lancamento");
    setData(editing?.data_lancamento?.slice(0, 10) || "");
    setColecao(editing?.colecao || "");
    setPreco(editing?.preco != null ? String(editing.preco) : "");
    setStatus(editing?.status || "planejado");
    setTecido(d.tecido || "");
    setCores(d.cores || "");
    setTamanhos(d.tamanhos || []);
    setSilhueta(d.silhueta || "");
    setDiferenciais(d.diferenciais || "");
    setLifestyle(d.lifestyle || "");
    setReferencia(d.referencia_foto || "");
    setCanais(d.canais || []);
    setProdutoBusca("");
    setProdutoSelecionadoId("");
  }, [open, editing]);

  // carrega produtos uma vez quando o form abre
  useEffect(() => {
    if (!open || produtos.length > 0) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("produtos")
        .select("id, nome_do_produto, codigo_sku, preco_venda, tipo_do_produto, tecido_do_produto, ativo")
        .eq("ativo", true)
        .order("nome_do_produto", { ascending: true });
      if (error) {
        toast.error("Erro ao carregar produtos", { description: error.message });
        return;
      }
      setProdutos((data || []) as ProdutoOpt[]);
    })();
  }, [open, produtos.length]);

  // produtos Tray (importados da loja)
  const [trayProdutos, setTrayProdutos] = useState<TrayProd[]>([]);
  const [fonte, setFonte] = useState<"cadastrados" | "tray">("cadastrados");
  const [trayAplicado, setTrayAplicado] = useState<TrayProd | null>(null);

  useEffect(() => {
    if (!open) return;
    setTrayAplicado(null);
    setFonte("cadastrados");
  }, [open, editing]);


  // carrega variantes Tray (paginação para passar do limite de 1000)
  useEffect(() => {
    if (!open || trayProdutos.length > 0) return;
    (async () => {
      try {
        const PAGE = 1000;
        let from = 0;
        const all: any[] = [];
        for (let i = 0; i < 10; i++) {
          const { data, error } = await (supabase as any)
            .from("tray_products_variants")
            .select("variant_product_id, variant_sku, variant_url, variant_reference, variant_cost_price, variant_price")
            .range(from, from + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }

        // agrupa por variant_product_id
        const grupos = new Map<number, any[]>();
        for (const v of all) {
          if (v.variant_product_id == null) continue;
          const arr = grupos.get(v.variant_product_id) || [];
          arr.push(v);
          grupos.set(v.variant_product_id, arr);
        }

        const produtosSlugs = new Set(
          produtos.map((p) => slugify(p.nome_do_produto || ""))
        );
        const produtosSkus = new Set(
          produtos.map((p) => (p.codigo_sku || "").trim().toLowerCase()).filter(Boolean)
        );

        const lista: TrayProd[] = [];
        for (const [pid, vs] of grupos) {
          const cores = new Set<string>();
          const tams = new Set<string>();
          let custo: number | null = null;
          let preco: number | null = null;
          let nome = "";
          let reference: string | null = null;
          for (const v of vs) {
            const c = extrairCorTray(v.variant_sku);
            if (c) cores.add(c);
            const t = extrairTamanhoTray(v.variant_sku);
            if (t) tams.add(t);
            const cp = Number(v.variant_cost_price) || 0;
            if (cp > 0 && (custo == null || cp < custo)) custo = cp;
            const pp = Number(v.variant_price) || 0;
            if (pp > 0 && (preco == null || pp > preco)) preco = pp;
            if (!nome) nome = extrairNomeTray(v.variant_url);
            if (!reference && v.variant_reference) reference = v.variant_reference;
          }
          if (!nome) nome = `Produto Tray #${pid}`;
          const slug = slugify(nome);
          const refLower = (reference || "").trim().toLowerCase();
          const jaCadastrado =
            produtosSlugs.has(slug) ||
            (refLower.length > 0 && produtosSkus.has(refLower));
          lista.push({
            id: `tray-${pid}`,
            variant_product_id: pid,
            nome,
            reference,
            custo,
            preco,
            cores: Array.from(cores).sort(),
            tamanhos: Array.from(tams),
            qtdVariantes: vs.length,
            jaCadastrado,
          });
        }
        lista.sort((a, b) => a.nome.localeCompare(b.nome));
        setTrayProdutos(lista);
      } catch (e: any) {
        toast.error("Erro ao carregar produtos Tray", { description: e.message });
      }
    })();
  }, [open, produtos, trayProdutos.length]);

  // ---- parents vs variantes (variantes têm "Cor:" no nome) ----
  const isVariante = (nm: string | null | undefined) => !!nm && /Cor:/i.test(nm);

  // mapa parent.id -> { cores, tamanhos } derivado das variantes
  const variantesPorParent = (() => {
    const map: Record<string, { cores: Set<string>; tamanhos: Set<string> }> = {};
    const parents = produtos.filter((p) => !isVariante(p.nome_do_produto));
    for (const p of parents) map[p.id] = { cores: new Set(), tamanhos: new Set() };
    const variantes = produtos.filter((p) => isVariante(p.nome_do_produto));
    for (const v of variantes) {
      const parent = parents.find((pa) => {
        const baseNome = (pa.nome_do_produto || "").trim();
        return baseNome && (v.nome_do_produto || "").toLowerCase().startsWith(baseNome.toLowerCase());
      });
      if (!parent) continue;
      const corMatch = (v.nome_do_produto || "").match(/Cor:\s*([^;]+)/i);
      const tamMatch = (v.nome_do_produto || "").match(/Tamanho:\s*([^;]+)/i);
      if (corMatch) map[parent.id].cores.add(corMatch[1].trim());
      if (tamMatch) map[parent.id].tamanhos.add(tamMatch[1].trim());
    }
    return map;
  })();

  const produtosPais = produtos.filter((p) => !isVariante(p.nome_do_produto));
  const coresParent = produtoSelecionadoId
    ? Array.from(variantesPorParent[produtoSelecionadoId]?.cores || []).sort()
    : [];

  const aplicarProduto = (p: ProdutoOpt) => {
    setProdutoSelecionadoId(p.id);
    setNome(p.nome_do_produto || "");
    if (p.preco_venda != null) setPreco(String(p.preco_venda));
    if (p.tecido_do_produto) setTecido(p.tecido_do_produto);
    if (p.tipo_do_produto && !silhueta) setSilhueta(p.tipo_do_produto);

    const info = variantesPorParent[p.id];
    if (info) {
      const cs = Array.from(info.cores).sort();
      if (cs.length > 0) setCores(cs.join(", "));
      const ts = Array.from(info.tamanhos);
      const tsValidos = TAMANHOS.filter((t) => ts.includes(t));
      if (tsValidos.length > 0) setTamanhos(tsValidos);
    }

    toast.success("Dados do produto carregados", {
      description: p.codigo_sku ? `SKU: ${p.codigo_sku}` : undefined,
    });
  };

  const toggleCorSelecionada = (cor: string) => {
    const atuais = cores.split(",").map((c) => c.trim()).filter(Boolean);
    const novo = atuais.includes(cor) ? atuais.filter((c) => c !== cor) : [...atuais, cor];
    setCores(novo.join(", "));
  };

  const produtosFiltrados = produtoBusca.trim().length === 0
    ? produtosPais.slice(0, 8)
    : produtosPais.filter((p) => {
        const q = produtoBusca.toLowerCase();
        return (
          (p.nome_do_produto || "").toLowerCase().includes(q) ||
          (p.codigo_sku || "").toLowerCase().includes(q)
        );
      }).slice(0, 20);


  const toggle = (arr: string[], v: string, setter: (a: string[]) => void) => {
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const submit = async () => {
    if (!nome.trim()) { toast.error("Informe o nome da peça"); return; }
    if (!tipo) { toast.error("Selecione o tipo"); return; }
    if (!data) { toast.error("Informe a data de lançamento"); return; }
    setSaving(true);
    try {
      const descricao = JSON.stringify({
        tecido, cores, tamanhos, silhueta, diferenciais, lifestyle, referencia_foto: referencia, canais,
      });
      const payload: any = {
        nome_peca: nome,
        tipo_lancamento: tipo,
        data_lancamento: data,
        colecao: colecao || null,
        preco: preco ? Number(preco) : null,
        status,
        descricao,
      };

      if (editing) {
        const { error } = await (supabase as any)
          .from("lancamentos_pecas").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Lançamento atualizado");
      } else {
        const { data: ins, error } = await (supabase as any)
          .from("lancamentos_pecas").insert(payload).select("id").single();
        if (error) throw error;

        // calendário comercial
        const titulo = (tipo === "lancamento" ? "Lançamento: " : "Reposição: ") + nome;
        const desc = [silhueta, lifestyle].filter(Boolean).join(" — ");
        await (supabase as any).from("calendario_comercial").insert({
          data,
          titulo,
          tipo: "lancamento",
          status: "rascunho",
          mes_referencia: mesRef(data),
          tipo_lancamento: tipo,
          descricao: desc || null,
        });

        toast.success("Lançamento criado! Checklist gerado automaticamente.", {
          description: `ID: ${ins?.id?.slice(0, 8) || ""}`,
        });
      }
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {editing ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações básicas */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Informações básicas</h3>

            {/* Seletor de produto cadastrado */}
            <div className="rounded-md border border-dashed p-3 bg-muted/30 space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Buscar produto cadastrado (opcional — pré-preenche os campos)
              </Label>
              <Input
                value={produtoBusca}
                onChange={(e) => setProdutoBusca(e.target.value)}
                placeholder="Digite nome ou SKU do produto..."
              />
              {produtos.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Carregando produtos...</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {produtosFiltrados.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-2 text-center">Nenhum produto encontrado.</p>
                  ) : produtosFiltrados.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => aplicarProduto(p)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-background transition-colors ${produtoSelecionadoId === p.id ? "bg-background ring-1 ring-primary" : ""}`}
                    >
                      <div className="font-medium truncate">{p.nome_do_produto}</div>
                      <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
                        {p.codigo_sku && <span>SKU: {p.codigo_sku}</span>}
                        {p.preco_venda != null && <span>{fmtBRL(p.preco_venda)}</span>}
                        {p.tecido_do_produto && <span>{p.tecido_do_produto}</span>}
                        {p.tipo_do_produto && <span>{p.tipo_do_produto}</span>}
                        {variantesPorParent[p.id]?.cores.size > 0 && (
                          <span>{variantesPorParent[p.id].cores.size} cor(es)</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Nome da peça *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Calça Flare Premium Linho" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lancamento">✨ Lançamento — produto novo nunca vendido</SelectItem>
                    <SelectItem value="reposicao">🔄 Reposição — produto que voltou ao estoque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de lançamento *</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                {data && <p className="text-[11px] text-muted-foreground mt-1">Live prevista para {proxTerca(data)}</p>}
              </div>
              <div>
                <Label>Coleção</Label>
                <Input value={colecao} onChange={(e) => setColecao(e.target.value)} placeholder="Inverno 2026" />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" />
              </div>
              <div className="md:col-span-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planejado">Planejado</SelectItem>
                    <SelectItem value="em_producao_conteudo">Em produção de conteúdo</SelectItem>
                    <SelectItem value="pronto">Pronto</SelectItem>
                    {editing && <SelectItem value="lancado">Lançado</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Detalhes da peça */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Detalhes da peça</h3>
            <div>
              <Label>Tecido / Material</Label>
              <Input value={tecido} onChange={(e) => setTecido(e.target.value)} placeholder="Linho italiano 70% algodão 30%" />
            </div>
            <div>
              <Label>Cores disponíveis</Label>
              {coresParent.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1 mb-2 p-2 rounded border border-dashed bg-muted/30">
                  <span className="text-[11px] text-muted-foreground w-full">Cores cadastradas no produto (clique para selecionar):</span>
                  {coresParent.map((c) => {
                    const selecionada = cores.split(",").map((x) => x.trim()).includes(c);
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => toggleCorSelecionada(c)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${selecionada ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              )}
              <Input value={cores} onChange={(e) => setCores(e.target.value)} placeholder="Off White, Preto, Azul Celestial" />
            </div>
            <div>
              <Label>Tamanhos previstos</Label>
              <div className="flex flex-wrap gap-3 mt-1">
                {TAMANHOS.map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={tamanhos.includes(t)} onCheckedChange={() => toggle(tamanhos, t, setTamanhos)} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Silhueta / Modelagem</Label>
              <Input value={silhueta} onChange={(e) => setSilhueta(e.target.value)} placeholder="Flare de cintura alta com bolsos" />
            </div>
            <div>
              <Label>Diferenciais premium</Label>
              <Textarea rows={2} value={diferenciais} onChange={(e) => setDiferenciais(e.target.value)} placeholder="Tecido não amassa, caimento perfeito, forro interno..." />
            </div>
            <div>
              <Label>Lifestyle / Ocasião de uso</Label>
              <Textarea rows={2} value={lifestyle} onChange={(e) => setLifestyle(e.target.value)} placeholder="Mulher executiva 35-45 anos, reuniões corporativas..." />
            </div>
            <div>
              <Label>Referência de foto / inspiração (URL)</Label>
              <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="https://..." />
            </div>
          </section>

          {/* Canais */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Canais de conteúdo planejados</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {CANAIS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm border rounded-md p-2 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={canais.includes(c.key)} onCheckedChange={() => toggle(canais, c.key, setCanais)} />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
            <Sparkles className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
