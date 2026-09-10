import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const BUCKET_VIDEOS = "videos-site";
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024;

export type CacheEstado = "pronto" | "na fila" | "desistiu" | "nao marcado" | string;

export interface CandidatoVideo {
  media_id: string;
  permalink: string | null;
  capa: string | null;
  titulo: string | null;
  publicado_em: string | null;
  views: number | null;
  usar_no_site: boolean;
  cache_estado: CacheEstado | null;
  cache_mb: number | null;
  cache_erro: string | null;
  produtos: string[] | null;
  video_id: string | null;
}

export interface ProdutoPai {
  produto_id: string;
  nome: string;
  preco_venda: number | null;
  estoque: number | null;
  link: string | null;
  imagem: string | null;
}

export type PlacementTipo = "home" | "produto" | "categoria" | "url" | "global";
export type PlacementFormato = "carrossel" | "bolha" | "inline" | "banner";

export interface Placement {
  id?: string;
  video_id?: string;
  tipo: PlacementTipo;
  alvo: string | null;
  formato: PlacementFormato;
  ordem: number;
  inicio: string | null;
  fim: string | null;
  ativo: boolean;
}

export interface VideoProduto {
  id?: string;
  tray_product_id: string;
  principal: boolean;
  ordem: number;
}

export interface VideoLinha {
  id: string;
  titulo: string | null;
  video_url: string | null;
  poster_url: string | null;
  storage_path: string | null;
  origem: string | null;
  tipo: string | null;
  som_liberado: boolean;
  ativo: boolean;
  criado_em: string | null;
  videos_produtos: VideoProduto[] | null;
  videos_placement: Placement[] | null;
}

/* ─────────── leitura ─────────── */

export async function videosCandidatos(
  busca: string,
  apenasMarcados: boolean,
  limite = 60,
): Promise<CandidatoVideo[]> {
  const { data, error } = await db.rpc("videos_candidatos", {
    p_busca: busca.trim() || null,
    p_apenas_marcados: apenasMarcados,
    p_limite: limite,
  });
  if (error) throw error;
  return (data ?? []) as CandidatoVideo[];
}

export async function marcarNoSite(mediaIds: string[], usar: boolean) {
  const { error } = await db.rpc("videos_marcar_site", {
    p_media_ids: mediaIds,
    p_usar: usar,
  });
  if (error) throw error;
}

export async function listarVideos(): Promise<VideoLinha[]> {
  const { data, error } = await db
    .from("videos")
    .select("*, videos_produtos(*), videos_placement(*)")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VideoLinha[];
}

export async function excluirVideo(id: string) {
  const { error } = await db.from("videos").delete().eq("id", id);
  if (error) throw error;
}

export async function salvarVideo(dados: Record<string, unknown>) {
  const { data, error } = await db.rpc("video_salvar", { p_dados: dados });
  if (error) throw error;
  return data;
}

export async function buscarProdutos(termo: string): Promise<ProdutoPai[]> {
  let q = db
    .from("vw_produtos_pai")
    .select("produto_id, nome, preco_venda, estoque, link, imagem")
    .limit(20);
  if (termo.trim()) q = q.ilike("nome", `%${termo.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProdutoPai[];
}

export async function produtosPorIds(ids: string[]): Promise<Record<string, ProdutoPai>> {
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (!unicos.length) return {};
  const { data, error } = await db
    .from("vw_produtos_pai")
    .select("produto_id, nome, preco_venda, estoque, link, imagem")
    .in("produto_id", unicos);
  if (error) throw error;
  const mapa: Record<string, ProdutoPai> = {};
  for (const p of (data ?? []) as ProdutoPai[]) mapa[String(p.produto_id)] = p;
  return mapa;
}

/* ─────────── peças do vídeo ─────────── */

export interface ProdutoBusca {
  tray_product_id: string;
  nome: string;
  preco: number | null;
  preco_cheio: number | null;
  estoque: number | null;
  imagem: string | null;
  link: string | null;
  categoria: string | null;
}

export async function produtosBuscar(termo: string, limite = 20): Promise<ProdutoBusca[]> {
  const { data, error } = await db.rpc("produtos_buscar", {
    p_busca: termo.trim() || null,
    p_limite: limite,
  });
  if (error) throw error;
  return ((data ?? []) as ProdutoBusca[]).map((p) => ({
    ...p,
    tray_product_id: String(p.tray_product_id),
  }));
}

export async function videoProdutosDefinir(videoId: string, produtos: VideoProduto[]) {
  const { data, error } = await db.rpc("video_produtos_definir", {
    p_video_id: videoId,
    p_produtos: produtos.map((p, i) => ({
      tray_product_id: String(p.tray_product_id),
      principal: !!p.principal,
      ordem: i,
    })),
  });
  if (error) throw error;
  return data;
}

/* ─────────── métricas ─────────── */

export interface MetricaVideo {
  impressoes: number;
  plays: number;
  conclusoes: number;
  cliques: number;
  add_cart: number;
}

const VAZIA: MetricaVideo = { impressoes: 0, plays: 0, conclusoes: 0, cliques: 0, add_cart: 0 };

export async function metricasPorVideo(desde: string): Promise<Record<string, MetricaVideo>> {
  const { data, error } = await db
    .from("videos_eventos")
    .select("video_id, tipo")
    .gte("criado_em", desde);
  if (error) throw error;
  const mapa: Record<string, MetricaVideo> = {};
  for (const ev of (data ?? []) as { video_id: string; tipo: string }[]) {
    if (!ev.video_id) continue;
    const m = (mapa[ev.video_id] ??= { ...VAZIA });
    const t = (ev.tipo ?? "").toLowerCase();
    if (t.startsWith("impress")) m.impressoes++;
    else if (t === "play" || t === "inicio") m.plays++;
    else if (t === "fim" || t.startsWith("conclus")) m.conclusoes++;
    else if (t.includes("clique") || t === "click") m.cliques++;
    else if (t.includes("cart") || t.includes("carrinho")) m.add_cart++;
  }
  return mapa;
}

export interface VideosMetricasResumo {
  videos_no_ar: number;
  impressoes: number;
  plays: number;
  tela_cheia: number;
  concluiu: number;
  cliques: number;
  visitantes: number;
  pct_play: number;
  pct_clique: number;
  pedidos: number;
  receita: number;
}

export interface VideosMetricasVideo {
  video_id: string;
  titulo: string | null;
  poster_url: string | null;
  som_liberado: boolean;
  tem_audio: boolean;
  impressoes: number;
  plays: number;
  meio: number;
  concluiu: number;
  tela_cheia: number;
  cliques: number;
  visitantes: number;
  pct_play: number;
  pct_clique: number;
  pct_conclusao: number;
  pedidos: number;
  receita: number;
  produtos: unknown;
}

export interface VideosMetricas {
  dias: number;
  desde: string;
  gerado_em: string;
  resumo: VideosMetricasResumo;
  por_dia: { dia: string; impressoes: number; plays: number; tela_cheia: number; cliques: number }[];
  por_superficie: { onde: string; plays: number }[];
  por_video: VideosMetricasVideo[];
  por_produto: { tray_product_id: string; nome: string | null; cliques: number }[];
}

export async function videosMetricas(dias: number): Promise<VideosMetricas> {
  const { data, error } = await db.rpc("videos_metricas", { p_dias: dias });
  if (error) throw error;
  return data as VideosMetricas;
}

/* ─────────── upload ─────────── */

export async function subirArquivo(file: File, ext: string): Promise<{ url: string; path: string }> {
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET_VIDEOS)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  const url = supabase.storage.from(BUCKET_VIDEOS).getPublicUrl(path).data.publicUrl;
  return { url, path };
}

/* ─────────── formatação ─────────── */

export function formatarViews(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1_000) return `${Math.round(n / 1000)} mil`;
  return String(n);
}

export function dataRelativa(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}

export function formatarMoeda(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(num: number, den: number): string {
  if (!den) return "—";
  return `${((num / den) * 100).toFixed(1).replace(".", ",")}%`;
}
