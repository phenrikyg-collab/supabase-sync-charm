// Cascata de cálculo do Planejamento Estratégico
export interface Drivers {
  retencao: number;
  aprovacao: number;
  ticket_medio: number;
  taxa_conversao: number;
  invest_midia: number;
  invest_vip: number;
  invest_imp: number;
  sessoes_org: number;
  cps_midia: number;
}

export interface CascataResultado {
  invest_total: number;
  sessoes_midia: number;
  sessoes_totais: number;
  pct_midia: number;
  pedidos_captados: number;
  pedidos_aquisicao: number;
  pedidos_retencao: number;
  pedidos_faturados: number;
  receita_captada: number;
  receita_faturada: number;
  receita_cancelada: number;
  cac: number;
  cpa_real: number;
  roas_faturado: number;
  adcost_pct: number;
}

const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export function calcularCascata(d: Drivers): CascataResultado {
  const invest_total = (d.invest_midia || 0) + (d.invest_vip || 0) + (d.invest_imp || 0);
  const sessoes_midia = safeDiv(d.invest_midia || 0, d.cps_midia || 0);
  const sessoes_totais = sessoes_midia + (d.sessoes_org || 0);
  const pct_midia = safeDiv(sessoes_midia, sessoes_totais) * 100;
  const pedidos_captados = Math.floor((sessoes_totais * (d.taxa_conversao || 0)) / 100);
  const pedidos_aquisicao = Math.floor(pedidos_captados * (1 - (d.retencao || 0) / 100));
  const pedidos_retencao = Math.floor(pedidos_captados * ((d.retencao || 0) / 100));
  const pedidos_faturados = Math.floor((pedidos_captados * (d.aprovacao || 0)) / 100);
  const receita_captada = pedidos_captados * (d.ticket_medio || 0);
  const receita_faturada = (receita_captada * (d.aprovacao || 0)) / 100;
  const receita_cancelada = receita_captada - receita_faturada;
  const cac = safeDiv(invest_total, pedidos_aquisicao);
  const cpa_real = safeDiv(invest_total, pedidos_faturados);
  const roas_faturado = safeDiv(receita_faturada, invest_total);
  const adcost_pct = safeDiv(invest_total, receita_faturada) * 100;
  return {
    invest_total, sessoes_midia, sessoes_totais, pct_midia,
    pedidos_captados, pedidos_aquisicao, pedidos_retencao, pedidos_faturados,
    receita_captada, receita_faturada, receita_cancelada,
    cac, cpa_real, roas_faturado, adcost_pct,
  };
}

export function usePlanejamentoCascata(drivers: Drivers): CascataResultado {
  return calcularCascata(drivers);
}

// Faixas saudáveis e flags
export interface RedFlag {
  driver: string;
  valor: number;
  faixa: string;
  severity: "warn" | "danger";
  mes?: number;
}

export function checkDriverFlags(d: Drivers, cascata: CascataResultado, mes?: number): RedFlag[] {
  const flags: RedFlag[] = [];
  if (d.retencao < 10 || d.retencao > 60) flags.push({ driver: "Retenção", valor: d.retencao, faixa: "10–60%", severity: "danger", mes });
  if (d.aprovacao < 70) flags.push({ driver: "Aprovação", valor: d.aprovacao, faixa: "≥ 80%", severity: "danger", mes });
  else if (d.aprovacao < 80) flags.push({ driver: "Aprovação", valor: d.aprovacao, faixa: "≥ 80%", severity: "warn", mes });
  if (d.cps_midia > 1.2) flags.push({ driver: "CPS Mídia", valor: d.cps_midia, faixa: "≤ R$ 1,20", severity: "warn", mes });
  if (cascata.roas_faturado < 2.5) flags.push({ driver: "ROAS Faturado", valor: cascata.roas_faturado, faixa: "≥ 2.5x", severity: "danger", mes });
  return flags;
}

// Benchmark Moda Feminina — identifica driver gargalo
interface Benchmark { min: number; ideal: number; }
const BENCH: Record<keyof Drivers, Benchmark | null> = {
  ticket_medio: { min: 280, ideal: 360 },
  taxa_conversao: { min: 1.2, ideal: 2.0 },
  retencao: { min: 25, ideal: 35 },
  cps_midia: { min: 0.8, ideal: 1.1 }, // menor é melhor — invertido
  aprovacao: { min: 88, ideal: 92 },
  invest_midia: null, invest_vip: null, invest_imp: null, sessoes_org: null,
};

export function identificarGargalo(d: Drivers): { driver: string; valor: number; ideal: number; impacto: number } | null {
  let pior: { driver: string; valor: number; ideal: number; gap: number } | null = null;
  (Object.keys(BENCH) as (keyof Drivers)[]).forEach((k) => {
    const b = BENCH[k];
    if (!b) return;
    const v = d[k] as number;
    let gap: number;
    if (k === "cps_midia") {
      gap = v > b.ideal ? (v - b.ideal) / b.ideal : 0;
    } else {
      gap = v < b.ideal ? (b.ideal - v) / b.ideal : 0;
    }
    if (gap > 0 && (!pior || gap > pior.gap)) {
      pior = { driver: String(k), valor: v, ideal: b.ideal, gap };
    }
  });
  if (!pior) return null;
  // Estimar impacto: simular cascata com driver ajustado
  const ajustado = { ...d, [pior.driver]: pior.ideal } as Drivers;
  const baseR = calcularCascata(d).receita_faturada;
  const ajR = calcularCascata(ajustado).receita_faturada;
  return { driver: pior.driver, valor: pior.valor, ideal: pior.ideal, impacto: ajR - baseR };
}

export const DRIVER_LABELS: Record<keyof Drivers, { label: string; unit: string; faixa: string }> = {
  ticket_medio: { label: "Ticket Médio", unit: "R$", faixa: "R$ 280–360" },
  taxa_conversao: { label: "Taxa de Conversão", unit: "%", faixa: "1.2% – 2.5%" },
  retencao: { label: "Retenção", unit: "%", faixa: "25% – 40%" },
  aprovacao: { label: "Aprovação", unit: "%", faixa: "88% – 92%" },
  cps_midia: { label: "CPS Mídia", unit: "R$", faixa: "R$ 0,80 – 1,20" },
  invest_midia: { label: "Invest. Mídia", unit: "R$", faixa: "—" },
  invest_vip: { label: "Invest. VIP", unit: "R$", faixa: "—" },
  invest_imp: { label: "Invest. Impulsionamento", unit: "R$", faixa: "—" },
  sessoes_org: { label: "Sessões Orgânicas", unit: "Nº", faixa: "—" },
};

export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const DEFAULT_DRIVERS: Drivers = {
  retencao: 27, aprovacao: 88, ticket_medio: 350, taxa_conversao: 1.8,
  invest_midia: 12000, invest_vip: 800, invest_imp: 500, sessoes_org: 22000, cps_midia: 1.08,
};
