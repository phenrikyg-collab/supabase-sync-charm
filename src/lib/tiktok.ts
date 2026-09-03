import { supabase } from "@/integrations/supabase/client";
import { db } from "./socialCommerce";

/**
 * TikTok — camada de acesso do painel.
 *
 * Regra de ouro: SALVAR AGENDAMENTO NUNCA CHAMA `tiktok-publicar`.
 * O cron roda de minuto em minuto e pega a linha sozinho quando a hora chegar.
 * Só o botão "Publicar agora" chama a edge function.
 */

export interface TikTokConfig {
  conectado?: boolean | null;
  /** Buffer: quem publica no TikTok desde 03/09. */
  buffer_conectado?: boolean | null;
  buffer_channel_id?: string | null;
  buffer_channel_nome?: string | null;
  max_video_post_duration_sec?: number | null;
  ultimo_erro?: string | null;
  atualizado_em?: string | null;
}

export interface TikTokPublicacao {
  id?: string;
  publicacao_ig_id?: string | number | null;
  tipo?: "VIDEO" | "PHOTO";
  midia_urls?: string[] | null;
  titulo?: string | null;
  descricao?: string | null;
  capa_offset_ms?: number | null;
  capa_index?: number | null;
  agendado_para?: string | null;
  status?: string | null;
  publish_id?: string | null;
  post_id?: string | null;
  publicado_em?: string | null;
  erro?: string | null;
  tentativas?: number | null;
  ultimo_check_em?: string | null;
  produto_ids?: string[] | null;
  criado_por?: string | null;
}

/** Estado da conta conectada — sempre da view, nunca da tabela com segredos. */
export async function lerTikTokConfig(): Promise<TikTokConfig | null> {
  const { data, error } = await db.from("vw_tiktok_config").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as TikTokConfig | null;
}

export async function lerTikTokDaPublicacao(igId: string | number): Promise<TikTokPublicacao | null> {
  const { data, error } = await db
    .from("tiktok_publicacoes")
    .select("*")
    .eq("publicacao_ig_id", igId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as TikTokPublicacao | null;
}

export async function listarTikTokPublicacoes(): Promise<TikTokPublicacao[]> {
  const { data, error } = await db
    .from("tiktok_publicacoes")
    .select("*")
    .order("agendado_para", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as TikTokPublicacao[];
}

/** Insere ou atualiza a linha da fila. Não publica nada — o cron cuida disso. */
export async function salvarTikTokPublicacao(
  payload: TikTokPublicacao,
  id?: string | null,
): Promise<TikTokPublicacao> {
  const consulta = id
    ? db.from("tiktok_publicacoes").update(payload).eq("id", id).select("*").maybeSingle()
    : db.from("tiktok_publicacoes").insert(payload).select("*").maybeSingle();
  const { data, error } = await consulta;
  // Mensagens do banco já vêm prontas em português — repassar sem reescrever.
  if (error) throw new Error(error.message);
  return (data ?? {}) as TikTokPublicacao;
}

export async function apagarTikTokPublicacao(id: string): Promise<void> {
  const { error } = await db.from("tiktok_publicacoes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function lerTikTokPorId(id: string): Promise<TikTokPublicacao | null> {
  const { data, error } = await db.from("tiktok_publicacoes").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as TikTokPublicacao | null;
}

export interface ResultadoPublicacaoTikTok {
  acao?: string;
  motivo?: string | null;
  erro?: string | null;
  post_id?: string | null;
  publish_id?: string | null;
  status?: string | null;
}

/**
 * "Publicar agora". `ignorar_agendamento` é obrigatório: sem ele a função se
 * recusa a publicar um post marcado para o futuro, de propósito.
 * Se o gateway cortar em 60s (504), a função ainda termina e grava o resultado —
 * por isso relemos a linha em vez de tratar como erro.
 */
export async function publicarTikTokAgora(id: string): Promise<ResultadoPublicacaoTikTok> {
  try {
    const { data, error } = await supabase.functions.invoke("tiktok-publicar", {
      body: { forcar_id: id, ignorar_agendamento: true },
    });
    if (error) throw error;
    const r = (data as any)?.resultados?.[0];
    if (r) return r as ResultadoPublicacaoTikTok;
    const linha = await lerTikTokPorId(id);
    return { acao: linha?.status ?? undefined, erro: linha?.erro ?? null, post_id: linha?.post_id ?? null };
  } catch {
    // 504 / timeout do gateway: a linha é a fonte da verdade.
    const linha = await lerTikTokPorId(id);
    if (!linha) throw new Error("Não foi possível confirmar o envio ao TikTok.");
    const mapa: Record<string, string> = {
      publicando: "processando",
      publicado: "publicado",
      falhou: "falhou",
    };
    return {
      acao: mapa[String(linha.status)] ?? "processando",
      erro: linha.erro ?? null,
      post_id: linha.post_id ?? null,
    };
  }
}

export function mensagemDoResultado(r: ResultadoPublicacaoTikTok): { texto: string; ok: boolean } {
  switch (r.acao) {
    case "enviado":
      return { texto: "Enviado ao TikTok. Pode levar alguns minutos para processar.", ok: true };
    case "processando":
      return { texto: "Processando no TikTok…", ok: true };
    case "publicado":
      return { texto: "Publicado", ok: true };
    case "recusado":
      return { texto: r.motivo ?? "O TikTok recusou a publicação.", ok: false };
    case "falhou":
      return { texto: r.erro ?? "Falha ao publicar no TikTok.", ok: false };
    case "retentativa_agendada":
      return { texto: "Erro passageiro do TikTok. Vamos tentar de novo em 1 minuto.", ok: true };
    default:
      return { texto: r.erro ?? r.motivo ?? "Enviado ao TikTok.", ok: !r.erro };
  }
}

export const STATUS_TIKTOK_COR: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  agendado: "bg-muted text-muted-foreground border-border",
  publicando: "bg-primary/15 text-primary border-primary/30",
  publicado: "bg-success/10 text-success border-success/20",
  falhou: "bg-danger/10 text-danger border-danger/20",
};

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
