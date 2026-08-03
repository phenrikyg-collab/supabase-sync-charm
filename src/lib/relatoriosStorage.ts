import { supabase } from "@/integrations/supabase/client";

export const RELATORIOS_BUCKET = "mc-imagens";
export const RELATORIOS_PREFIX = "relatorios";

export interface RelatorioArquivo {
  /** caminho completo no storage */
  path: string;
  /** nome do arquivo */
  nome: string;
  /** rótulo legível (parte antes do timestamp) */
  label: string;
  /** URL pública para o iframe */
  url: string;
  criadoEm?: string;
}

function slugify(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function publicUrl(path: string) {
  return supabase.storage.from(RELATORIOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Lista os HTMLs enviados para uma pasta (ex.: "tendencias" ou "planejamento"). */
export async function listarRelatorios(pasta: string): Promise<RelatorioArquivo[]> {
  const dir = `${RELATORIOS_PREFIX}/${pasta}`;
  const { data, error } = await supabase.storage.from(RELATORIOS_BUCKET).list(dir, {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error || !data) return [];
  return data
    .filter((f) => f.name.toLowerCase().endsWith(".html"))
    .map((f) => {
      const semExt = f.name.replace(/\.html$/i, "");
      const label = semExt.replace(/-\d{10,}$/, "").replace(/-/g, " ");
      const path = `${dir}/${f.name}`;
      return {
        path,
        nome: f.name,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        url: publicUrl(path),
        criadoEm: (f as { created_at?: string }).created_at,
      };
    });
}

/** Envia um HTML para a pasta indicada. Retorna o arquivo criado. */
export async function uploadRelatorio(
  pasta: string,
  file: File,
  label: string,
): Promise<RelatorioArquivo> {
  const base = slugify(label || file.name.replace(/\.html$/i, "")) || "relatorio";
  const nome = `${base}-${Date.now()}.html`;
  const path = `${RELATORIOS_PREFIX}/${pasta}/${nome}`;
  const { error } = await supabase.storage.from(RELATORIOS_BUCKET).upload(path, file, {
    contentType: "text/html",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw error;
  return { path, nome, label, url: publicUrl(path) };
}

export async function removerRelatorio(path: string) {
  const { error } = await supabase.storage.from(RELATORIOS_BUCKET).remove([path]);
  if (error) throw error;
}
