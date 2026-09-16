import { useQuery } from "@tanstack/react-query";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { num, inteiro } from "./comum";

type PorTransportadora = {
  transportadora: string | null;
  servico: string | null;
  entregues: number | null;
  media_dias: number | null;
  mediana_dias: number | null;
  p90_dias: number | null;
  pct_no_prazo: number | null;
  pct_ocorrencia: number | null;
};

type PorUf = { uf: string | null; entregues: number | null; media_dias: number | null; pct_no_prazo: number | null };

type Metricas = {
  por_transportadora?: PorTransportadora[];
  por_uf?: PorUf[];
  devolvidos?: number | null;
};

const PERIODOS = [30, 60, 90];

export function DesempenhoTab() {
  const [dias, setDias] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["logistica-metricas", dias],
    queryFn: async () => {
      const { data, error } = await chamarRpc<Metricas>("logistica_metricas", { p_dias: dias });
      if (error) throw error;
      return data ?? {};
    },
  });

  const porUf = [...(data?.por_uf ?? [])].sort((a, b) => Number(b.entregues ?? 0) - Number(a.entregues ?? 0));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map((d) => (
          <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>
            {d} dias
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Devolvidos no período</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{inteiro(data?.devolvidos ?? 0)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Por transportadora</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transportadora</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead className="text-right">Entregues</TableHead>
                <TableHead className="text-right">Média de dias</TableHead>
                <TableHead className="text-right">Mediana</TableHead>
                <TableHead className="text-right">90% entregues em até</TableHead>
                <TableHead className="text-right">% no prazo</TableHead>
                <TableHead className="text-right">% com ocorrência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.por_transportadora ?? []).map((t, i) => (
                <TableRow key={`${t.transportadora}-${t.servico}-${i}`}>
                  <TableCell>{t.transportadora || "sem dados"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.servico || ""}</TableCell>
                  <TableCell className="text-right">{inteiro(t.entregues)}</TableCell>
                  <TableCell className="text-right">{num(t.media_dias)}</TableCell>
                  <TableCell className="text-right">{num(t.mediana_dias)}</TableCell>
                  <TableCell className="text-right">{num(t.p90_dias)} dias</TableCell>
                  <TableCell className="text-right">{num(t.pct_no_prazo)}%</TableCell>
                  <TableCell className="text-right">{num(t.pct_ocorrencia)}%</TableCell>
                </TableRow>
              ))}
              {!isLoading && (data?.por_transportadora ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nenhuma entrega no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Por estado</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UF</TableHead>
                <TableHead className="text-right">Entregues</TableHead>
                <TableHead className="text-right">Média de dias</TableHead>
                <TableHead className="text-right">% no prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porUf.map((u, i) => (
                <TableRow key={`${u.uf}-${i}`}>
                  <TableCell>{u.uf || "sem dados"}</TableCell>
                  <TableCell className="text-right">{inteiro(u.entregues)}</TableCell>
                  <TableCell className="text-right">{num(u.media_dias)}</TableCell>
                  <TableCell className="text-right">{num(u.pct_no_prazo)}%</TableCell>
                </TableRow>
              ))}
              {!isLoading && porUf.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhuma entrega no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Dias contados do envio na Tray até a entrega. Loggi e Jadlog vêm pelo Melhor Envio, que só informa postagem e
        entrega.
      </p>
    </div>
  );
}
