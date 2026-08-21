import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowUp, Loader2, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { brl, dec, ddmm, int, num, pct } from "@/lib/gestaoFormat";
import { cn } from "@/lib/utils";

function Seta({ v }: { v: number | null }) {
  if (v === null || !Number.isFinite(v)) return <span className="text-xs text-muted-foreground">—</span>;
  const Icon = v > 0 ? ArrowUp : v < 0 ? ArrowDown : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium",
      v === 0 ? "text-muted-foreground" : v > 0 ? "text-emerald-600" : "text-red-600")}>
      <Icon className="h-3 w-3" />{dec(Math.abs(v), 1)}%
    </span>
  );
}

export default function CanaisSessoes() {
  const [dias, setDias] = useState("28");

  const { data: canais = [], isLoading } = useQuery({
    queryKey: ["gestao-canais", dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("canais_desempenho" as any, { p_dias: Number(dias) });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as any[];
    },
  });

  const { data: sessoes = [] } = useQuery({
    queryKey: ["gestao-sessoes-comparativo"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sessoes_comparativo_diario" as any, { p_dias: 14 });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as any[];
    },
  });

  const linhas = useMemo(
    () => canais.filter((c: any) => num(c.sessoes) >= 50).sort((a: any, b: any) => num(b.receita) - num(a.receita)),
    [canais],
  );

  const serie = useMemo(
    () => [...sessoes]
      .sort((a: any, b: any) => String(a.data).localeCompare(String(b.data)))
      .map((r: any) => ({
        ...r,
        label: ddmm(r.data),
        sessoes_ga4: num(r.sessoes_ga4),
        sessoes_rastreio: num(r.sessoes_rastreio),
        sessoes_meta_lpv: num(r.sessoes_meta_lpv),
      })),
    [sessoes],
  );

  const ultimo = serie.length ? serie[serie.length - 1] : null;
  const razao = ultimo ? num(ultimo.razao_rastreio_ga4_pct) : null;
  const razaoOk = razao !== null && razao >= 85 && razao <= 115;

  return (
    <div className="space-y-6">
      {/* Bloco A */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Desempenho por canal</h2>
        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="14">14 dias</SelectItem>
            <SelectItem value="28">28 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Sessões</TableHead>
                  <TableHead className="text-right">Taxa de conversão</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Compras</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((c: any, i: number) => {
                  const rv = num(c.receita_var_pct);
                  return (
                    <TableRow key={i} className={cn(rv < -25 ? "bg-red-500/10" : rv > 25 ? "bg-emerald-500/10" : "")}>
                      <TableCell className="font-medium">{c.canal ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {int(c.sessoes)} <Seta v={num(c.sessoes_var_pct)} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {pct(c.taxa_conversao, 2)}
                        <span className="text-xs text-muted-foreground ml-1">
                          (antes {pct(c.taxa_conversao_ant, 2)})
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {brl(c.receita)} <Seta v={rv} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{int(c.compras)}</TableCell>
                    </TableRow>
                  );
                })}
                {linhas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum canal com 50+ sessões no período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Fonte: GA4 via BigQuery, atribuição por sessão · Compras e receita são atribuição GA4 — não somam com a
            receita da Tray.
          </p>
        </CardContent>
      </Card>

      {/* Bloco B */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Saúde da coleta de sessões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => int(v)} />
                <Legend />
                <Bar dataKey="sessoes_meta_lpv" name="Meta LPV" fill="hsl(var(--muted-foreground))" opacity={0.25} />
                <Line type="monotone" dataKey="sessoes_ga4" name="GA4" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sessoes_rastreio" name="Rastreio" stroke="#22c55e" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={razaoOk ? "default" : "destructive"} className={razaoOk ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
              Razão rastreio/GA4: {razao === null ? "—" : pct(razao, 1)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Razão fora de 85–115% por 2+ dias = uma das coletas quebrou
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">GA4</TableHead>
                  <TableHead className="text-right">Rastreio</TableHead>
                  <TableHead className="text-right">Meta LPV</TableHead>
                  <TableHead className="text-right">Razão</TableHead>
                  <TableHead>Fonte oficial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...serie].reverse().map((r: any, i: number) => {
                  const rr = num(r.razao_rastreio_ga4_pct);
                  const ok = rr >= 85 && rr <= 115;
                  return (
                    <TableRow key={i}>
                      <TableCell>{r.label}</TableCell>
                      <TableCell className="text-right">{int(r.sessoes_ga4)}</TableCell>
                      <TableCell className="text-right">{int(r.sessoes_rastreio)}</TableCell>
                      <TableCell className="text-right">{int(r.sessoes_meta_lpv)}</TableCell>
                      <TableCell className={cn("text-right font-medium", ok ? "text-emerald-600" : "text-red-600")}>
                        {pct(rr, 1)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.fonte_oficial ?? "—"}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
