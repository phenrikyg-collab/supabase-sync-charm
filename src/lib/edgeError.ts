// Extrai a mensagem real do corpo da resposta de uma Edge Function.
// supabase.functions.invoke não lê o body em erro — ele vem em error.context (Response).
export type ErroEdge = { mensagem: string; dica?: string; status?: number; corpo?: any };

export async function lerErroEdge(error: any, fallback = "Erro inesperado"): Promise<ErroEdge> {
  const status = error?.context?.status;
  let corpo: any = null;
  try {
    corpo = await error.context.clone().json();
  } catch {
    try {
      const txt = await error.context.clone().text();
      corpo = txt ? { erro: txt } : null;
    } catch {
      corpo = null;
    }
  }
  const mensagem =
    corpo?.detalhe ?? corpo?.erro ?? corpo?.error ?? corpo?.message ?? error?.message ?? fallback;
  return { mensagem, dica: corpo?.dica, status, corpo };
}
