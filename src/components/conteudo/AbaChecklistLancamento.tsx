import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";

type Lancamento = {
  id: string;
  nome_peca: string;
  data_lancamento: string;
  status: string | null;
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

const STATUS_LANC: Record<string, string> = {
  planejado: "bg-gray-400 text-white",
  em_producao_conteudo: "bg-yellow-500 text-white",
  pronto: "bg-blue-600 text-white",
  lancado: "bg-green-600 text-white",
  cancelado: "bg-red-600 text-white",
};

const CANAL_COLORS: Record<string, string> = {
  instagram: "bg-purple-600 text-white",
  email: "bg-blue-600 text-white",
  whatsapp_vip: "bg-green-600 text-white",
  site_fotos: "bg-orange-500 text-white",
  site_videos: "bg-orange-700 text-white",
  anuncio: "bg-red-600 text-white",
  geral: "bg-gray-500 text-white",
};

const FASES = [
  { key: "pre", label: "Pré-lançamento" },
  { key: "lancamento", label: "Dia do lançamento" },
  { key: "pos", label: "Pós-lançamento" },
];

function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

export function AbaChecklistLancamento() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, { total: number; concluidos: number }>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchLancamentos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("lancamentos_pecas")
        .select("*")
        .order("data_lancamento", { ascending: true });
      if (error) throw error;
      const list = (data || []) as Lancamento[];
      setLancamentos(list);

      const cs: Record<string, { total: number; concluidos: number }> = {};
      await Promise.all(list.map(async (l) => {
        const { data: ck } = await (supabase as any)
          .from("checklist_lancamento").select("concluido").eq("lancamento_id", l.id);
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

  useEffect(() => { fetchLancamentos(); }, [fetchLancamentos]);

  const fetchItems = async (lancId: string) => {
    setLoadingItems(true);
    try {
      const { data, error } = await (supabase as any)
        .from("checklist_lancamento")
        .select("*")
        .eq("lancamento_id", lancId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      setItems((data || []) as ChecklistItem[]);
    } catch (e: any) {
      toast.error("Erro ao carregar checklist", { description: e.message });
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const toggle = async (lancId: string) => {
    if (expanded === lancId) { setExpanded(null); setItems([]); return; }
    setExpanded(lancId);
    await fetchItems(lancId);
  };

  const updateItem = async (id: string, patch: Partial<ChecklistItem>) => {
    try {
      const payload: any = { ...patch, updated_at: new Date().toISOString() };
      if ("concluido" in patch && patch.concluido) payload.concluido_em = new Date().toISOString();
      const { error } = await (supabase as any).from("checklist_lancamento").update(payload).eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
      if (expanded) {
        const total = items.length;
        const concluidos = items.map((it) => it.id === id ? { ...it, ...patch } : it).filter((it) => it.concluido).length;
        setCounts((c) => ({ ...c, [expanded]: { total, concluidos } }));
      }
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : lancamentos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum lançamento cadastrado.</Card>
      ) : (
        lancamentos.map((l) => {
          const c = counts[l.id] || { total: 0, concluidos: 0 };
          const pct = c.total > 0 ? (c.concluidos / c.total) * 100 : 0;
          return (
            <Card key={l.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-serif font-semibold text-foreground">{l.nome_peca}</h3>
                  <p className="text-sm text-muted-foreground">{fmtDate(l.data_lancamento)}</p>
                </div>
                <Badge className={STATUS_LANC[l.status || "planejado"] || "bg-gray-400 text-white"}>
                  {l.status || "planejado"}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-muted-foreground">{c.concluidos} de {c.total} itens concluídos</div>
              </div>

              <Button size="sm" variant="ghost" onClick={() => toggle(l.id)} className="gap-1">
                {expanded === l.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Ver checklist
              </Button>

              {expanded === l.id && (
                loadingItems ? (
                  <Skeleton className="h-40" />
                ) : (
                  <Tabs defaultValue="pre" className="pt-2 border-t">
                    <TabsList className="grid grid-cols-3 w-full">
                      {FASES.map((f) => (
                        <TabsTrigger key={f.key} value={f.key} className="text-xs">{f.label}</TabsTrigger>
                      ))}
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
                          ) : fItems.map((it) => (
                            <ItemRow key={it.id} item={it} onUpdate={updateItem} />
                          ))}
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                )
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

function ItemRow({ item, onUpdate }: { item: ChecklistItem; onUpdate: (id: string, patch: Partial<ChecklistItem>) => void }) {
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
        <Checkbox
          checked={local.concluido}
          onCheckedChange={(v) => {
            setLocal({ ...local, concluido: !!v });
            onUpdate(item.id, { concluido: !!v });
          }}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm">{icon} {item.texto_item}</span>
            {item.canal && <Badge className={`text-[10px] ${canalCls}`}>{item.canal}</Badge>}
          </div>
        </div>
      </div>

      {item.tipo_item === "copy" && (
        <div>
          <Textarea
            rows={3}
            placeholder="Cole aqui a copy aprovada..."
            value={local.conteudo_aprovado || ""}
            onChange={(e) => setLocal({ ...local, conteudo_aprovado: e.target.value })}
            onBlur={() => blur("conteudo_aprovado")}
          />
          {local.conteudo_aprovado && <Badge className="bg-green-600 text-white text-[10px] mt-1">Copy salva</Badge>}
        </div>
      )}

      {(item.tipo_item === "foto" || item.tipo_item === "video") && (
        <div>
          <Input
            placeholder="Cole o link do arquivo (Google Drive, etc)"
            value={local.url_arquivo || ""}
            onChange={(e) => setLocal({ ...local, url_arquivo: e.target.value })}
            onBlur={() => blur("url_arquivo")}
          />
          {local.url_arquivo && (
            <div className="flex items-center gap-2 mt-1">
              <a href={local.url_arquivo} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                Abrir arquivo <ExternalLink className="h-3 w-3" />
              </a>
              <Badge className="bg-green-600 text-white text-[10px]">Arquivo vinculado</Badge>
            </div>
          )}
        </div>
      )}

      <Textarea
        rows={2}
        placeholder="Observação"
        value={local.observacao || ""}
        onChange={(e) => setLocal({ ...local, observacao: e.target.value })}
        onBlur={() => blur("observacao")}
        className="text-xs"
      />
    </div>
  );
}
