import { supabase } from "@/integrations/supabase/client";
import { uploadMidia } from "@/components/social-commerce/midiaUpload";

export const db = supabase as any;

/* ---------------- tipos ---------------- */

export type StatusRoteiro =
  | "rascunho" | "agendado" | "publicando" | "publicado" | "parcial" | "falhou" | "cancelado";

export type StatusSlide =
  | "pendente" | "publicando" | "publicado" | "manual_pendente" | "falhou" | "ignorado";

export type Slide = {
  id?: number;
  roteiro_id?: number;
  ordem?: number;
  midia_url?: string | null;
  manual?: boolean | null;
  observacao?: string | null;
  palavras_gatilho?: string[] | null;
  gatilho_qualquer?: boolean | null;
  resposta_dm?: string | null;
  produto_id?: string | null;
  link?: string | null;
  enquete_opcoes?: string[] | null;
  status?: StatusSlide | null;
  erro?: string | null;
  media_id?: string | null;
  publicado_em?: string | null;
  tentativas?: number | null;
  /** chave só de tela, para arrastar slides ainda sem id */
  _key?: string;
};

export type Roteiro = {
  id?: number;
  titulo?: string | null;
  objetivo?: string | null;
  agendado_para?: string | null;
  intervalo_segundos?: number | null;
  status?: StatusRoteiro | null;
  erro?: string | null;
  iniciado_em?: string | null;
  concluido_em?: string | null;
  criado_por?: string | null;
};

export const ROTULO_STATUS_ROTEIRO: Record<string, string> = {
  rascunho: "Rascunho",
  agendado: "Agendado",
  publicando: "Publicando",
  publicado: "Publicado",
  parcial: "Publicado em parte",
  falhou: "Falhou",
  cancelado: "Cancelado",
};

export const CLASSE_STATUS_ROTEIRO: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  agendado: "bg-blue-100 text-blue-800 border-blue-200",
  publicando: "bg-amber-100 text-amber-800 border-amber-200",
  publicado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  parcial: "bg-amber-100 text-amber-800 border-amber-200",
  falhou: "bg-red-100 text-red-800 border-red-200",
  cancelado: "bg-muted text-muted-foreground border-border",
};

export const ROTULO_STATUS_SLIDE: Record<string, string> = {
  pendente: "Na fila",
  publicando: "Publicando",
  publicado: "No ar",
  manual_pendente: "Espera você publicar pelo app",
  falhou: "Falhou",
  ignorado: "Fora da sequência",
};

export const CLASSE_STATUS_SLIDE: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground border-border",
  publicando: "bg-amber-100 text-amber-800 border-amber-200",
  publicado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  manual_pendente: "bg-purple-100 text-purple-800 border-purple-200",
  falhou: "bg-red-100 text-red-800 border-red-200",
  ignorado: "bg-muted text-muted-foreground border-border",
};

export const INTERVALOS = [
  { valor: 0, rotulo: "Sem intervalo" },
  { valor: 120, rotulo: "2 minutos" },
  { valor: 300, rotulo: "5 minutos" },
  { valor: 600, rotulo: "10 minutos" },
];

export const AVISO_API =
  "Story por API é imagem JPEG ou vídeo MP4. Enquete nativa, link sticker, marcação de produto e música só existem publicando pelo app: marque o slide como manual.";

/* ---------------- formatação ---------------- */

export const dataHoraBR = (v?: string | null) => {
  if (!v) return "sem horário";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const horaBR = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

export const pctBR = (v: any) =>
  v === null || v === undefined ? "sem dados" : `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export const numBR = (v: any) =>
  v === null || v === undefined ? "sem dados" : Number(v).toLocaleString("pt-BR");

/** timestamptz -> valor de <input type="datetime-local"> no fuso do navegador */
export const paraInputLocal = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const deInputLocal = (v: string) => (v ? new Date(v).toISOString() : null);

/* ---------------- validação de mídia ---------------- */

export const IMAGEM_OK = ["image/jpeg"];
export const VIDEO_OK = ["video/mp4", "video/quicktime"];
export const CONVERTIVEIS = ["image/png", "image/webp", "image/heic", "image/heif"];

export type Validacao = { ok: boolean; msg?: string; acao?: "converter"; checarDuracao?: boolean };

export function validarMidia(file: File): Validacao {
  if (IMAGEM_OK.includes(file.type)) {
    if (file.size > 8 * 1024 * 1024) {
      return {
        ok: false,
        msg: `Imagem de ${(file.size / 1048576).toFixed(1)} MB. O limite do Instagram é 8 MB.`,
      };
    }
    return { ok: true };
  }
  if (VIDEO_OK.includes(file.type)) {
    if (file.size > 100 * 1024 * 1024) {
      return {
        ok: false,
        msg: `Vídeo de ${(file.size / 1048576).toFixed(0)} MB. O limite do Instagram é 100 MB.`,
      };
    }
    return { ok: true, checarDuracao: true };
  }
  if (CONVERTIVEIS.includes(file.type)) {
    return {
      ok: false,
      acao: "converter",
      msg:
        `Este arquivo é ${file.type.split("/")[1].toUpperCase()}. ` +
        "O Instagram aceita somente JPEG em story publicado por API. Salve como .jpg e envie de novo.",
    };
  }
  return { ok: false, msg: "Formato não aceito. Use JPEG para imagem, ou MP4/MOV para vídeo." };
}

/** Lê a duração do vídeo pelo próprio navegador, antes de subir o arquivo. */
export function duracaoDoVideo(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const d = el.duration;
      URL.revokeObjectURL(el.src);
      resolve(d);
    };
    el.onerror = () => {
      URL.revokeObjectURL(el.src);
      reject(new Error("Não deu para ler a duração do vídeo."));
    };
    el.src = URL.createObjectURL(file);
  });
}

export function validarDuracao(segundos: number): Validacao {
  const s = Math.round(segundos);
  if (s < 3) return { ok: false, msg: `Vídeo de ${s} s. O mínimo do story é 3 segundos.` };
  if (s > 60) return { ok: false, msg: `Vídeo de ${s} s. O story corta em 60 segundos: edite antes de subir.` };
  return { ok: true };
}

/** Converte PNG, WEBP ou HEIC para JPEG no próprio navegador (máx. 1440px de largura). */
export function converterParaJpeg(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const escala = img.width > 1440 ? 1440 / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Não deu para converter a imagem neste navegador."));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          if (!blob) return reject(new Error("Não deu para converter a imagem neste navegador."));
          const nome = file.name.replace(/\.[^.]+$/, "") + ".jpg";
          resolve(new File([blob], nome, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Não deu para abrir esta imagem para converter."));
    };
    img.src = URL.createObjectURL(file);
  });
}

export const subirMidiaStory = (file: File) => uploadMidia(file, "stories");

export const ehVideo = (url?: string | null) => !!url && /\.(mp4|mov|m4v)(\?|#|$)/i.test(url);

/* ---------------- dados ---------------- */

export type Aviso = { ordem?: number; midia_url?: string; problema?: string } | string;

export type RetornoSalvar = {
  ok: boolean;
  id?: number;
  slides?: number;
  motivo?: string;
  avisos?: Aviso[];
};

export async function salvarRoteiro(p_dados: Record<string, any>): Promise<RetornoSalvar> {
  const { data, error } = await db.rpc("fn_stories_roteiro_salvar", { p_dados });
  if (error) throw new Error(error.message);
  const raiz = Array.isArray(data) ? data[0] ?? {} : data ?? {};
  return raiz as RetornoSalvar;
}

export async function listarRoteiros(): Promise<any[]> {
  const { data, error } = await db
    .from("instagram_stories_roteiros")
    .select("*")
    .order("agendado_para", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listarSlides(roteiroId: number): Promise<Slide[]> {
  const { data, error } = await db
    .from("instagram_stories_slides")
    .select("*")
    .eq("roteiro_id", roteiroId)
    .order("ordem");
  if (error) throw new Error(error.message);
  return (data ?? []) as Slide[];
}

/** Contagem de slides e se existe slide com erro, por roteiro. */
export async function resumoSlides(): Promise<Record<number, { total: number; comErro: number }>> {
  const { data, error } = await db
    .from("instagram_stories_slides")
    .select("roteiro_id, erro")
    .limit(5000);
  if (error) throw new Error(error.message);
  const mapa: Record<number, { total: number; comErro: number }> = {};
  (data ?? []).forEach((s: any) => {
    const k = Number(s.roteiro_id);
    if (!mapa[k]) mapa[k] = { total: 0, comErro: 0 };
    mapa[k].total += 1;
    if (s.erro) mapa[k].comErro += 1;
  });
  return mapa;
}

export async function publicarAgora(roteiroId: number) {
  const { data, error } = await supabase.functions.invoke("instagram-stories-publicar", {
    body: { forcar_id: roteiroId, ignorar_agendamento: true },
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function marcarSlidePublicadoManual(slideId: number) {
  const { error } = await db
    .from("instagram_stories_slides")
    .update({ status: "ignorado", erro: "publicado manualmente pelo app" })
    .eq("id", slideId);
  if (error) throw new Error(error.message);
}

export async function desempenhoRoteiro(roteiroId: number): Promise<any[]> {
  const { data, error } = await db
    .from("vw_stories_roteiro_desempenho")
    .select("*")
    .eq("roteiro_id", roteiroId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type Enquete = {
  total?: number;
  por_opcao?: Record<string, number>;
  pessoas?: { conversa_id: number; username?: string; nome?: string; opcao?: string; texto?: string; quando?: string }[];
};

export async function enqueteDoSlide(slideId: number): Promise<Enquete> {
  const { data, error } = await db.rpc("fn_stories_enquete", { p_slide_id: slideId });
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data[0] ?? {} : data ?? {}) as Enquete;
}

/* ---------------- regras de tela ---------------- */

/** Slide inválido para agendar: tem erro gravado, ou não é manual e está sem mídia. */
export function slideInvalido(s: Slide): boolean {
  if (s.erro) return true;
  if (!s.manual && !s.midia_url) return true;
  return false;
}

export function textoAvisos(avisos?: Aviso[]): string[] {
  return (avisos ?? []).map((a) =>
    typeof a === "string"
      ? a
      : `Slide ${a.ordem ?? "?"}: ${a.problema ?? "mídia que o Instagram recusa"}`,
  );
}
