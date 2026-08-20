import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl, dataBRCompleta, LOTE_STATUS, ITEM_STATUS, comoLista } from "@/lib/rh";
import { cn } from "@/lib/utils";

export function HistoricoTab() {
  const [loteId, setLoteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["rh-historico"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_folha_historico", { p_meses: 6 });
      if (error) throw error;
      return comoLista<any>((data as any)?.eventos ?? data);
    },
  });

  const { data: itens, isLoading: carregandoItens } = useQuery({
    queryKey: ["rh-lote-detalhe", loteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_lote_detalhe", { p_lote_id: loteId });
      if (error) throw error;
      return comoLista<any>((data as any)?.itens ?? data);
    },
    enabled: !!loteId,
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-serif">Histórico (6 meses)</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sem eventos no período.</p>
        ) : (
          <ol className="relative border-l pl-6 space-y-5">
            {data.map((e: any, i: number) => {
              const st = LOTE_STATUS[e.status] ?? { label: e.status ?? "—", className: "bg-muted text-muted-foreground" };
              const clicavel = e.origem === "lote_pix" && (e.lote_id ?? e.id);
              return (
                <li
                  key={e.id ?? i}
                  className={cn("relative", clicavel && "cursor-pointer")}
                  onClick={() => clicavel && setLoteId(e.lote_id ?? e.id)}
                >
                  <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.titulo ?? e.descricao ?? "Evento"}</span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full", st.className)}>{st.label}</span>
                    {e.origem === "ticket" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">Ticket</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dataBRCompleta(e.data ?? e.criado_em)} · {e.qtd ?? e.qtd_pagamentos ?? 0} pagamentos · {brl(e.valor ?? e.total)}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>

      <Dialog open={!!loteId} onOpenChange={(o) => !o && setLoteId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-serif">Detalhe do lote</DialogTitle></DialogHeader>
          {carregandoItens ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="text-left py-2">Funcionário</th>
                    <th className="text-left px-2">Descrição</th>
                    <th className="text-right px-2">Valor</th>
                    <th className="text-left px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comoLista<any>(itens).map((i: any, idx: number) => (
                    <tr key={i.id ?? idx} className="border-b">
                      <td className="py-2">{i.funcionario ?? i.nome ?? "—"}</td>
                      <td className="px-2">{i.descricao ?? i.tipo ?? "—"}</td>
                      <td className="px-2 text-right tabular-nums">{brl(i.valor)}</td>
                      <td className="px-2">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full", ITEM_STATUS[i.status] ?? "bg-muted")}>
                          {i.status ?? "—"}
                        </span>
                        {i.erro && <p className="text-[10px] text-red-600 mt-1">{i.erro}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
