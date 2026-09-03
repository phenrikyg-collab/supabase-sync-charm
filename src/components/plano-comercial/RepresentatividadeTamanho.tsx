import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { brl, dataBR, num, pct, pick } from "@/lib/coortes";

const PERIODOS = [30, 60, 90, 180, 365];

const CORES = [
  "bg-sky-500",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-slate-500",
];

const n = (v: unknown) => Number(v ?? 0);

export default function RepresentatividadeTamanho() {
  const [dias, setDias] = useState(90);
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase.rpc("representatividade_tamanho", {
      p_dias: dias,
      p_classes_abc: ["A"],
    } as any);
    if (error) {
      setErro(error.message || "Falha ao carregar a representatividade por tamanho");
      setDados(null);
    } else {
      setDados(data ?? null);
    }
    setLoading(false);
  }, [dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totais = dados?.totais ?? null;
  const lista: any[] = Array.isArray(dados?.por_tamanho_lista)
    ? dados.por_tamanho_lista
    : Array.isArray(dados?.por_tamanho)
      ? dados.por_tamanho
      : [];
  const periodo = dados?.periodo ?? null;
  const anterior = dados?.periodo_anterior ?? null;

  const maiorPct = Math.max(0, ...lista.map((l) => n(pick(l, "pct_receita"))));
  const alertas = lista.filter((l) => n(pick(l, "variacao_pp")) < -3);

  const Variacao = ({ v, sufixo }: { v: unknown; sufixo: string }) => {
    if (v == null) return <>—</>;
    const val = n(v);
    const pos = val > 0;
    return (
      <span
        className={cn(
          "inline-flex items-center justify-end gap-1 font-medium",
          val === 0
            ? "text-muted-foreground"
            : pos
              ? "text-emerald-600"
              : "text-destructive",
        )}
      >
        {val !== 0 &&
          (pos ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        {num(val, 1)}
        {sufixo}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Representatividade de faturamento por tamanho
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {PERIODOS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={d === dias ? "default" : "outline"}
              className="h-7 px-3 text-xs"
              onClick={() => setDias(d)}
            >
              {d} dias
            </Button>
          ))}
        </div>
        {periodo && (
          <p className="text-xs text-muted-foreground">
            {dataBR(pick(periodo, "de"))} a {dataBR(pick(periodo, "ate"))}, comparado com{" "}
            {dataBR(pick(anterior, "de"))} a {dataBR(pick(anterior, "ate"))}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        )}

        {erro && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {!loading && !erro && (
          <>
            {totais && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Receita
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {brl(pick(totais, "receita"))}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Unidades
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {num(pick(totais, "unidades"))}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Ticket médio por peça
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {brl(pick(totais, "ticket_medio_peca"), 2)}
                  </p>
                </div>
              </div>
            )}

            {!lista.length && (
              <p className="text-sm text-muted-foreground">
                Sem dados de tamanho no período.
              </p>
            )}

            {!!lista.length && (
              <>
                <div className="flex h-8 w-full overflow-hidden rounded-md">
                  {lista.map((l, i) => {
                    const p = n(pick(l, "pct_receita"));
                    if (p <= 0) return null;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center justify-center overflow-hidden whitespace-nowrap text-[11px] font-medium text-white",
                          CORES[i % CORES.length],
                        )}
                        style={{ width: `${p}%` }}
                        title={`${pick(l, "tamanho")} ${pct(p)}`}
                      >
                        {p >= 6 ? `${pick(l, "tamanho")} ${pct(p)}` : ""}
                      </div>
                    );
                  })}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tamanho</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">% receita</TableHead>
                      <TableHead className="text-right">% unidades</TableHead>
                      <TableHead className="text-right">Preço médio</TableHead>
                      <TableHead className="text-right">Var. p.p.</TableHead>
                      <TableHead className="text-right">Var. receita %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lista.map((l, i) => {
                      const destaque =
                        maiorPct > 0 && n(pick(l, "pct_receita")) === maiorPct;
                      return (
                        <TableRow key={i} className={cn(destaque && "bg-muted/60")}>
                          <TableCell className="font-medium">
                            {String(pick(l, "tamanho") ?? "—")}
                          </TableCell>
                          <TableCell className="text-right">
                            {brl(pick(l, "receita"))}
                          </TableCell>
                          <TableCell className="text-right">
                            {pct(pick(l, "pct_receita"))}
                          </TableCell>
                          <TableCell className="text-right">
                            {pct(pick(l, "pct_unidades"))}
                          </TableCell>
                          <TableCell className="text-right">
                            {brl(pick(l, "preco_medio"), 2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Variacao v={pick(l, "variacao_pp")} sufixo=" p.p." />
                          </TableCell>
                          <TableCell className="text-right">
                            <Variacao v={pick(l, "variacao_receita_pct")} sufixo="%" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}

            {alertas.map((l, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {String(pick(l, "tamanho"))} perdeu{" "}
                  {num(Math.abs(n(pick(l, "variacao_pp"))), 1)} pontos de participação no
                  período. Conferir se é demanda ou falta de grade.
                </span>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
