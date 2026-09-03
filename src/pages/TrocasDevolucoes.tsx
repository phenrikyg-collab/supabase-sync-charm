import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PecasEmRetorno from "@/components/trocas/PecasEmRetorno";
import AcoesSolicitacao, { AcoesDoPainel } from "@/components/trocas/AcoesSolicitacao";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, ExternalLink, PackageX, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip,
  XAxis, YAxis,
} from "recharts";

/* ────────────────────────── helpers ────────────────────────── */

const brl = (v: any) =>
  Number.isFinite(Number(v))
    ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString("pt-BR") : "0");
const pct = (v: any) =>
  Number.isFinite(Number(v)) ? `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—";
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const dataBR = (v: any) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("pt-BR");
};
const isoBR = (v: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : dataBR(v));
const isoHoje = () => new Date().toISOString().slice(0, 10);
const isoMenos = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
};

type Insight = { card?: string; severidade?: string; titulo?: string; texto?: string; acao?: string };

const sevCor = (s?: string) =>
  s === "alto" ? "bg-destructive" : s === "medio" ? "bg-amber-500" : "bg-emerald-600";

function PainelInsight({ insights, card, semTitulo }: { insights: Insight[]; card: string; semTitulo?: boolean }) {
  const lista = insights.filter((i) => i?.card === card);
  if (!lista.length) return null;
  return (
    <div className="mt-4 space-y-3">
      {lista.map((i, idx) => (
        <div key={idx} className="flex gap-3 rounded-md bg-muted/40 p-3">
          <div className={`w-1 shrink-0 rounded-full ${sevCor(i.severidade)}`} />
          <div className="space-y-1 text-sm">
            {i.titulo && !semTitulo && <p className="font-semibold">{i.titulo}</p>}
            {i.texto && <p className="text-muted-foreground">{i.texto}</p>}
            {i.acao && (
              <p className="rounded bg-background/70 px-2 py-1 text-xs">
                <span className="font-medium">O que fazer: </span>
                {i.acao}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Vazio({ texto = "Sem dados no período" }: { texto?: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{texto}</p>;
}

const ESTAGIO_CHIP: Record<string, string> = {
  aguardando_aprovacao: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  aguardando_postagem: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  em_transito: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  recebida: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  concluida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelada: "bg-muted text-muted-foreground",
};

/* ────────────────────────── página ────────────────────────── */

export default function TrocasDevolucoes() {
  const [chave, setChave] = useState<string | null>(null);
  const [inicio, setInicio] = useState(isoMenos(90));
  const [fim, setFim] = useState(isoHoje());

  const [estagio, setEstagio] = useState<string | null>(null);
  const [preferencia, setPreferencia] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [buscaDebounce, setBuscaDebounce] = useState("");
  const [ordem, setOrdem] = useState("prioridade");
  const [pagina, setPagina] = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounce(busca.trim()), 400);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => setPagina(0), [estagio, preferencia, buscaDebounce, ordem, inicio, fim]);

  /* períodos vindos da RPC */
  const periodos = useQuery({
    queryKey: ["trocas-periodos"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_trocas_periodos" as any);
      if (error) throw error;
      return (data ?? {}) as any;
    },
  });

  const atalhos: any[] = Array.isArray(periodos.data?.atalhos)
    ? periodos.data.atalhos
    : Array.isArray(periodos.data?.periodos?.atalhos)
      ? periodos.data.periodos.atalhos
      : [];
  const meses: any[] = Array.isArray(periodos.data?.meses)
    ? periodos.data.meses
    : Array.isArray(periodos.data?.periodos?.meses)
      ? periodos.data.periodos.meses
      : [];
  const padrao: string | undefined = periodos.data?.padrao ?? periodos.data?.periodos?.padrao;

  const opcoes = useMemo(() => [...atalhos, ...meses], [atalhos, meses]);
  const selecionado = opcoes.find((o) => String(o.chave) === String(chave));

  useEffect(() => {
    if (chave || !opcoes.length) return;
    const p = opcoes.find((o) => String(o.chave) === String(padrao)) ?? opcoes[0];
    if (p) {
      setChave(String(p.chave));
      if (p.inicio) setInicio(p.inicio);
      if (p.fim) setFim(p.fim);
    }
  }, [opcoes, padrao, chave]);

  const aplicarPeriodo = (v: string) => {
    setChave(v);
    const p = opcoes.find((o) => String(o.chave) === v);
    if (p?.inicio) setInicio(p.inicio);
    if (p?.fim) setFim(p.fim);
  };


  const dash = useQuery({
    queryKey: ["trocas-dashboard", inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_trocas_dashboard" as any, {
        p_inicio: inicio,
        p_fim: fim,
      });
      if (error) throw error;
      return (data ?? {}) as any;
    },
  });

  const lista = useQuery({
    queryKey: ["trocas-solicitacoes", estagio, preferencia, inicio, fim, buscaDebounce, ordem, pagina],
    queryFn: async () => {
      const params: any = {
        p_estagio: estagio,
        p_inicio: inicio,
        p_fim: fim,
        p_busca: buscaDebounce || null,
        p_ordem: ordem,
        p_limit: LIMIT,
        p_offset: pagina * LIMIT,
      };
      if (preferencia) params.p_preferencia = preferencia;
      const { data, error } = await supabase.rpc("fn_trocas_solicitacoes" as any, params);
      if (error) throw error;
      return (data ?? {}) as any;
    },
  });

  const d = dash.data ?? {};
  const kpis = d.kpis ?? {};
  const insights: Insight[] = Array.isArray(d.insights) ? d.insights : [];
  const funil: any[] = Array.isArray(d.funil) ? d.funil : [];
  const linhas: any[] = Array.isArray(lista.data?.linhas) ? lista.data.linhas : [];
  const total = n(lista.data?.total);

  const deltaReversa = n(kpis.taxa_reversa) - n(kpis.taxa_reversa_anterior);
  const corExpiracao =
    n(kpis.taxa_expiracao) > 20 ? "text-destructive" : n(kpis.taxa_expiracao) > 12 ? "text-amber-600" : "";

  const serie = useMemo(
    () =>
      (Array.isArray(d.serie) ? d.serie : []).map((s: any) => ({
        ...s,
        rotulo: dataBR(s.semana ?? s.periodo ?? s.data),
      })),
    [d.serie],
  );

  const irParaFila = (est: string | null) => {
    setEstagio(est);
    setOrdem("prioridade");
    document.getElementById("lista-solicitacoes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ───────── loading / erro ───────── */
  if (dash.isError) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 p-6 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {(dash.error as any)?.message ?? "Erro ao carregar o painel de trocas."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 p-4 md:p-6">
        {/* topo */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Trocas &amp; Devoluções</h1>
            <p className="text-sm text-muted-foreground">
              {d.periodo ? `${dataBR(d.periodo.inicio)} a ${dataBR(d.periodo.fim)} · ${num(d.periodo.dias)} dias` : "Logística reversa"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Select value={chave ?? ""} onValueChange={aplicarPeriodo}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent className="max-h-80">
                {atalhos.map((a: any) => (
                  <SelectItem key={a.chave} value={String(a.chave)}>{a.rotulo}</SelectItem>
                ))}
                {atalhos.length > 0 && meses.length > 0 && <div className="my-1 h-px bg-border" />}
                {meses.map((m: any) => (
                  <SelectItem key={m.chave} value={String(m.chave)}>
                    {(m.rotulo ?? `${m.mes_nome} / ${m.ano}`)} ({num(m.qtd)}){m.parcial ? " · em andamento" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isoBR(inicio)} a {isoBR(fim)}
            </p>
            {selecionado?.parcial && (
              <p className="text-xs text-amber-600">Mês em andamento — os números ainda vão mudar até o fim do mês.</p>
            )}
          </div>
        </div>

        {dash.isLoading ? (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <>
            {/* FAIXA 1 — KPIs */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardContent className="space-y-1 p-4">
                  <p className="text-xs text-muted-foreground">Taxa de reversa</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold">{pct(kpis.taxa_reversa)}</p>
                    {Number.isFinite(Number(kpis.taxa_reversa_anterior)) && deltaReversa !== 0 && (
                      <span className={`flex items-center text-xs ${deltaReversa > 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {deltaReversa > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {pct(Math.abs(deltaReversa))}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {num(kpis.solicitacoes)} de {num(kpis.pedidos_periodo)} pedidos
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-4">
                  <p className="text-xs text-muted-foreground">Custo total da reversa</p>
                  <p className="text-2xl font-semibold">{brl(kpis.custo_total_reversa)}</p>
                  <p className="text-xs text-muted-foreground">
                    {brl(kpis.valor_devolvido_dinheiro)} devolvidos + {brl(kpis.frete_reverso)} de frete
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-4">
                  <p className="text-xs text-muted-foreground">Receita preservada em troca</p>
                  <p className="text-2xl font-semibold text-emerald-600">{brl(kpis.valor_preservado_troca)}</p>
                  <p className="text-xs text-muted-foreground">
                    {pct(kpis.pct_preferencia_vale)} das clientes preferem vale
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-4">
                  <p className="text-xs text-muted-foreground">Frete reverso por solicitação</p>
                  <p className="text-2xl font-semibold">{brl(kpis.frete_por_solicitacao)}</p>
                  <p className="text-xs text-muted-foreground">
                    loja pagou {num(n(kpis.solicitacoes) - n(kpis.clientes_pagaram_frete))} de {num(kpis.solicitacoes)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-4">
                  <p className="text-xs text-muted-foreground">Tempo médio de resolução</p>
                  <p className="text-2xl font-semibold">{num(kpis.dias_ciclo_medio)} dias</p>
                  <p className="text-xs text-muted-foreground">taxa de conclusão {pct(kpis.taxa_conclusao)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-4">
                  <p className="text-xs text-muted-foreground">Taxa de expiração</p>
                  <p className={`text-2xl font-semibold ${corExpiracao}`}>{pct(kpis.taxa_expiracao)}</p>
                  <p className="text-xs text-muted-foreground">{num(kpis.expiradas)} expiradas</p>
                </CardContent>
              </Card>
            </div>

            <PainelInsight insights={insights} card="taxa_reversa" />

            {/* FAIXA 2 — backlog */}
            {n(kpis.backlog_qtd) > 0 && (
              <Card className="border-amber-500 bg-amber-500/10">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold">
                      {num(kpis.backlog_qtd)} solicitações chegaram na loja e nunca foram encerradas
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {brl(kpis.backlog_valor)} represados · {num(kpis.backlog_parada_90d)} sem movimento há mais de 90 dias · a mais parada há {num(kpis.backlog_dias_max)} dias
                    </p>
                    <p className="text-xs text-muted-foreground">independente do período</p>
                    <PainelInsight insights={insights} card="backlog" semTitulo />
                  </div>
                  <Button onClick={() => irParaFila("recebida")}>Ver fila</Button>
                </CardContent>
              </Card>
            )}

            {/* FAIXA 3 — funil */}
            <Card>
              <CardHeader><CardTitle>Funil operacional</CardTitle></CardHeader>
              <CardContent>
                {funil.length === 0 ? <Vazio /> : (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {funil.map((f: any, i: number) => {
                      const est = String(f.estagio ?? "");
                      const cancelada = est === "cancelada";
                      const alerta = est === "recebida" && n(f.dias_medio) > 7;
                      return (
                        <button
                          key={i}
                          onClick={() => irParaFila(est || null)}
                          className={`min-w-[190px] flex-1 rounded-lg border p-3 text-left transition hover:shadow ${
                            cancelada ? "bg-muted/50 text-muted-foreground" : ""
                          } ${alerta ? "border-amber-500" : ""} ${estagio === est ? "ring-2 ring-primary" : ""}`}
                        >
                          <p className="text-xs">{f.rotulo ?? est}</p>
                          <p className="text-2xl font-semibold">{num(f.qtd)}</p>
                          <p className="text-sm">{brl(f.valor)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            média {num(f.dias_medio)}d · mais antiga {num(f.mais_antiga)}d
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
                <PainelInsight insights={insights} card="funil" />
              </CardContent>
            </Card>
          </>
        )}

        {/* FAIXA 4 — lista */}
        <Card id="lista-solicitacoes">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>
              Solicitações · {lista.data?.estagio_rotulo ?? (estagio ? estagio.replace(/_/g, " ") : "todas")}{" "}
              <span className="text-sm font-normal text-muted-foreground">({num(total)})</span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="w-72 pl-8"
                  placeholder="Buscar por pedido, cliente, e-mail, telefone, produto, SKU, cidade ou rastreio"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <Select value={preferencia ?? ""} onValueChange={(v) => setPreferencia(v || null)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Preferência" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="voucher">Vale-trocas</SelectItem>
                  <SelectItem value="refund">Reembolso</SelectItem>
                  <SelectItem value="product">Troca por peça</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ordem} onValueChange={setOrdem}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prioridade">Prioridade (mais antigas primeiro)</SelectItem>
                  <SelectItem value="recentes">Mais recentes</SelectItem>
                  <SelectItem value="valor">Maior valor</SelectItem>
                </SelectContent>
              </Select>
              {(estagio || preferencia) && (
                <Button variant="ghost" size="sm" onClick={() => { setEstagio(null); setPreferencia(null); }}>Limpar filtros</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {lista.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : lista.isError ? (
              <p className="py-6 text-center text-sm text-destructive">
                {(lista.error as any)?.message ?? "Erro ao carregar as solicitações."}
              </p>
            ) : linhas.length === 0 ? (
              <Vazio texto="Nenhuma solicitação encontrada" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Cliente</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Itens</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Preferência</TableHead>
                        <TableHead>Estágio</TableHead>
                        <TableHead className="text-right">Dias</TableHead>
                        <TableHead>Última etapa</TableHead>
                        <TableHead>Rastreio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.map((l: any, i: number) => (
                        <LinhaSolicitacao key={l.id ?? l.solicitacao_id ?? i} l={l} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Página {pagina + 1} de {Math.max(1, Math.ceil(total / LIMIT))}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(pagina + 1) * LIMIT >= total}
                      onClick={() => setPagina((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </>
            )}
            <PainelInsight insights={insights} card="fila" />
          </CardContent>
        </Card>

        {/* PEÇAS EM RETORNO */}
        <PecasEmRetorno inicio={inicio} fim={fim} />


        {/* FAIXA 5 — análise */}
        {!dash.isLoading && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* A) motivos */}
            <Card>
              <CardHeader><CardTitle>Motivos</CardTitle></CardHeader>
              <CardContent>
                {!(d.motivos?.length) ? <Vazio /> : (
                  <div className="space-y-4">
                    {["exchange", "refund"].map((area) => {
                      const itens = (d.motivos as any[]).filter((m) => m.area === area);
                      if (!itens.length) return null;
                      const maior = Math.max(...itens.map((m) => n(m.qtd)));
                      return (
                        <div key={area} className="space-y-2">
                          <p className="text-sm font-medium">{itens[0]?.area_rotulo ?? (area === "exchange" ? "Troca" : "Devolução")}</p>
                          {itens.map((m, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{m.motivo ?? "—"}</span>
                                <span className="text-muted-foreground">
                                  {num(m.qtd)} · {pct(m.pct)} · {brl(m.valor)}
                                </span>
                              </div>
                              <div className="h-2 rounded bg-muted">
                                <div
                                  className={`h-2 rounded ${area === "exchange" ? "bg-primary" : "bg-destructive"}`}
                                  style={{ width: `${maior ? (n(m.qtd) / maior) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
                <PainelInsight insights={insights} card="motivos" />
              </CardContent>
            </Card>

            {/* B) tamanhos */}
            <Card>
              <CardHeader><CardTitle>Tamanhos</CardTitle></CardHeader>
              <CardContent>
                {!(d.tamanhos?.length) ? <Vazio /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={d.tamanhos}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="tamanho" fontSize={12} />
                      <YAxis fontSize={12} />
                      <RTooltip />
                      <Legend />
                      <Bar dataKey="ficou_maior" name="ficou grande" stackId="a" fill="hsl(var(--primary))" />
                      <Bar dataKey="ficou_menor" name="ficou pequeno" stackId="a" fill="hsl(var(--destructive))" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <PainelInsight insights={insights} card="tamanhos" />
              </CardContent>
            </Card>

            {/* C) produtos */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Produtos mais devolvidos</CardTitle></CardHeader>
              <CardContent>
                {!(d.produtos?.length) ? <Vazio /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">
                            <UITooltip>
                              <TooltipTrigger className="underline decoration-dotted">Taxa</TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                reversas do período sobre vendas históricas totais do produto — serve para
                                comparar produtos entre si, não como taxa do período
                              </TooltipContent>
                            </UITooltip>
                          </TableHead>
                          <TableHead className="text-right">Vendas hist.</TableHead>
                          <TableHead>Motivo top</TableHead>
                          <TableHead>Tam. top</TableHead>
                          <TableHead>Cor top</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(d.produtos as any[]).map((p, i) => (
                          <TableRow
                            key={p.product_id ?? i}
                            className={p.link ? "cursor-pointer" : ""}
                            onClick={() => p.link && window.open(p.link, "_blank", "noopener")}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {p.imagem && (
                                  <img src={p.imagem} alt={p.produto ?? "produto"} loading="lazy" className="h-10 w-10 rounded object-cover" />
                                )}
                                <div>
                                  <p className="text-sm">{p.produto ?? "—"}</p>
                                  <div className="flex gap-1">
                                    {p.ativo === false && <Badge variant="secondary" className="text-[10px]">inativo</Badge>}
                                    {n(p.ficou_maior) > n(p.ficou_menor) && n(p.ficou_maior) > 0 && (
                                      <Badge variant="outline" className="text-[10px]">veste grande</Badge>
                                    )}
                                    {n(p.ficou_menor) > n(p.ficou_maior) && n(p.ficou_menor) > 0 && (
                                      <Badge variant="outline" className="text-[10px]">veste pequeno</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{num(p.qtd)}</TableCell>
                            <TableCell className="text-right">{pct(p.taxa_sobre_vendas)}</TableCell>
                            <TableCell className="text-right">{num(p.vendas_historicas)}</TableCell>
                            <TableCell className="text-xs">{p.motivo_top ?? "—"}</TableCell>
                            <TableCell className="text-xs">{p.tamanho_top ?? "—"}</TableCell>
                            <TableCell className="text-xs">{p.cor_top ?? "—"}</TableCell>
                            <TableCell className="text-right">{brl(p.valor)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <PainelInsight insights={insights} card="produtos" />
              </CardContent>
            </Card>

            {/* D) grade */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Grade — produto × tamanho</CardTitle></CardHeader>
              <CardContent>
                {!(d.grade?.length) ? <Vazio /> : (
                  <div className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Tamanho</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Ficou grande</TableHead>
                          <TableHead className="text-right">Ficou pequeno</TableHead>
                          <TableHead>Leitura</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(d.grade as any[]).map((g, i) => {
                          const maior = n(g.ficou_maior);
                          const menor = n(g.ficou_menor);
                          return (
                            <TableRow key={i}>
                              <TableCell className="text-sm">{g.produto ?? "—"}</TableCell>
                              <TableCell>{g.tamanho ?? "—"}</TableCell>
                              <TableCell className="text-right">{num(g.qtd)}</TableCell>
                              <TableCell className="text-right">{num(maior)}</TableCell>
                              <TableCell className="text-right">{num(menor)}</TableCell>
                              <TableCell>
                                {maior > menor && (
                                  <Badge className="bg-amber-500 text-xs hover:bg-amber-500">veste grande</Badge>
                                )}
                                {menor > maior && (
                                  <Badge className="bg-sky-600 text-xs hover:bg-sky-600">veste pequeno</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* E) logística */}
            <Card>
              <CardHeader><CardTitle>Logística</CardTitle></CardHeader>
              <CardContent>
                {!(d.logistica?.length) ? <Vazio /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Transportadora</TableHead>
                          <TableHead>Serviço</TableHead>
                          <TableHead>Postagem</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Frete médio</TableHead>
                          <TableHead className="text-right">Frete total</TableHead>
                          <TableHead className="text-right">Post./Entr.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(d.logistica as any[]).map((g, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{g.transportadora ?? "—"}</TableCell>
                            <TableCell className="text-xs">{g.servico ?? "—"}</TableCell>
                            <TableCell className="text-xs">{g.forma_postagem_rotulo ?? g.forma_postagem ?? "—"}</TableCell>
                            <TableCell className="text-right">{num(g.qtd)}</TableCell>
                            <TableCell className="text-right">{brl(g.frete_medio)}</TableCell>
                            <TableCell className="text-right">{brl(g.frete_total)}</TableCell>
                            <TableCell className="text-right">{num(g.postadas)}/{num(g.entregues)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <PainelInsight insights={insights} card="logistica" />
              </CardContent>
            </Card>

            {/* F) regiões */}
            <Card>
              <CardHeader><CardTitle>Regiões</CardTitle></CardHeader>
              <CardContent>
                {!(d.regioes?.length) ? <Vazio /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={d.regioes}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="uf" fontSize={12} />
                      <YAxis fontSize={12} />
                      <RTooltip
                        formatter={(v: any, k: any) => (k === "qtd" ? num(v) : brl(v))}
                      />
                      <Bar dataKey="qtd" name="Solicitações" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* G) pagamentos */}
            <Card>
              <CardHeader><CardTitle>Preferência × método pago</CardTitle></CardHeader>
              <CardContent>
                {!(d.pagamentos?.length) ? <Vazio /> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Preferência</TableHead>
                        <TableHead>Método pago</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(d.pagamentos as any[]).map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{p.preferencia_rotulo ?? p.preferencia ?? "—"}</TableCell>
                          <TableCell className="text-sm">{p.metodo_pago_rotulo ?? p.metodo_pago ?? "—"}</TableCell>
                          <TableCell className="text-right">{num(p.qtd)}</TableCell>
                          <TableCell className="text-right">{brl(p.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <PainelInsight insights={insights} card="pagamentos" />
              </CardContent>
            </Card>

            {/* I) reincidentes */}
            <Card>
              <CardHeader><CardTitle>Clientes reincidentes</CardTitle></CardHeader>
              <CardContent>
                {!(d.reincidentes?.length) ? <Vazio /> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Solicitações</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(d.reincidentes as any[]).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{r.cliente ?? r.nome ?? "—"}</TableCell>
                          <TableCell className="text-right">{num(r.qtd)}</TableCell>
                          <TableCell className="text-right">{brl(r.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* H) evolução */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Evolução semanal</CardTitle></CardHeader>
              <CardContent>
                {!serie.length ? <Vazio /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={serie}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="rotulo" fontSize={12} />
                      <YAxis fontSize={12} />
                      <RTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="qtd" name="Solicitações" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Encerramento por mês</CardTitle></CardHeader>
              <CardContent>
                {!(d.encerramento_mensal?.length) ? <Vazio /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={d.encerramento_mensal}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="mes" fontSize={12} />
                      <YAxis fontSize={12} />
                      <RTooltip />
                      <Legend />
                      <Bar dataKey="concluidas" name="Concluídas" stackId="a" fill="hsl(var(--primary))" />
                      <Bar dataKey="abertas" name="Abertas" stackId="a" fill="hsl(var(--destructive))" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <PainelInsight insights={insights} card="operacional" />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

/* ────────────────────────── linha da tabela ────────────────────────── */

function LinhaSolicitacao({ l }: { l: any }) {
  const [aberta, setAberta] = useState(false);
  const itens: any[] = Array.isArray(l.itens) ? l.itens : [];
  const timeline: any[] = Array.isArray(l.linha_do_tempo) ? l.linha_do_tempo : [];
  const ultimoMarco = timeline.length ? timeline[timeline.length - 1] : null;
  const est = String(l.estagio ?? "");
  const finalizada = est === "concluida" || est === "cancelada";
  const dias = n(l.dias_aberta ?? l.dias_em_aberto);
  const vencer = l.dias_para_vencer;
  const urgenciaDias = finalizada ? null : dias > 30 ? "alta" : dias > 15 ? "media" : null;
  const rastreio = l.rastreio ?? l.codigo_rastreio;

  return (
    <>
      <TableRow
        className={`cursor-pointer ${urgenciaDias === "alta" ? "bg-destructive/10" : urgenciaDias === "media" ? "bg-amber-500/10" : ""}`}
        onClick={() => setAberta((v) => !v)}
      >
        <TableCell>{aberta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
        <TableCell>
          <p className="text-sm font-medium">{l.cliente ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {[l.cidade, l.uf].filter(Boolean).join("/") || l.contato || "—"}
          </p>
        </TableCell>
        <TableCell className="text-xs">{l.pedido ?? l.numero_pedido ?? "—"}</TableCell>
        <TableCell>
          <div className="space-y-1">
            {itens.slice(0, 3).map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                {it.imagem && <img src={it.imagem} alt={it.produto ?? "item"} loading="lazy" className="h-8 w-8 rounded object-cover" />}
                <span className="text-xs">
                  {it.produto ?? "—"}
                  {it.cor ? ` · ${it.cor}` : ""}
                  {it.tamanho ? ` · ${it.tamanho}` : ""}
                </span>
                {n(it.estoque_variante) === 0 && it.estoque_variante !== undefined && it.estoque_variante !== null && (
                  <UITooltip>
                    <TooltipTrigger><PackageX className="h-3.5 w-3.5 text-destructive" /></TooltipTrigger>
                    <TooltipContent>sem estoque para reposição</TooltipContent>
                  </UITooltip>
                )}
              </div>
            ))}
            {itens.length > 3 && <p className="text-xs text-muted-foreground">+{itens.length - 3} itens</p>}
          </div>
        </TableCell>
        <TableCell className="text-xs">{l.motivo ?? itens[0]?.motivo ?? "—"}</TableCell>
        <TableCell className="text-right text-sm">{brl(l.valor ?? l.valor_total)}</TableCell>
        <TableCell>
          <Badge variant="outline" className="text-[10px]">
            {l.preferencia_rotulo ?? l.preferencia ?? "—"}
          </Badge>
        </TableCell>
        <TableCell>
          <span className={`rounded px-2 py-1 text-[11px] ${ESTAGIO_CHIP[est] ?? "bg-muted"}`}>
            {(l.estagio_rotulo ?? est.replace(/_/g, " ")) || "—"}
          </span>
        </TableCell>
        <TableCell className={`text-right text-sm ${dias > 30 ? "text-destructive font-semibold" : dias > 15 ? "text-amber-600" : ""}`}>
          {num(dias)}
          {Number.isFinite(Number(vencer)) && n(vencer) >= 0 && n(vencer) <= 3 && (
            <Badge variant="destructive" className="ml-2 text-[10px]">vence em {num(vencer)}d</Badge>
          )}
        </TableCell>
        <TableCell>
          {ultimoMarco ? (
            <div>
              <p className="text-xs">{ultimoMarco.para_descricao ?? ultimoMarco.para ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">há {num(l.parada_ha_dias)} dias</p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          {rastreio ? (
            <a
              href={`https://rastreamento.correios.com.br/app/index.php?objeto=${rastreio}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline"
            >
              {rastreio} <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {aberta && (
        <TableRow>
          <TableCell colSpan={11} className="bg-muted/30">
            <div className="grid gap-4 p-2 md:grid-cols-3">
              <div className="md:col-span-2 space-y-3">
                <p className="text-sm font-medium">Itens</p>
                {itens.length === 0 ? <Vazio texto="Sem itens" /> : itens.map((it, i) => (
                  <div key={i} className="flex gap-3">
                    {it.imagem && <img src={it.imagem} alt={it.produto ?? "item"} loading="lazy" className="h-16 w-16 rounded object-cover" />}
                    <div className="text-xs">
                      <p className="text-sm">
                        {it.link ? (
                          <a href={it.link} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            {it.produto ?? "—"}
                          </a>
                        ) : (it.produto ?? "—")}
                      </p>
                      <p className="text-muted-foreground">
                        {[it.sku, it.cor, it.tamanho].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="text-muted-foreground">Tipo: {it.tipo_rotulo ?? it.tipo ?? "—"}</p>
                      <p className="text-muted-foreground">Área: {it.motivo_area_rotulo ?? it.motivo_area ?? "—"}</p>
                      <p className="text-muted-foreground">Motivo: {it.motivo ?? "—"}</p>
                      <p className={n(it.estoque_variante) === 0 ? "text-destructive" : "text-muted-foreground"}>
                        Estoque da variação: {it.estoque_variante ?? "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-xs">
                <p className="text-sm font-medium">Logística</p>
                <p>Transportadora: {l.transportadora ?? "—"}</p>
                <p>Serviço: {l.servico ?? "—"}</p>
                <p>Forma de postagem: {l.forma_postagem_rotulo ?? l.forma_postagem ?? "—"}</p>
                <p>Método pago: {l.metodo_pago_rotulo ?? l.metodo_pago ?? "—"}</p>
                <p>Centro de retorno: {l.centro_retorno ?? "—"}</p>
                <p>Prazo: {l.prazo ? dataBR(l.prazo) : "—"}</p>
                {l.store_note && (
                  <div className="rounded bg-background p-2">
                    <p className="font-medium">Observação do pedido</p>
                    <p className="text-muted-foreground">{l.store_note}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 border-t pt-4">
              <AcoesSolicitacao linha={l} />
            </div>
            <div className="mt-4 border-t pt-4">
              <Tabs defaultValue="historico">
                <TabsList>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                  <TabsTrigger value="painel">Ações do painel</TabsTrigger>
                </TabsList>
                <TabsContent value="historico" className="pt-3">
                  {timeline.length > 0 ? (
                    <LinhaDoTempo timeline={timeline} paradaHaDias={l.parada_ha_dias} />
                  ) : (
                    <Vazio texto="Sem histórico" />
                  )}
                </TabsContent>
                <TabsContent value="painel" className="pt-3">
                  <AcoesDoPainel requestId={l.request_id ?? l.id} />
                </TabsContent>
              </Tabs>
            </div>

          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ──────────────────────── linha do tempo ──────────────────────── */

const dataHoraBR = (v: any) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? String(v)
    : `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

const fmtDiasParados = (v: any) => {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return null;
  const d = Number(v);
  const txt = d.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${txt} ${d === 1 ? "dia" : "dias"}`;
};

const RASTREIO_RE = /\b[A-Z]{2}\d{9}BR\b/g;

function MensagemTimeline({ texto }: { texto: string }) {
  const [expandida, setExpandida] = useState(false);
  const partes = texto.split(RASTREIO_RE);
  const codigos = texto.match(RASTREIO_RE) ?? [];
  return (
    <p className={`text-xs text-muted-foreground ${expandida ? "" : "line-clamp-2"}`}>
      {partes.map((p, i) => (
        <span key={i}>
          {p}
          {codigos[i] && (
            <a
              href={`https://rastreamento.correios.com.br/app/index.php?objeto=${codigos[i]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
              onClick={(e) => e.stopPropagation()}
            >
              {codigos[i]}
            </a>
          )}
        </span>
      ))}
      {texto.length > 120 && (
        <button
          type="button"
          className="ml-1 text-primary underline"
          onClick={(e) => { e.stopPropagation(); setExpandida((v) => !v); }}
        >
          {expandida ? "ver menos" : "ver mais"}
        </button>
      )}
    </p>
  );
}

function LinhaDoTempo({ timeline, paradaHaDias }: { timeline: any[]; paradaHaDias: any }) {
  const parada = n(paradaHaDias);
  const corParada = parada > 30 ? "text-destructive" : parada >= 7 ? "text-amber-600" : "text-muted-foreground";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Histórico · {timeline.length} {timeline.length === 1 ? "etapa" : "etapas"} · {num(paradaHaDias)} dias desde a última movimentação
        </p>
        <p className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-sky-500" /> equipe</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50" /> cliente / automação</span>
        </p>
      </div>
      <div className="space-y-0">
        {timeline.map((m: any, i: number) => {
          const ultima = m.ultima === true;
          const corCirculo = m.acao_humana_da_loja ? "border-sky-500" : "border-muted-foreground/50";
          const preenchido = m.acao_humana_da_loja ? "bg-sky-500" : "bg-muted-foreground/50";
          const diasAntes = fmtDiasParados(m.dias_desde_anterior);
          return (
            <div key={m.ordem ?? i} className="relative flex gap-3">
              {i < timeline.length - 1 && (
                <span className="absolute left-[7px] top-4 h-full w-px bg-border" />
              )}
              <span
                className={`z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${corCirculo} ${ultima ? preenchido : "bg-background"}`}
              />
              <div className="flex-1 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{m.para_descricao ?? m.para ?? "—"}</p>
                  <span className="text-xs text-muted-foreground">{dataHoraBR(m.em)}</span>
                  {ultima && <Badge className="text-[10px]">ATUAL</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.por ?? "—"}
                  {diasAntes ? ` · ${diasAntes}${i === 1 ? " após a etapa anterior" : ""}` : ""}
                </p>
                {ultima && (
                  <p className={`text-xs ${corParada}`}>parada há {num(paradaHaDias)} dias</p>
                )}
                {m.mensagem && <MensagemTimeline texto={String(m.mensagem)} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
