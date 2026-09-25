import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { chamarRpc } from "@/lib/supabaseRpc";
import { brl, dataBr } from "@/lib/cashback";

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
};

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

  return (
    <section className="min-w-0 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trocas e devoluções</p>
      {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : isError ? (
        <p className="text-xs text-destructive">Não foi possível carregar as trocas e devoluções.</p>
      ) : total === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma troca ou devolução</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={trocas >= 3 ? "border-warning/30 bg-warning/10 text-warning" : ""}>{trocas} trocas</Badge>
            <Badge variant="outline">{devolucoes} devoluções</Badge>
            {abertas > 0 && <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">{abertas} em aberto</Badge>}
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
                    <Badge variant="outline" className={item.aberta ? "max-w-full break-words border-warning/30 bg-warning/10 text-warning [overflow-wrap:anywhere]" : "max-w-full break-words text-muted-foreground [overflow-wrap:anywhere]"}>
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