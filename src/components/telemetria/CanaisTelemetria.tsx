import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  CanalTelemetria, ehNaoAtribuido, fetchInsightsNaoAtribuido, fetchTelemetriaCanais,
  fmtBRL, fmtInt, fmtPct,
} from "@/lib/telemetria";

const FRASE_PAINEL_NAO_ATRIBUIDO =
  "São pedidos reais que a telemetria não consegue ligar a uma sessão. " +
  "O ticket médio deles é maior que o dos pedidos atribuídos, então não é ruído: " +
  "é venda que existe e cujo canal não sabemos.";

function PainelNaoAtribuido({ aberto, onOpenChange }: { aberto: boolean; onOpenChange: (v: boolean) => void }) {
  const { data } = useQuery({
    queryKey: ["insights-nao-atribuido", 30],
    queryFn: () => fetchInsightsNaoAtribuido(30),
    staleTime: 5 * 60_000,
    enabled: aberto,
  });
  const linhas = data ?? [];

  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Não atribuído</SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            {FRASE_PAINEL_NAO_ATRIBUIDO}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {linhas.map((l, i) => (
            <div key={`${l.situacao}-${i}`} className="rounded-lg border border-border p-4">
              <div className="font-semibold">{l.situacao}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-sm font-medium">
                <span>{fmtInt(l.pedidos)} pedidos</span>
                <span>{fmtBRL(l.receita)}</span>
                <span className="text-muted-foreground">ticket {fmtBRL(l.ticket_medio)}</span>
              </div>
              {l.explicacao && (
                <p className="mt-2 text-sm text-muted-foreground">{l.explicacao}</p>
              )}
            </div>
          ))}
          {!linhas.length && (
            <p className="py-6 text-center text-muted-foreground">Sem dados no período</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const COLUNAS: { key: keyof CanalTelemetria; label: string; align?: "right" }[] = [
  { key: "canal", label: "Canal" },
  { key: "sessoes", label: "Sessões", align: "right" },
  { key: "add_carrinho", label: "Add. Carrinho", align: "right" },
  { key: "iniciaram_pagto", label: "Iniciaram Pagto", align: "right" },
  { key: "compras", label: "Compras", align: "right" },
  { key: "receita", label: "Receita", align: "right" },
  { key: "sessao_carrinho_pct", label: "Sessão→Carrinho", align: "right" },
  { key: "carrinho_checkout_pct", label: "Carrinho→Checkout", align: "right" },
  { key: "conv_final_pct", label: "Conv. Final", align: "right" },
  { key: "ticket_medio", label: "Ticket Médio", align: "right" },
  { key: "receita_por_sessao", label: "Receita por Sessão", align: "right" },
];

const TEXTO_NAO_ATRIBUIDO =
  "Pedidos que não conseguimos ligar a uma sessão. Compra por telefone, WhatsApp ou aparelho diferente do que navegou.";

export function CanaisTelemetria({ de, ate }: { de: string; ate: string }) {
  const [painelAberto, setPainelAberto] = useState(false);
  const { data } = useQuery({
    queryKey: ["telemetria-canais", de, ate],
    queryFn: () => fetchTelemetriaCanais(de, ate),
    staleTime: 5 * 60_000,
  });
  const linhas = useMemo(() => data ?? [], [data]);

  const [sortCol, setSortCol] = useState<keyof CanalTelemetria>("compras");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggle = (col: keyof CanalTelemetria) => {
    if (sortCol === col) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const ordenadas = useMemo(() => {
    const arr = [...linhas];
    arr.sort((a, b) => {
      const av = a[sortCol]; const bv = b[sortCol];
      if (typeof av === "string" || typeof bv === "string") {
        return sortDir === "desc"
          ? String(bv ?? "").localeCompare(String(av ?? ""))
          : String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return sortDir === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
    });
    return arr;
  }, [linhas, sortCol, sortDir]);

  const medias = useMemo(() => {
    const v = linhas.filter((l) => !ehNaoAtribuido(l.canal));
    if (!v.length) return { sc: 0, cc: 0, final: 0 };
    return {
      sc: v.reduce((s, x) => s + x.sessao_carrinho_pct, 0) / v.length,
      cc: v.reduce((s, x) => s + x.carrinho_checkout_pct, 0) / v.length,
      final: v.reduce((s, x) => s + x.conv_final_pct, 0) / v.length,
    };
  }, [linhas]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Performance por canal - Mariana Cardoso</CardTitle>
        <p className="text-xs text-muted-foreground">
          Médias — Sessão→Carrinho: <span className="font-medium">{fmtPct(medias.sc)}</span> · Carrinho→Checkout:{" "}
          <span className="font-medium">{fmtPct(medias.cc)}</span> · Conv. Final:{" "}
          <span className="font-medium">{fmtPct(medias.final)}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Receita por sessão é a melhor métrica para comparar canais.
        </p>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                {COLUNAS.map((c) => (
                  <TableHead
                    key={String(c.key)}
                    className={`${c.align === "right" ? "text-right" : ""} cursor-pointer select-none hover:text-foreground`}
                    onClick={() => toggle(c.key)}
                  >
                    {c.label}{sortCol === c.key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenadas.map((r) => {
                const naoAtribuido = ehNaoAtribuido(r.canal);
                const celulas = (
                  <>
                    <TableCell className="font-medium">{r.canal}</TableCell>
                    <TableCell className="text-right">{fmtInt(r.sessoes)}</TableCell>
                    <TableCell className="text-right">{fmtInt(r.add_carrinho)}</TableCell>
                    <TableCell className="text-right">{fmtInt(r.iniciaram_pagto)}</TableCell>
                    <TableCell className="text-right">{fmtInt(r.compras)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(r.receita)}</TableCell>
                    <TableCell className={`text-right ${!naoAtribuido && r.sessao_carrinho_pct > medias.sc ? "font-medium text-success" : ""}`}>
                      {naoAtribuido ? "-" : fmtPct(r.sessao_carrinho_pct)}
                    </TableCell>
                    <TableCell className={`text-right ${!naoAtribuido && r.carrinho_checkout_pct > medias.cc ? "font-medium text-success" : ""}`}>
                      {naoAtribuido ? "-" : fmtPct(r.carrinho_checkout_pct)}
                    </TableCell>
                    <TableCell className={`text-right ${!naoAtribuido && r.conv_final_pct > medias.final ? "font-medium text-success" : ""}`}>
                      {naoAtribuido ? "-" : fmtPct(r.conv_final_pct)}
                    </TableCell>
                    <TableCell className="text-right">{fmtBRL(r.ticket_medio)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {naoAtribuido ? "-" : fmtBRL(r.receita_por_sessao)}
                    </TableCell>
                  </>
                );
                if (!naoAtribuido) return <TableRow key={r.canal}>{celulas}</TableRow>;
                return (
                  <Tooltip key={r.canal}>
                    <TooltipTrigger asChild>
                      <TableRow
                        className="bg-muted/60 cursor-pointer hover:bg-muted"
                        onClick={() => setPainelAberto(true)}
                      >
                        {celulas}
                      </TableRow>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{TEXTO_NAO_ATRIBUIDO}</TooltipContent>
                  </Tooltip>
                );
              })}
              {!ordenadas.length && (
                <TableRow>
                  <TableCell colSpan={COLUNAS.length} className="text-center text-muted-foreground">
                    Sem dados no período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TooltipProvider>
        <PainelNaoAtribuido aberto={painelAberto} onOpenChange={setPainelAberto} />
      </CardContent>
    </Card>
  );
}
