import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Tipos
export type Tier = "micro" | "nano" | "embaixadora_cliente" | "top_cliente";
export type StatusInfluenciadora = "prospecto" | "pendente de aprovação" | "ativa" | "pausada" | "encerrada";
export type StatusEntrega = "pendente" | "aprovado" | "publicado" | "atrasado" | "cancelado";
export type StatusEnvio = "aguardando" | "preparando" | "enviado" | "entregue" | "extraviado";

const sb: any = supabase;

export interface DashboardRow {
  id: string;
  nome: string;
  instagram: string | null;
  tier: Tier;
  status: StatusInfluenciadora;
  seguidores_instagram: number | null;
  taxa_engajamento: number | null;
  cupom_exclusivo: string | null;
  data_inicio_parceria: string | null;
  total_entregas: number;
  entregas_publicadas: number;
  entregas_atrasadas: number;
  total_vendas_cupom: number;
  total_receita_gerada: number;
  total_envios: number;
  custo_total_produtos: number;
  ugc_aprovados: number;
}

export interface Influenciadora {
  id: string;
  created_at?: string;
  updated_at?: string;
  nome: string;
  instagram: string | null;
  tiktok: string | null;
  whatsapp: string | null;
  email: string | null;
  tier: Tier;
  status: StatusInfluenciadora;
  seguidores_instagram: number | null;
  taxa_engajamento: number | null;
  audiencia_brasil_pct: number | null;
  perfil_verificado: boolean;
  cupom_exclusivo: string | null;
  comissao_pct: number | null;
  produto_enviado: string | null;
  valor_produto_custo: number | null;
  data_inicio_parceria: string | null;
  data_fim_parceria: string | null;
  responsavel_interno: string | null;
  notas: string | null;
  tags: string[] | null;
  contrato_assinado: boolean;
  kit_enviado: boolean;
  grupo_whatsapp: boolean;
}

export interface Entrega {
  id: string;
  influenciadora_id: string;
  formato: string;
  status_entrega: StatusEntrega;
  prazo_envio_preview: string | null;
  prazo_publicacao: string | null;
  data_publicacao_real: string | null;
  produto_divulgado: string | null;
  campanha: string | null;
  url_publicacao: string | null;
  alcance: number | null;
  impressoes: number | null;
  likes: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  salvamentos: number | null;
  cliques_link: number | null;
  vendas_cupom: number;
  receita_gerada: number;
  aprovado_por: string | null;
  data_aprovacao: string | null;
  observacoes_aprovacao: string | null;
  usar_como_ugc: boolean;
  ugc_aprovado: boolean;
}

export interface Envio {
  id: string;
  influenciadora_id: string;
  produto: string;
  tamanho: string | null;
  cor: string | null;
  valor_custo: number | null;
  valor_retail: number | null;
  status_envio: StatusEnvio;
  codigo_rastreio: string | null;
  transportadora: string | null;
  data_envio: string | null;
  data_entrega_prevista: string | null;
  data_entrega_real: string | null;
  endereco_entrega: string | null;
  notas: string | null;
}

export interface MetricaMensal {
  id: string;
  influenciadora_id: string;
  mes_ano: string;
  total_publicacoes: number;
  total_reels: number;
  total_stories: number;
  alcance_total: number;
  impressoes_total: number;
  engajamento_total: number;
  usos_cupom: number;
  receita_gerada: number;
  comissao_paga: number;
  conteudos_aprovados_no_prazo: number;
  conteudos_atrasados: number;
}

// Hooks
export function useEmbaixadorasDashboard() {
  return useQuery({
    queryKey: ["embaixadoras", "dashboard"],
    queryFn: async () => {
      const { data, error } = await sb.from("vw_influenciadoras_dashboard").select("*").order("nome");
      if (error) throw error;
      return (data || []) as DashboardRow[];
    },
  });
}

export function useEmbaixadora(id: string | undefined) {
  return useQuery({
    queryKey: ["embaixadoras", id],
    queryFn: async () => {
      const { data, error } = await sb.from("influenciadoras").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Influenciadora | null;
    },
    enabled: !!id,
  });
}

export function useEntregas(influenciadoraId: string | undefined) {
  return useQuery({
    queryKey: ["embaixadoras", influenciadoraId, "entregas"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("influenciadoras_entregas")
        .select("*")
        .eq("influenciadora_id", influenciadoraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Entrega[];
    },
    enabled: !!influenciadoraId,
  });
}

export function useEnvios(influenciadoraId: string | undefined) {
  return useQuery({
    queryKey: ["embaixadoras", influenciadoraId, "envios"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("influenciadoras_envios")
        .select("*")
        .eq("influenciadora_id", influenciadoraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Envio[];
    },
    enabled: !!influenciadoraId,
  });
}

export function useMetricasMensais(influenciadoraId: string | undefined) {
  return useQuery({
    queryKey: ["embaixadoras", influenciadoraId, "metricas"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("influenciadoras_metricas_mensais")
        .select("*")
        .eq("influenciadora_id", influenciadoraId)
        .order("mes_ano", { ascending: false });
      if (error) throw error;
      return (data || []) as MetricaMensal[];
    },
    enabled: !!influenciadoraId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ["embaixadoras"] });
  if (id) qc.invalidateQueries({ queryKey: ["embaixadoras", id] });
}

export function useCreateEmbaixadora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Influenciadora>) => {
      const { data, error } = await sb.from("influenciadoras").insert(payload).select().single();
      if (error) throw error;
      return data as Influenciadora;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateEmbaixadora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Influenciadora> & { id: string }) => {
      const { data, error } = await sb.from("influenciadoras").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data as Influenciadora;
    },
    onSuccess: (_d, v) => invalidate(qc, v.id),
  });
}

export function useCheckCupomDisponivel() {
  return useMutation({
    mutationFn: async ({ cupom, ignoreId }: { cupom: string; ignoreId?: string }) => {
      let q = sb.from("influenciadoras").select("id").eq("cupom_exclusivo", cupom);
      if (ignoreId) q = q.neq("id", ignoreId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).length === 0;
    },
  });
}

// Entregas
export function useCreateEntrega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Entrega>) => {
      const { data, error } = await sb.from("influenciadoras_entregas").insert(payload).select().single();
      if (error) throw error;
      return data as Entrega;
    },
    onSuccess: (_d, v) => invalidate(qc, v.influenciadora_id),
  });
}

export function useUpdateEntrega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Entrega> & { id: string }) => {
      const { data, error } = await sb.from("influenciadoras_entregas").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data as Entrega;
    },
    onSuccess: (d) => invalidate(qc, d.influenciadora_id),
  });
}

// Envios
export function useCreateEnvio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Envio>) => {
      const { data, error } = await sb.from("influenciadoras_envios").insert(payload).select().single();
      if (error) throw error;
      return data as Envio;
    },
    onSuccess: (_d, v) => invalidate(qc, v.influenciadora_id),
  });
}

export function useUpdateEnvio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Envio> & { id: string }) => {
      const { data, error } = await sb.from("influenciadoras_envios").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data as Envio;
    },
    onSuccess: (d) => invalidate(qc, d.influenciadora_id),
  });
}

// Métricas
export function useUpsertMetrica() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<MetricaMensal>) => {
      const { data, error } = await sb
        .from("influenciadoras_metricas_mensais")
        .upsert(payload, { onConflict: "influenciadora_id,mes_ano" })
        .select()
        .single();
      if (error) throw error;
      return data as MetricaMensal;
    },
    onSuccess: (d) => invalidate(qc, d.influenciadora_id),
  });
}

// Utilitários
export const TIER_LABELS: Record<Tier, string> = {
  micro: "Micro",
  nano: "Nano",
  embaixadora_cliente: "Embaixadora Cliente",
  top_cliente: "Top Cliente",
};

export const TIER_BADGE_CLASS: Record<Tier, string> = {
  micro: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
  nano: "bg-muted text-muted-foreground",
  embaixadora_cliente: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  top_cliente: "bg-foreground text-background",
};

export const STATUS_INFLU_LABELS: Record<StatusInfluenciadora, string> = {
  prospecto: "Prospecto",
  "pendente de aprovação": "Pendente de aprovação",
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

export const STATUS_ENTREGA_BADGE: Record<StatusEntrega, string> = {
  pendente: "bg-amber-100 text-amber-800",
  aprovado: "bg-blue-100 text-blue-800",
  publicado: "bg-emerald-100 text-emerald-800",
  atrasado: "bg-red-100 text-red-800",
  cancelado: "bg-muted text-muted-foreground",
};

export const STATUS_ENVIO_BADGE: Record<StatusEnvio, string> = {
  aguardando: "bg-muted text-muted-foreground",
  preparando: "bg-amber-100 text-amber-800",
  enviado: "bg-blue-100 text-blue-800",
  entregue: "bg-emerald-100 text-emerald-800",
  extraviado: "bg-red-100 text-red-800",
};

export function isVencido(prazo: string | null | undefined): boolean {
  if (!prazo) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const p = new Date(prazo);
  return p < hoje;
}
