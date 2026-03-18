// Helper to invoke edge functions on the correct Lovable Cloud project
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function invokeEdgeFunction(functionName: string, body: any) {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMsg: string;
    try {
      const json = JSON.parse(text);
      errorMsg = json.error || `Erro ${response.status}`;
    } catch {
      errorMsg = text || `Erro ${response.status}`;
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
