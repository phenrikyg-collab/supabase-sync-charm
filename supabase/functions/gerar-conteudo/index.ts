import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é Anna, a assistente de conteúdo da marca Use Mariana Cardoso — moda feminina brasileira, aspiracional, exclusiva, com tecidos próprios e manufatura própria. Escreva sempre com tom feminino, caloroso, sofisticado e próximo. A marca tem ~196K seguidores no Instagram. Nunca use linguagem genérica ou fria. Adapte o conteúdo ao canal e objetivo indicados.

Você SEMPRE deve retornar um JSON válido com os seguintes campos:
- caption: string (texto completo do conteúdo)
- hashtags: string[] (array de hashtags sem o #, 15-20 para Instagram, vazio para email/whatsapp)
- cta: string (call to action sugerido)
- suggestedTime: string (horário sugerido no formato HH:MM)
- subjectLine: string (apenas para email, máx 50 chars)
- previewText: string (apenas para email, máx 90 chars)

Retorne APENAS o JSON, sem markdown, sem blocos de código.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, channel } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Configurações > Workspace > Uso." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let parsed;
    try {
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      // Fallback: return raw content as caption
      parsed = {
        caption: content,
        hashtags: [],
        cta: "",
        suggestedTime: channel === "whatsapp" ? "21:00" : channel === "email" ? "09:00" : "11:00",
        subjectLine: "",
        previewText: "",
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
