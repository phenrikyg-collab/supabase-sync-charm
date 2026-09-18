import { chamarRpc } from "@/lib/supabaseRpc";

export type Plataforma = "android" | "ios" | "outro";

export type SituacaoRastreio =
  | "em_transito"
  | "saiu_para_entrega"
  | "entregue"
  | "aguardando_retirada"
  | "tentativa_falhou";

export type TipoPublico = "todos" | "situacao" | "cpfs" | "teste";

export interface PublicoPush {
  tipo: TipoPublico;
  plataformas?: Plataforma[];
  com_cpf?: boolean;
  instalado?: boolean | null;
  situacoes?: SituacaoRastreio[];
  cpfs?: string[];
  inscricao_ids?: number[];
}

export type OrigemEnvio = "manual" | "logistica" | "teste";

export type StatusEnvio =
  | "rascunho"
  | "agendado"
  | "enviando"
  | "enviado"
  | "erro"
  | "cancelado";

export interface EnvioPush {
  id: number;
  titulo: string;
  corpo: string;
  url: string | null;
  imagem: string | null;
  tag: string | null;
  publico: PublicoPush | null;
  origem: OrigemEnvio;
  status: StatusEnvio;
  agendado_para: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  total: number | null;
  enviados: number | null;
  falhas: number | null;
  cliques: number | null;
  criado_em: string;
}

export interface ResumoPush {
  ativo: boolean;
  auto_logistica: boolean;
  auto_situacoes: SituacaoRastreio[];
  inscritas: number;
  com_cpf: number;
  android: number;
  ios: number;
  outro: number;
  novas_7d: number;
  desativadas: number;
  enviados_30d: number;
  cliques_30d: number;
}

export interface InscricaoPush {
  id: number;
  nome: string | null;
  cpf: string | null;
  plataforma: Plataforma | null;
  instalado: boolean | null;
  ativa: boolean;
  motivo: string | null;
  desde: string | null;
  ultimo_aviso: string | null;
}

async function rpc<T>(nome: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await chamarRpc<T>(nome, params);
  if (error) throw new Error(error.message || "Não foi possível falar com o servidor.");
  return data as T;
}

export const pushApi = {
  resumo: () => rpc<ResumoPush>("app_push_resumo"),
  contarPublico: (publico: PublicoPush) =>
    rpc<number>("app_push_publico_contar", { p: publico }),
  salvarEnvio: (envio: Record<string, unknown>) =>
    rpc<EnvioPush & { publico_total?: number }>("app_push_envio_salvar", { p: envio }),
  disparar: (id: number) =>
    rpc<{ ok: boolean; publico_total?: number; agendado_para?: string | null; erro?: string }>(
      "app_push_envio_disparar",
      { p_id: id },
    ),
  cancelar: (id: number) => rpc<{ ok: boolean; erro?: string }>("app_push_envio_cancelar", { p_id: id }),
  listarEnvios: (limite = 200) => rpc<EnvioPush[]>("app_push_envios_listar", { p_limite: limite }),
  listarInscricoes: (busca: string, limite = 200) =>
    rpc<InscricaoPush[]>("app_push_inscricoes_listar", { p_busca: busca || "", p_limite: limite }),
  salvarConfig: (config: {
    ativo?: boolean;
    auto_logistica?: boolean;
    auto_situacoes?: SituacaoRastreio[];
  }) => rpc<ResumoPush>("app_push_config_salvar", { p: config }),
};

export const ROTULO_SITUACAO: Record<SituacaoRastreio, string> = {
  em_transito: "Em trânsito",
  saiu_para_entrega: "Saiu para entrega",
  entregue: "Entregue",
  aguardando_retirada: "Aguardando retirada",
  tentativa_falhou: "Tentativa falhou",
};

export const TEXTO_AUTOMATICO: Record<SituacaoRastreio, { titulo: string; corpo: string }> = {
  em_transito: {
    titulo: "Oba, seu look pegou a estrada! 🚚💛",
    corpo: "Pedido #123 já saiu daqui. Toque para acompanhar cada passo.",
  },
  saiu_para_entrega: {
    titulo: "É hoje! Deixa o espelho pronto ✨",
    corpo: "Pedido #123 saiu para entrega e chega ainda hoje.",
  },
  entregue: {
    titulo: "Chegou! Hora de provar 💛",
    corpo: "Pedido #123 foi entregue. Conta pra gente o que achou?",
  },
  aguardando_retirada: {
    titulo: "Seu pacote está te esperando 📍",
    corpo: "Pedido #123 está pronto para retirada. Toque para ver onde.",
  },
  tentativa_falhou: {
    titulo: "Quase! Seu pacote passou por aí 💛",
    corpo: "Não encontraram ninguém para receber o pedido #123. Toque que a gente te ajuda.",
  },
};

export const ROTULO_PLATAFORMA: Record<Plataforma, string> = {
  android: "Android",
  ios: "iPhone",
  outro: "Outro",
};

export const ROTULO_ORIGEM: Record<OrigemEnvio, string> = {
  manual: "Manual",
  logistica: "Automático",
  teste: "Teste",
};

export const ROTULO_STATUS: Record<StatusEnvio, string> = {
  rascunho: "Rascunho",
  agendado: "Agendado",
  enviando: "Enviando",
  enviado: "Enviado",
  erro: "Erro",
  cancelado: "Cancelado",
};

/** Remove o travessão longo, que o backend recusa. */
export function semTravessao(texto: string): string {
  return texto.replace(/[—–]/g, "-");
}

export function dataHoraBR(valor: string | null | undefined): string {
  if (!valor) return "-";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function nBR(valor: number | null | undefined): string {
  return (valor ?? 0).toLocaleString("pt-BR");
}

export function pctBR(parte: number | null | undefined, total: number | null | undefined): string {
  const t = total ?? 0;
  if (!t) return "-";
  return `${(((parte ?? 0) / t) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function resumoPublico(p: PublicoPush | null | undefined): string {
  if (!p) return "-";
  const partes: string[] = [];
  if (p.tipo === "todos") partes.push("Todas");
  if (p.tipo === "situacao") partes.push((p.situacoes ?? []).map((s) => ROTULO_SITUACAO[s] ?? s).join(", ") || "Por situação");
  if (p.tipo === "cpfs") partes.push(`${(p.cpfs ?? []).length} CPFs`);
  if (p.tipo === "teste") partes.push(`Teste (${(p.inscricao_ids ?? []).length})`);
  const plat = p.plataformas ?? [];
  if (plat.length && plat.length < 3) partes.push(plat.map((x) => ROTULO_PLATAFORMA[x] ?? x).join(", "));
  if (p.com_cpf) partes.push("Com CPF");
  return partes.join(" · ");
}
