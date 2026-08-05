import { supabase } from "@/integrations/supabase/client";

export const BLOCOS_DISPONIVEIS = [
  { id: "produto_destaque", nome: "Produto em Destaque" },
  { id: "botoes", nome: "Botões" },
  { id: "lead_capture", nome: "Captura de Lead" },
] as const;

export const BLOCOS_IDS = BLOCOS_DISPONIVEIS.map((b) => b.id) as string[];

export type ConfigGeral = {
  logo_url: string;
  titulo: string;
  descricao: string;
  ordem_blocos: string[];
  lead_ativo: boolean;
  lead_titulo: string;
  lead_descricao: string;
  lead_cta_texto: string;
  lead_cupom_codigo: string;
  lead_microcopy: string;
  lead_campo_nome_obrigatorio: boolean;
  lead_campo_whatsapp_obrigatorio: boolean;
  lead_campo_email_obrigatorio: boolean;
  lead_jogo_ativo: boolean;
  lead_jogo_titulo: string;
  lead_jogo_qtd_caixas: number;
  lead_jogo_texto_vitoria: string;
  lead_jogo_cupom_codigo: string;
};

export const CONFIG_PADRAO: ConfigGeral = {
  logo_url: "",
  titulo: "",
  descricao: "",
  ordem_blocos: [...BLOCOS_IDS],
  lead_ativo: true,
  lead_titulo: "",
  lead_descricao: "",
  lead_cta_texto: "",
  lead_cupom_codigo: "",
  lead_microcopy: "",
  lead_campo_nome_obrigatorio: true,
  lead_campo_whatsapp_obrigatorio: true,
  lead_campo_email_obrigatorio: false,
  lead_jogo_ativo: false,
  lead_jogo_titulo: "",
  lead_jogo_qtd_caixas: 3,
  lead_jogo_texto_vitoria: "",
  lead_jogo_cupom_codigo: "",
};

const BUCKET = "linkbio";

export function normalizarOrdem(ordem: unknown): string[] {
  const lista = Array.isArray(ordem) ? (ordem as string[]) : [];
  const validos = lista.filter((id) => BLOCOS_IDS.includes(id));
  return [...validos, ...BLOCOS_IDS.filter((id) => !validos.includes(id))];
}

export async function carregarConfigGeral(): Promise<ConfigGeral> {
  const { data, error } = await supabase.rpc("linkbio_get_config" as any);
  if (error) throw error;
  const raw: any = Array.isArray(data) ? data[0] : data;
  const cfg = raw?.config_geral ?? {};
  return {
    logo_url: cfg.logo_url ?? "",
    titulo: cfg.titulo ?? "",
    descricao: cfg.descricao ?? "",
    ordem_blocos: normalizarOrdem(cfg.ordem_blocos),
    lead_ativo: cfg.lead_ativo ?? true,
    lead_titulo: cfg.lead_titulo ?? "",
    lead_descricao: cfg.lead_descricao ?? "",
    lead_cta_texto: cfg.lead_cta_texto ?? "",
    lead_cupom_codigo: cfg.lead_cupom_codigo ?? "",
    lead_microcopy: cfg.lead_microcopy ?? "",
    lead_campo_nome_obrigatorio: cfg.lead_campo_nome_obrigatorio ?? true,
    lead_campo_whatsapp_obrigatorio: cfg.lead_campo_whatsapp_obrigatorio ?? true,
    lead_campo_email_obrigatorio: cfg.lead_campo_email_obrigatorio ?? false,
    lead_jogo_ativo: cfg.lead_jogo_ativo ?? false,
    lead_jogo_titulo: cfg.lead_jogo_titulo ?? "",
    lead_jogo_qtd_caixas: Math.min(8, Math.max(3, Number(cfg.lead_jogo_qtd_caixas) || 3)),
    lead_jogo_texto_vitoria: cfg.lead_jogo_texto_vitoria ?? "",
    lead_jogo_cupom_codigo: cfg.lead_jogo_cupom_codigo ?? "",
  };
}

export async function salvarConfigGeral(cfg: ConfigGeral) {
  const { error } = await supabase.rpc("linkbio_admin_update_config_geral" as any, {
    p_logo_url: cfg.logo_url || null,
    p_titulo: cfg.titulo || null,
    p_descricao: cfg.descricao || null,
    p_ordem_blocos: normalizarOrdem(cfg.ordem_blocos),
    p_lead_ativo: cfg.lead_ativo,
    p_lead_titulo: cfg.lead_titulo.trim() || null,
    p_lead_descricao: cfg.lead_descricao.trim() || null,
    p_lead_cta_texto: cfg.lead_cta_texto.trim() || null,
    p_lead_cupom_codigo: cfg.lead_cupom_codigo.trim().toUpperCase() || null,
    p_lead_microcopy: cfg.lead_microcopy.trim() || null,
    p_lead_campo_nome_obrigatorio: cfg.lead_campo_nome_obrigatorio,
    p_lead_campo_whatsapp_obrigatorio: cfg.lead_campo_whatsapp_obrigatorio,
    p_lead_campo_email_obrigatorio: cfg.lead_campo_email_obrigatorio,
    p_lead_jogo_ativo: cfg.lead_jogo_ativo,
    p_lead_jogo_titulo: cfg.lead_jogo_titulo.trim() || null,
    p_lead_jogo_qtd_caixas: Math.min(8, Math.max(3, Number(cfg.lead_jogo_qtd_caixas) || 3)),
    p_lead_jogo_texto_vitoria: cfg.lead_jogo_texto_vitoria.trim() || null,
    p_lead_jogo_cupom_codigo: cfg.lead_jogo_cupom_codigo.trim().toUpperCase() || null,
  });
  if (error) throw error;
}

export async function uploadLogo(file: File) {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `geral/logo-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
