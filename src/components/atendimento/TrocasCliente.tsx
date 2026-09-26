import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { chamarRpc } from "@/lib/supabaseRpc";
import { brl, dataBr } from "@/lib/cashback";
import type { DetalheCliente } from "@/lib/trocasClientes";
import { ChipsTamanhos, ListaProtocolos } from "@/components/reversa/HistoricoTrocasCliente";

type Troca = {
  protocolo?: string | null;
  origem?: "portal" | "troque_devolva";
  pedido?: string | number | null;
  tipo: "troca" | "devolucao";
  status?: string | null;
  criado_em?: string | null;
  aberta?: boolean;
  valor?: number | null;
  itens?: string | null;
};

type Resumo = {
  total: number;
  trocas: number;
  devolucoes: number;
  abertas: number;
  ultimas: Troca[];
  resumo?: DetalheCliente | null;
};

const ambar = "border-warning/30 bg-warning/10 text-warning";

export function TrocasCliente({ conversaId }: { conversaId: string | number }) {
  const [expandido, setExpandido] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["whatsapp-trocas", conversaId],
    queryFn: async () => {
      const id = Number(conversaId);
      const { data, error } = await chamarRpc<Resumo>("whatsapp_trocas_da_cliente", {
        p_conversa_id: Number.isNaN(id) ? conversaId : id,
      });
      if (error) throw error;
      return data;
    },
  });

  const total = Number(data?.total ?? 0);
  const trocas = Number(data?.trocas ?? 0);
  const devolucoes = Number(data?.devolucoes ?? 0);
  const abertas = Number(data?.abertas ?? 0);
  const r = data?.resumo ?? null;

  if (!isLoading && !isError && total === 0 && !r) return null;

  return (
    <section className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trocas e devoluções</p>
        {r?.troca_muito && <Badge variant="outline" className={ambar}>Troca muito</Badge>}
      </div>
      {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : isError ? (
        <p className="text-xs text-destructive">Não foi possível carregar as trocas e devoluções.</p>
      ) : r ? (
        <div className="space-y-2 text-xs">
          <p className="break-words">
            {r.solicitacoes ?? 0} solicitações em {r.pedidos ?? 0} pedidos ({r.taxa_pct ?? 0}%) · {r.trocas ?? 0} trocas · {r.reembolsos ?? 0} reembolsos · {r.recusadas ?? 0} recusadas
          </p>
          {abertas > 0 && <Badge variant="outline" className={ambar}>{abertas} em aberto</Badge>}
          {r.resumo_ia && <p className="whitespace-pre-line break-words rounded-md bg-muted/50 p-2 text-sm font-medium">{r.resumo_ia}</p>}
          {r.motivo_principal_rotulo && <Badge variant="outline" className="font-normal">{r.motivo_principal_rotulo}</Badge>}
          {(r.tamanhos ?? []).length > 0 && <ChipsTamanhos tamanhos={r.tamanhos!} />}
          <ListaProtocolos protocolos={r.protocolos ?? []} recolher={3} />
          {r.tray_customer_id != null && (
            <Link to={`/trocas-clientes?cliente=${encodeURIComponent(String(r.tray_customer_id))}`} className="block text-primary underline-offset-2 hover:underline">
              ver no painel de clientes que trocam
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={trocas >= 3 ? ambar : ""}>{trocas} trocas</Badge>
            <Badge variant="outline">{devolucoes} devoluções</Badge>
            {abertas > 0 && <Badge variant="outline" className={ambar}>{abertas} em aberto</Badge>}
          </div>
          <div className="space-y-2">
            {(data?.ultimas ?? []).slice(0, expandido ? 5 : 3).map((item, index) => (
              <div key={`${item.origem ?? ""}-${item.protocolo ?? index}`} className="min-w-0 rounded-md border border-border p-2 text-xs">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">
                    {item.tipo === "troca" ? "Troca" : "Devolução"}{item.pedido ? ` · pedido #${item.pedido}` : ""}
                  </span>
                  <span className="text-muted-foreground">{dataBr(item.criado_em)}</span>
                  {item.status && (
                    <Badge variant="outline" className={item.aberta ? `max-w-full break-words ${ambar} [overflow-wrap:anywhere]` : "max-w-full break-words text-muted-foreground [overflow-wrap:anywhere]"}>
                      {item.status}
                    </Badge>
                  )}
                </div>
                {(item.itens || item.valor != null) && (
                  <p className="mt-1 break-words text-muted-foreground [overflow-wrap:anywhere]">
                    {[item.itens, item.valor != null ? brl(item.valor) : null].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
          {total > 3 && (data?.ultimas?.length ?? 0) > 3 && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setExpandido((v) => !v)}>
              {expandido ? "Ver menos" : `Ver todas (${total})`}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
