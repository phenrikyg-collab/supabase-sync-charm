export const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const brl = (v: any, digits = 2) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num(v));

export const dec = (v: any, digits = 2) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num(v));

export const int = (v: any) => new Intl.NumberFormat("pt-BR").format(Math.round(num(v)));

export const pct = (v: any, digits = 1) => `${dec(v, digits)}%`;

/** 2026-08-20 ou ISO -> 20/08 */
export const ddmm = (v: any): string => {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  const p = s.split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}`;
  return s;
};

/** 2026-08-20 -> 20/08/2026 */
export const ddmmyyyy = (v: any): string => {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  const p = s.split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return s;
};

export const varPct = (atual: number, anterior: number): number | null => {
  if (!Number.isFinite(anterior) || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
};
