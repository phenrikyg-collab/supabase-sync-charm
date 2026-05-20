import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Star, ExternalLink, ChevronDown, Pause, X, Edit, RotateCcw, Sparkles, Copy } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { callClaude } from "@/lib/claudeApi";
import { CategoryFilter } from "./CategoryFilter";
import { CategoriaKey, categorizarProduto } from "@/lib/categorias";
import { usePrecoMinimo } from "@/hooks/usePrecoMinimo";
import { PrecoMinimoInfo } from "./PrecoMinimoInfo";

interface CampanhaRow {
  id: string;
  product_id: string;
  nome_produto: string;
  motivo: string | null;
  prioridade: number;
  meta_vendas: number | null;
  observacao: string | null;
  status: string;
  created_at: string;
}

interface ViewRow {
  id: any;
  preco: number | null;
  estoque_total: number | null;
  total_vendas: number | null;
  url_produto: string | null;
  percentual_abaixo_media: number | null;
  variantes_zeradas: number | null;
}

function brl(v: number | null | undefined) {
  return v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StarsRow({ n, urgent }: { n: number; urgent: boolean }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-4 w-4 ${
          i <= n ? (urgent ? "fill-red-500 text-red-500" : "fill-amber-400 text-amber-400")
                 : "text-muted-foreground/40"
        }`} />
      ))}
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  ativo: "bg-green-100 text-green-800 border-green-300",
  pausado: "bg-yellow-100 text-yellow-800 border-yellow-300",
  encerrado: "bg-gray-200 text-gray-700 border-gray-300",
};

export function AbaEmCampanha() {
  const [loading, setLoading] = useState(true);
  const [campanhas, setCampanhas] = useState<CampanhaRow[]>([]);
  const [viewMap, setViewMap] = useState<Record<string, ViewRow>>({});
  const [editing, setEditing] = useState<CampanhaRow | null>(null);
  const [form, setForm] = useState({ motivo: "", prioridade: 3, meta_vendas: "", observacao: "" });
  const [textoCampanha, setTextoCampanha] = useState<{ campanha: CampanhaRow; view?: ViewRow } | null>(null);
  const [textoCanal, setTextoCanal] = useState<"instagram" | "email" | "whatsapp">("instagram");
  const [textoLoading, setTextoLoading] = useState(false);
  const [textoGerado, setTextoGerado] = useState<Record<string, string>>({});

  async function carregar() {
    setLoading(true);
    try {
      const { data: pc, error: err1 } = await supabase
        .from("produtos_campanha" as any)
        .select("*")
        .order("prioridade", { ascending: false })
        .order("created_at", { ascending: false });
      if (err1) throw err1;
      const list = (pc as any as CampanhaRow[]) || [];
      setCampanhas(list);

      const { data: vw, error: err2 } = await supabase
        .from("vw_produtos_campanha" as any)
        .select("id, preco, estoque_total, total_vendas, url_produto, percentual_abaixo_media, variantes_zeradas");
      if (err2) throw err2;
      const map: Record<string, ViewRow> = {};
      (vw as any as ViewRow[]).forEach(v => { map[String(v.id)] = v; });
      setViewMap(map);
    } catch (e: any) {
      toast.error("Erro ao carregar campanhas: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { carregar(); }, []);

  const ativos = campanhas.filter(c => c.status === "ativo");
  const inativos = campanhas.filter(c => c.status !== "ativo");

  const metricas = useMemo(() => ({
    total: ativos.length,
    mediaPrio: ativos.length ? (ativos.reduce((s, c) => s + c.prioridade, 0) / ativos.length).toFixed(1) : "0",
    comMeta: ativos.filter(c => c.meta_vendas && c.meta_vendas > 0).length,
  }), [ativos]);

  async function alterarStatus(id: string, status: string) {
    const { error } = await supabase.from("produtos_campanha" as any).update({ status }).eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Status atualizado"); carregar(); }
  }

  function abrirEdicao(c: CampanhaRow) {
    setEditing(c);
    setForm({
      motivo: c.motivo || "",
      prioridade: c.prioridade,
      meta_vendas: c.meta_vendas?.toString() || "",
      observacao: c.observacao || "",
    });
  }

  async function salvarEdicao() {
    if (!editing) return;
    const { error } = await supabase.from("produtos_campanha" as any).update({
      motivo: form.motivo || null,
      prioridade: form.prioridade,
      meta_vendas: form.meta_vendas ? Number(form.meta_vendas) : null,
      observacao: form.observacao || null,
    }).eq("id", editing.id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Campanha atualizada"); setEditing(null); carregar(); }
  }

  function abrirGerarTexto(c: CampanhaRow) {
    setTextoCampanha({ campanha: c, view: viewMap[c.product_id] });
    setTextoCanal("instagram");
    setTextoGerado({});
  }

  async function gerarTexto() {
    if (!textoCampanha) return;
    const { campanha: c, view: v } = textoCampanha;
    setTextoLoading(true);
    try {
      const canalDesc = {
        instagram: "post para Instagram (legenda com gancho forte na 1ª linha, storytelling, CTA claro e 15 hashtags ao final)",
        email: "e-mail marketing (assunto até 50 chars, preview text até 90 chars, corpo HTML simples com CTA)",
        whatsapp: "mensagem de WhatsApp (curta, direta, emoji elegante, com CTA e cupom quando houver)",
      }[textoCanal];

      const prompt = `Gere um ${canalDesc} para uma campanha do produto abaixo.

PRODUTO: ${c.nome_produto}
PREÇO: ${brl(v?.preco)}
ESTOQUE DISPONÍVEL: ${v?.estoque_total ?? "—"} unidades
VENDAS RECENTES: ${v?.total_vendas ?? 0}
${v?.percentual_abaixo_media != null ? `STATUS: vendendo ${Number(v.percentual_abaixo_media).toFixed(0)}% abaixo da média da loja\n` : ""}MOTIVO DA CAMPANHA: ${c.motivo || "girar estoque"}
PRIORIDADE: ${c.prioridade}/5 ${c.prioridade === 5 ? "(URGENTE)" : ""}
${c.meta_vendas ? `META: vender ${c.meta_vendas} unidades` : ""}
${c.observacao ? `OBSERVAÇÕES: ${c.observacao}` : ""}
${v?.url_produto ? `LINK: ${v.url_produto}` : ""}

Retorne APENAS o texto pronto para publicar, sem comentários, sem JSON, sem markdown.`;

      const result = await callClaude(prompt);
      setTextoGerado(prev => ({ ...prev, [textoCanal]: result.trim() }));
    } catch (e: any) {
      toast.error("Erro ao gerar texto: " + (e.message || ""));
    } finally {
      setTextoLoading(false);
    }
  }

  async function copiarTexto() {
    const t = textoGerado[textoCanal];
    if (!t) return;
    await navigator.clipboard.writeText(t);
    toast.success("Texto copiado!");
  }

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="py-4">
          <p className="text-xs uppercase text-muted-foreground">Em campanha ativa</p>
          <p className="text-3xl font-serif mt-1">{metricas.total}</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-xs uppercase text-muted-foreground">Média de prioridade</p>
          <p className="text-3xl font-serif mt-1">{metricas.mediaPrio}</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-xs uppercase text-muted-foreground">Com meta definida</p>
          <p className="text-3xl font-serif mt-1">{metricas.comMeta}</p>
        </CardContent></Card>
      </div>

      {!ativos.length && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhum produto em campanha ativa. Adicione produtos pela aba "Sugestões Automáticas".
        </CardContent></Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ativos.map(c => {
          const v = viewMap[c.product_id];
          const pctMeta = c.meta_vendas && v?.total_vendas
            ? Math.min(100, (v.total_vendas / c.meta_vendas) * 100) : 0;
          return (
            <Card key={c.id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {v?.url_produto ? (
                      <a href={v.url_produto} target="_blank" rel="noreferrer"
                         className="font-medium text-foreground hover:text-primary inline-flex items-center gap-1">
                        {c.nome_produto} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : <span className="font-medium">{c.nome_produto}</span>}
                    <div className="mt-1 flex items-center gap-2">
                      <StarsRow n={c.prioridade} urgent={c.prioridade === 5} />
                      <Badge variant="outline" className={STATUS_BADGE[c.status]}>{c.status}</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-xs text-muted-foreground">Preço</p><p>{brl(v?.preco)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Estoque</p><p>{v?.estoque_total ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">% abaixo média</p>
                    <p>{v?.percentual_abaixo_media != null ? `${Number(v.percentual_abaixo_media).toFixed(0)}%` : "—"}</p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{c.meta_vendas ? `${v?.total_vendas ?? 0} vendas de ${c.meta_vendas} meta` : "Sem meta definida"}</span>
                    {c.meta_vendas ? <span>{pctMeta.toFixed(0)}%</span> : null}
                  </div>
                  <Progress value={pctMeta} className="h-2" />
                </div>

                {c.motivo && (
                  <div className="bg-muted/50 rounded px-3 py-2 text-sm">
                    <span className="text-xs uppercase text-muted-foreground">Motivo:</span> {c.motivo}
                  </div>
                )}
                {c.observacao && (
                  <p className="text-xs text-muted-foreground">{c.observacao}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Incluído em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </p>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button size="sm" onClick={() => abrirGerarTexto(c)}>
                    <Sparkles className="h-3 w-3 mr-1" /> Gerar texto
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => abrirEdicao(c)}>
                    <Edit className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => alterarStatus(c.id, "pausado")}>
                    <Pause className="h-3 w-3 mr-1" /> Pausar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => alterarStatus(c.id, "encerrado")}>
                    <X className="h-3 w-3 mr-1" /> Encerrar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!!inativos.length && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary">
            <ChevronDown className="h-4 w-4" /> Histórico ({inativos.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inativos.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>{c.nome_produto}</TableCell>
                        <TableCell><Badge variant="outline" className={STATUS_BADGE[c.status]}>{c.status}</Badge></TableCell>
                        <TableCell>{c.prioridade}★</TableCell>
                        <TableCell>{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-right">
                          {c.status === "pausado" && (
                            <Button size="sm" variant="outline" onClick={() => alterarStatus(c.id, "ativo")}>
                              <RotateCcw className="h-3 w-3 mr-1" /> Reativar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar campanha</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div><Label>Produto</Label><Input value={editing.nome_produto} readOnly /></div>
              <div><Label>Motivo</Label>
                <Textarea value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} /></div>
              <div><Label>Prioridade</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setForm({ ...form, prioridade: n })}>
                      <Star className={`h-6 w-6 ${n <= form.prioridade ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div><Label>Meta de vendas</Label>
                <Input type="number" value={form.meta_vendas}
                  onChange={(e) => setForm({ ...form, meta_vendas: e.target.value })} /></div>
              <div><Label>Observação</Label>
                <Textarea value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={salvarEdicao}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!textoCampanha} onOpenChange={(o) => !o && setTextoCampanha(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar texto da campanha</DialogTitle>
          </DialogHeader>
          {textoCampanha && (
            <div className="space-y-4">
              <div className="text-sm bg-muted/50 rounded p-3 space-y-1">
                <p className="font-medium">{textoCampanha.campanha.nome_produto}</p>
                <p className="text-xs text-muted-foreground">
                  Preço {brl(textoCampanha.view?.preco)} • Estoque {textoCampanha.view?.estoque_total ?? "—"} •
                  Prioridade {textoCampanha.campanha.prioridade}/5
                  {textoCampanha.campanha.motivo ? ` • ${textoCampanha.campanha.motivo}` : ""}
                </p>
              </div>
              <Tabs value={textoCanal} onValueChange={(v) => setTextoCanal(v as any)}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="instagram">Instagram</TabsTrigger>
                  <TabsTrigger value="email">E-mail</TabsTrigger>
                  <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                </TabsList>
                {(["instagram", "email", "whatsapp"] as const).map(canal => (
                  <TabsContent key={canal} value={canal} className="space-y-3 mt-3">
                    <Textarea
                      value={textoGerado[canal] || ""}
                      onChange={(e) => setTextoGerado(prev => ({ ...prev, [canal]: e.target.value }))}
                      placeholder={`Clique em "Gerar texto" para criar o conteúdo de ${canal}…`}
                      className="min-h-[260px] font-mono text-xs"
                    />
                    <div className="flex justify-between gap-2">
                      <Button variant="outline" size="sm" onClick={copiarTexto} disabled={!textoGerado[canal]}>
                        <Copy className="h-3 w-3 mr-1" /> Copiar
                      </Button>
                      <Button size="sm" onClick={gerarTexto} disabled={textoLoading}>
                        <Sparkles className="h-3 w-3 mr-1" />
                        {textoLoading ? "Gerando…" : textoGerado[canal] ? "Regenerar" : "Gerar texto"}
                      </Button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTextoCampanha(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
