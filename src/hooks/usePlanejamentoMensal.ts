import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PlanejamentoMensal {
  id: string;
  ano: number;
  mes: number;
  tipo: "planejado" | "realizado";
  status: "rascunho" | "aprovado" | "fechado";
  receita_captada: number | null;
  taxa_aprovacao: number | null;
  pedidos_captados: number | null;
  taxa_aquisicao: number | null;
  sessoes_totais: number | null;
  sessoes_midia: number | null;
  investimento_total: number | null;
  receita_faturada: number | null;
  receita_aquisicao: number | null;
  receita_retencao: number | null;
  pedidos_faturados: number | null;
  pedidos_aquisicao: number | null;
  pedidos_retencao: number | null;
  taxa_retencao: number | null;
  ticket_medio_aquisicao: number | null;
  ticket_medio_retencao: number | null;
  ticket_medio_geral: number | null;
  cps_geral: number | null;
  cps_midia: number | null;
  cac_novos: number | null;
  cac_geral: number | null;
  roas_faturado: number | null;
  adcost_pct: number | null;
  peso_mes_pct: number | null;
  observacoes: string | null;
  receita_cancelada: number | null;
  taxa_conversao: number | null;
}

export const CAMPOS_MANUAIS = [
  "receita_captada",
  "taxa_aprovacao",
  "pedidos_captados",
  "taxa_aquisicao",
  "sessoes_totais",
  "sessoes_midia",
  "investimento_total",
] as const;

export function usePlanejamentoMensal(ano: number, mes: number, tipo: "planejado" | "realizado") {
  const [data, setData] = useState<PlanejamentoMensal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    const { data: row, error: e } = await (supabase as any)
      .from("planejamento_mensal")
      .select("*")
      .eq("ano", ano)
      .eq("mes", mes)
      .eq("tipo", tipo)
      .maybeSingle();
    if (e) setError(e.message);
    setData((row as PlanejamentoMensal) ?? null);
    setIsLoading(false);
  }, [ano, mes, tipo]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const salvarCamposManuais = async (campos: Partial<PlanejamentoMensal>) => {
    setIsSaving(true);
    try {
      const payload: any = { ano, mes, tipo };
      for (const k of CAMPOS_MANUAIS) {
        if (k in campos) payload[k] = (campos as any)[k];
      }
      let res;
      if (data?.id) {
        res = await (supabase as any).from("planejamento_mensal").update(payload).eq("id", data.id);
      } else {
        res = await (supabase as any).from("planejamento_mensal").insert(payload);
      }
      if (res.error) throw res.error;
      await fetch();
      toast.success("Salvo 💛", { duration: 2000 });
    } catch (e: any) {
      toast.error("Erro ao salvar. Tente novamente.");
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const aprovarMes = async () => {
    if (!data?.id) return;
    const { error: e } = await (supabase as any)
      .from("planejamento_mensal")
      .update({ status: "aprovado" })
      .eq("id", data.id);
    if (e) toast.error("Erro ao aprovar");
    else {
      toast.success("Mês aprovado 💛");
      fetch();
    }
  };

  return { data, isLoading, isSaving, error, salvarCamposManuais, aprovarMes, refetch: fetch };
}

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const fmtBRL = (v: number | null | undefined) =>
  v == null || !isFinite(v)
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const fmtNum = (v: number | null | undefined, decimals = 0) =>
  v == null || !isFinite(v) ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: decimals });

export const fmtPct = (v: number | null | undefined) =>
  v == null || !isFinite(v) ? "—" : `${Number(v).toFixed(1)}%`;
