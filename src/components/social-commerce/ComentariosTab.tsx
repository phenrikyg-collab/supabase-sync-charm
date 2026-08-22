import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { db, enviarInstagram, comentarioForaDoPrazo, MOTIVOS_409 } from "@/lib/socialCommerce";
import { tempoRelativo } from "./comum";
import { brl } from "@/lib/financeiroFormat";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Bot, ChevronDown, ChevronUp, ExternalLink, EyeOff, ImageOff, Loader2, Mail, Megaphone,
  MessageSquare, Zap,
} from "lucide-react";

type Comentario = {
  id?: number | null;
  comment_id: string;
  media_id?: string | null;
  from_username?: string | null;
  texto?: string | null;
  publicado_em?: string | null;
  status?: string | null;
  intencao?: string | null;
  resposta_rascunho?: string | null;
  private_reply_usada?: boolean | null;
  aprovado_por?: string | null;
  erro?: string | null;
};

type PostInfo = {
  media_id: string;
  thumb_cache_url?: string | null;
  thumbnail_url?: string | null;
  media_url?: string | null;
  permalink?: string | null;
};
type ProdutoInfo = { id: string; nome_do_produto?: string | null; preco_venda?: number | null };

type FiltroStatus = "novos" | "aguardando" | "respondidos" | "ignorados";

const FILTROS: { key: FiltroStatus; label: string }[] = [
  { key: "novos", label: "Novos" },
  { key: "aguardando", label: "Aguardando aprovação" },
  { key: "respondidos", label: "Respondidos" },
  { key: "ignorados", label: "Ignorados" },
];

function statusNormalizado(c: Comentario): string {
  return (c.status ?? "novo").toLowerCase();
}

/** Miniatura do post com fallback (cache → thumbnail → mídia) e clique para o permalink. */
function ThumbPost({ post }: { post?: PostInfo }) {
  const [erro, setErro] = useState(false);
  const src = post ? post.thumb_cache_url || post.thumbnail_url || post.media_url : null;
  const conteudo =
    src && !erro ? (
      <img
        src={src}
        alt="Miniatura do post"
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setErro(true)}
      />
    ) : (
      <div className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground/50">
        <ImageOff className="h-4 w-4" />
        <span className="text-[8px] leading-none">Sem prévia</span>
      </div>
    );
  const classe =
    "w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center";
  if (post?.permalink) {
    return (
      <a
        href={post.permalink}
        target="_blank"
        rel="noopener noreferrer"
        className={`${classe} hover:opacity-80 transition-opacity`}
        title="Abrir post no Instagram"
      >
        {conteudo}
      </a>
    );
  }
  return <div className={classe}>{conteudo}</div>;
}

export function ComentariosTab() {
  const { user } = useAuth();
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [posts, setPosts] = useState<Map<string, PostInfo>>(new Map());
  const [produtosPorMedia, setProdutosPorMedia] = useState<Map<string, ProdutoInfo[]>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("novos");
  const [filtroIntencao, setFiltroIntencao] = useState<string>("todas");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [textos, setTextos] = useState<Map<string, string>>(new Map());
  const [enviando, setEnviando] = useState<string | null>(null);
  // Anúncios com comentário sem resposta e sem automação configurada (view do painel)
  const [anunciosPendentes, setAnunciosPendentes] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    const { data: coms } = await db
      .from("instagram_comentarios")
      .select("*")
      .order("publicado_em", { ascending: false })
      .limit(200);
    const lista = (coms ?? []) as Comentario[];
    setComentarios(lista);

    // Anúncios com comentário sem resposta e sem automação — lead quente parado.
    // Silencioso se a view ainda não existir no banco.
    try {
      const { data: painel, error: errPainel } = await db
        .from("vw_ig_posts_painel")
        .select("media_id, tem_automacao, automacao_ativa")
        .eq("eh_anuncio", true)
        .gt("comentarios_sem_resposta", 0);
      if (!errPainel) {
        setAnunciosPendentes(
          (painel ?? [])
            .filter((p: any) => !p.tem_automacao || !p.automacao_ativa)
            .map((p: any) => p.media_id as string),
        );
      }
    } catch {
      /* view indisponível — sem alerta */
    }

    const mediaIds = [...new Set(lista.map((c) => c.media_id).filter(Boolean))] as string[];
    if (mediaIds.length > 0) {
      const [{ data: ps }, { data: links }] = await Promise.all([
        db.from("instagram_posts").select("*").in("media_id", mediaIds),
        db.from("instagram_post_produtos").select("*").in("media_id", mediaIds),
      ]);
      setPosts(new Map((ps ?? []).map((p: any) => [p.media_id, p as PostInfo])));

      const prodIds = [...new Set((links ?? []).map((l: any) => l.produto_id).filter(Boolean))];
      let produtos: any[] = [];
      if (prodIds.length > 0) {
        const { data } = await db.from("produtos").select("id, nome_do_produto, preco_venda").in("id", prodIds);
        produtos = data ?? [];
      }
      const prodMap = new Map(produtos.map((p: any) => [p.id, p]));
      const porMedia = new Map<string, ProdutoInfo[]>();
      for (const l of links ?? []) {
        const p = prodMap.get(l.produto_id);
        if (!p) continue;
        const arr = porMedia.get(l.media_id) ?? [];
        arr.push(p);
        porMedia.set(l.media_id, arr);
      }
      setProdutosPorMedia(porMedia);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Realtime: comentário novo aparece sem recarregar
  useEffect(() => {
    const ch = supabase
      .channel("ig-comentarios")
      .on("postgres_changes", { event: "*", schema: "public", table: "instagram_comentarios" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [carregar]);

  const intencoes = useMemo(
    () => [...new Set(comentarios.map((c) => c.intencao).filter(Boolean))] as string[],
    [comentarios],
  );

  const filtrados = useMemo(() => {
    return comentarios.filter((c) => {
      const s = statusNormalizado(c);
      const okStatus =
        filtroStatus === "novos"
          ? s === "novo" || s === "nova"
          : filtroStatus === "aguardando"
            ? s === "aguardando_aprovacao"
            : filtroStatus === "respondidos"
              ? s === "respondido"
              : s === "ignorado";
      if (!okStatus) return false;
      if (filtroIntencao !== "todas" && c.intencao !== filtroIntencao) return false;
      return true;
    });
  }, [comentarios, filtroStatus, filtroIntencao]);

  const textoDe = (c: Comentario) => textos.get(c.comment_id) ?? c.resposta_rascunho ?? "";
  const setTextoDe = (c: Comentario, v: string) =>
    setTextos((prev) => new Map(prev).set(c.comment_id, v));

  const responder = async (c: Comentario, tipo: "comentario" | "private_reply") => {
    const texto = textoDe(c).trim();
    if (!texto || enviando) return;
    setEnviando(c.comment_id + tipo);
    try {
      await enviarInstagram({
        tipo,
        comentario_id: c.id ?? c.comment_id,
        texto,
        usuario: user?.email,
      });
      toast.success(tipo === "comentario" ? "Resposta pública enviada" : "Resposta enviada no Direct");
      // Marca como respondido manualmente (distingue do robô)
      try {
        await db
          .from("instagram_comentarios")
          .update({ status: "respondido", aprovado_por: user?.email ?? null })
          .eq("comment_id", c.comment_id);
      } catch {
        /* coluna aprovado_por pode não existir — a edge function cuida do status */
      }
      await carregar();
    } catch (e: any) {
      const motivo = e?.motivo as string | undefined;
      if (motivo && MOTIVOS_409[motivo]) {
        toast.warning(MOTIVOS_409[motivo]);
      } else {
        toast.error(e?.message ?? "Falha ao enviar", { description: e?.dica });
      }
    } finally {
      setEnviando(null);
    }
  };

  const ignorar = async (c: Comentario) => {
    await db.from("instagram_comentarios").update({ status: "ignorado" }).eq("comment_id", c.comment_id);
    toast.success("Comentário ignorado");
    carregar();
  };

  return (
    <div className="space-y-4">
      {/* Alerta fixo: anúncios com comentário sem resposta e sem automação (incidente 22/08) */}
      {anunciosPendentes.length > 0 && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 flex items-center gap-3">
          <Megaphone className="h-4 w-4 text-danger shrink-0" />
          <p className="text-sm flex-1">
            <strong>
              {anunciosPendentes.length === 1
                ? "1 anúncio tem comentário sem resposta e sem automação."
                : `${anunciosPendentes.length} anúncios têm comentários sem resposta e sem automação.`}
            </strong>{" "}
            Anúncio sem resposta é lead quente parado.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to="/social-commerce?tab=produtos&filtro=sem_automacao">Configurar agora</Link>
          </Button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filtroStatus === f.key ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setFiltroStatus(f.key)}
          >
            {f.label}
          </Button>
        ))}
        <Select value={filtroIntencao} onValueChange={setFiltroIntencao}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Intenção" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as intenções</SelectItem>
            {intencoes.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {carregando ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum comentário neste filtro. Quando novos comentários chegarem, eles aparecem aqui automaticamente.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtrados.map((c) => {
            const post = c.media_id ? posts.get(c.media_id) : undefined;
            const produtos = c.media_id ? produtosPorMedia.get(c.media_id) ?? [] : [];
            const automatico = statusNormalizado(c) === "respondido" && !c.aprovado_por;
            const aberto = expandido === c.comment_id;
            const foraDoPrazo = comentarioForaDoPrazo(c.publicado_em);
            const privateBloqueada = !!c.private_reply_usada || foraDoPrazo;
            const privateMotivo = c.private_reply_usada
              ? "A Meta permite apenas uma resposta privada por comentário — esta já foi usada"
              : foraDoPrazo
                ? "Comentários com mais de 7 dias não aceitam resposta privada (regra da Meta)"
                : null;

            return (
              <Card key={c.comment_id} className={automatico ? "border-primary/20" : undefined}>
                <CardContent className="p-3.5">
                  <div className="flex gap-3">
                    {/* Miniatura do post */}
                    <ThumbPost post={post} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">@{c.from_username || "desconhecido"}</span>
                        <span className="text-[10px] text-muted-foreground">{tempoRelativo(c.publicado_em)}</span>
                        {post?.permalink && (
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Ver no Instagram"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {automatico && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                            <Zap className="h-3 w-3" /> Automático
                          </span>
                        )}
                        {c.intencao && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {c.intencao}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">{c.texto}</p>

                      {/* Contexto: produtos do post */}
                      {produtos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {produtos.map((p) => (
                            <Badge key={p.id} variant="secondary" className="text-[10px] font-normal">
                              {p.nome_do_produto}
                              {p.preco_venda != null && ` · ${brl(p.preco_venda)}`}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {c.erro && <p className="text-xs text-danger mt-1.5">{c.erro}</p>}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setExpandido(aberto ? null : c.comment_id)}
                    >
                      {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Área expandida */}
                  {aberto && (
                    <div className="mt-3 pt-3 border-t space-y-2.5">
                      {c.resposta_rascunho && (
                        <p className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                          <Bot className="h-3.5 w-3.5" /> Sugestão da Anna — edite se precisar
                        </p>
                      )}
                      <Textarea
                        value={textoDe(c)}
                        onChange={(e) => setTextoDe(c, e.target.value)}
                        placeholder="Escreva a resposta… Comentário é público: resposta curta que puxa para o Direct."
                        className="min-h-[70px]"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={enviando !== null || !textoDe(c).trim()}
                          onClick={() => responder(c, "comentario")}
                        >
                          {enviando === c.comment_id + "comentario" ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5 mr-1" />
                          )}
                          Responder publicamente
                        </Button>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={enviando !== null || !textoDe(c).trim() || privateBloqueada}
                                onClick={() => responder(c, "private_reply")}
                              >
                                {enviando === c.comment_id + "private_reply" ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Mail className="h-3.5 w-3.5 mr-1" />
                                )}
                                Responder no Direct
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {privateMotivo && (
                            <TooltipContent className="max-w-xs text-xs">{privateMotivo}</TooltipContent>
                          )}
                        </Tooltip>

                        <Button size="sm" variant="ghost" onClick={() => ignorar(c)}>
                          <EyeOff className="h-3.5 w-3.5 mr-1" /> Ignorar
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
