// Cores fixas por coorte — usar sempre estas em qualquer tela do app.
export type CoorteKey = "aquisicao" | "segunda_compra" | "fieis";

export const COORTES: Record<
  CoorteKey,
  { label: string; bar: string; dot: string; text: string; border: string }
> = {
  aquisicao: {
    label: "Aquisição",
    bar: "bg-sky-500",
    dot: "bg-sky-500",
    text: "text-sky-700",
    border: "border-sky-300",
  },
  segunda_compra: {
    label: "2ª compra",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-700",
    border: "border-amber-300",
  },
  fieis: {
    label: "Fiéis (3ª+)",
    bar: "bg-emerald-600",
    dot: "bg-emerald-600",
    text: "text-emerald-700",
    border: "border-emerald-300",
  },
};

export const COORTE_ORDEM: CoorteKey[] = ["aquisicao", "segunda_compra", "fieis"];

export const num = (v: unknown, casas = 0) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number(v ?? 0));

export const brl = (v: unknown, casas = 0) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number(v ?? 0));

export const pct = (v: unknown, casas = 1) => `${num(v, casas)}%`;

export const dataBR = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = String(v).slice(0, 10).split("-");
  if (d.length !== 3) return String(v);
  return `${d[2]}/${d[1]}/${d[0]}`;
};

export const dataDDMM = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = String(v).slice(0, 10).split("-");
  if (d.length !== 3) return String(v);
  return `${d[2]}/${d[1]}`;
};

export const DOW_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Primeiro valor não nulo entre várias chaves possíveis do payload. */
export const pick = <T = any,>(obj: any, ...chaves: string[]): T | undefined => {
  if (!obj) return undefined;
  for (const c of chaves) {
    const v = obj?.[c];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
};
