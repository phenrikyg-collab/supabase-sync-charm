import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const { action, items, categorias, pdf_base64 } = body;

    if (action === "categorize") {
      return await handleCategorize(LOVABLE_API_KEY, items, categorias);
    } else if (action === "parse_pdf") {
      return await handleParsePdf(LOVABLE_API_KEY, pdf_base64, categorias);
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleCategorize(apiKey: string, items: any[], categorias: any[]) {
  const catList = categorias.map((c: any) => `- ID: ${c.id} | Nome: ${c.nome} | Grupo DRE: ${c.grupo_dre || "N/A"}`).join("\n");

  const prompt = `Você é um assistente financeiro. Categorize cada lançamento bancário abaixo usando APENAS as categorias fornecidas.

CATEGORIAS DISPONÍVEIS:
${catList}

LANÇAMENTOS:
${items.map((item: any, i: number) => `${i + 1}. "${item.descricao}" - R$ ${item.valor} (${item.tipo})`).join("\n")}

Retorne EXATAMENTE um array JSON com objetos {categoria_id, categoria_nome} para cada lançamento, na mesma ordem. Use a categoria que melhor se encaixa. Se nenhuma se encaixar bem, use null.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Você é um contador brasileiro especialista em categorização de despesas. Responda APENAS com JSON válido." },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "categorize_items",
            description: "Return categorization for each expense item",
            parameters: {
              type: "object",
              properties: {
                categorized: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      categoria_id: { type: "string", nullable: true },
                      categoria_nome: { type: "string", nullable: true },
                    },
                    required: ["categoria_id", "categoria_nome"],
                  },
                },
              },
              required: ["categorized"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "categorize_items" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = await response.text();
    console.error("AI gateway error:", response.status, text);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fallback: try to parse content directly
  const content = data.choices?.[0]?.message?.content || "{}";
  return new Response(JSON.stringify({ categorized: [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleParsePdf(apiKey: string, pdf_base64: string, categorias: any[]) {
  const catList = categorias?.map((c: any) => `- ID: ${c.id} | Nome: ${c.nome} | Grupo: ${c.grupo_dre || "N/A"}`).join("\n") || "Nenhuma categoria cadastrada";

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: "Você é um contador brasileiro. Extraia lançamentos de faturas/extratos em PDF. Responda APENAS usando a tool fornecida.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extraia todos os lançamentos deste extrato/fatura PDF. Para cada lançamento identifique data, descrição, valor e sugira a categoria mais adequada.

IMPORTANTE: Extraia também a data de vencimento da fatura (geralmente indicada como "Vencimento", "Data de Vencimento" ou "Due Date"). Essa data deve ser retornada no campo "data_vencimento" de cada transação (todas as transações de uma mesma fatura compartilham o mesmo vencimento).

CATEGORIAS DISPONÍVEIS:
${catList}`,
            },
            {
              type: "image_url",
              image_url: { url: `data:application/pdf;base64,${pdf_base64}` },
            },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_transactions",
            description: "Extract transactions from bank statement or credit card bill",
            parameters: {
              type: "object",
              properties: {
                rows: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      data: { type: "string", description: "Date in YYYY-MM-DD format" },
                      descricao: { type: "string" },
                      valor: { type: "number", description: "Positive for credits, negative for debits" },
                      tipo: { type: "string", enum: ["entrada", "saida"] },
                      categoria_id: { type: "string", nullable: true },
                      categoria_sugerida: { type: "string", nullable: true },
                    },
                    required: ["data", "descricao", "valor", "tipo"],
                  },
                },
              },
              required: ["rows"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_transactions" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = await response.text();
    console.error("PDF parse error:", response.status, text);
    throw new Error(`AI error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ rows: [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
