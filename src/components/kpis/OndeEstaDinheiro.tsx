import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

type Row = Record<string, any>;

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(v);

export default function OndeEstaDinheiro() {
  const { toast } = useToast();

  const acoes = useQuery({
    queryKey: ["vw_kpi_resumo_acoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_kpi_resumo_acoes" as any).select("*");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const msgErro = acoes.isError ? (acoes.error as Error)?.message ?? "Erro" : "";
  useEffect(() => {
    if (!msgErro) return;
    toast({
      variant: "destructive",
      title: "Onde está o dinheiro",
      description: msgErro,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgErro]);

  const linhas = useMemo(
    () =>
      [...(acoes.data ?? [])].sort(
        (a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0),
      ),
    [acoes.data],
  );

  const total = useMemo(
    () =>
      linhas.reduce(
        (s, r) => s + (r.impacto_mes_reais == null ? 0 : Number(r.impacto_mes_reais) || 0),
        0,
      ),
    [linhas],
  );

  return (
    <Card className="rounded-xl p-5">
      <div className="mb-1 flex items-center gap-2">
        <Coins className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Onde está o dinheiro</h3>
      </div>
      <p className="mb-4 font-serif text-2xl font-bold text-primary">
        Oportunidade mapeada: {brl(total)}/mês
      </p>

      {acoes.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-lg" />
          ))}
        </div>
      ) : acoes.isError ? (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar as oportunidades.
        </p>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem oportunidades mapeadas.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {linhas.map((r, i) => {
            const eixo = String(r.eixo ?? "").toLowerCase();
            const isTicket = eixo === "ticket";
            return (
              <Card
                key={`${r.ordem ?? i}`}
                className="flex flex-col gap-3 rounded-xl border-border/70 p-4"
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "w-fit capitalize",
                    isTicket
                      ? "border-purple-500/30 bg-purple-500/10 text-purple-600"
                      : "border-blue-500/30 bg-blue-500/10 text-blue-600",
                  )}
                >
                  {isTicket ? "Ticket" : "Conversão"}
                </Badge>

                <h4 className="text-base font-semibold leading-snug">
                  {String(r.titulo ?? "—")}
                </h4>

                {r.evidencia && (
                  <p className="text-sm text-muted-foreground">{String(r.evidencia)}</p>
                )}

                {r.impacto_mes_reais != null && (
                  <div>
                    <p className="font-serif text-2xl font-bold">
                      {brl(Number(r.impacto_mes_reais) || 0)}
                    </p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      impacto estimado/mês
                    </p>
                  </div>
                )}

                {r.acao && (
                  <div className="mt-auto rounded-md bg-muted/60 p-3 text-sm">
                    {String(r.acao)}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs italic text-muted-foreground">
        Estimativas baseadas na taxa de conversão observada e no ticket médio do mês.
        Servem para priorizar, não para projetar receita.
      </p>
    </Card>
  );
}
