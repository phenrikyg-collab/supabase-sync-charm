import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/cashback";

type DadosCashbackUsado = {
  preferencia?: string | null;
  preferencia_rotulo?: string | null;
  cashback_usado_cupom?: string | null;
  cashback_usado_valor?: number | string | null;
  cashback_usado_pedido?: string | number | null;
};

export function AvisoCashbackUsado({ dados }: { dados: DadosCashbackUsado }) {
  const preferencia = String(dados.preferencia ?? dados.preferencia_rotulo ?? "").toLowerCase();
  if (!/refund|reembolso|devolu[cç][aã]o/.test(preferencia) ||
      dados.cashback_usado_valor == null || dados.cashback_usado_valor === "") return null;

  return (
    <Badge variant="outline" className="h-auto max-w-xs whitespace-normal border-danger/30 bg-danger/15 py-1 text-left text-danger">
      Cashback já usado: {brl(dados.cashback_usado_valor)} (cupom {dados.cashback_usado_cupom || "-"} no pedido {dados.cashback_usado_pedido || "-"}). Descontar do reembolso.
    </Badge>
  );
}