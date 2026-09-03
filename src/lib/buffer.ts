import { supabase } from "@/integrations/supabase/client";
import { db } from "./socialCommerce";

/**
 * Buffer — agendamento de TikTok, YouTube e Pinterest.
 *
 * Regra de ouro: SALVAR AGENDAMENTO NUNCA CHAMA `buffer-publicar`.
 * O cron roda de minuto em minuto e pega a linha sozinho quando a hora chegar.
 * Só o botão "Publicar agora" chama a edge function.
 *
 * Nota de nome: a tabela ainda se chama `tiktok_publicacoes` (nome legado) mesmo
 * guardando YouTube e Pinterest. A view `buffer_publicacoes` tem o mesmo conteúdo.
 */

export type ServicoBuffer = "tiktok" | "youtube" | "pinterest";

export const SERVICOS: ServicoBuffer[] = ["tiktok", "youtube", "pinterest"];

export const NOME_SERVICO: Record<ServicoBuffer, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
};

export interface BufferBoard {
  id?: string | null;
  nome?: string | null;
  service_id?: string | null;
  url?: string | null;
}

export interface BufferCanal {
  servico?: ServicoBuffer | string | null;
  channel_id?: string | null;
  nome?: string | null;
  desconectado?: boolean | null;
  boards?: BufferBoard[] | null;
}

export interface BufferPublicacao {
  id?: string;
  servico?: ServicoBuffer | string | null;
  grupo_id?: string | null;
  publicacao_ig_id?: string | number | null;
  tipo?: "VIDEO" | "PHOTO";
  midia_urls?: string[] | null;
  titulo?: string | null;
  capa_offset_ms?: number | null;
  capa_index?: number | null;
  agendado_para?: string | null;
  status?: string | null;
  publish_id?: string | null;
  publicado_em?: string | null;
  erro?: string | null;
  tentativas?: number | null;
  produto_ids?: string[] | null;
  youtube_titulo?: string | null;
  youtube_privacidade?: string | null;
  youtube_para_criancas?: boolean | null;
  youtube_notificar?: boolean | null;
  pinterest_board_id?: string | null;
  pinterest_titulo?: string | null;
  pinterest_url?: string | null;
}

/** Canais conectados na Buffer (com os boards do Pinterest). */
export async function listarCanaisBuffer(): Promise<BufferCanal[]> {
  const { data, error } = await db.from("buffer_canais").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as BufferCanal[];
}

export function canalDoServico(canais: BufferCanal[], servico: ServicoBuffer): BufferCanal | null {
  return canais.find((c) => c.servico === servico) ?? null;
}

export async function listarBufferPublicacoes(): Promise<BufferPublicacao[]> {
  const { data, error } = await db
    .from("tiktok_publicacoes")
    .select("*")
    .order("agendado_para", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as BufferPublicacao[];
}

export async function lerLinhasDoGrupo(grupoId: string): Promise<BufferPublicacao[]> {
  const { data, error } = await db.from("tiktok_publicacoes").select("*").eq("grupo_id", grupoId);
  if (error) throw new Error(error.message);
  return (data ?? []) as BufferPublicacao[];
}

export async function lerBufferPorId(id: string): Promise<BufferPublicacao | null> {
  const { data, error } = await db.from("tiktok_publicacoes").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as BufferPublicacao | null;
}

/**
 * Grava a linha de um destino. Com `id`, atualiza; sem `id` (ou se a linha
 * sumiu do banco), insere. É o que impede duplicar quando a pessoa clica em
 * Agendar duas vezes seguidas.
 */
export async function salvarDestino(
  payload: BufferPublicacao,
  id?: string | null,
): Promise<BufferPublicacao> {
  if (id) {
    const { data, error } = await db
      .from("tiktok_publicacoes")
      .update(payload)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    // Mensagens do banco já vêm prontas em português — repassar sem reescrever.
    if (error) throw new Error(error.message);
    if (data) return data as BufferPublicacao;
  }
  const { data, error } = await db
    .from("tiktok_publicacoes")
    .insert(payload)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? {}) as BufferPublicacao;
}

export async function apagarDestino(id: string): Promise<void> {
  const { error } = await db.from("tiktok_publicacoes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface ResultadoBuffer {
  servico?: ServicoBuffer | string | null;
  acao?: string;
  motivo?: string | null;
  erro?: string | null;
  publish_id?: string | null;
  status?: string | null;
}

/**
 * "Publicar agora". `ignorar_agendamento` é obrigatório: sem ele a função se
 * recusa a publicar um post marcado para o futuro, de propósito.
 * Se o gateway cortar em 60s (504), a função ainda termina e grava o resultado —
 * por isso relemos as linhas em vez de tratar como erro.
 */
export async function publicarBufferAgora(alvo: {
  id?: string | null;
  grupoId?: string | null;
}): Promise<ResultadoBuffer[]> {
  const body: Record<string, any> = { ignorar_agendamento: true };
  if (alvo.id) body.forcar_id = alvo.id;
  if (alvo.grupoId) body.forcar_grupo = alvo.grupoId;

  const relerLinhas = async (): Promise<ResultadoBuffer[]> => {
    const linhas = alvo.grupoId
      ? await lerLinhasDoGrupo(alvo.grupoId)
      : alvo.id
        ? [await lerBufferPorId(alvo.id)].filter(Boolean as any as (l: any) => l is BufferPublicacao)
        : [];
    const mapa: Record<string, string> = {
      publicando: "processando",
      publicado: "publicado",
      falhou: "falhou",
    };
    return linhas.map((l) => ({
      servico: l.servico ?? null,
      acao: mapa[String(l.status)] ?? "processando",
      erro: l.erro ?? null,
      publish_id: l.publish_id ?? null,
      status: l.status ?? null,
    }));
  };

  try {
    const { data, error } = await supabase.functions.invoke("buffer-publicar", { body });
    if (error) throw error;
    const rs = (data as any)?.resultados;
    if (Array.isArray(rs) && rs.length) return rs as ResultadoBuffer[];
    return await relerLinhas();
  } catch {
    const linhas = await relerLinhas();
    if (!linhas.length) throw new Error("Não foi possível confirmar o envio à Buffer.");
    return linhas;
  }
}

export function mensagemDoResultado(r: ResultadoBuffer): { texto: string; ok: boolean } | null {
  switch (r.acao) {
    case "enviado":
      return { texto: "Enviado à Buffer. Pode levar alguns minutos para aparecer.", ok: true };
    case "processando":
      return { texto: "Processando…", ok: true };
    case "publicado":
      return { texto: "Publicado", ok: true };
    case "parado":
      return { texto: r.erro ?? "Post ficou preso como rascunho na Buffer.", ok: false };
    case "recusado":
      return { texto: r.motivo ?? "A publicação foi recusada.", ok: false };
    case "falhou":
      return { texto: r.erro ?? "Falha ao publicar.", ok: false };
    case "retentativa_agendada":
      return { texto: "Erro passageiro. Nova tentativa em 1 minuto.", ok: true };
    case "ja_reservado":
      return null; // outra execução está cuidando
    default:
      return { texto: r.erro ?? r.motivo ?? "Enviado à Buffer.", ok: !r.erro };
  }
}

export const STATUS_BUFFER_COR: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  agendado: "bg-muted text-muted-foreground border-border",
  publicando: "bg-primary/15 text-primary border-primary/30",
  publicado: "bg-success/10 text-success border-success/20",
  falhou: "bg-danger/10 text-danger border-danger/20",
};

/** Link de destino do pin a partir do primeiro produto vinculado. */
export async function linkDoProduto(produtoIds: string[]): Promise<string | null> {
  if (!produtoIds.length) return null;
  const { data, error } = await db.rpc("fn_buffer_link_produto", { p_produto_ids: produtoIds });
  if (error) return null;
  return (typeof data === "string" ? data : null) || null;
}

/** Sugestões de título para o YouTube — nunca preenche sozinho, só sugere. */
export async function sugerirTitulosYoutube(legenda: string, quantidade = 3): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke("youtube-gerar-titulo", {
    body: { legenda, quantidade },
  });
  if (error) throw error;
  const titulos = (data as any)?.titulos;
  return Array.isArray(titulos) ? titulos.filter((t: any) => typeof t === "string") : [];
}

/** Duração de um vídeo (segundos) a partir de uma URL de objeto ou pública. */
export function duracaoDoVideo(src: string): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => resolve(null);
    v.src = src;
  });
}
