import { useMemo, useState } from "react";
import { db } from "@/lib/socialCommerce";
import { brl } from "@/lib/financeiroFormat";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Star } from "lucide-react";

/** Produto pai (sem variações de cor/tamanho), vindo da view vw_produtos_pai. */
export type ProdutoPai = {
  produto_id: string;
  nome?: string | null;
  chave_busca?: string | null;
  codigo_sku?: string | null;
  preco_venda?: number | null;
  preco_cheio?: number | null;
  preco_promocional?: number | null;
  estoque?: number | null;
  variacoes?: number | null;
};

/** Fonte única dos seletores de produto do Social Commerce. */
export async function carregarProdutosPai(): Promise<ProdutoPai[]> {
  const { data, error } = await db
    .from("vw_produtos_pai")
    .select("produto_id, nome, chave_busca, codigo_sku, preco_venda, preco_cheio, preco_promocional, estoque, variacoes")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as ProdutoPai[];
}

/** minúsculas, sem acento — mesma normalização da coluna chave_busca da view. */
export function normalizarBusca(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Seletor de produtos pai com busca (nome, código ou chave normalizada).
 * Com onPrincipalChange, exibe a estrela de "produto principal".
 */
export function SeletorProdutos({
  produtos,
  selecionados,
  onToggle,
  principal,
  onPrincipalChange,
  altura = "h-52",
}: {
  produtos: ProdutoPai[];
  selecionados: string[];
  onToggle: (id: string, marcado: boolean) => void;
  principal?: string | null;
  onPrincipalChange?: (id: string | null) => void;
  altura?: string;
}) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = normalizarBusca(busca);
    if (!q) return produtos;
    return produtos.filter(
      (p) =>
        normalizarBusca(p.nome ?? "").includes(q) ||
        normalizarBusca(p.codigo_sku ?? "").includes(q) ||
        (p.chave_busca ?? "").includes(q),
    );
  }, [produtos, busca]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou código…"
          className="pl-8 h-8 text-sm"
        />
      </div>
      <ScrollArea className={`${altura} rounded-lg border p-2`}>
        {produtos.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">Nenhum produto ativo cadastrado.</p>
        ) : filtrados.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">
            Nenhum produto encontrado para “{busca}”.
          </p>
        ) : (
          filtrados.map((p) => {
            const sel = selecionados.includes(p.produto_id);
            return (
              <div
                key={p.produto_id}
                className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-accent/40"
              >
                <Checkbox
                  checked={sel}
                  onCheckedChange={(c) => onToggle(p.produto_id, !!c)}
                />
                <span className="flex-1 truncate text-sm">
                  {p.nome}
                  {(p.variacoes ?? 0) > 1 && (
                    <span className="ml-1.5 inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-px text-[9px] font-medium text-muted-foreground align-middle">
                      {p.variacoes} cores
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0 text-right">
                  {p.codigo_sku}
                  {p.preco_venda != null && (
                    <>
                      {" · "}
                      <span className={p.preco_promocional != null ? "text-success font-medium" : undefined}>
                        {brl(p.preco_venda)}
                      </span>
                      {p.preco_promocional != null && p.preco_cheio != null && (
                        <span className="line-through ml-1">{brl(p.preco_cheio)}</span>
                      )}
                    </>
                  )}
                  {p.estoque != null && ` · est. ${p.estoque}`}
                </span>
                {onPrincipalChange && (
                  <button
                    type="button"
                    disabled={!sel}
                    onClick={() =>
                      onPrincipalChange(principal === p.produto_id ? null : p.produto_id)
                    }
                    className={`p-1 rounded ${sel ? "hover:bg-accent" : "opacity-20 cursor-not-allowed"}`}
                    title={principal === p.produto_id ? "Produto principal" : "Marcar como principal"}
                  >
                    <Star
                      className={`h-4 w-4 ${
                        principal === p.produto_id
                          ? "fill-warning text-warning"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                )}
              </div>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
}
