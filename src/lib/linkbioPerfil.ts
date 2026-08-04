import { supabase } from "@/integrations/supabase/client";

export const BLOCOS_DISPONIVEIS = [
  { id: "perfil", nome: "Perfil (logo, nome e descrição)" },
  { id: "botoes", nome: "Botões" },
  { id: "produtos", nome: "Produtos em destaque" },
  { id: "lead", nome: "Captura de lead / cupom" },
] as const;

export type PerfilLinkBio = {
  logo_url: string;
  nome: string;
  descricao: string;
  ordem_blocos: string[];
  atualizado_em?: string;
};

export const PERFIL_PADRAO: PerfilLinkBio = {
  logo_url: "",
  nome: "Use Mariana Cardoso",
  descricao: "",
  ordem_blocos: BLOCOS_DISPONIVEIS.map((b) => b.id),
};

const BUCKET = "linkbio";
const CAMINHO = "config/perfil.json";

export function perfilPublicUrl() {
  return supabase.storage.from(BUCKET).getPublicUrl(CAMINHO).data.publicUrl;
}

export async function carregarPerfil(): Promise<PerfilLinkBio> {
  try {
    const res = await fetch(`${perfilPublicUrl()}?t=${Date.now()}`);
    if (!res.ok) return PERFIL_PADRAO;
    const json = (await res.json()) as Partial<PerfilLinkBio>;
    const ordem = Array.isArray(json.ordem_blocos) ? json.ordem_blocos : [];
    const faltantes = BLOCOS_DISPONIVEIS.map((b) => b.id).filter((id) => !ordem.includes(id));
    return {
      ...PERFIL_PADRAO,
      ...json,
      ordem_blocos: [...ordem.filter((id) => BLOCOS_DISPONIVEIS.some((b) => b.id === id)), ...faltantes],
    };
  } catch {
    return PERFIL_PADRAO;
  }
}

export async function salvarPerfil(perfil: PerfilLinkBio) {
  const conteudo = new Blob(
    [JSON.stringify({ ...perfil, atualizado_em: new Date().toISOString() }, null, 2)],
    { type: "application/json" },
  );
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(CAMINHO, conteudo, { upsert: true, cacheControl: "60", contentType: "application/json" });
  if (error) throw error;
}

export async function uploadLogo(file: File) {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `config/logo-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
