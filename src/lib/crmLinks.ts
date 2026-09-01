import { supabase } from "@/integrations/supabase/client";

export type CrmPorta = {
  slug: string;
  nome?: string | null;
  destino?: string | null;
  campanha?: string | null;
  ativo?: boolean | null;
  cliques?: number | null;
  atualizado_em?: string | null;
  url?: string | null;
};

export type CrmPortaMetricas = {
  destino_atual?: string | null;
  cliques?: number | null;
  visitantes?: number | null;
  mobile?: number | null;
  por_dia?: Array<{ dia?: string; data?: string; cliques?: number; visitantes?: number }> | null;
};

export type CrmCampanhaMetricas = {
  enviados?: number | null;
  falhas?: number | null;
  cliques?: number | null;
  visitantes?: number | null;
  ctr_pct?: number | null;
};

export type TemplateBotao = {
  type?: string;
  text?: string;
  url?: string;
  [k: string]: any;
};

async function rpc<T = any>(fn: string, args?: Record<string, any>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args ?? {});
  if (error) throw new Error(error.message || `Falha ao chamar ${fn}`);
  return data as T;
}

export const crmDestinosListar = () => rpc<CrmPorta[]>("crm_destinos_listar");

export const crmDestinoDefinir = (p: {
  slug: string;
  destino: string;
  nome?: string | null;
  utm_campaign?: string | null;
  campanha_id?: string | number | null;
}) =>
  rpc("crm_destino_definir", {
    p_slug: p.slug,
    p_destino: p.destino,
    p_nome: p.nome ?? null,
    p_utm_campaign: p.utm_campaign ?? null,
    p_campanha_id: p.campanha_id ?? null,
  });

export const crmDestinoMetricas = (slug: string, dias: number) =>
  rpc<CrmPortaMetricas>("crm_destino_metricas", { p_slug: slug, p_dias: dias });

export const crmPortaEmUso = (slug: string, campanhaId: string | number | null) =>
  rpc<any>("crm_porta_em_uso", { p_slug: slug, p_campanha_id: campanhaId ?? null });

export const crmCampanhaMetricas = (campanhaId: string | number) =>
  rpc<CrmCampanhaMetricas>("crm_campanha_metricas", { p_campanha_id: campanhaId });

export const campanhaLinkSalvar = (
  campanhaId: string | number,
  slug: string | null,
  destino: string | null,
) =>
  rpc("campanhas_whatsapp_link_salvar", {
    p_campanha_id: campanhaId,
    p_link_slug: slug,
    p_link_destino: destino,
  });

/** Normaliza o retorno de crm_porta_em_uso em nome de campanha ou null. */
export function nomeCampanhaEmUso(bruto: any): string | null {
  if (!bruto) return null;
  if (typeof bruto === "string") return bruto.trim() ? bruto : null;
  if (Array.isArray(bruto)) return nomeCampanhaEmUso(bruto[0]);
  if (typeof bruto === "object") {
    const v = bruto.nome ?? bruto.campanha ?? bruto.campanha_nome ?? bruto.nome_campanha;
    return typeof v === "string" && v.trim() ? v : null;
  }
  return null;
}

export const URL_REGEX = /(https?:\/\/[^\s]+|\bwww\.[^\s]+)/i;

export function corpoTemUrl(corpo: string) {
  return URL_REGEX.test(corpo || "");
}

export function removerUrlDoCorpo(corpo: string) {
  return (corpo || "")
    .replace(/(https?:\/\/[^\s]+|\bwww\.[^\s]+)/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const DOMINIO_LOJA = "usemarianacardoso.com.br";

export function avisoDestino(url: string): string | null {
  const v = (url || "").trim();
  if (!v) return null;
  if (!/^https:\/\//i.test(v)) return "O link precisa começar com https://";
  try {
    const host = new URL(v).hostname.toLowerCase();
    if (!host.endsWith(DOMINIO_LOJA)) {
      return `Esse link aponta para ${host}, fora de ${DOMINIO_LOJA}. Confira se é isso mesmo.`;
    }
  } catch {
    return "Endereço inválido.";
  }
  return null;
}

/** Extrai os botões de URL de um template (aceita jsonb array ou string). */
export function botoesUrl(botoes: any): TemplateBotao[] {
  let arr = botoes;
  if (typeof arr === "string") {
    try { arr = JSON.parse(arr); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr.filter((b: any) => String(b?.type ?? "").toUpperCase() === "URL" && b?.url);
}

/** Descobre o slug da porta a partir da URL do botão. */
export function slugDaUrl(url: string, portas: CrmPorta[]): string | null {
  const alvo = (url || "").replace(/\/+$/, "").toLowerCase();
  for (const p of portas) {
    const u = (p.url || "").replace(/\/+$/, "").toLowerCase();
    if (u && u === alvo) return p.slug;
  }
  const m = alvo.match(/\/([a-z0-9_-]+)$/i);
  if (m && portas.some((p) => p.slug === m[1])) return m[1];
  return null;
}
