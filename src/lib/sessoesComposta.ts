/**
 * Série composta de sessões: GA4 + rastreamento próprio.
 * Fonte única: RPC sessoes_comparativo_diario (a mesma da aba Canais e Sessões).
 */
import { supabase } from "@/integrations/supabase/client";

export type FonteSessao = "ga4" | "rastreamento";

export interface LinhaSessaoDia {
  dia: string;                 // YYYY-MM-DD
  ga4: number;
  rastreio: number;
  meta_lpv: number;
  razao: number | null;        // rastreio ÷ ga4 em %
  oficial: FonteSessao;
  usada: number;               // valor efetivamente usado no painel
  fonte_usada: FonteSessao;
  fallback: boolean;           // trocou de fonte por integridade
  integra: boolean | null;     // razão dentro de 85–115% (null se falta uma fonte)
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function isoDaData(v: unknown): string {
  const s = String(v ?? "");
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export async function fetchSessoesComparativo(dias: number): Promise<any[]> {
  const p = Math.max(14, Math.min(400, Math.ceil(dias)));
  const { data, error } = await supabase.rpc("sessoes_comparativo_diario" as any, { p_dias: p });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** Um dia é considerado quebrado quando a fonte oficial claramente não bate com a outra. */
function fonteQuebrada(oficialV: number, outraV: number): boolean {
  if (outraV <= 0) return false;               // sem referência para julgar
  if (oficialV <= 0) return true;              // zerado com a outra normal (inclui lag do GA4)
  const r = oficialV / outraV;
  return r > 3 || r < 1 / 3;                   // inflação/colapso evidente
}

export function serieComposta(linhas: any[]): LinhaSessaoDia[] {
  return linhas
    .map((r) => {
      const ga4 = num(r.sessoes_ga4);
      const rastreio = num(r.sessoes_rastreio);
      const oficial: FonteSessao = String(r.fonte_oficial ?? "ga4").toLowerCase().startsWith("rastre")
        ? "rastreamento" : "ga4";
      const razao = ga4 > 0 && rastreio > 0
        ? (r.razao_rastreio_ga4_pct != null ? num(r.razao_rastreio_ga4_pct) : (rastreio / ga4) * 100)
        : null;

      const oficialV = oficial === "ga4" ? ga4 : rastreio;
      const outraV = oficial === "ga4" ? rastreio : ga4;
      const quebrada = fonteQuebrada(oficialV, outraV);
      const fonte_usada: FonteSessao = quebrada ? (oficial === "ga4" ? "rastreamento" : "ga4") : oficial;

      return {
        dia: isoDaData(r.data ?? r.dia),
        ga4,
        rastreio,
        meta_lpv: num(r.sessoes_meta_lpv),
        razao,
        oficial,
        usada: fonte_usada === "ga4" ? ga4 : rastreio,
        fonte_usada,
        fallback: quebrada,
        integra: razao === null ? null : razao >= 85 && razao <= 115,
      } as LinhaSessaoDia;
    })
    .sort((a, b) => a.dia.localeCompare(b.dia));
}

export interface IntegridadePeriodo {
  razaoMedia: number | null;
  divergente: boolean;          // razão fora da faixa por 2+ dias seguidos
  fallbacks: number;
  fontes: FonteSessao[];
}

export function integridadePeriodo(serie: LinhaSessaoDia[]): IntegridadePeriodo {
  const comAmbas = serie.filter((l) => l.razao !== null);
  const razaoMedia = comAmbas.length
    ? comAmbas.reduce((s, l) => s + (l.razao as number), 0) / comAmbas.length
    : null;

  let seq = 0;
  let divergente = false;
  for (const l of serie) {
    if (l.integra === false) { seq++; if (seq >= 2) divergente = true; }
    else if (l.integra === true) seq = 0;
  }
  if (!divergente && razaoMedia !== null && (razaoMedia < 85 || razaoMedia > 115)) divergente = true;

  const fontes = Array.from(new Set(serie.filter((l) => l.usada > 0).map((l) => l.fonte_usada)));
  return { razaoMedia, divergente, fallbacks: serie.filter((l) => l.fallback).length, fontes };
}

export function rotuloFontes(fontes: FonteSessao[]): string {
  const temGa4 = fontes.includes("ga4");
  const temRastreio = fontes.includes("rastreamento");
  if (temGa4 && temRastreio) return "GA4 + rastreio próprio";
  if (temRastreio) return "Rastreio próprio";
  if (temGa4) return "GA4";
  return "—";
}
