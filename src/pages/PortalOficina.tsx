import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, RefreshCw } from "lucide-react";
import { PortalLogin, brlPortal, dataBR } from "@/components/portal/PortalLogin";

type Op = {
  op_id: string; nome_produto: string | null; cor_nome: string | null; quantidade: number | null;
  status_ordem: string | null; data_previsao_termino: string | null; quantidade_entregue: number | null;
  data_entrega: string | null; valor_a_receber: number | null; pagamento_status: string | null; data_pagamento: string | null;
};

export default function PortalOficina() {
  const { user, loading, signOut } = useAuth();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["oficina-minhas-ops", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await chamarRpc<Op[]>("oficina_minhas_ops", {});
      if (error) throw error;
      return (data ?? []) as Op[];
    },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <PortalLogin dominio="oficina" titulo="Portal da Oficina" />;

  const ops = data ?? [];
  const pendente = ops.filter((o) => o.pagamento_status !== "Pago").reduce((s, o) => s + (Number(o.valor_a_receber) || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <h1 className="font-serif text-xl font-bold text-foreground">Minhas ordens</h1>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" title="Recarregar" onClick={() => refetch()}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></Button>
          <Button variant="ghost" size="icon" title="Sair" onClick={() => signOut()}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        {ops.length > 0 && (
          <Card><CardContent className="flex items-center justify-between pt-4">
            <span className="text-sm text-muted-foreground">A receber (pendente)</span>
            <span className="text-lg font-semibold text-foreground">{brlPortal(pendente)}</span>
          </CardContent></Card>
        )}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">Não foi possível carregar suas ordens: {(error as any).message}</p>
        ) : ops.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma ordem por enquanto.</p>
        ) : ops.map((o) => {
          const pago = o.pagamento_status === "Pago";
          return (
            <Card key={o.op_id}>
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-serif text-lg font-semibold text-foreground">{o.nome_produto ?? "-"}</p>
                    <p className="text-sm text-muted-foreground">{o.cor_nome ?? "-"}</p>
                  </div>
                  <Badge variant="outline" className={pago ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"}>
                    {pago ? `Pago ${dataBR(o.data_pagamento)}` : "Pendente"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Peças: </span>{o.quantidade ?? "-"}</div>
                  <div><span className="text-muted-foreground">Prazo: </span>{dataBR(o.data_previsao_termino)}</div>
                  <div><span className="text-muted-foreground">Entregues: </span>{o.quantidade_entregue ?? "-"}</div>
                  <div><span className="text-muted-foreground">Entrega: </span>{dataBR(o.data_entrega)}</div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground">{o.status_ordem ?? "-"}</span>
                  <span className="font-semibold text-foreground">{brlPortal(o.valor_a_receber)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
