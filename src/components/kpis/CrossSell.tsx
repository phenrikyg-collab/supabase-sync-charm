import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShoppingBasket } from "lucide-react";

type Row = Record<string, any>;

const num = (v: any) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const fmt = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v));
const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function CrossSell() {
  const { toast } = useToast();
  const [busca, setBusca] = useState("");

  const dados = useQuery({
    queryKey: ["vw_kpi_cross_sell"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_kpi_cross_sell" as any).select("*");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const msgErro = dados.isError ? (dados.error as Error)?.message ?? "Erro" : "";
  useEffect(() => {
    if (!msgErro) return;
    toast({ variant: "destructive", title: "Cross-sell", description: msgErro });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgErro]);

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (dados.data ?? [])
      .map((r) => ({
        base: String(r.produto_base ?? "—"),
        sugerido: String(r.produto_sugerido ?? "—"),
        juntos: num(r.pedidos_juntos),
        lift: num(r.lift),
        confianca: num(r.pct_confianca),
        preco: num(r.preco_sugerido),
        estoque: num(r.estoque_sugerido),
        key: `${r.base_id ?? r.produto_base}-${r.sugerido_id ?? r.produto_sugerido}`,
      }))
      .filter((r) => r.juntos >= 5 && r.estoque >= 10)
      .filter((r) => (termo ? r.base.toLowerCase().includes(termo) : true))
      .sort((a, b) => b.lift - a.lift);
  }, [dados.data, busca]);

  return (
    <Card className="rounded-xl p-5">
      <div className="mb-1 flex items-center gap-2">
        <ShoppingBasket className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Cross-sell: o que vender junto</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Combinações com pelo menos 5 pedidos juntos e estoque saudável no sugerido.
      </p>

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar produto base…"
        className="mb-4 max-w-sm"
      />

      {dados.isLoading ? (
        <Skeleton className="h-56 w-full rounded-lg" />
      ) : dados.isError ? (
        <p className="text-sm text-muted-foreground">Não foi possível carregar o cross-sell.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Produto base</TableHead>
                <TableHead>Produto sugerido</TableHead>
                <TableHead className="text-right">Juntos</TableHead>
                <TableHead className="text-right">Lift</TableHead>
                <TableHead>Confiança</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((r, i) => (
                <TableRow key={`${r.key}-${i}`}>
                  <TableCell className="max-w-[220px] truncate font-medium">{r.base}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{r.sugerido}</TableCell>
                  <TableCell className="text-right">{fmt(r.juntos)}</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={cn(
                        r.lift >= 10
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {r.lift.toFixed(1).replace(".", ",")}x
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(r.confianca, 100)} className="h-2 w-20" />
                      <span className="text-xs text-muted-foreground">
                        {r.confianca.toFixed(1).replace(".", ",")}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{brl(r.preco)}</TableCell>
                  <TableCell className="text-right">{fmt(r.estoque)}</TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Sem combinações que atendam aos critérios.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Lift = quantas vezes mais provável que o acaso. Confiança = de quem levou o produto base,
        quantos levaram o sugerido.
      </p>
    </Card>
  );
}
