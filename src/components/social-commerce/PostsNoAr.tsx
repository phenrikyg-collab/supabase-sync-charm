import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/socialCommerce";
import { tempoRelativo } from "./comum";
import { formatarData } from "@/utils/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertTriangle, ExternalLink, ImageOff, Megaphone, MessageSquare, Settings2, ShoppingBag, Zap,
} from "lucide-react";

/** Linha da view vw_ig_posts_painel (posts orgânicos + anúncios descobertos). */
export type PostPainel = {
  media_id: string;
  permalink?: string | null;
  imagem?: string | null;
  legenda_curta?: string | null;
  data_publicacao?: string | null;
  eh_anuncio?: boolean | null;
  tem_automacao?: boolean | null;
  automacao_ativa?: boolean | null;
  automacao_modo?: string | null;
  gatilho_qualquer?: boolean | null;
  palavras_gatilho?: string[] | null;
  variacoes_publicas?: number | null;
  sem_texto?: boolean | null;
  produtos_vinculados?: number | null;
  comentarios?: number | null;
  comentarios_sem_resposta?: number | null;
  ultimo_comentario_em?: string | null;
  // Colunas de instagram_posts presentes no fallback (quando a view não existe)
  thumb_cache_url?: string | null;
  thumbnail_url?: string | null;
  media_url?: string | null;
  caption?: string | null;
  comments_count?: number | null;
};

type FiltroPainel = "todos" | "organicos" | "anuncios" | "anuncios_pendentes" | "sem_automacao" | "sem_resposta";

const FILTROS: { key: FiltroPainel; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "organicos", label: "Orgânicos" },
  { key: "anuncios", label: "Anúncios" },
  { key: "anuncios_pendentes", label: "Anúncios pendentes" },
  { key: "sem_automacao", label: "Sem automação" },
  { key: "sem_resposta", label: "Comentários sem resposta" },
];

/** Busca a view do painel; se ela ainda não existir no banco, cai para instagram_posts. */
export async function carregarPostsPainel(limite = 300): Promise<PostPainel[]> {
  const { data, error } = await db
    .from("vw_ig_posts_painel")
    .select("*")
    .limit(limite);
  if (!error) return (data ?? []) as PostPainel[];

  // Fallback: view ainda não criada — lista só orgânicos, sem as flags agregadas
  const { data: ps, error: errPosts } = await db
    .from("instagram_posts")
    .select("*")
    .order("data_publicacao", { ascending: false })
    .limit(limite);
  if (errPosts) throw errPosts;
  const lista = ((ps ?? []) as PostPainel[]).map((p) => ({
    ...p,
    legenda_curta: p.legenda_curta ?? p.caption ?? null,
    imagem: p.imagem ?? p.thumb_cache_url ?? p.thumbnail_url ?? p.media_url ?? null,
    comentarios: p.comentarios ?? p.comments_count ?? null,
    eh_anuncio: false,
  }));
  toast.warning("View vw_ig_posts_painel não encontrada — anúncios e selos agregados ficam indisponíveis até o backend ser atualizado.");
  return lista;
}

function ImagemPainel({ post }: { post: PostPainel }) {
  const [erro, setErro] = useState(false);
  const src = post.imagem || post.thumb_cache_url || post.thumbnail_url || post.media_url;
  if (!src || erro) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground/50">
        <ImageOff className="h-8 w-8" />
        <span className="text-[10px]">Sem prévia</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="Mídia do Instagram"
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setErro(true)}
    />
  );
}

const FILTROS_VALIDOS = new Set<string>(FILTROS.map((f) => f.key));

export function PostsNoAr({ filtroInicial }: { filtroInicial?: string | null }) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostPainel[]>([]);
  // null = view vw_ig_anuncios_pendentes indisponível no banco
  const [pendentes, setPendentes] = useState<PostPainel[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<FiltroPainel>(
    filtroInicial && FILTROS_VALIDOS.has(filtroInicial) ? (filtroInicial as FiltroPainel) : "todos",
  );

  const carregar = useCallback(async () => {
    try {
      setPosts(await carregarPostsPainel());
    } catch (e: any) {
      toast.error("Falha ao carregar posts", { description: e?.message });
    }
    // Anúncios pendentes: comentário sem resposta + falta produto vinculado ou automação ativa.
    // Mesma fonte do alerta da aba Comentários — o número do alerta bate com esta lista.
    try {
      const { data, error } = await db
        .from("vw_ig_anuncios_pendentes")
        .select("*")
        .order("ultimo_comentario_em", { ascending: false });
      if (!error) {
        setPendentes(((data ?? []) as PostPainel[]).map((p) => ({ ...p, eh_anuncio: true })));
      }
    } catch {
      /* view indisponível — o filtro mostra aviso */
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    if (filtro === "anuncios_pendentes") return pendentes ?? [];
    const lista = posts.filter((p) => {
      if (filtro === "organicos" && p.eh_anuncio) return false;
      if (filtro === "anuncios" && !p.eh_anuncio) return false;
      if (filtro === "sem_automacao" && p.tem_automacao && p.automacao_ativa) return false;
      if (filtro === "sem_resposta" && !(p.comentarios_sem_resposta ?? 0)) return false;
      return true;
    });
    // Lead quente primeiro: último comentário mais recente no topo
    return lista.sort((a, b) => {
      const ta = a.ultimo_comentario_em ? new Date(a.ultimo_comentario_em).getTime() : 0;
      const tb = b.ultimo_comentario_em ? new Date(b.ultimo_comentario_em).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (b.data_publicacao ?? "").localeCompare(a.data_publicacao ?? "");
    });
  }, [posts, filtro]);

  const configurar = (mediaId: string) =>
    navigate(`/social-commerce?tab=produtos&media=${encodeURIComponent(mediaId)}`);

  return (
    <div className="space-y-4">
      {/* Filtro rápido */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filtro === f.key ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setFiltro(f.key)}
          >
            {f.label}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">
          {filtrados.length} {filtrados.length === 1 ? "mídia no ar" : "mídias no ar"}
        </span>
      </div>

      {carregando ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            <ImageOff className="h-8 w-8 mx-auto mb-2 opacity-40" />
            {filtro === "anuncios_pendentes" && pendentes === null
              ? "A view vw_ig_anuncios_pendentes ainda não existe no banco — atualize o backend para usar este filtro."
              : "Nenhuma mídia neste filtro."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtrados.map((p) => (
            <Card
              key={p.media_id}
              className={`overflow-hidden flex flex-col ${
                filtro === "anuncios_pendentes"
                  ? "cursor-pointer hover:ring-1 hover:ring-primary/40 transition-shadow"
                  : ""
              }`}
              onClick={filtro === "anuncios_pendentes" ? () => configurar(p.media_id) : undefined}
              title={filtro === "anuncios_pendentes" ? "Abrir configuração do anúncio" : undefined}
            >
              <div className="aspect-square bg-muted relative">
                <ImagemPainel post={p} />
                {p.eh_anuncio && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-foreground text-background px-2 py-0.5 text-[10px] font-semibold">
                    <Megaphone className="h-3 w-3" /> Anúncio
                  </span>
                )}
                {p.automacao_ativa && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold">
                    <Zap className="h-3 w-3" />
                    {p.automacao_modo === "automatico" ? "Automático" : p.automacao_modo === "desligado" ? "Desligado" : "Sombra"}
                  </span>
                )}
              </div>
              <CardContent className="p-3 flex-1 flex flex-col gap-2">
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                  {p.legenda_curta || "(sem legenda)"}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                  <span>{formatarData((p.data_publicacao ?? "").slice(0, 10))}</span>
                  {p.permalink && (
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" /> Ver no Instagram
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground flex-wrap">
                  {(p.comentarios ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <MessageSquare className="h-3 w-3" /> {p.comentarios}
                    </span>
                  )}
                  {(p.comentarios_sem_resposta ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-danger font-semibold">
                      <AlertTriangle className="h-3 w-3" /> {p.comentarios_sem_resposta} sem resposta
                    </span>
                  )}
                  {(p.produtos_vinculados ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <ShoppingBag className="h-3 w-3" /> {p.produtos_vinculados}
                    </span>
                  )}
                </div>

                {p.ultimo_comentario_em && (
                  <p className="text-[10px] text-muted-foreground">
                    Último comentário {tempoRelativo(p.ultimo_comentario_em)}
                  </p>
                )}

                {/* Selo: automação ligada sem texto salvo — a Anna escreve na hora */}
                {p.sem_texto && (
                  <p className="text-[10px] rounded border border-warning/30 bg-warning/10 p-1.5 flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-px" />
                    <span>Sem resposta salva. A Anna vai escrever no primeiro comentário.</span>
                  </p>
                )}

                <div className="mt-auto pt-2 border-t flex justify-end">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => configurar(p.media_id)}>
                    <Settings2 className="h-3.5 w-3.5 mr-1" /> Configurar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
