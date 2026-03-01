import { useRolosTecido, useTecidos } from "@/hooks/useSupabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { Layers, DollarSign } from "lucide-react";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function EstoqueTecidos() {
  const { data: rolos, isLoading } = useRolosTecido();
  const { data: tecidos } = useTecidos();

  const tecidoMap = Object.fromEntries((tecidos ?? []).map((t) => [t.id, t]));
  const rolosDisponiveis = rolos?.filter((r) => (r.metragem_disponivel ?? 0) > 0) ?? [];

  const totalMetragem = rolosDisponiveis.reduce((a, r) => a + (r.metragem_disponivel ?? 0), 0);
  const custoTotal = rolosDisponiveis.reduce((a, r) => {
    const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
    const custoPorMetro = tecido?.custo_por_metro ?? 0;
    return a + (r.metragem_disponivel ?? 0) * custoPorMetro;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Estoque de Tecidos</h1>
        <p className="text-sm text-muted-foreground mt-1">{rolosDisponiveis.length} rolos com saldo</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard title="Metragem Total" value={`${totalMetragem.toFixed(1)}m`} icon={Layers} variant="primary" />
        <StatCard title="Custo Total em Estoque" value={formatCurrency(custoTotal)} icon={DollarSign} variant="default" />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código Rolo</TableHead>
                  <TableHead>Tecido</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Metragem Disp.</TableHead>
                  <TableHead className="text-right">Custo/Metro</TableHead>
                  <TableHead className="text-right">Custo Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolosDisponiveis.map((r) => {
                  const tecido = r.tecido_id ? tecidoMap[r.tecido_id] : null;
                  const custoMetro = tecido?.custo_por_metro ?? 0;
                  const custoRolo = (r.metragem_disponivel ?? 0) * custoMetro;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.codigo_rolo ?? "—"}</TableCell>
                      <TableCell>{tecido?.nome_tecido ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {r.cor_hex && <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: r.cor_hex }} />}
                          <span>{r.cor_nome ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.fornecedor ?? "—"}</TableCell>
                      <TableCell className="text-right">{(r.metragem_disponivel ?? 0).toFixed(2)}m</TableCell>
                      <TableCell className="text-right">{formatCurrency(custoMetro)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(custoRolo)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
