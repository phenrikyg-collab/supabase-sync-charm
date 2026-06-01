// Motor de cálculo de bonificação das consultoras WhatsApp.
// Regras configuráveis vindas de config_bonificacao_whatsapp.

export interface FaixaMeta {
  min_pct: number;
  max_pct: number;
  bonus_base: number;
  label: string;
}
export interface RegraDesconto {
  max_pct: number;        // até este % de desconto, aplica o multiplicador
  multiplicador: number;  // 1.0 = 100%
}
export interface FaixaTicket {
  min_valor: number;
  acelerador: number;
}
export interface ConfigBonificacao {
  faixas_meta: FaixaMeta[];
  regras_desconto: RegraDesconto[];
  faixas_ticket: FaixaTicket[];
}

export const CONFIG_PADRAO: ConfigBonificacao = {
  faixas_meta: [
    { min_pct: 0,   max_pct: 94.99,  bonus_base: 0,    label: "Abaixo da meta" },
    { min_pct: 95,  max_pct: 109.99, bonus_base: 500,  label: "Meta" },
    { min_pct: 110, max_pct: 119.99, bonus_base: 900,  label: "Super meta" },
    { min_pct: 120, max_pct: 99999,  bonus_base: 1500, label: "Top performer" },
  ],
  regras_desconto: [
    { max_pct: 6,     multiplicador: 1.0 },
    { max_pct: 10,    multiplicador: 0.7 },
    { max_pct: 15,    multiplicador: 0.5 },
    { max_pct: 99999, multiplicador: 0.0 },
  ],
  faixas_ticket: [
    { min_valor: 380, acelerador: 100 },
    { min_valor: 420, acelerador: 250 },
    { min_valor: 500, acelerador: 500 },
  ],
};

export interface ResultadoBonus {
  pct_atingimento: number;
  faixa_label: string;
  bonus_base: number;
  multiplicador_desconto: number;
  acelerador_ticket: number;
  bonus_final: number;
}

export function calcularBonus(
  faturamento_liquido: number,
  meta: number,
  ticket_medio: number,
  desconto_medio_pct: number,
  config: ConfigBonificacao = CONFIG_PADRAO
): ResultadoBonus {
  const pct = meta > 0 ? (faturamento_liquido / meta) * 100 : 0;

  // Busca a faixa exata; se houver gaps na configuração (ex.: 91-99 e 101-115),
  // cai para a maior faixa cujo min_pct <= pct, evitando que valores intermediários
  // (ex.: 100,45%) sejam tratados como "Abaixo da meta".
  const faixaExata = config.faixas_meta.find(
    (f) => pct >= f.min_pct && pct <= f.max_pct
  );
  const faixa =
    faixaExata ??
    [...config.faixas_meta]
      .filter((f) => pct >= f.min_pct)
      .sort((a, b) => b.min_pct - a.min_pct)[0] ??
    config.faixas_meta[0];


  const regraDesc =
    [...config.regras_desconto]
      .sort((a, b) => a.max_pct - b.max_pct)
      .find((r) => desconto_medio_pct <= r.max_pct) ??
    config.regras_desconto[config.regras_desconto.length - 1];

  // apenas a maior faixa atingida
  const acelerador = [...config.faixas_ticket]
    .sort((a, b) => b.min_valor - a.min_valor)
    .find((f) => ticket_medio >= f.min_valor)?.acelerador ?? 0;

  const bonus_final = faixa.bonus_base * regraDesc.multiplicador + acelerador;

  return {
    pct_atingimento: pct,
    faixa_label: faixa.label,
    bonus_base: faixa.bonus_base,
    multiplicador_desconto: regraDesc.multiplicador,
    acelerador_ticket: acelerador,
    bonus_final,
  };
}

export type StatusBonus = "projetado" | "aprovado" | "pago";

export function corPorAtingimento(pct: number): {
  bg: string; text: string; label: string;
} {
  if (pct >= 120) return { bg: "bg-purple-500/15", text: "text-purple-400", label: "Top" };
  if (pct >= 110) return { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Super meta" };
  if (pct >= 95)  return { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "Meta" };
  if (pct >= 80)  return { bg: "bg-amber-500/15",   text: "text-amber-400",   label: "Próximo" };
  return { bg: "bg-red-500/15", text: "text-red-400", label: "Abaixo" };
}
