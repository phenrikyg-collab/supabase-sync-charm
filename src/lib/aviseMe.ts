import { supabase } from "@/integrations/supabase/client";

/** Toda leitura e escrita do Avise-me passa por RPC. Nunca tabela direta. */
export async function rpcAviseMe<T = any>(fn: string, args?: Record<string, any>): Promise<T> {
  const { data, error } = await supabase.rpc(fn as any, (args ?? {}) as any);
  if (error) throw error;
  return data as T;
}

export type Linha = Record<string, any>;

export const numero = (v: any): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const inteiro = (v: any): string =>
  v == null ? "0" : new Intl.NumberFormat("pt-BR").format(Math.round(numero(v)));

export const dataBr = (v: any): string => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR");
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

/** Aceita resposta em array direto ou embrulhada em { linhas | itens | dados }. */
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

export const GRADE = (l: Linha) => [l.produto, l.cor, l.tamanho].filter(Boolean).join(" · ");

export function baixarCsv(nome: string, cabecalho: string[], linhas: (string | number)[][]) {
  const escapar = (v: any) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const conteudo = [cabecalho, ...linhas].map((l) => l.map(escapar).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
