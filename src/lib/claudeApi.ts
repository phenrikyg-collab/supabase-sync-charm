import { invokeEdgeFunction } from "./edgeFunctions";

const AI_ERROR_MSG =
  "Erro ao conectar com a IA. Verifique se a ANTHROPIC_API_KEY está configurada corretamente (Configurações → Integração com IA).";

export const callClaude = async (
  systemPrompt: string,
  userPrompt: string
): Promise<string> => {
  try {
    const data = await invokeEdgeFunction("generate-content", {
      systemPrompt,
      userPrompt,
    });

    if (data?.error) throw new Error(data.error);
    if (!data?.result) throw new Error("Resposta vazia da API");

    return data.result;
  } catch (err: any) {
    console.error("callClaude error:", err);
    throw new Error(err?.message || AI_ERROR_MSG);
  }
};

export const safeParseJSON = (raw: string): any[] => {
  try {
    let clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("JSON array não encontrado");
    clean = clean.substring(start, end + 1);
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON parse error:", e, "Raw:", raw.substring(0, 200));
    return [];
  }
};

export const ANNA_SYSTEM_PROMPT = `Você é Anna, assistente de conteúdo da Use Mariana Cardoso — marca de moda feminina brasileira, aspiracional, com manufatura e tecidos próprios, ~196K seguidores no Instagram. Tom: feminino, caloroso, sofisticado, próximo. Nunca genérico. Responda SOMENTE com JSON válido, sem texto adicional, sem markdown fences.`;
