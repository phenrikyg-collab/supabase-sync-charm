import { useState } from "react";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useDashboardExecutivo, useTicketMedio, useIndicadorRisco, useResumoProducao, useResumoEstoque, useRolosTecido, useTecidos } from "@/hooks/useSupabase";
import { DollarSign, Target, TrendingUp, AlertTriangle, Percent, ShoppingCart, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "0.0%";
  return `${Number(value).toFixed(1)}%`;
}

export default function Dashboard() {
  const { data: dashboard } = useDashboardExecutivo();
  const { data: ticketData } = useTicketMedio();
  const { data: riscoData } = useIndicadorRisco();
  const { data: producao } = useResumoProducao();
  const { data: estoque } = useResumoEstoque();
  const { data: rolos } = useRolosTecido();
  const { data: tecidos } = useTecidos();

  const dash = dashboard?.[0];
  const ticket = ticketData?.[0];
  const risco = riscoData?.[0];

  const nivelRisco = risco?.nivel_risco ?? "baixo";
  const riskLabel = nivelRisco === "alto" ? "Risco Alto" : nivelRisco === "moderado" ? "Risco Moderado" : "Risco Baixo";
  const riskMsg = nivelRisco === "alto" ? "Meta em risco! Ações imediatas necessárias" : nivelRisco === "moderado" ? "Atenção: ritmo de vendas precisa aumentar" : "Necessário manter o ritmo atual nas vendas diárias para atingir a meta";

  const metaMensal = dash?.meta_mensal ?? 0;
  const vendido = dash?.vendido ?? 0;
  const progresso = metaMensal > 0 ? (vendido / metaMensal) * 100 : 0;

  const pedidosNecessarios = ticket?.ticket_medio_real && dash?.meta_diaria_necessaria
    ? Math.ceil(dash.meta_diaria_necessaria / ticket.ticket_medio_real) : 0;

  // Production counts
  const prodCounts = {
    corte: producao?.filter((p) => p.status_ordem?.toLowerCase() === "corte").length ?? 0,
    costura: producao?.filter((p) => p.status_ordem?.toLowerCase() === "costura").length ?? 0,
    revisao: producao?.filter((p) => ["revisao", "revisão"].includes(p.status_ordem?.toLowerCase() ?? "")).length ?? 0,
    finalizado: producao?.filter((p) => p.status_ordem?.toLowerCase() === "finalizado").length ?? 0,
  };

  const tecidoMap = Object.fromEntries((tecidos ?? []).map((t) => [t.id, t]));
  const rolosDisp = rolos?.filter((r) => (r.metragem_disponivel ?? 0) > 0) ?? [];
  const totalMetragem = rolosDisp.reduce((a, r) => a + (r.metragem_disponivel ?? 0), 0);
  const custoEstoque = rolosDisp.reduce((a, r) => {
    const t = r.tecido_id ? tecidoMap[r.tecido_id] : null;
    return a + (r.metragem_disponivel ?? 0) * (t?.custo_por_metro ?? 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Dashboard <span className="text-primary">Executivo</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do seu negócio em tempo real</p>
      </div>

      <Tabs defaultValue="vendas">
        <TabsList>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="producao">Produção</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard title="Faturamento Mês" value={formatCurrency(vendido)} icon={DollarSign} variant="primary" />
            <StatCard title="Meta Mensal" value={formatCurrency(metaMensal)} subtitle={`${progresso.toFixed(1)}% atingido`} icon={Target} variant="default" />
            <StatCard title="Ticket Médio" value={formatCurrency(ticket?.ticket_medio_real)} icon={TrendingUp} variant="default" />
            <StatCard title="Desconto Médio" value={formatPercent(dash?.desconto_medio_percentual)} icon={Percent} variant="default" />
            <StatCard
              title="Meta do Dia"
              value={formatCurrency(dash?.meta_diaria_necessaria)}
              subtitle={`Vendido: ${formatCurrency(vendido)} (${progresso.toFixed(1)}%) · ~${pedidosNecessarios} pedidos restantes`}
              icon={Target}
              variant="default"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-serif font-bold text-foreground">Meta vs Realizado</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progresso da Meta</span>
                    <span className="text-foreground font-medium">{progresso.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(progresso, 100)} className="h-2" />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Meta Diária Necessária</span>
                  <span className="text-primary font-medium">{formatCurrency(dash?.meta_diaria_necessaria)}</span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="font-medium text-sm text-foreground">{riskLabel}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{riskMsg}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-3">
                <h3 className="font-serif font-bold text-foreground">Resumo</h3>
                <div className="flex justify-between text-sm py-2">
                  <span className="text-muted-foreground">Faturamento Bruto</span>
                  <span className="text-foreground font-medium">{formatCurrency(dash?.bruto)}</span>
                </div>
                <div className="flex justify-between text-sm py-2">
                  <span className="text-muted-foreground">Meta Mensal</span>
                  <span className="text-foreground font-medium">{formatCurrency(metaMensal)}</span>
                </div>
                <div className="flex justify-between text-sm py-2 bg-warning/10 rounded-lg px-3">
                  <span className="text-muted-foreground">Falta para Meta</span>
                  <span className="text-foreground font-bold">{formatCurrency(dash?.restante)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="producao" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Em Corte", count: prodCounts.corte, status: "corte" },
              { label: "Em Costura", count: prodCounts.costura, status: "costura" },
              { label: "Em Revisão", count: prodCounts.revisao, status: "revisao" },
              { label: "Finalizadas", count: prodCounts.finalizado, status: "finalizado" },
            ].map((item) => (
              <Card key={item.status}>
                <CardContent className="pt-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    <span className="text-sm text-card-foreground">{item.label}</span>
                  </div>
                  <span className="text-2xl font-serif font-bold text-card-foreground">{item.count}</span>
                </CardContent>
              </Card>
            ))}
          </div>
          {producao && producao.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-2">
                <h3 className="font-serif font-bold text-foreground mb-3">Ordens em Andamento</h3>
                {producao.filter((p) => p.status_ordem?.toLowerCase() !== "finalizado").map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {p.cor_hex && <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: p.cor_hex }} />}
                      <span className="font-medium text-sm">{p.nome_produto}</span>
                      {p.nome_cor && <span className="text-xs text-muted-foreground">({p.nome_cor})</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {p.nome_oficina && <span className="text-xs text-muted-foreground">{p.nome_oficina}</span>}
                      <StatusBadge status={p.status_ordem ?? ""} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="estoque" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard title="Metragem Total" value={`${totalMetragem.toFixed(1)}m`} icon={Layers} variant="primary" />
            <StatCard title="Custo Total em Estoque" value={formatCurrency(custoEstoque)} icon={DollarSign} variant="default" />
          </div>
          <Card>
            <CardContent className="pt-6 space-y-2">
              <h3 className="font-serif font-bold text-foreground mb-3">Tecidos por Cor</h3>
              {estoque?.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    {item.cor_hex && <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: item.cor_hex }} />}
                    <span className="text-card-foreground">{item.nome_tecido}</span>
                    {item.nome_cor && <span className="text-muted-foreground">({item.nome_cor})</span>}
                  </div>
                  <span className="font-medium text-card-foreground">{(item.metragem_total ?? 0).toFixed(1)}m</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Faturamento Bruto" value={formatCurrency(dash?.bruto)} icon={DollarSign} variant="primary" />
            <StatCard title="Restante da Meta" value={formatCurrency(dash?.restante)} subtitle={`${dash?.dias_restantes ?? 0} dias restantes`} icon={Target} variant="default" />
            <StatCard title="Estimativa Pedidos/Dia" value={pedidosNecessarios} subtitle="Para atingir a meta diária" icon={ShoppingCart} variant="default" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
