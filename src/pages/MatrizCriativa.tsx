import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Heart, AlertTriangle, Sparkles, RotateCw, Trash2, Check, Play, Printer, Upload, Bot, FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const EDGE_GERAR_CRIATIVOS =
  "https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/gerar-criativos";

async function regerarCriativo(c: any): Promise<any | null> {
  const body = {
    produto_nome: c.produto_nome ?? null,
    produto_id: c.produto_id ?? null,
    persona_id: c.persona_id,
    pilares: c.pilar ? [c.pilar] : [],
    formatos: c.formato ? [c.formato] : [],
    etapa_funil: c.etapa_funil ?? null,
    tipo_conteudo: c.tipo_conteudo ?? null,
  };
  const r = await fetch(EDGE_GERAR_CRIATIVOS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  const lista = data.criativos || data || [];
  const novo = Array.isArray(lista) ? lista[0] : null;
  if (novo && c.id) {
    await sb.from("mc_criativos").delete().eq("id", c.id);
  }
  return novo;
}

const sb = supabase as any;

const PILARES = [
  { id: "angulo", label: "Ângulo", color: "bg-purple-500 text-white" },
  { id: "conceito", label: "Conceito", color: "bg-blue-500 text-white" },
  { id: "dsb", label: "DSB", color: "bg-orange-500 text-white" },
  { id: "full_funnel", label: "Full Funnel", color: "bg-green-600 text-white" },
  { id: "ugc", label: "UGC", color: "bg-pink-500 text-white" },
];
const pilarColor = (p: string) =>
  PILARES.find((x) => x.id === p)?.color ?? "bg-muted text-foreground";
const pilarLabel = (p: string) =>
  PILARES.find((x) => x.id === p)?.label ?? p;

const FORMATOS = ["Reels", "Vídeo", "Imagem", "Story", "Carrossel"];

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-muted text-foreground",
  aprovado: "bg-blue-500 text-white",
  em_producao: "bg-amber-500 text-white",
  produzido: "bg-purple-500 text-white",
  publicado: "bg-green-600 text-white",
  pausado: "bg-orange-500 text-white",
  arquivado: "bg-red-300 text-red-900",
};
const STATUS_LIST = Object.keys(STATUS_COLORS);

const EDGE_GERAR_BRIEFING =
  "https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/gerar-briefing-html";

function BriefingButton({
  criativo,
  onUpdated,
  className,
  label = "📄 Ver Briefing",
  labelOpen = "📄 Abrir Briefing Completo",
  tooltip,
}: {
  criativo: any;
  onUpdated?: (id: string, updates: { html_briefing_url: string; html_briefing_gerado_em?: string }) => void;
  className?: string;
  label?: string;
  labelOpen?: string;
  tooltip?: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    if (criativo.html_briefing_url) {
      window.open(criativo.html_briefing_url, "_blank");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(EDGE_GERAR_BRIEFING, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criativo_id: criativo.id }),
      });
      const data = await r.json();
      if (!r.ok || !data?.html_briefing_url) throw new Error(data?.error || "erro");
      window.open(data.html_briefing_url, "_blank");
      onUpdated?.(criativo.id, {
        html_briefing_url: data.html_briefing_url,
        html_briefing_gerado_em: data.html_briefing_gerado_em ?? new Date().toISOString(),
      });
    } catch {
      toast({ title: "Erro ao gerar briefing, tente novamente", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  const btn = (
    <Button size="sm" variant="outline" className={className} onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
      {loading ? "Gerando briefing..." : (criativo.html_briefing_url ? labelOpen : label)}
    </Button>
  );
  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return btn;
}



export default function MatrizCriativa() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Matriz Criativa</h1>
        <p className="text-sm text-muted-foreground">
          Gere, organize e produza criativos alinhados às personas da marca.
        </p>
      </div>
      <Tabs defaultValue="gerar">
        <TabsList>
          <TabsTrigger value="gerar">Gerar Criativos</TabsTrigger>
          <TabsTrigger value="biblioteca">Biblioteca</TabsTrigger>
          <TabsTrigger value="personas">Personas</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
        </TabsList>
        <TabsContent value="gerar"><AbaGerar /></TabsContent>
        <TabsContent value="biblioteca"><AbaBiblioteca /></TabsContent>
        <TabsContent value="personas"><AbaPersonas /></TabsContent>
        <TabsContent value="modelos"><AbaModelos /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA GERAR
// ─────────────────────────────────────────────────────────────
function AbaGerar() {
  const { toast } = useToast();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [loadingDados, setLoadingDados] = useState(true);

  const [produtoId, setProdutoId] = useState<string>("");
  const [produtoManual, setProdutoManual] = useState("");
  const [usarManual, setUsarManual] = useState(false);
  const [personaId, setPersonaId] = useState<string>("");

  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<any[] | null>(null);
  const [modal, setModal] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, ps] = await Promise.all([
          sb.from("vw_produtos_matriz")
            .select("product_id, nome_produto, preco, categoria_display, categoria_nome, imagem_url")
            .order("categoria_display", { ascending: true }),
          sb.from("mc_personas").select("*").eq("ativa", true).order("nome"),
        ]);
        setProdutos(p.data || []);
        setPersonas(ps.data || []);
      } catch (e) {
        toast({ title: "Erro ao carregar dados", variant: "destructive" });
      } finally {
        setLoadingDados(false);
      }
    })();
  }, []);

  const persona = useMemo(() => personas.find((x) => x.id === personaId), [personas, personaId]);

  const produtoSelecionado = useMemo(
    () => produtos.find((p) => String(p.product_id) === produtoId),
    [produtos, produtoId]
  );

  const produtosAgrupados = useMemo(() => {
    const ORDEM = [
      "✨ Lançamentos",
      "⭐ Best Sellers",
      "👖 Calças — Skinny",
      "👖 Calças — Flare",
      "👖 Calças — Reta",
      "👖 Calças — Pantalona",
      "👚 Blusas",
      "🩱 Body",
      "🩳 Cropped",
      "👗 Vestidos",
      "🩲 Saia/Shorts",
      "👔 Conjuntos",
      "🦺 Macacões",
      "🧥 Jaquetas",
      "🛍️ Leve Mais Pague Menos",
    ];
    const map = new Map<string, any[]>();
    for (const p of produtos) {
      const k = p.categoria_display || p.categoria_nome || "Outros";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    const ordered: { categoria: string; items: any[] }[] = [];
    for (const c of ORDEM) if (map.has(c)) { ordered.push({ categoria: c, items: map.get(c)! }); map.delete(c); }
    for (const [c, items] of map) ordered.push({ categoria: c, items });
    return ordered;
  }, [produtos]);

  async function gerar() {
    if (!personaId) return toast({ title: "Selecione a Persona", variant: "destructive" });
    const produtoNome = usarManual
      ? produtoManual.trim()
      : produtoSelecionado?.nome_produto ?? "";

    setGerando(true);
    setResultado(null);
    try {
      const r = await fetch(
        "https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/gerar-criativos",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            produto_nome: produtoNome || null,
            produto_id: null,
            tray_product_id: usarManual ? null : (produtoSelecionado?.product_id ?? null),
            persona_id: personaId,
            pilares: [],
            formatos: [],
            etapa_funil: null,
            tipo_conteudo: null,
          }),
        }
      );
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setResultado(data.criativos || data || []);
      toast({ title: "Criativos gerados 💛" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar criativos", description: e.message, variant: "destructive" });
    } finally {
      setGerando(false);
    }
  }

  const [regenerandoId, setRegenerandoId] = useState<string | null>(null);

  async function aprovar(id: string) {
    if (!id) return toast({ title: "Criativo sem ID", variant: "destructive" });
    const { error } = await sb.from("mc_criativos").update({ status: "aprovado" }).eq("id", id);
    if (error) return toast({ title: "Erro ao aprovar", description: error.message, variant: "destructive" });
    toast({ title: "Criativo aprovado!" });
    setResultado((r) => r?.map((c) => (c.id === id ? { ...c, status: "aprovado" } : c)) ?? null);
    setModal((m: any) => (m && m.id === id ? { ...m, status: "aprovado" } : m));
  }

  async function atualizarStatus(id: string, status: string) {
    if (!id) return;
    const { error } = await sb.from("mc_criativos").update({ status }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: `Status: ${status}` });
    setResultado((r) => r?.map((c) => (c.id === id ? { ...c, status } : c)) ?? null);
    setModal((m: any) => (m && m.id === id ? { ...m, status } : m));
  }

  async function excluir(id: string) {
    if (!id) return;
    const { error } = await sb.from("mc_criativos").delete().eq("id", id);
    if (error) return toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    setResultado((r) => r?.filter((c) => c.id !== id) ?? null);
    setModal((m: any) => (m && m.id === id ? null : m));
    toast({ title: "Criativo removido" });
  }

  async function regenerar(c: any) {
    if (!c?.id) return;
    setRegenerandoId(c.id);
    try {
      const novo = await regerarCriativo(c);
      if (!novo) throw new Error("Nada retornado");
      setResultado((r) => r?.map((x) => (x.id === c.id ? novo : x)) ?? null);
      setModal((m: any) => (m && m.id === c.id ? novo : m));
      toast({ title: "Criativo regenerado" });
    } catch (e: any) {
      toast({ title: "Erro ao regenerar", description: e.message, variant: "destructive" });
    } finally {
      setRegenerandoId(null);
    }
  }

  if (loadingDados) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 mt-4">
        <Skeleton className="h-[600px]" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 mt-4">
      {/* Painel esquerdo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Produto */}
          <div className="space-y-2">
            <Label>Produto / Categoria <span className="text-xs text-muted-foreground">(opcional)</span></Label>
            {!usarManual ? (
              <div className="flex items-start gap-2">
                {produtoSelecionado?.imagem_url && (
                  <img
                    src={produtoSelecionado.imagem_url}
                    alt={produtoSelecionado.nome_produto}
                    className="rounded border border-border object-cover flex-shrink-0"
                    style={{ width: 40, height: 50 }}
                  />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <Select value={produtoId} onValueChange={(v) => {
                    if (v === "__manual__") { setUsarManual(true); setProdutoId(""); }
                    else if (v === "__none__") { setProdutoId(""); }
                    else setProdutoId(v);
                  }}>
                  <SelectTrigger>
                      <SelectValue placeholder="Opcional — a IA vai usar o contexto da marca" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[400px]">
                      <SelectItem value="__none__">— Sem produto específico —</SelectItem>
                      {produtosAgrupados.map((grupo) => (
                        <SelectGroup key={grupo.categoria}>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground">{grupo.categoria}</SelectLabel>
                          {grupo.items.map((p) => (
                            <SelectItem key={p.product_id} value={String(p.product_id)}>
                              {p.nome_produto}
                              {p.preco != null && ` — R$ ${Number(p.preco).toFixed(2).replace(".", ",")}`}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                      <SelectItem value="__manual__">✍️ Digitar produto manualmente</SelectItem>
                    </SelectContent>
                  </Select>
                  {produtoSelecionado?.preco != null && (
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      R$ {Number(produtoSelecionado.preco).toFixed(2).replace(".", ",")}
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Opcional"
                  value={produtoManual}
                  onChange={(e) => setProdutoManual(e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={() => { setUsarManual(false); setProdutoManual(""); }}>
                  Voltar
                </Button>
              </div>
            )}
          </div>

          {/* Persona */}
          <div className="space-y-2">
            <Label>Persona Alvo *</Label>
            <Select value={personaId} onValueChange={setPersonaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a persona" /></SelectTrigger>
              <SelectContent>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.emoji} {p.nome} · {p.faixa_etaria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {persona && (
              <Card className="bg-muted/40 border-border/60">
                <CardContent className="p-3 text-xs space-y-1.5">
                  <p><span className="font-semibold">Motivação:</span> {persona.motivacao}</p>
                  <p><span className="font-semibold">Objeção:</span> {persona.objecao}</p>
                  <p className="italic text-primary">"{persona.mensagem_principal}"</p>
                </CardContent>
              </Card>
            )}
          </div>

          <Button onClick={gerar} disabled={gerando} size="lg" className="w-full">
            {gerando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" /> Gerar Criativos com IA</>}
          </Button>
        </CardContent>
      </Card>

      {/* Painel direito */}
      <div>
        {gerando && (
          <Card><CardContent className="p-10 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              A IA está lendo o contexto do seu e-commerce e gerando os criativos...
            </p>
          </CardContent></Card>
        )}
        {!gerando && !resultado && (
          <Card><CardContent className="p-10 text-center text-muted-foreground text-sm">
            Configure ao lado e clique em <strong>Gerar Criativos com IA</strong>.
          </CardContent></Card>
        )}
        {!gerando && resultado && (
          <div className="space-y-4">
            <h2 className="font-serif text-xl">
              {resultado.length} criativos gerados
              {(produtoId || produtoManual) && <> · {usarManual ? produtoManual : produtoSelecionado?.nome_produto}</>}
              {persona && <> · {persona.nome}</>}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resultado.map((c, i) => (
                <CriativoCard
                  key={c.id ?? i}
                  c={c}
                  regenerando={regenerandoId === c.id}
                  onOpen={() => setModal(c)}
                  onAprovar={() => aprovar(c.id)}
                  onRegenerar={() => regenerar(c)}
                  onExcluir={() => excluir(c.id)}
                  onBriefingUpdated={(id, updates) => {
                    setResultado((r) => r?.map((x) => (x.id === id ? { ...x, ...updates } : x)) ?? null);
                    setModal((m: any) => (m && m.id === id ? { ...m, ...updates } : m));
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <CriativoModal
        criativo={modal}
        onClose={() => setModal(null)}
        regenerando={modal && regenerandoId === modal.id}
        onAprovar={async () => { if (modal?.id) { await aprovar(modal.id); setModal(null); } }}
        onEmProducao={async () => { if (modal?.id) await atualizarStatus(modal.id, "em_producao"); }}
        onRegenerar={async () => { if (modal) await regenerar(modal); }}
        onExcluir={async () => { if (modal?.id) { await excluir(modal.id); setModal(null); } }}
        onBriefingUpdated={(id: string, updates: any) => {
          setResultado((r) => r?.map((x) => (x.id === id ? { ...x, ...updates } : x)) ?? null);
          setModal((m: any) => (m && m.id === id ? { ...m, ...updates } : m));
        }}
      />

    </div>
  );
}

function CriativoCard({ c, onOpen, onAprovar, onRegenerar, onExcluir, regenerando }: any) {
  const preview = (c.roteiro_hook || c.headline_principal || "").split("\n").slice(0, 2).join(" ");
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {c.pilar && <Badge className={pilarColor(c.pilar)}>{pilarLabel(c.pilar)}</Badge>}
          {c.formato && <Badge variant="outline">{c.formato}</Badge>}
          {c.etapa_funil && <Badge variant="secondary">{c.etapa_funil}</Badge>}
          {c.status && <Badge className={STATUS_COLORS[c.status] ?? ""}>{c.status}</Badge>}
        </div>
        <h3 className="font-semibold text-base">{c.titulo}</h3>
        {c.angulo && <p className="text-xs text-muted-foreground"><strong>Ângulo:</strong> {c.angulo}</p>}
        {c.tom_mensagem && <p className="text-xs text-muted-foreground"><strong>Tom:</strong> {c.tom_mensagem}</p>}
        {preview && <p className="text-sm line-clamp-2 text-foreground/80">{preview}</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onOpen}>Ver Completo</Button>
          {c.html_briefing_url && (
            <Button size="sm" variant="outline" onClick={() => window.open(c.html_briefing_url, "_blank")}>
              <FileText className="h-3 w-3 mr-1" /> 📄 Ver Briefing
            </Button>
          )}
          <Button size="sm" onClick={onAprovar} disabled={regenerando}>
            <Check className="h-3 w-3" /> Aprovar
          </Button>
          <Button size="sm" variant="secondary" onClick={onRegenerar} disabled={regenerando}>
            {regenerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
            Regenerar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirmDel(true)} disabled={regenerando}>
            <Trash2 className="h-3 w-3" /> Excluir
          </Button>
        </div>
      </CardContent>
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir criativo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onExcluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

type Cena = {
  numero: string;
  tempo: string;
  camera: string;
  fala: string;
  visual: string;
  expressao: string;
  som: string;
};

function parseRoteiroVideo(texto: string): Cena[] {
  const t = (texto || "").replace(/\r/g, "");
  if (!t.trim()) return [];

  // 1) Split por [CENA N ...] — captura o header e o corpo até o próximo [CENA ou fim
  const cenas: Cena[] = [];
  // Regex captura: 1) número  2) miolo do header (tempo)  3) corpo até próximo [CENA ou fim
  const re = /\[\s*CENA\s*(\d+)\s*([^\]]*)\]([\s\S]*?)(?=\[\s*CENA\s*\d+|$)/gi;
  let m: RegExpExecArray | null;

  const extractField = (corpo: string, labels: string[]): string => {
    // Constrói lookahead com TODOS os labels conhecidos + separador --- + fim
    const allLabels = ["CAMERA", "C[ÂA]MERA", "FALA", "VISUAL", "EXPRESS[ÃA]O", "EXPRESSAO", "SOM"];
    const stop = `(?=^\\s*(?:${allLabels.join("|")})\\s*:|^\\s*---\\s*$|\\Z)`;
    for (const lbl of labels) {
      const r = new RegExp(`^\\s*${lbl}\\s*:\\s*([\\s\\S]*?)${stop}`, "im");
      const mm = corpo.match(r);
      if (mm && mm[1] != null) {
        return mm[1].trim().replace(/\n+/g, " ").trim();
      }
    }
    return "";
  };

  while ((m = re.exec(t)) !== null) {
    const numero = m[1];
    const headerRest = (m[2] || "").trim(); // ex: "- 0s a 3s"
    const corpo = (m[3] || "").trim();
    const tempoMatch = headerRest.match(/(\d+\s*s?\s*(?:a|até|–|—|-)\s*\d+\s*s?)/i);
    const tempo = tempoMatch ? tempoMatch[1].trim() : headerRest.replace(/^[-–—\s]+/, "");

    cenas.push({
      numero,
      tempo,
      camera: extractField(corpo, ["CAMERA", "C[ÂA]MERA"]),
      fala: extractField(corpo, ["FALA"]),
      visual: extractField(corpo, ["VISUAL"]),
      expressao: extractField(corpo, ["EXPRESS[ÃA]O", "EXPRESSAO"]),
      som: extractField(corpo, ["SOM"]),
    });
  }
  return cenas;
}

function RoteiroVideo({ texto }: { texto: string }) {
  const cenas = parseRoteiroVideo(texto);
  if (cenas.length === 0) {
    return (
      <pre className="font-mono text-xs bg-muted p-4 rounded whitespace-pre-wrap">
        {texto}
      </pre>
    );
  }
  const linhas: { key: keyof Cena; label: string; badge: string; italic?: boolean; quote?: boolean }[] = [
    { key: "camera", label: "CÂMERA", badge: "bg-blue-100 text-blue-700 border-blue-200" },
    { key: "fala", label: "FALA", badge: "bg-green-100 text-green-700 border-green-200", italic: true, quote: true },
    { key: "visual", label: "VISUAL", badge: "bg-purple-100 text-purple-700 border-purple-200" },
    { key: "expressao", label: "EXPRESSÃO", badge: "bg-orange-100 text-orange-700 border-orange-200" },
    { key: "som", label: "SOM", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  ];
  return (
    <div className="space-y-4">
      {cenas.map((cena, idx) => (
        <div key={`${cena.numero}-${idx}`}>
          {idx > 0 && <Separator className="my-4 bg-border/40" />}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="bg-primary/10 px-3 py-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                CENA {cena.numero}
              </span>
              {cena.tempo && (
                <span className="text-[11px] text-muted-foreground">• {cena.tempo}</span>
              )}
            </div>
            <div className="p-3 space-y-2 text-sm">
              {linhas.map((l) => {
                const v = (cena[l.key] as string) || "";
                if (!v) return null;
                const clean = l.quote ? v.replace(/^["“”]/, "").replace(/["“”]$/, "") : v;
                return (
                  <div key={l.key} className="flex gap-2 items-start">
                    <span className={`shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${l.badge}`}>
                      {l.label}
                    </span>
                    <p className={`text-foreground/90 ${l.italic ? "italic" : ""}`}>
                      {l.quote ? `"${clean}"` : clean}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const FORMATOS_ANUNCIO = [
  { id: "feed_retrato", label: "Feed / Reels 4:5 (1080×1350) — Recomendado" },
  { id: "feed_quadrado", label: "Feed Quadrado 1:1 (1080×1080)" },
  { id: "stories", label: "Stories / Reels 9:16 (1080×1920)" },
  { id: "banner_paisagem", label: "Banner Paisagem 1.91:1 (1200×628)" },
];

const TIPOS_FOTO = [
  { id: "lifestyle", label: "🌿 Lifestyle — modelo em cena ambientada" },
  { id: "estudio", label: "⬜ Estúdio — fundo branco, foco na peça" },
  { id: "com_texto", label: "✍️ Com Texto — headline e CTA sobrepostos" },
];

const CORMORANT_FONT_URL =
  "url(https://fonts.gstatic.com/s/cormorantgaramond/v21/co3WmX5slCNuHLi8bLeY9MK7whWMhyjYqXtK.woff2)";
let cormorantFontPromise: Promise<void> | null = null;
async function ensureCormorantFont() {
  if (typeof window === "undefined") return;
  if (!cormorantFontPromise) {
    cormorantFontPromise = (async () => {
      try {
        const face = new (window as any).FontFace("Cormorant Garamond", CORMORANT_FONT_URL);
        const loaded = await face.load();
        (document as any).fonts.add(loaded);
      } catch (e) {
        console.warn("Falha ao carregar fonte Cormorant Garamond", e);
      }
    })();
  }
  return cormorantFontPromise;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function composeCanvasOverlay(
  imageBaseUrl: string,
  dados: { headline?: string; subheadline?: string; cta?: string }
): Promise<string> {
  await ensureCormorantFont();
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Falha ao carregar imagem base"));
    img.src = imageBaseUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  // Scale factors based on a 1080 reference
  const scale = canvas.width / 1080;
  const overlayHeight = canvas.height / 3;
  const overlayY = canvas.height - overlayHeight;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, overlayY, canvas.width, overlayHeight);

  const paddingX = 60 * scale;
  const maxTextWidth = canvas.width - paddingX * 2;
  let cursorY = overlayY + 70 * scale;

  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  if (dados.headline) {
    ctx.font = `bold ${52 * scale}px "Cormorant Garamond", serif`;
    ctx.fillStyle = "#8b6a14";
    const lines = wrapText(ctx, dados.headline, maxTextWidth);
    for (const line of lines) {
      ctx.fillText(line, paddingX, cursorY);
      cursorY += 60 * scale;
    }
    cursorY += 10 * scale;
  }

  if (dados.subheadline) {
    ctx.font = `${32 * scale}px "Cormorant Garamond", serif`;
    ctx.fillStyle = "#ffffff";
    const lines = wrapText(ctx, dados.subheadline, maxTextWidth);
    for (const line of lines) {
      ctx.fillText(line, paddingX, cursorY);
      cursorY += 38 * scale;
    }
    cursorY += 18 * scale;
  }

  if (dados.cta) {
    ctx.font = `bold ${28 * scale}px "Cormorant Garamond", serif`;
    const padH = 28 * scale;
    const padV = 14 * scale;
    const metrics = ctx.measureText(dados.cta);
    const boxW = metrics.width + padH * 2;
    const boxH = 28 * scale + padV * 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(paddingX, cursorY, boxW, boxH);
    ctx.fillStyle = "#8b6a14";
    ctx.fillText(dados.cta, paddingX + padH, cursorY + padV);
  }

  return canvas.toDataURL("image/jpeg", 0.95);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

async function recolorGarmentImage(imageUrl: string, hex: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Falha ao carregar imagem do produto"));
    img.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const target = hexToRgb(hex);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;

  // Average luminance of garment-ish pixels (skip near-white background)
  let sum = 0;
  let count = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 240) {
      sum += lum;
      count++;
    }
  }
  const avgLum = count > 0 ? sum / count : 128;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Preserve near-white background and transparent pixels
    if (lum >= 240) continue;
    // Ratio relative to avg keeps shadows/highlights/texture
    const ratio = lum / Math.max(avgLum, 1);
    const nr = Math.min(255, Math.max(0, target.r * ratio));
    const ng = Math.min(255, Math.max(0, target.g * ratio));
    const nb = Math.min(255, Math.max(0, target.b * ratio));
    // Blend slightly with original luminance for texture preservation
    const blend = 0.85;
    d[i] = nr * blend + lum * (1 - blend);
    d[i + 1] = ng * blend + lum * (1 - blend);
    d[i + 2] = nb * blend + lum * (1 - blend);
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}



function ImagemMetaAds({ criativo }: { criativo: any }) {
  const { toast } = useToast();
  const [formato, setFormato] = useState("feed_retrato");
  const [tipoFoto, setTipoFoto] = useState("lifestyle");
  const [corHex, setCorHex] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [imagemUrl, setImagemUrl] = useState<string | null>(criativo.imagem_gerada_url || null);
  const [status, setStatus] = useState<string | null>(criativo.imagem_gerada_status || null);
  const [tipoFotoGerado, setTipoFotoGerado] = useState<string | null>(null);
  const [corHexGerado, setCorHexGerado] = useState<string | null>(null);
  const [modelos, setModelos] = useState<any[]>([]);
  const [modeloId, setModeloId] = useState<string | null>(null);

  useEffect(() => {
    setImagemUrl(criativo.imagem_gerada_url || null);
    setStatus(criativo.imagem_gerada_status || null);
  }, [criativo.id, criativo.imagem_gerada_url, criativo.imagem_gerada_status]);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from("mc_modelos")
        .select("id, nome, foto_url, faixa_etaria")
        .eq("ativa", true)
        .order("created_at", { ascending: false });
      if (error) console.error("Erro ao carregar modelos:", error);
      console.log("Modelos carregadas:", data);
      setModelos(data || []);
    })();
  }, []);

  const modeloSelecionada = modelos.find((m) => m.id === modeloId);

  async function gerar() {
    setLoading(true);
    try {
      let garmentBase64: string | null = null;
      if (corHex && criativo.imagem_produto_url) {
        try {
          garmentBase64 = await recolorGarmentImage(criativo.imagem_produto_url, corHex);
        } catch (err: any) {
          console.error("Falha ao recolorir imagem:", err);
          toast({
            title: "Não foi possível trocar a cor localmente",
            description: "Seguindo com a imagem original.",
            variant: "destructive",
          });
        }
      }

      const payload = {
        criativo_id: criativo.id,
        produto_id: criativo.produto_id,
        modelo_id: modeloId,
        formato_anuncio: formato,
        tipo_foto: tipoFoto,
        cor_hex: corHex || null,
        garment_image_base64: garmentBase64,
      };
      console.log("Payload completo:", payload);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(
        "https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/gerar-imagem-criativo",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.erro || data?.error || `Erro ${res.status}`);


      let finalUrl: string | null = data.imagem_gerada_url || data.url || null;

      if (data.renderizar_texto_no_frontend && data.imagem_base_url) {
        try {
          finalUrl = await composeCanvasOverlay(data.imagem_base_url, data.dados_texto || {});
        } catch (err: any) {
          console.error(err);
          toast({
            title: "Erro ao compor texto na imagem",
            description: err?.message,
            variant: "destructive",
          });
          finalUrl = data.imagem_base_url;
        }
      }

      setImagemUrl(finalUrl);
      setStatus(data.imagem_gerada_status || "gerada");
      setTipoFotoGerado(tipoFoto);
      setCorHexGerado(corHex || null);
      toast({ title: "Imagem gerada com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar imagem", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!imagemUrl) return;
    const a = document.createElement("a");
    a.href = imagemUrl;
    a.download = `criativo-${criativo.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const tipoFotoLabel = (id: string) => TIPOS_FOTO.find((t) => t.id === id)?.label ?? id;

  return (
    <div className="mt-4 rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Imagem para Meta Ads</h3>
        {status === "gerada" && <Badge className="bg-green-600 text-white">Gerada</Badge>}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Formato do Anúncio</Label>
        <Select value={formato} onValueChange={setFormato} disabled={loading}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FORMATOS_ANUNCIO.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(() => { console.log("Modelos disponíveis:", modelos?.length, modelos); return null; })()}
      {modelos.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Modelo</Label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <select
                value={modeloId || "ia"}
                disabled={loading}
                onChange={(e) => {
                  const val = e.target.value;
                  setModeloId(val === "ia" ? null : val);
                  console.log("Modelo selecionada:", val);
                }}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="ia">🤖 Gerar modelo com IA</option>
                {modelos?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}{m.faixa_etaria ? ` · ${m.faixa_etaria}` : ""}
                  </option>
                ))}
              </select>
            </div>
            {modeloSelecionada?.foto_url && (
              <img
                src={modeloSelecionada.foto_url}
                alt={modeloSelecionada.nome}
                style={{ width: 60, height: 80, objectFit: "cover", borderRadius: 8 }}
              />
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Tipo de Foto</Label>
        <Select value={tipoFoto} onValueChange={setTipoFoto} disabled={loading}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIPOS_FOTO.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Trocar cor da peça (opcional)</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={corHex || "#ffffff"}
            onChange={(e) => setCorHex(e.target.value)}
            disabled={loading}
            className="h-10 w-12 rounded border border-input cursor-pointer bg-background"
          />
          <Input
            value={corHex}
            onChange={(e) => setCorHex(e.target.value)}
            placeholder="Selecione uma cor ou deixe em branco"
            disabled={loading}
            className="flex-1"
          />
          {corHex && (
            <>
              <div
                className="h-10 w-10 rounded border border-input"
                style={{ backgroundColor: corHex }}
                title={corHex}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCorHex("")}
                disabled={loading}
              >
                Limpar
              </Button>
            </>
          )}
        </div>
      </div>

      <Button
        onClick={gerar}
        disabled={loading}
        className="bg-purple-600 hover:bg-purple-700 text-white w-full"
      >
        {loading ? (
          <><Loader2 className="animate-spin" /> Gerando imagem... pode levar até 60 segundos</>
        ) : (
          <>{imagemUrl ? "Gerar Novamente" : "Gerar Imagem com IA"}</>
        )}
      </Button>
      {loading && (
        <p className="text-xs text-muted-foreground text-center">Tempo estimado: 15-30 segundos</p>
      )}

      {imagemUrl && !loading && (
        <div className="space-y-3 pt-2">
          <img src={imagemUrl} alt="Imagem gerada" className="max-w-full rounded-lg border" />
          <div className="flex flex-wrap items-center gap-2">
            {tipoFotoGerado && (
              <Badge variant="secondary">{tipoFotoLabel(tipoFotoGerado)}</Badge>
            )}
            {corHexGerado && (
              <Badge variant="outline" className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-sm border"
                  style={{ backgroundColor: corHexGerado }}
                />
                {corHexGerado}
              </Badge>
            )}
          </div>
          {criativo.imagem_produto_url && (
            <div className="flex items-center gap-3">
              <img
                src={criativo.imagem_produto_url}
                alt="Produto original"
                className="w-20 h-20 object-cover rounded border"
              />
              <span className="text-xs text-muted-foreground">Produto original</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={download}>
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={gerar} disabled={loading}>
              Gerar Novamente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function roteiroParaHtml(texto: string): string {
  if (!texto) return "";
  const partes = texto.split(/\[CENA\s*/i).filter(Boolean);
  if (partes.length <= 1) return `<p>${escapeHtml(texto)}</p>`;
  return partes.map((p) => {
    const headerMatch = p.match(/^([^\]]+)\]/);
    const header = headerMatch ? headerMatch[1] : "";
    const corpo = p.replace(/^[^\]]+\]\s*/, "");
    const camera = corpo.match(/CÂMERA:\s*([^|]+)/i)?.[1]?.trim() ?? "";
    const fala = corpo.match(/FALA:\s*([^|]+)/i)?.[1]?.trim() ?? "";
    const visual = corpo.match(/VISUAL:\s*([^|]+)/i)?.[1]?.trim() ?? "";
    return `
      <div class="cena">
        <div class="cena-header">CENA ${escapeHtml(header)}</div>
        ${camera ? `<p><span class="lbl camera">CÂMERA:</span> ${escapeHtml(camera)}</p>` : ""}
        ${fala ? `<p><span class="lbl fala">FALA:</span> <em>${escapeHtml(fala)}</em></p>` : ""}
        ${visual ? `<p><span class="lbl visual">VISUAL:</span> ${escapeHtml(visual)}</p>` : ""}
      </div>`;
  }).join("");
}

function imprimirCriativo(c: any) {
  const isVideo = /video|reels/i.test(c.formato || "");
  const obs = String(c.observacoes_producao || "").split("\n").filter(Boolean);
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Criativo - ${escapeHtml(c.titulo)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'DM Sans',Arial,sans-serif;color:#1D1D1B;padding:32px;font-size:13px;line-height:1.5}
    h1{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:700;margin-bottom:6px}
    h2{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:700;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #8B6914;color:#8B6914;text-transform:uppercase;letter-spacing:.5px}
    .badges{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 16px}
    .badge{display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;background:#F5F5F5;border:1px solid #ddd}
    .badge.gold{background:#E8CD7E;color:#1D1D1B;border-color:#8B6914}
    .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;background:#F5F5F5;padding:12px;border-radius:6px;margin-bottom:16px}
    .meta div label{font-size:10px;text-transform:uppercase;color:#888;display:block;margin-bottom:2px}
    .meta div span{font-size:13px;font-weight:500}
    p{margin:6px 0}
    ul{margin:6px 0 6px 22px}
    li{margin:3px 0}
    .cena{border:1px solid #eee;border-left:4px solid #8B6914;border-radius:6px;padding:10px 14px;margin:10px 0;page-break-inside:avoid}
    .cena-header{background:rgba(232,205,126,.25);color:#8B6914;padding:4px 8px;border-radius:4px;font-weight:700;font-size:12px;margin-bottom:8px;display:inline-block}
    .lbl{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.3px}
    .lbl.camera{color:#1e40af}
    .lbl.fala{color:#065f46}
    .lbl.visual{color:#555}
    .dsb{padding:12px;border-radius:6px;margin:8px 0;border-left:4px solid}
    .dsb.dor{background:rgba(239,68,68,.08);border-color:#ef4444}
    .dsb.sol{background:rgba(59,130,246,.08);border-color:#3b82f6}
    .dsb.ben{background:rgba(34,197,94,.08);border-color:#22c55e}
    .dsb b{display:block;margin-bottom:4px;font-size:12px;letter-spacing:.5px}
    .checklist{margin-top:8px}
    .checklist li{list-style:none;margin:6px 0;padding-left:24px;position:relative}
    .checklist li:before{content:"";position:absolute;left:0;top:2px;width:14px;height:14px;border:1.5px solid #8B6914;border-radius:3px}
    .footer{margin-top:32px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#999;display:flex;justify-content:space-between}
    @media print{body{padding:18px}@page{margin:14mm}}
  </style></head><body>
    <h1>${escapeHtml(c.titulo || "Criativo")}</h1>
    <div class="badges">
      ${c.pilar ? `<span class="badge gold">${escapeHtml(pilarLabel(c.pilar))}</span>` : ""}
      ${c.formato ? `<span class="badge">${escapeHtml(c.formato)}</span>` : ""}
      ${c.etapa_funil ? `<span class="badge">${escapeHtml(c.etapa_funil)}</span>` : ""}
      ${c.tipo_conteudo ? `<span class="badge">${escapeHtml(c.tipo_conteudo)}</span>` : ""}
      ${c.status ? `<span class="badge">${escapeHtml(c.status)}</span>` : ""}
    </div>
    <div class="meta">
      ${c.produto_nome ? `<div><label>Produto</label><span>${escapeHtml(c.produto_nome)}</span></div>` : ""}
      ${c.tom_mensagem ? `<div><label>Tom</label><span>${escapeHtml(c.tom_mensagem)}</span></div>` : ""}
      ${c.persona_id ? `<div><label>Persona</label><span>${escapeHtml(c.mc_personas?.nome || c.persona_id)}</span></div>` : ""}
    </div>

    <h2>Conteúdo</h2>
    ${isVideo
      ? roteiroParaHtml(c.roteiro_completo || "")
      : `
        ${c.headline_principal ? `<p><b>Headline:</b> ${escapeHtml(c.headline_principal)}</p>` : ""}
        ${c.subheadline ? `<p><b>Subheadline:</b> ${escapeHtml(c.subheadline)}</p>` : ""}
        ${c.descricao_visual ? `<p><b>Visual:</b> ${escapeHtml(c.descricao_visual)}</p>` : ""}
        ${c.elementos_visuais ? `<p><b>Elementos:</b> ${escapeHtml(c.elementos_visuais)}</p>` : ""}
        ${c.texto_cta_imagem ? `<p><b>CTA:</b> ${escapeHtml(c.texto_cta_imagem)}</p>` : ""}
      `}

    ${(c.dor_texto || c.solucao_texto || c.beneficio_texto) ? `
      <h2>DSB — Dor / Solução / Benefício</h2>
      ${c.dor_texto ? `<div class="dsb dor"><b>DOR</b>${escapeHtml(c.dor_texto)}</div>` : ""}
      ${c.solucao_texto ? `<div class="dsb sol"><b>SOLUÇÃO</b>${escapeHtml(c.solucao_texto)}</div>` : ""}
      ${c.beneficio_texto ? `<div class="dsb ben"><b>BENEFÍCIO</b>${escapeHtml(c.beneficio_texto)}</div>` : ""}
    ` : ""}

    ${c.referencia_estetica ? `<h2>Referência Estética</h2><p>${escapeHtml(c.referencia_estetica)}</p>` : ""}
    ${obs.length ? `<h2>Observações de Produção</h2><ul>${obs.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul>` : ""}

    <h2>Checklist da Equipe de Criação</h2>
    <ul class="checklist">
      <li>Briefing lido e compreendido</li>
      <li>Referências visuais coletadas</li>
      <li>Locação / setup definido</li>
      <li>Figurino e produto preparados</li>
      <li>Gravação / captura realizada</li>
      <li>Edição finalizada conforme roteiro</li>
      <li>Revisão de copy (headline, CTA, legendas)</li>
      <li>Aprovação interna</li>
      <li>Publicado / agendado</li>
    </ul>

    <div class="footer">
      <span>Mariana Cardoso — Matriz Criativa</span>
      <span>Impresso em ${new Date().toLocaleString("pt-BR")}</span>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
  </body></html>`;
  win.document.write(html);
  win.document.close();
}

function CriativoModal({
  criativo, onClose,
  onAprovar, onEmProducao, onRegenerar, onExcluir,
  regenerando,
}: any) {
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  if (!criativo) return null;
  const isVideo = /video|reels/i.test(criativo.formato || "");
  return (
    <Dialog open={!!criativo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif">{criativo.titulo}</DialogTitle>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {criativo.pilar && <Badge className={pilarColor(criativo.pilar)}>{pilarLabel(criativo.pilar)}</Badge>}
            {criativo.formato && <Badge variant="outline">{criativo.formato}</Badge>}
            {criativo.etapa_funil && <Badge variant="secondary">{criativo.etapa_funil}</Badge>}
            {criativo.status && <Badge className={STATUS_COLORS[criativo.status] ?? ""}>{criativo.status}</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {criativo.html_briefing_url && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" className="bg-[#8B6914] hover:bg-[#6d520f] text-white" onClick={() => window.open(criativo.html_briefing_url, "_blank")}>
                      <FileText className="h-4 w-4 mr-1" /> 📄 Abrir Briefing Completo
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Abre o guia completo para o time de produção</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {criativo.html_briefing_gerado_em && (
              <Badge variant="outline" className="text-[10px]">
                Briefing gerado · {new Date(criativo.html_briefing_gerado_em).toLocaleDateString("pt-BR")}
              </Badge>
            )}
          </div>
        </DialogHeader>
        <Tabs defaultValue="conteudo">
          <TabsList>
            <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
            <TabsTrigger value="producao">Produção</TabsTrigger>
            <TabsTrigger value="dsb">DSB</TabsTrigger>
          </TabsList>
          <TabsContent value="conteudo" className="space-y-4">
            {isVideo ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-serif font-semibold">{criativo.titulo}</h3>
                  {criativo.duracao_estimada_seg != null && (
                    <Badge variant="outline" className="text-xs">
                      ⏱ {criativo.duracao_estimada_seg}s
                    </Badge>
                  )}
                </div>
                {criativo.roteiro_hook && (
                  <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                      🎯 HOOK
                    </p>
                    <p className="text-sm font-medium">{criativo.roteiro_hook}</p>
                  </div>
                )}
                <RoteiroVideo texto={criativo.roteiro_completo || ""} />
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {criativo.headline_principal && (
                  <h3 className="text-xl font-serif font-semibold leading-tight">{criativo.headline_principal}</h3>
                )}
                {criativo.subheadline && <p className="text-base text-muted-foreground">{criativo.subheadline}</p>}
                {criativo.descricao_visual && <p><strong>Visual:</strong> {criativo.descricao_visual}</p>}
                {criativo.elementos_visuais && <p><strong>Elementos:</strong> {criativo.elementos_visuais}</p>}
                {criativo.texto_cta_imagem && (
                  <div className="rounded border-l-4 border-primary bg-primary/5 p-2">
                    <strong>CTA:</strong> {criativo.texto_cta_imagem}
                  </div>
                )}
                {/carrossel/i.test(criativo.formato || "") && criativo.slides_carrossel && (
                  <div className="space-y-2 pt-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Slides</p>
                    {String(criativo.slides_carrossel)
                      .split(/\n\s*\n|\[SLIDE\s*\d+|SLIDE\s*\d+\s*[-–:]/i)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((slide, i) => (
                        <div key={i} className="rounded border p-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Slide {i + 1}</span>
                          <p className="text-sm mt-1 whitespace-pre-wrap">{slide}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="producao" className="space-y-3 text-sm">
            {criativo.referencia_estetica && (
              <Card><CardContent className="p-3"><strong>Referência Estética:</strong> {criativo.referencia_estetica}</CardContent></Card>
            )}
            {criativo.observacoes_producao && (
              <div className="space-y-2">
                {(() => {
                  const text = String(criativo.observacoes_producao || "");
                  const labelMap: Record<string, string> = {
                    local: "📍",
                    iluminacao: "💡",
                    roupa: "👗",
                    "cabelo e maquiagem": "💄",
                    equipamento: "🎥",
                    "cuidados com a peca": "✋",
                    "cuidados com a peça": "✋",
                    "tom de atuacao": "🎭",
                    "tom de atuação": "🎭",
                    "duracao por cena": "⏱️",
                    "duração por cena": "⏱️",
                  };
                  const regex = /^([A-ZÀ-Ú\s]+):\s*(.*)$/gim;
                  const matches: { label: string; content: string; icon: string }[] = [];
                  let m;
                  while ((m = regex.exec(text)) !== null) {
                    const rawLabel = m[1].trim();
                    const content = m[2].trim();
                    const key = rawLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const icon = labelMap[key] || "•";
                    matches.push({ label: rawLabel, content, icon });
                  }
                  if (matches.length === 0) {
                    return text.split("\n").filter(Boolean).map((o, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="mt-0.5">•</span>
                        <span className="text-muted-foreground">{o}</span>
                      </div>
                    ));
                  }
                  return matches.map((item, i) => (
                    <div key={i} className="rounded border p-3 bg-[#FFF8E8]/50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{item.icon}</span>
                        <span className="font-bold text-[13px] uppercase tracking-wide text-primary">{item.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
                    </div>
                  ));
                })()}
              </div>
            )}
            {criativo.tom_mensagem && <Badge>{criativo.tom_mensagem}</Badge>}
          </TabsContent>
          <TabsContent value="dsb" className="space-y-3">
            <div className="rounded p-4 bg-red-500/10 border-l-4 border-red-500">
              <p className="font-bold text-red-600 mb-1">DOR</p>
              <p className="text-sm">{criativo.dor_texto}</p>
            </div>
            <div className="rounded p-4 bg-blue-500/10 border-l-4 border-blue-500">
              <p className="font-bold text-blue-600 mb-1">SOLUÇÃO</p>
              <p className="text-sm">{criativo.solucao_texto}</p>
            </div>
            <div className="rounded p-4 bg-green-500/10 border-l-4 border-green-500">
              <p className="font-bold text-green-600 mb-1">BENEFÍCIO</p>
              <p className="text-sm">{criativo.beneficio_texto}</p>
            </div>
          </TabsContent>
        </Tabs>
        <ImagemMetaAds criativo={criativo} />
        <DialogFooter className="flex-wrap gap-2">
          <Button onClick={onAprovar} disabled={regenerando}>
            <Check className="h-4 w-4" /> Aprovar
          </Button>
          <Button variant="secondary" onClick={onEmProducao} disabled={regenerando}>
            <Play className="h-4 w-4" /> Em Produção
          </Button>
          <Button variant="outline" onClick={() => setConfirmRegen(true)} disabled={regenerando}>
            {regenerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            Regenerar com IA
          </Button>
          <Button variant="outline" onClick={() => imprimirCriativo(criativo)}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button variant="destructive" onClick={() => setConfirmDel(true)} disabled={regenerando}>
            <Trash2 className="h-4 w-4" /> Reprovar e Excluir
          </Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerar criativo?</AlertDialogTitle>
            <AlertDialogDescription>
              Vamos gerar um novo criativo com os mesmos parâmetros (produto, persona, pilar, formato, etapa, tipo). O criativo atual será substituído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { setConfirmRegen(false); await onRegenerar?.(); }}>
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>O criativo será excluído permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { setConfirmDel(false); await onExcluir?.(); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA BIBLIOTECA
// ─────────────────────────────────────────────────────────────
function AbaBiblioteca() {
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<any | null>(null);

  const [fProduto, setFProduto] = useState("__all__");
  const [fPersona, setFPersona] = useState("__all__");
  const [fPilar, setFPilar] = useState("__all__");
  const [fFormato, setFFormato] = useState("__all__");
  const [fStatus, setFStatus] = useState("__all__");

  const [regenerandoId, setRegenerandoId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [c, p, pr] = await Promise.all([
      sb.from("mc_criativos").select("*").order("created_at", { ascending: false }),
      sb.from("mc_personas").select("id, nome, emoji"),
      sb.from("mc_produtos_marca").select("id, nome"),
    ]);
    if (c.error) toast({ title: "Erro ao carregar criativos", description: c.error.message, variant: "destructive" });
    const personasArr = p.data || [];
    const lista = (c.data || []).map((it: any) => {
      const pers = personasArr.find((x: any) => x.id === it.persona_id);
      return { ...it, mc_personas: pers ? { nome: pers.nome, emoji: pers.emoji } : null };
    });
    setList(lista);
    setPersonas(personasArr);
    setProdutos(pr.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = list.filter((c) =>
    (fProduto === "__all__" || c.produto_id === fProduto) &&
    (fPersona === "__all__" || c.persona_id === fPersona) &&
    (fPilar === "__all__" || c.pilar === fPilar) &&
    (fFormato === "__all__" || c.formato === fFormato) &&
    (fStatus === "__all__" || c.status === fStatus)
  );

  async function setStatus(id: string, status: string) {
    const { error } = await sb.from("mc_criativos").update({ status }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setList((l) => l.map((c) => (c.id === id ? { ...c, status } : c)));
    setModal((m: any) => (m && m.id === id ? { ...m, status } : m));
    toast({ title: status === "aprovado" ? "Criativo aprovado!" : `Status: ${status}` });
  }

  async function excluir(id: string) {
    const { error } = await sb.from("mc_criativos").delete().eq("id", id);
    if (error) return toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    setList((l) => l.filter((c) => c.id !== id));
    setModal((m: any) => (m && m.id === id ? null : m));
    toast({ title: "Criativo removido" });
  }

  async function regenerar(c: any) {
    if (!c?.id) return;
    setRegenerandoId(c.id);
    try {
      const novo = await regerarCriativo(c);
      if (!novo) throw new Error("Nada retornado");
      const pers = personas.find((x: any) => x.id === novo.persona_id);
      const novoEnriquecido = { ...novo, mc_personas: pers ? { nome: pers.nome, emoji: pers.emoji } : null };
      setList((l) => l.map((x) => (x.id === c.id ? novoEnriquecido : x)));
      setModal((m: any) => (m && m.id === c.id ? novoEnriquecido : m));
      toast({ title: "Criativo regenerado" });
    } catch (e: any) {
      toast({ title: "Erro ao regenerar", description: e.message, variant: "destructive" });
    } finally {
      setRegenerandoId(null);
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Select value={fProduto} onValueChange={setFProduto}>
          <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos produtos</SelectItem>
            {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPersona} onValueChange={setFPersona}>
          <SelectTrigger><SelectValue placeholder="Persona" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas personas</SelectItem>
            {personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPilar} onValueChange={setFPilar}>
          <SelectTrigger><SelectValue placeholder="Pilar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos pilares</SelectItem>
            {PILARES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fFormato} onValueChange={setFFormato}>
          <SelectTrigger><SelectValue placeholder="Formato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos formatos</SelectItem>
            {FORMATOS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos status</SelectItem>
            {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground text-sm">
          Nenhum criativo encontrado.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const produto = produtos.find((p) => p.id === c.produto_id);
            return (
              <Card key={c.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {c.pilar && <Badge className={pilarColor(c.pilar)}>{pilarLabel(c.pilar)}</Badge>}
                    {c.formato && <Badge variant="outline">{c.formato}</Badge>}
                    <Badge className={STATUS_COLORS[c.status] ?? ""}>{c.status}</Badge>
                  </div>
                  <h3 className="font-semibold">{c.titulo}</h3>
                  <p className="text-xs text-muted-foreground">
                    {c.mc_personas?.emoji} {c.mc_personas?.nome}
                    {produto && <> · {produto.nome}</>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.created_at && new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setModal(c)}>Ver</Button>
                    {c.html_briefing_url && (
                      <Button size="sm" variant="outline" onClick={() => window.open(c.html_briefing_url, "_blank")}>
                        <FileText className="h-3 w-3 mr-1" /> 📄 Ver Briefing
                      </Button>
                    )}
                    <Select value={c.status} onValueChange={(v) => setStatus(c.id, v)}>
                      <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CriativoModal
        criativo={modal}
        onClose={() => setModal(null)}
        regenerando={modal && regenerandoId === modal.id}
        onAprovar={async () => { if (modal?.id) { await setStatus(modal.id, "aprovado"); setModal(null); } }}
        onEmProducao={async () => { if (modal?.id) await setStatus(modal.id, "em_producao"); }}
        onRegenerar={async () => { if (modal) await regenerar(modal); }}
        onExcluir={async () => { if (modal?.id) { await excluir(modal.id); setModal(null); } }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA PERSONAS
// ─────────────────────────────────────────────────────────────
function AbaPersonas() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("mc_personas").select("*").order("nome");
      setPersonas(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {personas.map((p) => (
        <Card key={p.id}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-4xl">{p.emoji}</div>
                <h3 className="font-serif text-xl mt-1">{p.nome}</h3>
              </div>
              <Badge variant="outline">{p.faixa_etaria}</Badge>
            </div>
            {p.perfil_vida && <p className="text-xs italic text-muted-foreground">{p.perfil_vida}</p>}
            {p.motivacao && (
              <div className="text-sm flex gap-2">
                <Heart className="h-4 w-4 text-pink-500 shrink-0 mt-0.5" />
                <p><strong>Motivação:</strong> {p.motivacao}</p>
              </div>
            )}
            {p.objecao && (
              <div className="text-sm flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p><strong>Objeção:</strong> {p.objecao}</p>
              </div>
            )}
            {(p.pilar_abre || p.pilar_fecha) && (
              <p className="text-xs"><strong>Como chegar nela:</strong> {p.pilar_abre} → {p.pilar_fecha}</p>
            )}
            {p.mensagem_principal && (
              <blockquote className="border-l-2 border-primary pl-3 italic text-sm text-foreground/80">
                "{p.mensagem_principal}"
              </blockquote>
            )}
            {p.etapa_funil && <Badge>{p.etapa_funil}</Badge>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABA MODELOS — Biblioteca de modelos da marca
// ─────────────────────────────────────────────────────────────
const CATEGORIAS_MODELO = [
  { id: "todos", label: "Todos" },
  { id: "calcas", label: "Calças" },
  { id: "blusas", label: "Blusas" },
  { id: "vestidos", label: "Vestidos" },
  { id: "conjuntos", label: "Conjuntos" },
];

function AbaModelos() {
  const { toast } = useToast();
  const [modelos, setModelos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [adequada, setAdequada] = useState<string[]>(["todos"]);
  const [faixa, setFaixa] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoEstudio, setFotoEstudio] = useState<File | null>(null);
  const [fotoEstudioPreview, setFotoEstudioPreview] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    const { data } = await sb
      .from("mc_modelos")
      .select("*")
      .order("created_at", { ascending: false });
    setModelos(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); }, []);

  function handleFoto(setFile: any, setPrev: any, max = 10) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > max * 1024 * 1024) {
        toast({ title: `Imagem maior que ${max}MB`, variant: "destructive" });
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        toast({ title: "Formato inválido (use JPG, PNG ou WEBP)", variant: "destructive" });
        return;
      }
      setFile(f);
      const reader = new FileReader();
      reader.onload = (ev) => setPrev(ev.target?.result as string);
      reader.readAsDataURL(f);
    };
  }

  function toggleCategoria(id: string) {
    setAdequada((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function limparForm() {
    setNome(""); setDescricao(""); setAdequada(["todos"]); setFaixa("");
    setFoto(null); setFotoPreview(null);
    setFotoEstudio(null); setFotoEstudioPreview(null);
  }

  async function uploadFoto(file: File): Promise<string> {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from("modelos-marca").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("modelos-marca").getPublicUrl(path);
    return data.publicUrl;
  }

  async function salvar() {
    if (!nome.trim()) { toast({ title: "Informe o nome da modelo", variant: "destructive" }); return; }
    if (!foto) { toast({ title: "Foto principal é obrigatória", variant: "destructive" }); return; }
    if (adequada.length === 0) { toast({ title: "Selecione ao menos uma categoria", variant: "destructive" }); return; }
    setSalvando(true);
    try {
      const foto_url = await uploadFoto(foto);
      let foto_estudio_url: string | null = null;
      if (fotoEstudio) foto_estudio_url = await uploadFoto(fotoEstudio);

      const { error } = await sb.from("mc_modelos").insert({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        foto_url,
        foto_estudio_url,
        adequada_para: adequada,
        faixa_etaria: faixa.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Modelo salva com sucesso!" });
      limparForm();
      carregar();
    } catch (e: any) {
      toast({ title: "Erro ao salvar modelo", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtiva(m: any) {
    const { error } = await sb.from("mc_modelos").update({ ativa: !m.ativa }).eq("id", m.id);
    if (error) { toast({ title: "Erro ao atualizar", variant: "destructive" }); return; }
    setModelos((prev) => prev.map((x) => x.id === m.id ? { ...x, ativa: !m.ativa } : x));
  }

  async function excluir(id: string) {
    const { error } = await sb.from("mc_modelos").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", variant: "destructive" }); return; }
    setExcluirId(null);
    setModelos((prev) => prev.filter((x) => x.id !== id));
    toast({ title: "Modelo excluída" });
  }

  return (
    <div className="space-y-6 mt-4">
      {/* SEÇÃO 1 — Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Cadastrar nova modelo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da Modelo *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Ana Paula" />
            </div>
            <div className="space-y-2">
              <Label>Faixa Etária</Label>
              <Input value={faixa} onChange={(e) => setFaixa(e.target.value)} placeholder="Ex: 35-45 anos" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Modelo loira, 40 anos, estilo executivo"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Adequada para</Label>
            <div className="flex flex-wrap gap-3">
              {CATEGORIAS_MODELO.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={adequada.includes(c.id)}
                    onCheckedChange={() => toggleCategoria(c.id)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Foto principal * (máx 10MB)</Label>
              <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFoto(setFoto, setFotoPreview)} />
              {fotoPreview && (
                <img src={fotoPreview} alt="Preview" className="rounded-md border max-h-48 object-cover" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Foto em fundo branco (opcional — melhora resultado no estúdio)</Label>
              <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFoto(setFotoEstudio, setFotoEstudioPreview)} />
              {fotoEstudioPreview && (
                <img src={fotoEstudioPreview} alt="Preview estúdio" className="rounded-md border max-h-48 object-cover" />
              )}
            </div>
          </div>

          <Button onClick={salvar} disabled={salvando} className="w-full md:w-auto">
            {salvando ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Salvando...</> : "Salvar Modelo"}
          </Button>
        </CardContent>
      </Card>

      {/* SEÇÃO 2 — Grid */}
      <div>
        <h2 className="font-serif text-xl mb-3">Modelos cadastradas</h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-80" />)}
          </div>
        ) : modelos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma modelo cadastrada ainda.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {modelos.map((m) => (
              <Card key={m.id} className={m.ativa ? "" : "opacity-60"}>
                <div className="aspect-[3/4] overflow-hidden rounded-t-lg bg-muted">
                  {m.foto_url && (
                    <img src={m.foto_url} alt={m.nome} className="w-full h-full object-cover" />
                  )}
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm">{m.nome}</h3>
                    {m.faixa_etaria && <Badge variant="outline" className="text-[10px]">{m.faixa_etaria}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(m.adequada_para || []).map((c: string) => (
                      <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                    ))}
                  </div>
                  {m.descricao && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{m.descricao}</p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Switch checked={m.ativa} onCheckedChange={() => toggleAtiva(m)} />
                      {m.ativa ? "Ativa" : "Inativa"}
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExcluirId(m.id)}
                      className="text-destructive h-7 px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!excluirId} onOpenChange={(v) => !v && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A modelo será removida da biblioteca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluirId && excluir(excluirId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
