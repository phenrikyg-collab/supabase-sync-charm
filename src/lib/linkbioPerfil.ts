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
};

export const CONFIG_PADRAO: ConfigGeral = {
  logo_url: "",
  titulo: "",
  descricao: "",
  ordem_blocos: [...BLOCOS_IDS],
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
  };
}

export async function salvarConfigGeral(cfg: ConfigGeral) {
  const { error } = await supabase.rpc("linkbio_admin_update_config_geral" as any, {
    p_logo_url: cfg.logo_url || null,
    p_titulo: cfg.titulo || null,
    p_descricao: cfg.descricao || null,
    p_ordem_blocos: normalizarOrdem(cfg.ordem_blocos),
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
