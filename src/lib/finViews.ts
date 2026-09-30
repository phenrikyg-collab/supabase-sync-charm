import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Linha = Record<string, any>;

/** Lê uma view/tabela inteira, paginando de 1000 em 1000. */
export async function lerTudo(nome: string, ordem?: { col: string; asc?: boolean }): Promise<Linha[]> {
  const out: Linha[] = [];
  for (let de = 0; ; de += 1000) {
    let q = supabase.from(nome as never).select("*").range(de, de + 999);
    if (ordem) q = q.order(ordem.col, { ascending: ordem.asc ?? true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as Linha[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function useView(nome: string, ordem?: { col: string; asc?: boolean }) {
  return useQuery({
    queryKey: ["fin-view", nome],
    queryFn: () => lerTudo(nome, ordem),
    staleTime: 60_000,
  });
}

/** Número tolerante (null → 0). */
export const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/** Primeiro campo existente entre os candidatos. */
export function campo(l: Linha | undefined, ...nomes: string[]) {
  if (!l) return undefined;
  for (const k of nomes) if (l[k] !== undefined && l[k] !== null) return l[k];
  return undefined;
}

/** Chave AAAA-MM de uma linha mensal. */
export function mesDe(l: Linha): string {
  const v = campo(l, "mes", "competencia", "mes_referencia", "periodo");
  if (v == null && l.ano != null) return `${l.ano}-${String(l.mes_num ?? l.mes).padStart(2, "0")}`;
  return String(v ?? "").slice(0, 7);
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function rotuloMes(m: string) {
  const [a, mm] = m.split("-");
  if (!mm) return m;
  return `${MESES[Number(mm) - 1]}/${a.slice(2)}`;
}

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function somaDias(iso: string, dias: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const ehConfirmado = (l: Linha) => l.confirmado !== false;
