import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { startOfMonth, endOfMonth, format, parse } from "date-fns";

async function fetchAll<T = any>(
  table: string,
  build: (q: any) => any
): Promise<T[]> {
  const acc: T[] = [];
  let from = 0;
  const size = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await build(
      supabase.from(table as any).select("*").range(from, from + size - 1)
    );
    if (error) throw error;
    const rows = (data ?? []) as T[];
    acc.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return acc;
}

export interface FaixaBonificacao {
  id: string;
  percentual_minimo: number;
  percentual_maximo: number;
  valor_bonus: number;
  descricao: string | null;
  ativo: boolean;
}

export interface ApuracaoMes {
  id?: string;
  mes: string; // yyyy-MM-dd (primeiro dia)
  total_pedidos: number;
  pedidos_no_prazo: number;
  pedidos_atrasados: number;
  pedidos_pendentes: number;
  percentual_prazo: number;
  valor_bonus: number;
  faixa_atingida: string | null;
  observacao: string | null;
  status: string;
}

interface TrayOrderExp {
  id: string | number;
  date: string | null;
  estimated_delivery_date: string | null;
  shipment_date: string | null;
  orderstatus_type: string | null;
  orderstatus_status: string | null;
  sending_code: string | null;
}

export function useFaixas() {
  return useQuery<FaixaBonificacao[]>({
    queryKey: ["faixas-expedicao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_bonificacao_expedicao" as any)
        .select("*")
        .eq("ativo", true)
        .order("percentual_minimo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FaixaBonificacao[];
    },
  });
}

export function useApurarExpedicao(mesRef: string) {
  // mesRef: "yyyy-MM"
  const { data: faixas = [] } = useFaixas();
  const qc = useQueryClient();

  const apuracaoQuery = useQuery({
    queryKey: ["apuracao-expedicao", mesRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonificacao_expedicao" as any)
        .select("*")
        .eq("mes", `${mesRef}-01`)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ApuracaoMes | null;
    },
  });

  return useMemo(() => {
    const row = apuracaoQuery.data;

    const kpis = row
      ? {
          total_pedidos: Number(row.total_pedidos ?? 0),
          pedidos_no_prazo: Number(row.pedidos_no_prazo ?? 0),
          pedidos_atrasados: Number(row.pedidos_atrasados ?? 0),
          pedidos_pendentes: Number(row.pedidos_pendentes ?? 0),
          percentual_prazo: Number(row.percentual_prazo ?? 0),
        }
      : {
          total_pedidos: 0,
          pedidos_no_prazo: 0,
          pedidos_atrasados: 0,
          pedidos_pendentes: 0,
          percentual_prazo: 0,
        };

    const faixa =
      faixas.find(
        (f) =>
          kpis.percentual_prazo >= Number(f.percentual_minimo) &&
          kpis.percentual_prazo <= Number(f.percentual_maximo)
      ) ?? null;

    return {
      isLoading: apuracaoQuery.isLoading,
      data: row,
      kpis,
      faixa,
      valor_bonus: faixa ? Number(faixa.valor_bonus) : Number(row?.valor_bonus ?? 0),
      faixa_atingida: faixa?.descricao ?? row?.faixa_atingida ?? null,
      faixas,
      refetch: () => qc.invalidateQueries({ queryKey: ["apuracao-expedicao", mesRef] }),
    };
  }, [apuracaoQuery.data, apuracaoQuery.isLoading, faixas, qc, mesRef]);
}

export function useHistoricoExpedicao() {
  return useQuery<ApuracaoMes[]>({
    queryKey: ["historico-expedicao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bonificacao_expedicao" as any)
        .select("*")
        .order("mes", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ApuracaoMes[];
    },
  });
}

export function useFecharApuracao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<ApuracaoMes, "id">) => {
      const { error } = await supabase
        .from("bonificacao_expedicao" as any)
        .upsert(payload as any, { onConflict: "mes" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["historico-expedicao"] });
      qc.invalidateQueries({ queryKey: ["apuracao-expedicao"] });
    },
  });
}

export interface PedidoAtrasado {
  pedido_id: string | number;
  cliente: string | null;
  data_pedido: string | null;
  dias_corridos: number;
  prazo_efetivo: number;
  dias_atraso: number;
  etapa: string | null;
  valor_pedido: number;
  transportadora: string | null;
}

export function useTopAtrasados(limit = 15) {
  return useQuery<PedidoAtrasado[]>({
    queryKey: ["expedicao-top-atrasados", limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("expedicao_top_atrasados", { p_limit: limit });
      if (error) throw error;
      return (data ?? []) as unknown as PedidoAtrasado[];
    },
  });
}

export function useRecalcularExpedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mes: string | null) => {
      const { error } = await supabase.rpc("calcular_bonificacao_expedicao", { p_mes: mes });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apuracao-expedicao"] });
      qc.invalidateQueries({ queryKey: ["historico-expedicao"] });
      qc.invalidateQueries({ queryKey: ["expedicao-top-atrasados"] });
    },
  });
}

export function useSalvarFaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: Partial<FaixaBonificacao> & { id?: string }) => {
      if (f.id) {
        const { error } = await supabase
          .from("config_bonificacao_expedicao" as any)
          .update({
            percentual_minimo: f.percentual_minimo,
            percentual_maximo: f.percentual_maximo,
            valor_bonus: f.valor_bonus,
            descricao: f.descricao,
            ativo: f.ativo,
          } as any)
          .eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("config_bonificacao_expedicao" as any)
          .insert({
            percentual_minimo: f.percentual_minimo ?? 0,
            percentual_maximo: f.percentual_maximo ?? 100,
            valor_bonus: f.valor_bonus ?? 0,
            descricao: f.descricao ?? null,
            ativo: f.ativo ?? true,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["faixas-expedicao"] }),
  });
}

export function useExcluirFaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("config_bonificacao_expedicao" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["faixas-expedicao"] }),
  });
}
