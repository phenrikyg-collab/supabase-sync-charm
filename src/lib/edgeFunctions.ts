// Helper to invoke edge functions on the SAME Supabase project as the data client.
// IMPORTANTE: não usar import.meta.env.VITE_SUPABASE_URL — o .env aponta para um
// projeto diferente (gerencia o app), enquanto os dados e as edge functions vivem
// no projeto externo abaixo. Manter sincronizado com src/integrations/supabase/client.ts.
import { supabase } from "@/integrations/supabase/client";

export const SUPABASE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6ZHR1bGNycXptZ29jYW1qd3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjIwMzAsImV4cCI6MjA4NzE5ODAzMH0.7CyKzK3cs-Cd-Wrh69oUAEtxW95l8iZLMCXi_3nAIPU";

type InvokeEdgeFunctionOptions = {
  baseUrl?: string;
  anonKey?: string;
  timeoutMs?: number;
};

export async function invokeEdgeFunction(
  functionName: string,
  body: any,
  options: InvokeEdgeFunctionOptions = {},
) {
  const baseUrl = options.baseUrl ?? SUPABASE_URL;
  const anonKey = options.anonKey ?? SUPABASE_ANON_KEY;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const url = `${baseUrl}/functions/v1/${functionName}`;

  // Always forward the current user's session JWT when present so edge functions
  // can authenticate the caller. Falls back to the anon key for public functions.
  let authToken = anonKey;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) authToken = data.session.access_token;
  } catch {
    // ignore — fall back to anon key
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
        "apikey": anonKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error: any) {
    window.clearTimeout(timeoutId);
    if (error?.name === "AbortError") {
      throw new Error("A geração demorou mais que o esperado. Tente novamente em instantes.");
    }
    throw error;
  }

  window.clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    let errorMsg: string;
    try {
      const json = JSON.parse(text);
      errorMsg = json.error || json.erro || `Erro ${response.status}`;
    } catch {
      errorMsg = text || `Erro ${response.status}`;
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
