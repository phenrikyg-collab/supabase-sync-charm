import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock, Target, ShoppingCart, TrendingUp, AlertTriangle,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, parse,
  format, startOfDay, isAfter, isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));
const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(Number(n ?? 0)));

interface Pedido { date: string | null; total: number | null; }

interface Props {
  mes: string;                    // "yyyy-MM"
  metaTotal: number;
  ticketMeta: number;
  faturamentoRealizado: number;   // bruto acumulado no mês
  pedidosRealizados: number;
  pedidosDoMes: Pedido[];         // pedidos válidos do canal
}

export default function RoteiroDiarioCard({
  mes, metaTotal, ticketMeta, faturamentoRealizado, pedidosRealizados, pedidosDoMes,
}: Props) {
  const data = useMemo(() => {
    const dt = parse(mes + "-01", "yyyy-MM-dd", new Date());
    const ini = startOfMonth(dt);
    const fim = endOfMonth(dt);
    const dias = eachDayOfInterval({ start: ini, end: fim });
    const diasUteis = dias.filter((d) => !isWeekend(d));
    const totalDU = diasUteis.length;

    const hoje = startOfDay(new Date());
    const isMesAtual = hoje >= ini && hoje <= fim;
    const corte = isMesAtual ? hoje : fim;

    const duPassados = diasUteis.filter((d) => d <= corte).length;
    const duRestantes = Math.max(totalDU - duPassados, 0);

    const faltaMeta = Math.max(metaTotal - faturamentoRealizado, 0);
    const pctMeta = metaTotal > 0 ? (faturamentoRealizado / metaTotal) * 100 : 0;

    // ritmo planejado original
    const metaDiariaPlano = totalDU > 0 ? metaTotal / totalDU : 0;
    const pedidosDiaPlano = ticketMeta > 0 ? metaDiariaPlano / ticketMeta : 0;

    // ritmo necessário a partir de agora
    const metaDiariaRestante = duRestantes > 0 ? faltaMeta / duRestantes : 0;
    const pedidosDiaRestante = ticketMeta > 0 ? metaDiariaRestante / ticketMeta : 0;

    // realizado por dia
    const realizadoPorDia = new Map<string, { receita: number; pedidos: number }>();
    for (const p of pedidosDoMes) {
      if (!p.date) continue;
      const k = p.date.slice(0, 10);
      const cur = realizadoPorDia.get(k) ?? { receita: 0, pedidos: 0 };
      cur.receita += Number(p.total ?? 0);
      cur.pedidos += 1;
      realizadoPorDia.set(k, cur);
    }

    const serie = diasUteis.map((d) => {
      const k = format(d, "yyyy-MM-dd");
      const r = realizadoPorDia.get(k) ?? { receita: 0, pedidos: 0 };
      const passou = d < corte || isSameDay(d, corte);
      return {
        data: format(d, "dd/MM"),
        dia: format(d, "EEE", { locale: ptBR }),
        receita: r.receita,
        pedidos: r.pedidos,
        meta: passou ? metaDiariaPlano : metaDiariaRestante,
        pedidos_meta: passou ? pedidosDiaPlano : pedidosDiaRestante,
        passou,
        eh_hoje: isMesAtual && isSameDay(d, hoje),
      };
    });

    // ritmo médio realizado nos dias úteis já passados
    const duPassadosArr = diasUteis.filter((d) => d <= corte);
    const totalReceitaPassada = duPassadosArr.reduce((a, d) => a + (realizadoPorDia.get(format(d, "yyyy-MM-dd"))?.receita ?? 0), 0);
    const ritmoMedioReal = duPassados > 0 ? totalReceitaPassada / duPassados : 0;
    const projecaoFimMes = faturamentoRealizado + ritmoMedioReal * duRestantes;
    const pctProjetado = metaTotal > 0 ? (projecaoFimMes / metaTotal) * 100 : 0;

    const aceleracaoNecessaria = ritmoMedioReal > 0 ? (metaDiariaRestante / ritmoMedioReal) * 100 - 100 : 0;

    return {
      totalDU, duPassados, duRestantes,
      faltaMeta, pctMeta,
      metaDiariaPlano, pedidosDiaPlano,
      metaDiariaRestante, pedidosDiaRestante,
      ritmoMedioReal, projecaoFimMes, pctProjetado,
      aceleracaoNecessaria,
      serie,
    };
  }, [mes, metaTotal, ticketMeta, faturamentoRealizado, pedidosDoMes]);

  if (metaTotal <= 0 || ticketMeta <= 0) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-6 flex items-center gap-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5" />
          Defina <strong>Meta total</strong> e <strong>Ticket médio meta</strong> em Configurações para gerar o roteiro diário.
        </CardContent>
      </Card>
    );
  }

  const corStatus =
    data.pctProjetado >= 100 ? "text-emerald-500" :
    data.pctProjetado >= 90  ? "text-amber-500"   : "text-red-500";

  const corAcc =
    data.aceleracaoNecessaria <= 0   ? "text-emerald-500" :
    data.aceleracaoNecessaria <= 20  ? "text-amber-500"   : "text-red-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Roteiro diário para bater a meta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" /> Falta para a meta
            </div>
            <div className="font-serif text-2xl mt-1">{fmtBRL(data.faltaMeta)}</div>
            <div className="text-xs text-muted-foreground">{data.pctMeta.toFixed(1)}% atingido</div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Dias úteis restantes
            </div>
            <div className="font-serif text-2xl mt-1">
              {data.duRestantes}
              <span className="text-sm text-muted-foreground"> / {data.totalDU}</span>
            </div>
            <div className="text-xs text-muted-foreground">{data.duPassados} já decorridos</div>
          </div>

          <div className="rounded-lg border p-4 bg-primary/5 border-primary/30">
            <div className="text-[10px] uppercase tracking-wider text-primary">
              Meta diária restante
            </div>
            <div className="font-serif text-2xl mt-1 text-primary">{fmtBRL(data.metaDiariaRestante)}</div>
            <div className="text-xs text-muted-foreground">por dia útil restante</div>
          </div>

          <div className="rounded-lg border p-4 bg-primary/5 border-primary/30">
            <div className="text-[10px] uppercase tracking-wider text-primary flex items-center gap-1">
              <ShoppingCart className="h-3 w-3" /> Pedidos / dia
            </div>
            <div className="font-serif text-2xl mt-1 text-primary">
              {fmtNum(data.pedidosDiaRestante)}
            </div>
            <div className="text-xs text-muted-foreground">
              com ticket de {fmtBRL(ticketMeta)}
            </div>
          </div>
        </div>

        {/* Projeção */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Projeção fim do mês (mantendo o ritmo atual)
              </div>
              <div className="font-serif text-2xl mt-1">
                {fmtBRL(data.projecaoFimMes)}
                <Badge variant="outline" className={`ml-2 border-0 ${corStatus}`}>
                  {data.pctProjetado.toFixed(0)}% da meta
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Ritmo médio diário até hoje: <strong>{fmtBRL(data.ritmoMedioReal)}</strong>
                {ticketMeta > 0 && <> &middot; <strong>{fmtNum(data.ritmoMedioReal / ticketMeta)} pedidos/dia</strong></>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Aceleração necessária
              </div>
              <div className={`font-serif text-2xl mt-1 ${corAcc}`}>
                {data.aceleracaoNecessaria <= 0 ? "No ritmo ✓" : `+${data.aceleracaoNecessaria.toFixed(0)}%`}
              </div>
            </div>
          </div>
          <Progress value={Math.min(data.pctProjetado, 150)} className="h-2 mt-3" />
        </div>

        {/* Gráfico diário */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Realizado vs meta diária (dias úteis)</h4>
            <div className="text-xs text-muted-foreground">
              Linha tracejada = meta diária recalculada
            </div>
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data.serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => fmtBRL(Number(v))} />
                <Tooltip
                  formatter={(v: number, name: string) => [fmtBRL(Number(v)), name === "receita" ? "Realizado" : "Meta"]}
                  labelFormatter={(l, items: any) => {
                    const it = items?.[0]?.payload;
                    return `${l} · ${it?.dia ?? ""}${it?.eh_hoje ? " (hoje)" : ""}`;
                  }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <ReferenceLine y={data.metaDiariaRestante} stroke="hsl(var(--primary))" strokeDasharray="4 4" label={{ value: "Meta", position: "right", fill: "hsl(var(--primary))", fontSize: 10 }} />
                <Bar dataKey="receita" radius={[4, 4, 0, 0]}>
                  {data.serie.map((d, i) => {
                    const atinge = d.receita >= d.meta && d.meta > 0;
                    const fill = !d.passou
                      ? "hsl(var(--muted))"
                      : atinge
                      ? "hsl(152, 60%, 45%)"
                      : d.receita > 0
                      ? "hsl(38, 80%, 55%)"
                      : "hsl(0, 72%, 51%)";
                    return <Cell key={i} fill={fill} fillOpacity={d.eh_hoje ? 1 : 0.85} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Plano original do mês: <strong>{fmtBRL(data.metaDiariaPlano)}/dia</strong> ({fmtNum(data.pedidosDiaPlano)} pedidos)
          em {data.totalDU} dias úteis. O roteiro recalcula automaticamente conforme as vendas reais entram.
        </p>
      </CardContent>
    </Card>
  );
}
