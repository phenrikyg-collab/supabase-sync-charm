import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let redirecionandoParaLogin = false;

type ErroComCodigo = {
  message?: string;
  code?: string | number;
  status?: number;
};

function ehErroJwtExpirado(error: ErroComCodigo | null | undefined): boolean {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const code = String(error.code ?? "");
  if (code === "PGRST301" || code === "401") return true;
  if (error.status === 401) return true;
  return msg.includes("jwt expired") || (msg.includes("jwt") && msg.includes("expired"));
}

async function sessaoExpirada(): Promise<void> {
  if (redirecionandoParaLogin) return;
  redirecionandoParaLogin = true;
  try {
    await supabase.auth.signOut();
  } catch {
    // segue mesmo assim
  }
  toast.error("Sua sessão expirou, entre novamente");
  setTimeout(() => {
    window.location.href = "/login";
  }, 800);
}

/**
 * Chamada única de RPC com renovação automática de sessão.
 * Se a chamada falhar por token expirado, renova a sessão e tenta
 * mais uma vez. Se não houver como renovar, limpa a sessão e manda
 * para a tela de login. Qualquer outro erro volta como antes.
 */
export async function chamarRpc<T = unknown>(
  nome: string,
  params?: Record<string, unknown>,
): Promise<{ data: T | null; error: ErroComCodigo | null }> {
  let res = (await supabase.rpc(nome, params as never)) as unknown as {
    data: T | null;
    error: ErroComCodigo | null;
  };

  if (res.error && ehErroJwtExpirado(res.error)) {
    const { data: renovacao, error: erroRefresh } = await supabase.auth.refreshSession();
    if (erroRefresh || !renovacao.session) {
      await sessaoExpirada();
      return res;
    }
    res = (await supabase.rpc(nome, params as never)) as unknown as {
      data: T | null;
      error: ErroComCodigo | null;
    };
    if (res.error && ehErroJwtExpirado(res.error)) {
      await sessaoExpirada();
    }
  }

  return res;
}

let monitorSessaoIniciado = false;

/**
 * Renova a sessão quando a aba volta ao foco (ex.: computador que
 * dormiu com o painel aberto). Se o token estiver perto de expirar
 * ou já expirado, renova na hora.
 */
export function monitorarRenovacaoSessao(): void {
  if (monitorSessaoIniciado || typeof window === "undefined") return;
  monitorSessaoIniciado = true;

  const verificar = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const sessao = data.session;
      if (!sessao) return;
      const expiraEm = sessao.expires_at ?? 0;
      const agora = Math.floor(Date.now() / 1000);
      if (expiraEm - agora < 120) {
        await supabase.auth.refreshSession();
      }
    } catch {
      // sem sessão válida: as chamadas tratam o erro
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void verificar();
  });
  window.addEventListener("focus", () => {
    void verificar();
  });
}
