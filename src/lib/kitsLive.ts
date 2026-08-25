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
