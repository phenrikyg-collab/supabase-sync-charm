import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, CartesianGrid, ComposedChart, Cell, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHead, useOrdenado, useSortable } from "@/components/SortableHead";
import { chamarRpc } from "@/lib/supabaseRpc";
import { baixarCsv, nBR } from "@/lib/popups";
import { cn } from "@/lib/utils";

/* ===== Identidade ===== */
const PRETO = "#1D1D1B";
const DOURADO = "#E8CD7E";
const BRONZE = "#8B6914";
const CREME = "#FAF8F3";
const AREIA = "#E6DCC5";

const CORES_DONUT = [PRETO, DOURADO, BRONZE, "#B9A87A", "#CFC3A6"];

/* ===== Tipos ===== */
type Resumo = Record<string, number | null>;

type PorPopup = {
  popup_id: number; nome: string; status: string; impressoes: number; visitantes: number;
  cliques: number; conversoes: number; cupons_emitidos: number; pedidos: number;
  faturamento: number; novos_clientes: number; taxa_conversao: number;
};

type PedidoRecente = {
  pedido: string; data: string; valor: number; cupom: string;
  popup_id: number | null; cliente_novo: boolean; dias_ate_uso: number | null;
};

type Dashboard = {
  periodo: { de: string; ate: string; dias: number; popup_id: number | null };
  periodo_anterior: { de: string; ate: string };
  resumo: Resumo;
  anterior: Resumo;
  funil: { etapa: string; n: number }[];
  por_dia: { dia: string; impressoes: number; conversoes: number; pedidos: number; faturamento: number }[];
  por_popup: PorPopup[];
  por_dispositivo: { dispositivo: string; impressoes: number; conversoes: number }[];
  por_gatilho: { gatilho: string; impressoes: number }[];
  top_paginas: { pagina: string; impressoes: number }[];
  pedidos_recentes: PedidoRecente[];
};

/* ===== Formatação ===== */
const reais = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number | null | undefined, casas = 1) =>
  `${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const num = (v: number | null | undefined) => nBR(Number(v ?? 0));

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function diasAtras(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}
function dataCurta(v: string) {
  const [, m, d] = String(v).slice(0, 10).split("-");
  return d ? `${d}/${m}` : v;
}
function dataBr(v: string | null | undefined) {
  if (!v) return "sem data";
  const [a, m, d] = String(v).slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : String(v);
}
function caminhoUrl(p: string) {
  try {
    return new URL(p).pathname || "/";
  } catch {
    return p.replace(/^https?:\/\/[^/]+/i, "") || "/";
  }
}

/* ===== Variação ===== */
function Variacao({ atual, anterior, inverso }: { atual: number; anterior: number; inverso?: boolean }) {
  if (!anterior) {
    if (!atual) return <span className="text-xs text-muted-foreground">sem base anterior</span>;
    return <span className="text-xs font-medium" style={{ color: BRONZE }}>novo</span>;
  }
  const delta = ((atual - anterior) / Math.abs(anterior)) * 100;
  const bom = inverso ? delta < 0 : delta > 0;
  const Icone = delta >= 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        Math.abs(delta) < 0.05 ? "text-muted-foreground" : bom ? "text-success" : "text-danger",
      )}
    >
      <Icone className="h-3 w-3" />
      {pct(Math.abs(delta))}
    </span>
  );
}

/* ===== Cards ===== */
function CardGrande({
  rotulo, valor, sub, atual, anterior,
}: { rotulo: string; valor: string; sub?: string; atual: number; anterior: number }) {
  return (
    <Card style={{ borderColor: AREIA }} className="shadow-none">
      <CardContent className="space-y-1.5 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{rotulo}</p>
        <div className="flex flex-wrap items-end gap-2">
          <p className="font-serif text-3xl font-bold leading-none tabular-nums" style={{ color: PRETO }}>{valor}</p>
          <Variacao atual={atual} anterior={anterior} />
        </div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function CardPequeno({ rotulo, valor, sub, corSub }: { rotulo: string; valor: string; sub?: string; corSub?: string }) {
  return (
    <Card style={{ borderColor: AREIA, backgroundColor: CREME }} className="shadow-none">
      <CardContent className="space-y-1 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{rotulo}</p>
        <p className="font-serif text-xl font-bold tabular-nums" style={{ color: PRETO }}>{valor}</p>
        {sub && <p className={cn("text-xs", corSub ?? "text-muted-foreground")}>{sub}</p>}
      </CardContent>
    </Card>
  );
}

/* ===== Página ===== */
type ColunaPopup =
  | "nome" | "impressoes" | "visitantes" | "conversoes" | "taxa_conversao"
  | "cupons_emitidos" | "pedidos" | "novos_clientes" | "faturamento";

const ATALHOS: { chave: string; rotulo: string; calcular: () => { de: string; ate: string } }[] = [
  { chave: "hoje", rotulo: "Hoje", calcular: () => ({ de: iso(new Date()), ate: iso(new Date()) }) },
  { chave: "7", rotulo: "7 dias", calcular: () => ({ de: diasAtras(6), ate: iso(new Date()) }) },
  { chave: "14", rotulo: "14 dias", calcular: () => ({ de: diasAtras(13), ate: iso(new Date()) }) },
  { chave: "30", rotulo: "30 dias", calcular: () => ({ de: diasAtras(29), ate: iso(new Date()) }) },
  {
    chave: "mes", rotulo: "Este mês",
    calcular: () => {
      const h = new Date();
      return { de: iso(new Date(h.getFullYear(), h.getMonth(), 1)), ate: iso(h) };
    },
  },
];

export default function PopupsDashboard() {
  const [params, setParams] = useSearchParams();

  const padrao = ATALHOS[3].calcular();
  const de = params.get("de") ?? padrao.de;
  const ate = params.get("ate") ?? padrao.ate;
  const popupId = params.get("popup") ? Number(params.get("popup")) : null;
  const metrica = (params.get("metrica") as "impressoes" | "conversoes" | "pedidos") ?? "impressoes";

  const mudar = (novos: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(novos).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v)));
    setParams(p, { replace: true });
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["popups-dashboard", de, ate, popupId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await chamarRpc<Dashboard>("popups_dashboard", {
        p_de: de, p_ate: ate, p_popup_id: popupId,
      });
      if (error) throw new Error(error.message);
      return data as Dashboard;
    },
  });

  const resumo = data?.resumo ?? {};
  const anterior = data?.anterior ?? {};
  const n = (o: Resumo, k: string) => Number(o?.[k] ?? 0);

  const { sort, alternar } = useSortable<ColunaPopup>({ key: "faturamento", dir: "desc" });
  const linhas = useOrdenado<PorPopup, ColunaPopup>(data?.por_popup ?? [], sort, {
    nome: (l) => l.nome,
    impressoes: (l) => l.impressoes,
    visitantes: (l) => l.visitantes,
    conversoes: (l) => l.conversoes,
    taxa_conversao: (l) => l.taxa_conversao,
    cupons_emitidos: (l) => l.cupons_emitidos,
    pedidos: (l) => l.pedidos,
    novos_clientes: (l) => l.novos_clientes,
    faturamento: (l) => l.faturamento,
  });

  const nomePopup = useMemo(() => {
    const m = new Map<number, string>();
    (data?.por_popup ?? []).forEach((p) => m.set(p.popup_id, p.nome));
    return m;
  }, [data?.por_popup]);

  const maxPagina = Math.max(1, ...(data?.top_paginas ?? []).map((p) => p.impressoes));
  const totalDisp = (data?.por_dispositivo ?? []).reduce((s, d) => s + Number(d.impressoes ?? 0), 0);
  const semDados = !isLoading && !n(resumo, "impressoes");

  const exportar = () => {
    const linhasCsv: (string | number)[][] = [
      ["Desempenho por popup"],
      ["Popup", "Status", "Impressões", "Visitantes", "Conversões", "Taxa %", "Cupons", "Pedidos", "Novos clientes", "Faturamento"],
      ...(data?.por_popup ?? []).map((p) => [
        p.nome, p.status, p.impressoes, p.visitantes, p.conversoes, p.taxa_conversao,
        p.cupons_emitidos, p.pedidos, p.novos_clientes, p.faturamento,
      ]),
      [],
      ["Últimos pedidos com cupom de popup"],
      ["Pedido", "Data", "Valor", "Cupom", "Popup", "Novo cliente", "Dias até o uso"],
      ...(data?.pedidos_recentes ?? []).map((p) => [
        p.pedido, dataBr(p.data), p.valor, p.cupom,
        p.popup_id ? nomePopup.get(p.popup_id) ?? String(p.popup_id) : "",
        p.cliente_novo ? "sim" : "não", p.dias_ate_uso ?? "",
      ]),
    ];
    baixarCsv(`popups-${de}-a-${ate}.csv`, linhasCsv);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold">Resultados dos popups</h1>
          <p className="text-sm text-muted-foreground">
            Quanto os popups trazem de leads, cupons usados e faturamento.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-wrap gap-1.5">
            {ATALHOS.map((a) => {
              const v = a.calcular();
              const ativo = v.de === de && v.ate === ate;
              return (
                <Button
                  key={a.chave}
                  size="sm"
                  variant={ativo ? "default" : "outline"}
                  onClick={() => mudar({ de: v.de, ate: v.ate })}
                >
                  {a.rotulo}
                </Button>
              );
            })}
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">De</Label>
            <Input type="date" className="h-9 w-[145px]" value={de} onChange={(e) => mudar({ de: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Até</Label>
            <Input type="date" className="h-9 w-[145px]" value={ate} onChange={(e) => mudar({ ate: e.target.value })} />
          </div>
          <Select
            value={popupId ? String(popupId) : "todos"}
            onValueChange={(v) => mudar({ popup: v === "todos" ? null : v })}
          >
            <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os popups</SelectItem>
              {(data?.por_popup ?? []).map((p) => (
                <SelectItem key={p.popup_id} value={String(p.popup_id)}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={() => refetch()}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={exportar}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : semDados ? (
        <Card style={{ borderColor: AREIA }} className="shadow-none">
          <CardContent className="p-12 text-center">
            <p className="font-serif text-xl font-bold">Nenhuma impressão nesse período</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha outro período ou ative um popup para começar a medir.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CardGrande
              rotulo="Faturamento"
              valor={reais(n(resumo, "faturamento"))}
              sub={`líquido de desconto: ${reais(n(resumo, "faturamento_liquido"))}`}
              atual={n(resumo, "faturamento")}
              anterior={n(anterior, "faturamento")}
            />
            <CardGrande
              rotulo="Novos clientes"
              valor={num(n(resumo, "novos_clientes"))}
              sub={`${reais(n(resumo, "faturamento_novos"))} em compras`}
              atual={n(resumo, "novos_clientes")}
              anterior={n(anterior, "conversoes")}
            />
            <CardGrande
              rotulo="Cupons usados"
              valor={num(n(resumo, "pedidos"))}
              sub={`de ${num(n(resumo, "cupons_emitidos"))} emitidos`}
              atual={n(resumo, "pedidos")}
              anterior={n(anterior, "pedidos")}
            />
            <CardGrande
              rotulo="Taxa de conversão"
              valor={pct(n(resumo, "taxa_conversao"))}
              sub={`${num(n(resumo, "leads"))} leads`}
              atual={n(resumo, "conversoes")}
              anterior={n(anterior, "conversoes")}
            />
          </div>

          {/* Segunda faixa */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <CardPequeno
              rotulo="Impressões"
              valor={num(n(resumo, "impressoes"))}
              sub={`${Number(n(resumo, "impressoes_por_visitante")).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} por visitante`}
            />
            <CardPequeno rotulo="Visitantes alcançados" valor={num(n(resumo, "visitantes"))} />
            <CardPequeno
              rotulo="Taxa de uso do cupom"
              valor={pct(n(resumo, "taxa_uso_cupom"))}
              sub="coorte do período"
            />
            <CardPequeno
              rotulo="Ticket médio"
              valor={reais(n(resumo, "ticket_medio"))}
              sub={`loja: ${reais(n(resumo, "ticket_loja"))} (${pct(n(resumo, "ticket_vs_loja"))})`}
              corSub={n(resumo, "ticket_vs_loja") >= 0 ? "text-success" : "text-danger"}
            />
            <CardPequeno rotulo="Receita por mil impressões" valor={reais(n(resumo, "receita_por_mil_impressoes"))} />
            <CardPequeno rotulo="Participação no faturamento" valor={pct(n(resumo, "share_faturamento_loja"))} />
          </div>

          {/* Gráfico principal */}
          <Card style={{ borderColor: AREIA }} className="shadow-none">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
              <CardTitle className="font-serif text-lg">Evolução diária</CardTitle>
              <Tabs value={metrica} onValueChange={(v) => mudar({ metrica: v })}>
                <TabsList className="h-8">
                  <TabsTrigger value="impressoes" className="text-xs">Impressões</TabsTrigger>
                  <TabsTrigger value="conversoes" className="text-xs">Conversões</TabsTrigger>
                  <TabsTrigger value="pedidos" className="text-xs">Pedidos</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data?.por_dia ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={AREIA} vertical={false} />
                  <XAxis dataKey="dia" tickFormatter={dataCurta} tick={{ fontSize: 11 }} stroke={BRONZE} />
                  <YAxis yAxisId="e" tick={{ fontSize: 11 }} stroke={BRONZE} tickFormatter={(v) => num(v)} />
                  <YAxis
                    yAxisId="d" orientation="right" tick={{ fontSize: 11 }} stroke={BRONZE}
                    tickFormatter={(v) => `R$ ${num(v)}`}
                  />
                  <ReTooltip
                    labelFormatter={(v) => dataBr(String(v))}
                    formatter={(valor: number, nome: string) =>
                      nome === "Faturamento" ? [reais(valor), nome] : [num(valor), nome]
                    }
                    contentStyle={{ borderColor: AREIA, borderRadius: 12, backgroundColor: "#fff" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    yAxisId="e" dataKey={metrica} name={
                      metrica === "impressoes" ? "Impressões" : metrica === "conversoes" ? "Conversões" : "Pedidos"
                    }
                    fill={PRETO} radius={[4, 4, 0, 0]} maxBarSize={28}
                  />
                  <Line
                    yAxisId="d" type="monotone" dataKey="faturamento" name="Faturamento"
                    stroke={DOURADO} strokeWidth={2.5} dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Funil */}
          <Card style={{ borderColor: AREIA }} className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg">Funil</CardTitle>
              <p className="text-xs text-muted-foreground">
                Cupom usado são pedidos pagos com cupom de popup dentro do período.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.funil ?? []).map((etapa, i, todas) => {
                const base = i === 0 ? etapa.n : todas[i - 1].n;
                const largura = todas[0]?.n ? Math.max(2, (etapa.n / todas[0].n) * 100) : 0;
                return (
                  <div key={etapa.etapa} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{etapa.etapa}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {num(etapa.n)}
                        {i > 0 && ` · ${base ? pct((etapa.n / base) * 100) : pct(0)} da etapa anterior`}
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: CREME }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${largura}%`, backgroundColor: i === todas.length - 1 ? DOURADO : PRETO }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Por popup */}
          <Card style={{ borderColor: AREIA }} className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg">Desempenho por popup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: AREIA }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead campo="nome" sort={sort} onSort={alternar}>Popup</SortableHead>
                      <SortableHead campo="impressoes" sort={sort} onSort={alternar} className="text-right">Impressões</SortableHead>
                      <SortableHead campo="visitantes" sort={sort} onSort={alternar} className="text-right">Visitantes</SortableHead>
                      <SortableHead campo="conversoes" sort={sort} onSort={alternar} className="text-right">Conversões</SortableHead>
                      <SortableHead campo="taxa_conversao" sort={sort} onSort={alternar} className="text-right">Taxa</SortableHead>
                      <SortableHead campo="cupons_emitidos" sort={sort} onSort={alternar} className="text-right">Cupons</SortableHead>
                      <SortableHead campo="pedidos" sort={sort} onSort={alternar} className="text-right">Pedidos</SortableHead>
                      <SortableHead campo="novos_clientes" sort={sort} onSort={alternar} className="text-right">Novos clientes</SortableHead>
                      <SortableHead campo="faturamento" sort={sort} onSort={alternar} className="text-right">Faturamento</SortableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((p) => (
                      <TableRow key={p.popup_id} className={cn(!p.impressoes && "opacity-50")}>
                        <TableCell>
                          <Link to={`/popups/${p.popup_id}`} className="font-medium hover:underline">{p.nome}</Link>
                          <Badge variant="outline" className="ml-2 text-[10px] capitalize">{p.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num(p.impressoes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(p.visitantes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(p.conversoes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(p.taxa_conversao)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(p.cupons_emitidos)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(p.pedidos)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(p.novos_clientes)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{reais(p.faturamento)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Dispositivo e páginas */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card style={{ borderColor: AREIA }} className="shadow-none">
              <CardHeader className="pb-2"><CardTitle className="font-serif text-lg">Dispositivos</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.por_dispositivo ?? []} dataKey="impressoes" nameKey="dispositivo"
                      innerRadius={60} outerRadius={95} paddingAngle={2}
                    >
                      {(data?.por_dispositivo ?? []).map((_, i) => (
                        <Cell key={i} fill={CORES_DONUT[i % CORES_DONUT.length]} />
                      ))}
                    </Pie>
                    <ReTooltip
                      contentStyle={{ borderColor: AREIA, borderRadius: 12, backgroundColor: "#fff" }}
                      formatter={(valor: number, _n: string, item: { payload?: { conversoes?: number } }) => {
                        const conv = Number(item?.payload?.conversoes ?? 0);
                        const taxa = valor ? (conv / valor) * 100 : 0;
                        return [`${num(valor)} impressões · ${num(conv)} conversões · ${pct(taxa)}`, "Resultado"];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                {!totalDisp && (
                  <p className="-mt-32 text-center text-sm text-muted-foreground">Sem dados de dispositivo.</p>
                )}
              </CardContent>
            </Card>

            <Card style={{ borderColor: AREIA }} className="shadow-none">
              <CardHeader className="pb-2"><CardTitle className="font-serif text-lg">Onde aparece</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {!(data?.top_paginas ?? []).length && (
                  <p className="text-sm text-muted-foreground">Sem páginas registradas no período.</p>
                )}
                {(data?.top_paginas ?? []).map((p) => (
                  <div key={p.pagina} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate" title={p.pagina}>{caminhoUrl(p.pagina)}</span>
                      <span className="tabular-nums text-muted-foreground">{num(p.impressoes)}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: CREME }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(3, (p.impressoes / maxPagina) * 100)}%`, backgroundColor: BRONZE }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Pedidos recentes */}
          <Card style={{ borderColor: AREIA }} className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg">Últimos pedidos com cupom de popup</CardTitle>
            </CardHeader>
            <CardContent>
              {!(data?.pedidos_recentes ?? []).length ? (
                <p className="text-sm text-muted-foreground">Nenhum pedido com cupom de popup nesse período.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border" style={{ borderColor: AREIA }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Cupom</TableHead>
                        <TableHead>Popup</TableHead>
                        <TableHead>Uso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.pedidos_recentes ?? []).map((p, i) => (
                        <TableRow key={`${p.pedido}-${i}`}>
                          <TableCell className="font-medium">
                            {p.pedido}
                            {p.cliente_novo && (
                              <Badge
                                variant="outline" className="ml-2 text-[10px]"
                                style={{ borderColor: DOURADO, backgroundColor: CREME, color: BRONZE }}
                              >
                                novo cliente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{dataBr(p.data)}</TableCell>
                          <TableCell className="text-right tabular-nums">{reais(p.valor)}</TableCell>
                          <TableCell className="font-mono text-xs">{p.cupom}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.popup_id ? nomePopup.get(p.popup_id) ?? `Popup ${p.popup_id}` : "sem popup"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.dias_ate_uso === null || p.dias_ate_uso === undefined
                              ? "sem dados"
                              : p.dias_ate_uso === 0
                                ? "usou no mesmo dia"
                                : `usou em ${num(p.dias_ate_uso)} dias`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Faturamento considera pedidos não cancelados que usaram um cupom emitido por popup. Novos clientes são os
            que fizeram a primeira compra nesse pedido.
          </p>
        </>
      )}
    </div>
  );
}
