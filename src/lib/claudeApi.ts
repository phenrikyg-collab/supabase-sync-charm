import { invokeEdgeFunction } from "./edgeFunctions";
import { buildSystemPrompt, BrandConfig } from "./brandContext";

const AI_ERROR_MSG =
  "Erro ao conectar com a IA. Verifique se a ANTHROPIC_API_KEY está configurada corretamente (Configurações → Integração com IA).";

/**
 * Call Claude via the generate-content edge function.
 * The system prompt is automatically built from the brand context.
 * Pass a BrandConfig to inject month-specific context (products, funnel, coupon, etc.)
 */
export const callClaude = async (
  userPrompt: string,
  brandConfig?: BrandConfig
): Promise<string> => {
  try {
    const systemPrompt = buildSystemPrompt(brandConfig);

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

export const safeParseJSONObject = (raw: string): Record<string, any> => {
  try {
    let clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("JSON object não encontrado");
    return JSON.parse(clean.substring(start, end + 1));
  } catch (e) {
    console.error("JSON parse error:", e);
    return {};
  }
};

// Re-export for convenience
export { buildSystemPrompt } from "./brandContext";
export type { BrandConfig } from "./brandContext";
