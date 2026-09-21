import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { startOfMonth, endOfMonth, format, parse } from "date-fns";
import { chamarRpc } from "@/lib/supabaseRpc";

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
  pedidos_sem_data: number;
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
          pedidos_sem_data: Number(row.pedidos_sem_data ?? 0),
          percentual_prazo: Number(row.percentual_prazo ?? 0),
        }
      : {
          total_pedidos: 0,
          pedidos_no_prazo: 0,
          pedidos_atrasados: 0,
          pedidos_pendentes: 0,
          pedidos_sem_data: 0,
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
      const { data, error } = await chamarRpc("expedicao_top_atrasados", { p_limit: limit });
      if (error) throw error;
      return (data ?? []) as unknown as PedidoAtrasado[];
    },
  });
}

export function useRecalcularExpedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mes: string | null) => {
      const { error } = await chamarRpc("calcular_bonificacao_expedicao", { p_mes: mes });
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

export interface ResumoAbertos {
  total_pedidos_abertos: number;
  total_criticos: number;
  total_alerta: number;
  total_no_prazo: number;
  valor_total_parado: number;
}

export function useResumoAbertos() {
  return useQuery<ResumoAbertos>({
    queryKey: ["expedicao-resumo-abertos"],
    queryFn: async () => {
      const { data, error } = await chamarRpc("expedicao_resumo_pedidos_abertos");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? {
        total_pedidos_abertos: 0,
        total_criticos: 0,
        total_alerta: 0,
        total_no_prazo: 0,
        valor_total_parado: 0,
      }) as unknown as ResumoAbertos;
    },
  });
}

export interface ProdutoParado {
  produto_id: string | number;
  variant_id?: string | number | null;
  nome: string | null;
  cor: string | null;
  tamanho: string | null;
  vendido: number;
  em_producao: number;
  saldo: number;
  pedidos: (string | number)[] | null;
}

export function useProdutosParados(limit = 200) {
  return useQuery<ProdutoParado[]>({
    queryKey: ["expedicao-produtos-parados", limit],
    queryFn: async () => {
      const { data, error } = await chamarRpc("expedicao_produtos_parados", { p_limit: limit });
      if (error) throw error;
      return (data ?? []) as unknown as ProdutoParado[];
    },
  });
}

export interface PedidoAbertoExpedicao {
  pedido_id: string | number;
  cliente: string | null;
  data_pedido: string | null;
  status_tray: string | null;
  dias_corridos: number;
  prazo_efetivo: number;
  prazo_alterado: number;
  nivel_risco: string | null;
  etapa: string | null;
  valor_pedido: number;
  transportadora: string | null;
  previsao_entrega: string | null;
  codigo_rastreio: string | null;
  tracking_url: string | null;
  tem_nota_fiscal: boolean | null;
  origem_prazo: string | null;
  oc_id: string | null;
  oc_numero: string | null;
  oc_status: string | null;
  oc_previsao: string | null;
  dias_atraso: number | null;
  retirada: boolean | null;
  disponibilidade_dias: number | null;
}


export function usePedidosAbertos() {
  return useQuery<PedidoAbertoExpedicao[]>({
    queryKey: ["expedicao-pedidos-abertos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_expedicao_status" as any)
        .select("*")
        .order("dias_corridos", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PedidoAbertoExpedicao[];
    },
  });
}

/* ───────────── Pedidos do mês (auditoria) ───────────── */

export type SituacaoPedidoMes = "no_prazo" | "atrasado" | "pendente" | "sem_data";

export interface PedidoDoMes {
  pedido_id: string | number;
  cliente: string | null;
  data_pagamento: string | null;
  prazo_efetivo: string | null;
  origem_prazo: string | null;
  data_envio: string | null;
  origem_envio: string | null;
  situacao: SituacaoPedidoMes | string;
  dias_atraso: number | null;
}

export function usePedidosDoMes(mes: string, situacao: SituacaoPedidoMes | null) {
  return useQuery<PedidoDoMes[]>({
    queryKey: ["expedicao-pedidos-mes", mes, situacao],
    queryFn: async () => {
      const { data, error } = await chamarRpc("expedicao_pedidos_mes", {
        p_mes: `${mes}-01`,
        p_situacao: situacao,
      });
      if (error) throw error;
      return (data ?? []) as unknown as PedidoDoMes[];
    },
  });
}

/* ───────────── Postagem e rastreio ───────────── */

export interface RastreioPainel {
  postagem: {
    postados: number;
    media_dias_uteis_pagamento_postagem: number;
    pct_postados_no_prazo: number;
    media_dias_uteis_etiqueta_postagem: number;
    pct_postados_mesmo_dia_etiqueta: number;
  };
  por_transportadora: {
    transportadora: string | null;
    postados: number;
    media_dias_uteis_pagamento_postagem: number;
    pct_no_prazo: number;
  }[];
  etiquetas_sem_postagem: {
    pedido: string | number;
    cliente: string | null;
    transportadora: string | null;
    servico: string | null;
    codigo: string | null;
    etiqueta_em_br: string | null;
    dias_uteis: number;
    envio_id: string | number | null;
  }[];
  enviados_sem_codigo: {
    pedido: string | number;
    cliente: string | null;
    transportadora: string | null;
    status: string | null;
    data_pedido_br: string | null;
  }[];
  pos_envio: {
    entregues: number;
    em_transito: number;
    com_ocorrencia: number;
    devolvidos: number;
  };
}

export function useRastreioPainel(mes: string) {
  return useQuery<RastreioPainel | null>({
    queryKey: ["expedicao-rastreio-painel", mes],
    queryFn: async () => {
      const { data, error } = await chamarRpc("expedicao_rastreio_painel", { p_mes: `${mes}-01` });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as unknown as RastreioPainel | null;
    },
  });
}

/* ───────────── Ordem de corte do pedido ───────────── */

export interface ItemPedidoExpedicao {
  produto_id: string | null;
  nome: string | null;
  referencia: string | null;
  cor_texto: string | null;
  cor_id: string | null;
  cor_hex: string | null;
  tamanho: string | null;
  quantidade: number;
  disponibilidade: string | null;
  imagem: string | null;
}

export interface OcDoPedido {
  id: string;
  numero_oc: string;
  status: string | null;
  previsao_pronto: string | null;
}

export interface PedidoItensResposta {
  pedido: string | number;
  cliente: string | null;
  data_pedido: string | null;
  status: string | null;
  prazo_atual: string | null;
  itens: ItemPedidoExpedicao[];
  ordens: OcDoPedido[];
}

export function usePedidoItens(pedido: string | number | null) {
  return useQuery<PedidoItensResposta | null>({
    queryKey: ["expedicao-pedido-itens", pedido],
    enabled: pedido !== null && pedido !== undefined && pedido !== "",
    queryFn: async () => {
      const { data, error } = await chamarRpc("expedicao_pedido_itens", { p_pedido: pedido });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as unknown as PedidoItensResposta | null;
    },
  });
}

export interface OcImpressao {
  numero_oc: string;
  status: string | null;
  tipo: string | null;
  criada_em: string | null;
  previsao_pronto: string | null;
  observacao: string | null;
  pedido: string | number | null;
  cliente: string | null;
  data_pedido: string | null;
  prazo_envio: string | null;
  itens: {
    produto: string | null;
    sku: string | null;
    tecido: string | null;
    cor: string | null;
    cor_hex: string | null;
    tamanho: string | null;
    quantidade: number;
  }[];
  total_pecas: number;
}

export function useOcImprimir(oc: string | undefined) {
  return useQuery<OcImpressao | null>({
    queryKey: ["expedicao-oc-imprimir", oc],
    enabled: !!oc,
    queryFn: async () => {
      const { data, error } = await chamarRpc("expedicao_oc_imprimir", { p_oc: oc });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as unknown as OcImpressao | null;
    },
  });
}

export function useCriarOcPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      pedido: string | number;
      previsao: string;
      itens: { produto_id: string | null; cor_id: string | null; tamanho: string | null; quantidade: number }[];
      observacao: string | null;
    }) => {
      const { data, error } = await chamarRpc("expedicao_oc_pedido_criar", {
        p_pedido: payload.pedido,
        p_previsao: payload.previsao,
        p_itens: payload.itens,
        p_observacao: payload.observacao,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as unknown as { id: string; numero_oc: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expedicao-pedidos-abertos"] });
      qc.invalidateQueries({ queryKey: ["expedicao-top-atrasados"] });
      qc.invalidateQueries({ queryKey: ["expedicao-pedido-itens"] });
      qc.invalidateQueries({ queryKey: ["expedicao-pedidos-mes"] });
      qc.invalidateQueries({ queryKey: ["ordens-corte"] });
    },
  });
}

export function useAtualizarOcPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      oc: string;
      previsao?: string | null;
      status?: string | null;
      observacao?: string | null;
    }) => {
      const { error } = await chamarRpc("expedicao_oc_pedido_atualizar", {
        p_oc: payload.oc,
        p_previsao: payload.previsao ?? null,
        p_status: payload.status ?? null,
        p_observacao: payload.observacao ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expedicao-pedido-itens"] });
      qc.invalidateQueries({ queryKey: ["expedicao-pedidos-abertos"] });
      qc.invalidateQueries({ queryKey: ["ordens-corte"] });
    },
  });
}

export interface ItemRomaneio {
  pedido: string | number;
  cliente: string | null;
  codigo: string | null;
  transportadora: string | null;
  servico: string | null;
  destino: string | null;
  pecas: number | null;
  postado: boolean | null;
  origem: string | null;
}

export interface GrupoRomaneio {
  transportadora: string | null;
  total: number;
  itens: ItemRomaneio[];
}

export interface RomaneioDia {
  dia: string;
  dia_br: string;
  correios: ItemRomaneio[];
  transportadoras: GrupoRomaneio[];
  totais: { correios: number; transportadoras: number; sem_codigo: number };
}

export function useRomaneio(dia: string) {
  const hoje = format(new Date(), "yyyy-MM-dd");
  return useQuery<RomaneioDia | null>({
    queryKey: ["expedicao-romaneio", dia],
    queryFn: async () => {
      const { data, error } = await chamarRpc("expedicao_romaneio", { p_dia: dia });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as unknown as RomaneioDia | null;
    },
    refetchInterval: dia === hoje ? 5 * 60 * 1000 : false,
  });
}
