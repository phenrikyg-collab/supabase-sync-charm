import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { brl, brlCompacto, pctBr, dataBr } from "@/lib/financeiroFormat";
import { useView, n, campo, mesDe, rotuloMes, hojeISO, somaDias, ehConfirmado, Linha } from "@/lib/finViews";
import { cn } from "@/lib/utils";

function Kpi({ titulo, valor, sub, cor }: { titulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{titulo}</p>
        <p className={cn("text-xl font-serif font-bold text-card-foreground", cor)}>{valor}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Var({ atual, anterior, pct }: { atual: number; anterior?: number; pct?: number }) {
  const p = pct ?? (anterior ? ((atual - anterior) / Math.abs(anterior)) * 100 : undefined);
  if (p == null || !Number.isFinite(p)) return null;
  return <span className={p >= 0 ? "text-success" : "text-destructive"}>{p >= 0 ? "▲" : "▼"} {pctBr(Math.abs(p), 1)} vs mês anterior</span>;
}

export const SEVERIDADE: Record<string, string> = {
  alta: "bg-destructive/10 text-destructive border-destructive/30",
  media: "bg-warning/10 text-warning border-warning/30",
  info: "bg-muted text-muted-foreground",
};

export default function DashboardFinanceiro() {
  const caixaQ = useView("vw_fin_caixa_posicao");
  const dreQ = useView("vw_fin_dre_mensal");
  const despQ = useView("vw_fin_despesas_categoria");
  const eqQ = useView("vw_fin_premissas_equilibrio");
  const cpQ = useView("vw_fin_contas_a_pagar");
  const audQ = useView("vw_fin_auditoria");

  const dre = useMemo(() => [...(dreQ.data ?? [])].sort((a, b) => mesDe(a).localeCompare(mesDe(b))), [dreQ.data]);
  const meses = dre.map(mesDe);
  const [mesSel, setMesSel] = useState<string>("");
  const mes = mesSel || meses[meses.length - 1] || "";
  const linha: Linha | undefined = dre.find((l) => mesDe(l) === mes);
  const caixa = caixaQ.data?.[0];
  const eq = eqQ.data?.[0];

  const dias = n(caixa?.dias_de_caixa);
  const corDias = dias < 15 ? "text-destructive" : dias < 30 ? "text-warning" : "text-success";

  const despesas = (despQ.data ?? [])
    .filter((d) => mesDe(d) === mes)
    .sort((a, b) => n(a.ranking) - n(b.ranking));
  const maxDesp = Math.max(1, ...despesas.map((d) => n(d.total)));

  const hoje = hojeISO();
  const cp = useMemo(() => {
    const r = { vencido: [0, 0], d7: [0, 0], d30: [0, 0] };
    const d7 = somaDias(hoje, 7), d30 = somaDias(hoje, 30);
    (cpQ.data ?? []).forEach((c) => {
      const v = String(c.vencimento ?? "").slice(0, 10);
      const i = ehConfirmado(c) ? 0 : 1;
      if (v < hoje) r.vencido[i] += n(c.valor);
      else if (v <= d7) r.d7[i] += n(c.valor);
      if (v >= hoje && v <= d30) r.d30[i] += n(c.valor);
    });
    return r;
  }, [cpQ.data, hoje]);

  const auditoria = (audQ.data ?? []).filter((a) => !campo(a, "mes") || mesDe(a) === mes);

  const grafico = dre.map((l) => ({
    label: rotuloMes(mesDe(l)),
    receita: n(l.receita_bruta),
    operacional: n(l.resultado_operacional),
    liquido: n(l.resultado_liquido),
  }));

  const receitaMes = n(linha?.receita_bruta);
  const eqOp = n(eq?.equilibrio_operacional);
  const eqDiv = n(eq?.equilibrio_com_dividas);

  if (dreQ.isLoading || caixaQ.isLoading) return <div className="py-20 text-center text-muted-foreground">Carregando...</div>;
  const erro = dreQ.error || caixaQ.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Dashboard Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">DRE por competência, caixa e compromissos</p>
        </div>
        <Select value={mes} onValueChange={setMesSel}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            {[...meses].reverse().map((m) => <SelectItem key={m} value={m}>{rotuloMes(m)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {erro && <p className="text-sm text-destructive">{(erro as Error).message}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Kpi titulo="Caixa total" valor={brl(caixa?.caixa_total)} />
        <Kpi titulo="Saldo Inter" valor={brl(caixa?.saldo_inter)} sub={caixa?.saldo_inter_data ? `em ${dataBr(caixa.saldo_inter_data)}` : undefined} />
        <Kpi titulo="Vindi saldo estimado" valor={brl(caixa?.vindi_saldo_estimado)} />
        <Kpi titulo="Vindi a creditar" valor={brl(caixa?.vindi_a_creditar)} />
        <Kpi titulo="Dias de caixa" valor={dias.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} cor={corDias} />
        <Kpi titulo="Saída média/dia (30d)" valor={brl(caixa?.saida_media_dia_30d)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-5 pb-4 space-y-1">
          <p className="text-xs uppercase text-muted-foreground">Receita bruta</p>
          <p className="text-xl font-serif font-bold">{brl(linha?.receita_bruta)}</p>
          <p className="text-xs"><Var atual={n(linha?.receita_bruta)} anterior={n(linha?.receita_bruta_m1)} pct={linha?.receita_var_pct != null ? n(linha.receita_var_pct) : undefined} /></p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4 space-y-1">
          <p className="text-xs uppercase text-muted-foreground">Receita líquida</p>
          <p className="text-xl font-serif font-bold">{brl(linha?.receita_liquida)}</p>
          <p className="text-xs"><Var atual={n(linha?.receita_liquida)} anterior={n(linha?.receita_liquida_m1)} /></p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4 space-y-1">
          <p className="text-xs uppercase text-muted-foreground">Margem de contribuição</p>
          <p className="text-xl font-serif font-bold">{pctBr(linha?.margem_contribuicao_pct, 1)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4 space-y-1">
          <p className="text-xs uppercase text-muted-foreground">Resultado operacional</p>
          <p className={cn("text-xl font-serif font-bold", n(linha?.resultado_operacional) < 0 && "text-destructive")}>{brl(linha?.resultado_operacional)}</p>
          <p className="text-xs text-muted-foreground">{pctBr(linha?.margem_operacional_pct, 1)} da receita</p>
          <p className="text-xs"><Var atual={n(linha?.resultado_operacional)} anterior={n(linha?.resultado_operacional_m1)} /></p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4 space-y-1">
          <p className="text-xs uppercase text-muted-foreground">Resultado líquido</p>
          <p className={cn("text-xl font-serif font-bold", n(linha?.resultado_liquido) < 0 && "text-destructive")}>{brl(linha?.resultado_liquido)}</p>
          <p className="text-xs text-muted-foreground">{pctBr(linha?.margem_liquida_pct, 1)} da receita</p>
          <p className="text-xs"><Var atual={n(linha?.resultado_liquido)} anterior={n(linha?.resultado_liquido_m1)} /></p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Evolução mensal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={grafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => brl(v)} />
                <Legend />
                <Bar dataKey="receita" name="Receita bruta" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="operacional" name="Resultado operacional" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="liquido" name="Resultado líquido" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Para onde vai o dinheiro</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {despesas.length === 0 && <p className="text-sm text-muted-foreground">Sem despesas no mês.</p>}
            {despesas.map((d) => {
              const varia = d.total_m1 ? ((n(d.total) - n(d.total_m1)) / Math.abs(n(d.total_m1))) * 100 : null;
              return (
                <div key={d.categoria} className="space-y-1">
                  <div className="flex justify-between text-sm gap-2">
                    <span className="truncate">{d.categoria}</span>
                    <span className="whitespace-nowrap font-mono">
                      {brl(d.total)} <span className="text-muted-foreground">· {pctBr(d.pct_receita, 1)}</span>
                      {varia != null && <span className={cn("ml-2 text-xs", varia > 0 ? "text-destructive" : "text-success")}>{varia > 0 ? "▲" : "▼"}{pctBr(Math.abs(varia), 0)}</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(n(d.total) / maxDesp) * 100}%` }} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Ponto de equilíbrio</CardTitle>
            <Link to="/ponto-equilibrio" className="text-xs text-primary underline">Simular</Link>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">MC atual: {pctBr(eq?.margem_contribuicao_pct, 1)} · Receita do mês: {brl(receitaMes)}</p>
            {[["Operacional", eqOp], ["Com dívidas", eqDiv]].map(([rot, v]) => (
              <div key={rot as string} className="space-y-1">
                <div className="flex justify-between"><span>{rot}</span><span className="font-mono">{brl(v as number)}</span></div>
                <Progress value={Math.min(100, (v as number) > 0 ? (receitaMes / (v as number)) * 100 : 0)} />
                <p className="text-xs text-muted-foreground">
                  {receitaMes >= (v as number) ? `${brl(receitaMes - (v as number))} acima` : `Faltam ${brl((v as number) - receitaMes)}`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Contas a pagar</CardTitle>
            <Link to="/contas-pagar" className="text-xs text-primary underline">Ver todas</Link>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {([["Vencido", cp.vencido, "text-destructive"], ["Próximos 7 dias", cp.d7, ""], ["Próximos 30 dias", cp.d30, ""]] as const).map(([rot, v, cor]) => (
              <div key={rot} className="flex justify-between border-b border-border pb-2 last:border-0">
                <span>{rot}</span>
                <span className="text-right">
                  <span className={cn("font-mono font-semibold", cor)}>{brl(v[0] + v[1])}</span>
                  <span className="block text-xs text-muted-foreground">{brl(v[0])} confirmado · {brl(v[1])} estimado</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Auditoria</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm max-h-80 overflow-y-auto">
            {auditoria.length === 0 && <p className="text-muted-foreground">Nada a verificar.</p>}
            {auditoria.map((a, i) => (
              <div key={i} className="border-b border-border pb-2 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{a.verificacao}</span>
                  <Badge variant="outline" className={SEVERIDADE[String(a.severidade)] ?? SEVERIDADE.info}>{a.severidade}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{n(a.qtd)} itens · {brlCompacto(a.valor)}</p>
                {a.detalhe && <p className="text-xs text-muted-foreground">{a.detalhe}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
