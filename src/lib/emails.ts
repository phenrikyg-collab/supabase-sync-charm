import { supabase } from "@/integrations/supabase/client";

export async function rpcEmails<T = any>(fn: string, args?: Record<string, any>): Promise<T> {
  const { data, error } = await supabase.rpc(fn as any, (args ?? {}) as any);
  if (error) throw error;
  return data as T;
}

export const SEM_DADOS = "sem dados";

export const numero = (v: any): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const inteiro = (v: any): string =>
  v == null ? SEM_DADOS : new Intl.NumberFormat("pt-BR").format(Math.round(numero(v)));

export const brl = (v: any): string =>
  v == null
    ? SEM_DADOS
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numero(v));

export const pct1 = (v: any, casas = 1): string =>
  v == null
    ? SEM_DADOS
    : `${numero(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export const dataBrHora = (v: any): string => {
  if (!v) return SEM_DADOS;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const dataBr = (v: any): string => {
  if (!v) return SEM_DADOS;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR");
};

export const diaCurto = (v: any): string => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export function horasDesde(v: any): number | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 3600000;
}

export function textoDesde(v: any): string {
  const h = horasDesde(v);
  if (h == null) return SEM_DADOS;
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} dias`;
}

/** Semáforo das taxas de risco. */
export function corSemaforo(valor: number | null | undefined, ambar: number, vermelho: number) {
  if (valor == null) return "text-muted-foreground";
  const n = numero(valor);
  if (n > vermelho) return "text-danger";
  if (n > ambar) return "text-warning";
  return "text-success";
}
