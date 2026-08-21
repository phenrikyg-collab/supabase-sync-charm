/**
 * Conversão de valores digitados em reais (com centavos) para NUMERIC.
 * Nunca multiplicar por 100: "1.902,28" e "1902.28" viram 1902.28.
 */
export function parseValorBR(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === "") return null;
  const limpo = s.replace(/[^\d.,-]/g, "");
  let normalizado: string;
  if (limpo.includes(",")) {
    // vírgula é o separador decimal: pontos são milhar
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = limpo.split(".");
    if (partes.length > 2) {
      // 1.902.280 → milhares
      normalizado = partes.join("");
    } else {
      normalizado = limpo; // "1902.28" já está em reais
    }
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Formata um número para exibição em campo de valor (1902.28 → "1.902,28"). */
export function formatValorBR(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const LIMITE_SALARIO = 50000;
export const LIMITE_DIARIA = 100;
