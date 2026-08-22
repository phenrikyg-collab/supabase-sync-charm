import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/socialCommerce";
import { lerErroEdge } from "@/lib/edgeError";
import { CampoTags, dataHoraBR } from "./comum";
import { SeletorProdutos, carregarProdutosPai, type ProdutoPai } from "./SeletorProdutos";
import { BotaoGerarRespostas } from "./BotaoGerarRespostas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Eye, List, Loader2,
  Plus, Sparkles, Upload, Zap, ZapOff,
} from "lucide-react";

type Publicacao = {
  id?: string | number;
  tipo?: string | null;
  midia_urls?: string[] | null;
  legenda?: string | null;
  primeiro_comentario?: string | null;
  agendado_para?: string | null;
  status?: string | null;
  produto_ids?: string[] | null;
  erro?: string | null;
  modo_resposta?: string | null;
  palavras_gatilho?: string[] | null;
  resposta_gatilho_publica?: string | null;
  resposta_gatilho_dm?: string | null;
  texto_grupo_vip?: string | null;
};



const TIPOS = ["IMAGE", "REELS", "CAROUSEL", "STORIES"];
const LIMITE_LEGENDA = 2200;
const LIMITE_RESPOSTA_PUBLICA = 280;
const BUCKET = "instagram-midia";

const STATUS_COR: Record<string, string> = {
  agendado: "bg-primary/15 text-primary border-primary/30",
  publicado: "bg-success/10 text-success border-success/20",
  falhou: "bg-danger/10 text-danger border-danger/20",
  rascunho: "bg-muted text-muted-foreground border-border",
  publicando: "bg-warning/10 text-warning border-warning/20",
};

function chipStatus(status?: string | null) {
  const s = (status ?? "rascunho").toLowerCase();
  return STATUS_COR[s] ?? STATUS_COR.rascunho;
}

function diaKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function uploadMidia(file: File): Promise<string> {
  const nomeSeguro = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `publicacoes/${Date.now()}_${nomeSeguro}`;
  let { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error && /bucket/i.test(error.message ?? "")) {
    // Bucket pode não existir ainda — tenta criar e refaz o upload
    try {
      await (supabase.storage as any).createBucket(BUCKET, { public: true });
    } catch {
      /* sem permissão ou já existe — o retry abaixo resolve se existir */
    }
    const retry = await supabase.storage.from(BUCKET).upload(path, file);
    if (retry.error) throw retry.error;
  } else if (error) {
    throw error;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

type FormState = {
  tipo: string;
  legenda: string;
  primeiroComentario: string;
  textoGrupoVip: string;
  agendadoPara: string; // datetime-local
  produtoIds: string[];
  modoResposta: "sombra" | "automatico" | "desligado";
  gatilhos: string[];
  respostaPublica: string;
  respostaDm: string;
};

const FORM_VAZIO: FormState = {
  tipo: "IMAGE",
  legenda: "",
  primeiroComentario: "",
  textoGrupoVip: "",
  agendadoPara: "",
  produtoIds: [],
  modoResposta: "sombra",
  gatilhos: [],
  respostaPublica: "Te mandei no Direct 💛",
  respostaDm: "",
};

const MODOS = [
  {
    valor: "sombra",
    titulo: "Modo sombra",
    descricao: "A Anna redige, a equipe aprova antes de enviar",
    icone: Eye,
  },
  {
    valor: "automatico",
    titulo: "Automático",
    descricao: "A Anna responde sozinha, sem aprovação",
    icone: Zap,
  },
  {
    valor: "desligado",
    titulo: "Desligado",
    descricao: "Nenhuma resposta automática neste post",
    icone: ZapOff,
  },
] as const;

const ETAPAS_FUNIL = [
  { valor: "alcance", titulo: "Alcance", descricao: "Ser vista por quem ainda não conhece a marca" },
  { valor: "educacao", titulo: "Educação", descricao: "Ensinar algo e construir autoridade" },
  { valor: "prova_social", titulo: "Prova social", descricao: "Quebrar objeção com evidência" },
  { valor: "oferta", titulo: "Oferta", descricao: "Converter — pode citar preço" },
];

const CTAS = [
  { valor: "comentar_palavra_chave", titulo: "Comentar palavra-chave", descricao: '"Comenta EU QUERO que eu te mando o link"' },
  { valor: "enviar_amiga", titulo: "Enviar para uma amiga", descricao: '"Marca aquela amiga que…"' },
  { valor: "link_na_bio", titulo: "Link na bio", descricao: "Leva ao perfil, ganha seguidor" },
  { valor: "salvar", titulo: "Salvar o post", descricao: "Para conteúdo útil" },
  { valor: "stories", titulo: "Compartilhar nos stories", descricao: "Amplia o alcance do post" },
  { valor: "seguir", titulo: "Seguir o perfil", descricao: "Cresce a base de seguidores" },
];

const ESTILOS = [
  { valor: "trend", titulo: "Trend / áudio do momento" },
  { valor: "tutorial", titulo: "Tutorial / como usar" },
  { valor: "antes_depois", titulo: "Antes e depois / caimento" },
  { valor: "depoimento", titulo: "Depoimento de cliente" },
  { valor: "bastidores", titulo: "Bastidores / ateliê" },
  { valor: "vitrine", titulo: "Vitrine / detalhe da peça" },
  { valor: "storytelling", titulo: "Storytelling / POV" },
  { valor: "look_do_dia", titulo: "Look do dia / get ready" },
  { valor: "comparativo", titulo: "Comparativo entre modelagens" },
];

export function PublicacoesTab() {
  const [visao, setVisao] = useState<"calendario" | "lista">("calendario");
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [produtos, setProdutos] = useState<ProdutoPai[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Publicacao | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [iaFunil, setIaFunil] = useState("alcance");
  const [iaEstilo, setIaEstilo] = useState("trend");
  const [iaCta, setIaCta] = useState("comentar_palavra_chave");
  const [iaContexto, setIaContexto] = useState("");
  const [iaGerando, setIaGerando] = useState(false);
  const [iaRaciocinio, setIaRaciocinio] = useState<string | null>(null);
  const [copiadoVip, setCopiadoVip] = useState(false);
  const [avisoRespostas, setAvisoRespostas] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [{ data: pubs }, prods] = await Promise.all([
      db.from("instagram_publicacoes").select("*").order("agendado_para", { ascending: true }).limit(500),
      carregarProdutosPai().catch((e) => {
        toast.error("Falha ao carregar produtos", { description: e?.message });
        return [] as ProdutoPai[];
      }),
    ]);
    setPublicacoes((pubs ?? []) as Publicacao[]);
    setProdutos(prods);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pubsPorDia = useMemo(() => {
    const m = new Map<string, Publicacao[]>();
    for (const p of publicacoes) {
      if (!p.agendado_para) continue;
      const d = new Date(p.agendado_para);
      if (Number.isNaN(d.getTime())) continue;
      const k = diaKey(d);
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [publicacoes]);

  // Grade do calendário (semanas começando no domingo)
  const celulas = useMemo(() => {
    const primeiro = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1);
    const inicio = new Date(primeiro);
    inicio.setDate(1 - primeiro.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }, [mesRef]);

  const abrirNovo = (dia?: Date) => {
    setEditando(null);
    setArquivos([]);
    setIaContexto("");
    setIaRaciocinio(null);
    setForm({
      ...FORM_VAZIO,
      agendadoPara: dia ? `${diaKey(dia)}T09:00` : "",
    });
    setModalAberto(true);
  };

  const abrirEdicao = (p: Publicacao) => {
    setEditando(p);
    setArquivos([]);
    setIaContexto("");
    setIaRaciocinio(null);
    const d = p.agendado_para ? new Date(p.agendado_para) : null;
    setForm({
      tipo: p.tipo ?? "IMAGE",
      legenda: p.legenda ?? "",
      primeiroComentario: p.primeiro_comentario ?? "",
      textoGrupoVip: p.texto_grupo_vip ?? "",
      agendadoPara:
        d && !Number.isNaN(d.getTime())
          ? `${diaKey(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
          : "",
      produtoIds: p.produto_ids ?? [],
      modoResposta: (p.modo_resposta as FormState["modoResposta"]) ?? "sombra",
      gatilhos: p.palavras_gatilho ?? [],
      respostaPublica: p.resposta_gatilho_publica ?? "",
      respostaDm: p.resposta_gatilho_dm ?? "",
    });
    setModalAberto(true);
  };

  const gerarLegenda = async () => {
    if (iaGerando) return;
    setIaGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-gerar-legenda", {
        body: {
          etapa_funil: iaFunil,
          estilo: iaEstilo,
          cta: iaCta,
          tipo: form.tipo,
          produto_ids: form.produtoIds,
          contexto: iaContexto.trim() || null,
        },
      });
      if (error) {
        const det = await lerErroEdge(error, "Falha ao gerar a legenda. Tente novamente.");
        toast.error(det.mensagem, { description: det.dica });
        return;
      }
      if (!data || data.ok === false || data.erro || data.error) {
        toast.error(data?.detalhe ?? data?.erro ?? data?.error ?? "A IA não devolveu uma legenda.", {
          description: data?.dica,
        });
        return;
      }

      const gatilhos: string[] = Array.isArray(data.palavras_gatilho) ? data.palavras_gatilho : [];
      setForm((f) => ({
        ...f,
        legenda: String(data.legenda ?? "").slice(0, LIMITE_LEGENDA),
        primeiroComentario: String(data.primeiro_comentario ?? ""),
        textoGrupoVip: String(data.texto_grupo_vip ?? f.textoGrupoVip),
        ...(gatilhos.length > 0
          ? {
              modoResposta: "automatico" as const,
              gatilhos,
              respostaPublica: String(data.resposta_gatilho_publica ?? f.respostaPublica).slice(0, LIMITE_RESPOSTA_PUBLICA),
              respostaDm: String(data.resposta_gatilho_dm ?? f.respostaDm),
            }
          : {}),
      }));
      setIaRaciocinio(data.raciocinio ?? null);
      if (gatilhos.length > 0) {
        toast.info("Automação de comentários preenchida — revise antes de salvar.");
      } else {
        toast.success("Legenda gerada — revise e ajuste antes de salvar");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar a legenda");
    } finally {
      setIaGerando(false);
    }
  };

  const copiarTextoVip = async () => {
    try {
      await navigator.clipboard.writeText(form.textoGrupoVip);
      setCopiadoVip(true);
      window.setTimeout(() => setCopiadoVip(false), 2000);
    } catch {
      toast.error("Não foi possível copiar — selecione o texto e copie manualmente.");
    }
  };

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      let midiaUrls = editando?.midia_urls ?? [];
      if (arquivos.length > 0) {
        midiaUrls = await Promise.all(arquivos.map(uploadMidia));
      }

      const payload: Record<string, any> = {
        tipo: form.tipo,
        legenda: form.legenda,
        primeiro_comentario: form.primeiroComentario || null,
        texto_grupo_vip: form.textoGrupoVip || null,
        agendado_para: form.agendadoPara ? new Date(form.agendadoPara).toISOString() : null,
        status: form.agendadoPara ? "agendado" : "rascunho",
        produto_ids: form.produtoIds,
        midia_urls: midiaUrls,
        modo_resposta: form.modoResposta,
        palavras_gatilho: form.modoResposta === "automatico" ? form.gatilhos : [],
        resposta_gatilho_publica: form.modoResposta === "automatico" ? form.respostaPublica : null,
        resposta_gatilho_dm: form.modoResposta === "automatico" ? form.respostaDm : null,
      };

      const executar = async (p: Record<string, any>) =>
        editando?.id != null
          ? db.from("instagram_publicacoes").update(p).eq("id", editando.id)
          : db.from("instagram_publicacoes").insert(p);

      let { error } = await executar(payload);
      // Colunas novas podem ainda não existir no banco — tenta de novo sem elas
      for (const coluna of ["texto_grupo_vip", "primeiro_comentario"]) {
        if (error && new RegExp(coluna, "i").test(error.message ?? "")) {
          delete payload[coluna];
          ({ error } = await executar(payload));
        }
      }
      if (error) throw error;

      toast.success(editando ? "Publicação atualizada" : form.agendadoPara ? "Publicação agendada" : "Rascunho salvo");
      setModalAberto(false);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const mudarMes = (delta: number) => {
    const d = new Date(mesRef);
    d.setMonth(d.getMonth() + delta);
    setMesRef(d);
  };

  const mesLabel = mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <ToggleGroup type="single" value={visao} onValueChange={(v) => v && setVisao(v as any)}>
          <ToggleGroupItem value="calendario" className="gap-1.5">
            <CalendarDays className="h-4 w-4" /> Calendário
          </ToggleGroupItem>
          <ToggleGroupItem value="lista" className="gap-1.5">
            <List className="h-4 w-4" /> Lista
          </ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={() => abrirNovo()}>
          <Plus className="h-4 w-4 mr-1.5" /> Nova publicação
        </Button>
      </div>

      {carregando ? (
        <Skeleton className="h-[480px] w-full" />
      ) : visao === "calendario" ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Button variant="ghost" size="icon" onClick={() => mudarMes(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="font-serif text-lg font-semibold capitalize">{mesLabel}</p>
              <Button variant="ghost" size="icon" onClick={() => mudarMes(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden text-xs">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="bg-muted px-2 py-1.5 text-center font-semibold text-muted-foreground">
                  {d}
                </div>
              ))}
              {celulas.map((d) => {
                const foraDoMes = d.getMonth() !== mesRef.getMonth();
                const pubs = pubsPorDia.get(diaKey(d)) ?? [];
                return (
                  <div
                    key={d.toISOString()}
                    className={`bg-card min-h-[92px] p-1.5 cursor-pointer hover:bg-accent/40 transition-colors ${
                      foraDoMes ? "opacity-35" : ""
                    }`}
                    onClick={() => abrirNovo(d)}
                  >
                    <p className="text-[10px] text-muted-foreground mb-1">{d.getDate()}</p>
                    <div className="space-y-1">
                      {pubs.slice(0, 3).map((p, i) => (
                        <button
                          key={p.id ?? i}
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirEdicao(p);
                          }}
                          className={`w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] font-medium ${chipStatus(p.status)}`}
                        >
                          {p.modo_resposta === "automatico" && <Zap className="inline h-2.5 w-2.5 mr-0.5" />}
                          {p.tipo} · {new Date(p.agendado_para!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </button>
                      ))}
                      {pubs.length > 3 && (
                        <p className="text-[10px] text-muted-foreground px-1">+{pubs.length - 3}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legenda */}
            <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-muted-foreground">
              {Object.entries(STATUS_COR).map(([s, cls]) => (
                <span key={s} className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${cls}`}>
                  {s}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {publicacoes.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhuma publicação agendada. Clique em "Nova publicação" ou em um dia do calendário.
              </CardContent>
            </Card>
          ) : (
            [...publicacoes]
              .sort((a, b) => (b.agendado_para ?? "").localeCompare(a.agendado_para ?? ""))
              .map((p, i) => (
                <Card key={p.id ?? i} className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => abrirEdicao(p)}>
                  <CardContent className="p-3.5 flex items-center gap-3">
                    {p.modo_resposta === "automatico" && (
                      <Zap className="h-4 w-4 text-primary shrink-0" aria-label="Resposta automática" />
                    )}
                    <Badge variant="outline" className="shrink-0">{p.tipo}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{p.legenda || <span className="text-muted-foreground">(sem legenda)</span>}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{dataHoraBR(p.agendado_para)}</p>
                    </div>
                    {p.status === "falhou" && p.erro && (
                      <p className="text-xs text-danger max-w-[280px] truncate">{p.erro}</p>
                    )}
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shrink-0 ${chipStatus(p.status)}`}>
                      {p.status ?? "rascunho"}
                    </span>
                  </CardContent>
                </Card>
              ))
          )}
        </div>
      )}

      {/* ============ Modal: nova/editar publicação ============ */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editando ? "Editar publicação" : "Nova publicação"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 pb-4">
              {/* CONTEÚDO */}
              <section className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Conteúdo
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Agendar para</Label>
                    <Input
                      type="datetime-local"
                      value={form.agendadoPara}
                      onChange={(e) => setForm({ ...form, agendadoPara: e.target.value })}
                    />
                    {!form.agendadoPara && (
                      <p className="text-[10px] text-muted-foreground">Sem data = salva como rascunho.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Mídia {form.tipo === "CAROUSEL" && "(múltiplos arquivos)"}</Label>
                  <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 cursor-pointer hover:bg-accent/40 transition-colors text-sm text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    {arquivos.length > 0
                      ? `${arquivos.length} arquivo(s) selecionado(s)`
                      : editando?.midia_urls?.length
                        ? `${editando.midia_urls.length} mídia(s) já anexada(s) — selecionar substitui`
                        : "Selecionar arquivos"}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple={form.tipo === "CAROUSEL"}
                      className="hidden"
                      onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
                    />
                  </label>
                  {arquivos.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {arquivos.map((f) => f.name).join(", ")}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Produtos vinculados</Label>
                  <SeletorProdutos
                    produtos={produtos}
                    selecionados={form.produtoIds}
                    onToggle={(id, marcado) =>
                      setForm({
                        ...form,
                        produtoIds: marcado
                          ? [...form.produtoIds, id]
                          : form.produtoIds.filter((x) => x !== id),
                      })
                    }
                    altura="h-60"
                  />
                </div>

                {/* GERAR COM IA */}
                <div className="rounded-lg border border-primary/25 bg-primary/[0.04] p-3.5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Gerar com IA
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Etapa do funil</Label>
                      <Select value={iaFunil} onValueChange={setIaFunil}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ETAPAS_FUNIL.map((e) => (
                            <SelectItem key={e.valor} value={e.valor}>
                              <div>
                                <p className="text-sm font-medium">{e.titulo}</p>
                                <p className="text-[10px] text-muted-foreground font-normal">{e.descricao}</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Estilo do post</Label>
                      <Select value={iaEstilo} onValueChange={setIaEstilo}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ESTILOS.map((e) => (
                            <SelectItem key={e.valor} value={e.valor}>
                              <p className="text-sm font-medium">{e.titulo}</p>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Chamada para ação</Label>
                      <Select value={iaCta} onValueChange={setIaCta}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CTAS.map((c) => (
                            <SelectItem key={c.valor} value={c.valor}>
                              <div>
                                <p className="text-sm font-medium">{c.titulo}</p>
                                <p className="text-[10px] text-muted-foreground font-normal">{c.descricao}</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contexto (opcional)</Label>
                    <Textarea
                      value={iaContexto}
                      onChange={(e) => setIaContexto(e.target.value)}
                      rows={2}
                      className="min-h-[44px] resize-none text-sm"
                      placeholder="O que aparece no post?"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button type="button" variant="outline" size="sm" onClick={gerarLegenda} disabled={iaGerando}>
                      {iaGerando ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {iaGerando ? "Gerando… leva alguns segundos" : "Gerar legenda"}
                    </Button>
                    {form.produtoIds.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        A IA usa os {form.produtoIds.length} produto(s) selecionados acima como referência.
                      </span>
                    )}
                  </div>
                  {iaRaciocinio && (
                    <p className="text-[11px] text-muted-foreground border-t border-primary/15 pt-2">
                      Por que esse gancho: {iaRaciocinio}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Legenda</Label>
                    <span className={`text-[10px] ${form.legenda.length > LIMITE_LEGENDA ? "text-danger font-semibold" : "text-muted-foreground"}`}>
                      {form.legenda.length}/{LIMITE_LEGENDA}
                    </span>
                  </div>
                  <Textarea
                    value={form.legenda}
                    onChange={(e) => setForm({ ...form, legenda: e.target.value.slice(0, LIMITE_LEGENDA) })}
                    className="min-h-[110px]"
                    placeholder="Texto da publicação…"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Primeiro comentário (opcional — hashtags)</Label>
                  <Input
                    value={form.primeiroComentario}
                    onChange={(e) => setForm({ ...form, primeiroComentario: e.target.value })}
                    placeholder="#moda #marianacardoso"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Mensagem para o grupo VIP</Label>
                    {form.textoGrupoVip && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={copiarTextoVip}
                      >
                        {copiadoVip ? (
                          <>
                            <Check className="h-3 w-3 mr-1 text-success" /> Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" /> Copiar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={form.textoGrupoVip}
                    onChange={(e) => setForm({ ...form, textoGrupoVip: e.target.value })}
                    className="min-h-[70px]"
                    placeholder="Gerado pela IA junto com a legenda — ou escreva manualmente…"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Envie no grupo VIP assim que o post sair. Troque [link do post] pelo link real.
                  </p>
                </div>

              </section>

              {/* AUTOMAÇÃO DE RESPOSTA */}
              <section className="space-y-4 rounded-lg border-2 border-primary/20 bg-primary/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Automação de resposta
                </p>

                <RadioGroup
                  value={form.modoResposta}
                  onValueChange={(v) => setForm({ ...form, modoResposta: v as FormState["modoResposta"] })}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                >
                  {MODOS.map((m) => (
                    <label
                      key={m.valor}
                      className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${
                        form.modoResposta === m.valor
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/40"
                      }`}
                    >
                      <RadioGroupItem value={m.valor} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <m.icone className="h-3.5 w-3.5" /> {m.titulo}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{m.descricao}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>

                {form.modoResposta === "automatico" && (
                  <div className="space-y-4 pt-1">
                    <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <p className="text-xs">
                        Comentários que <strong>NÃO</strong> baterem a palavra-chave serão respondidos
                        pela Anna automaticamente, sem aprovação.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Palavras-gatilho</Label>
                      <CampoTags
                        value={form.gatilhos}
                        onChange={(v) => setForm({ ...form, gatilhos: v })}
                        placeholder="Ex.: EU QUERO, QUERO, EU QUERO!"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Maiúsculas, acentos e emojis são ignorados na comparação — "EU QUERO!!! 💛" casa com "eu quero".
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Resposta pública (quando bater a chave)</Label>
                        <span className={`text-[10px] ${form.respostaPublica.length > LIMITE_RESPOSTA_PUBLICA ? "text-danger font-semibold" : "text-muted-foreground"}`}>
                          {form.respostaPublica.length}/{LIMITE_RESPOSTA_PUBLICA}
                        </span>
                      </div>
                      <Textarea
                        value={form.respostaPublica}
                        onChange={(e) => setForm({ ...form, respostaPublica: e.target.value.slice(0, LIMITE_RESPOSTA_PUBLICA) })}
                        className="min-h-[60px]"
                        placeholder='Ex.: "Te mandei no Direct 💛"'
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Fica visível para todo mundo — preço e link vão no Direct.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Resposta no Direct (mensagem privada)</Label>
                      <Textarea
                        value={form.respostaDm}
                        onChange={(e) => setForm({ ...form, respostaDm: e.target.value })}
                        className="min-h-[80px]"
                        placeholder="Aqui entra o link do produto, preço e estoque…"
                      />
                    </div>
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setModalAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editando ? "Salvar alterações" : form.agendadoPara ? "Agendar" : "Salvar rascunho"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
