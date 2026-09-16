import { supabase } from "@/integrations/supabase/client";
import { chamarRpc } from "@/lib/supabaseRpc";

/** Todo dado do Cashback passa por RPC do schema public. Nunca tabela direta. */
export async function rpcCashback<T = any>(fn: string, args?: Record<string, any>): Promise<T> {
  const { data, error } = await chamarRpc(fn as any, (args ?? {}) as any);
  if (error) throw error;
  return data as T;
}

export type Linha = Record<string, any>;

export const numero = (v: any): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const inteiro = (v: any): string =>
  new Intl.NumberFormat("pt-BR").format(Math.round(numero(v)));

export const brl = (v: any): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numero(v));

/** Percentual com uma casa. null vira "sem base", nunca 0%. */
export const pct1 = (v: any): string =>
  v == null || v === "" ? "sem base" : `${numero(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export const dataBr = (v: any): string => {
  if (!v) return "";
  const s = String(v);
  const so = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(so)) {
    const [a, m, d] = so.split("-");
    return `${d}/${m}/${a}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("pt-BR");
};

export const dataHoraBr = (v: any): string => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** "2026-09-14" a partir de um Date. */
export const isoDia = (d: Date) => d.toISOString().slice(0, 10);

export function listaDe(resposta: any): Linha[] {
  if (Array.isArray(resposta)) return resposta;
  if (!resposta || typeof resposta !== "object") return [];
  for (const chave of ["linhas", "itens", "dados", "registros", "rows"]) {
    if (Array.isArray(resposta[chave])) return resposta[chave];
  }
  return [];
}

export function objetoDe(resposta: any): Record<string, any> {
  if (Array.isArray(resposta)) return resposta[0] ?? {};
  return (resposta ?? {}) as Record<string, any>;
}

export const ROTULO_STATUS: Record<string, string> = {
  ativo: "Ativo",
  usado: "Usado",
  expirado: "Expirado",
  cancelado: "Cancelado",
  devolvido: "Devolvido",
};

export function corStatus(status: string): string {
  switch (String(status ?? "").toLowerCase()) {
    case "ativo":
      return "bg-success/15 text-success border-success/30";
    case "usado":
      return "bg-info/15 text-info border-info/30";
    case "expirado":
      return "bg-muted text-muted-foreground border-border";
    case "cancelado":
      return "bg-danger/15 text-danger border-danger/30";
    case "devolvido":
      return "bg-warning/15 text-warning border-warning/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export const ROTULO_TIPO: Record<string, string> = {
  credito_compra: "Cashback da compra",
  debito_uso: "Usado no pedido",
  estorno_credito: "Estornado",
  estorno_debito: "Devolvido",
  expiracao: "Venceu",
  ajuste_credito: "Crédito manual",
  ajuste_debito: "Retirada manual",
  migracao: "Saldo migrado",
};

export const rotuloTipo = (t: any) => ROTULO_TIPO[String(t ?? "")] ?? String(t ?? "");

/** Valor com sinal, positivo em verde e negativo em vermelho no consumo. */
export function valorComSinal(tipo: any, valor: any): { texto: string; negativo: boolean } {
  const negativos = ["debito_uso", "estorno_credito", "expiracao", "ajuste_debito"];
  const bruto = numero(valor);
  const negativo = negativos.includes(String(tipo ?? "")) || bruto < 0;
  const abs = Math.abs(bruto);
  return { texto: `${negativo ? "-" : "+"} ${brl(abs)}`, negativo };
}
