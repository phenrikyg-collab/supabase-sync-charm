import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TrayProd = {
  id: string;                 // "tray-{variant_product_id}"
  variant_product_id: number;
  nome: string;               // derivado do slug da URL
  reference: string | null;   // ex. PREGA-AZ
  custo: number | null;       // variant_cost_price (mín. > 0)
  preco: number | null;       // variant_price (máx.)
  cores: string[];
  tamanhos: string[];
  qtdVariantes: number;
  jaCadastrado: boolean;      // match com produtos pelo nome/SKU
};

export function decodePy(s: string): string {
  return s.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
export function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
export function extrairNomeTray(url: string | null): string {
  if (!url) return "";
  const m = url.match(/\/([a-z0-9-]+)\?variant_id=/i);
  if (!m) return "";
  return m[1].split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
function extrairCorTray(sku: string | null): string | null {
  if (!sku) return null;
  const m = sku.match(/'type':\s*u?'Cor'[^}]*'value':\s*u?'([^']+)'/i);
  return m ? decodePy(m[1]).trim() : null;
}
function extrairTamanhoTray(sku: string | null): string | null {
  if (!sku) return null;
  const m = sku.match(/'type':\s*u?'Tamanho'[^}]*'value':\s*u?'([^']+)'/i);
  return m ? decodePy(m[1]).trim() : null;
}

type ProdutoMatch = { id: string; nome_do_produto: string; codigo_sku: string | null };

export function useTrayProdutos(enabled = true) {
  const [data, setData] = useState<TrayProd[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // produtos já cadastrados — para detectar duplicidade
        const { data: prods, error: errP } = await (supabase as any)
          .from("produtos")
          .select("id, nome_do_produto, codigo_sku");
        if (errP) throw errP;
        const produtos: ProdutoMatch[] = prods || [];
        const produtosSlugs = new Set(produtos.map((p) => slugify(p.nome_do_produto || "")));
        const produtosSkus = new Set(
          produtos.map((p) => (p.codigo_sku || "").trim().toLowerCase()).filter(Boolean)
        );

        // variantes Tray paginadas
        const PAGE = 1000;
        let from = 0;
        const all: any[] = [];
        for (let i = 0; i < 20; i++) {
          const { data: vs, error: errV } = await (supabase as any)
            .from("tray_products_variants")
            .select("variant_product_id, variant_sku, variant_url, variant_reference, variant_cost_price, variant_price")
            .range(from, from + PAGE - 1);
          if (errV) throw errV;
          if (!vs || vs.length === 0) break;
          all.push(...vs);
          if (vs.length < PAGE) break;
          from += PAGE;
        }

        const grupos = new Map<number, any[]>();
        for (const v of all) {
          if (v.variant_product_id == null) continue;
          const arr = grupos.get(v.variant_product_id) || [];
          arr.push(v);
          grupos.set(v.variant_product_id, arr);
        }

        const lista: TrayProd[] = [];
        for (const [pid, vs] of grupos) {
          const cores = new Set<string>();
          const tams = new Set<string>();
          let custo: number | null = null;
          let preco: number | null = null;
          let nome = "";
          let reference: string | null = null;
          for (const v of vs) {
            const c = extrairCorTray(v.variant_sku); if (c) cores.add(c);
            const t = extrairTamanhoTray(v.variant_sku); if (t) tams.add(t);
            const cp = Number(v.variant_cost_price) || 0;
            if (cp > 0 && (custo == null || cp < custo)) custo = cp;
            const pp = Number(v.variant_price) || 0;
            if (pp > 0 && (preco == null || pp > preco)) preco = pp;
            if (!nome) nome = extrairNomeTray(v.variant_url);
            if (!reference && v.variant_reference) reference = v.variant_reference;
          }
          if (!nome) nome = `Produto Tray #${pid}`;
          const slug = slugify(nome);
          const refLower = (reference || "").trim().toLowerCase();
          const jaCadastrado = produtosSlugs.has(slug) || (refLower.length > 0 && produtosSkus.has(refLower));
          lista.push({
            id: `tray-${pid}`,
            variant_product_id: pid,
            nome,
            reference,
            custo,
            preco,
            cores: Array.from(cores).sort(),
            tamanhos: Array.from(tams),
            qtdVariantes: vs.length,
            jaCadastrado,
          });
        }
        lista.sort((a, b) => a.nome.localeCompare(b.nome));
        if (!cancelled) setData(lista);
      } catch (e: any) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  return { data, loading, error };
}
