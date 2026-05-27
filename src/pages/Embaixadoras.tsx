import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/StatCard";
import { Plus, Users, Clock, AlertTriangle, DollarSign, Ticket, Loader2 } from "lucide-react";
import {
  useEmbaixadorasDashboard,
  useEntregas,
  TIER_LABELS,
  TIER_BADGE_CLASS,
  STATUS_INFLU_LABELS,
  type Tier,
  type StatusInfluenciadora,
} from "@/hooks/useEmbaixadoras";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function formatCurrency(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function mesAtualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// KPIs específicos: entregas atrasadas e cupons/receita do mês
function useKpisMes() {
  const mes = mesAtualISO();
  return useQuery({
    queryKey: ["embaixadoras", "kpis-mes", mes],
    queryFn: async () => {
      const sb: any = supabase;
      const inicio = `${mes}-01`;
      const [y, m] = mes.split("-").map(Number);
      const fimDate = new Date(y, m, 0);
      const fim = `${y}-${String(m).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;

      const [entregasResp, metricasResp] = await Promise.all([
        sb
          .from("influenciadoras_entregas")
          .select("id, status_entrega, prazo_publicacao, receita_gerada, vendas_cupom, data_publicacao_real"),
        sb.from("influenciadoras_metricas_mensais").select("*").eq("mes_ano", `${mes}-01`),
      ]);
      if (entregasResp.error) throw entregasResp.error;
      if (metricasResp.error) throw metricasResp.error;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const atrasadas = (entregasResp.data || []).filter((e: any) => {
        if (e.status_entrega !== "pendente") return false;
        if (!e.prazo_publicacao) return false;
        return new Date(e.prazo_publicacao) < hoje;
      }).length;

      const noMes = (entregasResp.data || []).filter((e: any) => {
        const d = e.data_publicacao_real;
        return d && d >= inicio && d <= fim;
      });
      const receitaMes = noMes.reduce((s: number, e: any) => s + Number(e.receita_gerada || 0), 0);
      const cuponsMes = noMes.reduce((s: number, e: any) => s + Number(e.vendas_cupom || 0), 0);
      const cuponsMesMetricas = (metricasResp.data || []).reduce(
        (s: number, m: any) => s + Number(m.usos_cupom || 0),
        0
      );
      const receitaMetricas = (metricasResp.data || []).reduce(
        (s: number, m: any) => s + Number(m.receita_gerada || 0),
        0
      );

      return {
        atrasadas,
        receitaMes: receitaMes + receitaMetricas,
        cuponsMes: cuponsMes + cuponsMesMetricas,
      };
    },
  });
}

export default function Embaixadoras() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useEmbaixadorasDashboard();
  const { data: kpis } = useKpisMes();
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busca, setBusca] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tierFilter !== "all" && r.tier !== tierFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (busca) {
        const b = busca.toLowerCase();
        if (!(r.nome?.toLowerCase().includes(b) || r.instagram?.toLowerCase().includes(b))) return false;
      }
      return true;
    });
  }, [rows, tierFilter, statusFilter, busca]);

  const totalAtivas = rows.filter((r) => r.status === "ativa").length;
  const totalPendentes = rows.filter((r) => r.status === "pendente de aprovação").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Embaixadoras</h1>
          <p className="text-sm text-muted-foreground">
            Programa de Micro Influenciadoras e Clientes Embaixadoras
          </p>
        </div>
        <Button onClick={() => navigate("/embaixadoras/nova")}>
          <Plus className="h-4 w-4 mr-2" /> Nova Embaixadora
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard title="Total Ativas" value={String(totalAtivas)} icon={Users} />
        <StatCard title="Para Aprovação" value={String(totalPendentes)} icon={Clock} />
        <StatCard
          title="Entregas Atrasadas"
          value={String(kpis?.atrasadas ?? 0)}
          icon={AlertTriangle}
          valueClassName={(kpis?.atrasadas ?? 0) > 0 ? "text-red-600" : undefined}
        />
        <StatCard title="Receita Gerada (mês)" value={formatCurrency(kpis?.receitaMes)} icon={DollarSign} />
        <StatCard title="Cupons Usados (mês)" value={String(kpis?.cuponsMes ?? 0)} icon={Ticket} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <Input
              placeholder="Buscar por nome ou @instagram..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="max-w-sm"
            />
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tiers</SelectItem>
                {(Object.keys(TIER_LABELS) as Tier[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIER_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {(Object.keys(STATUS_INFLU_LABELS) as StatusInfluenciadora[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_INFLU_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome / Instagram</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Seguidores</TableHead>
                    <TableHead className="text-right">Engajamento</TableHead>
                    <TableHead>Cupom</TableHead>
                    <TableHead className="text-right">Entregas</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhuma embaixadora encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate(`/embaixadoras/${r.id}`)}
                      >
                        <TableCell>
                          <div className="font-medium">{r.nome}</div>
                          <div className="text-xs text-muted-foreground">{r.instagram || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={TIER_BADGE_CLASS[r.tier]} variant="outline">
                            {TIER_LABELS[r.tier] || r.tier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{STATUS_INFLU_LABELS[r.status] || r.status}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.seguidores_instagram?.toLocaleString("pt-BR") || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.taxa_engajamento != null ? `${Number(r.taxa_engajamento).toFixed(2)}%` : "—"}
                        </TableCell>
                        <TableCell>
                          {r.cupom_exclusivo ? (
                            <code className="px-1.5 py-0.5 rounded bg-muted text-xs">{r.cupom_exclusivo}</code>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm">
                            {r.entregas_publicadas}/{r.total_entregas}
                          </span>
                          {r.entregas_atrasadas > 0 && (
                            <span className="ml-2 text-xs text-red-600">{r.entregas_atrasadas} atr.</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_receita_gerada)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
