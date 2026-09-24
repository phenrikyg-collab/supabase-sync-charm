/** Regras do fluxo Corte -> Ordem de Produção -> Oficina -> Pagamento. */

export type ItemGrade = { produto_id: string | null; cor_id: string | null; tamanho: string; quantidade: number };

/** Peças cortadas = quantidade da grade (por folha) x folhas da cor. */
export function pecasCortadas(gradePorFolha: number, folhas: number): number {
  return Math.max(0, Math.round((gradePorFolha || 0) * (folhas || 0)));
}

/** Totais por tamanho, somando todas as linhas da grade já multiplicada. */
export function totalPorTamanho(itens: ItemGrade[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const i of itens) if (i.quantidade > 0) r[i.tamanho] = (r[i.tamanho] ?? 0) + i.quantidade;
  return r;
}

export function somaMetragem(rolos: { metragem_utilizada: number }[]): number {
  return rolos.reduce((s, r) => s + (Number(r.metragem_utilizada) || 0), 0);
}

/** Uma OP por produto + cor, com a soma das peças cortadas. */
export function agruparOps(itens: ItemGrade[]) {
  const mapa = new Map<string, { produto_id: string | null; cor_id: string | null; quantidade: number }>();
  for (const i of itens) {
    if (i.quantidade <= 0) continue;
    const k = `${i.produto_id ?? ""}|${i.cor_id ?? ""}`;
    const g = mapa.get(k) ?? { produto_id: i.produto_id, cor_id: i.cor_id, quantidade: 0 };
    g.quantidade += i.quantidade;
    mapa.set(k, g);
  }
  return [...mapa.values()];
}

/** Peças que valem para pagamento: entregue, senão a quantidade da ordem. */
export function pecasPagaveis(op: { quantidade_entregue?: number | null; quantidade?: number | null; quantidade_pecas_ordem?: number | null }) {
  return op.quantidade_entregue ?? op.quantidade ?? op.quantidade_pecas_ordem ?? 0;
}

export function valorOp(op: Parameters<typeof pecasPagaveis>[0], custoPorPeca: number | null | undefined) {
  return pecasPagaveis(op) * (custoPorPeca ?? 0);
}

/** A função ainda não existe no banco (SQL pendente). */
export function rpcAusente(err: { code?: string | number; message?: string } | null | undefined) {
  if (!err) return false;
  const c = String(err.code ?? "");
  return c === "PGRST202" || c === "42883" || /could not find the function/i.test(err.message ?? "");
}

export const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
