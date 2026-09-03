import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

/** Evita que um bloco com erro derrube a aba Publicações inteira. */
class BlocoSeguro extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() {
    return { erro: true };
  }
  render() {
    if (this.state.erro) {
      return (
        <div className="rounded border p-8 text-center text-sm text-muted-foreground">
          Não foi possível exibir este conteúdo. Tente outro filtro ou recarregue a página.
        </div>
      );
    }
    return this.props.children;
  }
}

import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/socialCommerce";
import { lerErroEdge } from "@/lib/edgeError";
import { CampoTags, dataHoraBR } from "./comum";
import { SeletorProdutos, carregarProdutosPai, type ProdutoPai } from "./SeletorProdutos";
import { BotaoGerarRespostas } from "./BotaoGerarRespostas";
import { ListaVariacoesRespostas } from "./ListaVariacoesRespostas";
import { PostsNoAr } from "./PostsNoAr";
import { CapaReels } from "./CapaReels";
import { CardsCarrossel, MAX_CARDS_CARROSSEL, MIN_CARDS_CARROSSEL, type ItemMidia } from "./CardsCarrossel";
import { ListaProdutosOrdenada } from "./ListaProdutosOrdenada";
import { SeletorObjetivoPost, objetivoInferido, type ObjetivoPost } from "./ObjetivoPost";
import { BlocoRespostasCompra, BlocoRespostasFallback } from "./RespostasCompraFallback";
import { uploadMidia, ehUrlDeVideo } from "./midiaUpload";
import {
  BlocoTikTok,
  TIKTOK_FORM_VAZIO,
  compatibilidadeTikTok,
  payloadTikTok,
  tiktokFormDaLinha,
  type TikTokFormState,
} from "./BlocoTikTok";
import {
  limparPlaceholderLink,
  vipCliquesPorGrupo,
  vipEnviosEnviados,
  vipLimites,
  vipMensagemPorId,
  vipMensagensNoDia,
  type VipCliquesGrupo,
  type VipLimites,
  type VipMensagemEstado,
} from "@/lib/vipPublicacao";
import {
  STATUS_TIKTOK_COR,
  lerTikTokConfig,
  listarTikTokPublicacoes,
  mensagemDoResultado,
  publicarTikTokAgora,
  salvarTikTokPublicacao,
  type TikTokConfig,
  type TikTokPublicacao,
} from "@/lib/tiktok";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Eye, List, Loader2,
  Megaphone, Plus, Sparkles, Upload, Zap, ZapOff,
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
  /** preenchido pelo backend quando o post foi realmente pro Instagram */
  media_id?: string | null;
  modo_resposta?: string | null;
  objetivo?: string | null;
  /** 4.4/4.5 — resposta completa (pergunta de preço) e fallback sem Direct */
  respostas_publicas_compra?: string[] | null;
  respostas_publicas_fallback?: string[] | null;
  gatilho_qualquer?: boolean | null;
  palavras_gatilho?: string[] | null;
  resposta_gatilho_publica?: string | null;
  respostas_publicas?: string[] | null;
  resposta_gatilho_dm?: string | null;
  link_combo?: string | null;
  cupom?: string | null;
  cupom_beneficio?: string | null;
  cupom_validade?: string | null;
  texto_grupo_vip?: string | null;
  /** marcado na tela: a mensagem VIP dispara sozinha ao publicar (senão vira rascunho no VIP) */
  vip_disparar?: boolean | null;
  /** preenchido pelo backend quando a mensagem VIP é criada (somente leitura) */
  vip_mensagem_id?: string | null;
  /** motivo devolvido pelo backend quando a mensagem VIP não pôde ser criada */
  vip_erro?: string | null;
  capa_url?: string | null;
  capa_offset_ms?: number | null;
  marcar_produtos?: boolean | null;
};



const TIPOS = ["IMAGE", "REELS", "CAROUSEL", "STORIES"];
const LIMITE_LEGENDA = 2200;
const LIMITE_RESPOSTA_PUBLICA = 280;

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


type FormState = {
  tipo: string;
  legenda: string;
  primeiroComentario: string;
  textoGrupoVip: string;
  vipDisparar: boolean;
  agendadoPara: string; // datetime-local
  produtoIds: string[];
  modoResposta: "sombra" | "automatico" | "desligado";
  objetivo: ObjetivoPost;
  gatilhoQualquer: boolean;
  gatilhos: string[];
  respostasPublicas: string[];
  respostasCompra: string[];
  respostasFallback: string[];
  respostaDm: string;
  linkCombo: string;
  cupom: string;
  cupomBeneficio: string;
  cupomValidade: string;
  capaUrl: string;
  capaOffsetMs: number | null;
  marcarProdutos: boolean;
};

const FORM_VAZIO: FormState = {
  tipo: "IMAGE",
  legenda: "",
  primeiroComentario: "",
  textoGrupoVip: "",
  vipDisparar: false,
  agendadoPara: "",
  produtoIds: [],
  modoResposta: "sombra",
  objetivo: "conversa",
  gatilhoQualquer: false,
  gatilhos: [],
  respostasPublicas: ["Te mandei no Direct 💛"],
  respostasCompra: [],
  respostasFallback: [],
  respostaDm: "",
  linkCombo: "",
  cupom: "",
  cupomBeneficio: "",
  cupomValidade: "",
  capaUrl: "",
  capaOffsetMs: null,
  marcarProdutos: true,
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

/** Linha de status do TikTok exibida dentro do card da publicação. */
function LinhaTikTok({
  tt,
  publicando,
  onPublicar,
  onDuplicar,
}: {
  tt: TikTokPublicacao;
  publicando: boolean;
  onPublicar: () => void;
  onDuplicar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-2" onClick={(e) => e.stopPropagation()}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">TikTok</span>
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
          STATUS_TIKTOK_COR[tt.status ?? "rascunho"] ?? STATUS_TIKTOK_COR.rascunho
        }`}
      >
        {tt.status ?? "rascunho"}
      </span>
      {tt.status === "publicando" && (
        <span className="text-[11px] text-muted-foreground">
          Enviado à Buffer. Pode levar alguns minutos para aparecer no TikTok.
        </span>
      )}
      {tt.status === "publicado" && (
        <span className="text-[11px] text-muted-foreground">
          Publicado{tt.publicado_em ? ` · ${dataHoraBR(tt.publicado_em)}` : ""}
        </span>
      )}
      {tt.erro && (
        <span
          className={`text-[11px] max-w-[320px] truncate ${tt.status === "falhou" ? "text-danger" : "text-amber-600"}`}
          title={tt.erro}
        >
          {tt.erro}
        </span>
      )}
      <div className="ml-auto flex gap-2">
        {tt.status !== "publicado" && (
          <Button size="sm" variant="outline" onClick={onPublicar} disabled={publicando}>
            {publicando && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Publicar agora
          </Button>
        )}
        {tt.status === "publicado" && (
          <Button size="sm" variant="outline" onClick={onDuplicar}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar
          </Button>
        )}
      </div>
    </div>
  );
}



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
  // Deep-link: ?visao=noar&filtro=anuncios_pendentes (usado pelo alerta da aba Comentários)
  const [searchParams] = useSearchParams();
  const [visao, setVisao] = useState<"calendario" | "lista" | "noar">(() =>
    searchParams.get("visao") === "noar" ? "noar" : "calendario",
  );
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
  const [itens, setItens] = useState<ItemMidia[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [iaFunil, setIaFunil] = useState("alcance");
  const [iaEstilo, setIaEstilo] = useState("trend");
  const [iaCta, setIaCta] = useState("comentar_palavra_chave");
  const [iaContexto, setIaContexto] = useState("");
  const [iaGerando, setIaGerando] = useState(false);
  const [iaRaciocinio, setIaRaciocinio] = useState<string | null>(null);
  const [copiadoVip, setCopiadoVip] = useState(false);
  const [avisoRespostas, setAvisoRespostas] = useState<string[]>([]);

  // ===== TikTok =====
  const [ttConfig, setTtConfig] = useState<TikTokConfig | null>(null);
  const [ttForm, setTtForm] = useState<TikTokFormState>(TIKTOK_FORM_VAZIO);
  const [ttLinha, setTtLinha] = useState<TikTokPublicacao | null>(null);
  const [ttErro, setTtErro] = useState<string | null>(null);
  const [ttPorIg, setTtPorIg] = useState<Map<string, TikTokPublicacao>>(new Map());
  const [ttSoltas, setTtSoltas] = useState<TikTokPublicacao[]>([]);
  const [ttPublicando, setTtPublicando] = useState<string | null>(null);
  const [publicarNoIg, setPublicarNoIg] = useState(true);
  // Chave de idempotência: um UUID por sessão de composição. Não muda entre
  // tentativas de salvar — a retentativa vira UPDATE na mesma linha, nunca duplicata.
  const [chaveSalvamento, setChaveSalvamento] = useState(() => crypto.randomUUID());

  // ===== Grupo VIP =====
  const [vipLim, setVipLim] = useState<VipLimites | null>(null);
  const [vipMsg, setVipMsg] = useState<VipMensagemEstado | null>(null);
  const [vipEnviados, setVipEnviados] = useState<number | null>(null);
  const [vipCliques, setVipCliques] = useState<VipCliquesGrupo[]>([]);

  const carregar = useCallback(async () => {
    const [{ data: pubs }, prods, tts, cfg] = await Promise.all([
      db.from("instagram_publicacoes").select("*").order("agendado_para", { ascending: true }).limit(500),
      carregarProdutosPai().catch((e) => {
        toast.error("Falha ao carregar produtos", { description: e?.message });
        return [] as ProdutoPai[];
      }),
      listarTikTokPublicacoes().catch(() => [] as TikTokPublicacao[]),
      lerTikTokConfig().catch(() => null),
    ]);
    setPublicacoes((pubs ?? []) as Publicacao[]);
    setProdutos(prods);
    const mapa = new Map<string, TikTokPublicacao>();
    const soltas: TikTokPublicacao[] = [];
    for (const t of tts) {
      if (t.publicacao_ig_id != null) mapa.set(String(t.publicacao_ig_id), t);
      else soltas.push(t);
    }
    setTtPorIg(mapa);
    setTtSoltas(soltas);
    setTtConfig(cfg);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Limites do VIP (grupos/pessoas/teto diário) — carrega uma vez por abertura do modal.
  useEffect(() => {
    if (!modalAberto) return;
    let vivo = true;
    vipLimites().then((l) => vivo && setVipLim(l));
    return () => {
      vivo = false;
    };
  }, [modalAberto]);

  // Estado da mensagem VIP depois da publicação — lê por vip_mensagem_id.
  useEffect(() => {
    if (!modalAberto) return;
    const msgId = editando?.vip_mensagem_id;
    setVipMsg(null);
    setVipEnviados(null);
    setVipCliques([]);
    if (!msgId) return;
    let vivo = true;
    (async () => {
      const msg = await vipMensagemPorId(msgId);
      if (!vivo || !msg) return;
      setVipMsg(msg);
      if ((msg.status ?? "").toLowerCase() === "enviada") {
        const [enviados, cliques] = await Promise.all([
          vipEnviosEnviados(msgId),
          vipCliquesPorGrupo(msgId),
        ]);
        if (!vivo) return;
        setVipEnviados(enviados);
        setVipCliques(cliques);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [modalAberto, editando?.vip_mensagem_id]);

  // Dados frescos do criador sempre que a tela de agendamento abre.
  useEffect(() => {
    if (!modalAberto || ttConfig?.conectado !== true) return;
    let vivo = true;
    setTtCarregandoCreator(true);
    lerCreatorInfo()
      .then((ci) => vivo && setTtCreator(ci))
      .catch(() => vivo && setTtCreator(null))
      .finally(() => vivo && setTtCarregandoCreator(false));
    return () => {
      vivo = false;
    };
  }, [modalAberto, ttConfig?.conectado]);


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
    setChaveSalvamento(crypto.randomUUID()); // nova composição = chave nova
    setItens((prev) => {
      prev.forEach((i) => i.file && URL.revokeObjectURL(i.url));
      return [];
    });
    setIaContexto("");
    setIaRaciocinio(null);
    setAvisoRespostas([]);
    setTtForm(TIKTOK_FORM_VAZIO);
    setTtLinha(null);
    setTtErro(null);
    setPublicarNoIg(true);
    setForm({
      ...FORM_VAZIO,
      // Padrão ao agendar: CTA de comentário ("comenta QUERO") nasce venda; os demais, conversa.
      objetivo: iaCta === "comentar_palavra_chave" ? "venda" : "conversa",
      agendadoPara: dia ? `${diaKey(dia)}T09:00` : "",
    });
    setModalAberto(true);
  };


  // Post já publicado não pode ser reagendado — abre como nova publicação com o mesmo conteúdo.
  const duplicar = (p: Publicacao) => {
    abrirEdicao({ ...p, id: undefined, media_id: null, status: "rascunho", erro: null, agendado_para: null });
    toast.info("Cópia aberta como nova publicação — escolha a nova data.");
  };

  const abrirEdicao = (p: Publicacao) => {
    setEditando(p.id != null ? p : null);
    // "Duplicar" abre sem id: é outro post, precisa de chave nova.
    if (p.id == null) setChaveSalvamento(crypto.randomUUID());
    setItens((prev) => {
      prev.forEach((i) => i.file && URL.revokeObjectURL(i.url));
      return (p.midia_urls ?? []).map((url) => ({
        key: url,
        url,
        isVideo: ehUrlDeVideo(url),
      }));
    });
    setIaContexto("");
    setIaRaciocinio(null);
    setAvisoRespostas([]);
    setPublicarNoIg(true);
    setTtErro(null);
    const tt = p.id != null ? ttPorIg.get(String(p.id)) ?? null : null;
    setTtLinha(tt);
    setTtForm(tt ? tiktokFormDaLinha(tt) : TIKTOK_FORM_VAZIO);

    const d = p.agendado_para ? new Date(p.agendado_para) : null;
    setForm({
      tipo: p.tipo ?? "IMAGE",
      legenda: p.legenda ?? "",
      primeiroComentario: p.primeiro_comentario ?? "",
      textoGrupoVip: p.texto_grupo_vip ?? "",
      vipDisparar: p.vip_disparar ?? false,
      agendadoPara:
        d && !Number.isNaN(d.getTime())
          ? `${diaKey(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
          : "",
      produtoIds: p.produto_ids ?? [],
      modoResposta: (p.modo_resposta as FormState["modoResposta"]) ?? "sombra",
      // Registro antigo sem objetivo: quem já tem Direct/cupom/combo configurado era venda
      objetivo: objetivoInferido(p.objetivo, !!(p.resposta_gatilho_dm || p.cupom || p.link_combo)),
      gatilhoQualquer: p.gatilho_qualquer ?? false,
      gatilhos: p.palavras_gatilho ?? [],
      respostasPublicas:
        p.respostas_publicas?.length
          ? p.respostas_publicas
          : p.resposta_gatilho_publica
            ? [p.resposta_gatilho_publica]
            : [],
      respostasCompra: p.respostas_publicas_compra ?? [],
      respostasFallback: p.respostas_publicas_fallback ?? [],
      respostaDm: p.resposta_gatilho_dm ?? "",
      linkCombo: p.link_combo ?? "",
      cupom: p.cupom ?? "",
      cupomBeneficio: p.cupom_beneficio ?? "",
      cupomValidade: p.cupom_validade ?? "",
      capaUrl: p.capa_url ?? "",
      capaOffsetMs: p.capa_offset_ms ?? null,
      marcarProdutos: p.marcar_produtos ?? true,
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
      // A legenda também devolve resposta_gatilho_publica/resposta_gatilho_dm — IGNORADOS de propósito:
      // quem preenche as respostas de gatilho é sempre o botão "Gerar respostas com IA"
      // (único que conhece cupom e link de combo).
      setForm((f) => ({
        ...f,
        legenda: String(data.legenda ?? "").slice(0, LIMITE_LEGENDA),
        primeiroComentario: String(data.primeiro_comentario ?? ""),
        // O link entra sozinho no rodapé (encurtado e rastreado por grupo) —
        // nenhum texto do VIP pode sair com "[link do post]" no meio.
        textoGrupoVip: limparPlaceholderLink(String(data.texto_grupo_vip ?? f.textoGrupoVip)),
        ...(gatilhos.length > 0
          ? {
              // Palavras-gatilho = CTA de comentário ("comenta QUERO") → objetivo venda
              modoResposta: "automatico" as const,
              objetivo: "venda" as const,
              gatilhos,
            }
          : {}),
      }));
      setIaRaciocinio(data.raciocinio ?? null);
      if (gatilhos.length > 0) {
        toast.info("Palavras-gatilho preenchidas — use “Gerar respostas com IA” para as respostas.");
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

  // ===== Mídias (carrossel arrastável / mídia única) =====
  const reordenarItens = (de: number, para: number) =>
    setItens((prev) => {
      const copia = [...prev];
      const [movido] = copia.splice(de, 1);
      copia.splice(para, 0, movido);
      return copia;
    });

  const removerItem = (key: string) =>
    setItens((prev) => {
      const alvo = prev.find((i) => i.key === key);
      if (alvo?.file) URL.revokeObjectURL(alvo.url);
      return prev.filter((i) => i.key !== key);
    });

  const adicionarCards = (files: File[]) => {
    const espaco = MAX_CARDS_CARROSSEL - itens.length;
    if (espaco <= 0) {
      toast.warning("O Instagram aceita no máximo 10.");
      return;
    }
    if (files.length > espaco) {
      toast.warning(`O Instagram aceita no máximo 10 — só ${espaco} arquivo(s) foi(ram) adicionado(s).`);
    }
    const novos: ItemMidia[] = files.slice(0, espaco).map((f, i) => ({
      key: `novo_${Date.now()}_${i}_${f.name}`,
      file: f,
      url: URL.createObjectURL(f),
      isVideo: f.type.startsWith("video/"),
      nome: f.name,
    }));
    setItens((prev) => [...prev, ...novos]);
  };

  const definirMidiaUnica = (file: File) => {
    setItens((prev) => {
      prev.forEach((i) => i.file && URL.revokeObjectURL(i.url));
      return [
        {
          key: `novo_${Date.now()}_${file.name}`,
          file,
          url: URL.createObjectURL(file),
          isVideo: file.type.startsWith("video/"),
          nome: file.name,
        },
      ];
    });
  };

  const primeiroVideoSrc = itens.find((i) => i.isVideo)?.url ?? null;
  // Capa: vale para Reels e para vídeo de feed. Stories não aceita capa — bloco escondido.
  const mostrarCapa =
    form.tipo !== "STORIES" && (form.tipo === "REELS" || itens[0]?.isVideo === true);
  const carrosselInvalido =
    form.tipo === "CAROUSEL" &&
    (itens.length < MIN_CARDS_CARROSSEL || itens.length > MAX_CARDS_CARROSSEL);

  // legenda vazia só é aceita em STORIES — o Instagram recusa os demais formatos.
  const legendaObrigatoriaFaltando =
    publicarNoIg && form.tipo !== "STORIES" && !form.legenda.trim();

  // Compatibilidade Instagram → TikTok (usa a mídia já anexada na tela)
  const compatTikTok = useMemo(
    () => compatibilidadeTikTok(form.tipo, itens.map((i) => ({ url: i.url, isVideo: i.isVideo }))),
    [form.tipo, itens],
  );

  /** Publicar agora no TikTok, direto da lista. */
  const publicarTikTok = async (linha: TikTokPublicacao) => {
    if (!linha.id || ttPublicando) return;
    setTtPublicando(linha.id);
    try {
      const r = await publicarTikTokAgora(linha.id);
      const { texto, ok } = mensagemDoResultado(r);
      if (ok) toast.success(texto);
      else toast.error(texto);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao publicar no TikTok");
    } finally {
      setTtPublicando(null);
    }
  };

  /** Post publicado não volta pra fila: duplicar cria uma linha nova como rascunho. */
  const duplicarTikTok = async (linha: TikTokPublicacao) => {
    const { id, publish_id, post_id, publicado_em, erro, criado_em, atualizado_em, ...resto } = linha as any;
    try {
      await salvarTikTokPublicacao(
        { ...resto, publish_id: null, post_id: null, publicado_em: null, erro: null, status: "rascunho", agendado_para: null },
        null,
      );
      toast.success("Cópia criada como rascunho no TikTok — escolha a nova data.");
      await carregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao duplicar");
    }
  };



  const salvar = async (opcoes?: { publicarAgora?: boolean }) => {
    if (salvando) return;
    const soTikTok = !publicarNoIg && ttForm.ativo;
    if (ttForm.ativo && ttErro) {
      toast.error(ttErro);
      return;
    }
    if (!publicarNoIg && !ttForm.ativo) {
      toast.error("Escolha ao menos uma plataforma: Instagram ou TikTok.");
      return;
    }
    if (!soTikTok && legendaObrigatoriaFaltando) {
      toast.error("Escreva a legenda antes de agendar. Só Stories pode ir sem legenda.");
      return;
    }
    // O backend falha com mensagem clara se passar de 10 — a tela impede antes de deixar agendar.
    if (!soTikTok && form.tipo === "CAROUSEL") {
      if (itens.length < MIN_CARDS_CARROSSEL) {
        toast.error("Carrossel precisa de pelo menos 2 cards.");
        return;
      }
      if (itens.length > MAX_CARDS_CARROSSEL) {
        toast.error("O Instagram aceita no máximo 10 cards.");
        return;
      }
    }
    setSalvando(true);

    try {
      const listaMidias = form.tipo === "CAROUSEL" ? itens : itens.slice(0, 1);
      const midiaUrls = await Promise.all(
        listaMidias.map((it) => (it.file ? uploadMidia(it.file) : it.url)),
      );

      const agendadoIso = form.agendadoPara ? new Date(form.agendadoPara).toISOString() : null;
      const statusFila = form.agendadoPara ? "agendado" : "rascunho";

      // Teto diário do VIP: avisa (sem bloquear) quando o dia já está cheio.
      const textoVipLimpo = limparPlaceholderLink(form.textoGrupoVip);
      const vipDispararFinal = form.vipDisparar && !!textoVipLimpo.trim();
      if (vipDispararFinal && agendadoIso && !opcoes?.publicarAgora) {
        const teto = vipLim?.limitePratico ?? 3;
        const existentes = await vipMensagensNoDia(diaKey(new Date(agendadoIso))).catch(() => null);
        if (existentes != null && existentes >= teto) {
          toast.warning(
            `Já existem ${existentes} mensagens VIP neste dia. O limite prático é ${teto} por dia.`,
            { description: "Uma delas pode não sair.", duration: 8000 },
          );
        }
      }

      const compatSalvar = compatibilidadeTikTok(
        form.tipo,
        midiaUrls.map((u) => ({ url: u, isVideo: ehUrlDeVideo(u) })),
      );

      let idSalvo: string | number | null = editando?.id ?? null;

      if (soTikTok) {
        // Só TikTok (toggle do Instagram desligado): grava só a linha da fila do TikTok.
        const payloadTt = payloadTikTok(ttForm, compatSalvar, {
          publicacaoIgId: null,
          agendadoPara: agendadoIso,
          status: statusFila,
          produtoIds: form.produtoIds,
        });
        try {
          const salvoTt = await salvarTikTokPublicacao(payloadTt, ttLinha?.id ?? null);
          if (salvoTt?.id) setTtLinha(salvoTt);
        } catch (eTt: any) {
          await carregar();
          toast.error(eTt?.message ?? "Falha ao salvar no TikTok", { duration: 12000 });
          return;
        }
      } else {
        // ===== Salvamento ATÔMICO: Instagram + TikTok na mesma transação via RPC. =====
        // Se o TikTok falhar, o Instagram volta atrás junto — nunca fica meio salvo.
        // A chave_salvamento torna a retentativa um UPDATE, não um INSERT novo.
        const variacoes = form.respostasPublicas.map((v) => v.trim()).filter(Boolean);
        const compra = form.respostasCompra.map((v) => v.trim()).filter(Boolean);
        const fallback = form.respostasFallback.map((v) => v.trim().length ? v.trim() : "").filter(Boolean);
        const payloadTt = payloadTikTok(ttForm, compatSalvar, {
          publicacaoIgId: null,
          agendadoPara: agendadoIso,
          status: statusFila,
          produtoIds: form.produtoIds,
        });

        const p: Record<string, any> = {
          id: idSalvo,
          chave_salvamento: chaveSalvamento,
          tipo: form.tipo,
          midia_urls: midiaUrls,
          legenda: form.legenda,
          primeiro_comentario: form.primeiroComentario || null,
          texto_grupo_vip: textoVipLimpo || null,
          vip_disparar: vipDispararFinal,
          agendado_para: opcoes?.publicarAgora ? new Date().toISOString() : agendadoIso,
          status: opcoes?.publicarAgora ? "agendado" : statusFila,
          produto_ids: form.produtoIds,
          marcar_produtos: form.marcarProdutos,
          capa_url: mostrarCapa ? form.capaUrl || null : null,
          capa_offset_ms: mostrarCapa ? form.capaOffsetMs : null,
          objetivo: form.objetivo,
          modo_resposta: form.modoResposta,
          gatilho_qualquer: form.modoResposta === "automatico" ? form.gatilhoQualquer : false,
          palavras_gatilho: form.modoResposta === "automatico" ? form.gatilhos : [],
          respostas_publicas: form.modoResposta === "automatico" ? variacoes : null,
          respostas_publicas_compra: form.modoResposta === "automatico" ? (compra.length ? compra : null) : null,
          respostas_publicas_fallback: form.modoResposta === "automatico" ? (fallback.length ? fallback : null) : null,
          resposta_gatilho_publica: form.modoResposta === "automatico" ? variacoes[0] ?? null : null,
          resposta_gatilho_dm: form.modoResposta === "automatico" ? form.respostaDm : null,
          link_combo: form.modoResposta === "automatico" ? form.linkCombo.trim() || null : null,
          cupom: form.modoResposta === "automatico" ? form.cupom.trim() || null : null,
          cupom_beneficio: form.modoResposta === "automatico" ? form.cupomBeneficio.trim() || null : null,
          cupom_validade: form.modoResposta === "automatico" ? form.cupomValidade.trim() || null : null,
          // Toggle desligado: a função remove o agendamento de TikTok vinculado (se ainda não publicado).
          tiktok: ttForm.ativo
            ? { ...payloadTt, publicacao_ig_id: undefined, ativo: true }
            : { ativo: false },
        };

        const { data, error } = await supabase.rpc("fn_publicacao_salvar", { p });
        // Mensagens do banco vêm em português e específicas — mostrar como vieram.
        if (error) throw new Error(error.message);
        if (data?.ok === false) throw new Error(data.erro ?? "Falha ao salvar");
        idSalvo = data?.publicacao_id ?? idSalvo;
        // A partir do primeiro salvamento, o formulário edita esse agendamento:
        // as próximas chamadas mandam o id e atualizam a mesma linha.
        if (!editando && idSalvo != null) setEditando({ id: idSalvo });
      }

      if (opcoes?.publicarAgora && !soTikTok) {
        // Autorização explícita: sem ignorar_agendamento o backend recusa publicar fora da hora marcada.
        const { data, error: erroEdge } = await supabase.functions.invoke("instagram-publicar", {
          body: { publicacao_id: idSalvo, ignorar_agendamento: true },
        });
        if (erroEdge) {
          const det = await lerErroEdge(erroEdge, "Falha ao publicar agora.");
          toast.error(det.mensagem, { description: det.dica });
        } else if (data?.ok === false || data?.erro || data?.error) {
          toast.error(String(data?.erro ?? data?.error ?? "O Instagram recusou a publicação."), {
            description: data?.detalhe ?? undefined,
          });
        } else {
          toast.success("Publicado no Instagram");
          setModalAberto(false);
        }
      } else {
        toast.success(editando ? "Publicação atualizada" : form.agendadoPara ? "Publicação agendada" : "Rascunho salvo");
        setModalAberto(false);
      }
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
            <List className="h-4 w-4" /> Agendadas
          </ToggleGroupItem>
          <ToggleGroupItem value="noar" className="gap-1.5">
            <Megaphone className="h-4 w-4" /> No ar
          </ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={() => abrirNovo()}>
          <Plus className="h-4 w-4 mr-1.5" /> Nova publicação
        </Button>
      </div>

      {visao === "noar" ? (
        <BlocoSeguro>
          <PostsNoAr filtroInicial={searchParams.get("filtro")} />
        </BlocoSeguro>

      ) : carregando ? (
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
                          {p.id != null && ttPorIg.has(String(p.id)) && " · TT"}
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
          {publicacoes.length === 0 && ttSoltas.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhuma publicação agendada. Clique em "Nova publicação" ou em um dia do calendário.
              </CardContent>
            </Card>
          ) : (
            <>
            {[...publicacoes]
              .sort((a, b) => (b.agendado_para ?? "").localeCompare(a.agendado_para ?? ""))
              .map((p, i) => {
                const tt = p.id != null ? ttPorIg.get(String(p.id)) ?? null : null;
                return (
                <Card key={p.id ?? i} className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => (p.media_id ? duplicar(p) : abrirEdicao(p))}>
                  <CardContent className="p-3.5 space-y-2">
                   <div className="flex items-center gap-3">
                    {p.modo_resposta === "automatico" && (
                      <Zap className="h-4 w-4 text-primary shrink-0" aria-label="Resposta automática" />
                    )}
                    <Badge variant="outline" className="shrink-0">{p.tipo}</Badge>
                    <div className="flex gap-1 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">Instagram</Badge>
                      {tt && <Badge variant="secondary" className="text-[10px]">TikTok</Badge>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{p.legenda || <span className="text-muted-foreground">(sem legenda)</span>}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{dataHoraBR(p.agendado_para)}</p>
                    </div>
                    {p.erro && (
                      <p
                        className={`text-xs max-w-[280px] truncate ${
                          p.status === "falhou" ? "text-danger" : "text-amber-600"
                        }`}
                        title={p.erro}
                      >
                        {p.erro}
                      </p>
                    )}
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shrink-0 ${chipStatus(p.status)}`}>
                      {p.status ?? "rascunho"}
                    </span>
                    {p.media_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={(e) => { e.stopPropagation(); duplicar(p); }}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar
                      </Button>
                    )}
                   </div>
                   {tt && (
                     <LinhaTikTok
                       tt={tt}
                       publicando={ttPublicando === tt.id}
                       onPublicar={() => publicarTikTok(tt)}
                       onDuplicar={() => duplicarTikTok(tt)}
                     />
                   )}
                  </CardContent>
                </Card>
                );
              })}

            {ttSoltas
              .sort((a, b) => (b.agendado_para ?? "").localeCompare(a.agendado_para ?? ""))
              .map((tt) => (
                <Card key={`tt_${tt.id}`}>
                  <CardContent className="p-3.5 space-y-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="shrink-0">{tt.tipo}</Badge>
                      <Badge variant="secondary" className="text-[10px] shrink-0">TikTok</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          {tt.titulo || <span className="text-muted-foreground">(sem texto)</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{dataHoraBR(tt.agendado_para)}</p>
                      </div>
                    </div>
                    <LinhaTikTok
                      tt={tt}
                      publicando={ttPublicando === tt.id}
                      onPublicar={() => publicarTikTok(tt)}
                      onDuplicar={() => duplicarTikTok(tt)}
                    />
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>

      )}

      {/* ============ Modal: nova/editar publicação ============ */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-serif">
              {editando ? "Editar publicação" : "Nova publicação"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-140px)] overflow-y-auto pr-4">
            <div className="space-y-6 pb-4">
              {/* CONTEÚDO */}
              <section className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Conteúdo
                  </p>
                  {!editando && (
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={publicarNoIg}
                        onCheckedChange={(v) => setPublicarNoIg(!!v)}
                      />
                      Publicar no Instagram
                      <span className="text-muted-foreground">(desmarque para agendar só no TikTok)</span>
                    </label>
                  )}
                </div>



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
                  <Label>Mídia {form.tipo === "CAROUSEL" && `(${itens.length}/${MAX_CARDS_CARROSSEL} cards)`}</Label>
                  {form.tipo === "CAROUSEL" ? (
                    <CardsCarrossel
                      itens={itens}
                      onReordenar={reordenarItens}
                      onRemover={removerItem}
                      onAdicionar={adicionarCards}
                    />
                  ) : (
                    <>
                      <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 cursor-pointer hover:bg-accent/40 transition-colors text-sm text-muted-foreground">
                        <Upload className="h-4 w-4" />
                        {itens.length > 0
                          ? itens[0].nome ?? "1 mídia anexada — selecionar substitui"
                          : "Selecionar arquivo"}
                        <input
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) definirMidiaUnica(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {itens.length > 0 && !itens[0].file && (
                        <p className="text-[10px] text-muted-foreground">
                          Mídia atual mantida — selecionar um arquivo substitui.
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* CAPA — Reels e vídeo de feed. Stories não aceita capa: bloco escondido. */}
                {mostrarCapa && (
                  <CapaReels
                    videoSrc={primeiroVideoSrc}
                    capaUrl={form.capaUrl}
                    onCapaUrl={(url) => setForm({ ...form, capaUrl: url })}
                    capaOffsetMs={form.capaOffsetMs}
                    onCapaOffsetMs={(ms) => setForm({ ...form, capaOffsetMs: ms })}
                  />
                )}

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
                  <ListaProdutosOrdenada
                    ids={form.produtoIds}
                    produtos={produtos}
                    onChange={(ids) => setForm({ ...form, produtoIds: ids })}
                  />
                  <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="marcar-produtos" className="text-sm cursor-pointer">
                        Marcar produtos na publicação
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        As peças aparecem com etiqueta de preço no post, e a cliente compra tocando na foto.
                        Precisa ter produto vinculado acima.
                      </p>
                    </div>
                    <Switch
                      id="marcar-produtos"
                      checked={form.marcarProdutos}
                      onCheckedChange={(v) => setForm({ ...form, marcarProdutos: v })}
                    />
                  </div>
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
                      <Select
                        value={iaCta}
                        onValueChange={(v) => {
                          setIaCta(v);
                          // Sugestão de padrão: CTA de comentário nasce venda; os outros, conversa.
                          // O usuário ainda pode trocar no seletor "Objetivo deste post" abaixo.
                          setForm((f) => ({ ...f, objetivo: v === "comentar_palavra_chave" ? "venda" : "conversa" }));
                        }}
                      >
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
                  <Label>Primeiro comentário (pergunta + hashtags)</Label>
                  <Textarea
                    value={form.primeiroComentario}
                    onChange={(e) => setForm({ ...form, primeiroComentario: e.target.value })}
                    placeholder={"Você é mais...?\n\n#moda #marianacardoso"}
                    className="min-h-[90px] whitespace-pre-wrap"
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    A pergunta puxa resposta, e comentário nos primeiros minutos é o que faz o post andar.
                  </p>
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
                    Não escreva o link. Ele é adicionado automaticamente no fim da mensagem, encurtado e rastreado por grupo.
                  </p>

                  <label
                    className={`flex items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                      form.textoGrupoVip.trim()
                        ? "cursor-pointer hover:bg-accent/40"
                        : "opacity-60 cursor-not-allowed"
                    } ${form.vipDisparar ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <Switch
                      checked={form.vipDisparar}
                      disabled={!form.textoGrupoVip.trim()}
                      onCheckedChange={(v) => setForm({ ...form, vipDisparar: !!v })}
                      className="mt-0.5"
                    />
                    <span className="text-xs">
                      <span className="font-medium block">Disparar no Grupo VIP automaticamente</span>
                      {!form.textoGrupoVip.trim() ? (
                        <span className="text-[11px] text-muted-foreground">
                          Escreva o texto do grupo VIP primeiro.
                        </span>
                      ) : form.vipDisparar ? (
                        <span className="text-[11px] text-muted-foreground">
                          Vai para {vipLim?.gruposAtivos ?? "…"} grupos
                          {vipLim?.pessoas ? `, ${vipLim.pessoas.toLocaleString("pt-BR")} pessoas` : ""},
                          5 minutos depois da publicação.
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Sem marcar, a mensagem fica como rascunho esperando aprovação.
                        </span>
                      )}
                    </span>
                  </label>

                  {/* Estado da mensagem VIP depois que o post foi publicado */}
                  {editando?.status === "publicado" && (
                    editando.vip_mensagem_id ? (
                      <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 text-xs">
                        {(() => {
                          const s = (vipMsg?.status ?? "").toLowerCase();
                          if (s === "rascunho" || !vipMsg) {
                            return (
                              <p>
                                Mensagem VIP criada, aguardando aprovação —{" "}
                                <a href="/grupo-vip" className="underline text-primary">abrir no painel do VIP</a>
                              </p>
                            );
                          }
                          if (s === "aprovada") {
                            return <p>Mensagem VIP sai às {vipMsg.horario ?? "--:--"}</p>;
                          }
                          if (s === "agendada") {
                            return <p>Mensagem VIP na fila de envio</p>;
                          }
                          if (s === "enviada") {
                            return <p>Enviada para {vipEnviados ?? "…"} grupos</p>;
                          }
                          return <p>Status da mensagem VIP: {vipMsg.status}</p>;
                        })()}
                        {vipCliques.length > 0 && (
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="text-left font-medium">grupo</th>
                                <th className="text-right font-medium">cliques</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vipCliques.map((g) => (
                                <tr key={g.grupo} className="border-t border-border/60">
                                  <td className="py-1 pr-2">{g.grupo}</td>
                                  <td className="py-1 text-right tabular-nums">{g.cliques}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ) : (
                      form.textoGrupoVip.trim() && (
                        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-start gap-2 text-xs">
                          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                          <span>
                            <strong>Mensagem VIP não foi criada.</strong>
                            {(vipMsg?.motivo ?? editando.vip_erro) && (
                              <span className="block text-[11px] mt-0.5">{vipMsg?.motivo ?? editando.vip_erro}</span>
                            )}
                          </span>
                        </div>
                      )
                    )
                  )}
                </div>

              </section>

              {/* TAMBÉM NO TIKTOK — salvar só grava a linha; quem publica é o cron. */}
              <BlocoTikTok
                form={ttForm}
                onChange={setTtForm}
                config={ttConfig}
                compat={compatTikTok}
                legendaIg={form.legenda}
                onErroValidacao={setTtErro}
              />

              {ttLinha?.status === "publicado" && !ttForm.ativo && (
                <p className="text-xs text-muted-foreground">Já publicado no TikTok</p>
              )}



              {/* AUTOMAÇÃO DE RESPOSTA */}
              <section className="space-y-4 rounded-lg border-2 border-primary/20 bg-primary/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Automação de resposta
                </p>

                <SeletorObjetivoPost
                  value={form.objetivo}
                  onChange={(v) => setForm({ ...form, objetivo: v })}
                />

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

                    {form.objetivo === "conversa" && (
                      <p className="text-[11px] rounded border border-border bg-muted/50 p-2">
                        Objetivo <strong>conversa</strong>: a Anna responde só no comentário.
                        Mensagem de Direct, card e cupom ficam desligados — quem pedir preço
                        continua sendo atendido normalmente.
                      </p>
                    )}

                    {form.objetivo === "venda" && (
                      <>
                        <div className="space-y-1.5">
                          <Label>Link do combo (card do Direct)</Label>
                          <Input
                            type="url"
                            value={form.linkCombo}
                            onChange={(e) => setForm({ ...form, linkCombo: e.target.value })}
                            placeholder="https://…"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Use quando o post vende um combo com página própria. Vazio = usa os links individuais das peças.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label>Cupom</Label>
                            <Input
                              value={form.cupom}
                              onChange={(e) => setForm({ ...form, cupom: e.target.value })}
                              placeholder="Ex.: COMBOANNA"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>O que o cupom dá</Label>
                            <Input
                              value={form.cupomBeneficio}
                              onChange={(e) => setForm({ ...form, cupomBeneficio: e.target.value })}
                              placeholder="Ex.: R$50 de desconto"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Validade</Label>
                            <Input
                              value={form.cupomValidade}
                              onChange={(e) => setForm({ ...form, cupomValidade: e.target.value })}
                              placeholder="Ex.: válidos até amanhã"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground -mt-2">
                          Vazio = a mensagem sai sem a linha de cupom.
                        </p>
                      </>
                    )}

                    <div>
                      <BotaoGerarRespostas
                        produtoIds={form.produtoIds}
                        gatilhos={form.gatilhos}
                        objetivo={form.objetivo}
                        contexto={iaContexto}
                        linkCombo={form.linkCombo}
                        cupom={form.cupom}
                        cupomBeneficio={form.cupomBeneficio}
                        cupomValidade={form.cupomValidade}
                        onResultado={(r) => {
                          setForm((f) => ({
                            ...f,
                            respostasPublicas: r.respostasPublicas.map((v) => v.slice(0, LIMITE_RESPOSTA_PUBLICA)),
                            respostaDm: r.respostaDm,
                          }));
                          setAvisoRespostas(r.avisos);
                        }}
                      />
                    </div>

                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={form.gatilhoQualquer}
                        onCheckedChange={(v) => setForm({ ...form, gatilhoQualquer: !!v })}
                        className="mt-0.5"
                      />
                      <span>
                        Responder qualquer comentário
                        {form.gatilhoQualquer && (
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            Todos os comentários recebem a resposta fixa, a palavra-chave não é usada.
                          </span>
                        )}
                      </span>
                    </label>

                    <div className="space-y-1.5">
                      <Label>Palavras-gatilho</Label>
                      <CampoTags
                        value={form.gatilhos}
                        onChange={(v) => setForm({ ...form, gatilhos: v })}
                        placeholder="Ex.: EU QUERO, QUERO, EU QUERO!"
                        disabled={form.gatilhoQualquer}
                      />
                      {!form.gatilhoQualquer && (
                        <p className="text-[10px] text-muted-foreground">
                          Maiúsculas, acentos e emojis são ignorados na comparação — "EU QUERO!!! 💛" casa com "eu quero".
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <ListaVariacoesRespostas
                        value={form.respostasPublicas}
                        onChange={(v) => setForm({ ...form, respostasPublicas: v })}
                        limite={LIMITE_RESPOSTA_PUBLICA}
                      />
                      {avisoRespostas.map((aviso, i) => (
                        <p key={i} className="text-[11px] rounded border border-warning/30 bg-warning/10 p-2 flex items-start gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-px" />
                          <span>{aviso}</span>
                        </p>
                      ))}
                    </div>

                    <BlocoRespostasCompra
                      value={form.respostasCompra}
                      onChange={(v) => setForm({ ...form, respostasCompra: v })}
                      combo={form.produtoIds.length > 1}
                    />
                    <BlocoRespostasFallback
                      value={form.respostasFallback}
                      onChange={(v) => setForm({ ...form, respostasFallback: v })}
                    />

                    {form.objetivo === "venda" && (
                      <div className="space-y-1.5">
                        <Label>Resposta no Direct (mensagem privada)</Label>
                        <Textarea
                          value={form.respostaDm}
                          onChange={(e) => setForm({ ...form, respostaDm: e.target.value })}
                          className="min-h-[80px]"
                          placeholder="Aqui entra o link do produto, preço e estoque…"
                        />
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>

          <div className="flex justify-end items-center gap-2 pt-3 border-t shrink-0">
            {carrosselInvalido && publicarNoIg && (
              <p className="text-xs text-danger mr-auto">Carrossel precisa de pelo menos 2 cards.</p>
            )}
            {ttForm.ativo && ttErro && (
              <p className="text-xs text-danger mr-auto">{ttErro}</p>
            )}
            <Button variant="outline" onClick={() => setModalAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            {legendaObrigatoriaFaltando && (
              <p className="text-xs text-danger mr-auto">Escreva a legenda — só Stories publica sem texto.</p>
            )}
            {publicarNoIg && editando?.status !== "publicado" && (
              <Button
                variant="secondary"
                onClick={() => salvar({ publicarAgora: true })}
                disabled={salvando || carrosselInvalido || legendaObrigatoriaFaltando || !!(ttForm.ativo && ttErro)}
              >
                {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {salvando ? "Salvando..." : "Publicar agora"}
              </Button>
            )}
            <Button
              onClick={() => salvar()}
              disabled={
                salvando ||
                (publicarNoIg && (carrosselInvalido || legendaObrigatoriaFaltando)) ||
                !!(ttForm.ativo && ttErro)
              }
            >
              {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {salvando ? "Salvando..." : editando ? "Salvar alterações" : form.agendadoPara ? "Agendar" : "Salvar rascunho"}
            </Button>
          </div>

        </DialogContent>
      </Dialog>
    </div>
  );
}
