import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { db, enviarInstagram, marcarConversaLida, marcarTodasLidas, devolverParaAnna, MOTIVOS_409 } from "@/lib/socialCommerce";
import { tempoRelativo, janelaInfo } from "./comum";
import { ContextoMensagem } from "./ContextoMensagem";
import {
  ReelCompartilhado,
  ehReelCompartilhado,
  textoSemAnexo,
  extrairLinkInsta,
  type PostReel,
} from "./ReelCompartilhado";
import type { ProdutoPai } from "./SeletorProdutos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Bot, Check, ExternalLink, Loader2, Mail, MailCheck, MailOpen, MessageCircle, Pencil,
  SendHorizonal, PanelRightClose, PanelRightOpen, Trash2, AlertTriangle, Inbox, User,
} from "lucide-react";

type Conversa = {
  id: number;
  username?: string | null;
  nome?: string | null;
  foto_url?: string | null;
  status?: string | null;
  janela_expira_em?: string | null;
  nao_lidas?: number | null;
  revisao_pendente?: boolean | null;
  revisada_em?: string | null;
  revisada_por?: string | null;
  prioridade?: string | null;
  intencao?: string | null;
  categoria?: string | null;
  tray_customer_id?: string | number | null;
  ultima_mensagem_em?: string | null;
  ultima_mensagem?: string | null;
  ultima_mensagem_texto?: string | null;
  /** Por que a Anna escalou a conversa (status 'escalada') */
  motivo_escalonamento?: string | null;
  // vw_ig_conversas_lista — prévia e estado já resolvidos pelo banco
  ultima_previa?: string | null;
  ultima_direcao?: string | null;
  ultimo_tipo?: string | null;
  ultima_origem?: string | null;
  janela_aberta?: boolean | null;
  horas_restantes?: number | null;
  e_lead?: boolean | null;
  lead_status?: string | null;
  tem_cadastro?: boolean | null;
  peso?: number | null;
};

type Mensagem = {
  id: number;
  conversa_id: number;
  direcao?: string | null;
  conteudo?: string | null;
  origem?: string | null;
  status?: string | null;
  erro?: string | null;
  criado_em?: string | null;
  // Contexto de story/mídia (vw_ig_mensagens_painel)
  tipo?: string | null;
  /** Reels compartilhado: media_id do post quando é da marca (null = outra conta) */
  ref_media_id?: string | null;
  contexto_rotulo?: string | null;
  imagem_url?: string | null;
  story_link?: string | null;
  story_produto_id?: string | null;
  story_produto_nome?: string | null;
  look_descricao?: string | null;
  look_confianca?: string | null;
  look_produtos_nomes?: string[] | string | null;
  look_analisado?: boolean | null;
  look_produto_confirmado_id?: string | null;
};

type Filtro = "nao_lidas" | "janela" | "revisao" | "leads" | "todas";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "nao_lidas", label: "Não lidas" },
  { key: "janela", label: "Janela aberta" },
  { key: "revisao", label: "Revisão pendente" },
  { key: "leads", label: "São leads" },
  { key: "todas", label: "Todas" },
];

/** Fila de trabalho: 25 por vez, com scroll infinito. */
const POR_PAGINA = 25;
/** Conversa longa abre com as 50 últimas; o resto vem sob demanda. */
const POR_PAGINA_MSGS = 50;

function ChipStatus({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status.toLowerCase();
  // 'em_atendimento' = uma consultora assumiu; a Anna está fora desta conversa
  const comConsultora = s.includes("em_atendimento");
  const cls = s.includes("escalad")
    ? "bg-warning/10 text-warning border-warning/20"
    : s.includes("resolvid")
      ? "bg-success/10 text-success border-success/20"
      : comConsultora
        ? "bg-primary/10 text-primary border-primary/20"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {comConsultora ? "Com a consultora" : status}
    </span>
  );
}

/** Avatar circular com foto de perfil; cai para ícone neutro se faltar ou falhar. */
function AvatarConversa({
  foto,
  nome,
  tamanho = "h-9 w-9",
}: {
  foto?: string | null;
  nome?: string | null;
  tamanho?: string;
}) {
  const [erro, setErro] = useState(false);
  if (foto && !erro) {
    return (
      <img
        src={foto}
        alt={nome ? `Foto de ${nome}` : "Foto de perfil"}
        className={`${tamanho} rounded-full object-cover shrink-0 bg-muted`}
        loading="lazy"
        onError={() => setErro(true)}
      />
    );
  }
  return (
    <div className={`${tamanho} rounded-full bg-muted flex items-center justify-center shrink-0`}>
      <User className="h-1/2 w-1/2 text-muted-foreground/50" />
    </div>
  );
}

export function AtendimentoTab() {
  const { user } = useAuth();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [pendentesAprovacao, setPendentesAprovacao] = useState<Set<number>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [temMais, setTemMais] = useState(false);
  const [contagens, setContagens] = useState<Record<Filtro, number>>({
    nao_lidas: 0, janela: 0, revisao: 0, leads: 0, todas: 0,
  });
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [selId, setSelId] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregandoMsgs, setCarregandoMsgs] = useState(false);
  const [limiteMsgs, setLimiteMsgs] = useState(POR_PAGINA_MSGS);
  const [temMsgsAntigas, setTemMsgsAntigas] = useState(false);
  const [texto, setTexto] = useState("");
  /** Reels compartilhados da marca: dados do post por ref_media_id (media_id) */
  const [postsReel, setPostsReel] = useState<Map<string, PostReel>>(new Map());
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [janelaFechada409, setJanelaFechada409] = useState(false);
  const [painelAberto, setPainelAberto] = useState(true);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const paginaRef = useRef(0);
  const sentinelaRef = useRef<HTMLDivElement | null>(null);
  // Re-render a cada 30s para contagens regressivas e tempos relativos
  const [, tick] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, []);

  /**
   * Lista sempre pela view: uma linha por conversa, com prévia pronta.
   * Nunca consultar instagram_mensagens aqui — era isso que empilhava a página.
   */
  const consulta = useCallback((f: Filtro) => {
    let q = db.from("vw_ig_conversas_lista").select("*", { count: "exact" });
    if (f === "nao_lidas") q = q.or("nao_lidas.gt.0,revisao_pendente.is.true");
    if (f === "janela") q = q.eq("janela_aberta", true);
    if (f === "revisao") q = q.eq("revisao_pendente", true);
    if (f === "leads") q = q.eq("e_lead", true);
    return q
      .order("peso", { ascending: false })
      .order("ultima_mensagem_em", { ascending: false });
  }, []);

  const carregarPagina = useCallback(
    async (pagina: number, f: Filtro) => {
      const { data, count, error } = await consulta(f).range(
        pagina * POR_PAGINA,
        (pagina + 1) * POR_PAGINA - 1,
      );
      if (error) {
        toast.error("Falha ao carregar conversas", { description: error.message });
        return;
      }
      const linhas = (data ?? []) as Conversa[];
      paginaRef.current = pagina;
      setConversas((prev) => (pagina === 0 ? linhas : [...prev, ...linhas]));
      const carregadas = pagina * POR_PAGINA + linhas.length;
      setTemMais(count != null ? carregadas < count : linhas.length === POR_PAGINA);
    },
    [consulta],
  );

  const carregarContagens = useCallback(async () => {
    const chaves: Filtro[] = ["nao_lidas", "janela", "revisao", "leads", "todas"];
    const res = await Promise.all(chaves.map((k) => consulta(k).range(0, 0)));
    setContagens(
      Object.fromEntries(chaves.map((k, i) => [k, res[i].count ?? 0])) as Record<Filtro, number>,
    );
  }, [consulta]);

  /** Recarrega a primeira página do filtro atual (usado também pelo realtime). */
  const carregarConversas = useCallback(async () => {
    const [, , { data: pend }] = await Promise.all([
      carregarPagina(0, filtro),
      carregarContagens(),
      db.from("instagram_mensagens").select("conversa_id").eq("status", "aguardando_aprovacao"),
    ]);
    setPendentesAprovacao(new Set((pend ?? []).map((p: any) => p.conversa_id)));
    setCarregando(false);
  }, [carregarPagina, carregarContagens, filtro]);

  const carregarMais = useCallback(async () => {
    if (carregandoMais || !temMais) return;
    setCarregandoMais(true);
    await carregarPagina(paginaRef.current + 1, filtro);
    setCarregandoMais(false);
  }, [carregandoMais, temMais, carregarPagina, filtro]);

  // Scroll infinito: fila de trabalho, a consultora desce até achar
  useEffect(() => {
    const alvo = sentinelaRef.current;
    if (!alvo) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) carregarMais();
      },
      { rootMargin: "200px" },
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, [carregarMais]);

  /** Reels da marca compartilhados na conversa: enriquece com miniatura, legenda e permalink do post. */
  const enriquecerReels = useCallback(async (lista: Mensagem[]) => {
    const ids = [
      ...new Set(
        lista.filter((m) => ehReelCompartilhado(m) && m.ref_media_id).map((m) => m.ref_media_id as string),
      ),
    ];
    if (ids.length === 0) {
      setPostsReel(new Map());
      return;
    }
    const mapa = new Map<string, PostReel>();
    // Mapeamento client-side (sem join) — PostgREST tem cache instável com views aninhadas
    try {
      const { data: ps } = await db.from("instagram_posts").select("*").in("media_id", ids);
      for (const p of (ps ?? []) as any[]) mapa.set(p.media_id, p as PostReel);
    } catch {
      /* tabela indisponível — card sai sem enriquecimento */
    }
    // Capa escolhida no agendamento e legenda editorial têm prioridade
    try {
      const { data: pubs } = await db
        .from("instagram_publicacoes")
        .select("media_id, capa_url, legenda, permalink")
        .in("media_id", ids);
      for (const p of (pubs ?? []) as any[]) {
        const ex = mapa.get(p.media_id) ?? ({ media_id: p.media_id } as PostReel);
        mapa.set(p.media_id, {
          ...ex,
          capa_url: ex.capa_url ?? p.capa_url,
          legenda: ex.caption ?? ex.legenda ?? p.legenda,
          permalink: ex.permalink ?? p.permalink,
        });
      }
    } catch {
      /* sem capa/legenda do agendamento — segue com o cache da Meta */
    }
    setPostsReel(mapa);
  }, []);

  // Fonte única: a view resolve reply_to.story, link sticker, cache de mídia
  // e análise de imagem — o front não precisa conhecer essas tabelas.
  const carregarMensagens = useCallback(
    async (conversaId: number, limite = POR_PAGINA_MSGS) => {
      setCarregandoMsgs(true);
      // Últimas N (desc) + 1 para saber se há histórico anterior; exibe em ordem cronológica
      const buscar = (tabela: string) =>
        db
          .from(tabela)
          .select("*")
          .eq("conversa_id", conversaId)
          .order("criado_em", { ascending: false })
          .limit(limite + 1);
      let { data, error } = await buscar("vw_ig_mensagens_painel");
      if (error) {
        // Fallback para a tabela crua caso a view ainda não exista no banco
        ({ data } = await buscar("instagram_mensagens"));
      }
      const linhas = (data ?? []) as Mensagem[];
      setTemMsgsAntigas(linhas.length > limite);
      const lista = linhas.slice(0, limite).reverse();
      setMensagens(lista);
      enriquecerReels(lista);
      setCarregandoMsgs(false);
    },
    [enriquecerReels],
  );

  const verAnteriores = useCallback(() => {
    if (!selId) return;
    const novo = limiteMsgs + POR_PAGINA_MSGS;
    setLimiteMsgs(novo);
    carregarMensagens(selId, novo);
  }, [selId, limiteMsgs, carregarMensagens]);

  /** Confirmação manual da peça (menção a story com confiança média/baixa). */
  const confirmarProdutoMsg = useCallback((mensagemId: number, p: ProdutoPai) => {
    setMensagens((prev) =>
      prev.map((m) =>
        m.id === mensagemId
          ? { ...m, look_produto_confirmado_id: p.produto_id, story_produto_nome: p.nome }
          : m,
      ),
    );
  }, []);

  useEffect(() => {
    carregarConversas();
  }, [carregarConversas]);

  // Realtime: mensagem/conversa nova aparece sem recarregar
  useEffect(() => {
    const ch = supabase
      .channel("ig-atendimento")
      .on("postgres_changes", { event: "*", schema: "public", table: "instagram_mensagens" }, () => {
        carregarConversas();
        if (selId) carregarMensagens(selId);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "instagram_conversas" }, () => {
        carregarConversas();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [selId, carregarConversas, carregarMensagens]);

  const abrirConversa = async (c: Conversa) => {
    setSelId(c.id);
    setTexto("");
    setEditandoId(null);
    setJanelaFechada409(false);
    carregarMensagens(c.id);
    // Abrir NÃO marca como lida — a equipe dá baixa manualmente,
    // senão a regra de revisar as respostas da Anna perde o sentido.
  };

  /** Não lida = mensagens não lidas ou resposta da Anna aguardando revisão. */
  const naoLida = (c: Conversa) => (c.nao_lidas ?? 0) > 0 || !!c.revisao_pendente;

  const marcar = async (c: Conversa, lida: boolean) => {
    try {
      const r = await marcarConversaLida(c.id, lida, user?.email);
      if (r?.conversa_id != null) {
        setConversas((prev) =>
          prev.map((p) =>
            p.id === r.conversa_id
              ? {
                  ...p,
                  nao_lidas: r.nao_lidas ?? p.nao_lidas,
                  revisao_pendente: r.revisao_pendente ?? false,
                  revisada_em: r.revisada_em ?? p.revisada_em,
                  revisada_por: r.revisada_por ?? p.revisada_por,
                }
              : p,
          ),
        );
      } else {
        await carregarConversas();
      }
      toast.success(lida ? "Conversa marcada como lida" : "Conversa voltou para não lida");
    } catch (e: any) {
      toast.error("Falha ao marcar conversa", { description: e?.message });
    }
  };

  const marcarTodas = async () => {
    setMarcandoTodas(true);
    try {
      await marcarTodasLidas(user?.email);
      toast.success("Todas as conversas foram marcadas como lidas");
      await carregarConversas();
    } catch (e: any) {
      toast.error("Falha ao marcar todas", { description: e?.message });
    } finally {
      setMarcandoTodas(false);
    }
  };

  const conversaSel = conversas.find((c) => c.id === selId) ?? null;
  const janela = janelaInfo(conversaSel?.janela_expira_em);
  const janelaBloqueada = !!janela?.expirada || janelaFechada409;

  // 2.3 — conversa com consultora ('em_atendimento'): a Anna está fora, esconde sugestão
  const statusSel = (conversaSel?.status ?? "").toLowerCase();
  const emAtendimento = statusSel.includes("em_atendimento");
  const escalada = statusSel.includes("escalad");
  const motivoEscalada =
    conversaSel?.motivo_escalonamento ??
    (conversaSel as any)?.motivo_escalada ??
    (conversaSel as any)?.motivo ??
    null;
  const [devolvendo, setDevolvendo] = useState(false);

  /** Devolve a conversa para a Anna — encerra o atendimento humano. */
  const devolver = async () => {
    if (!conversaSel || devolvendo) return;
    setDevolvendo(true);
    try {
      await devolverParaAnna(conversaSel.id, user?.email);
      toast.success("Conversa devolvida — a Anna volta a responder");
      await carregarConversas();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao devolver para a Anna");
    } finally {
      setDevolvendo(false);
    }
  };

  const sugestao = useMemo(
    () => [...mensagens].reverse().find((m) => m.status === "aguardando_aprovacao") ?? null,
    [mensagens],
  );

  const filtradas = useMemo(() => {
    return conversas.filter((c) => {
      const s = (c.status ?? "").toLowerCase();
      if (filtro === "aprovacao") return pendentesAprovacao.has(c.id);
      if (filtro === "escaladas") return s.includes("escalad");
      if (filtro === "resolvidas") return s.includes("resolvid");
      return true;
    });
  }, [conversas, filtro, pendentesAprovacao]);

  const enviar = async (opts?: { humanAgent?: boolean; mensagemId?: number; textoOverride?: string }) => {
    const corpo = (opts?.textoOverride ?? texto).trim();
    if (!corpo || !conversaSel || enviando) return;
    setEnviando(true);
    try {
      await enviarInstagram({
        tipo: "dm",
        conversa_id: conversaSel.id,
        texto: corpo,
        usuario: user?.email,
        mensagem_id: opts?.mensagemId ?? editandoId ?? undefined,
        human_agent: opts?.humanAgent ?? false,
      });
      toast.success(opts?.humanAgent ? "Enviado como atendimento humano" : "Mensagem enviada");
      setTexto("");
      setEditandoId(null);
      setJanelaFechada409(false);
      await Promise.all([carregarMensagens(conversaSel.id), carregarConversas()]);
    } catch (e: any) {
      if (e?.motivo === "janela_expirada" || (e?.status === 409 && !opts?.humanAgent)) {
        setJanelaFechada409(true);
        toast.warning(MOTIVOS_409.janela_expirada, {
          description: "Você ainda pode enviar como atendimento humano (válido por 7 dias).",
        });
      } else {
        toast.error(e?.message ?? "Falha ao enviar", { description: e?.dica });
      }
    } finally {
      setEnviando(false);
    }
  };

  const descartarSugestao = async () => {
    if (!sugestao || !conversaSel) return;
    await db.from("instagram_mensagens").update({ status: "recusada" }).eq("id", sugestao.id);
    toast.success("Sugestão descartada");
    carregarMensagens(conversaSel.id);
    carregarConversas();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]" style={{ minHeight: "calc(100vh - 240px)" }}>
      {/* ============ Coluna esquerda: lista de conversas ============ */}
      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 border-b flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filtro === f.key ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setFiltro(f.key)}
            >
              {f.label}
              {f.key === "aprovacao" && pendentesAprovacao.size > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {pendentesAprovacao.size}
                </Badge>
              )}
            </Button>
          ))}
          {conversas.some(naoLida) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" disabled={marcandoTodas}>
                  {marcandoTodas ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <MailCheck className="h-3.5 w-3.5 mr-1" />
                  )}
                  Marcar todas como lidas
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Marcar todas as conversas como lidas?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso dá baixa em todas as conversas pendentes de revisão, incluindo as respostas que a
                    Anna enviou e ninguém revisou ainda.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={marcarTodas}>Sim, marcar todas</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <ScrollArea className="flex-1">
          {carregando ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhuma conversa neste filtro.
            </div>
          ) : (
            filtradas.map((c) => {
              const j = janelaInfo(c.janela_expira_em);
              const ativa = c.id === selId;
              const nl = naoLida(c);
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => abrirConversa(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") abrirConversa(c);
                  }}
                  className={`group w-full text-left px-3 py-2.5 border-b transition-colors hover:bg-accent/50 cursor-pointer ${
                    ativa ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <AvatarConversa foto={c.foto_url} nome={c.nome} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {c.nome || (c.username ? `@${c.username}` : "Nova conversa")}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                role="button"
                                tabIndex={-1}
                                aria-label={nl ? "Marcar como lida" : "Marcar como não lida"}
                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  marcar(c, nl);
                                }}
                              >
                                {nl ? <MailOpen className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              {nl ? "Marcar como lida" : "Marcar como não lida"}
                            </TooltipContent>
                          </Tooltip>
                          <span className="text-[10px] text-muted-foreground">
                            {tempoRelativo(c.ultima_mensagem_em)}
                          </span>
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {c.username ? `@${c.username}` : "Carregando perfil..."}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {c.ultima_mensagem ?? c.ultima_mensagem_texto ?? ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {(c.nao_lidas ?? 0) > 0 && (
                      <Badge className="h-4 px-1.5 text-[10px]">{c.nao_lidas}</Badge>
                    )}
                    {c.revisao_pendente && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 text-warning px-2 py-0.5 text-[10px] font-semibold">
                        <Bot className="h-3 w-3" /> Revisar Anna
                      </span>
                    )}
                    <ChipStatus status={c.status} />
                    {j && (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${j.classe}`}
                      >
                        {j.expirada ? j.label : `Janela ${j.label}`}
                      </span>
                    )}
                    {pendentesAprovacao.has(c.id) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                        <Bot className="h-3 w-3" /> Aprovar
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </ScrollArea>
      </Card>

      {/* ============ Coluna direita: conversa aberta ============ */}
      {!conversaSel ? (
        <Card className="flex items-center justify-center">
          <div className="text-center text-muted-foreground p-8">
            <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Selecione uma conversa para responder.</p>
            <p className="text-xs mt-1">A janela de 24h aparece em cada item da lista.</p>
          </div>
        </Card>
      ) : (
        <div className="flex gap-4 min-w-0">
          <Card className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Header da conversa */}
            <div className="p-3 border-b flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <AvatarConversa foto={conversaSel.foto_url} nome={conversaSel.nome} tamanho="h-10 w-10" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {conversaSel.nome || (conversaSel.username ? `@${conversaSel.username}` : "Nova conversa")}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {conversaSel.username ? `@${conversaSel.username}` : "Carregando perfil..."}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <ChipStatus status={conversaSel.status} />
                    {janela && (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${janela.classe}`}
                      >
                        {janela.expirada ? "Janela de 24h expirada" : `Janela: ${janela.label} restantes`}
                      </span>
                    )}
                  </div>
                  {/* Escalada mostra o motivo — sem caça ao porquê */}
                  {escalada && motivoEscalada && (
                    <p className="text-[11px] mt-1 rounded border border-warning/30 bg-warning/10 p-1.5 flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-px" />
                      <span>A Anna escalou: {motivoEscalada}</span>
                    </p>
                  )}
                  {conversaSel.revisada_em && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Revisada por {conversaSel.revisada_por ?? "equipe"},{" "}
                      {new Date(conversaSel.revisada_em).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {emAtendimento && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        disabled={devolvendo}
                        onClick={devolver}
                      >
                        {devolvendo ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Bot className="h-3.5 w-3.5" />
                        )}
                        Devolver para a Anna
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Encerra o atendimento humano — a Anna volta a responder esta conversa
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={naoLida(conversaSel) ? "Marcar como lida" : "Marcar como não lida"}
                      onClick={() => marcar(conversaSel, naoLida(conversaSel))}
                    >
                      {naoLida(conversaSel) ? (
                        <MailOpen className="h-4 w-4" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {naoLida(conversaSel) ? "Marcar como lida" : "Marcar como não lida"}
                  </TooltipContent>
                </Tooltip>
                <Button variant="ghost" size="icon" onClick={() => setPainelAberto((v) => !v)}>
                  {painelAberto ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Histórico */}
            <ScrollArea className="flex-1 p-4">
              {carregandoMsgs ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className={`h-10 w-2/3 ${i % 2 ? "ml-auto" : ""}`} />
                  ))}
                </div>
              ) : mensagens.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma mensagem nesta conversa ainda.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {mensagens.map((m) => {
                    const saida = m.direcao === "saida";
                    const anna = m.origem === "anna";
                    return (
                      <div key={m.id} className={`flex ${saida ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                            saida
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted rounded-bl-sm"
                          } ${m.status === "recusada" ? "opacity-40 line-through" : ""} ${
                            m.status === "falhou" ? "border border-danger/40" : ""
                          }`}
                        >
                          {anna && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold opacity-70 mb-0.5">
                              <Bot className="h-3 w-3" /> Anna
                            </span>
                          )}
                          <ContextoMensagem m={m} saida={saida} onConfirmado={confirmarProdutoMsg} />
                          {ehReelCompartilhado(m) ? (
                            <>
                              <ReelCompartilhado
                                m={m}
                                post={m.ref_media_id ? postsReel.get(m.ref_media_id) : null}
                                saida={saida}
                              />
                              {/* Texto além do "[anexo: ig_reel]" (comentário da cliente ao compartilhar).
                                  Se o que sobra é só o link — já exibido no card — não repete. */}
                              {textoSemAnexo(m.conteudo) &&
                                textoSemAnexo(m.conteudo) !== extrairLinkInsta(m.conteudo) && (
                                  <p className="whitespace-pre-wrap break-words">{textoSemAnexo(m.conteudo)}</p>
                                )}
                            </>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
                          )}
                          <div className={`text-[10px] mt-1 ${saida ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {tempoRelativo(m.criado_em)}
                            {m.status === "falhou" && " · falhou"}
                            {m.status === "aguardando_aprovacao" && " · aguardando aprovação"}
                          </div>
                          {m.erro && <p className="text-[10px] text-danger mt-1">{m.erro}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Sugestão da Anna — some quando uma consultora assumiu a conversa */}
            {sugestao && !emAtendimento && (
              <div className="mx-3 mb-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                  <Bot className="h-3.5 w-3.5" /> Sugestão da Anna — revise antes de enviar
                </p>
                <p className="text-sm mt-1.5 whitespace-pre-wrap">{sugestao.conteudo}</p>
                <div className="flex gap-2 mt-2.5">
                  <Button
                    size="sm"
                    disabled={enviando || janelaBloqueada}
                    onClick={() => enviar({ mensagemId: sugestao.id, textoOverride: sugestao.conteudo ?? "" })}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Aprovar e enviar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={enviando}
                    onClick={() => {
                      setTexto(sugestao.conteudo ?? "");
                      setEditandoId(sugestao.id);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" disabled={enviando} onClick={descartarSugestao}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Descartar
                  </Button>
                </div>
              </div>
            )}

            {/* Aviso de janela fechada */}
            {janelaBloqueada && (
              <div className="mx-3 mb-2 rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold">A janela de 24 horas dessa conversa fechou.</p>
                  <p className="text-muted-foreground mt-0.5">
                    Você ainda pode responder como atendimento humano (válido por 7 dias).
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={enviando || !texto.trim()}
                    onClick={() => enviar({ humanAgent: true })}
                  >
                    {enviando ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <SendHorizonal className="h-3.5 w-3.5 mr-1" />}
                    Enviar como atendimento humano (válido por 7 dias)
                  </Button>
                </div>
              </div>
            )}

            {/* Campo de resposta */}
            <div className="p-3 border-t">
              {editandoId && (
                <p className="text-[10px] text-primary mb-1.5 flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> Editando a sugestão da Anna — ao enviar, ela será aprovada com suas alterações.
                </p>
              )}
              <div className="flex gap-2 items-end">
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={
                    janelaBloqueada
                      ? "Escreva a resposta — será enviada como atendimento humano…"
                      : "Escreva sua resposta…"
                  }
                  className="min-h-[44px] max-h-32 resize-none"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (janelaBloqueada) enviar({ humanAgent: true });
                      else enviar();
                    }
                  }}
                />
                {!janelaBloqueada && (
                  <Button disabled={enviando || !texto.trim()} onClick={() => enviar()}>
                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Painel lateral de contexto */}
          {painelAberto && (
            <Card className="w-64 shrink-0 hidden xl:block">
              <CardContent className="p-4 space-y-3 text-sm">
                <p className="font-semibold text-xs uppercase tracking-widest text-muted-foreground">
                  Contexto
                </p>
                <Separator />
                <div className="flex flex-col items-center gap-1.5 py-1 text-center">
                  <AvatarConversa foto={conversaSel.foto_url} nome={conversaSel.nome} tamanho="h-20 w-20" />
                  <p className="text-sm font-medium">{conversaSel.nome || "—"}</p>
                  {conversaSel.username && (
                    <a
                      href={`https://instagram.com/${conversaSel.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                    >
                      instagram.com/{conversaSel.username} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Intenção</p>
                  <p className="font-medium">{conversaSel.intencao || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Categoria</p>
                  <p className="font-medium">{conversaSel.categoria || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Prioridade</p>
                  <p className="font-medium">{conversaSel.prioridade || "—"}</p>
                </div>
                {conversaSel.tray_customer_id != null && conversaSel.tray_customer_id !== "" && (
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <a
                      href={`/audiencia?cliente=${conversaSel.tray_customer_id}`}
                      className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                    >
                      Ver cadastro <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
