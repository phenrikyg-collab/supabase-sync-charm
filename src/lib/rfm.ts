// Configuração da matriz RFM (persistida em localStorage)

export type ConfigRFM = {
  r4: number; r3: number; r2: number; r1: number; // dias (limites de recência)
  f4: number; f3: number; f2: number; f1: number; // pedidos
  m4: number; m3: number; m2: number; m1: number; // R$
};

export const CONFIG_RFM_PADRAO: ConfigRFM = {
  r4: 30, r3: 125, r2: 210, r1: 365,
  f4: 7, f3: 4, f2: 2, f1: 1,
  m4: 1650, m3: 947, m2: 404, m1: 0,
};

const STORAGE_KEY = "rfm_config_v1";

export function carregarConfigRFM(): ConfigRFM {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return CONFIG_RFM_PADRAO;
    return { ...CONFIG_RFM_PADRAO, ...(JSON.parse(raw) as Partial<ConfigRFM>) };
  } catch {
    return CONFIG_RFM_PADRAO;
  }
}

export function salvarConfigRFM(cfg: ConfigRFM) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

/** Recência: quanto menos dias, maior a nota */
export function scoreRecencia(dias: number, c: ConfigRFM): number {
  if (dias <= c.r4) return 5;
  if (dias <= c.r3) return 4;
  if (dias <= c.r2) return 3;
  if (dias <= c.r1) return 2;
  return 1;
}

/** Frequência e Monetário: quanto maior o valor, maior a nota */
function scoreCrescente(v: number, t4: number, t3: number, t2: number, t1: number): number {
  if (v >= t4) return 5;
  if (v >= t3) return 4;
  if (v >= t2) return 3;
  if (v >= t1) return 2;
  return 1;
}

export const scoreFrequencia = (v: number, c: ConfigRFM) => scoreCrescente(v, c.f4, c.f3, c.f2, c.f1);
export const scoreMonetario = (v: number, c: ConfigRFM) => scoreCrescente(v, c.m4, c.m3, c.m2, c.m1);

export const SEGMENTOS_RFM = [
  "Campeões",
  "Clientes Fiéis",
  "Potenciais Fiéis",
  "Novos Clientes",
  "Promissores",
  "Precisam de Atenção",
  "Em Risco",
  "Não Pode Perder",
  "Hibernando",
  "Perdidos",
] as const;

export type SegmentoRFM = (typeof SEGMENTOS_RFM)[number];

/** Matriz 5x5 clássica: recência x (frequência + monetário) */
export function segmentarRFM(r: number, f: number, m: number): SegmentoRFM {
  const fm = Math.round((f + m) / 2);
  if (r >= 4 && fm >= 4) return "Campeões";
  if (r >= 3 && fm >= 4) return "Clientes Fiéis";
  if (r >= 4 && fm === 3) return "Potenciais Fiéis";
  if (r === 5 && fm <= 2) return "Novos Clientes";
  if (r === 4 && fm <= 2) return "Promissores";
  if (r === 3 && fm <= 3) return "Precisam de Atenção";
  if (r === 2 && fm >= 4) return "Não Pode Perder";
  if (r === 2 && fm >= 2) return "Em Risco";
  if (r === 1 && fm >= 4) return "Não Pode Perder";
  if (r <= 2 && fm >= 2) return "Hibernando";
  return "Perdidos";
}

/** Segmentos considerados inativos ou em vias de inatividade */
export const SEGMENTOS_RECUPERACAO: SegmentoRFM[] = [
  "Não Pode Perder",
  "Em Risco",
  "Precisam de Atenção",
  "Hibernando",
  "Perdidos",
];
