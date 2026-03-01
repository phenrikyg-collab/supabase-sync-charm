import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useDashboardExecutivo, useTicketMedio, useIndicadorRisco, useResumoProducao, useResumoEstoque } from "@/hooks/useSupabase";
import { DollarSign, Target, TrendingUp, AlertTriangle, Percent, ShoppingCart, BarChart3, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "0%";
  return `${Number(value).toFixed(1)}%`;
}

export default function Dashboard() {
  const { data: dashboard } = useDashboardExecutivo();
  const { data: ticketData } = useTicketMedio();
  const { data: riscoData } = useIndicadorRisco();
  const { data: producao } = useResumoProducao();
  const { data: estoque } = useResumoEstoque();

  const dash = dashboard?.[0];
  const ticket = ticketData?.[0];
  const risco = riscoData?.[0];

  const nivelRisco = risco?.nivel_risco ?? "baixo";
  const riskVariant = nivelRisco === "alto" ? "danger" : nivelRisco === "moderado" ? "warning" : "success";

  // Production counts by status
  const prodCounts = {
    corte: producao?.filter((p) => p.status_ordem?.toLowerCase() === "corte").length ?? 0,
    costura: producao?.filter((p) => p.status_ordem?.toLowerCase() === "costura").length ?? 0,
    revisao: producao?.filter((p) => ["revisao", "revisão"].includes(p.status_ordem?.toLowerCase() ?? "")).length ?? 0,
    finalizado: producao?.filter((p) => p.status_ordem?.toLowerCase() === "finalizado").length ?? 0,
  };

  // Estoque total
  const totalMetragem = estoque?.reduce((acc, e) => acc + (e.metragem_total ?? 0), 0) ?? 0;

  // Estimativa pedidos necessários
  const pedidosNecessarios = ticket?.ticket_medio_real && dash?.meta_diaria_necessaria
    ? Math.ceil(dash.meta_diaria_necessaria / ticket.ticket_medio_real)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Dashboard Executivo</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da operação</p>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Faturamento do Mês"
          value={formatCurrency(dash?.vendido)}
          subtitle={`Meta: ${formatCurrency(dash?.meta_mensal)}`}
          icon={DollarSign}
          variant="primary"
        />
        <StatCard
          title="Meta Diária Necessária"
          value={formatCurrency(dash?.meta_diaria_necessaria)}
          subtitle={`${dash?.dias_restantes ?? 0} dias restantes`}
          icon={Target}
          variant="default"
        />
        <StatCard
          title="Ticket Médio Real"
          value={formatCurrency(ticket?.ticket_medio_real)}
          subtitle={`${ticket?.total_pedidos ?? 0} pedidos`}
          icon={ShoppingCart}
          variant="default"
        />
        <StatCard
          title="Desconto Médio"
          value={formatPercent(dash?.desconto_medio_percentual)}
          icon={Percent}
          variant="default"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Estimativa Pedidos/Dia"
          value={pedidosNecessarios}
          subtitle="Para atingir a meta diária"
          icon={BarChart3}
          variant="default"
        />
        <StatCard
          title="Restante da Meta"
          value={formatCurrency(dash?.restante)}
          subtitle={`${dash?.dias_uteis ?? 0} dias úteis no mês`}
          icon={TrendingUp}
          variant="default"
        />
        <StatCard
          title="Risco da Meta"
          value={nivelRisco.charAt(0).toUpperCase() + nivelRisco.slice(1)}
          subtitle={`Média necessária: ${formatCurrency(risco?.media_necessaria_diaria)}`}
          icon={AlertTriangle}
          variant={riskVariant}
        />
      </div>

      {/* Produção em andamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Produção em Andamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Em Corte", count: prodCounts.corte, status: "corte" },
                { label: "Em Costura", count: prodCounts.costura, status: "costura" },
                { label: "Em Revisão", count: prodCounts.revisao, status: "revisao" },
                { label: "Finalizadas", count: prodCounts.finalizado, status: "finalizado" },
              ].map((item) => (
                <div key={item.status} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    <span className="text-sm text-card-foreground">{item.label}</span>
                  </div>
                  <span className="text-xl font-serif font-bold text-card-foreground">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estoque de Tecidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="text-sm text-card-foreground">Metragem Total</span>
                </div>
                <span className="text-xl font-serif font-bold text-card-foreground">{totalMetragem.toFixed(1)}m</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {estoque?.slice(0, 8).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      {item.cor_hex && (
                        <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: item.cor_hex }} />
                      )}
                      <span className="text-card-foreground">{item.nome_tecido}</span>
                      {item.nome_cor && <span className="text-muted-foreground">({item.nome_cor})</span>}
                    </div>
                    <span className="font-medium text-card-foreground">{(item.metragem_total ?? 0).toFixed(1)}m</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
