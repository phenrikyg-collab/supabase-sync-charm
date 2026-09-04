import { supabase } from "@/integrations/supabase/client";
import { lerErroEdge } from "@/lib/edgeError";

export type ItemEnvio = "holerite" | "comprovante" | "ciencia";

export const ITEM_LABEL: Record<ItemEnvio, string> = {
  holerite: "Holerite em PDF",
  comprovante: "Comprovante do Pix em PDF",
  ciencia: "Link para assinar",
};

export const ITEM_CURTO: Record<ItemEnvio, string> = {
  holerite: "holerite",
  comprovante: "comprovante",
  ciencia: "link",
};

export type FilaItem = {
  funcionario_id: string;
  nome: string;
  whatsapp: string | null;
  tem_numero: boolean;
  holerite_id: string;
  documento_tipo: string | null;
  liquido: number | null;
  ciente: boolean | null;
  pagamento_id: string | null;
  pagamento_status: string | null;
  holerite_enviado: number | null;
  ciencia_enviada: number | null;
  comprovante_enviado: number | null;
};

export type ResultadoItem = {
  item: ItemEnvio;
  ok: boolean;
  arquivo?: string;
  url?: string;
  erro?: string;
};

export type ResultadoEnvio = {
  holerite_id: string;
  nome: string;
  documento_tipo?: string | null;
  destino?: string | null;
  ok: boolean;
  erro?: string;
  resultados: ResultadoItem[];
};

export type RespostaEnvio = {
  ok: boolean;
  enviados: number;
  total: number;
  teste?: boolean;
  resultados: ResultadoEnvio[];
};

/** true quando o item falhou apenas por ausência de documento — é aviso, não erro. */
export const ehAviso = (r: ResultadoItem) =>
  !r.ok && /sem comprovante|não há comprovante|sem documento/i.test(r.erro ?? "");

export function mensagemAmigavel(msg: string): string {
  const m = (msg ?? "").toLowerCase();
  if (m.includes("instância não conectada") || m.includes("instancia nao conectada") || m.includes("(close)")) {
    return "O WhatsApp do sistema está desconectado. Releia o QR code no manager da Evolution.";
  }
  if (m.includes("sem número de whatsapp") || m.includes("sem numero de whatsapp")) {
    return "Essa funcionária não tem número de WhatsApp cadastrado. Cadastre na aba Funcionários.";
  }
  return msg;
}

export const semNumeroCadastrado = (msg: string) =>
  /sem n[úu]mero de whatsapp/i.test(msg ?? "");

/** Chama a edge function rh-whatsapp lendo o corpo real da resposta em caso de erro. */
export async function chamarWhatsapp<T = any>(
  body: Record<string, any>,
): Promise<{ data: T | null; erro: string | null }> {
  const { data, error } = await supabase.functions.invoke("rh-whatsapp", { body });
  if (error) {
    const e = await lerErroEdge(error, "Não foi possível falar com o WhatsApp");
    return { data: null, erro: mensagemAmigavel([e.mensagem, e.dica].filter(Boolean).join(" — ")) };
  }
  const d: any = data;
  if (d && d.ok === false && (d.erro || d.error)) {
    return { data: null, erro: mensagemAmigavel(d.erro ?? d.error) };
  }
  return { data: d as T, erro: null };
}

/* ---------------- telefone ---------------- */

export const soDigitos = (v: string) => (v ?? "").replace(/\D/g, "");

/** Máscara brasileira: (11) 99999-9999 */
export function mascaraTelefone(valor: string): string {
  let d = soDigitos(valor);
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function telefoneValido(valor: string): boolean {
  const d = soDigitos(valor);
  return d.length === 10 || d.length === 11;
}

export function telefoneBonito(valor?: string | null): string {
  if (!valor) return "—";
  const m = mascaraTelefone(String(valor));
  return m || String(valor);
}
