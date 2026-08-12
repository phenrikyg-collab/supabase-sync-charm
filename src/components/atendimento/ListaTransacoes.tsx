import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatarData } from "@/utils/formatters";
import { statusPagamentoClasses, rotuloStatusPagamento } from "@/lib/statusPagamento";
import { useState } from "react";

interface LinhaTransacao {
  pedido_id: string | number;
  data_pedido: string | null;
  valor: number | null;
  status_pagamento: string | null;
  forma_pagamento: string | null;
  nome_cliente: string | null;
  telefone_cliente: string | null;
}

function moeda(v: number | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
}

export function ListaTransacoesAtendimento() {
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["atendimento_listar_transacoes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("atendimento_listar_transacoes" as any, { p_limit: 100 });
      if (error) throw error;
      return (data ?? []) as unknown as LinhaTransacao[];
    },
  });

  const termo = busca.trim().toLowerCase();
  const linhas = (data ?? []).filter((l) =>
    !termo
      ? true
      : [l.pedido_id, l.nome_cliente, l.telefone_cliente]
          .map((v) => String(v ?? "").toLowerCase())
          .some((v) => v.includes(termo))
  );

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Últimas transações</h3>
          <p className="text-xs text-muted-foreground">Localize rápido um pedido e confirme se o pagamento caiu.</p>
        </div>
        <Input
          className="h-9 w-full sm:w-64"
          placeholder="Filtrar por pedido, cliente ou telefone"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <p className="rounded-lg bg-muted/30 py-10 text-center text-sm text-muted-foreground">
          Nenhuma transação encontrada.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Pedido</th>
                <th className="py-2 pr-3 font-medium">Cliente</th>
                <th className="py-2 pr-3 font-medium">Valor</th>
                <th className="py-2 pr-3 font-medium">Forma</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.pedido_id}-${l.data_pedido ?? ""}`} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3">
                    <p className="font-medium text-foreground">#{l.pedido_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.data_pedido ? formatarData(String(l.data_pedido).slice(0, 10)) : "—"}
                    </p>
                  </td>
                  <td className="py-2 pr-3">
                    <p className="text-foreground">{l.nome_cliente ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{l.telefone_cliente ?? "—"}</p>
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-foreground">{moeda(l.valor)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{l.forma_pagamento ?? "—"}</td>
                  <td className="py-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        statusPagamentoClasses(l.status_pagamento)
                      )}
                    >
                      {rotuloStatusPagamento(l.status_pagamento)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
