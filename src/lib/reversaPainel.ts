import { supabase } from "@/integrations/supabase/client";

/** Chaves de alerta na ordem em que aparecem na tela. */
export const ALERTAS: { chave: string; rotulo: string; tom: "vermelho" | "ambar" | "neutro" }[] = [
  { chave: "codigo_vence_48h", rotulo: "Códigos vencendo em 48h", tom: "ambar" },
  { chave: "aberta_sem_codigo", rotulo: "Sem código de postagem", tom: "vermelho" },
  { chave: "entregue_sem_conferencia_3d", rotulo: "Chegou e não foi conferida", tom: "ambar" },
  { chave: "troca_sem_contato_24h", rotulo: "Troca sem contato da consultora", tom: "ambar" },
  { chave: "reestoque_pendente", rotulo: "Peças esperando reestoque", tom: "neutro" },
  { chave: "nf_pendente", rotulo: "NF de devolução pendente", tom: "neutro" },
];

export const CONDICOES = [
  { valor: "perfeita", rotulo: "Perfeita" },
  { valor: "com_uso", rotulo: "Com uso" },
  { valor: "avariada", rotulo: "Avariada" },
  { valor: "nao_recebida", rotulo: "Não recebida" },
  { valor: "peca_diferente", rotulo: "Peça diferente" },
];

export const DESTINOS = [
  { valor: "reestoque", rotulo: "Reestoque" },
  { valor: "conserto", rotulo: "Conserto" },
  { valor: "descarte", rotulo: "Descarte" },
  { valor: "devolver_cliente", rotulo: "Devolver à cliente" },
];

export const BUCKET_FOTOS = "reversa-fotos";

export type LinhaFila = Record<string, any>;

export type RespostaLista = {
  alertas?: Record<string, number>;
  contagens?: Record<string, number>;
  status?: Array<{ status: string; rotulo?: string; total?: number }>;
  itens?: LinhaFila[];
  linhas?: LinhaFila[];
  total?: number;
};

function desembrulhar<T>(data: any): T {
  // As RPCs devolvem json (objeto) ou setof (array de uma linha).
  if (Array.isArray(data) && data.length === 1 && typeof data[0] === "object") {
    const unica = data[0];
    const chaves = Object.keys(unica ?? {});
    if (chaves.length === 1 && typeof unica[chaves[0]] === "object") return unica[chaves[0]] as T;
  }
  return data as T;
}

async function rpc<T = any>(nome: string, args?: Record<string, any>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(nome, args);
  if (error) throw new Error(error.message);
  return desembrulhar<T>(data);
}

export const painelLista = (args: {
  p_status?: string | null;
  p_busca?: string | null;
  p_limit?: number;
  p_offset?: number;
}) => rpc<RespostaLista>("reversa_painel_lista", args);

export const painelDetalhe = (p_id: string) =>
  rpc<Record<string, any>>("reversa_painel_detalhe", { p_id });

export const conferir = (args: {
  p_id: string;
  p_itens: any[];
  p_aprovar: boolean;
  p_recusa_motivo?: string | null;
}) => rpc("reversa_conferir", args);

export const consultoraContato = (p_id: string, p_obs: string) =>
  rpc("reversa_consultora_contato", { p_id, p_obs });

export const vincularPedidoNovo = (
  p_id: string,
  p_tray_order_id: string,
  p_credito: number | null,
) => rpc("reversa_vincular_pedido_novo", { p_id, p_tray_order_id, p_credito });

export const cancelarSolicitacao = (p_id: string, p_motivo: string) =>
  rpc("reversa_cancelar", { p_id, p_motivo });

export const painelCriar = (p_payload: Record<string, any>) =>
  rpc<Record<string, any>>("reversa_painel_criar", { p_payload });

/** Busca interna do painel: mesmo formato do portal, sem limite por IP. */
export const painelBuscarPedido = (p_pedido: string, p_identificador: string) =>
  rpc<any>("reversa_painel_buscar_pedido", { p_pedido, p_identificador });

export const configListar = () => rpc<any>("reversa_config_listar");

export const configSalvar = (p_chave: string, p_valor: any) =>
  rpc("reversa_config_salvar", { p_chave, p_valor });

export const prepararReembolso = (p_solicitacao_id: string) =>
  rpc("fn_reembolso_preparar_reversa", { p_solicitacao_id });

/** Ações dos Correios sempre pela edge function — nunca chamada direta do front. */
export async function correios(acao: "autorizar" | "revalidar" | "cancelar", solicitacao_id: string) {
  const { data, error } = await supabase.functions.invoke("reversa-correios", {
    body: { acao, solicitacao_id },
  });
  if (error) {
    let msg = error.message;
    try {
      const corpo = await (error as any).context?.json?.();
      if (corpo?.erro || corpo?.error) msg = corpo.erro ?? corpo.error;
    } catch {
      /* mantém a mensagem original */
    }
    throw new Error(msg);
  }
  if (data && (data.erro || data.error)) throw new Error(data.erro ?? data.error);
  return data;
}

/** URL assinada das fotos enviadas pela cliente (bucket privado). */
export async function urlFoto(caminho: string): Promise<string> {
  const limpo = caminho.replace(new RegExp(`^${BUCKET_FOTOS}/`), "");
  const { data, error } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrl(limpo, 300);
  if (error || !data?.signedUrl) throw new Error("Não foi possível abrir a foto.");
  return data.signedUrl;
}

export const traco = "-";

export function formatarData(valor?: string | null) {
  if (!valor) return traco;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString("pt-BR");
}

export function formatarDataHora(valor?: string | null) {
  if (!valor) return traco;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function moeda(valor?: number | string | null) {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (n == null || Number.isNaN(n)) return traco;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const texto = (v: any) => (v == null || v === "" ? traco : String(v));

/** Código vence em até 2 dias (ou já venceu). */
export function codigoVencendo(valido_ate?: string | null) {
  if (!valido_ate) return false;
  const d = new Date(valido_ate);
  if (Number.isNaN(d.getTime())) return false;
  const limite = new Date();
  limite.setDate(limite.getDate() + 2);
  return d.getTime() <= limite.getTime();
}
