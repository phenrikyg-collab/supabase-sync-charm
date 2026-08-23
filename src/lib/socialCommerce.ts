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

/** Mensagem padrão quando o comentário não existe mais no Instagram (apagado ou editado — editar troca o id). */
export const MSG_COMENTARIO_REMOVIDO =
  "Este comentário não existe mais no Instagram. Normalmente a cliente apagou, ou editou o texto (editar troca o id do comentário). Não dá para responder nem mandar Direct a partir dele.";

/** Detecta o caso "comentário apagado/editado" a partir do erro devolvido pela edge function. */
export function ehComentarioRemovido(e: any): boolean {
  if (e?.motivo === "comentario_removido") return true;
  return /não existe mais no Instagram|does not exist/i.test(e?.message ?? "");
}

export interface ResultadoEnvioDuplo {
  ok?: boolean;
  dm?: { ok?: boolean; [k: string]: any } | null;
  publica?: { ok?: boolean; [k: string]: any } | null;
  aviso?: string | null;
  motivo?: string;
  dica?: string;
  detalhe?: string;
  erro?: string;
  error?: string;
}

/**
 * Responde no comentário E no Direct numa chamada só (tipo "comentario_e_dm").
 * O backend envia o Direct primeiro; se ele falhar, a resposta pública ainda sai
 * (com texto_publico_sem_dm quando informado). Sucesso parcial NÃO lança erro —
 * o chamador mostra o resultado de cada canal. Só lança quando nada saiu.
 */
export async function enviarComentarioEDm(payload: Record<string, any>): Promise<ResultadoEnvioDuplo> {
  const { data, error } = await supabase.functions.invoke("instagram-enviar", {
    body: { tipo: "comentario_e_dm", ...payload },
  });

  if (error) {
    const det = await lerErroEdge(error, "Falha ao enviar. Tente novamente.");
    const err = new Error(det.mensagem) as ErroEnvio;
    err.status = det.status;
    err.motivo = det.corpo?.motivo;
    err.dica = det.dica;
    throw err;
  }

  const r = (data ?? {}) as ResultadoEnvioDuplo;
  const dmOk = r.dm?.ok === true;
  const pubOk = r.publica?.ok === true;
  // Falha total (nenhum canal saiu) continua sendo erro
  if (r.ok === false && !dmOk && !pubOk) {
    const err = new Error(r.detalhe || r.erro || r.error || "A Meta não confirmou o envio.") as ErroEnvio;
    err.motivo = r.motivo;
    err.dica = r.dica;
    throw err;
  }
  return r;
}

// ===== Lido / não lido de conversas (DM) =====
// Nunca escrever nao_lidas direto na tabela — sempre pelas funções do banco,
// para que menu, lista e filtro de pendentes contem a mesma coisa.

export interface RespostaMarcacao {
  ok?: boolean;
  conversa_id?: number;
  nao_lidas?: number;
  revisao_pendente?: boolean;
  revisada_em?: string | null;
  revisada_por?: string | null;
}

// Os nomes dos parâmetros dependem da migração aplicada — tenta as variantes conhecidas
// e memoriza a que funcionar.
const VARIANTES_MARCAR: Array<(id: number, lida: boolean, usuario: string) => Record<string, any>> = [
  (id, lida, usuario) => ({ p_conversa_id: id, p_lida: lida, p_usuario: usuario }),
  (id, lida, usuario) => ({ _conversa_id: id, _lida: lida, _usuario: usuario }),
  (id, lida, usuario) => ({ conversa_id: id, lida, usuario }),
];
let idxVarianteMarcar: number | null = null;

const ehErroAssinatura = (msg?: string) =>
  /schema cache|could not find|does not exist|no function matches/i.test(msg ?? "");

/** Marca uma conversa como lida (true) ou não lida (false). Retorna os campos atualizados. */
export async function marcarConversaLida(
  conversaId: number,
  lida: boolean,
  usuario?: string | null,
): Promise<RespostaMarcacao | null> {
  const usu = usuario ?? "painel";
  const todos = VARIANTES_MARCAR.map((_, i) => i);
  const ordem = idxVarianteMarcar != null ? [idxVarianteMarcar, ...todos.filter((i) => i !== idxVarianteMarcar)] : todos;
  let ultimoErro: any = null;
  for (const i of ordem) {
    const { data, error } = await db.rpc("fn_ig_marcar_conversa", VARIANTES_MARCAR[i](conversaId, lida, usu));
    if (!error) {
      idxVarianteMarcar = i;
      return (data ?? null) as RespostaMarcacao | null;
    }
    ultimoErro = error;
    // Erro de negócio (não de assinatura) — não adianta tentar outra variante
    if (!ehErroAssinatura(error.message)) throw new Error(error.message);
  }
  throw new Error(ultimoErro?.message ?? "Função fn_ig_marcar_conversa indisponível no banco.");
}

/** Marca todas as conversas como lidas de uma vez. */
export async function marcarTodasLidas(usuario?: string | null): Promise<any> {
  const usu = usuario ?? "painel";
  const variantes: Record<string, any>[] = [{ p_usuario: usu }, { _usuario: usu }, { usuario: usu }];
  let ultimoErro: any = null;
  for (const args of variantes) {
    const { data, error } = await db.rpc("fn_ig_marcar_todas_lidas", args);
    if (!error) return data;
    ultimoErro = error;
    if (!ehErroAssinatura(error.message)) throw new Error(error.message);
  }
  throw new Error(ultimoErro?.message ?? "Função fn_ig_marcar_todas_lidas indisponível no banco.");
}

/**
 * Devolve a conversa para a Anna (encerra o atendimento humano — status 'em_atendimento').
 * Mesma tolerância a variantes de assinatura das outras funções do painel.
 */
export async function devolverParaAnna(conversaId: number, usuario?: string | null): Promise<any> {
  const usu = usuario ?? "painel";
  const variantes: Record<string, any>[] = [
    { p_conversa_id: conversaId, p_usuario: usu },
    { _conversa_id: conversaId, _usuario: usu },
    { conversa_id: conversaId, usuario: usu },
  ];
  let ultimoErro: any = null;
  for (const args of variantes) {
    const { data, error } = await db.rpc("fn_ig_devolver_para_anna", args);
    if (!error) {
      if (data && data.ok === false) throw new Error(data.erro ?? "Não foi possível devolver a conversa.");
      return data;
    }
    ultimoErro = error;
    if (!ehErroAssinatura(error.message)) throw new Error(error.message);
  }
  throw new Error(ultimoErro?.message ?? "Função fn_ig_devolver_para_anna indisponível no banco.");
}
