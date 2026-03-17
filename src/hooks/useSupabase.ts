import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Produto, Cor, Tecido, RoloTecido, EntradaTecido, OrdemCorte, OrdemCorteGrade,
  OrdemCorteProduto, OrdemCorteRolo, OrdemProducao, Oficina, Aviamento, ProdutoAviamento,
  MovimentacaoFinanceira, MetaFinanceira, CategoriaFinanceira,
  CentroCusto, DashboardExecutivo, TicketMedioMes, IndicadorRiscoMeta,
  ResumoProducaoAndamento, ResumoEstoqueTecidos, ExpedicaoStatus, Conserto, CustoFixoOficina,
} from "@/types/database";

async function fetchTable<T>(table: string, options?: { 
  orderBy?: string; ascending?: boolean; filters?: Record<string, any>; limit?: number;
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
  if (options?.limit) query = query.limit(options.limit);
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["produto"] });
    },
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

export const useCreateTecido = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tecido: Partial<Tecido>) => {
      const { data, error } = await supabase.from("tecidos").insert(tecido).select().single();
      if (error) throw error;
      return data as Tecido;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tecidos"] }),
  });
};

export const useUpdateTecido = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Tecido> & { id: string }) => {
      const { data, error } = await supabase.from("tecidos").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as Tecido;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tecidos"] }),
  });
};

export const useDeleteTecido = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tecidos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tecidos"] }),
  });
};

// Rolos de tecido
export const useRolosTecido = () =>
  useQuery({ queryKey: ["rolos-tecido"], queryFn: () => fetchTable<RoloTecido>("rolos_tecido", { orderBy: "created_at" }) });

// Entradas de tecido
export const useEntradasTecido = () =>
  useQuery({ queryKey: ["entradas-tecido"], queryFn: () => fetchTable<EntradaTecido>("entradas_tecido", { orderBy: "created_at" }) });

export const useCreateEntradaTecido = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: Partial<EntradaTecido>) => {
      const { data, error } = await supabase.from("entradas_tecido").insert(entrada).select().single();
      if (error) throw error;
      return data as EntradaTecido;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entradas-tecido"] }),
  });
};

export const useCreateRoloTecido = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rolo: Partial<RoloTecido>) => {
      const { data, error } = await supabase.from("rolos_tecido").insert(rolo).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rolos-tecido"] });
      qc.invalidateQueries({ queryKey: ["resumo-estoque"] });
    },
  });
};

// Aviamentos
export const useAviamentos = () =>
  useQuery({ queryKey: ["aviamentos"], queryFn: () => fetchTable<Aviamento>("aviamentos", { orderBy: "nome_aviamento", ascending: true }) });

export const useCreateAviamento = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (aviamento: Partial<Aviamento>) => {
      const { data, error } = await supabase.from("aviamentos").insert(aviamento).select().single();
      if (error) throw error;
      return data as Aviamento;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aviamentos"] }),
  });
};

export const useProdutoAviamentos = (produtoId: string) =>
  useQuery({
    queryKey: ["produto-aviamentos", produtoId],
    queryFn: () => fetchTable<ProdutoAviamento>("produto_aviamentos", { filters: { produto_id: produtoId } }),
    enabled: !!produtoId,
  });

export const useSaveProdutoAviamentos = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ produtoId, aviamentos }: {
      produtoId: string;
      aviamentos: { aviamento_id: string; quantidade_por_peca: number; custo_unitario: number }[];
    }) => {
      await supabase.from("produto_aviamentos").delete().eq("produto_id", produtoId);
      if (aviamentos.length > 0) {
        const { error } = await supabase.from("produto_aviamentos").insert(
          aviamentos.map((a) => ({ ...a, produto_id: produtoId }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produto-aviamentos"] }),
  });
};

// Oficinas
export const useOficinas = () =>
  useQuery({ queryKey: ["oficinas"], queryFn: () => fetchTable<Oficina>("oficinas", { orderBy: "nome_oficina", ascending: true }) });
export const useCreateOficina = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (oficina: Partial<Oficina>) => {
      const { data, error } = await supabase.from("oficinas").insert(oficina).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oficinas"] }),
  });
};
export const useUpdateOficina = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Oficina> & { id: string }) => {
      const { data, error } = await supabase.from("oficinas").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oficinas"] }),
  });
};
export const useDeleteOficina = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("oficinas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oficinas"] }),
  });
};

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

// Movimentações Financeiras
export const useMovimentacoesFinanceiras = () =>
  useQuery({ queryKey: ["movimentacoes"], queryFn: () => fetchTable<MovimentacaoFinanceira>("movimentacoes_financeiras", { orderBy: "data" }) });

export const useCreateMovimentacao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mov: Partial<MovimentacaoFinanceira>) => {
      const { data, error } = await supabase.from("movimentacoes_financeiras").insert(mov).select().single();
      if (error) throw error;
      return data as MovimentacaoFinanceira;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movimentacoes"] }),
  });
};

export const useUpdateMovimentacao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MovimentacaoFinanceira> & { id: string }) => {
      const { data, error } = await supabase.from("movimentacoes_financeiras").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as MovimentacaoFinanceira;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movimentacoes"] }),
  });
};

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

// Create Ordem Corte with stock deduction
export const useCreateOrdemCorte = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ordem: Partial<OrdemCorte>;
      produtos: { produto_id: string; nome_produto: string }[];
      grade: { cor_id: string; tamanho: string; quantidade: number }[];
      rolos: { rolo_id: string; metragem_utilizada: number }[];
    }) => {
      // Create ordem
      const { data: ordem, error: ordemErr } = await supabase
        .from("ordens_corte").insert(payload.ordem).select().single();
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

        // Deduct stock from rolos
        for (const r of payload.rolos) {
          const { data: rolo } = await supabase.from("rolos_tecido").select("metragem_disponivel").eq("id", r.rolo_id).single();
          if (rolo) {
            const novaMetragem = Math.max(0, (rolo.metragem_disponivel ?? 0) - r.metragem_utilizada);
            await supabase.from("rolos_tecido").update({ metragem_disponivel: novaMetragem }).eq("id", r.rolo_id);
          }
        }
      }
      return ordem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-corte"] });
      qc.invalidateQueries({ queryKey: ["rolos-tecido"] });
      qc.invalidateQueries({ queryKey: ["resumo-estoque"] });
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
      // Update OC status
      if (ordem.ordem_corte_id) {
        await supabase.from("ordens_corte").update({ status: "Em Produção" }).eq("id", ordem.ordem_corte_id);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-producao"] });
      qc.invalidateQueries({ queryKey: ["ordens-corte"] });
      qc.invalidateQueries({ queryKey: ["resumo-producao"] });
    },
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

export const useDeleteOrdemProducao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete related consertos first
      await supabase.from("consertos").delete().eq("ordem_producao_id", id);
      const { error } = await supabase.from("ordens_producao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-producao"] });
      qc.invalidateQueries({ queryKey: ["resumo-producao"] });
      qc.invalidateQueries({ queryKey: ["consertos"] });
      qc.invalidateQueries({ queryKey: ["consertos-all"] });
    },
  });
};

// Update Ordem Corte status
export const useUpdateOrdemCorte = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OrdemCorte> & { id: string }) => {
      const { data, error } = await supabase.from("ordens_corte").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ordens-corte"] }),
  });
};

// Consertos
export const useConsertos = (ordemProducaoId?: string) =>
  useQuery({
    queryKey: ["consertos", ordemProducaoId],
    queryFn: () => fetchTable<Conserto>("consertos", { filters: ordemProducaoId ? { ordem_producao_id: ordemProducaoId } : undefined }),
    enabled: ordemProducaoId ? true : true,
  });

export const useAllConsertos = () =>
  useQuery({
    queryKey: ["consertos-all"],
    queryFn: () => fetchTable<Conserto>("consertos"),
  });

export const useCreateConserto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conserto: Partial<Conserto>) => {
      const { data, error } = await supabase.from("consertos").insert(conserto).select().single();
      if (error) throw error;
      return data as Conserto;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consertos"] });
      qc.invalidateQueries({ queryKey: ["consertos-all"] });
    },
  });
};

export const useUpdateConserto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Conserto> & { id: string }) => {
      const { data, error } = await supabase.from("consertos").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consertos"] });
      qc.invalidateQueries({ queryKey: ["consertos-all"] });
    },
  });
};

// Custo Fixo Oficina Interna
export const useCustosFixosOficina = () =>
  useQuery({ queryKey: ["custos-fixos-oficina"], queryFn: () => fetchTable<CustoFixoOficina>("custo_fixo_oficina", { orderBy: "mes" }) });

export const useCreateCustoFixoOficina = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (custo: Partial<CustoFixoOficina>) => {
      const { data, error } = await supabase.from("custo_fixo_oficina").insert(custo).select().single();
      if (error) throw error;
      return data as CustoFixoOficina;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custos-fixos-oficina"] }),
  });
};

export const useUpdateCustoFixoOficina = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustoFixoOficina> & { id: string }) => {
      const { data, error } = await supabase.from("custo_fixo_oficina").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custos-fixos-oficina"] }),
  });
};
