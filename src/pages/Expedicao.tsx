import { useExpedicao } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { Truck, AlertTriangle, CheckCircle } from "lucide-react";

export default function Expedicao() {
  const { data: pedidos, isLoading } = useExpedicao();

  const noPrazo = pedidos?.filter((p) => p.nivel_risco?.toLowerCase() === "no prazo").length ?? 0;
  const emAlerta = pedidos?.filter((p) => p.nivel_risco?.toLowerCase() === "em alerta").length ?? 0;
  const critico = pedidos?.filter((p) => ["critico", "crítico"].includes(p.nivel_risco?.toLowerCase() ?? "")).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Expedição</h1>
        <p className="text-sm text-muted-foreground mt-1">Pedidos Bling — Status de entrega</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="No Prazo" value={noPrazo} icon={CheckCircle} variant="success" />
        <StatCard title="Em Alerta" value={emAlerta} icon={AlertTriangle} variant="warning" />
        <StatCard title="Crítico" value={critico} icon={Truck} variant="danger" />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data Pedido</TableHead>
                  <TableHead>Status Bling</TableHead>
                  <TableHead className="text-right">Dias Corridos</TableHead>
                  <TableHead>Risco</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.bling_pedido_id ?? "—"}</TableCell>
                    <TableCell>{p.cliente ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.data_pedido ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.status_bling ?? "—"}</TableCell>
                    <TableCell className="text-right">{p.dias_corridos ?? 0}</TableCell>
                    <TableCell><StatusBadge status={p.nivel_risco ?? ""} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
