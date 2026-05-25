// Helper to invoke edge functions on the correct Lovable Cloud project
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
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
