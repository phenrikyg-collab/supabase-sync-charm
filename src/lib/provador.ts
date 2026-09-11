import { supabase } from "@/integrations/supabase/client";

export type ProvadorAtalho = { chave: string; rotulo: string; inicio: string; fim: string };
export type ProvadorMes = { chave: string; rotulo: string; inicio: string; fim: string; parcial?: boolean };
export type ProvadorPeriodos = {
  atalhos: ProvadorAtalho[];
  meses: ProvadorMes[];
  padrao?: { chave?: string; inicio: string; fim: string } | null;
  janela_dias?: number | null;
};

export type ProvadorInsight = {
  severidade: "alta" | "media" | "info" | string;
  titulo: string;
  texto: string;
  acao?: string | null;
};

export type ProvadorDashboard = {
  gerado_em?: string | null;
  janela_dias?: number | null;
  insights?: ProvadorInsight[] | null;
  kpis?: Record<string, any> | null;
  anterior?: Record<string, any> | null;
  custos?: Record<string, any> | null;
  funil?: { etapa: string; valor: number }[] | null;
  uplift?: {
    com_provador?: { taxa: number | null; visitantes: number | null } | null;
    sem_provador?: { taxa: number | null; visitantes: number | null } | null;
    multiplicador?: number | null;
  } | null;
  serie?: any[] | null;
  tamanhos?: any[] | null;
  leads?: any[] | null;
  pedidos?: any[] | null;
  produtos?: any[] | null;
  trocas?: any[] | null;
};

export async function fnProvadorPeriodos(): Promise<ProvadorPeriodos> {
  const { data, error } = await (supabase as any).rpc("fn_provador_periodos");
  if (error) throw error;
  const d = Array.isArray(data) ? data[0] : data;
  return {
    atalhos: d?.atalhos ?? [],
    meses: d?.meses ?? [],
    padrao: d?.padrao ?? null,
    janela_dias: d?.janela_dias ?? null,
  };
}

export async function fnProvadorDashboard(inicio: string, fim: string): Promise<ProvadorDashboard> {
  const { data, error } = await (supabase as any).rpc("fn_provador_dashboard", {
    p_inicio: inicio,
    p_fim: fim,
  });
  if (error) throw error;
  const d = Array.isArray(data) ? data[0] : data;
  return (d ?? {}) as ProvadorDashboard;
}

/* ---------- formatação ---------- */

export const traco = "—";

export function n0(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export function fmtBRL(v: any): string {
  const x = n0(v);
  if (x === null) return traco;
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtNum(v: any): string {
  const x = n0(v);
  if (x === null) return traco;
  return x.toLocaleString("pt-BR");
}

export function fmtPct(v: any, casas = 1): string {
  const x = n0(v);
  if (x === null) return traco;
  return `${x.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function fmtDataBr(v: any): string {
  if (!v) return traco;
  const s = String(v).slice(0, 10);
  const [a, m, d] = s.split("-");
  if (!d) return s;
  return `${d}/${m}/${a}`;
}

export function fmtDataCurta(v: any): string {
  const s = fmtDataBr(v);
  return s === traco ? traco : s.slice(0, 5);
}

export function fmtHora(v: any): string {
  if (!v) return traco;
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return traco;
  return dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function soDigitos(tel: any): string {
  return String(tel ?? "").replace(/\D/g, "");
}

export function fmtTelefone(tel: any): string {
  const d = soDigitos(tel).replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d ? d : traco;
}

export function primeiroNome(nome: any): string {
  const s = String(nome ?? "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0];
}

/** delta relativo entre atual e anterior */
export function delta(atual: any, anterior: any): { pct: number | null; novo: boolean } {
  const a = n0(atual) ?? 0;
  const b = n0(anterior);
  if (b === null || b === 0) return { pct: null, novo: true };
  return { pct: ((a - b) / Math.abs(b)) * 100, novo: false };
}

export function baixarCsv(nome: string, linhas: (string | number | null | undefined)[][]) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = "\uFEFF" + linhas.map((l) => l.map(esc).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
