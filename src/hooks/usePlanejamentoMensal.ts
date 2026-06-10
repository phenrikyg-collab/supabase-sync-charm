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
  // Planejado-only
  sessoes_organicas: number | null;
  premissa_taxa_conversao: number | null;
  premissa_ticket_medio: number | null;
  premissa_taxa_aprovacao: number | null;
  premissa_taxa_aquisicao: number | null;
  premissa_cps_midia: number | null;
}

export const CAMPOS_MANUAIS_REALIZADO = [
  "receita_captada",
  "taxa_aprovacao",
  "pedidos_captados",
  "taxa_aquisicao",
  "sessoes_totais",
  "sessoes_midia",
  "investimento_total",
] as const;

export const CAMPOS_MANUAIS_PLANEJADO = [
  "sessoes_totais",
  "sessoes_organicas",
  "premissa_taxa_conversao",
  "premissa_ticket_medio",
  "premissa_taxa_aprovacao",
  "premissa_taxa_aquisicao",
  "premissa_cps_midia",
] as const;

// Compat
export const CAMPOS_MANUAIS = CAMPOS_MANUAIS_REALIZADO;

export interface MediaHistorica {
  taxa_conversao: number | null;
  ticket_medio: number | null;
  taxa_aprovacao: number | null;
  taxa_aquisicao: number | null;
  cps_midia: number | null;
  sessoes_organicas: number | null;
  sessoes_totais: number | null;
  receita_captada: number | null;
  pedidos_captados: number | null;
  investimento_total: number | null;
  roas_faturado: number | null;
  cac_novos: number | null;
}

export async function buscarMediaHistorica(ano: number, mes: number): Promise<MediaHistorica | null> {
  const { data, error } = await (supabase as any).rpc("media_historica", { p_ano: ano, p_mes: mes });
  if (error) {
    console.error("media_historica", error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row as MediaHistorica) ?? null;
}

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
      const tipoAtual = (data?.tipo ?? tipo) as "planejado" | "realizado";
      const lista = tipoAtual === "planejado" ? CAMPOS_MANUAIS_PLANEJADO : CAMPOS_MANUAIS_REALIZADO;

      const payload: Record<string, any> = {};
      for (const k of lista) {
        if (k in campos) payload[k] = (campos as any)[k];
      }

      let recordId = data?.id;

      if (recordId) {
        const { error: updateError } = await (supabase as any)
          .from("planejamento_mensal")
          .update(payload)
          .eq("id", recordId);
        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await (supabase as any)
          .from("planejamento_mensal")
          .insert({ ...payload, ano, mes, tipo: tipoAtual })
          .select("id")
          .single();
        if (insertError) throw insertError;
        recordId = inserted.id;
      }

      const { data: updated, error: selectError } = await (supabase as any)
        .from("planejamento_mensal")
        .select("*")
        .eq("id", recordId)
        .single();
      if (selectError) throw selectError;

      setData(updated as PlanejamentoMensal);
      toast.success("Salvo 💛", { duration: 2000 });
    } catch (e: any) {
      console.error(e);
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
