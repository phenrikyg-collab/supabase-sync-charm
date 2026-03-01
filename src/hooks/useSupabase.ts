import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Produto, Cor, Tecido, RoloTecido, OrdemCorte, OrdemCorteGrade,
  OrdemCorteProduto, OrdemCorteRolo, OrdemProducao, Oficina,
  MovimentacaoFinanceira, MetaFinanceira, CategoriaFinanceira,
  CentroCusto, DashboardExecutivo, TicketMedioMes, IndicadorRiscoMeta,
  ResumoProducaoAndamento, ResumoEstoqueTecidos, ExpedicaoStatus,
} from "@/types/database";

// Generic fetch helper
async function fetchTable<T>(table: string, options?: { 
  orderBy?: string; 
  ascending?: boolean;
  filters?: Record<string, any>;
  limit?: number;
}): Promise<T[]> {
  let query = supabase.from(table).select("*");
  if (options?.filters) {
    Object.entries(options.filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
  }
  if (options?.orderBy) {
    query = query.order(options.orderBy, { ascending: options.ascending ?? false });
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as T[];
}

// Dashboard
export const useDashboardExecutivo = () =>
  useQuery({ queryKey: ["dashboard-executivo"], queryFn: () => fetchTable<DashboardExecutivo>("vw_dashboard_executivo") });

export const useTicketMedio = () =>
  useQuery({ queryKey: ["ticket-medio"], queryFn: () => fetchTable<TicketMedioMes>("vw_ticket_medio_mes") });

export const useIndicadorRisco = () =>
  useQuery({ queryKey: ["indicador-risco"], queryFn: () => fetchTable<IndicadorRiscoMeta>("vw_indicador_risco_meta") });

export const useResumoProducao = () =>
  useQuery({ queryKey: ["resumo-producao"], queryFn: () => fetchTable<ResumoProducaoAndamento>("resumo_producao_andamento") });

export const useResumoEstoque = () =>
  useQuery({ queryKey: ["resumo-estoque"], queryFn: () => fetchTable<ResumoEstoqueTecidos>("resumo_estoque_tecidos") });

// Produtos
export const useProdutos = () =>
  useQuery({ queryKey: ["produtos"], queryFn: () => fetchTable<Produto>("produtos", { orderBy: "nome_do_produto", ascending: true }) });

export const useProduto = (id: string) =>
  useQuery({
    queryKey: ["produto", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Produto;
    },
    enabled: !!id,
  });

export const useCreateProduto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (produto: Partial<Produto>) => {
      const { data, error } = await supabase.from("produtos").insert(produto).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
  });
};

export const useUpdateProduto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Produto> & { id: string }) => {
      const { data, error } = await supabase.from("produtos").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
  });
};

// Cores
export const useCores = () =>
  useQuery({ queryKey: ["cores"], queryFn: () => fetchTable<Cor>("cores", { orderBy: "nome_cor", ascending: true }) });

export const useCreateCor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cor: Partial<Cor>) => {
      const { data, error } = await supabase.from("cores").insert(cor).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cores"] }),
  });
};

export const useUpdateCor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Cor> & { id: string }) => {
      const { data, error } = await supabase.from("cores").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cores"] }),
  });
};

export const useDeleteCor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cores"] }),
  });
};

// Tecidos
export const useTecidos = () =>
  useQuery({ queryKey: ["tecidos"], queryFn: () => fetchTable<Tecido>("tecidos", { orderBy: "nome_tecido", ascending: true }) });

// Rolos de tecido
export const useRolosTecido = () =>
  useQuery({ queryKey: ["rolos-tecido"], queryFn: () => fetchTable<RoloTecido>("rolos_tecido", { orderBy: "created_at" }) });

// Ordens de Corte
export const useOrdensCorte = () =>
  useQuery({ queryKey: ["ordens-corte"], queryFn: () => fetchTable<OrdemCorte>("ordens_corte", { orderBy: "created_at" }) });

export const useOrdemCorteGrade = (ordemId: string) =>
  useQuery({
    queryKey: ["ordem-corte-grade", ordemId],
    queryFn: () => fetchTable<OrdemCorteGrade>("ordens_corte_grade", { filters: { ordem_corte_id: ordemId } }),
    enabled: !!ordemId,
  });

export const useOrdemCorteProdutos = (ordemId: string) =>
  useQuery({
    queryKey: ["ordem-corte-produtos", ordemId],
    queryFn: () => fetchTable<OrdemCorteProduto>("ordens_corte_produtos", { filters: { ordem_corte_id: ordemId } }),
    enabled: !!ordemId,
  });

export const useOrdemCorteRolos = (ordemId: string) =>
  useQuery({
    queryKey: ["ordem-corte-rolos", ordemId],
    queryFn: () => fetchTable<OrdemCorteRolo>("ordens_corte_rolos", { filters: { ordem_corte_id: ordemId } }),
    enabled: !!ordemId,
  });

// Ordens de Produção
export const useOrdensProducao = () =>
  useQuery({ queryKey: ["ordens-producao"], queryFn: () => fetchTable<OrdemProducao>("ordens_producao", { orderBy: "created_at" }) });

// Oficinas
export const useOficinas = () =>
  useQuery({ queryKey: ["oficinas"], queryFn: () => fetchTable<Oficina>("oficinas", { orderBy: "nome_oficina", ascending: true }) });

// Movimentações Financeiras
export const useMovimentacoesFinanceiras = () =>
  useQuery({ queryKey: ["movimentacoes"], queryFn: () => fetchTable<MovimentacaoFinanceira>("movimentacoes_financeiras", { orderBy: "data" }) });

// Metas
export const useMetasFinanceiras = () =>
  useQuery({ queryKey: ["metas"], queryFn: () => fetchTable<MetaFinanceira>("metas_financeiras", { orderBy: "mes" }) });

export const useCreateMeta = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meta: Partial<MetaFinanceira>) => {
      const { data, error } = await supabase.from("metas_financeiras").insert(meta).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["metas"] }),
  });
};

// Expedição
export const useExpedicao = () =>
  useQuery({ queryKey: ["expedicao"], queryFn: () => fetchTable<ExpedicaoStatus>("vw_expedicao_status") });

// Categorias e Centros de Custo
export const useCategorias = () =>
  useQuery({ queryKey: ["categorias"], queryFn: () => fetchTable<CategoriaFinanceira>("categorias_financeiras") });

export const useCentrosCusto = () =>
  useQuery({ queryKey: ["centros-custo"], queryFn: () => fetchTable<CentroCusto>("centros_custos") });

// Create Ordem Corte
export const useCreateOrdemCorte = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ordem: Partial<OrdemCorte>;
      produtos: { produto_id: string; nome_produto: string }[];
      grade: { cor_id: string; tamanho: string; quantidade: number }[];
      rolos: { rolo_id: string; metragem_utilizada: number }[];
    }) => {
      const { data: ordem, error: ordemErr } = await supabase
        .from("ordens_corte")
        .insert(payload.ordem)
        .select()
        .single();
      if (ordemErr) throw ordemErr;

      if (payload.produtos.length > 0) {
        const { error } = await supabase
          .from("ordens_corte_produtos")
          .insert(payload.produtos.map((p) => ({ ...p, ordem_corte_id: ordem.id })));
        if (error) throw error;
      }
      if (payload.grade.length > 0) {
        const { error } = await supabase
          .from("ordens_corte_grade")
          .insert(payload.grade.map((g) => ({ ...g, ordem_corte_id: ordem.id })));
        if (error) throw error;
      }
      if (payload.rolos.length > 0) {
        const { error } = await supabase
          .from("ordens_corte_rolos")
          .insert(payload.rolos.map((r) => ({ ...r, ordem_corte_id: ordem.id })));
        if (error) throw error;
      }
      return ordem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-corte"] });
      qc.invalidateQueries({ queryKey: ["rolos-tecido"] });
    },
  });
};

// Create Ordem Produção
export const useCreateOrdemProducao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordem: Partial<OrdemProducao>) => {
      const { data, error } = await supabase.from("ordens_producao").insert(ordem).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ordens-producao"] }),
  });
};

export const useUpdateOrdemProducao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OrdemProducao> & { id: string }) => {
      const { data, error } = await supabase.from("ordens_producao").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-producao"] });
      qc.invalidateQueries({ queryKey: ["resumo-producao"] });
    },
  });
};
