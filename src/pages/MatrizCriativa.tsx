import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Loader2, Heart, AlertTriangle, Sparkles, RotateCw, Trash2, Check, Play } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

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

const FORMATOS = ["Reels", "Vídeo", "Imagem / Banner", "Story", "Carrossel"];
const ETAPAS = ["Inconsciente", "Problema", "Solução", "Produto", "Compra"];

const TIPOS_CONTEUDO = [
  {
    id: "produto_direto",
    label: "📦 Produto Direto",
    desc: "Ideal para conversão — quem já está considerando comprar",
    requireProduto: true,
  },
  {
    id: "cotidiano_persona",
    label: "🌸 Cotidiano da Persona",
    desc: "Ideal para descoberta — para quem ainda não conhece a marca",
    requireProduto: false,
  },
  {
    id: "universo_valores",
    label: "💜 Universo & Valores",
    desc: "Ideal para viralização — constrói identificação e pertencimento",
    requireProduto: false,
  },
];

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
        </TabsList>
        <TabsContent value="gerar"><AbaGerar /></TabsContent>
        <TabsContent value="biblioteca"><AbaBiblioteca /></TabsContent>
        <TabsContent value="personas"><AbaPersonas /></TabsContent>
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
  const [tipoConteudo, setTipoConteudo] = useState<string>("");
  const [pilares, setPilares] = useState<string[]>([]);
  const [formatos, setFormatos] = useState<string[]>([]);
  const [etapaFunil, setEtapaFunil] = useState<string>("");

  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<any[] | null>(null);
  const [modal, setModal] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, ps] = await Promise.all([
          sb.from("mc_produtos_marca").select("*").eq("ativo", true).order("nome"),
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
  const tipo = useMemo(() => TIPOS_CONTEUDO.find((t) => t.id === tipoConteudo), [tipoConteudo]);
  const produtoObrigatorio = tipo?.requireProduto ?? true;

  function togglePilar(id: string) {
    setPilares((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function toggleFormato(f: string) {
    setFormatos((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));
  }

  async function gerar() {
    if (!personaId) return toast({ title: "Selecione a Persona", variant: "destructive" });
    const produtoNome = usarManual
      ? produtoManual.trim()
      : produtos.find((p) => p.id === produtoId)?.nome ?? "";
    if (produtoObrigatorio && !produtoNome) {
      return toast({ title: "Selecione ou digite o Produto", variant: "destructive" });
    }
    if (pilares.length === 0) return toast({ title: "Escolha ao menos 1 pilar", variant: "destructive" });
    if (formatos.length === 0) return toast({ title: "Escolha ao menos 1 formato", variant: "destructive" });

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
            produto_id: usarManual ? null : produtoId || null,
            persona_id: personaId,
            pilares,
            formatos,
            etapa_funil: etapaFunil || null,
            tipo_conteudo: tipoConteudo || null,
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
            <Label>Produto / Categoria {!produtoObrigatorio && <span className="text-xs text-muted-foreground">(opcional)</span>}</Label>
            {!usarManual ? (
              <Select value={produtoId} onValueChange={(v) => {
                if (v === "__manual__") { setUsarManual(true); setProdutoId(""); }
                else setProdutoId(v);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={produtoObrigatorio ? "Selecione um produto" : "Opcional — a IA vai usar o contexto da marca"} />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {p.nome}
                        {p.eh_bestseller && <Badge className="bg-amber-500 text-white text-[10px]">Best Seller</Badge>}
                        {p.eh_lancamento && <Badge className="bg-pink-500 text-white text-[10px]">Lançamento</Badge>}
                      </span>
                    </SelectItem>
                  ))}
                  <SelectItem value="__manual__">✍️ Digitar produto manualmente</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder={produtoObrigatorio ? "Nome do produto" : "Opcional"}
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

          {/* Tipo de Conteúdo */}
          <div className="space-y-2">
            <Label>Tipo de Conteúdo</Label>
            <Select value={tipoConteudo} onValueChange={setTipoConteudo}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                {TIPOS_CONTEUDO.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tipo && (
              <p className="text-xs text-muted-foreground italic">{tipo.desc}</p>
            )}
          </div>

          {/* Pilares */}
          <div className="space-y-2">
            <Label>Pilares Criativos *</Label>
            <div className="space-y-1.5">
              {PILARES.map((p) => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={pilares.includes(p.id)} onCheckedChange={() => togglePilar(p.id)} />
                  <Badge className={p.color}>{p.label}</Badge>
                </label>
              ))}
            </div>
          </div>

          {/* Formatos */}
          <div className="space-y-2">
            <Label>Formatos *</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {FORMATOS.map((f) => (
                <label key={f} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={formatos.includes(f)} onCheckedChange={() => toggleFormato(f)} />
                  <span>{f}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Funil */}
          <div className="space-y-2">
            <Label>Etapa do Funil</Label>
            <Select value={etapaFunil} onValueChange={setEtapaFunil}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {ETAPAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
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
              {(produtoId || produtoManual) && <> · {usarManual ? produtoManual : produtos.find((p) => p.id === produtoId)?.nome}</>}
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
      />
    </div>
  );
}

function CriativoCard({ c, onOpen, onAprovar }: any) {
  const preview = (c.roteiro_hook || c.headline_principal || "").split("\n").slice(0, 2).join(" ");
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {c.pilar && <Badge className={pilarColor(c.pilar)}>{pilarLabel(c.pilar)}</Badge>}
          {c.formato && <Badge variant="outline">{c.formato}</Badge>}
          {c.etapa_funil && <Badge variant="secondary">{c.etapa_funil}</Badge>}
        </div>
        <h3 className="font-semibold text-base">{c.titulo}</h3>
        {c.angulo && <p className="text-xs text-muted-foreground"><strong>Ângulo:</strong> {c.angulo}</p>}
        {c.tom_mensagem && <p className="text-xs text-muted-foreground"><strong>Tom:</strong> {c.tom_mensagem}</p>}
        {preview && <p className="text-sm line-clamp-2 text-foreground/80">{preview}</p>}
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onOpen}>Ver Completo</Button>
          <Button size="sm" onClick={onAprovar}>Aprovar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function parseRoteiroVideo(texto: string) {
  const cenas: { numero: string; tempo: string; camera: string; fala: string; visual: string }[] = [];
  const t = texto.replace(/\r/g, "\n");
  // Match each scene block: [CENA N - ...] or CENA N - ...
  const regex = /(?:\[?\s*CENA\s*(\d+)[^\]]*\]?)\s*(.*?)(?=(?:\[?\s*CENA\s*\d+)|$)/gsi;
  let m;
  while ((m = regex.exec(t)) !== null) {
    const numero = m[1];
    const corpo = m[2].trim();
    const tempoMatch = corpo.match(/(\d+\s*s?\s*(?:a|–|-)\s*\d+\s*s?)/i) || corpo.match(/(\d+\s*s?\s*[-–—]\s*\d+\s*s?)/i);
    const tempo = tempoMatch ? tempoMatch[1].trim() : "";
    const camMatch = corpo.match(/C[ÂA]MERA:\s*(.*?)(?=\||FALA:|VISUAL:|$)/i);
    const camera = camMatch ? camMatch[1].trim() : "";
    const falaMatch = corpo.match(/FALA:\s*(.*?)(?=\||VISUAL:|$)/i);
    const fala = falaMatch ? falaMatch[1].trim() : "";
    const visMatch = corpo.match(/VISUAL:\s*(.*?)(?=\||$)/i);
    const visual = visMatch ? visMatch[1].trim() : "";
    if (numero) cenas.push({ numero, tempo, camera, fala, visual });
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
  return (
    <div className="space-y-4">
      {cenas.map((cena, idx) => (
        <div key={cena.numero}>
          {idx > 0 && <Separator className="my-4 bg-border/40" />}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="bg-primary/10 px-3 py-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                CENA {cena.numero}
              </span>
              {cena.tempo && (
                <span className="text-[11px] text-muted-foreground">
                  • {cena.tempo}
                </span>
              )}
            </div>
            <div className="p-3 space-y-2 text-sm">
              {cena.camera && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                    CÂMERA
                  </span>
                  <p className="text-foreground/90">{cena.camera}</p>
                </div>
              )}
              {cena.fala && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-green-600">
                    FALA
                  </span>
                  <p className="text-foreground/90 italic">
                    "{cena.fala.replace(/^"/, "").replace(/"$/, "")}"
                  </p>
                </div>
              )}
              {cena.visual && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                    VISUAL
                  </span>
                  <p className="text-foreground/90">{cena.visual}</p>
                </div>
              )}
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

function ImagemMetaAds({ criativo }: { criativo: any }) {
  const { toast } = useToast();
  const [formato, setFormato] = useState("feed_retrato");
  const [loading, setLoading] = useState(false);
  const [imagemUrl, setImagemUrl] = useState<string | null>(criativo.imagem_gerada_url || null);
  const [status, setStatus] = useState<string | null>(criativo.imagem_gerada_status || null);

  useEffect(() => {
    setImagemUrl(criativo.imagem_gerada_url || null);
    setStatus(criativo.imagem_gerada_status || null);
  }, [criativo.id, criativo.imagem_gerada_url, criativo.imagem_gerada_status]);

  async function gerar() {
    setLoading(true);
    try {
      const res = await fetch(
        "https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/gerar-imagem-criativo",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            criativo_id: criativo.id,
            produto_id: criativo.produto_id,
            formato_anuncio: formato,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.erro || data?.error || `Erro ${res.status}`);
      setImagemUrl(data.imagem_gerada_url || data.url || null);
      setStatus(data.imagem_gerada_status || "gerada");
      toast({ title: "Imagem gerada com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar imagem", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

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

      <Button
        onClick={gerar}
        disabled={loading}
        className="bg-purple-600 hover:bg-purple-700 text-white w-full"
      >
        {loading ? (
          <><Loader2 className="animate-spin" /> Gerando imagem com fal.ai...</>
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
          {criativo.imagem_produto_url && (
            <div className="flex items-center gap-3">
              <img
                src={criativo.imagem_produto_url}
                alt="Referência original"
                className="w-20 h-20 object-cover rounded border"
              />
              <span className="text-xs text-muted-foreground">Referência original</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(imagemUrl, "_blank")}>
              Download
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CriativoModal({ criativo, onClose, onAction }: any) {
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
          </div>
        </DialogHeader>
        <Tabs defaultValue="conteudo">
          <TabsList>
            <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
            <TabsTrigger value="producao">Produção</TabsTrigger>
            <TabsTrigger value="dsb">DSB</TabsTrigger>
          </TabsList>
          <TabsContent value="conteudo" className="space-y-3">
            {isVideo ? (
              <RoteiroVideo texto={criativo.roteiro_completo || ""} />
            ) : (
              <div className="space-y-2 text-sm">
                {criativo.headline_principal && <p><strong>Headline:</strong> {criativo.headline_principal}</p>}
                {criativo.subheadline && <p><strong>Subheadline:</strong> {criativo.subheadline}</p>}
                {criativo.descricao_visual && <p><strong>Visual:</strong> {criativo.descricao_visual}</p>}
                {criativo.elementos_visuais && <p><strong>Elementos:</strong> {criativo.elementos_visuais}</p>}
                {criativo.texto_cta_imagem && <p><strong>CTA:</strong> {criativo.texto_cta_imagem}</p>}
              </div>
            )}
          </TabsContent>
          <TabsContent value="producao" className="space-y-3 text-sm">
            {criativo.referencia_estetica && (
              <Card><CardContent className="p-3"><strong>Referência Estética:</strong> {criativo.referencia_estetica}</CardContent></Card>
            )}
            {criativo.observacoes_producao && (
              <ul className="list-disc pl-5 space-y-1">
                {String(criativo.observacoes_producao).split("\n").filter(Boolean).map((o, i) => <li key={i}>{o}</li>)}
              </ul>
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
        <DialogFooter>
          <Button onClick={() => onAction("aprovado")}>Aprovar</Button>
          <Button variant="secondary" onClick={() => onAction("em_producao")}>Em Produção</Button>
          <Button variant="outline" onClick={() => onAction("arquivado")}>Arquivar</Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
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

  async function load() {
    setLoading(true);
    const [c, p, pr] = await Promise.all([
      sb.from("mc_criativos").select("*, mc_personas(nome, emoji)").order("created_at", { ascending: false }),
      sb.from("mc_personas").select("id, nome"),
      sb.from("mc_produtos_marca").select("id, nome"),
    ]);
    setList(c.data || []);
    setPersonas(p.data || []);
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
    await sb.from("mc_criativos").update({ status }).eq("id", id);
    setList((l) => l.map((c) => (c.id === id ? { ...c, status } : c)));
    toast({ title: "Status atualizado" });
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

      <CriativoModal criativo={modal} onClose={() => setModal(null)} onAction={async (status: string) => {
        if (modal?.id) await setStatus(modal.id, status);
        setModal(null);
      }} />
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
