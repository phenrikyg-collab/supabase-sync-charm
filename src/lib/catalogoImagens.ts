import { supabase } from "@/integrations/supabase/client";

export const BUCKET_CATALOGO = "catalogo-produtos";
export const LIMITE_BYTES = 358400; // 350 KB — limite da API da Tray
export const LADO_MAXIMO = 2000;
export const MAX_IMAGENS = 15;

function normalizarNome(nome: string) {
  const base = nome.replace(/\.[^.]+$/, "");
  return (
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "foto"
  ) + ".jpg";
}

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("não consegui ler essa imagem"));
    };
    img.src = url;
  });
}

function paraBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("falha ao comprimir a imagem"))),
      "image/jpeg",
      qualidade,
    ),
  );
}

/** Redimensiona para no máximo 2000px e comprime em JPEG até caber em 350 KB. */
export async function comprimirImagem(arquivo: File): Promise<Blob> {
  const img = await carregarImagem(arquivo);
  const maior = Math.max(img.width, img.height);
  const escala = maior > LADO_MAXIMO ? LADO_MAXIMO / maior : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("navegador não conseguiu processar a imagem");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let qualidade = 0.85;
  let blob = await paraBlob(canvas, qualidade);
  while (blob.size > LIMITE_BYTES && qualidade > 0.6) {
    qualidade = Number((qualidade - 0.05).toFixed(2));
    blob = await paraBlob(canvas, qualidade);
  }
  if (blob.size > LIMITE_BYTES) {
    throw new Error("imagem muito pesada, reduza antes de enviar");
  }
  return blob;
}

export interface FotoCatalogo {
  url: string;
  caminho?: string | null;
}

export async function enviarFoto(catalogoId: string, cor: string | null, arquivo: File): Promise<FotoCatalogo> {
  const comprimido = await comprimirImagem(arquivo);
  const caminho = `${catalogoId}/${cor || "produto"}/${Date.now()}-${normalizarNome(arquivo.name)}`;
  const { error } = await supabase.storage
    .from(BUCKET_CATALOGO)
    .upload(caminho, comprimido, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET_CATALOGO).getPublicUrl(caminho);
  return { url: data.publicUrl, caminho };
}

export async function removerFoto(caminho?: string | null) {
  if (!caminho) return;
  await supabase.storage.from(BUCKET_CATALOGO).remove([caminho]);
}

/** Extrai o caminho dentro do bucket a partir de uma URL pública nossa. */
export function caminhoDaUrl(url: string): string | null {
  const marca = `/${BUCKET_CATALOGO}/`;
  const i = url.indexOf(marca);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + marca.length));
}

export async function salvarImagens(
  produtoId: string,
  imagens: string[],
  imagensPorCor: Record<string, string[]>,
) {
  const { error } = await (supabase as any).rpc("catalogo_produto_imagens_salvar", {
    p_produto_id: produtoId,
    p_imagens: imagens,
    p_imagens_por_cor: imagensPorCor,
  });
  if (error) throw new Error(error.message);
}
