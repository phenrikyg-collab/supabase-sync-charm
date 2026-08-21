export function brl(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
}

export function brlCompacto(v: number | null | undefined) {
  const n = Number(v ?? 0);
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return brl(n);
}

export function pctBr(v: number | null | undefined, casas = 2) {
  return `${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function num(v: number | null | undefined, casas = 0) {
  return Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** "2026-08-21" ou ISO → "21/08" */
export function dataCurta(v: string | null | undefined) {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  const [a, m, d] = s.split("-");
  if (!d) return s;
  return `${d}/${m}`;
}

/** "2026-08-21" ou ISO → "21/08/2026" */
export function dataBr(v: string | null | undefined) {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  const [a, m, d] = s.split("-");
  if (!d) return s;
  return `${d}/${m}/${a}`;
}
