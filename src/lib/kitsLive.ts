import { db } from "@/lib/socialCommerce";
import type { ProdutoPai } from "@/components/social-commerce/SeletorProdutos";

/** Peça de um kit. produto_id é o ID da Tray (vw_produtos_pai.produto_id). */
export type ItemKit = {
  produto_id: string;
  cor?: string | null;
  papel?: string | null;
};

export type Kit = {
  id?: string | number;
  nome: string;
  gatilhos: string[];
  descricao?: string | null;
  itens: ItemKit[];
  resposta_dm?: string | null;
  imagem_url?: string | null;
  ativo: boolean;
  inicio?: string | null;
  fim?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
};

export type ConfigLive = {
  id?: number;
  ativo: boolean;
  palavras_gatilho: string[];
  respostas_publicas: string[];
  resposta_gatilho_dm?: string | null;
  produto_ids: string[];
  usar_kits: boolean;
  expira_em?: string | null;
  media_id_atual?: string | null;
  ativado_em?: string | null;
};

/** Mesma normalização do banco: sem acento, minúsculo, sem pontuação. */
export function normalizarGatilho(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Regras de escrita da marca: sem travessão, coração só amarelo. */
export function problemasTexto(texto?: string | null): string[] {
  const t = texto ?? "";
  const p: string[] = [];
  if (/[—–]/.test(t)) p.push("Sem travessão. Troque por vírgula, ponto ou reescreva a frase.");
  const coracoes = t.match(/[\u2764\uFE0F]?(❤|🧡|💚|💙|💜|🖤|🤍|🤎|💗|💓|💕|💞|💖|💘|💝)/gu);
  if (coracoes && coracoes.length) p.push("Coração só amarelo (💛). Troque os outros corações.");
  return p;
}

export const DM_PADRAO = (nome: string) =>
  `Oi! Vi que você quer o ${nome} 💛 Me diz o seu tamanho de cada peça que eu monto o carrinho e te mando o link para pagar.`;

export async function carregarKits(apenasAtivos = false): Promise<Kit[]> {
  let q = db.from("kits_ativos").select("*").order("criado_em", { ascending: false });
  if (apenasAtivos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as any[]).map((k) => ({
    ...k,
    gatilhos: Array.isArray(k.gatilhos) ? k.gatilhos : [],
    itens: Array.isArray(k.itens) ? k.itens : [],
  })) as Kit[];
}

export function precoProdutoPai(p?: ProdutoPai | null): number {
  if (!p) return 0;
  return Number(p.preco_promocional ?? p.preco_cheio ?? p.preco_venda ?? 0) || 0;
}

export function totalKit(itens: ItemKit[], mapa: Map<string, ProdutoPai>): number {
  return itens.reduce((s, i) => s + precoProdutoPai(mapa.get(String(i.produto_id))), 0);
}

/** Peças que sumiram do catálogo ou estão com estoque zero. */
export function pecasComProblema(
  itens: ItemKit[],
  mapa: Map<string, ProdutoPai>,
): { produto_id: string; motivo: string }[] {
  const out: { produto_id: string; motivo: string }[] = [];
  for (const i of itens) {
    const p = mapa.get(String(i.produto_id));
    if (!p) out.push({ produto_id: String(i.produto_id), motivo: "não existe mais no catálogo" });
    else if ((p.estoque ?? 0) <= 0) out.push({ produto_id: String(i.produto_id), motivo: "sem estoque" });
  }
  return out;
}

/** Cores disponíveis em estoque de um produto (rpc whatsapp_tool_verificar_variante). */
export async function coresDisponiveis(produtoId: string): Promise<string[]> {
  const { data, error } = await db.rpc("whatsapp_tool_verificar_variante", {
    p_produto_id: produtoId,
  });
  if (error) return [];
  const r: any = Array.isArray(data) ? data[0] : data;
  const cores = r?.cores_disponiveis ?? [];
  return Array.isArray(cores) ? cores.map((c: any) => (typeof c === "string" ? c : c?.cor ?? String(c))) : [];
}

export function dataHoraCurta(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function dataCurtaDDMM(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Contagem regressiva "1h20" / "12 min" / null quando já passou. */
export function restante(iso?: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${Math.max(1, m)} min`;
}

/* ------------------------------------------------------------------ */
/* Lives (public.instagram_lives)                                       */
/* ------------------------------------------------------------------ */

export type Live = {
  media_id: string;
  titulo?: string | null;
  inicio?: string | null;
  fim?: string | null;
  status?: "ao_vivo" | "encerrada" | string | null;
  comentarios?: number | null;
  quer_comprar?: number | null;
  directs?: number | null;
  carrinhos?: number | null;
  valor_carrinhos?: number | null;
  observacoes?: string | null;
};

/** "DD/MM/YYYY HH:MM" */
export function dataHoraLonga(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function carregarLives(): Promise<Live[]> {
  const { data, error } = await db
    .from("instagram_lives")
    .select("*")
    .order("inicio", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Live[];
}

export async function atualizarLive(mediaId: string): Promise<void> {
  if (!mediaId) return;
  await db.rpc("fn_ig_atualizar_live", { p_media_id: mediaId });
}

export async function encerrarLive(mediaId: string, titulo: string): Promise<void> {
  const { error } = await db.rpc("fn_ig_encerrar_live", {
    p_media_id: mediaId,
    p_titulo: titulo,
  });
  if (error) throw error;
}

export async function renomearLive(mediaId: string, titulo: string): Promise<void> {
  const { error } = await db.from("instagram_lives").update({ titulo }).eq("media_id", mediaId);
  if (error) throw error;
}

export async function salvarObservacoesLive(mediaId: string, observacoes: string): Promise<void> {
  await db.from("instagram_lives").update({ observacoes }).eq("media_id", mediaId);
}

export type ResultadoBusca = {
  id?: string | number;
  comment_id?: string | null;
  media_id?: string | null;
  live_titulo?: string | null;
  from_username?: string | null;
  texto?: string | null;
  publicado_em?: string | null;
  status?: string | null;
  kit_id?: string | number | null;
  kit_nome?: string | null;
  intencao?: string | null;
  resposta_texto?: string | null;
  private_reply_usada?: boolean | null;
};

export async function buscarComentariosLive(
  termo: string,
  mediaId: string | null,
  limite = 200,
): Promise<ResultadoBusca[]> {
  const { data, error } = await db.rpc("fn_ig_buscar_comentarios_live", {
    p_busca: termo,
    p_media_id: mediaId,
    p_limite: limite,
  });
  if (error) throw error;
  return (data ?? []) as ResultadoBusca[];
}

/** Título padrão de arquivamento: "LIVE DD/MM/YYYY". */
export function tituloPadraoLive(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  return `LIVE ${base.toLocaleDateString("pt-BR")}`;
}
