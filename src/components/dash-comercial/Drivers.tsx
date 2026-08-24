import { useMemo, useState } from "react";
import { AlertTriangle, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/dashComercial";

export type UnidadeDriver = "brl" | "pct" | "num";

export interface DriverLinha {
  id: string;
  nome: string;
  unidade: UnidadeDriver;
  meta: number | null;
  realizado: number | null;
  /** true quando quanto menor, melhor (ex.: CPS) */
  inverso?: boolean;
  /** impacto em R$ da diferença vs meta (negativo = perda) */
  impacto: number | null;
  semDado?: boolean;
  nota?: string;
}

export function formatarValor(v: number | null, u: UnidadeDriver) {
  if (v === null || !Number.isFinite(v)) return "—";
  if (u === "brl") return fmtBRL(v);
  if (u === "pct") return fmtPct(v, 2);
  return fmtNum(v);
}

export function deltaPctDriver(l: DriverLinha): number | null {
  if (l.meta === null || l.realizado === null || l.meta === 0) return null;
  const d = ((l.realizado - l.meta) / Math.abs(l.meta)) * 100;
  return l.inverso ? -d : d;
}

export function statusDriver(l: DriverLinha): { chave: "alvo" | "atencao" | "gargalo" | "sem"; label: string; cls: string } {
  if (l.semDado || l.meta === null || l.realizado === null) {
    return { chave: "sem", label: "sem lançamento", cls: "bg-muted text-muted-foreground border-border" };
  }
  const d = deltaPctDriver(l);
  if (d === null) return { chave: "sem", label: "sem meta", cls: "bg-muted text-muted-foreground border-border" };
  if (d >= -5) return { chave: "alvo", label: "🟢 no alvo", cls: "bg-pos/10 text-pos border-pos/30" };
  if (d >= -15) return { chave: "atencao", label: "🟡 atenção", cls: "bg-warn/10 text-warn border-warn/30" };
  return { chave: "gargalo", label: "🔴 gargalo", cls: "bg-neg/10 text-neg border-neg/30" };
}

export function PlacarDrivers({
  linhas,
  onAbrir,
  onLancarInvestimento,
}: {
  linhas: DriverLinha[];
  onAbrir: (id: string) => void;
  onLancarInvestimento: (driver: DriverLinha) => void;
}) {
  const gargalo1 = useMemo(() => {
    const negativos = linhas.filter((l) => l.impacto !== null && (l.impacto as number) < 0);
    if (!negativos.length) return null;
    return negativos.reduce((a, b) => ((a.impacto as number) <= (b.impacto as number) ? a : b)).id;
  }, [linhas]);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
          <div>
            <h2 className="font-serif text-xl font-bold">Placar dos 9 drivers</h2>
            <p className="text-xs text-muted-foreground">
              Meta de receita e ticket vêm de metas_financeiras · demais drivers de planejamento_drivers
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>🟢 ±5%</span><span>🟡 5–15% abaixo</span><span>🔴 &gt;15% abaixo</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-card">
              <TableRow>
                <TableHead className="min-w-[190px]">Driver</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Δ</TableHead>
                <TableHead className="text-right">Impacto R$</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => {
                const st = statusDriver(l);
                const d = deltaPctDriver(l);
                const semDado = st.chave === "sem";
                return (
                  <TableRow
                    key={l.id}
                    className={cn("cursor-pointer", semDado && "text-muted-foreground")}
                    onClick={() => !semDado && onAbrir(l.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        {l.nome}
                        {gargalo1 === l.id && (
                          <Badge className="border-0 bg-neg text-white">
                            <AlertTriangle className="mr-1 h-3 w-3" /> Gargalo nº 1
                          </Badge>
                        )}
                      </div>
                      {l.nota && <p className="text-[11px] text-muted-foreground">{l.nota}</p>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatarValor(l.meta, l.unidade)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatarValor(l.realizado, l.unidade)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", d === null ? "" : d >= 0 ? "text-pos" : "text-neg")}>
                      {d === null ? "—" : `${d >= 0 ? "+" : "−"}${fmtPct(Math.abs(d), 1)}`}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        l.impacto === null ? "" : l.impacto < 0 ? "font-semibold text-neg" : "text-pos",
                      )}
                    >
                      {l.impacto === null ? "—" : `${l.impacto < 0 ? "−" : "+"}${fmtBRL(Math.abs(l.impacto))}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("whitespace-nowrap", st.cls)}>{st.label}</Badge>
                        {semDado && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            onClick={(e) => { e.stopPropagation(); onLancarInvestimento(l); }}
                          >
                            <PlusCircle className="mr-1 h-3.5 w-3.5" /> Lançar investimento
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
