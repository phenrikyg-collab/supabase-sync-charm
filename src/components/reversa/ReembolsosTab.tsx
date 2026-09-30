import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PainelReembolso, ORDEM_STATUS, rotuloStatus, classeStatus, consultarReembolsos, CHAVE_REEMBOLSOS, HistoricoReembolso } from "./PainelReembolso";

const brl = (v: any) =>
  Number.isFinite(Number(v))
    ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";

function Vazio({ texto }: { texto: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{texto}</p>;
}

/* ────────────────────────── aba reembolsos ────────────────────────── */

const identificacaoReembolso = (r: any) =>
  r?.request_id != null && r.request_id !== ""
    ? `Solicitação ${r.request_id}`
    : r?.protocolo != null
      ? `Protocolo ${r.protocolo}`
      : "-";

export function ReembolsosTab({ aoAbrirSolicitacao }: { aoAbrirSolicitacao?: (id: string) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const alvoReembolso = searchParams.get("reembolso");
  const alvoSolicitacao = aoAbrirSolicitacao ? null : searchParams.get("solicitacao");
  const [aberto, setAberto] = useState<any | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string | null>(null);

  const q = useQuery({
    queryKey: CHAVE_REEMBOLSOS,
    queryFn: consultarReembolsos,
    retry: 1,
    staleTime: 15000,
  });

  const todos = q.data?.reembolsos ?? [];
  const reembolsos = filtroStatus ? todos.filter((r: any) => r?.status === filtroStatus) : todos;
  const resumo = (q.data?.resumo ?? {}) as Record<string, { qtd?: number; valor?: number }>;
  const pendentes = q.data?.pendentes ?? [];

  // Abre o painel do reembolso recém-preparado.
  useEffect(() => {
    if (!q.data || (!alvoReembolso && !alvoSolicitacao)) return;
    const achado = todos.find((r: any) =>
      alvoReembolso ? String(r?.id) === alvoReembolso : String(r?.solicitacao_id) === alvoSolicitacao,
    );
    if (achado) setAberto(achado);
    const prox = new URLSearchParams(searchParams);
    prox.delete("reembolso");
    prox.delete("solicitacao");
    setSearchParams(prox, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, alvoReembolso, alvoSolicitacao]);

  if (q.isPending) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  }
  if (q.isError) {
    return (
      <Card className="border-destructive">
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {(q.error as any)?.message ?? "Erro ao carregar os reembolsos."}
          </div>
          <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {ORDEM_STATUS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFiltroStatus((f) => (f === s ? null : s))}
            className={`rounded-md border p-3 text-left transition hover:border-primary/50 ${filtroStatus === s ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <p className="text-xs text-muted-foreground">{rotuloStatus(s)}</p>
            <p className="text-lg font-semibold tabular-nums">{Number(resumo[s]?.qtd ?? 0)}</p>
            <p className="text-xs tabular-nums text-muted-foreground">{brl(resumo[s]?.valor ?? 0)}</p>
          </button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reembolsos{filtroStatus ? ` · ${rotuloStatus(filtroStatus)}` : ""} <span className="text-sm font-normal text-muted-foreground">({reembolsos.length})</span></CardTitle>
        </CardHeader>
        <CardContent>
          {!reembolsos.length ? (
            <Vazio texto={filtroStatus ? "Nenhum reembolso neste status" : "Nenhum reembolso registrado"} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Identificação</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Rota</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reembolsos.map((r: any, i: number) => (
                    <TableRow key={String(r?.id ?? `r-${i}`)} className="cursor-pointer" onClick={() => setAberto(r)}>
                      <TableCell className="text-sm">{r?.cliente_nome ?? r?.cliente ?? "-"}</TableCell>
                      <TableCell className="text-xs">{r?.order_number ?? "-"}</TableCell>
                      <TableCell className="text-xs">{identificacaoReembolso(r)}</TableCell>
                      <TableCell className="text-right text-sm">{brl(r?.valor)}</TableCell>
                      <TableCell className="text-xs">{r?.rotulo_rota ?? r?.rota ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${classeStatus(r?.status)}`}>{rotuloStatus(r?.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r?.solicitacao_id ? (
                          aoAbrirSolicitacao ? (
                            <Button variant="link" size="sm" className="h-auto whitespace-nowrap p-0" onClick={(e) => {
                              e.stopPropagation();
                              setAberto(null);
                              aoAbrirSolicitacao(String(r.solicitacao_id));
                            }}>
                              Abrir solicitação
                            </Button>
                          ) : (
                            <Link
                              to={`/trocas-site?solicitacao=${encodeURIComponent(String(r.solicitacao_id))}`}
                              onClick={(e) => e.stopPropagation()}
                              className="whitespace-nowrap text-primary underline-offset-2 hover:underline"
                            >
                              Abrir solicitação
                            </Link>
                          )
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pendentes de reembolso <span className="text-sm font-normal text-muted-foreground">({pendentes.length})</span></CardTitle>
        </CardHeader>
        <CardContent>
          {!pendentes.length ? (
            <Vazio texto="Nenhum pedido esperando reembolso" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Estágio</TableHead>
                    <TableHead className="text-right">Valor solicitado</TableHead>
                    <TableHead>Forma original</TableHead>
                    <TableHead className="text-right">Dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentes.map((p: any, i: number) => (
                    <TableRow key={String(p?.request_id ?? `p-${i}`)}>
                      <TableCell className="text-sm">{p?.cliente ?? "-"}</TableCell>
                      <TableCell className="text-xs">{p?.order_number ?? "-"}</TableCell>
                      <TableCell className="text-xs">{p?.estagio ?? "-"}</TableCell>
                      <TableCell className="text-right text-sm">{brl(p?.valor_solicitado)}</TableCell>
                      <TableCell className="text-xs">{p?.forma_original ?? "-"}</TableCell>
                      <TableCell className="text-right text-xs">{p?.dias ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {aberto && (
            <>
              <SheetHeader>
                <SheetTitle>{identificacaoReembolso(aberto)}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2 text-sm">
                <p><span className="text-muted-foreground">Cliente:</span> {aberto.cliente_nome ?? "-"}</p>
                <p><span className="text-muted-foreground">E-mail:</span> {aberto.cliente_email ?? "-"}</p>
                <p><span className="text-muted-foreground">Pedido:</span> {aberto.order_number ?? "-"}</p>
                <p><span className="text-muted-foreground">Status:</span> {rotuloStatus(aberto.status)}</p>
                <p><span className="text-muted-foreground">Rota:</span> {aberto.rotulo_rota ?? aberto.rota ?? "-"}</p>
                <p><span className="text-muted-foreground">Forma original:</span> {aberto.rotulo_forma ?? aberto.forma_original ?? "-"}</p>
                <p><span className="text-muted-foreground">Valor:</span> {brl(aberto.valor)} <span className="text-xs text-muted-foreground">(máximo {brl(aberto.valor_maximo)})</span></p>
                <p className="text-xs text-muted-foreground">Itens {brl(aberto.valor_itens)} · frete {brl(aberto.valor_frete)}</p>
                <p><span className="text-muted-foreground">Chave Pix:</span> {aberto.chave_pix ?? "-"}{aberto.tipo_chave ? ` (${aberto.tipo_chave})` : ""}</p>
                {Array.isArray(aberto.alerta_pix_anterior) && aberto.alerta_pix_anterior.length > 0 && (
                  <p className="text-destructive">Atenção: chave Pix já usada em outro reembolso.</p>
                )}
                <PainelReembolso
                  reembolso={aberto}
                  operador={q.data?.operador}
                  config={q.data?.config}
                  aoAtualizar={setAberto}
                />
                <HistoricoReembolso historico={aberto.historico} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

