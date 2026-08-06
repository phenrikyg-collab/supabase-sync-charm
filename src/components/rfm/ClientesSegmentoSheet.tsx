import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { EnviarWhatsAppInline, AVISO_JANELA_24H } from "./EnviarWhatsAppInline";

type ClienteSegmento = {
  tray_customer_id: string;
  nome: string | null;
  phone: string | null;
  valor_total: number | null;
  frequencia: number | null;
  dias_desde_ultima_compra: number | null;
};

const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));
const fmtInt = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR").format(Math.round(Number(n ?? 0)));

export function ClientesSegmentoSheet({
  segmento,
  onOpenChange,
}: {
  segmento: string | null;
  onOpenChange: (aberto: boolean) => void;
}) {
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["vw_rfm_clientes_segmento", segmento],
    enabled: !!segmento,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_rfm_clientes" as any)
        .select("tray_customer_id,nome,phone,valor_total,frequencia,dias_desde_ultima_compra")
        .eq("segmento_rfm", segmento)
        .order("valor_total", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as ClienteSegmento[];
    },
  });

  return (
    <Sheet open={!!segmento} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{segmento}</SheetTitle>
          <SheetDescription>
            {isLoading ? "Carregando clientes..." : `${fmtInt(clientes.length)} clientes neste segmento`}
          </SheetDescription>
        </SheetHeader>

        <p className="text-[11px] text-warning mt-3">{AVISO_JANELA_24H}</p>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead className="text-right">Freq.</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead>Enviar WhatsApp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => (
                  <TableRow key={c.tray_customer_id}>
                    <TableCell className="font-medium">{c.nome ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                    <TableCell className="text-right">{fmtMoney(c.valor_total)}</TableCell>
                    <TableCell className="text-right">{fmtInt(c.frequencia)}</TableCell>
                    <TableCell className="text-right">{fmtInt(c.dias_desde_ultima_compra)}</TableCell>
                    <TableCell>
                      <EnviarWhatsAppInline telefone={c.phone} />
                    </TableCell>
                  </TableRow>
                ))}
                {clientes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum cliente neste segmento
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
