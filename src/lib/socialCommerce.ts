import { supabase } from "@/integrations/supabase/client";
import { lerErroEdge } from "./edgeError";

// As tabelas instagram_* ainda não estão nos tipos gerados.
export const db = supabase as any;

export interface ErroEnvio extends Error {
  status?: number;
  motivo?: string;
  dica?: string;
}

/**
 * Única porta de saída para DM / resposta a comentário / private reply.
 * Nunca inserir mensagem de saída direto na tabela — sempre pela edge function.
 */
export async function enviarInstagram(payload: Record<string, any>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("instagram-enviar", { body: payload });

  if (error) {
    const det = await lerErroEdge(error, "Falha ao enviar. Tente novamente.");
    const err = new Error(det.mensagem) as ErroEnvio;
    err.status = det.status;
    err.motivo = det.corpo?.motivo;
    err.dica = det.dica;
    throw err;
  }

  // Nada é considerado enviado sem confirmação da Meta (ok: true)
  if (data && data.ok === false) {
    const err = new Error(
      data.detalhe || data.erro || data.error || "A Meta não confirmou o envio.",
    ) as ErroEnvio;
    err.motivo = data.motivo;
    err.dica = data.dica;
    throw err;
  }

  return data;
}

/** Comentários com mais de 7 dias não aceitam resposta (regra da Meta). */
export function comentarioForaDoPrazo(publicadoEm?: string | null): boolean {
  if (!publicadoEm) return false;
  const t = new Date(publicadoEm).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > 7 * 24 * 60 * 60 * 1000;
}

export const MOTIVOS_409: Record<string, string> = {
  janela_expirada: "A janela de 24 horas dessa conversa fechou.",
  ja_usada: "A Meta permite apenas uma resposta privada por comentário — esta já foi usada.",
  fora_do_prazo: "Comentários com mais de 7 dias não podem ser respondidos (regra da Meta).",
};
