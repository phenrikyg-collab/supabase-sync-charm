import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PackageCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatarData } from "@/utils/formatters";

type Linha = {
  op_id: string; registro_revisao_id: string; nome_produto: string | null; cor_nome: string | null;
  pecas_aprovadas: number | null; pecas_reprovadas: number | null; data_conclusao: string | null;
};

export const CHAVE_AGUARDANDO_ESTOQUE = ["estoque-aguardando"];

/** OPs revisadas esperando o estoque confirmar que recebeu as peças. */
export function AguardandoEstoque() {
  const qc = useQueryClient();
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const q = useQuery({
    queryKey: CHAVE_AGUARDANDO_ESTOQUE,
    queryFn: async () => {
      const { data, error } = await chamarRpc<Linha[]>("estoque_ops_aguardando_confirmacao", {});
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  const confirmar = async (l: Linha) => {
    setConfirmando(l.op_id);
    const { error } = await chamarRpc<any>("estoque_confirmar_recebimento", { p_op_id: l.op_id });
    setConfirmando(null);
    if (error) { toast.error(error.message || "Erro ao confirmar recebimento"); return; }
    toast.success(`Recebimento confirmado: ${l.nome_produto ?? "ordem"}. A entrada no Bling sai em até 15 minutos.`);
    qc.setQueryData<Linha[]>(CHAVE_AGUARDANDO_ESTOQUE, (d) => (d ?? []).filter((x) => x.op_id !== l.op_id));
    qc.invalidateQueries({ queryKey: ["ordens_producao"] });
    qc.invalidateQueries({ queryKey: ["ordens-producao"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Ordens já revisadas. Confirme quando as peças aprovadas chegarem no estoque.</p>
        <Button variant="ghost" size="icon" title="Recarregar" onClick={() => q.refetch()}><RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /></Button>
      </div>
      {q.isLoading ? <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-primary" />
        : q.error ? <p className="py-6 text-center text-sm text-destructive">{(q.error as any).message}</p>
        : (q.data ?? []).length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma ordem aguardando o estoque.</p>
        : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {q.data!.map((l) => (
              <Card key={l.op_id}>
                <CardContent className="space-y-2 pt-4">
                  <div>
                    <p className="font-serif text-lg font-semibold text-foreground">{l.nome_produto ?? "-"}</p>
                    <p className="text-sm text-muted-foreground">{l.cor_nome ?? "-"}</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span><span className="text-muted-foreground">Aprovadas: </span><span className="font-semibold text-success">{l.pecas_aprovadas ?? 0}</span></span>
                    <span><span className="text-muted-foreground">Reprovadas: </span><span className="font-semibold text-destructive">{l.pecas_reprovadas ?? 0}</span></span>
                  </div>
                  <p className="text-xs text-muted-foreground">Revisão concluída em {l.data_conclusao ? formatarData(l.data_conclusao) : "-"}</p>
                  <Button className="w-full gap-2" onClick={() => confirmar(l)} disabled={confirmando === l.op_id}>
                    {confirmando === l.op_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Confirmar recebimento
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
