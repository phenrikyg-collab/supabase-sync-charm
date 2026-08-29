import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ===== Tipos =====
export interface CriativoPeriodo {
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  formato: string | null;
  tipo_criativo: string | null;
  tipo_funil: string | null;
  quality_ranking: string | null;
  thumbnail_url: string | null;
  image_url: string | null;
  instagram_permalink: string | null;
  impressions: number | null;
  clicks: number | null;
  link_clicks: number | null;
  spend: number | null;
  video_3s_views: number | null;
  video_thruplays: number | null;
  purchases: number | null;
  purchase_value: number | null;
  frequency: number | null;
  thumb_stop_rate: number | null;
  retencao_rate: number | null;
  ctr_link: number | null;
  cpm: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  conversao_rate: number | null;
  prev_impressions: number | null;
  prev_spend: number | null;
  prev_thumb_stop: number | null;
  prev_ctr_link: number | null;
  prev_cpm: number | null;
  prev_cpa: number | null;
  prev_roas: number | null;
}

export interface FunilPeriodo {
  periodo: "atual" | "anterior";
  investimento: number | null;
  impressions: number | null;
  video_impressions: number | null;
  video_3s_views: number | null;
  video_thruplays: number | null;
  link_clicks: number | null;
  purchases: number | null;
  receita: number | null;
  thumb_stop_rate: number | null;
  retencao_rate: number | null;
  ctr_link: number | null;
  conversao_rate: number | null;
  cpm: number | null;
  cps: number | null;
  cpa: number | null;
  roas: number | null;
  data_inicio: string | null;
  data_fim: string | null;
}

export interface DiversidadeLinha {
  dimensao: "formato" | "tipo_criativo";
  chave: string | null;
  qtd_anuncios: number | null;
  investimento: number | null;
  receita: number | null;
  roas: number | null;
}

export interface CampanhaPeriodo {
  campaign_id: string;
  campaign_name: string | null;
  status: string | null;
  objetivo: string | null;
  publico: string | null;
  targeting_resumo?: string | null;
  investimento: number | null;
  impressions: number | null;
  reach: number | null;
  frequency: number | null;
  link_clicks: number | null;
  cps: number | null;
  cpm: number | null;
  ctr_link: number | null;
  add_to_cart: number | null;
  initiate_checkout: number | null;
  purchases: number | null;
  conversao_rate: number | null;
  receita: number | null;
  cpa: number | null;
  roas: number | null;
  prev_investimento: number | null;
  prev_cps: number | null;
  prev_cpm: number | null;
  prev_ctr_link: number | null;
  prev_conversao: number | null;
  prev_cpa: number | null;
  prev_roas: number | null;
}

export interface MetaAlertaMotivo {
  tag: string;
  texto: string;
}

export interface MetaAlertaBenchmark {
  roas_alvo?: number | null;
  cpm_conta?: number | null;
  cpa_conta?: number | null;
  ctr_conta?: number | null;
  conversao_conta?: number | null;
}

export interface MetaAlertaPeriodo {
  campaign_id: string;
  campanha: string;
  campanha_completa: string;
  objetivo_grupo: string;
  publico: string;
  tipo: string;
  acao: string;
  severidade: number;
  dinheiro_em_risco: number;
  ganho_potencial: number;
  investimento: number;
  receita: number;
  roas: number;
  cpa: number;
  cpm: number;
  ctr_link: number;
  conversao_rate: number;
  frequency: number;
  purchases: number;
  resumo: string;
  motivos: MetaAlertaMotivo[];
  benchmark: MetaAlertaBenchmark;
}

export interface MetaAlertaResumo {
  criticos: number;
  riscos: number;
  oportunidades: number;
  total_em_risco: number;
  ganho_potencial: number;
  campanhas_ativas: number;
  campanhas_sem_alerta: number;
  benchmark: MetaAlertaBenchmark;
}

export async function metaAlertasPeriodo(dias: number, minGasto?: number | null, roasAlvo?: number | null) {
  const { data, error } = await (supabase.rpc as any)("meta_alertas_periodo", {
    p_dias: dias,
    p_min_gasto: minGasto ?? null,
    p_roas_alvo: roasAlvo ?? null,
  });
  if (error) throw error;
  return (data ?? []) as MetaAlertaPeriodo[];
}

export async function metaAlertasResumo(dias: number) {
  const { data, error } = await (supabase.rpc as any)("meta_alertas_resumo", { p_dias: dias });
  if (error) throw error;
  return (data?.[0] ?? null) as MetaAlertaResumo | null;
}

/** Rótulos e cores da classificação de público. */
export const PUBLICO_BADGE: Record<string, string> = {
  "Novo (frio)": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "Novo (Lookalike)": "bg-sky-400/10 text-sky-600 border-sky-400/20",
  Engajado: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  Clientes: "bg-success/10 text-success border-success/20",
  Misto: "bg-muted text-muted-foreground border-border",
  Indefinido: "bg-muted text-muted-foreground border-border",
};

export const PUBLICOS_FRIOS = ["Novo (frio)", "Novo (Lookalike)"];

/** Campanha pronta para escalar: público frio, CPS bom, CPM saudável, convertendo e ROAS ok. */
export function ehOportunidadeEscala(c: CampanhaPeriodo) {
  const frio = PUBLICOS_FRIOS.includes(c.publico || "");
  const cpsOk = c.cps !== null && n(c.cps) > 0 && n(c.cps) <= 1.5;
  const cpmOk = c.cpm !== null && n(c.cpm) >= 12 && n(c.cpm) <= 20;
  const convOk =
    n(c.conversao_rate) >= 1 ||
    (n(c.purchases) === 0 && n(c.link_clicks) > 0 && (n(c.add_to_cart) / n(c.link_clicks)) * 100 >= 3);
  const roasOk = n(c.roas) >= 2 || (n(c.purchases) === 0 && convOk);
  return frio && cpsOk && cpmOk && convOk && roasOk;
}


// ===== Formatação pt-BR =====
export const n = (v: unknown) => (v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v));
export const brl = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
export const int = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : Math.round(Number(v)).toLocaleString("pt-BR");
export const pct = (v: number | null | undefined, casas = 1) =>
  v === null || v === undefined ? "—" : `${Number(v).toFixed(casas).replace(".", ",")}%`;
export const roasFmt = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${Number(v).toFixed(1).replace(".", ",")}x`;
export const isVideo = (formato: string | null | undefined) => (formato || "").toLowerCase() === "video";

/** Variação percentual; retorna null quando não há base. */
export const delta = (atual: number | null | undefined, anterior: number | null | undefined) => {
  const a = atual === null || atual === undefined ? null : Number(atual);
  const b = anterior === null || anterior === undefined ? null : Number(anterior);
  if (a === null || b === null || !b) return null;
  return ((a - b) / Math.abs(b)) * 100;
};

// ===== Benchmarks (Tráfego Estratégico) =====
export type Nivel = "ruim" | "atencao" | "bom" | "forte" | "neutro";

export const NIVEL_COR: Record<Nivel, string> = {
  ruim: "text-danger",
  atencao: "text-warning",
  bom: "text-success",
  forte: "text-success",
  neutro: "text-muted-foreground",
};

export const NIVEL_BG: Record<Nivel, string> = {
  ruim: "bg-danger/10 text-danger border-danger/20",
  atencao: "bg-warning/10 text-warning border-warning/20",
  bom: "bg-success/10 text-success border-success/20",
  forte: "bg-success/15 text-success border-success/30",
  neutro: "bg-muted text-muted-foreground border-border",
};

export const NIVEL_LABEL: Record<Nivel, string> = {
  ruim: "Abaixo",
  atencao: "Atenção",
  bom: "Saudável",
  forte: "Forte",
  neutro: "Sem dado",
};

/** Escalas crescentes (maior é melhor) e decrescentes (menor é melhor). */
function escalaCresc(v: number | null | undefined, ruim: number, atencao: number, bom: number): Nivel {
  if (v === null || v === undefined) return "neutro";
  const x = Number(v);
  if (x < ruim) return "ruim";
  if (x < atencao) return "atencao";
  if (x < bom) return "bom";
  return "forte";
}
function escalaDecresc(v: number | null | undefined, ruim: number, atencao: number, bom: number): Nivel {
  if (v === null || v === undefined) return "neutro";
  const x = Number(v);
  if (x > ruim) return "ruim";
  if (x > atencao) return "atencao";
  if (x > bom) return "bom";
  return "forte";
}

export type MetricaBench = "thumb_stop" | "retencao" | "ctr" | "cpm" | "cps" | "roas" | "cpa" | "conversao";

export function nivelDe(metrica: MetricaBench, valor: number | null | undefined): Nivel {
  switch (metrica) {
    case "thumb_stop": return escalaCresc(valor, 12, 18, 22);
    case "retencao": return escalaCresc(valor, 10, 14, 18);
    case "ctr": return escalaCresc(valor, 0.3, 0.5, 1.5);
    case "cpm": return escalaDecresc(valor, 25, 18, 15);
    case "cps": return escalaDecresc(valor, 3, 1.5, 0.8);
    case "roas": return escalaCresc(valor, 2, 4, 6);
    case "conversao": return escalaCresc(valor, 0.5, 1, 2);
    default: return "neutro";
  }
}

/** Métricas em que a queda é melhora. */
export const MENOR_MELHOR: MetricaBench[] = ["cpa", "cpm", "cps"];

export const QUALITY_LABEL = (q: string | null | undefined) => {
  if (!q) return "—";
  if (q === "ABOVE_AVERAGE") return "Acima da média";
  if (q === "AVERAGE") return "Média";
  if (q.startsWith("BELOW_AVERAGE")) return "Abaixo da média";
  return q;
};

export const FORMATO_LABEL: Record<string, string> = {
  video: "Vídeo",
  imagem: "Imagem",
  carrossel: "Carrossel",
  catalogo: "Catálogo",
  outro: "Outro",
};

// ===== Hooks de RPC =====
function useRpc<T>(fn: string, args: Record<string, unknown>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const chave = JSON.stringify(args);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    supabase
      .rpc(fn as any, JSON.parse(chave))
      .then(({ data }: any) => {
        if (!ativo) return;
        setData((data as T[]) || []);
        setLoading(false);
      })
      .then(undefined, () => {
        if (!ativo) return;
        setData([]);
        setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, [fn, chave]);

  return { data, loading };
}

export const useMetaCriativos = (dias: number) => useRpc<CriativoPeriodo>("meta_criativos_periodo", { p_dias: dias });
export const useMetaFunil = (dias: number) => useRpc<FunilPeriodo>("meta_funil_periodo", { p_dias: dias });
export const useMetaDiversidade = (dias: number) => useRpc<DiversidadeLinha>("meta_diversidade_periodo", { p_dias: dias });
export const useMetaCampanhas = (dias: number) => useRpc<CampanhaPeriodo>("meta_campanhas_periodo", { p_dias: dias });

/** Frequência: 🟢 até 3,5 · 🟡 3,5–4 · 🔴 acima de 4. */
export const corFrequencia = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "text-muted-foreground";
  const x = Number(v);
  if (x > 4) return "text-danger";
  if (x > 3.5) return "text-warning";
  return "text-success";
};
export const freqFmt = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : Number(v).toFixed(2).replace(".", ",");


// ===== Classificação de criativo (Matriz de Eficiência) =====
export type Selo = "estrela" | "escalar" | "observar" | "corrigir";
export const SELO_META: Record<Selo, { label: string; className: string }> = {
  estrela: { label: "⭐ Estrela", className: "bg-success/15 text-success border-success/30" },
  escalar: { label: "Escalar", className: "bg-success/10 text-success border-success/20" },
  observar: { label: "Observar", className: "bg-warning/10 text-warning border-warning/20" },
  corrigir: { label: "! Corrigir", className: "bg-danger/10 text-danger border-danger/20" },
};

export function seloDe(c: CriativoPeriodo): Selo {
  const roas = n(c.roas);
  const thumb = c.thumb_stop_rate === null || c.thumb_stop_rate === undefined ? null : Number(c.thumb_stop_rate);
  if (roas >= 4 && thumb !== null && thumb >= 18) return "estrela";
  if (roas >= 4) return "escalar";
  if (roas >= 2) return "observar";
  return "corrigir";
}

// ===== Fadiga =====
export function scoreFadiga(c: CriativoPeriodo) {
  let score = 0;
  const motivos: string[] = [];
  if (n(c.frequency) > 3.5) { score += 2; motivos.push("Frequência acima de 3,5"); }
  const dCtr = delta(c.ctr_link, c.prev_ctr_link);
  if (dCtr !== null && dCtr <= -20) { score += 3; motivos.push("CTR caiu 20% ou mais"); }
  const dCpm = delta(c.cpm, c.prev_cpm);
  if (dCpm !== null && dCpm >= 20) { score += 2; motivos.push("CPM subiu 20% ou mais"); }
  const dRoas = delta(c.roas, c.prev_roas);
  if (dRoas !== null && dRoas <= -15) { score += 3; motivos.push("ROAS caiu 15% ou mais"); }
  const recomendacao = score >= 8 ? "🔴 Pausar e trocar criativo" : score >= 4 ? "🟡 Refresh em breve" : "OK";
  return { score, motivos, recomendacao };
}
