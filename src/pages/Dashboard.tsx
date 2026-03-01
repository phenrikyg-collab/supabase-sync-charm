import { useMemo } from "react";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useDashboardExecutivo, useTicketMedio, useIndicadorRisco,
  useResumoProducao, useResumoEstoque, useRolosTecido, useTecidos,
  useExpedicao, useProdutos, useMovimentacoesFinanceiras, useOrdensProducao,
} from "@/hooks/useSupabase";
import {
  DollarSign, Target, TrendingUp, AlertTriangle, Percent, ShoppingCart,
  Layers, Factory, Scissors, CheckCircle, Clock, Truck, Package,
  BarChart3, AlertCircle, ArrowUpRight, ArrowDownRight, Gauge,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

function fmt(value: number | null | undefined) {
  if (value == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
function fmtPct(value: number | null | undefined) {
  if (value == null) return "0,0%";
  return `${Number(value).toFixed(1)}%`;
}

const CHART_COLORS = [
  "hsl(38, 60%, 50%)",   // primary/gold
  "hsl(152, 60%, 40%)",  // success/green
  "hsl(220, 60%, 50%)",  // blue
  "hsl(0, 72%, 51%)",    // danger/red
  "hsl(280, 60%, 50%)",  // purple
  "hsl(200, 70%, 50%)",  // cyan
];

const PROD_COLORS: Record<string, string> = {
  corte: "hsl(38, 60%, 50%)",
  costura: "hsl(38, 92%, 50%)",
  revisao: "hsl(200, 70%, 50%)",
  "em conserto": "hsl(0, 72%, 51%)",
  finalizado: "hsl(152, 60%, 40%)",
};

function RiskIndicator({ level }: { level: string }) {
  const l = level?.toLowerCase() ?? "";
  const config = l === "alto"
    ? { color: "text-danger", bg: "bg-danger/10", border: "border-danger/30", icon: AlertTriangle, label: "Risco Alto" }
    : l === "moderado"
    ? { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", icon: AlertCircle, label: "Risco Moderado" }
    : { color: "text-success", bg: "bg-success/10", border: "border-success/30", icon: CheckCircle, label: "Risco Baixo" };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bg} ${config.border}`}>
      <config.icon className={`h-4 w-4 ${config.color}`} />
      <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
    </div>
  );
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: any }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-xl font-serif font-bold text-foreground">{title}</h2>
    </div>
  );
}

export default function Dashboard() {
  const { data: dashboard } = useDashboardExecutivo();
  const { data: ticketData } = useTicketMedio();
  const { data: riscoData } = useIndicadorRisco();
  const { data: producao } = useResumoProducao();
  const { data: estoque } = useResumoEstoque();
  const { data: rolos } = useRolosTecido();
  const { data: tecidos } = useTecidos();
  const { data: expedicao } = useExpedicao();
  const { data: produtos } = useProdutos();
  const { data: movimentacoes } = useMovimentacoesFinanceiras();
  const { data: ordensProducao } = useOrdensProducao();

  const dash = dashboard?.[0];
  const ticket = ticketData?.[0];
  const risco = riscoData?.[0];

  const metaMensal = dash?.meta_mensal ?? 0;
  const vendido = dash?.vendido ?? 0;
  const progresso = metaMensal > 0 ? (vendido / metaMensal) * 100 : 0;
  const pedidosNecessarios = ticket?.ticket_medio_real && dash?.meta_diaria_necessaria
    ? Math.ceil(dash.meta_diaria_necessaria / ticket.ticket_medio_real) : 0;

  // ── Production stats ──
  const prodCounts = useMemo(() => {
    const counts = { corte: 0, costura: 0, revisao: 0, conserto: 0, finalizado: 0, totalPecas: 0 };
    (producao ?? []).forEach((p) => {
      const s = p.status_ordem?.toLowerCase() ?? "";
      if (s === "corte") counts.corte++;
      else if (s === "costura") counts.costura++;
      else if (["revisao", "revisão"].includes(s)) counts.revisao++;
      else if (s === "em conserto") counts.conserto++;
      else if (s === "finalizado") counts.finalizado++;
      counts.totalPecas += p.quantidade_pecas_ordem ?? 0;
    });
    return counts;
  }, [producao]);

  const totalPecasProducao = useMemo(() =>
    (ordensProducao ?? []).reduce((sum, o) => sum + (o.quantidade ?? o.quantidade_pecas_ordem ?? 0), 0),
    [ordensProducao]
  );

  const prodChartData = useMemo(() => [
    { name: "Corte", value: prodCounts.corte },
    { name: "Costura", value: prodCounts.costura },
    { name: "Revisão", value: prodCounts.revisao },
    { name: "Conserto", value: prodCounts.conserto },
    { name: "Finalizado", value: prodCounts.finalizado },
  ], [prodCounts]);

  const gargalo = useMemo(() => {
    const stages = [
      { name: "Corte", count: prodCounts.corte },
      { name: "Costura", count: prodCounts.costura },
      { name: "Revisão", count: prodCounts.revisao },
      { name: "Conserto", count: prodCounts.conserto },
    ];
    return stages.reduce((max, s) => s.count > max.count ? s : max, { name: "—", count: 0 });
  }, [prodCounts]);

  // ── Stock stats ──
  const tecidoMap = Object.fromEntries((tecidos ?? []).map((t) => [t.id, t]));
  const rolosDisp = rolos?.filter((r) => (r.metragem_disponivel ?? 0) > 0) ?? [];
  const totalMetragem = rolosDisp.reduce((a, r) => a + (r.metragem_disponivel ?? 0), 0);
  const custoEstoque = rolosDisp.reduce((a, r) => {
    const t = r.tecido_id ? tecidoMap[r.tecido_id] : null;
    return a + (r.metragem_disponivel ?? 0) * (t?.custo_por_metro ?? 0);
  }, 0);

  // Estimate daily consumption from ordens_producao
  const consumoMedioDiario = useMemo(() => {
    const totalConsumido = (ordensProducao ?? []).reduce((sum, o) => sum + (o.metragem_consumida ?? o.metragem_tecido_utilizada ?? 0), 0);
    return totalConsumido > 0 ? totalConsumido / 30 : 0;
  }, [ordensProducao]);
  const diasCobertura = consumoMedioDiario > 0 ? Math.round(totalMetragem / consumoMedioDiario) : null;

  // Top 3 products by consumption
  const top3Consumo = useMemo(() => {
    const map = new Map<string, { nome: string; consumo: number }>();
    (ordensProducao ?? []).forEach((o) => {
      const nome = o.nome_produto ?? "—";
      const consumo = o.metragem_consumida ?? o.metragem_tecido_utilizada ?? 0;
      const existing = map.get(nome);
      map.set(nome, { nome, consumo: (existing?.consumo ?? 0) + consumo });
    });
    return Array.from(map.values()).sort((a, b) => b.consumo - a.consumo).slice(0, 3);
  }, [ordensProducao]);

  // ── Margin stats ──
  const margemMedia = useMemo(() => {
    const prods = (produtos ?? []).filter((p) => p.margem_real_percentual != null);
    if (prods.length === 0) return 0;
    return prods.reduce((sum, p) => sum + (p.margem_real_percentual ?? 0), 0) / prods.length;
  }, [produtos]);

  const produtoMaiorMargem = useMemo(() => {
    const prods = (produtos ?? []).filter((p) => p.margem_real_percentual != null);
    return prods.reduce((max, p) => (p.margem_real_percentual ?? 0) > (max?.margem_real_percentual ?? 0) ? p : max, prods[0]);
  }, [produtos]);

  const fatPorProduto = useMemo(() => {
    const map = new Map<string, number>();
    (movimentacoes ?? []).filter((m) => m.tipo?.toLowerCase() === "entrada").forEach((m) => {
      const nome = m.descricao ?? "Outros";
      map.set(nome, (map.get(nome) ?? 0) + (m.valor ?? 0));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: name.substring(0, 20), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [movimentacoes]);

  // ── Expedição stats ──
  const expStats = useMemo(() => {
    const items = expedicao ?? [];
    const statusCounts: Record<string, number> = {};
    let totalDias = 0;
    let countDias = 0;
    items.forEach((p) => {
      const status = p.status_bling ?? "Outros";
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      if (p.dias_corridos != null) { totalDias += p.dias_corridos; countDias++; }
    });
    return {
      total: items.length,
      noPrazo: items.filter((p) => p.nivel_risco?.toLowerCase() === "no prazo").length,
      emAlerta: items.filter((p) => p.nivel_risco?.toLowerCase() === "em alerta").length,
      critico: items.filter((p) => ["critico", "crítico"].includes(p.nivel_risco?.toLowerCase() ?? "")).length,
      tempoMedioEnvio: countDias > 0 ? (totalDias / countDias).toFixed(1) : "—",
      statusCounts,
    };
  }, [expedicao]);

  const expChartData = useMemo(() =>
    Object.entries(expStats.statusCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    [expStats]
  );

  const delay = (i: number) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.04, duration: 0.35 } });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Dashboard <span className="text-primary">Executivo</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Visão estratégica em tempo real do seu negócio</p>
      </div>

      {/* ═══════ BLOCO 1 – VENDAS E META ═══════ */}
      <section>
        <SectionHeader title="Vendas e Meta" icon={Target} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
          <motion.div {...delay(0)}>
            <StatCard title="Faturamento Mês" value={fmt(vendido)} icon={DollarSign} variant="primary" />
          </motion.div>
          <motion.div {...delay(1)}>
            <StatCard title="Meta Mensal" value={fmt(metaMensal)} subtitle={`${progresso.toFixed(1)}% atingido`} icon={Target} />
          </motion.div>
          <motion.div {...delay(2)}>
            <StatCard title="Ticket Médio" value={fmt(ticket?.ticket_medio_real)} icon={TrendingUp} />
          </motion.div>
          <motion.div {...delay(3)}>
            <StatCard title="Desconto Médio" value={fmtPct(dash?.desconto_medio_percentual)} icon={Percent} />
          </motion.div>
          <motion.div {...delay(4)}>
            <StatCard title="Meta Diária" value={fmt(dash?.meta_diaria_necessaria)} subtitle={`~${pedidosNecessarios} pedidos`} icon={ShoppingCart} />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Progress bar + risk */}
          <motion.div {...delay(5)} className="lg:col-span-2">
            <Card className="h-full">
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif font-bold text-foreground">Meta vs Realizado</h3>
                  <RiskIndicator level={risco?.nivel_risco ?? "baixo"} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-bold text-foreground">{progresso.toFixed(1)}%</span>
                  </div>
                  <div className="relative">
                    <Progress value={Math.min(progresso, 100)} className="h-3" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Bruto</p>
                    <p className="text-lg font-bold text-foreground">{fmt(dash?.bruto)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-warning/8 border border-warning/20">
                    <p className="text-[10px] uppercase tracking-wider text-warning font-medium">Falta</p>
                    <p className="text-lg font-bold text-warning">{fmt(dash?.restante)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Dias Rest.</p>
                    <p className="text-lg font-bold text-foreground">{dash?.dias_restantes ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick stats column */}
          <motion.div {...delay(6)}>
            <Card className="h-full">
              <CardContent className="pt-5 space-y-3">
                <h3 className="font-serif font-bold text-foreground">Indicadores</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Total Pedidos</span>
                    <span className="font-bold text-foreground">{ticket?.total_pedidos ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Média Real Diária</span>
                    <span className="font-bold text-foreground">{fmt(risco?.media_real_diaria)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Média Necessária</span>
                    <span className="font-bold text-primary">{fmt(risco?.media_necessaria_diaria)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Pedidos p/ Hoje</span>
                    <span className="font-bold text-foreground">{pedidosNecessarios}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ═══════ BLOCO 2 – PRODUÇÃO ═══════ */}
      <section>
        <SectionHeader title="Produção" icon={Factory} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
          {[
            { label: "Em Corte", count: prodCounts.corte, variant: "warning" as const, icon: Scissors },
            { label: "Em Costura", count: prodCounts.costura, variant: "primary" as const, icon: Factory },
            { label: "Em Revisão", count: prodCounts.revisao, variant: "default" as const, icon: CheckCircle },
            { label: "Em Conserto", count: prodCounts.conserto, variant: "danger" as const, icon: AlertTriangle },
            { label: "Finalizadas", count: prodCounts.finalizado, variant: "success" as const, icon: CheckCircle },
          ].map((item, i) => (
            <motion.div key={item.label} {...delay(i)}>
              <StatCard title={item.label} value={item.count} icon={item.icon} variant={item.variant} />
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div {...delay(5)} className="lg:col-span-2">
            <Card className="h-full">
              <CardContent className="pt-5">
                <h3 className="font-serif font-bold text-foreground mb-4">Produção por Status</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={prodChartData} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,14%,90%)", fontSize: 12 }}
                    />
                    <Bar dataKey="value" name="Ordens" radius={[4, 4, 0, 0]}>
                      {prodChartData.map((entry, i) => (
                        <Cell key={i} fill={PROD_COLORS[entry.name.toLowerCase()] ?? CHART_COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...delay(6)}>
            <Card className="h-full">
              <CardContent className="pt-5 space-y-4">
                <h3 className="font-serif font-bold text-foreground">Resumo</h3>
                <div className="p-3 rounded-lg bg-primary/8 border border-primary/20">
                  <p className="text-[10px] uppercase tracking-wider text-primary font-medium">Total de Peças</p>
                  <p className="text-2xl font-bold text-foreground">{totalPecasProducao}</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/8 border border-warning/20">
                  <p className="text-[10px] uppercase tracking-wider text-warning font-medium">Gargalo</p>
                  <p className="text-lg font-bold text-foreground">{gargalo.name}</p>
                  <p className="text-xs text-muted-foreground">{gargalo.count} ordens acumuladas</p>
                </div>
                {producao && producao.filter((p) => p.status_ordem?.toLowerCase() !== "finalizado").length > 0 && (
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                    {producao.filter((p) => p.status_ordem?.toLowerCase() !== "finalizado").slice(0, 5).map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-1.5">
                          {p.cor_hex && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.cor_hex }} />}
                          <span className="font-medium">{p.nome_produto}</span>
                        </div>
                        <StatusBadge status={p.status_ordem ?? ""} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ═══════ BLOCO 3 – ESTOQUE ═══════ */}
      <section>
        <SectionHeader title="Estoque de Tecidos" icon={Layers} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <motion.div {...delay(0)}>
            <StatCard title="Metragem Total" value={`${totalMetragem.toFixed(1)}m`} icon={Layers} variant="primary" />
          </motion.div>
          <motion.div {...delay(1)}>
            <StatCard title="Custo Estoque" value={fmt(custoEstoque)} icon={DollarSign} variant="default" />
          </motion.div>
          <motion.div {...delay(2)}>
            <StatCard title="Consumo Médio/Dia" value={`${consumoMedioDiario.toFixed(1)}m`} icon={TrendingUp} variant="warning" />
          </motion.div>
          <motion.div {...delay(3)}>
            <StatCard
              title="Dias de Cobertura"
              value={diasCobertura != null ? `${diasCobertura}d` : "—"}
              icon={Clock}
              variant={diasCobertura != null && diasCobertura < 7 ? "danger" : diasCobertura != null && diasCobertura < 15 ? "warning" : "success"}
            />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div {...delay(4)}>
            <Card>
              <CardContent className="pt-5 space-y-2">
                <h3 className="font-serif font-bold text-foreground mb-3">Tecidos por Cor</h3>
                {estoque && estoque.length > 0 ? estoque.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {item.cor_hex && <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: item.cor_hex }} />}
                      <span className="text-foreground">{item.nome_tecido}</span>
                      {item.nome_cor && <span className="text-muted-foreground text-xs">({item.nome_cor})</span>}
                    </div>
                    <span className="font-semibold text-foreground">{(item.metragem_total ?? 0).toFixed(1)}m</span>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sem estoque disponível</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...delay(5)}>
            <Card>
              <CardContent className="pt-5 space-y-2">
                <h3 className="font-serif font-bold text-foreground mb-3">Top 3 — Maior Consumo</h3>
                {top3Consumo.length > 0 ? top3Consumo.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-3 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <span className="text-sm font-medium text-foreground">{item.nome}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{item.consumo.toFixed(1)}m</span>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sem dados de consumo</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ═══════ BLOCO 4 – MARGEM ═══════ */}
      <section>
        <SectionHeader title="Margem e Rentabilidade" icon={Gauge} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <motion.div {...delay(0)}>
            <StatCard
              title="Margem Média Real"
              value={fmtPct(margemMedia)}
              icon={TrendingUp}
              variant={margemMedia > 50 ? "success" : margemMedia > 30 ? "warning" : "danger"}
            />
          </motion.div>
          <motion.div {...delay(1)}>
            <StatCard
              title="Maior Margem"
              value={produtoMaiorMargem?.nome_do_produto ?? "—"}
              subtitle={fmtPct(produtoMaiorMargem?.margem_real_percentual)}
              icon={ArrowUpRight}
              variant="success"
            />
          </motion.div>
          <motion.div {...delay(2)}>
            <StatCard
              title="Total Produtos"
              value={produtos?.length ?? 0}
              icon={Package}
              variant="default"
            />
          </motion.div>
        </div>

        {fatPorProduto.length > 0 && (
          <motion.div {...delay(3)}>
            <Card>
              <CardContent className="pt-5">
                <h3 className="font-serif font-bold text-foreground mb-4">Faturamento por Origem</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={fatPorProduto} barSize={32} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 90%)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" tickFormatter={(v) => fmt(v)} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,14%,90%)", fontSize: 12 }}
                      formatter={(value: number) => fmt(value)}
                    />
                    <Bar dataKey="value" name="Faturamento" fill="hsl(38, 60%, 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </section>

      {/* ═══════ BLOCO 5 – EXPEDIÇÃO ═══════ */}
      <section>
        <SectionHeader title="Expedição" icon={Truck} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <motion.div {...delay(0)}>
            <StatCard title="No Prazo" value={expStats.noPrazo} icon={CheckCircle} variant="success" />
          </motion.div>
          <motion.div {...delay(1)}>
            <StatCard title="Em Alerta" value={expStats.emAlerta} icon={AlertTriangle} variant="warning" />
          </motion.div>
          <motion.div {...delay(2)}>
            <StatCard title="Crítico" value={expStats.critico} icon={AlertCircle} variant="danger" />
          </motion.div>
          <motion.div {...delay(3)}>
            <StatCard title="Tempo Médio Envio" value={`${expStats.tempoMedioEnvio}d`} icon={Clock} variant="default" />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {expChartData.length > 0 && (
            <motion.div {...delay(4)}>
              <Card>
                <CardContent className="pt-5">
                  <h3 className="font-serif font-bold text-foreground mb-4">Pedidos por Status</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={expChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {expChartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div {...delay(5)}>
            <Card>
              <CardContent className="pt-5 space-y-2">
                <h3 className="font-serif font-bold text-foreground mb-3">Status Detalhado</h3>
                {Object.entries(expStats.statusCounts).length > 0 ? (
                  Object.entries(expStats.statusCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count], i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/40">
                        <span className="text-sm text-foreground">{status}</span>
                        <Badge variant="secondary" className="text-xs font-bold">{count}</Badge>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sem pedidos de expedição</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
