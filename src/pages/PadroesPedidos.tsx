import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, Sun, CloudSun, Moon, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine,
} from "recharts";

type Row = {
  mes: string;
  semana_do_mes: number;
  num_dia_semana: number;
  nome_dia_semana: string;
  periodo_dia: string;
  total_pedidos: number;
  receita_total: number;
  ticket_medio: number;
};

const DIAS_PT: Record<string, string> = {
  Sunday: "Domingo", Monday: "Segunda", Tuesday: "Terça",
  Wednesday: "Quarta", Thursday: "Quinta", Friday: "Sexta", Saturday: "Sábado",
};
const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const num = (v: number) => new Intl.NumberFormat("pt-BR").format(v || 0);

export default function PadroesPedidos() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const all: Row[] = [];
      let from = 0;
      const size = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("vw_padroes_pedidos" as any)
          .select("semana_do_mes,num_dia_semana,nome_dia_semana,periodo_dia,total_pedidos,receita_total,ticket_medio")
          .range(from, from + size - 1);
        if (error) { console.error(error); break; }
        if (!data || data.length === 0) break;
        all.push(...(data as any));
        if (data.length < size) break;
        from += size;
      }
      setRows(all);
      setLoading(false);
    })();
  }, []);

  // === Aggregations ===
  const porSemana = useMemo(() => {
    const map = new Map<number, { pedidos: number; receita: number; ticketSum: number; ticketN: number }>();
    rows.forEach((r) => {
      const s = Number(r.semana_do_mes);
      if (!s) return;
      if (!map.has(s)) map.set(s, { pedidos: 0, receita: 0, ticketSum: 0, ticketN: 0 });
      const o = map.get(s)!;
      o.pedidos += Number(r.total_pedidos) || 0;
      o.receita += Number(r.receita_total) || 0;
      o.ticketSum += Number(r.ticket_medio) || 0;
      o.ticketN += 1;
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([semana, o]) => ({
        semana,
        label: `Semana ${semana}`,
        pedidos: o.pedidos,
        receita: o.receita,
        ticket: o.ticketN ? o.ticketSum / o.ticketN : 0,
      }));
  }, [rows]);

  const porDia = useMemo(() => {
    const map = new Map<number, { nome: string; pedidos: number; receita: number; ticketSum: number; ticketN: number }>();
    rows.forEach((r) => {
      const d = Number(r.num_dia_semana);
      if (Number.isNaN(d)) return;
      if (!map.has(d)) map.set(d, { nome: r.nome_dia_semana, pedidos: 0, receita: 0, ticketSum: 0, ticketN: 0 });
      const o = map.get(d)!;
      o.pedidos += Number(r.total_pedidos) || 0;
      o.receita += Number(r.receita_total) || 0;
      o.ticketSum += Number(r.ticket_medio) || 0;
      o.ticketN += 1;
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([num_dia, o]) => ({
        num_dia,
        nome_en: o.nome,
        nome: DIAS_PT[o.nome] || o.nome,
        curto: DIAS_CURTO[num_dia] || o.nome.slice(0, 3),
        pedidos: o.pedidos,
        receita: o.receita,
        ticket: o.ticketN ? o.ticketSum / o.ticketN : 0,
      }));
  }, [rows]);

  const porPeriodo = useMemo(() => {
    const labels: Record<string, { label: string; icon: any }> = {
      manha: { label: "Manhã", icon: Sun },
      tarde: { label: "Tarde", icon: CloudSun },
      noite: { label: "Noite", icon: Moon },
    };
    const order = ["manha", "tarde", "noite"];
    const map = new Map<string, { pedidos: number; receita: number; ticketSum: number; ticketN: number }>();
    rows.forEach((r) => {
      if (!r.periodo_dia || r.periodo_dia === "nao_informado") return;
      if (!map.has(r.periodo_dia)) map.set(r.periodo_dia, { pedidos: 0, receita: 0, ticketSum: 0, ticketN: 0 });
      const o = map.get(r.periodo_dia)!;
      o.pedidos += Number(r.total_pedidos) || 0;
      o.receita += Number(r.receita_total) || 0;
      o.ticketSum += Number(r.ticket_medio) || 0;
      o.ticketN += 1;
    });
    return order
      .filter((k) => map.has(k))
      .map((k) => {
        const o = map.get(k)!;
        return {
          key: k,
          label: labels[k]?.label || k,
          Icon: labels[k]?.icon || Sun,
          pedidos: o.pedidos,
          receita: o.receita,
          ticket: o.ticketN ? o.ticketSum / o.ticketN : 0,
        };
      });
  }, [rows]);

  const heatmap = useMemo(() => {
    // Linhas: semana 1-4 | Colunas: dia 0-6
    const matrix: { receita: number; pedidos: number }[][] = Array.from({ length: 4 }, () =>
      Array.from({ length: 7 }, () => ({ receita: 0, pedidos: 0 }))
    );
    rows.forEach((r) => {
      const s = Number(r.semana_do_mes);
      const d = Number(r.num_dia_semana);
      if (s < 1 || s > 4 || Number.isNaN(d) || d < 0 || d > 6) return;
      matrix[s - 1][d].receita += Number(r.receita_total) || 0;
      matrix[s - 1][d].pedidos += Number(r.total_pedidos) || 0;
    });
    let max = 0;
    matrix.forEach((row) => row.forEach((c) => { if (c.receita > max) max = c.receita; }));
    return { matrix, max: max || 1 };
  }, [rows]);

  // === Cores p/ heatmap (intensidade de receita) ===
  const heatColor = (v: number, max: number) => {
    if (v === 0) return "hsl(0 0% 96%)";
    const r = v / max;
    if (r > 0.75) return "hsl(140 55% 35%)";    // verde escuro
    if (r > 0.5) return "hsl(140 50% 55%)";     // verde claro
    if (r > 0.25) return "hsl(45 90% 65%)";     // amarelo
    return "hsl(10 80% 80%)";                   // vermelho claro
  };
  const heatText = (v: number, max: number) => (v / max > 0.5 ? "#fff" : "#1D1D1B");

  // === Insights derivados ===
  const semanaMaior = porSemana.reduce((a, b) => (b.receita > a.receita ? b : a), porSemana[0] || { receita: 0 } as any);
  const semanasReais = porSemana.filter((s) => s.semana !== 5);
  const semanaMenor = semanasReais.reduce((a, b) => (b.receita < a.receita ? b : a), semanasReais[0] || { receita: 0 } as any);
  const mediaSemana = porSemana.length
    ? porSemana.reduce((s, x) => s + x.receita, 0) / porSemana.length
    : 0;
  const totalReceitaMes = porSemana.reduce((s, x) => s + x.receita, 0);

  const diaMaior = porDia.reduce((a, b) => (b.receita > a.receita ? b : a), porDia[0] || { receita: 0 } as any);
  const totalReceitaSemana = porDia.reduce((s, x) => s + x.receita, 0);
  const receitaFimSemana = porDia
    .filter((d) => d.num_dia === 0 || d.num_dia === 6)
    .reduce((s, x) => s + x.receita, 0);
  const pctTerca = totalReceitaSemana
    ? ((porDia.find((d) => d.num_dia === 2)?.receita || 0) / totalReceitaSemana) * 100
    : 0;
  const pctFimSemana = totalReceitaSemana ? (receitaFimSemana / totalReceitaSemana) * 100 : 0;

  const periodoMaior = porPeriodo.reduce((a, b) => (b.receita > a.receita ? b : a), porPeriodo[0] || { receita: 0 } as any);
  const totalPedidosPeriodo = porPeriodo.reduce((s, x) => s + x.pedidos, 0);
  const pctPeriodoMaior = totalPedidosPeriodo
    ? ((periodoMaior?.pedidos || 0) / totalPedidosPeriodo) * 100
    : 0;
  const horarioPostagem: Record<string, string> = {
    manha: "entre 7h e 9h",
    tarde: "entre 11h e 13h",
    noite: "entre 17h e 19h",
  };

  // Melhor célula do heatmap
  let melhorCelula = { semana: 0, dia: 0, receita: 0 };
  heatmap.matrix.forEach((row, si) =>
    row.forEach((c, di) => {
      if (c.receita > melhorCelula.receita) melhorCelula = { semana: si + 1, dia: di, receita: c.receita };
    })
  );

  if (loading) {
    return (
      <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-10 p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-serif text-3xl font-bold">Padrões de Pedidos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Análise de padrões de vendas — semana, dia da semana e período do dia
          </p>
        </div>
      </div>

      {/* ============= SEÇÃO 1: SEMANA DO MÊS ============= */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold">1. Padrão por semana do mês</h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {porSemana.map((s) => {
            const isBest = s.semana === semanaMaior?.semana;
            const isWorst = s.semana === semanaMenor?.semana && s.semana !== 5;
            return (
              <Card key={s.semana} className={isBest ? "border-emerald-500 border-2" : isWorst ? "border-red-400 border-2" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="font-semibold">{s.label}</CardDescription>
                    {isBest && <Badge className="bg-emerald-600 hover:bg-emerald-600">🏆 Melhor</Badge>}
                    {isWorst && <Badge variant="destructive">⚠️ Fraca</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{num(s.pedidos)}</span>
                    <span className="text-muted-foreground">pedidos</span>
                  </div>
                  <div className="text-lg font-bold">{brl(s.receita)}</div>
                  <div className="text-xs text-muted-foreground">Ticket: {brl(s.ticket)}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Receita por semana</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porSemana}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <ReferenceLine y={mediaSemana} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: "Média", position: "right", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Bar dataKey="receita" radius={[6, 6, 0, 0]}>
                  {porSemana.map((s) => (
                    <Cell
                      key={s.semana}
                      fill={
                        s.semana === semanaMaior?.semana
                          ? "hsl(140 55% 40%)"
                          : s.semana === semanaMenor?.semana && s.semana !== 5
                          ? "hsl(0 70% 55%)"
                          : "hsl(210 70% 55%)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-sky-50 border-sky-200">
          <CardContent className="pt-6 text-sm text-sky-900">
            💡 <strong>Insight:</strong> A {semanaMaior?.label?.toLowerCase()} concentra{" "}
            <strong>{totalReceitaMes ? ((semanaMaior.receita / totalReceitaMes) * 100).toFixed(1) : "0"}%</strong> da receita mensal.{" "}
            {semanaMenor && (
              <>
                A {semanaMenor.label.toLowerCase()} é historicamente a mais fraca (
                <strong>{totalReceitaMes ? ((semanaMenor.receita / totalReceitaMes) * 100).toFixed(1) : "0"}%</strong>) — ideal para campanhas de reativação.
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ============= SEÇÃO 2: DIA DA SEMANA ============= */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold">2. Padrão por dia da semana</h2>

        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          {porDia.map((d) => {
            const isBest = d.num_dia === diaMaior?.num_dia;
            const isLive = d.num_dia === 2;
            const isWeekend = d.num_dia === 0 || d.num_dia === 6;
            return (
              <Card key={d.num_dia} className={isBest ? "border-emerald-500 border-2" : ""}>
                <CardHeader className="pb-2">
                  <CardDescription className="font-semibold">{d.nome}</CardDescription>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {isBest && <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">🏆 Melhor</Badge>}
                    {isLive && <Badge className="bg-pink-600 hover:bg-pink-600 text-[10px]">📱 Live</Badge>}
                    {isWeekend && <Badge className="bg-amber-600 hover:bg-amber-600 text-[10px]">💬 WhatsApp</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="text-xs text-muted-foreground">{num(d.pedidos)} pedidos</div>
                  <div className="text-sm font-bold">{brl(d.receita)}</div>
                  <div className="text-[11px] text-muted-foreground">Ticket: {brl(d.ticket)}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Receita por dia da semana</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porDia}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="curto" />
                <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => brl(v)} labelFormatter={(l, p: any) => p?.[0]?.payload?.nome || l} />
                <Bar dataKey="receita" radius={[6, 6, 0, 0]}>
                  {porDia.map((d) => (
                    <Cell
                      key={d.num_dia}
                      fill={
                        d.num_dia === diaMaior?.num_dia
                          ? "hsl(140 55% 40%)"
                          : d.num_dia === 0 || d.num_dia === 6
                          ? "hsl(28 85% 55%)"
                          : "hsl(210 70% 55%)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-6 text-sm text-emerald-900">
            💡 <strong>Terça-feira</strong> concentra <strong>{pctTerca.toFixed(1)}%</strong> das vendas semanais — confirma a escolha da live às terças.{" "}
            Fim de semana (sáb+dom) representa apenas <strong>{pctFimSemana.toFixed(1)}%</strong> — campanhas WhatsApp VIP são essenciais nesses dias.
          </CardContent>
        </Card>
      </section>

      {/* ============= SEÇÃO 3: PERÍODO DO DIA ============= */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold">3. Padrão por período do dia</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {porPeriodo.map((p) => {
            const isBest = p.key === periodoMaior?.key;
            const Icon = p.Icon;
            const emoji = p.key === "manha" ? "☀️" : p.key === "tarde" ? "🌤️" : "🌙";
            return (
              <Card key={p.key} className={isBest ? "border-emerald-500 border-2" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="flex items-center gap-2 font-semibold">
                      <span className="text-lg">{emoji}</span>
                      <Icon className="h-4 w-4" />
                      {p.label}
                    </CardDescription>
                    {isBest && <Badge className="bg-emerald-600 hover:bg-emerald-600">🏆 Pico</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <div className="text-sm">{num(p.pedidos)} pedidos</div>
                  <div className="text-lg font-bold">{brl(p.receita)}</div>
                  <div className="text-xs text-muted-foreground">Ticket: {brl(p.ticket)}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição de pedidos por período</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              {porPeriodo.map((p) => {
                const pct = totalPedidosPeriodo ? (p.pedidos / totalPedidosPeriodo) * 100 : 0;
                return (
                  <div key={p.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{p.label}</span>
                      <span className="font-semibold">{num(p.pedidos)} · {pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: p.key === periodoMaior?.key ? "hsl(140 55% 40%)" : "hsl(210 70% 55%)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-6 text-sm text-purple-900">
            💡 <strong>{pctPeriodoMaior.toFixed(1)}%</strong> das vendas acontecem à{" "}
            <strong>{periodoMaior?.label?.toLowerCase()}</strong>. Sugestão: publicar conteúdo no Instagram{" "}
            <strong>{horarioPostagem[periodoMaior?.key] || "antes do pico"}</strong> para maximizar conversão.
          </CardContent>
        </Card>
      </section>

      {/* ============= SEÇÃO 4: HEATMAP SEMANA x DIA ============= */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold">4. Cruzamento Semana × Dia</h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mapa de calor — Receita por semana × dia da semana</CardTitle>
            <CardDescription>Verde escuro = mais receita · Vermelho claro = menos receita</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="text-left text-xs uppercase text-muted-foreground p-2"></th>
                    {DIAS_CURTO.map((d) => (
                      <th key={d} className="text-center text-xs uppercase text-muted-foreground p-2">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.matrix.map((row, si) => (
                    <tr key={si}>
                      <td className="p-2 font-medium text-sm">Semana {si + 1}</td>
                      {row.map((c, di) => (
                        <td key={di} className="p-0">
                          <div
                            className="rounded p-2 text-center min-w-[90px]"
                            style={{ backgroundColor: heatColor(c.receita, heatmap.max), color: heatText(c.receita, heatmap.max) }}
                          >
                            <div className="text-sm font-bold">{brl(c.receita)}</div>
                            <div className="text-[10px] opacity-90">{num(c.pedidos)} ped.</div>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6 text-sm text-amber-900">
            🎯 <strong>Melhor janela para lançamentos:</strong>{" "}
            <strong>{DIAS_PT[Object.keys(DIAS_PT)[melhorCelula.dia]] || DIAS_CURTO[melhorCelula.dia]}</strong>{" "}
            da <strong>semana {melhorCelula.semana}</strong> — historicamente o maior volume de vendas do mês ({brl(melhorCelula.receita)}).
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
