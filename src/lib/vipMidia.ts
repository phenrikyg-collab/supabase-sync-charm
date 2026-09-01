import { supabase } from "@/integrations/supabase/client";

export const BUCKET_VIP_MIDIA = "vip-midia";
export const VIP_MIDIA_MAX_BYTES = 25 * 1024 * 1024;
export const VIP_MIDIA_TIPOS = ["image/jpeg", "image/png", "image/webp", "video/mp4"];

const EXT_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
};

/**
 * Sobe uma mídia de marca/produto para o bucket público vip-midia.
 * Caminho: mensagens/<ano>-<mes>/<uuid>.<ext> — sem nome original (acento/espaço quebram a URL).
 * Foto de cliente NÃO vai aqui: prova social continua no bucket privado vip-provas.
 */
export async function uploadVipMidia(file: File): Promise<string> {
  if (file.size > VIP_MIDIA_MAX_BYTES) {
    throw new Error("Arquivo acima de 25 MB — o bucket recusa. Reduza o arquivo e tente de novo.");
  }
  if (!VIP_MIDIA_TIPOS.includes(file.type)) {
    throw new Error("Formato não aceito. Use JPEG, PNG, WebP ou MP4.");
  }

  const agora = new Date();
  const pasta = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const ext = EXT_POR_TIPO[file.type] ?? "bin";
  const path = `mensagens/${pasta}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_VIP_MIDIA)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  return supabase.storage.from(BUCKET_VIP_MIDIA).getPublicUrl(path).data.publicUrl;
}
