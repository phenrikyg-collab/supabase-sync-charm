import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, dataBr } from "@/lib/financeiroFormat";
import { parseValorBR, formatValorBR } from "@/lib/rhMoeda";
import { useView, n, mesDe, rotuloMes, hojeISO, somaDias } from "@/lib/finViews";
import { cn } from "@/lib/utils";

const COLS: [string, string][] = [
  ["entradas_vendas", "Entradas vendas"],
  ["entradas_outras", "Entradas outras"],
  ["saidas_operacionais", "Saídas operacionais"],
  ["saidas_socios_emprestimos", "Sócios / empréstimos"],
  ["saidas_transf_invest_tributos", "Transf. / invest. / tributos"],
  ["geracao_caixa", "Geração de caixa"],
  ["saldo_final_inter", "Saldo final Inter"],
];

function diasNoMes(m: string) {
  const [a, mm] = m.split("-").map(Number);
  return new Date(a, mm, 0).getDate();
}

export default function FluxoCaixa() {
  const fq = useView("vw_fin_fluxo_caixa_mensal");
  const cq = useView("vw_fin_caixa_posicao");
  const pq = useView("vw_fin_contas_a_pagar");

  const meses = useMemo(() => [...(fq.data ?? [])].sort((a, b) => mesDe(a).localeCompare(mesDe(b))), [fq.data]);

  const mediaSemanal = useMemo(() => {
    const ult = meses.slice(-2);
    const dias = ult.reduce((s, m) => s + diasNoMes(mesDe(m)), 0);
    const tot = ult.reduce((s, m) => s + n(m.entradas_vendas), 0);
    return dias ? (tot / dias) * 7 : 0;
  }, [meses]);

  const [entradaTxt, setEntradaTxt] = useState("");
  useEffect(() => { if (!entradaTxt && mediaSemanal) setEntradaTxt(formatValorBR(mediaSemanal)); }, [mediaSemanal]); // eslint-disable-line react-hooks/exhaustive-deps
  const entrada = parseValorBR(entradaTxt) ?? 0;

  const saldoIni = n(cq.data?.[0]?.caixa_total);
  const hoje = hojeISO();
  const semanas = useMemo(() => {
    let saldo = saldoIni;
    return Array.from({ length: 8 }, (_, i) => {
      const ini = somaDias(hoje, i * 7);
      const fim = somaDias(hoje, i * 7 + 6);
      const saidas = (pq.data ?? [])
        .filter((c) => {
          const v = String(c.vencimento ?? "").slice(0, 10);
          return i === 0 ? v <= fim : v >= ini && v <= fim;
        })
        .reduce((s, c) => s + n(c.valor), 0);
      const inicial = saldo;
      saldo = saldo + entrada - saidas;
      return { i, ini, fim, inicial, saidas, final: saldo };
    });
  }, [pq.data, saldoIni, entrada, hoje]);

  if (fq.isLoading) return <div className="py-20 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Fluxo de Caixa</h1>
        <p className="text-sm text-muted-foreground mt-1">Realizado mensal e projeção das próximas 8 semanas</p>
      </div>
      {fq.error && <p className="text-sm text-destructive">{(fq.error as Error).message}</p>}

      <Card>
        <CardHeader><CardTitle className="text-base">Realizado mensal</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Linha</TableHead>
                {meses.map((m) => <TableHead key={mesDe(m)} className="text-right">{rotuloMes(mesDe(m))}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {COLS.map(([k, rot]) => (
                <TableRow key={k} className={k === "geracao_caixa" || k === "saldo_final_inter" ? "font-semibold bg-muted/40" : ""}>
                  <TableCell>{rot}</TableCell>
                  {meses.map((m) => (
                    <TableCell key={mesDe(m)} className={cn("text-right font-mono text-sm", n(m[k]) < 0 && "text-destructive")}>{brl(m[k])}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Projeção semanal</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Saldo inicial: {brl(saldoIni)} (caixa total). Vencidos entram na semana 1.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entradas por semana (R$)</Label>
            <Input className="w-[160px]" value={entradaTxt} onChange={(e) => setEntradaTxt(e.target.value)} />
            <p className="text-[10px] text-muted-foreground">Média dos 2 últimos meses: {brl(mediaSemanal)}</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Semana</TableHead><TableHead className="text-right">Saldo inicial</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead><TableHead className="text-right">Saldo projetado</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {semanas.map((s) => (
                <TableRow key={s.i} className={cn(s.final < 0 && "bg-destructive/10")}>
                  <TableCell>{s.i + 1} · {dataBr(s.ini)} a {dataBr(s.fim)}</TableCell>
                  <TableCell className="text-right font-mono">{brl(s.inicial)}</TableCell>
                  <TableCell className="text-right font-mono text-success">{brl(entrada)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{brl(s.saidas)}</TableCell>
                  <TableCell className={cn("text-right font-mono font-semibold", s.final < 0 && "text-destructive")}>{brl(s.final)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
