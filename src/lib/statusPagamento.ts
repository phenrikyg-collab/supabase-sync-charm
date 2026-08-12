/** Badge de status de PAGAMENTO (não de envio) — usado em Transações do Site e no Atendimento. */
export function statusPagamentoClasses(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (/pago|aprovad|confirmad/.test(s)) return "bg-success/10 text-success border-success/20";
  if (/cancel|recusad|estorn|reprovad|expirad/.test(s)) return "bg-danger/10 text-danger border-danger/20";
  if (/aguard|pendent|process|analis/.test(s)) return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
}

export function rotuloStatusPagamento(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (!s) return "—";
  if (s === "aguardando_pagamento") return "Aguardando pagamento";
  if (s === "pago") return "Pago";
  if (s === "cancelado") return "Cancelado";
  return s.replace(/_/g, " ");
}
