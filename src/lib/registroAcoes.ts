import { supabase } from "@/integrations/supabase/client";

/* ---------------- formatação ---------------- */

export const n = (v: any): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const isNil = (v: any) => v === null || v === undefined || v === "";

export const brl = (v: any, digits = 2) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n(v));

export const dec = (v: any, digits = 2) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n(v));

export const inteiro = (v: any) => new Intl.NumberFormat("pt-BR").format(Math.round(n(v)));

export const pct = (v: any, digits = 2) => `${dec(v, digits)}%`;

/** 2026-08-20 -> 20/08 */
export const ddmm = (v: any): string => {
  if (!v) return "";
  const s = String(v).slice(0, 10).split("-");
  return s.length === 3 ? `${s[2]}/${s[1]}` : String(v);
};

/** 2026-08-20 -> 20/08/2026 */
export const ddmmyyyy = (v: any): string => {
  if (!v) return "";
  const s = String(v).slice(0, 10).split("-");
  return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(v);
};

/** Segunda a domingo: "DD/MM a DD/MM" */
export const rotuloSemana = (inicio: any): string => {
  if (!inicio) return "";
  const d = new Date(`${String(inicio).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(inicio);
  const fim = new Date(d);
  fim.setDate(fim.getDate() + 6);
  const f = (x: Date) =>
    `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}`;
  return `${f(d)} a ${f(fim)}`;
};

/** Segunda-feira da semana atual em ISO (YYYY-MM-DD). */
export const semanaAtualISO = (): string => {
  const hoje = new Date();
  const dia = (hoje.getDay() + 6) % 7; // 0 = segunda
  hoje.setDate(hoje.getDate() - dia);
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate(),
  ).padStart(2, "0")}`;
};

/** Formata o valor de um driver pela unidade declarada nas opções. */
export const valorPorUnidade = (valor: any, unidade?: string): string => {
  if (isNil(valor)) return "sem dados";
  const u = String(unidade || "").toLowerCase();
  if (u.startsWith("pct") || u === "percentual" || u === "%") return pct(valor, 2);
  if (u.startsWith("reais") || u === "brl" || u === "moeda") return brl(valor);
  if (u.startsWith("sessoes") || u === "inteiro" || u === "int" || u === "pedidos")
    return inteiro(valor);
  return dec(valor, 2);
};

/* ---------------- opções ---------------- */

export type Opcao = { valor: string; rotulo: string; [k: string]: any };

/** Normaliza qualquer lista de opções vinda do banco em { valor, rotulo }. */
export const normalizarOpcoes = (lista: any): Opcao[] => {
  if (!Array.isArray(lista)) return [];
  return lista.map((item: any) => {
    if (typeof item === "string") return { valor: item, rotulo: item };
    const valor = String(
      item?.chave ?? item?.valor ?? item?.slug ?? item?.codigo ?? item?.id ?? "",
    );
    const rotulo = String(item?.nome ?? item?.rotulo ?? item?.label ?? item?.titulo ?? valor);
    return { ...item, valor, rotulo };
  });
};

export const rotuloDe = (lista: Opcao[], valor: any, fallback = "sem dados"): string => {
  if (isNil(valor)) return fallback;
  const achou = lista.find((o) => o.valor === String(valor));
  return achou ? achou.rotulo : String(valor);
};

export type DriverOpcao = Opcao & {
  unidade?: string;
  sentido?: number;
  definicao?: string;
  ordem?: number;
};

export type AcoesOpcoes = {
  drivers: DriverOpcao[];
  tipos: Opcao[];
  canais: Opcao[];
  sinais: Opcao[];
  leituras: Opcao[];
  status: Opcao[];
  origens: Opcao[];
  bruto: any;
};

/* ---------------- RPCs ---------------- */

const chamar = async (fn: string, params?: Record<string, any>) => {
  const { data, error } = await (supabase as any).rpc(fn, params ?? {});
  if (error) throw new Error(error.message);
  return data;
};

export async function acoesOpcoes(): Promise<AcoesOpcoes> {
  const d = (await chamar("acoes_opcoes")) ?? {};
  const raiz = Array.isArray(d) ? d[0] ?? {} : d;
  const drivers = normalizarOpcoes(raiz.drivers).sort(
    (a: any, b: any) => n(a.ordem) - n(b.ordem),
  ) as DriverOpcao[];
  return {
    drivers,
    tipos: normalizarOpcoes(raiz.tipos),
    canais: normalizarOpcoes(raiz.canais),
    sinais: normalizarOpcoes(raiz.sinais),
    leituras: normalizarOpcoes(raiz.leituras),
    status: normalizarOpcoes(raiz.status ?? raiz.status_opcoes),
    origens: normalizarOpcoes(raiz.origens),
    bruto: raiz,
  };
}

export const acoesPainelSemana = (p_semana: string) =>
  chamar("acoes_painel_semana", { p_semana });

export const acoesAtualizarAgora = () => chamar("acoes_atualizar_agora");

export const acoesCustosSemana = (
  p_semana: string,
  p_invest_vip: number | null,
  p_invest_imp: number | null,
) => chamar("acoes_custos_semana", { p_semana, p_invest_vip, p_invest_imp });

export const acoesSalvar = (p: Record<string, any>) => chamar("acoes_salvar", { p });

export const acoesLeitura = (p_id: any, p_leitura: string | null, p_aprendizado: string | null) =>
  chamar("acoes_leitura", { p_id, p_leitura, p_aprendizado });

export const acoesExcluir = (p_id: any) => chamar("acoes_excluir", { p_id });

export const acoesListar = (params: {
  p_inicio: string;
  p_fim: string;
  p_tipo?: string | null;
  p_driver?: string | null;
  p_sinal?: string | null;
  p_busca?: string | null;
}) =>
  chamar("acoes_listar", {
    p_inicio: params.p_inicio,
    p_fim: params.p_fim,
    p_tipo: params.p_tipo || null,
    p_driver: params.p_driver || null,
    p_sinal: params.p_sinal || null,
    p_busca: params.p_busca || null,
  });

export const acoesAprendizados = () => chamar("acoes_aprendizados");

export const acoesEvolucao = (p_semanas = 16) => chamar("acoes_evolucao", { p_semanas });

export const acoesComerciais = (p_inicio: string, p_fim: string) =>
  chamar("acoes_comerciais", { p_inicio, p_fim });

export const acoesKpisSemanais = (p_semanas = 12) =>
  chamar("acoes_kpis_semanais", { p_semanas });

/* ---------------- frentes comerciais ---------------- */

export const ROTULO_FRENTE: Record<string, string> = {
  lancamento: "Lançamento",
  acao_comercial: "Ação comercial",
  oferta_preco: "Oferta e preço",
  live: "Live",
};

export const CLASSE_FRENTE: Record<string, string> = {
  lancamento: "bg-purple-100 text-purple-800 border-purple-200",
  acao_comercial: "bg-blue-100 text-blue-800 border-blue-200",
  oferta_preco: "bg-emerald-100 text-emerald-800 border-emerald-200",
  live: "bg-pink-100 text-pink-800 border-pink-200",
  incidente: "bg-amber-100 text-amber-800 border-amber-200",
};

/** Formata um valor conforme a unidade dos KPIs semanais. */
export const valorPorUnidadeKpi = (valor: any, unidade?: string): string => {
  if (isNil(valor)) return "sem dados";
  const u = String(unidade || "").toLowerCase();
  if (u === "reais") return brl(valor);
  if (u === "inteiro") return inteiro(valor);
  if (u === "pct") return pct(valor, 2);
  return dec(valor, 2);
};

/* ---------------- sinais ---------------- */

export const CLASSE_SINAL: Record<string, string> = {
  melhora: "bg-emerald-100 text-emerald-800 border-emerald-200",
  piora: "bg-red-100 text-red-800 border-red-200",
  dentro_do_ruido: "bg-muted text-muted-foreground border-border",
  semana_em_curso: "bg-blue-100 text-blue-800 border-blue-200",
  sem_base: "bg-muted/50 text-muted-foreground border-border",
  insumo: "bg-muted/50 text-muted-foreground border-border",
};

/** Cor do driver pela combinação de sentido e z. */
export const corDriver = (sentido: any, z: any) => {
  const s = n(sentido);
  if (s === 0) return { classe: "text-muted-foreground", etiqueta: "insumo" };
  if (isNil(z)) return { classe: "text-muted-foreground", etiqueta: "sem base" };
  const zz = n(z) * (s < 0 ? -1 : 1);
  if (zz >= 1) return { classe: "text-emerald-600", etiqueta: "" };
  if (zz <= -1) return { classe: "text-red-600", etiqueta: "" };
  return { classe: "text-muted-foreground", etiqueta: "dentro do normal" };
};

export const ORIGENS_AUTOMATICAS = ["vip_dia", "meta_ads_log", "gtm_log"];

export const csvEscape = (v: any) => {
  const s = isNil(v) ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function baixarCSV(nome: string, linhas: (string | number | null)[][]) {
  const conteudo = linhas.map((l) => l.map(csvEscape).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
