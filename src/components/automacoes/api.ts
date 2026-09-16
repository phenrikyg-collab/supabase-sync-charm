import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { chamarRpc } from "@/lib/supabaseRpc";

/** Chamada simples de RPC no schema public, sempre conferindo o erro. */
export async function rpcFluxos<T = any>(nome: string, params?: Record<string, any>): Promise<T> {
  const { data, error } = await chamarRpc(nome as any, params as any);
  if (error) throw new Error(error.message);
  return data as T;
}

export type StatusFluxo = "rascunho" | "ativo" | "pausado" | "arquivado";

export type FluxoLista = {
  id: number | string;
  nome: string;
  descricao?: string | null;
  status: StatusFluxo;
  gatilho_tipo?: string | null;
  gatilho_rotulo?: string | null;
  gatilho_config?: any;
  grupo_exclusivo?: string | null;
  prioridade?: number | null;
  sair_ao_comprar?: boolean | null;
  origem?: string | null;
  canais?: string[] | null;
  total_nos?: number | null;
  entraram?: number | null;
  ativos?: number | null;
  sairam_comprando?: number | null;
  emails_enviados?: number | null;
  whatsapp_enviados?: number | null;
  ultima_execucao_em?: string | null;
  ultimo_resultado?: any;
};

export type Gatilho = { tipo: string; rotulo: string; descricao?: string | null };
export type TemplateEmail = { id: number | string; slug: string; nome: string; assunto?: string | null; tipo?: string | null };
export type TemplateWpp = {
  id: number | string;
  nome: string;
  categoria?: string | null;
  corpo?: string | null;
  variaveis?: number | null;
  copiar_cupom?: boolean | null;
};
export type TagCatalogo = { id: number | string; nome: string; cor?: string | null };

/** Item de lista do catálogo que pode vir como texto puro ou objeto com rótulo. */
export type OpcaoCatalogo = { valor: string; rotulo: string; descricao?: string | null };

export function normalizarOpcoes(lista: any): OpcaoCatalogo[] {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((item: any) => {
      if (typeof item === "string") return { valor: item, rotulo: item };
      if (!item || typeof item !== "object") return null;
      const valor = String(item.valor ?? item.tipo ?? item.chave ?? item.id ?? "");
      if (!valor) return null;
      return {
        valor,
        rotulo: String(item.rotulo ?? item.nome ?? item.label ?? valor),
        descricao: item.descricao ?? null,
      };
    })
    .filter(Boolean) as OpcaoCatalogo[];
}

export type Catalogo = {
  gatilhos: Gatilho[];
  campos: any[];
  templates_email: TemplateEmail[];
  templates_whatsapp: TemplateWpp[];
  tags: TagCatalogo[];
  grupos: string[];
  variaveis_texto: string[];
  eventos: { email: string[]; whatsapp: string[] };
  espera_referencias: OpcaoCatalogo[];
  condicao_modos_extra: OpcaoCatalogo[];
};

export type NoFluxo = {
  id?: number | string | null;
  ref?: string;
  tipo: string;
  rotulo?: string | null;
  config?: Record<string, any> | null;
  x?: number | null;
  y?: number | null;
};

export type ConexaoFluxo = {
  id?: number | string;
  origem: number | string;
  destino: number | string;
  label?: string | null;
};

export type Validacao = { ok: boolean; erros?: string[]; avisos?: string[] };

export type FluxoCompleto = {
  fluxo: any;
  nos: NoFluxo[];
  conexoes: ConexaoFluxo[];
  metricas?: any;
  validacao?: Validacao;
};

export function useCatalogoFluxos() {
  return useQuery({
    queryKey: ["fluxos-catalogo"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const d = await rpcFluxos<Catalogo>("fluxos_catalogo");
      return {
        gatilhos: d?.gatilhos ?? [],
        campos: d?.campos ?? [],
        templates_email: d?.templates_email ?? [],
        templates_whatsapp: d?.templates_whatsapp ?? [],
        tags: d?.tags ?? [],
        grupos: d?.grupos ?? [],
        variaveis_texto: d?.variaveis_texto ?? [],
        eventos: d?.eventos ?? { email: [], whatsapp: [] },
        espera_referencias: normalizarOpcoes((d as any)?.espera_referencias),
        condicao_modos_extra: normalizarOpcoes((d as any)?.condicao_modos_extra),
      } as Catalogo;
    },
  });
}

export function useFluxo(fluxoId?: string, dias = 30) {
  return useQuery({
    queryKey: ["fluxo", fluxoId, dias],
    enabled: !!fluxoId,
    queryFn: async () => {
      const d = await rpcFluxos<FluxoCompleto>("fluxo_get", { p_fluxo_id: fluxoId, p_dias: dias });
      return {
        fluxo: d?.fluxo ?? {},
        nos: d?.nos ?? [],
        conexoes: d?.conexoes ?? [],
        metricas: d?.metricas ?? {},
        validacao: d?.validacao ?? { ok: true, erros: [], avisos: [] },
      } as FluxoCompleto;
    },
  });
}

export function tempoRelativo(iso?: string | null) {
  if (!iso) return "ainda não rodou";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "ainda não rodou";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

export function dataHoraBR(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const moedaBRL = (v: any) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const MOTIVOS_PULO: Record<string, string> = {
  email_nao_contatavel: "e-mail descadastrado ou com bounce",
  teto_frequencia: "bateu o teto de e-mails do segmento",
  sem_telefone: "sem telefone",
  opt_out: "pediu para não receber",
  sem_cupom_herdado: "sem cupom do e-mail anterior",
  duplicado: "já recebido",
};

export const ROTULO_STATUS_EXECUCAO: Record<string, string> = {
  ativa: "No fluxo",
  concluida: "Concluiu",
  saiu_comprou: "Saiu comprando",
  saiu_filtro: "Barrada no filtro",
  cancelada: "Encerrada",
  erro: "Erro",
};

export const ROTULO_EVENTO: Record<string, string> = {
  enviado: "Foi enviado",
  abriu: "Abriu",
  clicou: "Clicou",
  entregue: "Foi entregue",
  lido: "Leu",
  respondeu: "Respondeu",
};
