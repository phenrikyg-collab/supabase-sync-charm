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

  const pedidosQuery = useQuery({
    queryKey: ["pedidos-expedicao", mesRef],
    queryFn: async () => {
      const dt = parse(mesRef + "-01", "yyyy-MM-dd", new Date());
      const di = format(startOfMonth(dt), "yyyy-MM-dd");
      const df = format(endOfMonth(dt), "yyyy-MM-dd");
      return await fetchAll<TrayOrderExp>("tray_orders", (q: any) =>
        q
          .gte("date", di)
          .lte("date", df)
          .neq("orderstatus_type", "canceled")
          .not("estimated_delivery_date", "is", null)
      );
    },
  });

  return useMemo(() => {
    const pedidos = pedidosQuery.data ?? [];
    let no_prazo = 0;
    let atrasados = 0;
    let pendentes = 0;

    for (const p of pedidos) {
      if (!p.shipment_date) {
        pendentes += 1;
      } else if (p.estimated_delivery_date && p.shipment_date <= p.estimated_delivery_date) {
        no_prazo += 1;
      } else {
        atrasados += 1;
      }
    }

    const total = pedidos.length;
    const enviados = no_prazo + atrasados;
    const percentual_prazo = enviados > 0 ? (no_prazo / enviados) * 100 : 0;

    const faixa =
      faixas.find(
        (f) =>
          percentual_prazo >= Number(f.percentual_minimo) &&
          percentual_prazo <= Number(f.percentual_maximo)
      ) ?? null;

    return {
      isLoading: pedidosQuery.isLoading,
      pedidos,
      kpis: {
        total_pedidos: total,
        pedidos_no_prazo: no_prazo,
        pedidos_atrasados: atrasados,
        pedidos_pendentes: pendentes,
        percentual_prazo,
      },
      faixa,
      valor_bonus: faixa ? Number(faixa.valor_bonus) : 0,
      faixa_atingida: faixa?.descricao ?? null,
      faixas,
    };
  }, [pedidosQuery.data, pedidosQuery.isLoading, faixas]);
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
