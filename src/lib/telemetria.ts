import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Telemetria própria do site — fonte primária de tráfego desde        */
/* 07/08/2026. Windsor.ai aposentado em 22/08/2026; GA4 é só controle. */
/* Todas as RPCs abaixo já existem no banco (SECURITY DEFINER).        */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const PERIODOS_TELEMETRIA = [
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "14dias", label: "Últimos 14 dias" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "60dias", label: "Últimos 60 dias" },
  { value: "90dias", label: "Últimos 90 dias" },
  { value: "ago2026", label: "Agosto 2026" },
  { value: "set2026", label: "Setembro 2026" },
];

export function faixaTelemetria(periodo: string): { de: string; ate: string } {
  const hoje = new Date();
  const dias: Record<string, number> = { "7dias": 7, "14dias": 14, "30dias": 30, "60dias": 60, "90dias": 90 };
  if (dias[periodo]) {
    const ini = new Date();
    ini.setDate(hoje.getDate() - dias[periodo]);
    return { de: toISO(ini), ate: toISO(hoje) };
  }
  const meses: Record<string, { de: string; ate: string }> = {
    ago2026: { de: "2026-08-01", ate: "2026-08-31" },
    set2026: { de: "2026-09-01", ate: "2026-09-30" },
  };
  const ini = new Date();
  ini.setDate(hoje.getDate() - 30);
  return meses[periodo] ?? { de: toISO(ini), ate: toISO(hoje) };
}

export const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
export const fmtInt = (n: number) => Math.round(n || 0).toLocaleString("pt-BR");
export const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;

/** Correção de grafia dos rótulos de canal: WhastApp -> WhatsApp. */
export const corrigirCanal = (c: string) =>
  (c || "Desconhecido").replace(/whast/gi, (m) => (m[0] === "W" ? "Whats" : "whats"));

export const ehNaoAtribuido = (c: string) => /n[aã]o[\s_-]*atribu/i.test(c || "");

async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await (supabase.rpc as any)(nome, args);
  if (error) throw error;
  return (data ?? []) as T[];
}

/* ------------------------------ tipos ------------------------------ */

export type CanalTelemetria = {
  canal: string;
  sessoes: number;
  add_carrinho: number;
  iniciaram_pagto: number;
  compras: number;
  receita: number;
  sessao_carrinho_pct: number;
  carrinho_checkout_pct: number;
  conv_final_pct: number;
  ticket_medio: number;
  receita_por_sessao: number;
};

export type PaginaTelemetria = {
  pagina: string;
  titulo: string;
  sessoes: number;
  pct_do_total: number;
  entradas: number;
  saidas: number;
  taxa_saida_pct: number;
};

export type ProdutoTelemetria = {
  produto_id: string;
  nome: string;
  visualizacoes: number;
  sessoes_que_viram: number;
  add_carrinho: number;
  compras: number;
  receita: number;
  vis_carrinho_pct: number;
  carrinho_compra_pct: number;
  conv_final_pct: number;
};

export type ResumoTelemetria = {
  sessoes: number;
  add_carrinho: number;
  iniciaram_pagto: number;
  compras: number;
  receita: number;
  sessoes_novas: number;
  taxa_conversao: number;
  ticket_medio: number;
};

/* ----------------------------- fetchers ---------------------------- */

export async function fetchTelemetriaCanais(de: string, ate: string) {
  const linhas = await rpc<any>("telemetria_canais", { p_de: de, p_ate: ate });
  return linhas.map((r) => ({
    canal: corrigirCanal(String(r.canal ?? "")),
    sessoes: num(r.sessoes),
    add_carrinho: num(r.add_carrinho),
    iniciaram_pagto: num(r.iniciaram_pagto),
    compras: num(r.compras),
    receita: num(r.receita),
    sessao_carrinho_pct: num(r.sessao_carrinho_pct),
    carrinho_checkout_pct: num(r.carrinho_checkout_pct),
    conv_final_pct: num(r.conv_final_pct),
    ticket_medio: num(r.ticket_medio),
    receita_por_sessao: num(r.receita_por_sessao),
  })) as CanalTelemetria[];
}

export async function fetchTelemetriaPaginas(de: string, ate: string, limite = 50) {
  const linhas = await rpc<any>("telemetria_paginas", { p_de: de, p_ate: ate, p_limite: limite });
  return linhas.map((r) => ({
    pagina: String(r.pagina ?? ""),
    titulo: String(r.titulo ?? ""),
    sessoes: num(r.sessoes),
    pct_do_total: num(r.pct_do_total),
    entradas: num(r.entradas),
    saidas: num(r.saidas),
    taxa_saida_pct: num(r.taxa_saida_pct),
  })) as PaginaTelemetria[];
}

export async function fetchTelemetriaProdutos(de: string, ate: string, limite = 100) {
  const linhas = await rpc<any>("telemetria_produtos", { p_de: de, p_ate: ate, p_limite: limite });
  return linhas.map((r) => ({
    produto_id: String(r.produto_id ?? ""),
    nome: String(r.nome ?? "Sem nome"),
    visualizacoes: num(r.visualizacoes),
    sessoes_que_viram: num(r.sessoes_que_viram),
    add_carrinho: num(r.add_carrinho),
    compras: num(r.compras),
    receita: num(r.receita),
    vis_carrinho_pct: num(r.vis_carrinho_pct),
    carrinho_compra_pct: num(r.carrinho_compra_pct),
    conv_final_pct: num(r.conv_final_pct),
  })) as ProdutoTelemetria[];
}

export async function fetchTelemetriaResumo(de: string, ate: string): Promise<ResumoTelemetria | null> {
  const linhas = await rpc<any>("telemetria_resumo", { p_de: de, p_ate: ate });
  const r = Array.isArray(linhas) ? linhas[0] : (linhas as any);
  if (!r) return null;
  return {
    sessoes: num(r.sessoes),
    add_carrinho: num(r.add_carrinho),
    iniciaram_pagto: num(r.iniciaram_pagto),
    compras: num(r.compras),
    receita: num(r.receita),
    sessoes_novas: num(r.sessoes_novas),
    taxa_conversao: num(r.taxa_conversao),
    ticket_medio: num(r.ticket_medio),
  };
}

/* --------------------------- Oportunidades -------------------------- */

export type AcaoInsight = {
  prioridade: number;
  area: string;
  titulo: string;
  detalhe: string;
  impacto_reais: number;
  evidencia: string;
  onde: string;
};

export async function fetchInsightsAcoes(dias: number, limite = 25) {
  const linhas = await rpc<any>("insights_acoes", { p_dias: dias, p_limite: limite });
  return linhas.map((r) => ({
    prioridade: num(r.prioridade),
    area: String(r.area ?? ""),
    titulo: String(r.titulo ?? ""),
    detalhe: String(r.detalhe ?? ""),
    impacto_reais: num(r.impacto_reais),
    evidencia: String(r.evidencia ?? ""),
    onde: String(r.onde ?? ""),
  })) as AcaoInsight[];
}

export type DestaqueInsight = {
  tipo: string;
  item: string;
  detalhe: string;
  sessoes: number;
  conversao_pct: number;
  receita: number;
  indice_vs_media: number;
  leitura: string;
};

export async function fetchInsightsDestaques(dias: number, limite = 12) {
  const linhas = await rpc<any>("insights_destaques", { p_dias: dias, p_limite: limite });
  return linhas.map((r) => ({
    tipo: String(r.tipo ?? ""),
    item: String(r.item ?? ""),
    detalhe: String(r.detalhe ?? ""),
    sessoes: num(r.sessoes),
    conversao_pct: num(r.conversao_pct),
    receita: num(r.receita),
    indice_vs_media: num(r.indice_vs_media),
    leitura: String(r.leitura ?? ""),
  })) as DestaqueInsight[];
}

export type NaoAtribuidoLinha = {
  situacao: string;
  pedidos: number;
  receita: number;
  ticket_medio: number;
  explicacao: string;
};

export async function fetchInsightsNaoAtribuido(dias: number) {
  const linhas = await rpc<any>("insights_nao_atribuido", { p_dias: dias });
  return linhas.map((r) => ({
    situacao: String(r.situacao ?? ""),
    pedidos: num(r.pedidos),
    receita: num(r.receita),
    ticket_medio: num(r.ticket_medio),
    explicacao: String(r.explicacao ?? ""),
  })) as NaoAtribuidoLinha[];
}

export async function fetchInsight(nome: string, dias: number) {
  return rpc<Record<string, any>>(nome, { p_dias: dias });
}

export const AVISO_OPORTUNIDADES =
  "Os valores de impacto são estimativas, não previsões. A telemetria começou em 07/08/2026, então não há comparativo com julho. O início de pagamento só é medido desde 16/09/2026 e fica subestimado antes disso. O canal das sessões anteriores a 23/09/2026 é reconstruído pela URL de entrada e pelo referrer; a partir dessa data vem da origem real da sessão. Cerca de 30% dos pedidos não se ligam a nenhuma sessão e aparecem como Não atribuído.";
