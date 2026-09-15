import { supabase } from "@/integrations/supabase/client";

/** Todos os dados desta aba vêm exclusivamente de RPCs. */

function primeiro<T = any>(data: any): T {
  return (Array.isArray(data) ? data[0] : data) as T;
}

async function chamar<T>(fn: string, params: Record<string, any>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, params);
  if (error) throw error;
  return (primeiro(data) ?? {}) as T;
}

export type InsightsResumo = {
  dias?: number;
  produto?: {
    total?: number;
    media?: number | null;
    media_anterior?: number | null;
    com_texto?: number;
    com_foto?: number;
    proprias?: number;
    distribuicao?: Record<string, number>;
    pct_5?: number | null;
    pct_ate_3?: number | null;
  };
  loja?: {
    total?: number;
    media?: number | null;
    com_texto?: number;
    distribuicao?: Record<string, number>;
    nps?: number | null;
  };
  regua?: {
    convites?: number;
    respondidas?: number;
    lidos?: number;
    por_whatsapp?: number;
    por_email?: number;
    taxa_resposta_pct?: number | null;
    taxa_leitura_pct?: number | null;
  };
  moderacao_pendente?: number;
  gerado_em?: string | null;
};

export type ProdutoInsight = {
  chave: string;
  rotulo: string;
  total: number;
  media: number | null;
  media_anterior: number | null;
  variacao: number | null;
  baixas: number;
  com_texto: number;
  proprias: number;
  pct_5: number | null;
  pct_ate_3: number | null;
  cai_pequeno: number;
  cai_perfeito: number;
  cai_grande: number;
  ativo: boolean;
};

export type InsightsProdutos = {
  dias?: number;
  minimo?: number;
  ordem?: string;
  familias_com_nota?: number;
  produtos?: ProdutoInsight[];
  sem_avaliacao?: Array<{ chave: string; rotulo: string; variantes: number }>;
  sem_avaliacao_total?: number;
};

export type InsightsCaimento = {
  dias?: number;
  respostas_total?: number;
  geral?: { pequeno: number; perfeito: number; grande: number };
  por_tamanho?: Array<{
    tamanho: string;
    respostas: number;
    pequeno: number;
    perfeito: number;
    grande: number;
  }>;
  produtos?: Array<{
    chave: string;
    rotulo: string;
    respostas: number;
    pequeno: number;
    perfeito: number;
    grande: number;
    media: number | null;
    pct_pequeno: number | null;
    pct_perfeito: number | null;
    pct_grande: number | null;
    amostra_ok: boolean;
    alerta: string;
  }>;
};

export type TemaInsight = {
  tema: string;
  mencoes: number;
  media: number | null;
  criticas: number;
  ressalvas: number;
  pct: number | null;
  pct_ressalva: number | null;
  em_loja: number;
  exemplos: Array<{
    nota: number | null;
    produto: string | null;
    texto: string;
    em: string | null;
    ressalva: boolean;
  }>;
};

export type InsightsTemas = {
  dias?: number;
  textos?: number;
  com_ressalva?: number;
  temas?: TemaInsight[];
};

export type InsightsEvolucao = {
  dias?: number;
  granularidade?: string;
  serie?: Array<{
    periodo: string;
    produto_total: number;
    produto_media: number | null;
    produto_proprias: number;
    pct_5: number | null;
    loja_total: number;
    loja_media: number | null;
  }>;
};

export type ProdutoDetalhe = {
  chave?: string;
  rotulo?: string;
  variantes?: Array<{ product_id: string; nome: string; ativo: boolean }>;
  total?: number;
  media?: number | null;
  distribuicao?: Record<string, number>;
  caimento?: { respostas: number; pequeno: number; perfeito: number; grande: number };
  por_tamanho?: Array<{
    tamanho: string;
    total: number;
    media: number | null;
    pequeno: number;
    grande: number;
  }>;
  por_cor?: Array<{ cor: string; total: number; media: number | null }>;
  temas?: Record<string, number>;
  textos?: Array<{
    nota: number | null;
    texto: string;
    cor: string | null;
    tamanho: string | null;
    caimento: string | null;
    em: string | null;
    origem: string | null;
    ressalva: boolean;
  }>;
};

export const insightsResumo = (dias: number) =>
  chamar<InsightsResumo>("fn_aval_insights_resumo", { p_dias: dias });

export const insightsProdutos = (dias: number, minimo: number, ordem: string, limite = 40) =>
  chamar<InsightsProdutos>("fn_aval_insights_produtos", {
    p_dias: dias,
    p_min: minimo,
    p_ordem: ordem,
    p_limite: limite,
  });

export const insightsCaimento = (dias: number, minimo = 2) =>
  chamar<InsightsCaimento>("fn_aval_insights_caimento", { p_dias: dias, p_min: minimo });

export const insightsTemas = (dias: number, exemplos = 4) =>
  chamar<InsightsTemas>("fn_aval_insights_temas", { p_dias: dias, p_exemplos: exemplos });

export const insightsEvolucao = (dias: number, gran: "mes" | "semana") =>
  chamar<InsightsEvolucao>("fn_aval_insights_evolucao", { p_dias: dias, p_gran: gran });

export const insightsProdutoDetalhe = (chave: string, dias: number, textos = 20) =>
  chamar<ProdutoDetalhe>("fn_aval_insights_produto_detalhe", {
    p_chave: chave,
    p_dias: dias,
    p_textos: textos,
  });

export const ROTULO_TEMA: Record<string, string> = {
  tamanho: "Tamanho e caimento",
  qualidade: "Qualidade e tecido",
  erro_pedido: "Pedido errado",
  entrega: "Entrega",
  atendimento: "Atendimento",
  preco: "Preço",
  elogio: "Elogio",
  sem_tema: "Sem tema",
};

const SEM_DADOS = "sem dados";

export function num(v: any): string {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return SEM_DADOS;
  return n.toLocaleString("pt-BR");
}

export function dec(v: any, casas = 1): string {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return SEM_DADOS;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Percentual já vem em escala 0 a 100 nas RPCs de insights. */
export function pct(v: any): string {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return SEM_DADOS;
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function dataHora(v: any): string {
  if (!v) return SEM_DADOS;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function dataCurta(v: any): string {
  if (!v) return SEM_DADOS;
  const s = String(v).slice(0, 10).split("-");
  if (s.length === 3) return `${s[2]}/${s[1]}/${s[0]}`;
  return String(v);
}
