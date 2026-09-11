import { supabase } from "@/integrations/supabase/client";

/** Todos os dados desta seção vêm exclusivamente de RPCs. */

export const TRACO = "—";

function primeiro<T = any>(data: any): T {
  return (Array.isArray(data) ? data[0] : data) as T;
}

export function texto(v: any): string {
  if (v === null || v === undefined || v === "") return TRACO;
  return String(v);
}

export function numero(v: any): string {
  if (v === null || v === undefined || v === "") return TRACO;
  const n = Number(v);
  if (!Number.isFinite(n)) return TRACO;
  return n.toLocaleString("pt-BR");
}

export function decimal(v: any, casas = 1): string {
  if (v === null || v === undefined || v === "") return TRACO;
  const n = Number(v);
  if (!Number.isFinite(n)) return TRACO;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function percentual(v: any): string {
  if (v === null || v === undefined || v === "") return TRACO;
  const n = Number(v);
  if (!Number.isFinite(n)) return TRACO;
  const valor = n > 0 && n <= 1 ? n * 100 : n;
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/** Data em dd/mm/aaaa (aceita ISO com ou sem hora). */
export function formatarData(v: any): string {
  if (!v) return TRACO;
  const s = String(v);
  const base = s.slice(0, 10);
  const partes = base.split("-");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
}

export type PainelKpis = Record<string, any>;

export async function avalKpis(dias: number): Promise<PainelKpis> {
  const { data, error } = await (supabase as any).rpc("fn_aval_painel_kpis", { p_dias: dias });
  if (error) throw error;
  return (primeiro(data) ?? {}) as PainelKpis;
}

export type PainelRegua = {
  por_dia?: Array<Record<string, any>> | null;
  entrega_whatsapp?: Record<string, any> | Array<Record<string, any>> | null;
  fluxo?: Record<string, any> | Array<Record<string, any>> | null;
  erros_whatsapp?: Array<Record<string, any>> | null;
};

export async function avalRegua(dias: number): Promise<PainelRegua> {
  const { data, error } = await (supabase as any).rpc("fn_aval_painel_regua", { p_dias: dias });
  if (error) throw error;
  return (primeiro(data) ?? {}) as PainelRegua;
}

export type PainelPendentes = {
  midias?: Array<Record<string, any>> | null;
  fotos?: Array<Record<string, any>> | null;
  textos?: Array<Record<string, any>> | null;
  textos_produto?: Array<Record<string, any>> | null;
  textos_loja?: Array<Record<string, any>> | null;
};

export async function avalPendentes(): Promise<PainelPendentes> {
  const { data, error } = await (supabase as any).rpc("fn_aval_painel_pendentes");
  if (error) throw error;
  return (primeiro(data) ?? {}) as PainelPendentes;
}

export async function avalModerar(
  id: string | number,
  tipo: "midia" | "produto" | "loja",
  status: "publicada" | "rejeitada",
) {
  const { data, error } = await (supabase as any).rpc("fn_aval_moderar", {
    p_id: id,
    p_tipo: tipo,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

export async function avalResponder(id: string | number, resposta: string) {
  const { data, error } = await (supabase as any).rpc("fn_aval_responder", {
    p_id: id,
    p_resposta: resposta,
  });
  if (error) throw error;
  return data;
}

export type PainelLista = {
  itens?: Array<Record<string, any>> | null;
  linhas?: Array<Record<string, any>> | null;
  total?: number | null;
};

export async function avalLista(args: {
  status?: string | null;
  produto?: string | null;
  nota?: number | null;
  busca?: string | null;
  pagina: number;
  tamanho?: number;
}): Promise<PainelLista> {
  const { data, error } = await (supabase as any).rpc("fn_aval_painel_lista", {
    p_status: args.status ?? null,
    p_produto: args.produto ?? null,
    p_nota: args.nota ?? null,
    p_busca: args.busca ?? null,
    p_pagina: args.pagina,
    p_tamanho: args.tamanho ?? 25,
  });
  if (error) throw error;
  const d = primeiro<any>(data);
  if (Array.isArray(data) && data.length && !d?.itens && !d?.linhas) {
    return { itens: data as any[], total: data.length };
  }
  return (d ?? {}) as PainelLista;
}

export type ConfigRegua = Record<string, any>;

export async function avalConfigLer(): Promise<ConfigRegua> {
  const { data, error } = await (supabase as any).rpc("fn_aval_config_ler");
  if (error) throw error;
  return (primeiro(data) ?? {}) as ConfigRegua;
}

export async function avalConfigSalvar(p: ConfigRegua) {
  const { data, error } = await (supabase as any).rpc("fn_aval_config_salvar", { p });
  if (error) throw error;
  return data;
}

/** Normaliza um objeto ou lista {chave,total} em pares na ordem recebida. */
export function pares(v: any): Array<{ chave: string; total: number }> {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map((i) => ({
      chave: String(i.chave ?? i.status ?? i.etapa ?? i.nome ?? ""),
      total: Number(i.total ?? i.qtd ?? i.quantidade ?? i.valor ?? 0),
    }));
  }
  return Object.entries(v).map(([chave, total]) => ({ chave, total: Number(total ?? 0) }));
}

export const ROTULOS: Record<string, string> = {
  enviado: "Enviado",
  entregue: "Entregue",
  lido: "Lido",
  falhou: "Falhou",
  aguardando_inicio: "Aguardando início",
  nota_produto: "Nota do produto",
  nota_loja: "Nota da loja",
  concluido: "Concluído",
  recusado: "Recusado",
  pausado: "Pausado",
};

export function rotulo(chave: string): string {
  return ROTULOS[chave] ?? chave.replace(/_/g, " ");
}
