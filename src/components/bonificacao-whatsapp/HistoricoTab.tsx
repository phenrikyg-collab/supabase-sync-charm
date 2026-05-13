import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useConsultoras } from "@/hooks/useBonificacaoWhatsApp";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

export default function HistoricoTab() {
  const { data: consultoras = [] } = useConsultoras();
  const nomeOf = (id: string) => consultoras.find((c) => c.id === id)?.nome ?? "—";

  const { data: hist = [], isLoading } = useQuery({
    queryKey: ["bonus-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonus_whatsapp_apurados" as any)
        .select("*")
        .order("mes_referencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando histórico...
      </div>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="font-serif text-xl">Histórico de apurações</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead>Consultora</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right">% Ating.</TableHead>
              <TableHead className="text-right">Bônus</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pago em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hist.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                Nenhuma apuração salva ainda.
              </TableCell></TableRow>
            )}
            {hist.map((h: any) => (
              <TableRow key={h.id}>
                <TableCell>{h.mes_referencia}</TableCell>
                <TableCell>{nomeOf(h.consultora_id)}</TableCell>
                <TableCell className="text-right">{fmtBRL(h.faturamento_liquido)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{fmtBRL(h.meta)}</TableCell>
                <TableCell className="text-right">{Number(h.pct_atingimento).toFixed(0)}%</TableCell>
                <TableCell className="text-right text-primary font-medium">{fmtBRL(h.bonus_final)}</TableCell>
                <TableCell>
                  <Badge variant={h.status === "pago" ? "default" : "outline"}>{h.status}</Badge>
                </TableCell>
                <TableCell>{h.data_pagamento ? new Date(h.data_pagamento).toLocaleDateString("pt-BR") : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
