import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  db,
  enviarInstagram,
  enviarComentarioEDm,
  comentarioForaDoPrazo,
  ehComentarioRemovido,
  MOTIVOS_409,
  MSG_COMENTARIO_REMOVIDO,
} from "@/lib/socialCommerce";
import { tempoRelativo } from "./comum";
import { brl } from "@/lib/financeiroFormat";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  AlertTriangle, Bot, CheckCheck, ChevronDown, ChevronUp, ExternalLink, EyeOff, HandCoins,
  ImageOff, Loader2, Mail, Megaphone, MessageSquare, Send, ShoppingBag, Trash2, Zap,
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
  /** Rascunho da Anna para o Direct (ver supabase_sql/instagram_comentarios_rascunho_dm.sql) */
  resposta_rascunho_dm?: string | null;
  resposta_texto?: string | null;
  private_reply_usada?: boolean | null;
  aprovado_por?: string | null;
  erro?: string | null;
  // vw_ig_comentarios_painel — selos e capacidades já resolvidos na view
  ja_respondida?: boolean | null;
  resposta_origem?: string | null; // 'automatica' | 'manual'
  respondido_em?: string | null;
  intencao_compra?: boolean | null;
  pode_responder_publico?: boolean | null;
  pode_mandar_direct?: boolean | null;
  motivo_direct_indisponivel?: string | null;
  post_tem_automacao?: boolean | null;
  automacao_ativa?: boolean | null;
  objetivo?: string | null;
  eh_anuncio?: boolean | null;
  permalink?: string | null;
  tipo_post?: string | null;
  imagem_post?: string | null;
  legenda_curta?: string | null;
};

type PostInfo = {
  media_id: string;
  thumb_cache_url?: string | null;
  thumbnail_url?: string | null;
  media_url?: string | null;
  permalink?: string | null;
  caption?: string | null;
  media_type?: string | null;
  media_product_type?: string | null;
  /** Tipo consolidado vindo da view (REELS, FEED, CARROSSEL, STORY, ANUNCIO) */
  tipo_post?: string | null;
  eh_anuncio?: boolean | null;
  /** Capa escolhida no agendamento — tem prioridade sobre o frame que a Meta entrega */
  capa_url?: string | null;
};
type ProdutoInfo = { id: string; nome_do_produto?: string | null; preco_venda?: number | null };

type FiltroStatus = "novos" | "aguardando" | "respondidos" | "ignorados" | "apagados";

const FILTROS: { key: FiltroStatus; label: string }[] = [
  { key: "novos", label: "Novos" },
  { key: "aguardando", label: "Aguardando aprovação" },
  { key: "respondidos", label: "Respondidos" },
  { key: "ignorados", label: "Ignorados" },
  { key: "apagados", label: "Removidos" },
];

function statusNormalizado(c: Comentario): string {
  return (c.status ?? "novo").toLowerCase();
}

/** Rótulo amigável do tipo de mídia: Anúncio > Reels > Carrossel > Story > Feed. */
function rotuloTipoPost(post?: PostInfo): string | null {
  if (!post) return null;
  if (post.eh_anuncio) return "Anúncio";
  const tp = (post.tipo_post ?? "").toUpperCase();
  const mpt = (post.media_product_type ?? "").toUpperCase();
  const mt = (post.media_type ?? "").toUpperCase();
  if (tp === "REELS" || mpt === "REELS" || mt === "VIDEO") return "Reels";
  if (tp === "CARROSSEL" || mt === "CAROUSEL_ALBUM") return "Carrossel";
  if (tp === "STORY" || mpt === "STORY") return "Story";
  if (!tp && !mpt && !mt) return null;
  return "Feed";
}

/** Primeiras palavras da legenda — contexto ao lado da miniatura (o frame do reels nem sempre diz nada). */
function resumoLegenda(caption?: string | null, palavras = 12): string | null {
  if (!caption) return null;
  const limpa = caption.replace(/\s+/g, " ").trim();
  if (!limpa) return null;
  const partes = limpa.split(" ");
  return partes.length > palavras ? partes.slice(0, palavras).join(" ") + "…" : limpa;
}

/** Miniatura do post: capa escolhida no agendamento → cache → thumbnail → mídia. Clique abre o permalink. */
function ThumbPost({ post }: { post?: PostInfo }) {
  const [erro, setErro] = useState(false);
  const src = post ? post.capa_url || post.thumb_cache_url || post.thumbnail_url || post.media_url : null;
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
  const [textosDm, setTextosDm] = useState<Map<string, string>>(new Map());
  const [enviando, setEnviando] = useState<string | null>(null);
  // Anúncios com comentário sem resposta e sem produto/automação (view vw_ig_anuncios_pendentes)
  const [qtdAnunciosPendentes, setQtdAnunciosPendentes] = useState(0);
  // Contagem por status — alimenta os chips de filtro e o filtro inicial
  const [contagens, setContagens] = useState<Record<FiltroStatus, number> | null>(null);
  // 1.5 — confirmação antes de ignorar comentário com intenção de compra
  const [confirmarIgnorar, setConfirmarIgnorar] = useState<Comentario | null>(null);
  const filtroInicialAplicado = useRef(false);

  const carregar = useCallback(async () => {
    // Fonte única: a view resolve thumbnail, legenda, tipo do post e o que ainda
    // pode ser feito em cada comentário (botões e tooltips saem prontos dela).
    let lista: Comentario[] = [];
    let viaView = true;
    {
      const { data, error } = await db
        .from("vw_ig_comentarios_painel")
        .select("*")
        .order("publicado_em", { ascending: false })
        .limit(200);
      if (error) {
        // View ainda não existe no banco — cai na tabela base (sem selos/capacidades)
        viaView = false;
        const { data: coms } = await db
          .from("instagram_comentarios")
          .select("*")
          .order("publicado_em", { ascending: false })
          .limit(200);
        lista = (coms ?? []) as Comentario[];
      } else {
        // A view chama o id do comentário de comentario_id — normaliza para comment_id
        lista = ((data ?? []) as any[]).map((r) => ({
          ...r,
          comment_id: r.comment_id ?? r.comentario_id,
        })) as Comentario[];
      }
    }

    // Complementos que a view ainda não expõe: id numérico (envio), rascunho do Direct e intenção em texto
    const ids = lista.map((c) => c.comment_id).filter(Boolean);
    if (viaView && ids.length) {
      try {
        const { data: extra } = await db
          .from("instagram_comentarios")
          .select("id, comment_id, intencao, resposta_rascunho, resposta_rascunho_dm, erro")
          .in("comment_id", ids);
        const mapa = new Map((extra ?? []).map((e: any) => [e.comment_id, e]));
        lista = lista.map((c) => {
          const e: any = mapa.get(c.comment_id);
          if (!e) return c;
          return {
            ...c,
            id: e.id ?? c.id,
            intencao: c.intencao ?? e.intencao ?? null,
            resposta_rascunho: c.resposta_rascunho ?? e.resposta_rascunho ?? null,
            resposta_rascunho_dm: c.resposta_rascunho_dm ?? e.resposta_rascunho_dm ?? null,
            erro: c.erro ?? e.erro ?? null,
          };
        });
      } catch {
        /* coluna resposta_rascunho_dm pode não existir — segue sem ela */
      }
    }

    setComentarios(lista);

    // Contagem por status (chips + filtro inicial). "Novos" inclui status nulo.
    try {
      const base = () => db.from("instagram_comentarios").select("comment_id", { count: "exact", head: true });
      const [rNovos, rAguardando, rRespondidos, rIgnorados, rApagados] = await Promise.all([
        base().or("status.is.null,status.in.(novo,nova)"),
        base().eq("status", "aguardando_aprovacao"),
        base().eq("status", "respondido"),
        base().eq("status", "ignorado"),
        base().eq("status", "removido"),
      ]);
      const novas: Record<FiltroStatus, number> = {
        novos: rNovos.count ?? 0,
        aguardando: rAguardando.count ?? 0,
        respondidos: rRespondidos.count ?? 0,
        ignorados: rIgnorados.count ?? 0,
        apagados: rApagados.count ?? 0,
      };
      setContagens(novas);
      // Abre no primeiro filtro que tiver item, em vez de sempre em "Novos" (removidos nunca abrem por padrão)
      if (!filtroInicialAplicado.current) {
        filtroInicialAplicado.current = true;
        const primeiro = FILTROS.find((f) => f.key !== "apagados" && novas[f.key] > 0);
        if (primeiro && primeiro.key !== "novos") setFiltroStatus(primeiro.key);
      }
    } catch {
      /* contagens são complementares — a lista continua funcionando sem elas */
    }

    // Anúncios pendentes: comentário sem resposta + falta produto vinculado ou automação ativa.
    // O número do alerta vem desta view — a mesma listada no destino do botão.
    // Silencioso se a view ainda não existir no banco.
    try {
      const { count, error } = await db
        .from("vw_ig_anuncios_pendentes")
        .select("media_id", { count: "exact", head: true });
      if (!error) setQtdAnunciosPendentes(count ?? 0);
    } catch {
      /* view indisponível — sem alerta */
    }

    const mediaIds = [...new Set(lista.map((c) => c.media_id).filter(Boolean))] as string[];
    if (mediaIds.length > 0) {
      let mapaPosts: Map<string, PostInfo>;
      if (viaView) {
        // A view já traz tipo, legenda, miniatura e selo de anúncio — sem consultas extras
        mapaPosts = new Map(
          lista
            .filter((c) => c.media_id)
            .map((c) => [
              c.media_id as string,
              {
                media_id: c.media_id as string,
                permalink: c.permalink,
                caption: c.legenda_curta,
                tipo_post: c.tipo_post,
                eh_anuncio: c.eh_anuncio,
                thumb_cache_url: c.imagem_post,
              } as PostInfo,
            ]),
        );
      } else {
        const { data: ps } = await db.from("instagram_posts").select("*").in("media_id", mediaIds);
        mapaPosts = new Map<string, PostInfo>((ps ?? []).map((p: any) => [p.media_id as string, p as PostInfo]));

        // Selo de anúncio vem da view do painel (posts orgânicos têm eh_anuncio=false).
        // Silencioso se a view estiver indisponível.
        try {
          const { data: painel } = await db
            .from("vw_ig_posts_painel")
            .select("media_id, eh_anuncio, permalink")
            .in("media_id", mediaIds);
          for (const p of (painel ?? []) as any[]) {
            const ex = mapaPosts.get(p.media_id);
            if (ex) mapaPosts.set(p.media_id, { ...ex, eh_anuncio: p.eh_anuncio, permalink: ex.permalink ?? p.permalink });
            else mapaPosts.set(p.media_id, { media_id: p.media_id, eh_anuncio: p.eh_anuncio, permalink: p.permalink });
          }
        } catch {
          /* view indisponível — sem selo de anúncio */
        }
      }

      // Capa escolhida no agendamento substitui o frame que a Meta entrega como thumbnail
      try {
        const { data: pubs } = await db
          .from("instagram_publicacoes")
          .select("media_id, capa_url")
          .in("media_id", mediaIds)
          .not("capa_url", "is", null);
        for (const p of (pubs ?? []) as any[]) {
          const ex = mapaPosts.get(p.media_id);
          if (ex && p.capa_url) mapaPosts.set(p.media_id, { ...ex, capa_url: p.capa_url });
        }
      } catch {
        /* coluna capa_url pode não existir — segue com o frame da Meta */
      }

      setPosts(mapaPosts);

      const { data: links } = await db.from("instagram_post_produtos").select("*").in("media_id", mediaIds);
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
              : filtroStatus === "apagados"
                ? s === "removido"
                : s === "ignorado";
      if (!okStatus) return false;
      if (filtroIntencao !== "todas" && c.intencao !== filtroIntencao) return false;
      return true;
    });
  }, [comentarios, filtroStatus, filtroIntencao]);

  const textoDe = (c: Comentario) => textos.get(c.comment_id) ?? c.resposta_rascunho ?? "";
  const setTextoDe = (c: Comentario, v: string) =>
    setTextos((prev) => new Map(prev).set(c.comment_id, v));
  const textoDmDe = (c: Comentario) => textosDm.get(c.comment_id) ?? c.resposta_rascunho_dm ?? "";
  const setTextoDmDe = (c: Comentario, v: string) =>
    setTextosDm((prev) => new Map(prev).set(c.comment_id, v));

  /** Marca localmente como removido — o comentário não existe mais no Instagram (apagado ou editado). */
  const marcarRemovido = async (c: Comentario) => {
    setComentarios((prev) =>
      prev.map((x) => (x.comment_id === c.comment_id ? { ...x, status: "removido" } : x)),
    );
    try {
      await db.from("instagram_comentarios").update({ status: "removido" }).eq("comment_id", c.comment_id);
    } catch {
      /* o backend já marca — aqui é só reforço otimista */
    }
  };

  const marcarRespondido = async (c: Comentario) => {
    try {
      await db
        .from("instagram_comentarios")
        .update({ status: "respondido", aprovado_por: user?.email ?? null })
        .eq("comment_id", c.comment_id);
    } catch {
      /* coluna aprovado_por pode não existir — a edge function cuida do status */
    }
  };

  /** Trata erro de envio; retorna true se o erro já foi comunicado (não propagar). */
  const tratarErroEnvio = async (e: any, c: Comentario): Promise<void> => {
    if (ehComentarioRemovido(e)) {
      toast.info(MSG_COMENTARIO_REMOVIDO, { duration: 8000 });
      await marcarRemovido(c);
      return;
    }
    const motivo = e?.motivo as string | undefined;
    if (motivo && MOTIVOS_409[motivo]) {
      toast.warning(MOTIVOS_409[motivo]);
    } else {
      toast.error(e?.message ?? "Falha ao enviar", { description: e?.dica });
    }
  };

  const responder = async (c: Comentario, tipo: "comentario" | "private_reply") => {
    // Cada canal usa o seu campo: pública curta, Direct com preço/link/cupom
    const texto = (tipo === "comentario" ? textoDe(c) : textoDmDe(c)).trim();
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
      await marcarRespondido(c);
      await carregar();
    } catch (e: any) {
      await tratarErroEnvio(e, c);
    } finally {
      setEnviando(null);
    }
  };

  /**
   * Responder nos dois canais de uma vez: o backend manda o Direct PRIMEIRO
   * (a pública costuma prometer a mensagem privada) e, se o Direct falhar,
   * a pública ainda sai. Sucesso parcial não é erro — mostramos os dois resultados.
   */
  const responderNosDois = async (c: Comentario) => {
    const textoPublico = textoDe(c).trim();
    const textoDm = textoDmDe(c).trim();
    if (!textoPublico || !textoDm || enviando) return;
    setEnviando(c.comment_id + "ambos");
    try {
      const r = await enviarComentarioEDm({
        comentario_id: c.id ?? c.comment_id,
        texto_publico: textoPublico,
        texto_dm: textoDm,
        usuario: user?.email,
      });
      const dmOk = r.dm?.ok === true;
      const pubOk = r.publica?.ok === true;
      if (dmOk && pubOk) {
        toast.success("Resposta publicada no comentário e Direct enviado");
      } else if (pubOk) {
        toast.warning("Resposta pública publicada, mas o Direct não saiu.", {
          description: r.aviso ?? r.dm?.erro ?? "A cliente pode não aceitar mensagem de desconhecido.",
        });
      } else if (dmOk) {
        toast.warning("Direct enviado, mas a resposta pública falhou.", {
          description: r.aviso ?? r.publica?.erro,
        });
      }
      if (pubOk || dmOk) {
        await marcarRespondido(c);
        await carregar();
      }
    } catch (e: any) {
      await tratarErroEnvio(e, c);
    } finally {
      setEnviando(null);
    }
  };

  const ignorar = async (c: Comentario) => {
    await db.from("instagram_comentarios").update({ status: "ignorado" }).eq("comment_id", c.comment_id);
    toast.success("Comentário ignorado");
    carregar();
  };

  /** 1.5 — intenção de compra exige confirmação: foi assim que leads sumiram por um dia. */
  const pedirIgnorar = (c: Comentario) => {
    if (c.intencao_compra) setConfirmarIgnorar(c);
    else ignorar(c);
  };

  return (
    <div className="space-y-4">
      {/* Alerta fixo: anúncios com comentário sem resposta e sem produto/automação.
          O número e o destino vêm da mesma view (vw_ig_anuncios_pendentes). */}
      {qtdAnunciosPendentes > 0 && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 flex items-center gap-3">
          <Megaphone className="h-4 w-4 text-danger shrink-0" />
          <p className="text-sm flex-1">
            <strong>
              {qtdAnunciosPendentes === 1
                ? "1 anúncio tem comentário sem resposta e está sem produto ou automação."
                : `${qtdAnunciosPendentes} anúncios têm comentários sem resposta e estão sem produto ou automação.`}
            </strong>{" "}
            Anúncio sem resposta é lead quente parado.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to="/social-commerce?tab=publicacoes&visao=noar&filtro=anuncios_pendentes">
              Configurar agora
            </Link>
          </Button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => {
          const n = contagens?.[f.key];
          const zerado = n === 0 && filtroStatus !== f.key;
          return (
            <Button
              key={f.key}
              size="sm"
              variant={filtroStatus === f.key ? "default" : "outline"}
              className={`h-8 text-xs ${zerado ? "opacity-50" : ""}`}
              onClick={() => setFiltroStatus(f.key)}
            >
              {f.label}
              {n != null && ` (${n})`}
            </Button>
          );
        })}
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
            const removido = statusNormalizado(c) === "removido";
            // 1.6 — respondida: selo de origem (automática/manual) e a resposta que saiu
            const jaRespondida = c.ja_respondida ?? statusNormalizado(c) === "respondido";
            const ehAutomatica = c.resposta_origem
              ? c.resposta_origem === "automatica"
              : jaRespondida && !c.aprovado_por;
            const aberto = expandido === c.comment_id && !removido && !jaRespondida;
            const foraDoPrazo = comentarioForaDoPrazo(c.publicado_em);
            // 1.1 — a view já diz o que ainda dá para fazer; tooltip explica o motivo
            const privateBloqueada = !!c.private_reply_usada || foraDoPrazo;
            const podePublico = c.pode_responder_publico ?? !jaRespondida;
            const podeDirect = c.pode_mandar_direct ?? !privateBloqueada;
            const motivoPublico = podePublico ? null : "Este comentário já foi respondido.";
            const motivoDirect =
              c.motivo_direct_indisponivel ??
              (c.private_reply_usada
                ? "A Meta permite apenas uma resposta privada por comentário — esta já foi usada"
                : foraDoPrazo
                  ? "Comentários com mais de 7 dias não aceitam resposta privada (regra da Meta)"
                  : null);
            const tipoPost = rotuloTipoPost(post);
            const legendaResumo = resumoLegenda(post?.caption);

            return (
              <Card
                key={c.comment_id}
                className={`${ehAutomatica && jaRespondida ? "border-primary/20" : ""} ${removido ? "opacity-60 border-dashed" : ""}`.trim() || undefined}
              >
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
                        {jaRespondida && !removido && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 text-success px-2 py-0.5 text-[10px] font-semibold"
                            title={ehAutomatica ? "Enviada pela automação da Anna" : `Enviada por ${c.aprovado_por ?? "equipe"}`}
                          >
                            {ehAutomatica ? <Zap className="h-3 w-3" /> : <CheckCheck className="h-3 w-3" />}
                            {ehAutomatica
                              ? "respondida (automática)"
                              : `respondida${c.aprovado_por ? ` por ${c.aprovado_por}` : ""}`}
                          </span>
                        )}
                        {c.intencao_compra && !removido && !jaRespondida && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 text-success px-2 py-0.5 text-[10px] font-semibold">
                            <ShoppingBag className="h-3 w-3" /> quer comprar
                          </span>
                        )}
                        {c.objetivo && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                            title="Objetivo definido na automação do post"
                          >
                            <HandCoins className="h-3 w-3" />
                            {c.objetivo === "conversa" ? "objetivo: conversa" : "objetivo: venda"}
                          </span>
                        )}
                        {removido && (
                          <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            <Trash2 className="h-3 w-3" /> removido no Instagram
                          </span>
                        )}
                        {c.intencao && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {c.intencao}
                          </Badge>
                        )}
                      </div>

                      {/* Contexto do post: tipo (Reels/Feed/Anúncio) + primeiras palavras da legenda.
                          O frame que a Meta entrega como miniatura nem sempre representa o conteúdo. */}
                      {(tipoPost || legendaResumo) && (
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                          {tipoPost && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                              {tipoPost}
                            </Badge>
                          )}
                          {legendaResumo && <span className="truncate italic">“{legendaResumo}”</span>}
                        </p>
                      )}

                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">{c.texto}</p>

                      {/* 1.6 — já respondida aparece recolhida, com a resposta que saiu */}
                      {jaRespondida && c.resposta_texto && (
                        <div className="mt-2 rounded-md border border-success/30 bg-success/5 p-2 text-xs space-y-0.5">
                          <p className="font-semibold text-success flex items-center gap-1.5">
                            {ehAutomatica ? <Bot className="h-3 w-3" /> : <CheckCheck className="h-3 w-3" />}
                            Resposta enviada — {ehAutomatica ? "automática" : `por ${c.aprovado_por ?? "equipe"}`}
                          </p>
                          <p className="whitespace-pre-wrap">{c.resposta_texto}</p>
                          {c.private_reply_usada && <p className="text-muted-foreground">Direct enviado</p>}
                        </div>
                      )}

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

                      {/* Post sem automação: comentário novo aqui não vai disparar nada */}
                      {c.post_tem_automacao === false && !removido && !jaRespondida && (
                        <p className="mt-2 text-[11px] rounded border border-warning/30 bg-warning/10 p-1.5 flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3 text-warning shrink-0" /> Post sem automação configurada
                        </p>
                      )}

                      {/* Erro de envio não aparece em comentário removido — não é erro, é fato consumado */}
                      {c.erro && !removido && <p className="text-xs text-danger mt-1.5">{c.erro}</p>}
                    </div>

                    {!removido && !jaRespondida && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setExpandido(aberto ? null : c.comment_id)}
                      >
                        {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>

                  {/* Área expandida */}
                  {aberto && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        {/* Resposta pública — curta, sem preço nem link */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5" /> Resposta pública
                            <span className="font-normal text-muted-foreground">— curta, sem preço nem link</span>
                          </p>
                          {c.resposta_rascunho && (
                            <p className="text-[11px] flex items-center gap-1 text-primary">
                              <Bot className="h-3 w-3" /> Sugestão da Anna — edite se precisar
                            </p>
                          )}
                          <Textarea
                            value={textoDe(c)}
                            onChange={(e) => setTextoDe(c, e.target.value)}
                            placeholder="Ex.: Oiii! Te chamei no Direct com tudo certinho 💛"
                            className="min-h-[70px]"
                            disabled={!podePublico}
                          />
                        </div>

                        {/* Mensagem no Direct — aqui vai preço, link e cupom */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" /> Mensagem no Direct
                            <span className="font-normal text-muted-foreground">— aqui vai preço, link e cupom</span>
                          </p>
                          {c.resposta_rascunho_dm && (
                            <p className="text-[11px] flex items-center gap-1 text-primary">
                              <Bot className="h-3 w-3" /> Sugestão da Anna — edite se precisar
                            </p>
                          )}
                          <Textarea
                            value={textoDmDe(c)}
                            onChange={(e) => setTextoDmDe(c, e.target.value)}
                            placeholder="Ex.: Oiii! Essa é a Calça Reta Juliana, R$ 189. Com o cupom QUERO10…"
                            className="min-h-[70px]"
                            disabled={!podeDirect}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {/* Principal: comentário + Direct numa chamada só. O Direct sai primeiro;
                            se falhar, a pública ainda sai. */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                size="sm"
                                disabled={
                                  enviando !== null ||
                                  !textoDe(c).trim() ||
                                  !textoDmDe(c).trim() ||
                                  !podePublico ||
                                  !podeDirect
                                }
                                onClick={() => responderNosDois(c)}
                              >
                                {enviando === c.comment_id + "ambos" ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5 mr-1" />
                                )}
                                Responder nos dois
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {(motivoPublico ?? motivoDirect) && (
                            <TooltipContent className="max-w-xs text-xs">{motivoPublico ?? motivoDirect}</TooltipContent>
                          )}
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={enviando !== null || !textoDe(c).trim() || !podePublico}
                                onClick={() => responder(c, "comentario")}
                              >
                                {enviando === c.comment_id + "comentario" ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                )}
                                Só no comentário
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {motivoPublico && (
                            <TooltipContent className="max-w-xs text-xs">{motivoPublico}</TooltipContent>
                          )}
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={enviando !== null || !textoDmDe(c).trim() || !podeDirect}
                                onClick={() => responder(c, "private_reply")}
                              >
                                {enviando === c.comment_id + "private_reply" ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Mail className="h-3.5 w-3.5 mr-1" />
                                )}
                                Só no Direct
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {motivoDirect && (
                            <TooltipContent className="max-w-xs text-xs">{motivoDirect}</TooltipContent>
                          )}
                        </Tooltip>

                        <Button size="sm" variant="ghost" onClick={() => pedirIgnorar(c)}>
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

      {/* 1.5 — Ignorar comentário com intenção de compra exige confirmação */}
      <AlertDialog open={!!confirmarIgnorar} onOpenChange={(v) => !v && setConfirmarIgnorar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ignorar um comentário com intenção de compra?</AlertDialogTitle>
            <AlertDialogDescription>
              @{confirmarIgnorar?.from_username ?? "?"} escreveu “{confirmarIgnorar?.texto}” e a leitura da Anna é
              de interesse em comprar. Ignorados saem da fila — foi assim que leads sumiram por um dia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmarIgnorar) ignorar(confirmarIgnorar);
                setConfirmarIgnorar(null);
              }}
            >
              Sim, ignorar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
