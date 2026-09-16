import { supabase } from "@/integrations/supabase/client";
import { chamarRpc } from "@/lib/supabaseRpc";

export const SUPABASE_URL_REVERSA = "https://ezdtulcrqzmgocamjwwl.supabase.co";

export type TemplateEmail = {
  gatilho: string;
  preferencia?: string | null;
  ativo: boolean;
  assunto?: string | null;
  titulo?: string | null;
  corpo?: string[] | null;
  botao_texto?: string | null;
  aviso?: string | null;
  figurinha?: string | null;
  figurinha_alt?: string | null;
  assinatura?: string | null;
  enviados?: number | null;
  ultimo_envio?: string | null;
};

export type FigurinhaEmail = { nome: string; url: string; bytes?: number | null };

/** Rótulo legível de cada gatilho (nunca mostrar o nome técnico sozinho). */
export const ROTULO_GATILHO: Record<string, string> = {
  aguardando_postagem: "Autorização pronta",
  lembrete_postagem: "Lembrete de postagem",
  envio_agrupado: "Envio agrupado",
  entregue: "Peça chegou na loja",
  escolher_troca: "Escolher a peça nova",
  aguardando_pedido_novo: "Conferência aprovada",
  aguardando_reembolso: "Reembolso a caminho",
  concluida: "Reembolso concluído",
  recusada: "Conferência recusada",
};

export const ROTULO_PREFERENCIA: Record<string, string> = {
  troca: "só troca",
  reembolso: "só reembolso",
};

/** Significado de {{2}} e {{3}} em cada gatilho. */
export const VARIAVEIS_GATILHO: Record<string, { dois: string; tres?: string }> = {
  aguardando_postagem: { dois: "protocolo", tres: "data de validade da autorização" },
  lembrete_postagem: { dois: "protocolo", tres: "data de validade da autorização" },
  aguardando_reembolso: { dois: "protocolo", tres: "valor" },
  concluida: { dois: "valor", tres: "protocolo" },
  recusada: { dois: "protocolo", tres: "motivo da recusa" },
};

export function rotuloGatilho(g: string) {
  return ROTULO_GATILHO[g] ?? g;
}

/** "mari-coracao" vira "Mari coração" para o texto alternativo. */
export function nomeLegivelFigurinha(nome: string) {
  const limpo = nome.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

export async function listarTemplatesEmail() {
  const { data, error } = await chamarRpc("reversa_templates_email_painel", {});
  if (error) throw new Error(error.message);
  return (data ?? []) as TemplateEmail[];
}

export async function listarFigurinhasEmail() {
  const { data, error } = await chamarRpc("reversa_figurinhas_email", {});
  if (error) throw new Error(error.message);
  return (data ?? []) as FigurinhaEmail[];
}

export async function salvarTemplateEmail(p_gatilho: string, p_patch: Record<string, any>) {
  const { data, error } = await chamarRpc("reversa_template_email_salvar", { p_gatilho, p_patch });
  if (error) throw new Error(error.message);
  return data as { ok?: boolean; gatilho?: string; ativo?: boolean };
}

/** HTML real do e-mail, direto da edge function (o iframe não manda header próprio). */
export async function previaEmail(gatilho: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch(
    `${SUPABASE_URL_REVERSA}/functions/v1/reversa-email-preview?exemplo=${encodeURIComponent(gatilho)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  const html = await r.text();
  if (!r.ok) throw new Error(html || "Não foi possível carregar a prévia.");
  return html;
}
