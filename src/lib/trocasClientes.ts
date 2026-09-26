import { supabase } from "@/integrations/supabase/client";
import { chamarRpc } from "@/lib/supabaseRpc";

export const GRUPOS: Record<string, { rotulo: string; cor: string }> = {
  vestibilidade: { rotulo: "Tamanho e caimento", cor: "bg-primary" },
  expectativa: { rotulo: "Modelo, tecido ou cor", cor: "bg-accent-foreground/60" },
  qualidade: { rotulo: "Defeito", cor: "bg-destructive" },
  operacao: { rotulo: "Erro no envio", cor: "bg-warning" },
  desistencia: { rotulo: "Desistência", cor: "bg-muted-foreground" },
  outro: { rotulo: "Outro", cor: "bg-muted-foreground/50" },
};

export const rotuloGrupo = (g?: string | null) => (g ? GRUPOS[g]?.rotulo ?? g : "-");
export const corGrupo = (g?: string | null) => (g ? GRUPOS[g]?.cor ?? GRUPOS.outro.cor : GRUPOS.outro.cor);

export type Motivo = { codigo?: string; rotulo: string; grupo?: string; n: number };
export type PecaProtocolo = {
  produto?: string | null;
  cor?: string | null;
  tamanho?: string | null;
  motivo_rotulo?: string | null;
  comentario?: string | null;
  tamanho_desejado?: string | null;
};
export type Protocolo = {
  origem: "td" | "reversa";
  protocolo?: string | null;
  pedido?: string | number | null;
  data_br?: string | null;
  preferencia?: string | null;
  status?: string | null;
  recusada?: boolean;
  pecas?: PecaProtocolo[];
};
export type DetalheCliente = {
  tray_customer_id?: string | number;
  nome?: string;
  email?: string;
  pedidos?: number;
  solicitacoes?: number;
  pecas?: number;
  trocas?: number;
  reembolsos?: number;
  recusadas?: number;
  taxa_pct?: number;
  motivo_principal_rotulo?: string | null;
  grupo_principal?: string | null;
  tamanho_principal?: string | null;
  produto_principal?: string | null;
  troca_muito?: boolean;
  motivos?: Motivo[];
  tamanhos?: { tamanho: string; n: number; ficou_grande?: number; ficou_pequeno?: number }[];
  produtos?: { produto: string; n: number; motivos?: string[] }[];
  protocolos?: Protocolo[];
  resumo_ia?: string | null;
  resumo_ia_em_br?: string | null;
  resumo_desatualizado?: boolean;
  primeira_br?: string | null;
  ultima_br?: string | null;
  cpf?: string | null;
  conversa_id?: string | number | null;
};

async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await chamarRpc<T>(nome, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const kpis = () => rpc<any>("reversa_clientes_trocas_kpis");
export const lista = (a: { p_busca: string | null; p_filtro: string; p_ordem: string; p_limite: number; p_offset: number }) =>
  rpc<{ total: number; linhas: DetalheCliente[] }>("reversa_clientes_trocas_lista", a);
export const detalhe = (id: string | number) =>
  rpc<DetalheCliente>("reversa_cliente_trocas_detalhe", { p_tray_customer_id: id });

const FUNCOES_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1";

export async function refazerResumo(tray_customer_id: string | number) {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(`${FUNCOES_URL}/reversa-clientes-resumo-ia`, {
    method: "POST",
    headers: { Authorization: `Bearer ${data?.session?.access_token ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "um", tray_customer_id }),
  });
  let corpo: any = null;
  try { corpo = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok || corpo?.ok === false) throw new Error(corpo?.erro ?? corpo?.error ?? `Erro ${r.status}`);
  return corpo;
}
