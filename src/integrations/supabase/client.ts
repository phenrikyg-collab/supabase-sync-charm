import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ezdtulcrqzmgocamjwwl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6ZHR1bGNycXptZ29jYW1qd3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjIwMzAsImV4cCI6MjA4NzE5ODAzMH0.7CyKzK3cs-Cd-Wrh69oUAEtxW95l8iZLMCXi_3nAIPU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
  },
});

/** Margem para renovar o token antes de vencer (o timer congela em aba inativa). */
const MARGEM_RENOVACAO_S = 90;

async function renovarSeProximoDeVencer(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const expiraEm = data.session?.expires_at;
    if (data.session && expiraEm != null && expiraEm - Math.floor(Date.now() / 1000) < MARGEM_RENOVACAO_S) {
      await supabase.auth.refreshSession();
    }
  } catch {
    /* sem sessão válida: a chamada segue e trata o erro */
  }
}

function ehErro401(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('context' in error)) return false;
  const contexto = (error as { context?: unknown }).context;
  return contexto instanceof Response ? contexto.status === 401 : (contexto as { status?: number } | undefined)?.status === 401;
}

const invokeOriginal = supabase.functions.invoke.bind(supabase.functions);

const invokeComRenovacao: typeof supabase.functions.invoke = async (nome, opcoes) => {
  await renovarSeProximoDeVencer();
  const resultado = await invokeOriginal(nome, opcoes);
  if (resultado.error && ehErro401(resultado.error)) {
    try {
      await supabase.auth.refreshSession();
    } catch {
      return resultado;
    }
    return invokeOriginal(nome, opcoes);
  }
  return resultado;
};

supabase.functions.invoke = invokeComRenovacao;

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void supabase.auth.startAutoRefresh();
      void renovarSeProximoDeVencer();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
