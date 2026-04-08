/**
 * Calculates the display status for credit card transactions (extrato_cartao / cartao_fatura).
 *
 * Rules:
 * - If a pagamento_fatura exists for the same fatura_id → "pago"
 * - If no payment AND data_vencimento > today → "aguardando_fatura"
 * - If no payment AND data_vencimento <= today → "fatura_vencida"
 */

export type CardTransactionStatus = "pago" | "aguardando_fatura" | "fatura_vencida";

export interface CardStatusLabels {
  status: CardTransactionStatus;
  label: string;
  variant: "success" | "warning" | "destructive";
}

const STATUS_LABELS: Record<CardTransactionStatus, Omit<CardStatusLabels, "status">> = {
  pago: { label: "Pago", variant: "success" },
  aguardando_fatura: { label: "Aguardando fatura", variant: "warning" },
  fatura_vencida: { label: "Fatura vencida", variant: "destructive" },
};

/**
 * Build a Set of fatura_ids that have at least one pagamento_fatura record.
 */
export function buildPaidFaturaSet(movs: any[]): Set<string> {
  const set = new Set<string>();
  for (const m of movs) {
    if (m.origem === "pagamento_fatura" && m.fatura_id) {
      set.add(m.fatura_id);
    }
  }
  return set;
}

/**
 * Determine the computed status for a credit card transaction.
 */
export function getCardTransactionStatus(
  mov: { fatura_id?: string | null; data_vencimento?: string | null; origem?: string | null; conta_tipo?: string | null },
  paidFaturaIds: Set<string>,
): CardTransactionStatus | null {
  // Only applies to card transactions
  const isCardTx = mov.conta_tipo === "cartao_fatura" || mov.origem === "extrato_cartao";
  if (!isCardTx || !mov.fatura_id) return null;

  if (paidFaturaIds.has(mov.fatura_id)) {
    return "pago";
  }

  const hoje = new Date().toISOString().split("T")[0];
  if (mov.data_vencimento && mov.data_vencimento > hoje) {
    return "aguardando_fatura";
  }

  return "fatura_vencida";
}

export function getCardStatusLabels(status: CardTransactionStatus): CardStatusLabels {
  return { status, ...STATUS_LABELS[status] };
}
