import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { db, enviarInstagram, marcarConversaLida, marcarTodasLidas, MOTIVOS_409 } from "@/lib/socialCommerce";
import { tempoRelativo, janelaInfo } from "./comum";
import { ContextoMensagem } from "./ContextoMensagem";
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

type Filtro = "todas" | "aprovacao" | "escaladas" | "resolvidas";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "aprovacao", label: "Aguardando aprovação" },
  { key: "escaladas", label: "Escaladas" },
  { key: "resolvidas", label: "Resolvidas" },
];

function ChipStatus({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const cls = s.includes("escalad")
    ? "bg-warning/10 text-warning border-warning/20"
    : s.includes("resolvid")
      ? "bg-success/10 text-success border-success/20"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status}
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
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [selId, setSelId] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregandoMsgs, setCarregandoMsgs] = useState(false);
  const [texto, setTexto] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [janelaFechada409, setJanelaFechada409] = useState(false);
  const [painelAberto, setPainelAberto] = useState(true);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  // Re-render a cada 30s para contagens regressivas e tempos relativos
  const [, tick] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, []);

  const carregarConversas = useCallback(async () => {
    const [{ data: convs }, { data: pend }] = await Promise.all([
      db.from("instagram_conversas").select("*").order("ultima_mensagem_em", { ascending: false }).limit(300),
      db.from("instagram_mensagens").select("conversa_id").eq("status", "aguardando_aprovacao"),
    ]);
    setConversas((convs ?? []) as Conversa[]);
    setPendentesAprovacao(new Set((pend ?? []).map((p: any) => p.conversa_id)));
    setCarregando(false);
  }, []);

  // Fonte única: a view resolve reply_to.story, link sticker, cache de mídia
  // e análise de imagem — o front não precisa conhecer essas tabelas.
  const carregarMensagens = useCallback(async (conversaId: number) => {
    setCarregandoMsgs(true);
    const { data, error } = await db
      .from("vw_ig_mensagens_painel")
      .select("*")
      .eq("conversa_id", conversaId)
      .order("criado_em", { ascending: true })
      .limit(500);
    if (error) {
      // Fallback para a tabela crua caso a view ainda não exista no banco
      const { data: crua } = await db
        .from("instagram_mensagens")
        .select("*")
        .eq("conversa_id", conversaId)
        .order("criado_em", { ascending: true })
        .limit(500);
      setMensagens((crua ?? []) as Mensagem[]);
    } else {
      setMensagens((data ?? []) as Mensagem[]);
    }
    setCarregandoMsgs(false);
  }, []);

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
                          <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
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

            {/* Sugestão da Anna */}
            {sugestao && (
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
