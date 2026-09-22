import { db } from "@/lib/socialCommerce";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type TipoNo =
  | "mensagem"
  | "pergunta"
  | "cartao"
  | "espera"
  | "condicao"
  | "tag"
  | "humano"
  | "anna"
  | "fim";

export type BotaoNo = { id: string; titulo: string; destino?: string | null };

export type ConfigNo = {
  texto?: string | null;
  botoes?: BotaoNo[];
  proximo?: string | null;
  // pergunta
  validacao?: "livre" | "email" | "tamanho" | "cep" | "telefone" | "numero";
  variavel?: string | null;
  invalido?: string | null;
  texto_invalido?: string | null;
  consentimento_marketing?: boolean;
  // cartao
  usar_pecas_da_live?: boolean;
  produtos?: string[];
  texto_botao?: string | null;
  // espera
  segundos?: number;
  // condicao
  campo?: "email" | "cliente" | "comprou" | "tag" | "variavel";
  operador?: "igual" | "contem" | "existe";
  valor?: string | null;
  sim?: string | null;
  nao?: string | null;
  // tag
  tag?: string | null;
  [k: string]: any;
};

export type NoFluxoDados = {
  chave: string;
  tipo: TipoNo;
  rotulo: string;
  config: ConfigNo;
  pos_x: number;
  pos_y: number;
};

export type MetricasNo = {
  enviado?: number;
  clique?: number;
  resposta?: number;
  invalida?: number;
  saida?: number;
  erro?: number;
};

export type ValidacaoFluxo = { ok: boolean; erros: string[]; avisos: string[] };

export type FluxoResumo = {
  id: number;
  nome: string;
  descricao?: string | null;
  modelo?: boolean | null;
  status?: string | null;
  passos?: number | null;
  conversas?: number | null;
  emails?: number | null;
  na_live_atual?: boolean | null;
  atualizado_em?: string | null;
  origem_id?: number | null;
  live_media_id?: string | null;
};

export type FluxoCompleto = {
  fluxo: {
    id: number | null;
    nome: string;
    descricao?: string | null;
    modelo?: boolean | null;
    status?: string | null;
    no_inicial?: string | null;
    [k: string]: any;
  };
  nos: NoFluxoDados[];
  metricas: Record<string, MetricasNo>;
  resumo: {
    conversas?: number;
    em_andamento?: number;
    para_anna?: number;
    emails?: number;
    clientes_identificadas?: number;
  };
  validacao: ValidacaoFluxo;
};

export type ExecucaoFluxo = {
  id: number;
  estado?: string | null;
  no_atual?: string | null;
  motivo_saida?: string | null;
  variaveis?: Record<string, any> | null;
  conversa_id?: number | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
};

/* ------------------------------------------------------------------ */
/* Chaves e regras                                                     */
/* ------------------------------------------------------------------ */

const ALFABETO = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Chave curta e estável de um nó. Nunca muda depois de criada. */
export function novaChave(prefixo = "no"): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return `${prefixo}_${s}`;
}

export const MAX_BOTOES = 13;
export const MAX_TITULO_BOTAO = 20;
export const MAX_CARTOES = 10;

export const VARIAVEIS_PADRAO = [
  "nome",
  "primeiro_nome",
  "username",
  "email",
  "cupom",
  "cupom_beneficio",
  "cupom_validade",
  "link_live",
  "comentario",
];

/** Sem travessão longo em nenhum texto que sai para a cliente. */
export const temTravessao = (t?: string | null) => /[—–]/.test(t ?? "");
export const limparTravessao = (t: string) => t.replace(/[—–]/g, "-");

export const ROTULO_TIPO: Record<TipoNo, string> = {
  mensagem: "Mensagem",
  pergunta: "Pergunta",
  cartao: "Cartões de peças",
  espera: "Espera",
  condicao: "Condição",
  tag: "Marcar tag",
  humano: "Passar para a equipe",
  anna: "Passar para a Anna",
  fim: "Fim",
};

export const ROTULO_ESTADO: Record<string, string> = {
  ativo: "Ativo",
  aguardando: "Aguardando",
  anna: "Com a Anna",
  humano: "Com a equipe",
  encerrado: "Encerrado",
  erro: "Erro",
};

export type Saida = { chave: "proximo" | "invalido" | "sim" | "nao" | string; rotulo: string };

/** Pontos de ligação de um nó, na ordem em que aparecem no card. */
export function saidasDoNo(tipo: TipoNo, config: ConfigNo): Saida[] {
  const botoes = (config.botoes ?? []).map((b) => ({
    chave: `botao:${b.id}`,
    rotulo: b.titulo || "Botão",
  }));
  switch (tipo) {
    case "mensagem":
      return botoes.length ? botoes : [{ chave: "proximo", rotulo: "próximo" }];
    case "pergunta":
      return [
        { chave: "proximo", rotulo: "resposta válida" },
        { chave: "invalido", rotulo: "inválida duas vezes" },
        ...botoes,
      ];
    case "condicao":
      return [
        { chave: "sim", rotulo: "sim" },
        { chave: "nao", rotulo: "não" },
      ];
    case "humano":
    case "anna":
    case "fim":
      return [];
    default:
      return [{ chave: "proximo", rotulo: "próximo" }];
  }
}

/** Lê o destino gravado no config para uma saída. */
export function destinoDaSaida(config: ConfigNo, saida: string): string | null {
  if (saida.startsWith("botao:")) {
    const id = saida.slice(6);
    return (config.botoes ?? []).find((b) => b.id === id)?.destino ?? null;
  }
  return (config as any)[saida] ?? null;
}

/** Grava o destino de uma saída dentro do config do nó. */
export function comDestino(config: ConfigNo, saida: string, destino: string | null): ConfigNo {
  if (saida.startsWith("botao:")) {
    const id = saida.slice(6);
    return {
      ...config,
      botoes: (config.botoes ?? []).map((b) => (b.id === id ? { ...b, destino } : b)),
    };
  }
  return { ...config, [saida]: destino };
}

/* ------------------------------------------------------------------ */
/* Chamadas ao banco                                                   */
/* ------------------------------------------------------------------ */

export async function listarFluxos(): Promise<FluxoResumo[]> {
  const { data, error } = await db.rpc("ig_dm_fluxos_listar");
  if (error) throw error;
  return (data ?? []) as FluxoResumo[];
}

export async function carregarFluxo(id: number): Promise<FluxoCompleto> {
  const { data, error } = await db.rpc("ig_dm_fluxo_get", { p_fluxo_id: id });
  if (error) throw error;
  const d: any = Array.isArray(data) ? data[0] : data;
  return {
    fluxo: d?.fluxo ?? { id, nome: "", status: "rascunho" },
    nos: Array.isArray(d?.nos) ? d.nos : [],
    metricas: d?.metricas ?? {},
    resumo: d?.resumo ?? {},
    validacao: d?.validacao ?? { ok: true, erros: [], avisos: [] },
  };
}

export type RespostaSalvar = {
  ok: boolean;
  id?: number;
  status?: string;
  motivo?: string;
  erro?: string;
  validacao?: ValidacaoFluxo;
};

export async function salvarFluxo(p: Record<string, any>): Promise<RespostaSalvar> {
  const { data, error } = await db.rpc("ig_dm_fluxo_salvar", { p });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as RespostaSalvar;
}

export async function duplicarFluxo(id: number, paraLive = false, nome: string | null = null) {
  const { data, error } = await db.rpc("ig_dm_fluxo_duplicar", {
    p_fluxo_id: id,
    p_nome: nome,
    p_para_live: paraLive,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as any;
}

export async function arquivarFluxo(id: number) {
  const { data, error } = await db.rpc("ig_dm_fluxo_arquivar", { p_fluxo_id: id });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as any;
}

export async function definirFluxoDaLive(id: number | null) {
  const { data, error } = await db.rpc("ig_dm_live_definir_fluxo", { p_fluxo_id: id });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as {
    ok: boolean;
    validacao?: ValidacaoFluxo;
    erro?: string;
    motivo?: string;
  };
}

export async function carregarExecucoes(fluxoId: number): Promise<ExecucaoFluxo[]> {
  const { data, error } = await db
    .from("ig_dm_execucoes")
    .select("id, estado, no_atual, motivo_saida, variaveis, conversa_id, criado_em, atualizado_em")
    .eq("fluxo_id", fluxoId)
    .eq("teste", false)
    .order("criado_em", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as ExecucaoFluxo[];
}

/** Tira a cliente do fluxo: a Anna volta a responder. */
export async function encerrarExecucao(execucaoId: number, motivo = "encerrado no painel") {
  const { data, error } = await supabase.functions.invoke("instagram-dm-fluxo", {
    body: { acao: "encerrar", execucao_id: execucaoId, motivo },
  });
  if (error) throw error;
  return data;
}

/** Execução ativa da conversa, quando existe. */
export async function execucaoAtivaDaConversa(conversaId: number): Promise<number | null> {
  const { data } = await db
    .from("ig_dm_execucoes")
    .select("id")
    .eq("conversa_id", conversaId)
    .in("estado", ["ativo", "aguardando"])
    .order("criado_em", { ascending: false })
    .limit(1);
  return (data ?? [])[0]?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Live                                                                */
/* ------------------------------------------------------------------ */

export type ResultadoArquivarLive = {
  ok: boolean;
  media_id?: string | null;
  live?: { titulo?: string | null; comentarios?: number; directs?: number; carrinhos?: number } | null;
  fila_cancelada?: number;
  painel?: string;
  erro?: string;
};

export async function arquivarLiveZerando(mediaId: string | null): Promise<ResultadoArquivarLive> {
  const { data, error } = await db.rpc("fn_ig_arquivar_live", { p_media_id: mediaId ?? null });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as ResultadoArquivarLive;
}

export type ResultadoForcarLive = {
  ok: boolean;
  live_no_ar?: boolean;
  armada?: boolean;
  armada_ate?: string | null;
  media_id?: string | null;
  comentarios_lidos?: number;
  preparada?: boolean;
  mensagem?: string;
  avisos?: string[];
  erro?: string;
};

export async function forcarCapturaLive(horas = 4): Promise<ResultadoForcarLive> {
  const { data, error } = await supabase.functions.invoke("instagram-live-forcar", {
    body: { horas },
  });
  if (error) throw error;
  return (data ?? { ok: false }) as ResultadoForcarLive;
}
