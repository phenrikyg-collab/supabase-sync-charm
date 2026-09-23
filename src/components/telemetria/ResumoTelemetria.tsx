import { useQuery } from "@tanstack/react-query";
import { MousePointerClick, ShoppingCart, ShoppingBag, DollarSign, UserPlus } from "lucide-react";

import { StatCard } from "@/components/StatCard";
import { fetchTelemetriaResumo, fmtBRL, fmtInt, fmtPct } from "@/lib/telemetria";

export function ResumoTelemetria({ de, ate }: { de: string; ate: string }) {
  const { data } = useQuery({
    queryKey: ["telemetria-resumo", de, ate],
    queryFn: () => fetchTelemetriaResumo(de, ate),
    staleTime: 5 * 60_000,
  });
  const r = data ?? null;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
      <StatCard title="Sessões" value={fmtInt(r?.sessoes ?? 0)} icon={MousePointerClick} />
      <StatCard title="Sessões novas" value={fmtInt(r?.sessoes_novas ?? 0)} icon={UserPlus} />
      <StatCard title="Add. Carrinho" value={fmtInt(r?.add_carrinho ?? 0)} icon={ShoppingCart} variant="warning" />
      <StatCard title="Iniciaram Pagto" value={fmtInt(r?.iniciaram_pagto ?? 0)} icon={ShoppingCart} />
      <StatCard title="Compras" value={fmtInt(r?.compras ?? 0)} icon={ShoppingBag} variant="success" />
      <StatCard title="Receita" value={fmtBRL(r?.receita ?? 0)} icon={DollarSign} variant="primary" />
      <StatCard title="Conversão" value={fmtPct(r?.taxa_conversao ?? 0)} icon={ShoppingBag} />
    </div>
  );
}
