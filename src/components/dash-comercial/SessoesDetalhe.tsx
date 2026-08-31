import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ddmm, fmtNum, fmtPct } from "@/lib/dashComercial";
import type { LinhaSessaoDia } from "@/lib/sessoesComposta";
import { cn } from "@/lib/utils";

export function SessoesDetalhe({ serie }: { serie: LinhaSessaoDia[] }) {
  const dados = serie.map((l) => ({ ...l, label: ddmm(l.dia) }));
  const ultimos7 = [...serie].slice(-7).reverse();

  return (
    <div className="space-y-5">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <RechartsTooltip formatter={(v: any) => fmtNum(Number(v))} />
            <Legend />
            <Bar dataKey="meta_lpv" name="Meta LPV" fill="hsl(var(--muted-foreground))" opacity={0.25} />
            <Line type="monotone" dataKey="ga4" name="GA4" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="rastreio" name="Rastreio próprio" stroke="hsl(var(--pos))" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">GA4</TableHead>
            <TableHead className="text-right">Rastreio</TableHead>
            <TableHead className="text-right">Razão</TableHead>
            <TableHead>Fonte usada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ultimos7.map((l) => (
            <TableRow key={l.dia}>
              <TableCell>{ddmm(l.dia)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtNum(l.ga4)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtNum(l.rastreio)}</TableCell>
              <TableCell className={cn("text-right tabular-nums font-medium",
                l.integra === null ? "text-muted-foreground" : l.integra ? "text-pos" : "text-neg")}>
                {l.razao === null ? "—" : fmtPct(l.razao, 1)}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5">
                  {l.fallback && <span className="h-2 w-2 rounded-full bg-warn" aria-label="fallback de fonte" />}
                  {l.fonte_usada === "ga4" ? "GA4" : "Rastreio próprio"}
                </span>
              </TableCell>
            </TableRow>
          ))}
          {ultimos7.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Sem dados no período.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <p className="text-xs text-muted-foreground">
        GA4 é a série oficial até 17/08; rastreamento próprio de 18/08 em diante. As duas fontes convergem em ±10% em
        dias estáveis.
      </p>
    </div>
  );
}
