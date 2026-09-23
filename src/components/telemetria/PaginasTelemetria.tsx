import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchTelemetriaPaginas, fmtInt, fmtPct } from "@/lib/telemetria";

export function PaginasTelemetria({ de, ate, limite = 50 }: { de: string; ate: string; limite?: number }) {
  const { data } = useQuery({
    queryKey: ["telemetria-paginas", de, ate, limite],
    queryFn: () => fetchTelemetriaPaginas(de, ate, limite),
    staleTime: 5 * 60_000,
  });
  const linhas = useMemo(() => data ?? [], [data]);

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-lg">Top 10 páginas por sessões</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={linhas.slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="pagina" type="category" width={220} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => fmtInt(Number(v))} />
              <Bar dataKey="sessoes" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento por página</CardTitle>
          <p className="text-xs text-muted-foreground">Taxa de saída acima de 60% aparece em vermelho.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Página</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="text-right">Sessões</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Taxa de Saída</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((r) => (
                <TableRow key={r.pagina}>
                  <TableCell className="max-w-[320px] truncate font-mono text-xs">{r.pagina}</TableCell>
                  <TableCell className="max-w-[320px] truncate">{r.titulo || "-"}</TableCell>
                  <TableCell className="text-right">{fmtInt(r.sessoes)}</TableCell>
                  <TableCell className="text-right">{fmtPct(r.pct_do_total)}</TableCell>
                  <TableCell className="text-right">{fmtInt(r.entradas)}</TableCell>
                  <TableCell className="text-right">{fmtInt(r.saidas)}</TableCell>
                  <TableCell className={`text-right ${r.taxa_saida_pct > 60 ? "font-medium text-destructive" : ""}`}>
                    {fmtPct(r.taxa_saida_pct)}
                  </TableCell>
                </TableRow>
              ))}
              {!linhas.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">Sem dados no período</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
