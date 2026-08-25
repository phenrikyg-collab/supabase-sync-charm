import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, enviarInstagram } from "@/lib/socialCommerce";
import { brl } from "@/lib/financeiroFormat";
import {
  ConfigLive, Kit, Live, ResultadoBusca, buscarComentariosLive, dataHoraLonga,
  normalizarGatilho, problemasTexto, restante,
} from "@/lib/kitsLive";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowDown, Copy, Loader2, MessageSquare, Package, Search, Send, ShoppingCart, Users, X, Zap,
} from "lucide-react";

export type ComentarioLive = {
  id: string | number;
  comment_id?: string | null;
  media_id?: string | null;
  from_username?: string | null;
  texto?: string | null;
  publicado_em?: string | null;
  status?: string | null;
  kit_id?: string | number | null;
  intencao?: string | null;
  resposta_texto?: string | null;
  respondido_em?: string | null;
  aprovado_por?: string | null;
  private_reply_usada?: boolean | null;
};

type Carrinho = Record<string, any>;

const ATALHOS_PADRAO = ["Te chamei no Direct 💛", "Qual seu tamanho?", "Link na bio 💛"];

function horaHHMM(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Contador({ icone: Icone, label, valor }: { icone: any; label: string; valor: string | number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icone className="h-3.5 w-3.5" />
      <span className="font-semibold text-foreground">{valor}</span>
      <span>{label}</span>
    </div>
  );
}

export function LiveChat({
  config,
  kits,
  onToggleAtivo,
}: {
  config: ConfigLive;
  kits: Kit[];
  onToggleAtivo: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const mediaId = config.media_id_atual ?? null;

  const [comentarios, setComentarios] = useState<ComentarioLive[]>([]);
  const [carrinhos, setCarrinhos] = useState<Carrinho[]>([]);
  const [selecionado, setSelecionado] = useState<ComentarioLive | null>(null);
  const [modo, setModo] = useState<"comentario" | "private_reply">("comentario");
  const [texto, setTexto] = useState("");
  const [enviandoId, setEnviandoId] = useState<string | number | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [pausado, setPausado] = useState(false);
  const [noFim, setNoFim] = useState(true);
  const [agora, setAgora] = useState(Date.now());

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const balaoRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const nomesKits = useMemo(() => {
    const m = new Map<string, string>();
    kits.forEach((k) => k.id != null && m.set(String(k.id), k.nome));
    return m;
  }, [kits]);

  const palavras = useMemo(() => {
    const set = new Set<string>();
    (config.palavras_gatilho ?? []).forEach((p) => set.add(normalizarGatilho(p)));
    kits.forEach((k) => k.gatilhos.forEach((g) => set.add(normalizarGatilho(g))));
    return [...set].filter(Boolean);
  }, [config.palavras_gatilho, kits]);

  const temIntencao = useCallback(
    (c: ComentarioLive) => {
      if (c.kit_id != null) return true;
      if ((c.intencao ?? "").startsWith("kit:")) return true;
      const t = normalizarGatilho(c.texto ?? "");
      return !!t && palavras.some((p) => t.includes(p));
    },
    [palavras],
  );

  const carregarComentarios = useCallback(async () => {
    if (!mediaId) {
      setComentarios([]);
      return;
    }
    const { data } = await db
      .from("instagram_comentarios")
      .select("*")
      .eq("media_id", mediaId)
      .order("publicado_em", { ascending: true })
      .limit(500);
    setComentarios((data ?? []) as ComentarioLive[]);
  }, [mediaId]);

  const carregarCarrinhos = useCallback(async () => {
    if (!config.ativado_em) {
      setCarrinhos([]);
      return;
    }
    const { data } = await db
      .from("vw_carrinhos_tray")
      .select("*")
      .eq("canal", "instagram")
      .gte("criado_em", config.ativado_em)
      .order("criado_em", { ascending: false })
      .limit(100);
    setCarrinhos((data ?? []) as Carrinho[]);
  }, [config.ativado_em]);

  useEffect(() => {
    carregarComentarios();
  }, [carregarComentarios]);

  useEffect(() => {
    carregarCarrinhos();
    const t = setInterval(carregarCarrinhos, 15_000);
    return () => clearInterval(t);
  }, [carregarCarrinhos]);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // realtime dos comentários da live
  useEffect(() => {
    if (!mediaId) return;
    const ch = db
      .channel(`live-chat-${mediaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instagram_comentarios", filter: `media_id=eq.${mediaId}` },
        () => carregarComentarios(),
      )
      .subscribe();
    return () => {
      db.removeChannel(ch);
    };
  }, [mediaId, carregarComentarios]);

  // rolagem automática
  useEffect(() => {
    if (noFim && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comentarios, noFim]);

  const aoRolar = () => {
    const el = scrollRef.current;
    if (!el) return;
    setNoFim(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const irParaOFim = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setNoFim(true);
  };

  const ultimoComentario = comentarios[comentarios.length - 1]?.publicado_em;
  const expirou = !!config.expira_em && new Date(config.expira_em).getTime() <= agora;
  const semNovidade =
    !!ultimoComentario && agora - new Date(ultimoComentario).getTime() > 30 * 60 * 1000;
  const encerrada = !!mediaId && (expirou || semNovidade);
  const podeResponder = !!mediaId && !encerrada;

  const fila = useMemo(
    () => comentarios.filter(temIntencao).filter((c) => c.status !== "removido").slice().reverse(),
    [comentarios, temIntencao],
  );

  const totalCarrinhos = useMemo(
    () =>
      carrinhos.reduce(
        (s, c) => s + (Number(c.total ?? c.valor_total ?? c.valor ?? 0) || 0),
        0,
      ),
    [carrinhos],
  );

  const directsEnviados = comentarios.filter((c) => !!c.private_reply_usada).length;

  const pausarAutomaticas = async (v: boolean) => {
    if (!mediaId) return;
    setPausado(v);
    const { error } = await db
      .from("instagram_post_automacao")
      .update({ ativo: !v })
      .eq("media_id", mediaId);
    if (error) {
      setPausado(!v);
      toast.error(error.message ?? "Não foi possível alterar as respostas automáticas.");
    }
  };

  const selecionar = (c: ComentarioLive, novoModo: "comentario" | "private_reply") => {
    setSelecionado(c);
    setModo(novoModo);
    setTexto(novoModo === "comentario" ? `@${c.from_username ?? ""} ` : "");
  };

  const rolarAte = (c: ComentarioLive) => {
    const el = balaoRefs.current[String(c.id)];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    selecionar(c, "comentario");
  };

  const enviar = async () => {
    if (!selecionado || !texto.trim()) return;
    const problemas = problemasTexto(texto);
    if (problemas.length) {
      problemas.forEach((p) => toast.error(p));
      return;
    }
    const alvo = selecionado;
    const chave = String(alvo.id);
    setEnviandoId(chave);
    setErros((e) => ({ ...e, [chave]: "" }));
    try {
      await enviarInstagram({
        tipo: modo,
        comentario_id: alvo.comment_id ?? alvo.id,
        texto: texto.trim(),
        usuario: user?.email ?? null,
      });
      setTexto("");
      setSelecionado(null);
      await carregarComentarios();
      irParaOFim();
    } catch (e: any) {
      const motivo = e?.motivo;
      const msg =
        motivo === "ja_usada"
          ? "Direct já enviado para este comentário"
          : motivo === "fora_do_prazo" || motivo === "janela_expirada"
            ? "A live acabou, não dá mais para responder este comentário"
            : (e?.message ?? "Falha ao enviar.");
      setErros((er) => ({ ...er, [chave]: msg }));
      toast.error(msg);
    } finally {
      setEnviandoId(null);
    }
  };

  const atalhos = [...(config.respostas_publicas ?? []), ...ATALHOS_PADRAO];

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-xl border bg-card">
        {/* cabeçalho */}
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${config.ativo ? "animate-pulse bg-success" : "bg-muted-foreground/40"}`}
            />
            <span className="text-sm font-medium">{config.ativo ? "LIGADA" : "DESLIGADA"}</span>
            <Switch checked={config.ativo} onCheckedChange={onToggleAtivo} />
            {restante(config.expira_em) && (
              <Badge variant="outline" className="text-[10px]">
                expira em {restante(config.expira_em)}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Contador icone={MessageSquare} label="comentários" valor={comentarios.length} />
            <Contador icone={Zap} label="quer comprar" valor={fila.length} />
            <Contador icone={Users} label="Direct enviados" valor={directsEnviados} />
            <Contador icone={ShoppingCart} label="carrinhos" valor={carrinhos.length} />
            <Contador icone={Package} label="em carrinhos" valor={brl(totalCarrinhos)} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Switch id="pausar" checked={pausado} onCheckedChange={pausarAutomaticas} disabled={!mediaId} />
            <Label htmlFor="pausar" className="cursor-pointer text-xs">
              Pausar respostas automáticas
            </Label>
          </div>
        </div>

        {encerrada && (
          <div className="border-b bg-muted px-4 py-2 text-xs text-muted-foreground">
            Live encerrada. Os comentários ficam como histórico; não é mais possível responder.
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[7fr_3fr]">
          {/* fluxo */}
          <div className="relative flex min-h-0 flex-col border-r">
            <div ref={scrollRef} onScroll={aoRolar} className="flex-1 space-y-3 overflow-y-auto p-4">
              {!mediaId || comentarios.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum comentário da live ainda. Assim que a live começar, eles aparecem aqui em tempo real.
                </p>
              ) : (
                comentarios.map((c) => {
                  const chave = String(c.id);
                  const removido = c.status === "removido";
                  const kitNome = c.kit_id != null ? nomesKits.get(String(c.kit_id)) : null;
                  const quer = temIntencao(c);
                  const enviando = enviandoId === chave;
                  return (
                    <div key={chave} ref={(el) => (balaoRefs.current[chave] = el)} className="space-y-1.5">
                      <div className={`group flex items-start gap-2 ${removido ? "opacity-50" : ""}`}>
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                          {(c.from_username ?? "?").slice(0, 1)}
                        </div>
                        <div
                          className={`max-w-[80%] rounded-2xl rounded-tl-sm border bg-muted/40 px-3 py-2 ${
                            quer ? "border-primary/60 ring-1 ring-primary/30" : ""
                          } ${selecionado?.id === c.id ? "ring-2 ring-primary" : ""}`}
                        >
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <strong className="text-foreground">@{c.from_username ?? "cliente"}</strong>
                            <span>{horaHHMM(c.publicado_em)}</span>
                            {kitNome && (
                              <Badge variant="secondary" className="gap-1 text-[10px]">
                                <Package className="h-3 w-3" /> {kitNome}
                              </Badge>
                            )}
                            {c.private_reply_usada && (
                              <Badge variant="outline" className="text-[10px]">Direct enviado</Badge>
                            )}
                            {c.status === "respondido" && (
                              <Badge variant="outline" className="border-success/30 bg-success/10 text-[10px] text-success">
                                Respondido
                              </Badge>
                            )}
                            {removido && <Badge variant="outline" className="text-[10px]">Removido</Badge>}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm">{c.texto}</p>
                          {!removido && podeResponder && (
                            <div className="mt-1.5 hidden gap-1 group-hover:flex">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => selecionar(c, "comentario")}>
                                Responder
                              </Button>
                              {c.private_reply_usada ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" disabled>
                                        Direct
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>Direct já enviado a partir deste comentário</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => selecionar(c, "private_reply")}>
                                  Direct
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {enviando && (
                        <div className="flex justify-end">
                          <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
                            enviando…
                          </div>
                        </div>
                      )}

                      {c.resposta_texto && (
                        <div className="flex justify-end">
                          <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary/10 px-3 py-2">
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <strong className="text-foreground">{c.aprovado_por || "Anna"}</strong>
                              <span>{horaHHMM(c.respondido_em)}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm">{c.resposta_texto}</p>
                          </div>
                        </div>
                      )}

                      {erros[chave] && (
                        <div className="flex items-center justify-end gap-2 text-[11px] text-danger">
                          <span>{erros[chave]}</span>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={enviar}>
                            tentar de novo
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {!noFim && (
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-28 left-1/2 h-8 -translate-x-1/2 gap-1 shadow"
                onClick={irParaOFim}
              >
                <ArrowDown className="h-3.5 w-3.5" /> ir para o fim
              </Button>
            )}

            {podeResponder && (
              <div className="border-t p-3">
                {selecionado && (
                  <div
                    className={`mb-2 flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
                      modo === "private_reply"
                        ? "border-purple-400/40 bg-purple-500/10 text-purple-500"
                        : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <span className="flex-1">
                      {modo === "private_reply"
                        ? `Direct para @${selecionado.from_username ?? "cliente"}`
                        : `Respondendo a @${selecionado.from_username ?? "cliente"}: ${selecionado.texto ?? ""}`}
                    </span>
                    <button onClick={() => { setSelecionado(null); setTexto(""); }} aria-label="cancelar">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="mb-2 flex flex-wrap gap-1.5">
                  {atalhos.map((a) => (
                    <button
                      key={a}
                      type="button"
                      disabled={!selecionado}
                      onClick={() => setTexto(a)}
                      className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      {a}
                    </button>
                  ))}
                </div>

                <div className="flex items-end gap-2">
                  <Textarea
                    rows={2}
                    value={texto}
                    disabled={!selecionado}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        enviar();
                      }
                    }}
                    placeholder={selecionado ? "Escreva a resposta…" : "Escolha um comentário para responder"}
                    className="resize-none"
                  />
                  <Button onClick={enviar} disabled={!selecionado || !texto.trim() || !!enviandoId} size="icon">
                    {enviandoId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="mt-1 text-right text-[10px] text-muted-foreground">{texto.length} caracteres</p>
              </div>
            )}
          </div>

          {/* fila de leads */}
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
              <Zap className="h-4 w-4" /> Quer comprar
              <Badge variant="secondary" className="text-[10px]">{fila.length}</Badge>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {fila.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Ninguém na fila ainda.</p>
              ) : (
                fila.map((c) => (
                  <button
                    key={String(c.id)}
                    onClick={() => rolarAte(c)}
                    className="w-full rounded-lg border p-2 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <strong className="text-foreground">@{c.from_username ?? "cliente"}</strong>
                      <span>{horaHHMM(c.publicado_em)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs">{c.texto}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.kit_id != null && nomesKits.get(String(c.kit_id)) && (
                        <Badge variant="secondary" className="text-[10px]">{nomesKits.get(String(c.kit_id))}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {c.private_reply_usada ? "Direct enviado" : "aguardando"}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="border-t">
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
                <ShoppingCart className="h-4 w-4" /> Carrinhos da live
              </div>
              <div className="max-h-52 space-y-1.5 overflow-y-auto px-3 pb-2">
                {carrinhos.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">Nenhum carrinho ainda.</p>
                ) : (
                  carrinhos.map((c, i) => {
                    const link = c.link ?? c.url ?? c.checkout_url ?? c.link_carrinho ?? null;
                    const pecas = c.pecas ?? c.qtd_itens ?? c.itens ?? c.quantidade ?? 0;
                    return (
                      <div key={c.id ?? i} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{brl(Number(c.total ?? c.valor_total ?? c.valor ?? 0) || 0)}</p>
                          <p className="text-[11px] text-muted-foreground">{pecas} peça(s)</p>
                        </div>
                        {link && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-[11px]"
                            onClick={() => {
                              navigator.clipboard.writeText(String(link));
                              toast.success("Link copiado.");
                            }}
                          >
                            <Copy className="h-3 w-3" /> copiar
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
                <span className="text-muted-foreground">Total</span>
                <strong>{brl(totalCarrinhos)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
