// Busca histórico de categorização dos meses anteriores em movimentacoes_financeiras
// para sugerir categoria com base na descrição de novos lançamentos importados.

import { supabase } from "@/integrations/supabase/client";

export interface CategoriaSugestao {
  id: string;
  nome: string;
}

/**
 * Normaliza descrição para matching:
 * - lowercase
 * - remove acentos
 * - remove números longos (datas, doc, parcela X/Y, valores)
 * - colapsa espaços
 */
export function normalizarDescricao(desc: string): string {
  return String(desc || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\d{2,}/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Constrói índice histórico: chave normalizada -> categoria_id mais frequente.
 * Busca todas as movimentações já categorizadas (paginação para passar do limite de 1000).
 */
export async function carregarHistoricoCategoria(
  categorias: { id: string; nome_categoria: string | null }[]
): Promise<Map<string, CategoriaSugestao>> {
  const PAGE = 1000;
  let from = 0;
  const linhas: { descricao: string | null; categoria_id: string | null }[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("movimentacoes_financeiras")
      .select("descricao, categoria_id")
      .not("categoria_id", "is", null)
      .not("descricao", "is", null)
      .order("data", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) break;
    const batch = data ?? [];
    linhas.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
    if (from > 50000) break; // segurança
  }

  // contagem chave -> { categoria_id -> count }
  const contagem = new Map<string, Map<string, number>>();
  for (const l of linhas) {
    const chave = normalizarDescricao(l.descricao || "");
    if (!chave || !l.categoria_id) continue;
    if (!contagem.has(chave)) contagem.set(chave, new Map());
    const m = contagem.get(chave)!;
    m.set(l.categoria_id, (m.get(l.categoria_id) || 0) + 1);
  }

  const catById = new Map(categorias.map((c) => [c.id, c.nome_categoria || ""]));
  const indice = new Map<string, CategoriaSugestao>();
  for (const [chave, m] of contagem) {
    let melhor = "";
    let melhorCount = 0;
    for (const [catId, cnt] of m) {
      if (cnt > melhorCount && catById.has(catId)) {
        melhor = catId;
        melhorCount = cnt;
      }
    }
    if (melhor) indice.set(chave, { id: melhor, nome: catById.get(melhor) || "" });
  }
  return indice;
}

/**
 * Procura no índice histórico — tenta match exato, depois parcial.
 */
export function sugerirCategoriaPorHistorico(
  descricao: string,
  indice: Map<string, CategoriaSugestao>
): CategoriaSugestao | null {
  const chave = normalizarDescricao(descricao);
  if (!chave) return null;

  // 1. exato
  const exato = indice.get(chave);
  if (exato) return exato;

  // 2. parcial: chave do índice contida na descrição, ou vice-versa
  // pega a chave com maior overlap de tokens
  const tokens = new Set(chave.split(" ").filter((t) => t.length >= 3));
  if (!tokens.size) return null;

  let melhor: CategoriaSugestao | null = null;
  let melhorScore = 0;
  for (const [k, v] of indice) {
    const kt = k.split(" ").filter((t) => t.length >= 3);
    if (!kt.length) continue;
    let score = 0;
    for (const t of kt) if (tokens.has(t)) score++;
    // exige pelo menos 1 token em comum e maioria
    if (score > melhorScore && score >= Math.min(2, kt.length)) {
      melhorScore = score;
      melhor = v;
    }
  }
  return melhor;
}
