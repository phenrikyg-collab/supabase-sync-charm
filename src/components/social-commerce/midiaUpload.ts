import { supabase } from "@/integrations/supabase/client";

export const BUCKET_MIDIA = "instagram-midia";

/** Sobe um arquivo para o bucket instagram-midia e devolve a URL pública. */
export async function uploadMidia(file: File, pasta = "publicacoes"): Promise<string> {
  const nomeSeguro = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${pasta}/${Date.now()}_${nomeSeguro}`;
  const { error } = await supabase.storage.from(BUCKET_MIDIA).upload(path, file);
  if (error && /bucket/i.test(error.message ?? "")) {
    // Bucket pode não existir ainda — tenta criar e refaz o upload
    try {
      await (supabase.storage as any).createBucket(BUCKET_MIDIA, { public: true });
    } catch {
      /* sem permissão ou já existe — o retry abaixo resolve se existir */
    }
    const retry = await supabase.storage.from(BUCKET_MIDIA).upload(path, file);
    if (retry.error) throw retry.error;
  } else if (error) {
    throw error;
  }
  return supabase.storage.from(BUCKET_MIDIA).getPublicUrl(path).data.publicUrl;
}

/** Heurística por extensão para URLs já salvas (quando não temos o File). */
export function ehUrlDeVideo(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(url);
}
