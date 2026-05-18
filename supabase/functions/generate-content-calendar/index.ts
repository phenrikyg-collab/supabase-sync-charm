import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_SUPABASE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co";

function normalizeSecret(value: string) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  const jwt = trimmed.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (jwt?.[0]) return jwt[0];
  const sk = trimmed.match(/sb_secret_[A-Za-z0-9_-]+/);
  if (sk?.[0]) return sk[0];
  return trimmed;
}

const SYSTEM = `Você é uma estrategista de conteúdo da Mariana Cardoso (moda feminina premium, identidade sofisticada, tons dourados/bronze).
Gere um calendário comercial COMPLETO para o mês solicitado. Retorne SOMENTE JSON válido, sem markdown.

Formato exato:
{
  "datas": [
    {
      "data": "YYYY-MM-DD",
      "titulo": "string curta",
      "descricao": "string explicativa",
      "tipo": "comemorativa" | "campanha" | "lancamento" | "conteudo",
      "conteudos": [
        {
          "canal": "instagram_feed",
          "copy_principal": "...",
          "copy_legenda": "...",
          "copy_cta": "...",
          "hashtags": ["#tag1","#tag2"],
          "horario_sugerido": "HH:MM"
        },
        { "canal": "instagram_story", "copy_principal": "...", "copy_cta": "..." },
        { "canal": "email", "assunto_email": "...", "copy_principal": "...", "copy_cta": "..." },
        { "canal": "whatsapp_vip", "copy_principal": "..." }
      ]
    }
  ]
}

Regras:
- Inclua datas comemorativas brasileiras relevantes.
- Misture com posts de conteúdo (dicas de styling, bastidores, depoimentos).
- 8 a 14 datas no mês.
- Cada data deve ter os 4 canais com copy adequada ao formato.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mes_referencia } = await req.json();
    if (!mes_referencia || !/^\d{4}-\d{2}$/.test(mes_referencia)) {
      return new Response(JSON.stringify({ error: "mes_referencia inválido (YYYY-MM)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const serviceKey = normalizeSecret(Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");
    if (!serviceKey) throw new Error("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY não configurada");

    const userPrompt = `Gere o calendário comercial completo para o mês ${mes_referencia}. Use datas reais do mês e ano informados.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`Anthropic ${aiRes.status}: ${t.slice(0, 300)}`);
    }
    const aiData = await aiRes.json();
    const txt = (aiData.content?.[0]?.text || "").replace(/```json\n?|```\n?/g, "").trim();

    let parsed: any;
    try { parsed = JSON.parse(txt); } catch { throw new Error("IA retornou JSON inválido"); }

    const datas: any[] = parsed.datas || [];
    if (!datas.length) throw new Error("IA não retornou datas");

    const sb = createClient(EXTERNAL_SUPABASE_URL, serviceKey);

    let totalDatas = 0, totalConteudos = 0;
    for (const d of datas) {
      const { data: cal, error: calErr } = await sb
        .from("calendario_comercial")
        .insert({
          mes_referencia,
          data: d.data,
          titulo: d.titulo || "Sem título",
          descricao: d.descricao || null,
          tipo: d.tipo || "conteudo",
          status: "rascunho",
        })
        .select("id")
        .single();
      if (calErr) { console.error("calErr", calErr); continue; }
      totalDatas++;

      const conteudos = (d.conteudos || []).map((c: any) => ({
        calendario_id: cal.id,
        canal: c.canal,
        copy_principal: c.copy_principal || null,
        copy_legenda: c.copy_legenda || null,
        copy_cta: c.copy_cta || null,
        hashtags: Array.isArray(c.hashtags) ? c.hashtags.join(" ") : (c.hashtags || null),
        horario_sugerido: c.horario_sugerido || null,
        assunto_email: c.assunto_email || null,
        status: "rascunho",
      }));
      if (conteudos.length) {
        const { error: ctErr } = await sb.from("conteudos_gerados").insert(conteudos);
        if (!ctErr) totalConteudos += conteudos.length;
        else console.error("ctErr", ctErr);
      }
    }

    return new Response(JSON.stringify({ total_datas: totalDatas, total_conteudos: totalConteudos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("error", e);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
