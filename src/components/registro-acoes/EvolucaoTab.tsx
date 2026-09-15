import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as ReTooltip,
  XAxis, YAxis, Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  acoesEvolucao, brl, isNil, n, rotuloSemana, valorPorUnidade, type AcoesOpcoes,
} from "@/lib/registroAcoes";

export default function EvolucaoTab({ opcoes }: { opcoes: AcoesOpcoes }) {
  const [driver, setDriver] = useState(opcoes.drivers[0]?.valor ?? "");

  const { data, isLoading, error } = useQuery({
    queryKey: ["acoes", "evolucao"],
    queryFn: async () => {
      const d = await acoesEvolucao(16);
      const raiz = Array.isArray(d) ? d : d?.semanas ?? [];
      return Array.isArray(raiz) ? raiz : [];
    },
  });

  const meta = opcoes.drivers.find((d) => d.valor === driver);

  const serie = useMemo(() => {
    return (data ?? []).map((s: any) => {
      const valores = s.drivers ?? s.valores ?? s;
      return {
        semana: s.semana,
        rotulo: rotuloSemana(s.semana),
        parcial: !!s.parcial,
        receita: n(s.receita_faturada),
        valor: isNil(valores?.[driver]) ? null : n(valores[driver]),
        temAcoes: (s.acoes_titulos ?? []).length > 0,
        acoes_titulos: s.acoes_titulos ?? [],
        bruto: valores,
      };
    });
  }, [data, driver]);

  const serieFirme = serie.map((p) => ({ ...p, valorFirme: p.parcial ? null : p.valor }));
  const serieParcial = serie.map((p, i) => ({
    ...p,
    valorParcial: p.parcial || serie[i + 1]?.parcial ? p.valor : null,
  }));
  const dados = serie.map((p, i) => ({
    ...p,
    valorFirme: serieFirme[i].valorFirme,
    valorParcial: serieParcial[i].valorParcial,
  }));

  /* coloração da tabela por coluna */
  const extremos = useMemo(() => {
    const mapa: Record<string, { min: number; max: number }> = {};
    opcoes.drivers.forEach((d) => {
      const vals = (data ?? [])
        .map((s: any) => (s.drivers ?? s.valores ?? s)?.[d.valor])
        .filter((v: any) => !isNil(v))
        .map(n);
      if (vals.length) mapa[d.valor] = { min: Math.min(...vals), max: Math.max(...vals) };
    });
    return mapa;
  }, [data, opcoes.drivers]);

  const corCelula = (chave: string, valor: any) => {
    const d = opcoes.drivers.find((x) => x.valor === chave);
    const sentido = n(d?.sentido);
    if (!sentido || isNil(valor)) return "";
    const ex = extremos[chave];
    if (!ex || ex.max === ex.min) return "";
    const alvoBom = sentido > 0 ? ex.max : ex.min;
    const alvoRuim = sentido > 0 ? ex.min : ex.max;
    if (n(valor) === alvoBom) return "text-emerald-600 font-medium";
    if (n(valor) === alvoRuim) return "text-red-600 font-medium";
    return "";
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error) return <Card className="p-6 text-sm text-destructive">Não deu para carregar: {(error as Error).message}</Card>;
  if (!dados.length) {
    return <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">Ainda não há semanas para mostrar.</Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Driver</span>
        <Select value={driver} onValueChange={setDriver}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {opcoes.drivers.map((d) => <SelectItem key={d.valor} value={d.valor}>{d.rotulo}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="p-4">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="rotulo"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string, i: number) => (dados[i]?.temAcoes ? `${v} *` : v)}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <ReTooltip
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="rounded-md border bg-background p-2 text-xs shadow-sm space-y-1">
                    <div className="font-medium">{p.rotulo}{p.parcial ? " (parcial)" : ""}</div>
                    <div>{meta?.rotulo}: {valorPorUnidade(p.valor, meta?.unidade)}</div>
                    <div>Receita faturada: {brl(p.receita)}</div>
                    {p.acoes_titulos.length > 0 && (
                      <div className="pt-1 border-t">
                        {p.acoes_titulos.map((t: string, i: number) => <div key={i}>{t}</div>)}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="right" dataKey="receita" name="Receita faturada" fill="hsl(var(--muted-foreground))" opacity={0.2} />
            <Line yAxisId="left" type="monotone" dataKey="valorFirme" name={meta?.rotulo ?? "Driver"} stroke="hsl(var(--primary))" strokeWidth={2} connectNulls dot={{ r: 3 }} />
            <Line yAxisId="left" type="monotone" dataKey="valorParcial" name="Semana parcial" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 5" connectNulls dot={false} legendType="none" />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-[11px] text-muted-foreground mt-2">
          O asterisco no eixo marca semanas com ações registradas.
        </p>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semana</TableHead>
              {opcoes.drivers.map((d) => (
                <TableHead key={d.valor} className="text-right whitespace-nowrap">{d.rotulo}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.map((s) => (
              <TableRow key={s.semana}>
                <TableCell className="text-xs whitespace-nowrap">
                  {s.rotulo}{s.parcial ? " (parcial)" : ""}
                </TableCell>
                {opcoes.drivers.map((d) => {
                  const v = s.bruto?.[d.valor];
                  return (
                    <TableCell key={d.valor} className={`text-right text-xs ${corCelula(d.valor, v)}`}>
                      {valorPorUnidade(v, d.unidade)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
