export type AbaCrm = "dashboard" | "campanhas" | "automacoes";

export type PeriodoCrm = {
  de?: string | null;
  ate?: string | null;
  modelo?: string | null;
  janela_whatsapp_horas?: number | null;
  janela_email_dias?: number | null;
  cotacao_usd_brl?: number | null;
  apenas_fluxos?: boolean | null;
  canal?: string | null;
};

export type MetricasCrm = {
  itens?: number | null;
  pessoas?: number | null;
  enviados?: number | null;
  entregues?: number | null;
  lidos?: number | null;
  abertos?: number | null;
  cliques?: number | null;
  botoes?: number | null;
  respostas?: number | null;
  pedidos?: number | null;
  receita?: number | null;
  custo?: number | null;
  custo_mensagens?: number | null;
  custo_ia?: number | null;
  chamadas_ia?: number | null;
  roas?: number | null;
  pct_faturamento?: number | null;
  ticket_medio?: number | null;
  itens_lista?: ItemCrm[];
};

export type CategoriaCusto = { envios?: number | null; custo?: number | null };

export type ItemCrm = {
  origem_id: string;
  nome: string;
  descricao?: string | null;
  origem?: string | null;
  canais?: string[] | null;
  status?: string | null;
  gatilho_tipo?: string | null;
  fluxo_id?: string | number | null;
  primeiro_envio?: string | null;
  ultimo_envio?: string | null;
  pessoas?: number | null;
  enviados?: number | null;
  enviados_whatsapp?: number | null;
  enviados_email?: number | null;
  entregues?: number | null;
  lidos?: number | null;
  abertos?: number | null;
  cliques?: number | null;
  botoes?: number | null;
  respostas?: number | null;
  pedidos?: number | null;
  receita?: number | null;
  custo?: number | null;
  custo_mensagens?: number | null;
  custo_ia?: number | null;
  chamadas_ia?: number | null;
  roas?: number | null;
  taxa_entrega?: number | null;
  taxa_leitura?: number | null;
  taxa_abertura?: number | null;
  taxa_clique?: number | null;
  taxa_interacao?: number | null;
  conversao?: number | null;
  ticket_medio?: number | null;
  custo_por_pedido?: number | null;
  receita_por_mil?: number | null;
  por_categoria?: Record<string, CategoriaCusto> | null;
};

export type PainelCrm = {
  periodo?: PeriodoCrm;
  faturamento?: { valor?: number | null; pedidos?: number | null };
  geral?: MetricasCrm;
  campanhas?: MetricasCrm;
  automacoes?: MetricasCrm;
  por_canal?: Array<{
    canal: string;
    enviados?: number | null;
    custo?: number | null;
    pedidos?: number | null;
    receita?: number | null;
    roas?: number | null;
  }>;
  serie?: Array<{
    dia: string;
    receita_campanhas?: number | null;
    receita_automacoes?: number | null;
    custo?: number | null;
    faturamento?: number | null;
  }>;
};

export type CustoCrm = {
  canal: string;
  categoria: string;
  custo_usd?: number | null;
  custo_brl_fixo?: number | null;
  custo_brl?: number | null;
  descricao?: string | null;
};

export type ConfigCustosCrm = {
  config?: {
    cotacao_usd_brl?: number | null;
    janela_whatsapp_horas?: number | null;
    janela_email_dias?: number | null;
  };
  custos?: CustoCrm[];
};

export const brlCrm = (valor: unknown) =>
  Number(valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const numeroCrm = (valor: unknown) => Number(valor ?? 0).toLocaleString("pt-BR");

export const percentualCrm = (valor: unknown) =>
  valor == null ? "–" : `${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export const roasCrm = (valor: unknown, custo?: unknown) =>
  custo != null && Number(custo) === 0
    ? "–"
    : valor == null
      ? "–"
      : `${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;

export function dataHoraCrm(valor?: string | null) {
  if (!valor) return "–";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "–";
  return data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}