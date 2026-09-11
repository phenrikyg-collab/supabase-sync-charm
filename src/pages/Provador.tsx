import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Download, ExternalLink, Info,
  Loader2, MessageCircle, RefreshCw, Repeat, Search, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ProvadorInsight, baixarCsv, delta, fmtBRL, fmtDataBr, fmtDataCurta, fmtHora,
  fmtNum, fmtPct, fmtTelefone, fnProvadorDashboard, fnProvadorPeriodos, n0,
  primeiroNome, soDigitos, traco,
} from "@/lib/provador";

/* ------------------------------ auxiliares ------------------------------ */

const pick = (o: any, ...chaves: string[]) => {
  for (const c of chaves) {
    if (o && o[c] !== undefined && o[c] !== null) return o[c];
  }
  return null;
};

function Delta({ atual, anterior }: { atual: any; anterior: any }) {
  const d = delta(atual, anterior);
  if (d.novo || d.pct === null) {
    return <span className="text-xs text-muted-foreground">novo</span>;
  }
  const sobe = d.pct >= 0;
  const Icone = sobe ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", sobe ? "text-success" : "text-destructive")}>
      <Icone className="h-3 w-3" />
      {fmtPct(Math.abs(d.pct))}
    </span>
  );
}

function KpiCard({
  titulo, valor, subtitulo, delta: deltaNode, alerta, dica,
}: {
  titulo: string;
  valor: string;
  subtitulo: string;
  delta?: React.ReactNode;
  alerta?: boolean;
  dica?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <span>{titulo}</span>
          {dica && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px]">{dica}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <span className={cn("text-2xl font-semibold tabular-nums", alerta && "text-destructive")}>{valor}</span>
          {deltaNode}
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{subtitulo}</p>
      </CardContent>
    </Card>
  );
}

const CORES_INSIGHT: Record<string, string> = {
  alta: "border-destructive/40 bg-destructive/10 text-destructive",
  media: "border-warning/40 bg-warning/10 text-warning",
  info: "border-info/40 bg-info/10 text-info",
};

function ChipStatus({ status, extra }: { status: string; extra?: string }) {
  const mapa: Record<string, string> = {
    quente: "bg-destructive/15 text-destructive border-destructive/30",
    morna: "bg-warning/15 text-warning border-warning/30",
    fria: "bg-muted text-muted-foreground border-border",
    convertida: "bg-success/15 text-success border-success/30",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", mapa[status] ?? "bg-muted text-muted-foreground border-border")}>
      {status}{extra ? ` · ${extra}` : ""}
    </span>
  );
}

/* --------------------------------- página -------------------------------- */

export default function Provador() {
  const [periodo, setPeriodo] = useState<{ chave: string; inicio: string; fim: string } | null>(null);

  const periodos = useQuery({
    queryKey: ["provador-periodos"],
    queryFn: fnProvadorPeriodos,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (periodo || !periodos.data) return;
    const p = periodos.data;
    const padraoChave = p.padrao?.chave;
    const achado =
      [...(p.atalhos ?? []), ...(p.meses ?? [])].find((x) => x.chave === padraoChave) ??
      (p.padrao?.inicio ? { chave: padraoChave ?? "padrao", inicio: p.padrao.inicio, fim: p.padrao.fim } : null) ??
      p.atalhos?.[0] ??
      p.meses?.[0] ??
      null;
    if (achado) setPeriodo({ chave: achado.chave, inicio: achado.inicio, fim: achado.fim });
  }, [periodos.data, periodo]);

  const dash = useQuery({
    queryKey: ["provador-dashboard", periodo?.inicio, periodo?.fim],
    queryFn: () => fnProvadorDashboard(periodo!.inicio, periodo!.fim),
    enabled: !!periodo,
  });

  const d = dash.data;
  const kpis = d?.kpis ?? {};
  const anterior = d?.anterior ?? {};
  const custos = d?.custos ?? {};
  const janela = d?.janela_dias ?? periodos.data?.janela_dias ?? null;

  const insights = (d?.insights ?? []) as ProvadorInsight[];
  const funil = (d?.funil ?? []) as any[];
  const serie = (d?.serie ?? []) as any[];
  const tamanhos = (d?.tamanhos ?? []) as any[];
  const leads = (d?.leads ?? []) as any[];
  const pedidos = (d?.pedidos ?? []) as any[];
  const produtos = (d?.produtos ?? []) as any[];
  const trocas = (d?.trocas ?? []) as any[];

  /* faixa 6 — filtros de leads */
  const [filtroStatus, setFiltroStatus] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const leadsFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return leads
      .filter((l) => (filtroStatus ? String(l.status ?? "").toLowerCase() === filtroStatus : true))
      .filter((l) =>
        !t
          ? true
          : [l.nome, l.telefone, l.produto].some((v) => String(v ?? "").toLowerCase().includes(t)),
      )
      .slice()
      .sort((a, b) => String(b.criado_em ?? "").localeCompare(String(a.criado_em ?? "")));
  }, [leads, filtroStatus, busca]);

  const exportarLeads = () => {
    const hoje = new Date().toISOString().slice(0, 10);
    baixarCsv(`leads-provador-${hoje}.csv`, [
      ["Cliente", "Telefone", "Peça", "Tamanho", "Cintura", "Quadril", "Provas", "Criado em", "Dias", "Perfil", "Cliques comprar", "Status", "Pedido", "Valor"],
      ...leadsFiltrados.map((l) => [
        l.nome ?? "Sem nome", fmtTelefone(l.telefone), l.produto ?? "", l.tamanho ?? "",
        l.cintura ?? "", l.quadril ?? "", l.provas ?? 0, fmtDataBr(l.criado_em), l.dias ?? "",
        l.recorrente ? "recorrente" : "nova", l.cliques_comprar ?? 0, l.status ?? "",
        l.pedido ?? "", l.valor_pedido ?? "",
      ]),
    ]);
  };

  const carregando = periodos.isLoading || (dash.isLoading && !d);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Provador</h1>
          <p className="text-sm text-muted-foreground">
            Quem provou, quem comprou e quanto o provador ajudou a vender.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {d?.gerado_em && (
            <span className="text-xs text-muted-foreground">Atualizado às {fmtHora(d.gerado_em)}</span>
          )}
          <Button variant="outline" size="sm" onClick={() => dash.refetch()} disabled={dash.isFetching}>
            {dash.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Recarregar</span>
          </Button>
        </div>
      </div>

      {/* faixa 0 — período */}
      <div className="flex flex-wrap items-center gap-2">
        {(periodos.data?.atalhos ?? []).map((a) => (
          <Button
            key={a.chave}
            size="sm"
            variant={periodo?.chave === a.chave ? "default" : "outline"}
            onClick={() => setPeriodo({ chave: a.chave, inicio: a.inicio, fim: a.fim })}
          >
            {a.rotulo}
          </Button>
        ))}
        {(periodos.data?.meses ?? []).length > 0 && (
          <Select
            value={(periodos.data?.meses ?? []).some((m) => m.chave === periodo?.chave) ? periodo?.chave : ""}
            onValueChange={(v) => {
              const m = (periodos.data?.meses ?? []).find((x) => x.chave === v);
              if (m) setPeriodo({ chave: m.chave, inicio: m.inicio, fim: m.fim });
            }}
          >
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="Escolher mês" />
            </SelectTrigger>
            <SelectContent>
              {(periodos.data?.meses ?? []).map((m) => (
                <SelectItem key={m.chave} value={m.chave}>
                  {m.rotulo}{m.parcial ? " (parcial)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {janela !== null && (
          <span className="text-xs text-muted-foreground">
            Pedidos contam até {fmtNum(janela)} dias depois da prova.
          </span>
        )}
      </div>

      {carregando && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {dash.isError && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            Não foi possível carregar os dados do provador. Tente recarregar.
          </CardContent>
        </Card>
      )}

      {d && (
        <>
          {/* faixa 1 — insights */}
          {insights.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {insights.map((i, idx) => (
                <div key={idx} className={cn("rounded-lg border p-3", CORES_INSIGHT[i.severidade] ?? CORES_INSIGHT.info)}>
                  <p className="text-sm font-bold">{i.titulo}</p>
                  <p className="text-sm">{i.texto}</p>
                  {i.acao && <p className="mt-1 text-xs italic">{i.acao}</p>}
                </div>
              ))}
            </div>
          )}

          {/* faixa 2 — KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              titulo="Faturamento ajudado"
              valor={fmtBRL(kpis.faturamento_ajudado)}
              subtitulo={`${fmtBRL(kpis.faturamento_direto)} direto · ${fmtNum(kpis.pedidos_influenciados)} influenciados`}
              delta={<Delta atual={kpis.faturamento_ajudado} anterior={anterior.faturamento_ajudado} />}
            />
            <KpiCard
              titulo="Pedidos ajudados"
              valor={fmtNum(kpis.pedidos_ajudados)}
              subtitulo={`${fmtNum(kpis.pedidos_diretos)} com a peça provada · ticket ${fmtBRL(kpis.ticket_medio)}`}
              delta={<Delta atual={kpis.pedidos_ajudados} anterior={anterior.pedidos_ajudados} />}
            />
            <KpiCard
              titulo="Clientes que provaram"
              valor={fmtNum(kpis.clientes_unicas)}
              subtitulo={`${fmtNum(kpis.clientes_novas)} novas (${fmtPct(kpis.pct_novas)}) · ${fmtNum(kpis.clientes_recorrentes)} recorrentes`}
            />
            <KpiCard
              titulo="Conversão da prova"
              valor={fmtPct(kpis.taxa_conversao)}
              subtitulo={`${fmtNum(kpis.clientes_convertidas)} compraram · média ${fmtNum(kpis.dias_medio_ate_pedido)} dias`}
            />
            <KpiCard
              titulo="Provas geradas"
              valor={fmtNum(kpis.provas_concluidas)}
              subtitulo={`${fmtPct(kpis.taxa_sucesso)} de sucesso · ${fmtNum(kpis.provas_erro)} erros · ${fmtNum(kpis.tempo_medio_s)}s`}
              delta={<Delta atual={kpis.provas_concluidas} anterior={anterior.provas_concluidas} />}
              alerta={(n0(kpis.taxa_sucesso) ?? 100) < 80}
            />
            <KpiCard
              titulo="Custo por pedido"
              valor={n0(custos.custo_por_pedido_brl) === null ? traco : fmtBRL(custos.custo_por_pedido_brl)}
              subtitulo={`${fmtBRL(custos.custo_brl)} no período · ${fmtBRL(custos.custo_por_prova_brl)} por prova · retorno ${n0(custos.retorno_por_real) === null ? traco : `${fmtNum(custos.retorno_por_real)}x`}`}
              dica="Custo estimado por geração (fal.ai + conferência). Ajustável em provador.config_kpi."
            />
          </div>

          {/* faixa 3 — funil + uplift */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Do site à prova</CardTitle>
                <p className="text-xs text-muted-foreground">visitantes únicos no período</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {funil.length === 0 && <p className="text-sm text-muted-foreground">Sem dados no período.</p>}
                {funil.map((e, i) => {
                  const valor = n0(pick(e, "valor", "total", "qtd", "quantidade")) ?? 0;
                  const base = n0(pick(funil[0] ?? {}, "valor", "total", "qtd", "quantidade")) ?? 0;
                  const ant = i === 0 ? null : n0(pick(funil[i - 1], "valor", "total", "qtd", "quantidade"));
                  const larg = base > 0 ? Math.max((valor / base) * 100, 1) : 0;
                  const pctAnt = ant && ant > 0 ? (valor / ant) * 100 : null;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-baseline justify-between text-sm">
                        <span>{pick(e, "etapa", "rotulo", "nome") ?? `Etapa ${i + 1}`}</span>
                        <span className="tabular-nums">
                          {fmtNum(valor)}
                          {pctAnt !== null && (
                            <span className="ml-2 text-xs text-muted-foreground">{fmtPct(pctAnt)}</span>
                          )}
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded bg-muted">
                        <div className="h-2.5 rounded bg-primary" style={{ width: `${larg}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Quem usa o provador compra mais?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const com = d.uplift?.com_provador ?? {};
                  const sem = d.uplift?.sem_provador ?? {};
                  const maior = Math.max(n0(com.taxa) ?? 0, n0(sem.taxa) ?? 0, 1);
                  const barra = (rot: string, taxa: any, visitantes: any, cor: string) => (
                    <div className="flex-1 space-y-1">
                      <p className="text-xs text-muted-foreground">{rot}</p>
                      <div className="flex h-32 items-end">
                        <div
                          className={cn("w-full rounded-t", cor)}
                          style={{ height: `${Math.max(((n0(taxa) ?? 0) / maior) * 100, 3)}%` }}
                        />
                      </div>
                      <p className="text-sm font-semibold tabular-nums">{fmtPct(taxa)}</p>
                      <p className="text-xs text-muted-foreground">{fmtNum(visitantes)} visitantes</p>
                    </div>
                  );
                  return (
                    <>
                      <div className="flex items-end gap-6">
                        {barra("Abriu o provador", com.taxa, com.visitantes, "bg-primary")}
                        {barra("Só viu o produto", sem.taxa, sem.visitantes, "bg-muted-foreground/40")}
                        <div className="text-right">
                          <p className="text-4xl font-bold tabular-nums">
                            {n0(d.uplift?.multiplicador) === null ? traco : `${fmtNum(d.uplift?.multiplicador)}x`}
                          </p>
                        </div>
                      </div>
                      {(n0(com.visitantes) ?? 0) < 20 && (
                        <p className="flex items-center gap-1 text-xs text-warning">
                          <AlertTriangle className="h-3 w-3" /> amostra pequena
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Taxa de adicionar ao carrinho nos produtos com provador.
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* faixa 4 — série semanal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Semana a semana</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              {serie.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="semana" tickFormatter={(v) => fmtDataCurta(v)} fontSize={11} />
                    <YAxis yAxisId="q" fontSize={11} />
                    <YAxis yAxisId="r" orientation="right" fontSize={11} tickFormatter={(v) => fmtNum(v)} />
                    <RTooltip
                      formatter={(v: any, nome: any) =>
                        nome === "faturamento" ? fmtBRL(v) : fmtNum(v)
                      }
                      labelFormatter={(v) => fmtDataBr(v)}
                    />
                    <Legend />
                    <Bar yAxisId="q" dataKey="provas" name="provas" stackId="p" fill="hsl(var(--primary))" />
                    <Bar yAxisId="q" dataKey="erros" name="erros" stackId="p" fill="hsl(var(--destructive))" />
                    <Line yAxisId="q" dataKey="aberturas" name="aberturas" stroke="hsl(var(--info))" dot={false} />
                    <Line yAxisId="q" dataKey="pedidos" name="pedidos" stroke="hsl(var(--success))" dot={false} />
                    <Line yAxisId="r" dataKey="faturamento" name="faturamento" stroke="hsl(var(--warning))" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* faixa 5 — tamanhos */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Acerto do tamanho</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-4xl font-bold tabular-nums">{fmtPct(kpis.pct_tamanho_indicado)}</p>
                <p className="text-sm text-muted-foreground">
                  {fmtNum(kpis.comprou_tamanho_indicado)} compraram o tamanho indicado · {fmtNum(kpis.comprou_outro_tamanho)} escolheram outro
                </p>
                {(n0(kpis.erro_tamanho_provador) ?? 0) > 0 && (
                  <p className="text-sm text-destructive">
                    {fmtNum(kpis.erro_tamanho_provador)} troca(s) por tamanho em peça indicada pelo provador
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Troca em pedidos do provador {fmtPct(kpis.taxa_troca_ajudados)} · loja inteira {fmtPct(kpis.taxa_troca_geral)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tamanhos indicados</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tamanho</TableHead>
                      <TableHead className="text-right">Indicados</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                      <TableHead className="text-right">Comprou igual</TableHead>
                      <TableHead className="text-right">Comprou outro</TableHead>
                      <TableHead className="text-right">Trocas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tamanhos.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">Sem dados.</TableCell></TableRow>
                    )}
                    {tamanhos.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{t.tamanho ?? traco}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(t.indicados)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtPct(pick(t, "pct", "percentual"))}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(t.pedidos)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(pick(t, "comprou_igual", "comprou_tamanho_indicado"))}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(pick(t, "comprou_outro", "comprou_outro_tamanho"))}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(t.trocas)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* faixa 6 — leads */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Clientes que provaram</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por nome, telefone ou peça"
                      className="h-9 w-[260px] pl-8"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={exportarLeads}>
                    <Download className="mr-2 h-4 w-4" /> CSV
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  ["quente", "Quentes", kpis.leads_quentes, "text-destructive"],
                  ["morna", "Mornas", kpis.leads_mornas, "text-warning"],
                  ["fria", "Frias", kpis.leads_frias, "text-muted-foreground"],
                  ["convertida", "Convertidas", kpis.leads_convertidas, "text-success"],
                ] as const).map(([chave, rot, valor, cor]) => (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => setFiltroStatus(filtroStatus === chave ? null : chave)}
                    className={cn(
                      "rounded-lg border p-2 text-left transition-colors hover:bg-accent",
                      filtroStatus === chave && "border-primary bg-accent",
                    )}
                  >
                    <p className="text-xs text-muted-foreground">{rot}</p>
                    <p className={cn("text-xl font-semibold tabular-nums", cor)}>{fmtNum(valor)}</p>
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[520px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Peça</TableHead>
                      <TableHead>Prova</TableHead>
                      <TableHead>Quando</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Sinal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadsFiltrados.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-sm text-muted-foreground">Nenhuma cliente neste filtro.</TableCell></TableRow>
                    )}
                    {leadsFiltrados.map((l, i) => {
                      const tel = soDigitos(l.telefone);
                      const msg = `Oi ${primeiroNome(l.nome) || "tudo bem"}! Vi que você provou a ${l.produto ?? "peça"} no site. Seu tamanho é ${l.tamanho ?? traco}. Quer que eu separe uma pra você?`;
                      return (
                        <TableRow key={l.id ?? i}>
                          <TableCell>
                            <p className="font-medium">{l.nome || "Sem nome"}</p>
                            <p className="text-xs text-muted-foreground">{fmtTelefone(l.telefone)}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="text-sm">{l.produto ?? traco}</span>
                              {l.tamanho && <Badge variant="secondary">{l.tamanho}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              cintura {l.cintura ?? traco} · quadril {l.quadril ?? traco}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {l.foto_url ? (
                                <a href={l.foto_url} target="_blank" rel="noreferrer">
                                  <img src={l.foto_url} alt="Prova" className="h-10 w-10 rounded object-cover" loading="lazy" />
                                </a>
                              ) : (
                                <div className="h-10 w-10 rounded bg-muted" />
                              )}
                              <span className="text-xs text-muted-foreground">{fmtNum(l.provas)} provas</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <p>{fmtDataCurta(l.criado_em)}</p>
                            <p className="text-muted-foreground">{fmtNum(l.dias)} dias</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline">{l.recorrente ? "recorrente" : "nova"}</Badge>
                              {l.cadastro_tray && <UserCheck className="h-3.5 w-3.5 text-success" />}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {(n0(l.cliques_comprar) ?? 0) > 0 ? `clicou em comprar ${fmtNum(l.cliques_comprar)}x` : traco}
                          </TableCell>
                          <TableCell>
                            <ChipStatus
                              status={String(l.status ?? "fria")}
                              extra={String(l.status) === "convertida" ? `pedido ${l.pedido ?? traco} · ${fmtBRL(l.valor_pedido)}` : undefined}
                            />
                          </TableCell>
                          <TableCell>
                            {tel ? (
                              <Button asChild size="sm" variant="outline">
                                <a
                                  href={`https://wa.me/55${tel.replace(/^55/, "")}?text=${encodeURIComponent(msg)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
                                </a>
                              </Button>
                            ) : (
                              traco
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* faixa 7 — pedidos ajudados */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pedidos ajudados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[420px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead className="text-right">Dias após a prova</TableHead>
                      <TableHead>Troca</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-sm text-muted-foreground">
                          Nenhum pedido ajudado neste período ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {pedidos.map((p, i) => {
                      const ind = p.tamanho_indicado ?? null;
                      const comp = p.tamanho_comprado ?? null;
                      const igual = ind && comp && String(ind) === String(comp);
                      const motivos = trocas
                        .filter((t) => String(t.pedido ?? "") === String(p.pedido ?? "___"))
                        .map((t) => t.motivo)
                        .filter(Boolean);
                      return (
                        <TableRow key={p.pedido ?? i}>
                          <TableCell className="font-medium">{p.pedido ?? traco}</TableCell>
                          <TableCell>{fmtDataBr(pick(p, "data", "criado_em"))}</TableCell>
                          <TableCell>
                            <p className="text-sm">{p.cliente ?? p.nome ?? "Sem nome"}</p>
                            <p className="text-xs text-muted-foreground">{fmtTelefone(p.telefone)}</p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{fmtBRL(p.valor)}</TableCell>
                          <TableCell>
                            <Badge className={cn(String(p.tipo) === "direto" ? "bg-success/15 text-success" : "bg-info/15 text-info")} variant="outline">
                              {p.tipo ?? traco}
                            </Badge>
                          </TableCell>
                          <TableCell><Badge variant="outline">{p.recorrente ? "recorrente" : "nova"}</Badge></TableCell>
                          <TableCell className={cn("text-sm", igual ? "text-success" : ind && comp ? "text-warning" : "")}>
                            {ind || comp ? `${ind ?? traco} → ${comp ?? traco}` : traco}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(pick(p, "dias_apos_prova", "dias"))}</TableCell>
                          <TableCell>
                            {(n0(p.itens_em_troca) ?? 0) > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Repeat className="h-4 w-4 text-warning" />
                                  </TooltipTrigger>
                                  <TooltipContent>{motivos.length ? motivos.join(" · ") : "Item em troca"}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              traco
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* faixa 8 — produtos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Peças no provador</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peça</TableHead>
                    <TableHead className="text-right">Viram os botões</TableHead>
                    <TableHead className="text-right">Abriram</TableHead>
                    <TableHead className="text-right">Tamanhos</TableHead>
                    <TableHead className="text-right">Provas</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                    <TableHead className="text-right">Pedidos diretos</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Trocas</TableHead>
                    <TableHead className="text-right">Prova → pedido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtos.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-sm text-muted-foreground">Sem peças no período.</TableCell></TableRow>
                  )}
                  {produtos.map((p, i) => (
                    <TableRow
                      key={p.produto_id ?? i}
                      className={cn(p.link && "cursor-pointer")}
                      onClick={() => p.link && window.open(p.link, "_blank", "noreferrer")}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.imagem && <img src={p.imagem} alt={p.nome ?? "Peça"} className="h-9 w-9 rounded object-cover" loading="lazy" />}
                          <span className="text-sm">{p.nome ?? traco}</span>
                          {p.link && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(pick(p, "viram_botoes", "viram"))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(pick(p, "abriram", "aberturas"))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(p.tamanhos)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(p.provas)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(p.erros)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(pick(p, "pedidos_diretos", "pedidos"))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtBRL(p.faturamento)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(p.trocas)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(pick(p, "prova_para_pedido", "taxa_prova_pedido", "pct_prova_pedido"))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* faixa 9 — trocas */}
          {trocas.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Trocas do provador</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Peça</TableHead>
                      <TableHead>Indicado → Comprado</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estágio</TableHead>
                      <TableHead>Erro do provador?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trocas.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{t.pedido ?? traco}</TableCell>
                        <TableCell>{t.cliente ?? traco}</TableCell>
                        <TableCell>{pick(t, "produto", "peca") ?? traco}</TableCell>
                        <TableCell>{`${t.tamanho_indicado ?? traco} → ${t.tamanho_comprado ?? traco}`}</TableCell>
                        <TableCell>{t.motivo ?? traco}</TableCell>
                        <TableCell>{t.tipo ?? traco}</TableCell>
                        <TableCell>{pick(t, "estagio", "estágio") ?? traco}</TableCell>
                        <TableCell className={cn(t.erro_provador && "font-medium text-destructive")}>
                          {t.erro_provador ? "sim" : "não"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
