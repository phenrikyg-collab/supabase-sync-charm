import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";

/* ------------------------------------------------------------------ *
 * Tipos (defensivos: o backend pode enviar campos extras)
 * ------------------------------------------------------------------ */

export type PerfilGrupo = "broadcast" | "comunidade";

export type StatusMensagem =
  | "rascunho"
  | "aprovada"
  | "agendada"
  | "enviando"
  | "enviada"
  | "cancelada"
  | "erro";

export type StatusCalendario =
  | "gerando"
  | "rascunho"
  | "aprovado"
  | "ativo"
  | "encerrado"
  | "erro";

export type VipKpis = {
  base?: {
    membros_hoje?: number | null;
    membros_inicio_periodo?: number | null;
    entradas?: number | null;
    entradas_pelo_link?: number | null;
    saidas?: number | null;
    saidas_estimadas?: number | null;
    crescimento_liquido?: number | null;
    crescimento_snapshot?: number | null;
    taxa_entrada_pct?: number | null;
    taxa_saida_pct?: number | null;
    origens_ativas?: number | null;
    benchmark_saida?: string | null;
    medido?: boolean | null;
    medido_desde?: string | null;
    medicao_cobre_periodo?: boolean | null;
    nota_medicao?: string | null;
    serie?: Array<{ dia?: string; data?: string; entradas?: number; saidas?: number; liquido?: number }>;
    [k: string]: any;
  } | null;
  engajamento?: {
    alcance?: number | null;
    mensagens_enviadas?: number | null;
    cliques_unicos?: number | null;
    ctr_pct?: number | null;
    votantes_enquete?: number | null;
    taxa_resposta_pct?: number | null;
    nota_leitura?: string | null;
  } | null;
  conversao?: {
    pedidos?: number | null;
    receita?: number | null;
    conversao_por_clique_pct?: number | null;
    receita_por_membro?: number | null;
    ticket_medio?: number | null;
    roi?: number | null;
    custo_mensal?: number | null;
  } | null;
  distribuicao?: Record<string, number> | null;
  health_score?: {
    nota?: number | null;
    dimensoes?: Record<string, number> | null;
  } | null;
  red_flags?: Array<string | { titulo?: string; texto?: string; mensagem?: string }> | null;
};

export type VipCalendarioResumo = {
  id: string;
  titulo?: string | null;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  status?: StatusCalendario | null;
  total_mensagens?: number | null;
  total?: number | null;
  enviadas?: number | null;
  health_nota?: number | null;
};

export type VipVariante = {
  headline?: string | null;
  corpo?: string | null;
  cta?: string | null;
  camadas?: Record<string, string | null> | null;
  enquete?: VipEnquete | null;
  [k: string]: any;
};

export type VipEnquete = {
  pergunta?: string | null;
  opcoes?: string[] | null;
  multipla?: boolean | null;
} | null;

export type VipMensagem = {
  id: string;
  ordem?: number | null;
  data_envio?: string | null;
  horario?: string | null;
  intencao?: string | null;
  status?: StatusMensagem | null;
  prioritaria?: boolean | null;
  headline?: string | null;
  corpo?: string | null;
  camadas?: Record<string, any> | null;
  tipo?: string | null;
  tema?: string | null;
  persona?: string | null;
  produto_nome?: string | null;
  produto_estoque?: Array<{ cor?: string; tamanho?: string; quantidade?: number }> | null;
  estoque_real?: any;
  link_destino?: string | null;
  link_geral?: string | null;
  cliques?: number | null;
  pedidos?: number | null;
  receita?: number | null;
  midia_url?: string | null;
  midia_sugerida?: string | null;
  midia_requer_autorizacao?: boolean | null;
  midia_autorizacao_status?: "pendente" | "autorizada" | "recusada" | "nao_aplica" | null;
  midia_autorizacao_texto?: string | null;
  midia_autorizacao_cliente?: string | null;
  raciocinio?: string | null;
  enquete?: VipEnquete;
  variantes?: { comunidade?: VipVariante | null } | null;
  envios?: Array<{ grupo_id?: string; grupo_nome?: string; status?: string; erro?: string; tentativas?: number }> | null;
  [k: string]: any;
};

export type VipCalendario = {
  id: string;
  titulo?: string | null;
  status?: StatusCalendario | null;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  diagnostico?: any;
  health_score?: any;
  red_flags?: any[] | null;
  receita_potencial?: any;
  grupos?: VipGrupo[] | null;
  mensagens?: VipMensagem[] | null;
  erro?: string | null;
  [k: string]: any;
};

export type VipGrupo = {
  id: string;
  nome?: string | null;
  jid?: string | null;
  membros?: number | null;
  ativo?: boolean | null;
  ordem?: number | null;
  perfil?: PerfilGrupo | null;
  aceita_novos?: boolean | null;
  capacidade?: number | null;
  link_convite?: string | null;
  observacao?: string | null;
  [k: string]: any;
};

export type VipConfig = {
  provedor?: string | null;
  base_url?: string | null;
  instancia?: string | null;
  api_key?: string | null;
  api_key_definida?: boolean | null;
  horario_padrao?: string | null;
  intervalo_segundos?: number | null;
  envio_automatico?: boolean | null;
  webhook_url?: string | null;
  custo_mensal?: number | null;
  [k: string]: any;
};

/* ------------------------------------------------------------------ *
 * Helper genérico de RPC
 * ------------------------------------------------------------------ */

export async function vipRpc<T = any>(fn: string, args?: Record<string, any>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args ?? {});
  if (error) throw new Error(error.message || `Falha ao chamar ${fn}`);
  return data as T;
}

/* ------------------------------------------------------------------ *
 * Wrappers
 * ------------------------------------------------------------------ */

export const vipKpis = (dias: number) => vipRpc<VipKpis>("vip_kpis", { p_dias: dias });

export type VipMovimento = {
  por_dia?: Array<{ dia?: string; data?: string; entradas?: number; saidas?: number; saldo?: number }> | null;
  por_grupo?: Array<{
    grupo?: string;
    nome?: string;
    grupo_id?: string;
    membros?: number;
    entradas?: number;
    saidas?: number;
    saldo?: number;
  }> | null;
  medido_desde?: string | null;
  [k: string]: any;
};

export const vipMembrosMovimento = (dias: number) =>
  vipRpc<VipMovimento>("vip_membros_movimento", { p_dias: dias });


export const vipCalendariosListar = () =>
  vipRpc<VipCalendarioResumo[]>("vip_calendarios_listar");

export const vipCalendarioGet = (id: string) =>
  vipRpc<VipCalendario>("vip_calendario_get", { p_id: id });

export const vipCalendarioExcluir = (id: string) =>
  vipRpc("vip_calendario_excluir", { p_id: id });

export const vipMensagemSalvar = (id: string, patch: any, editadoPor: string) =>
  vipRpc("vip_mensagem_salvar", { p_id: id, p: patch, p_editado_por: editadoPor });

export const vipVarianteSalvar = (
  mensagemId: string,
  perfil: string,
  patch: any,
  editadoPor: string,
) =>
  vipRpc("vip_variante_salvar", {
    p_mensagem_id: mensagemId,
    p_perfil: perfil,
    p: patch,
    p_editado_por: editadoPor,
  });

export const vipMensagensStatus = (ids: string[], status: StatusMensagem) =>
  vipRpc<{ alteradas?: number; bloqueadas?: any[] }>("vip_mensagens_status", {
    p_ids: ids,
    p_status: status,
  });

export const vipMidiaAutorizacao = (
  mensagemId: string,
  status: "pendente" | "autorizada" | "recusada" | "nao_aplica",
  cliente: string | null,
  por: string,
) =>
  vipRpc("vip_midia_autorizacao", {
    p_mensagem_id: mensagemId,
    p_status: status,
    p_cliente: cliente,
    p_por: por,
  });

export const vipMensagemTextoFinal = (mensagemId: string, grupoId: string | null) =>
  vipRpc<any>("vip_mensagem_texto_final", { p_mensagem_id: mensagemId, p_grupo_id: grupoId });

export const vipMensagemMarcarManual = (mensagemId: string, grupoIds: string[]) =>
  vipRpc("vip_mensagem_marcar_manual", { p_mensagem_id: mensagemId, p_grupo_ids: grupoIds });

export const vipLinksGerar = (mensagemId: string) =>
  vipRpc<any>("vip_links_gerar", { p_mensagem_id: mensagemId });

export const vipMetricas = (calendarioId: string) =>
  vipRpc<any>("vip_metricas", { p_calendario_id: calendarioId });

export const vipEnqueteResultado = (mensagemId: string) =>
  vipRpc<any>("vip_enquete_resultado", { p_mensagem_id: mensagemId });

export const vipEntradasResumo = (dias: number) =>
  vipRpc<any>("vip_entradas_resumo", { p_dias: dias });

export const vipEntradaConfigSalvar = (payload: any) =>
  vipRpc("vip_entrada_config_salvar", { p: payload });

export const vipPecasParaLiquidar = (diasParado: number, limite: number) =>
  vipRpc<any>("vip_pecas_para_liquidar", { p_dias_parado: diasParado, p_limite: limite });

export const vipGruposListar = () => vipRpc<VipGrupo[]>("vip_grupos_listar");

export const vipGrupoSalvar = (g: Partial<VipGrupo>) =>
  vipRpc("vip_grupo_salvar", {
    p_id: g.id ?? null,
    p_nome: g.nome ?? null,
    p_jid: g.jid ?? null,
    p_membros: g.membros ?? null,
    p_ativo: g.ativo ?? true,
    p_ordem: g.ordem ?? 0,
    p_perfil: g.perfil ?? "broadcast",
    p_aceita_novos: g.aceita_novos ?? true,
    p_capacidade: g.capacidade ?? 1024,
    p_link_convite: g.link_convite ?? null,
    p_observacao: g.observacao ?? null,
  });

export const vipGrupoExcluir = (id: string) => vipRpc("vip_grupo_excluir", { p_id: id });

export const vipConfigGet = () => vipRpc<VipConfig>("vip_config_get");

export const vipConfigSalvar = (payload: any) => vipRpc("vip_config_salvar", { p: payload });

export const vipContexto = () => vipRpc<any>("vip_contexto");

/* ------------------------------------------------------------------ *
 * Mensagem avulsa
 * ------------------------------------------------------------------ */

export type VipProduto = {
  produto_id: string;
  nome?: string | null;
  categoria?: string | null;
  preco_cheio?: number | null;
  preco_promocional_vigente?: number | null;
  end_promotion?: string | null;
  estoque?: number | null;
  link?: string | null;
  imagem?: string | null;
  [k: string]: any;
};

export type VipEstoqueTamanho = {
  produto_id: string;
  cor?: string | null;
  tamanho?: string | null;
  estoque_tamanho?: number | null;
  preco_cheio?: number | null;
  preco_promocional?: number | null;
  link?: string | null;
  imagem?: string | null;
  nome?: string | null;
  [k: string]: any;
};

export type VipAlerta = {
  codigo?: string | null;
  tipo?: string | null;
  severidade?: string | null;
  texto?: string | null;
  mensagem?: string | null;
  bloqueia?: boolean | null;
  [k: string]: any;
};

/** Busca produtos por nome na view vw_vip_produtos. */
export async function vipProdutosBuscar(termo: string, limite = 12): Promise<VipProduto[]> {
  let q = (supabase as any).from("vw_vip_produtos").select("*").limit(limite);
  if (termo.trim()) q = q.ilike("nome", `%${termo.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as VipProduto[];
}

/** Grade real por cor e tamanho de uma peça. */
export async function vipEstoqueTamanho(produtoId: string): Promise<VipEstoqueTamanho[]> {
  const { data, error } = await (supabase as any)
    .from("vw_vip_estoque_tamanho")
    .select("*")
    .eq("produto_id", produtoId);
  if (error) throw new Error(error.message);
  return (data ?? []) as VipEstoqueTamanho[];
}

export const vipMensagemAvulsa = (payload: Record<string, any>, por: string) =>
  vipRpc<{ id: string; calendario_id?: string; ordem?: number; data_envio?: string; horario?: string; alertas?: VipAlerta[] }>(
    "vip_mensagem_avulsa",
    { p: payload, p_por: por },
  );

export const vipMensagemValidar = (id: string) => vipRpc<any>("vip_mensagem_validar", { p_id: id });

/** Normaliza o retorno de vip_mensagem_validar em lista de alertas. */
export function normalizarAlertas(bruto: any): VipAlerta[] {
  const lista = Array.isArray(bruto) ? bruto : (bruto?.alertas ?? bruto?.avisos ?? []);
  if (!Array.isArray(lista)) return [];
  return lista.map((a: any) =>
    typeof a === "string" ? ({ texto: a } as VipAlerta) : (a as VipAlerta),
  );
}

export function textoAlerta(a: VipAlerta): string {
  return a.texto ?? a.mensagem ?? a.codigo ?? JSON.stringify(a);
}

/** Alerta de imagem de cliente sem autorização é trava, não aviso. */
export function alertaBloqueante(a: VipAlerta): boolean {
  if (a.bloqueia === true) return true;
  const alvo = `${a.codigo ?? ""} ${a.tipo ?? ""} ${a.severidade ?? ""} ${textoAlerta(a)}`.toLowerCase();
  return /autoriza/.test(alvo) && /(sem|nao|não|pendente|falta)/.test(alvo);
}

export const vipEnviarTeste = (mensagemId: string, numero: string) =>
  invokeEdgeFunction(
    "vip-disparar",
    { acao: "enviar_teste", mensagem_id: mensagemId, numero },
    { timeoutMs: 90_000 },
  );

/* ------------------------------------------------------------------ *
 * Prova social
 * ------------------------------------------------------------------ */

export type VipProva = {
  id: string;
  cliente_nome?: string | null;
  cliente_whatsapp?: string | null;
  produto_nome?: string | null;
  produto_id?: string | null;
  depoimento?: string | null;
  status?: string | null;
  imagem_path?: string | null;
  imagem_url?: string | null;
  com_nome?: boolean | null;
  validade?: string | null;
  dias_esperando?: number | null;
  criado_em?: string | null;
  pedido_em?: string | null;
  [k: string]: any;
};

export const VIP_PROVAS_BUCKET = "vip-provas";

export const vipProvasPainel = () => vipRpc<any>("vip_provas_painel");

/** Lista o acervo. O backend pode expor a leitura por RPC ou por view. */
export async function vipProvasListar(status?: string | null): Promise<VipProva[]> {
  const tentativas: Array<() => Promise<any>> = [
    () => vipRpc("vip_provas_listar", { p_status: status ?? null }),
    () => vipRpc("vip_provas_listar"),
    async () => {
      let q = (supabase as any).from("vw_vip_provas").select("*");
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  ];
  let ultimo: any = null;
  for (const t of tentativas) {
    try {
      const r = await t();
      const lista = Array.isArray(r) ? r : (r?.provas ?? r?.itens ?? []);
      if (Array.isArray(lista)) {
        return status ? lista.filter((p: any) => !p.status || p.status === status) : lista;
      }
    } catch (e) {
      ultimo = e;
    }
  }
  throw ultimo ?? new Error("Não foi possível ler o acervo de prova social.");
}

export const vipProvaRegistrar = (payload: Record<string, any>) =>
  vipRpc<any>("vip_prova_registrar", { p: payload });

export const vipProvaPedir = (id: string, texto: string) =>
  vipRpc("vip_prova_pedir", { p_id: id, p_texto: texto });

export const vipProvaResponder = (
  id: string,
  autorizada: boolean,
  comNome: boolean | null,
  resposta: string | null,
  validade: string | null,
) =>
  vipRpc("vip_prova_responder", {
    p_id: id,
    p_autorizada: autorizada,
    p_com_nome: comNome,
    p_resposta: resposta,
    p_validade: validade,
  });

export const vipProvaRevogar = (id: string, motivo: string) =>
  vipRpc("vip_prova_revogar", { p_id: id, p_motivo: motivo });

/** Miniatura assinada de curta duração (bucket privado). */
export async function vipProvaSignedUrl(path: string | null | undefined, segundos = 300) {
  if (!path) return null;
  const limpo = path.includes(`/${VIP_PROVAS_BUCKET}/`)
    ? path.split(`/${VIP_PROVAS_BUCKET}/`)[1].split("?")[0]
    : path;
  const { data } = await supabase.storage.from(VIP_PROVAS_BUCKET).createSignedUrl(limpo, segundos);
  return data?.signedUrl ?? null;
}

export async function vipProvaUpload(file: File) {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(VIP_PROVAS_BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}


/* ------------------------------------------------------------------ *
 * Edge functions
 * ------------------------------------------------------------------ */

export const vipGerarCalendario = (payload: Record<string, any>) =>
  invokeEdgeFunction("vip-gerar-calendario", payload, { timeoutMs: 60_000 });

export const vipDisparar = (acao: string, extra?: Record<string, any>) =>
  invokeEdgeFunction("vip-disparar", { acao, ...(extra ?? {}) }, { timeoutMs: 90_000 });

/**
 * Executa manualmente a rotina de disparo. O backend pode expor a ação com
 * nomes diferentes, então tentamos os apelidos conhecidos antes de desistir.
 */
async function tentarAcoes(acoes: string[], extra?: Record<string, any>) {
  let ultimoErro: any = null;
  for (const acao of acoes) {
    try {
      return await vipDisparar(acao, extra);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      // Ação desconhecida → tenta o próximo apelido. Qualquer outro erro é real.
      if (/ação|acao|action|inválid|invalid|desconhec|unknown|not.?found|404/i.test(msg)) {
        ultimoErro = e;
        continue;
      }
      throw e;
    }
  }
  throw ultimoErro ?? new Error("Nenhuma ação de disparo foi aceita pelo backend.");
}

/** Dispara uma única mensagem agendada, agora, para os grupos ativos. */
export const vipDispararMensagem = (mensagemId: string) =>
  tentarAcoes(
    ["enviar", "enviar_mensagem", "disparar_mensagem", "enviar_agora", "processar_agendados"],
    { mensagem_id: mensagemId },
  );



export const VIP_BASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? "";

export const linkEntrada = (origem: string, utms?: Record<string, string>) => {
  const params = new URLSearchParams({ origem });
  Object.entries(utms ?? {}).forEach(([k, v]) => v && params.set(k, v));
  return `${VIP_BASE_URL}/functions/v1/vip-entrar?${params.toString()}`;
};

/* ------------------------------------------------------------------ *
 * Utilidades de apresentação
 * ------------------------------------------------------------------ */

export const CORES_INTENCAO: Record<string, string> = {
  atencao: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  relacionamento: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30",
  educacao: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  prova: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  objecao: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  oportunidade: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

export const CORES_STATUS: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  aprovada: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  agendada: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  enviando: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  enviada: "bg-primary/15 text-primary border-primary/30",
  cancelada: "bg-muted text-muted-foreground line-through border-border",
  erro: "bg-destructive/15 text-destructive border-destructive/30",
};

export const DISTRIBUICAO_REFERENCIA: Record<string, number> = {
  atencao: 25,
  relacionamento: 20,
  educacao: 20,
  prova: 15,
  objecao: 10,
  oportunidade: 10,
};

export const ORIGENS_PADRAO = ["popup", "bio", "pos-compra", "stories", "ads"];

/** Renderiza *negrito* do WhatsApp preservando quebras de linha. */
export function whatsappParaHtml(texto: string | null | undefined) {
  if (!texto) return "";
  const escapado = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escapado
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

const SAUDACOES = /^\s*(oi|olá|ola|bom dia|boa tarde|boa noite|e aí|e ai|meninas|amores|oiê)/i;

export function temSaudacao(headline: string | null | undefined) {
  return !!headline && SAUDACOES.test(headline);
}

export function textoRedFlag(f: any): string {
  if (typeof f === "string") return f;
  return f?.texto ?? f?.mensagem ?? f?.titulo ?? JSON.stringify(f);
}

export function corpoMensagem(m: VipMensagem, perfil: "listas" | "comunidade" = "listas") {
  if (perfil === "comunidade") {
    const v = m.variantes?.comunidade;
    if (!v) return null;
    return [v.headline, v.corpo, v.cta].filter(Boolean).join("\n\n");
  }
  return [m.headline, m.corpo, (m.camadas as any)?.cta].filter(Boolean).join("\n\n");
}

export async function copiar(texto: string) {
  await navigator.clipboard.writeText(texto);
}

/* ------------------------------------------------------------------ *
 * Classificação (9 camadas) e redação por IA
 * ------------------------------------------------------------------ */

export type VipPersona = {
  id?: string | null;
  nome?: string | null;
  emoji?: string | null;
  motivacao?: string | null;
  objecao?: string | null;
  pilar_abre?: string | null;
  pilar_fecha?: string | null;
  mensagem_principal?: string | null;
  perfil_vida?: string | null;
  faixa_etaria?: string | null;
  etapa_funil?: string | null;
  [k: string]: any;
};

export type VipClassificacaoOpcoes = {
  nota?: string | null;
  tema?: string[] | null;
  tipo?: string[] | null;
  midia?: string[] | null;
  pilar?: string[] | null;
  angulo?: string[] | null;
  jornada?: string[] | null;
  intencao?: string[] | null;
  objetivo?: string[] | null;
  etapa_funil?: string[] | null;
  estrutura_narrativa?: string[] | null;
  personas?: VipPersona[] | null;
  [k: string]: any;
};

export const vipClassificacaoOpcoes = () =>
  vipRpc<VipClassificacaoOpcoes>("vip_classificacao_opcoes");

export type VipCriativoMatriz = {
  id?: string | null;
  angulo?: string | null;
  dor?: string | null;
  solucao?: string | null;
  beneficio?: string | null;
  objecao_resolvida?: string | null;
  persona?: string | null;
  estrutura_narrativa?: string | null;
  etapa_funil?: string | null;
  [k: string]: any;
};

export async function vipCriativosDoProduto(produtoId: string): Promise<VipCriativoMatriz[]> {
  const r = await vipRpc<any>("vip_criativos_do_produto", { p_produto_id: produtoId });
  const lista = Array.isArray(r) ? r : (r?.criativos ?? r?.itens ?? []);
  return Array.isArray(lista) ? lista : [];
}

export type VipRedacao = {
  headline?: string | null;
  corpo?: string | null;
  cta?: string | null;
  midia_sugerida?: string | null;
  midia_url?: string | null;
  link_destino?: string | null;
  raciocinio?: string | null;
  variante_comunidade?: VipVariante | null;
  usou?: {
    criativos_da_matriz?: number | null;
    grade_disponivel?: boolean | number | null;
    preco_sale?: number | boolean | null;
  } | null;
  [k: string]: any;
};

export const vipRedigir = (payload: Record<string, any>) =>
  invokeEdgeFunction("vip-redigir", payload, { timeoutMs: 60_000 }) as Promise<VipRedacao>;
