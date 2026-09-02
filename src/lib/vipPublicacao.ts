import { supabase } from "@/integrations/supabase/client";
import { vipGruposListar, vipConfigGet } from "@/lib/vip";

/**
 * Leituras do Grupo VIP para a tela de agendamento de publicações.
 * Tudo aqui é defensivo: o backend expõe o schema `vip` (ou RPCs/views) e os
 * nomes podem variar — cada função tenta os caminhos conhecidos e devolve
 * null quando nenhum responde, sem quebrar a tela.
 */

const db = supabase as any;

export type VipLimites = {
  gruposAtivos: number;
  pessoas: number;
  maxMensagensDia: number | null;
  maxEnviosDia: number | null;
  /** min(maxMensagens, floor(maxEnvios / grupos)) — o teto real do dia. */
  limitePratico: number | null;
};

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Grupos ativos, total de pessoas e o limite prático de mensagens por dia. */
export async function vipLimites(): Promise<VipLimites> {
  const vazio: VipLimites = {
    gruposAtivos: 0,
    pessoas: 0,
    maxMensagensDia: null,
    maxEnviosDia: null,
    limitePratico: null,
  };
  try {
    const [grupos, cfg] = await Promise.all([
      vipGruposListar().catch(() => []),
      vipConfigGet().catch(() => null),
    ]);
    const ativos = (grupos ?? []).filter((g) => g.ativo !== false);
    vazio.gruposAtivos = ativos.length;
    vazio.pessoas = ativos.reduce((s, g) => s + (num(g.membros) ?? 0), 0);
    if (cfg) {
      vazio.maxMensagensDia =
        num((cfg as any).max_mensagens_dia) ?? num((cfg as any).limite_mensagens_dia) ?? num((cfg as any).max_msgs_dia);
      vazio.maxEnviosDia =
        num((cfg as any).max_envios_dia) ?? num((cfg as any).limite_envios_dia);
    }
    const tetos: number[] = [];
    if (vazio.maxMensagensDia) tetos.push(vazio.maxMensagensDia);
    if (vazio.maxEnviosDia && vazio.gruposAtivos > 0)
      tetos.push(Math.floor(vazio.maxEnviosDia / vazio.gruposAtivos));
    vazio.limitePratico = tetos.length ? Math.min(...tetos) : null;
  } catch {
    /* silencioso — a tela funciona sem os limites */
  }
  return vazio;
}

/** Quantas mensagens VIP já existem para uma data (aprovada/agendada/enviada). */
export async function vipMensagensNoDia(dataISO: string): Promise<number | null> {
  const tentativas: Array<() => Promise<number>> = [
    async () => {
      const { data, error } = await db.rpc("vip_mensagens_no_dia", { p_data: dataISO });
      if (error) throw error;
      if (typeof data === "number") return data;
      if (data && typeof data.total === "number") return data.total;
      throw new Error("formato inesperado");
    },
    async () => {
      const { count, error } = await db
        .schema("vip")
        .from("mensagens")
        .select("id", { count: "exact", head: true })
        .eq("data_envio", dataISO)
        .in("status", ["aprovada", "agendada", "enviada"]);
      if (error) throw error;
      return count ?? 0;
    },
  ];
  for (const t of tentativas) {
    try {
      return await t();
    } catch {
      /* próximo caminho */
    }
  }
  return null;
}

export type VipMensagemEstado = {
  id: string;
  status: string | null;
  data_envio: string | null;
  horario: string | null;
  motivo?: string | null;
};

/** Mensagem VIP vinculada a uma publicação (lida pelo vip_mensagem_id). */
export async function vipMensagemPorId(id: string): Promise<VipMensagemEstado | null> {
  const tentativas: Array<() => Promise<any>> = [
    async () => {
      const { data, error } = await db.rpc("vip_mensagem_get", { p_id: id });
      if (error) throw error;
      return data;
    },
    async () => {
      const { data, error } = await db
        .schema("vip")
        .from("mensagens")
        .select("id,status,data_envio,horario,motivo")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  ];
  for (const t of tentativas) {
    try {
      const r = await t();
      if (r) {
        return {
          id: r.id ?? id,
          status: r.status ?? null,
          data_envio: r.data_envio ?? null,
          horario: r.horario ?? null,
          motivo: r.motivo ?? r.erro ?? null,
        };
      }
    } catch {
      /* próximo caminho */
    }
  }
  return null;
}

/** Quantos grupos receberam a mensagem (envios com status enviado). */
export async function vipEnviosEnviados(mensagemId: string): Promise<number | null> {
  const tentativas: Array<() => Promise<number>> = [
    async () => {
      const { count, error } = await db
        .schema("vip")
        .from("envios")
        .select("id", { count: "exact", head: true })
        .eq("mensagem_id", mensagemId)
        .eq("status", "enviado");
      if (error) throw error;
      return count ?? 0;
    },
    async () => {
      const { data, error } = await db.rpc("vip_envios_contagem", { p_mensagem_id: mensagemId });
      if (error) throw error;
      if (typeof data === "number") return data;
      if (data && typeof data.enviados === "number") return data.enviados;
      throw new Error("formato inesperado");
    },
  ];
  for (const t of tentativas) {
    try {
      return await t();
    } catch {
      /* próximo */
    }
  }
  return null;
}

export type VipCliquesGrupo = {
  grupo: string;
  cliques: number;
};

/** Cliques por grupo da mensagem (cada grupo recebe um link próprio). */
export async function vipCliquesPorGrupo(mensagemId: string): Promise<VipCliquesGrupo[]> {
  const tentativas: Array<() => Promise<VipCliquesGrupo[]>> = [
    async () => {
      const { data, error } = await db
        .schema("vip")
        .from("links")
        .select("grupo_nome,grupo,cliques")
        .eq("mensagem_id", mensagemId);
      if (error) throw error;
      return (data ?? []).map((l: any) => ({
        grupo: l.grupo_nome ?? l.grupo ?? "Grupo",
        cliques: Number(l.cliques ?? 0),
      }));
    },
    async () => {
      const { data, error } = await db.rpc("vip_links_cliques", { p_mensagem_id: mensagemId });
      if (error) throw error;
      const lista = Array.isArray(data) ? data : data?.grupos ?? [];
      return lista.map((l: any) => ({
        grupo: l.grupo_nome ?? l.grupo ?? l.nome ?? "Grupo",
        cliques: Number(l.cliques ?? 0),
      }));
    },
  ];
  for (const t of tentativas) {
    try {
      const r = await t();
      if (Array.isArray(r)) return r.filter((g) => g.grupo);
    } catch {
      /* próximo */
    }
  }
  return [];
}

/**
 * Remove placeholders de link do texto do grupo VIP — o link entra sozinho
 * no rodapé, encurtado e rastreado por grupo. Cobre [link do post], [link],
 * {link} e equivalentes, inclusive a linha inteira quando ela só tem o token.
 */
export function limparPlaceholderLink(texto: string): string {
  if (!texto) return texto;
  const token = /[\[{]\s*link[^\]}\n]*[\]}]/gi;
  const linhas = texto.split("\n").filter((l) => {
    const resto = l.replace(token, "").trim();
    // a linha tinha placeholder e não sobrou nada → some com ela
    return !(resto === "" && token.test(l));
  });
  return linhas
    .join("\n")
    .replace(token, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
