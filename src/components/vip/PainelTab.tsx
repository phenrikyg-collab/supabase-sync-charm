import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Info, TrendingUp } from "lucide-react";
import { brl, num, pctBr, dataCurta } from "@/lib/financeiroFormat";
import { vipKpis, textoRedFlag, type VipKpis } from "@/lib/vip";
import { toast } from "sonner";

const PERIODOS = [7, 30, 90];

function Tile({
  titulo,
  valor,
  sub,
  tom = "default",
  children,
}: {
  titulo: string;
  valor: React.ReactNode;
  sub?: React.ReactNode;
  tom?: "default" | "ok" | "alerta" | "ruim";
  children?: React.ReactNode;
}) {
  const cor =
    tom === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tom === "ruim"
        ? "text-destructive"
        : tom === "alerta"
          ? "text-amber-600 dark:text-amber-400"
          : "";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className={`text-3xl font-semibold tabular-nums ${cor}`}>{valor}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        {children}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, valor, hint }: { label: string; valor: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{valor}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function Gauge({ nota }: { nota: number }) {
  const cor = nota >= 8 ? "text-emerald-500" : nota >= 6 ? "text-amber-500" : "text-destructive";
  const pct = Math.max(0, Math.min(100, (nota / 10) * 100));
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3" className="stroke-muted" />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className={`${cor} stroke-current`}
            strokeDasharray={`${pct} ${100 - pct}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-semibold ${cor}`}>{nota.toFixed(1)}</span>
          <span className="text-[10px] text-muted-foreground">de 10</span>
        </div>
      </div>
    </div>
  );
}

export function PainelTab() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<VipKpis | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    vipKpis(dias)
      .then((d) => vivo && setDados(d))
      .catch((e) => toast.error(e.message ?? "Falha ao carregar KPIs"))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [dias]);

  const base = dados?.base ?? {};
  const eng = dados?.engajamento ?? {};
  const conv = dados?.conversao ?? {};
  const health = dados?.health_score ?? {};
  const flags = dados?.red_flags ?? [];

  const serie = useMemo(() => {
    const s = (base as any)?.serie ?? [];
    return (Array.isArray(s) ? s : []).map((p: any) => ({
      dia: dataCurta(p.dia ?? p.data) ?? p.dia ?? "",
      entradas: Number(p.entradas ?? 0),
      saidas: Number(p.saidas ?? p.saidas_estimadas ?? 0),
      liquido: Number(p.liquido ?? (p.entradas ?? 0) - (p.saidas ?? 0)),
    }));
  }, [base]);

  const taxaSaida = Number(base?.taxa_saida_pct ?? 0);
  const semHistorico = base?.membros_inicio_periodo === null || base?.membros_inicio_periodo === undefined;
  const receitaMembro = Number(conv?.receita_por_membro ?? 0);
  const reguaMembro =
    receitaMembro < 5 ? "desengajado" : receitaMembro <= 40 ? "saudável" : receitaMembro <= 100 ? "avançado" : "excepcional";
  const distribuicao = dados?.distribuicao ?? {};
  const pctOferta = Number((distribuicao as any)?.oferta ?? (distribuicao as any)?.oportunidade ?? 0);

  if (carregando && !dados) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Período:</span>
          {PERIODOS.map((p) => (
            <Button key={p} size="sm" variant={p === dias ? "default" : "outline"} onClick={() => setDias(p)}>
              {p} dias
            </Button>
          ))}
        </div>

        {/* Linha 1 — A base */}
        <section className="space-y-3">
          <h2 className="font-serif text-lg font-semibold">A base</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Tile
              titulo="Membros hoje"
              valor={num(base?.membros_hoje ?? 0)}
              sub={
                <span className="inline-flex items-center gap-1">
                  {Number(base?.crescimento_liquido ?? 0) >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                  )}
                  {num(base?.crescimento_liquido ?? 0)} no período
                </span>
              }
            />
            <Tile
              titulo="Entradas"
              valor={num(base?.entradas ?? 0)}
              sub={`Taxa de entrada ${pctBr(base?.taxa_entrada_pct ?? 0, 1)}`}
            />
            <Tile
              titulo="Saídas (estimadas)"
              valor={semHistorico ? <span className="text-lg">ainda sem histórico suficiente</span> : num(base?.saidas_estimadas ?? 0)}
              tom={semHistorico ? "default" : taxaSaida > 10 ? "ruim" : "ok"}
              sub={semHistorico ? undefined : `Taxa de saída ${pctBr(taxaSaida, 1)} · ${base?.benchmark_saida ?? "ideal abaixo de 10%"}`}
            >
              <p className="text-[11px] leading-snug text-muted-foreground mt-2">
                Saída é estimada — o WhatsApp não avisa quem sai do grupo. Calculamos comparando quantas pessoas
                entraram pelo nosso link com a variação real do tamanho do grupo no período. O histórico começa a
                acumular com o sync diário.
              </p>
            </Tile>
            <Tile
              titulo="Origens de captação"
              valor={num(base?.origens_ativas ?? 0)}
              tom={Number(base?.origens_ativas ?? 0) < 3 ? "ruim" : "ok"}
              sub={
                Number(base?.origens_ativas ?? 0) < 3
                  ? "Menos de 3 funis ativos — o Bloco 12 pede no mínimo 3"
                  : "Funis de captação ativos"
              }
            />
          </div>

          {serie.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Entradas x saídas por período</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="dia" fontSize={11} />
                    <YAxis fontSize={11} />
                    <RTooltip />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    <Line dataKey="liquido" name="Crescimento líquido" stroke="hsl(var(--foreground))" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Linha 2 */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                Engajamento
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {eng?.nota_leitura ??
                      "O WhatsApp não entrega taxa de leitura em grupo. CTR e taxa de resposta são os proxies honestos."}
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MiniStat label="Alcance" valor={num(eng?.alcance ?? 0)} />
              <MiniStat label="Mensagens" valor={num(eng?.mensagens_enviadas ?? 0)} />
              <MiniStat label="Cliques únicos" valor={num(eng?.cliques_unicos ?? 0)} />
              <MiniStat label="CTR" valor={pctBr(eng?.ctr_pct ?? 0, 2)} />
              <MiniStat label="Votantes" valor={num(eng?.votantes_enquete ?? 0)} />
              <MiniStat label="Taxa de resposta" valor={pctBr(eng?.taxa_resposta_pct ?? 0, 2)} />
              <p className="col-span-full text-[11px] text-muted-foreground">
                {eng?.nota_leitura ??
                  "O WhatsApp não entrega taxa de leitura em grupo — CTR e taxa de resposta são os proxies honestos."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Conversão</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MiniStat label="Pedidos" valor={num(conv?.pedidos ?? 0)} />
              <MiniStat label="Receita" valor={brl(conv?.receita ?? 0)} />
              <MiniStat label="Conv. por clique" valor={pctBr(conv?.conversao_por_clique_pct ?? 0, 2)} />
              <MiniStat
                label="Receita por membro"
                valor={brl(receitaMembro)}
                hint={`${reguaMembro} · <R$5 desengajado · R$20–40 saudável · R$50–100 avançado`}
              />
              <MiniStat label="Ticket médio" valor={brl(conv?.ticket_medio ?? 0)} />
              {conv?.custo_mensal ? (
                <MiniStat label="ROI" valor={`${num(conv?.roi ?? 0, 1)}x`} hint={`Custo ${brl(conv?.custo_mensal)}`} />
              ) : (
                <div className="rounded-lg border border-dashed p-3 text-[11px] text-muted-foreground">
                  Preencha o <strong>custo mensal</strong> na aba Grupos &gt; Configuração de envio para calcular o ROI.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Health Score</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Gauge nota={Number(health?.nota ?? 0)} />
              <div className="flex-1 space-y-2">
                {Object.entries(health?.dimensoes ?? {}).map(([k, v]) => (
                  <div key={k} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="capitalize">{k.replace(/_/g, " ")}</span>
                      <span className="tabular-nums">{num(Number(v), 1)}</span>
                    </div>
                    <Progress value={(Number(v) / 10) * 100} className="h-1.5" />
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground pt-1">
                  Calculado a partir dos dados (estrutura, distribuição, headlines, crescimento e mensuração) — não é
                  opinião da IA.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribuição de conteúdo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-semibold ${pctOferta > 25 ? "text-destructive" : "text-emerald-600"}`}>
                  {pctBr(pctOferta, 1)}
                </span>
                <span className="text-xs text-muted-foreground">de oferta · limite saudável 25%</span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart
                  data={Object.entries(distribuicao ?? {}).map(([k, v]) => ({ nome: k, pct: Number(v) }))}
                  layout="vertical"
                  margin={{ left: 30 }}
                >
                  <XAxis type="number" fontSize={11} />
                  <YAxis type="category" dataKey="nome" fontSize={11} width={90} />
                  <RTooltip />
                  <Bar dataKey="pct" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        {/* Red flags */}
        {flags.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Red flags do canal</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1 text-sm">
                {flags.map((f, i) => (
                  <li key={i}>• {textoRedFlag(f)}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {flags.length === 0 && dados && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Nenhuma red flag no período. <Badge variant="outline">canal saudável</Badge>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
