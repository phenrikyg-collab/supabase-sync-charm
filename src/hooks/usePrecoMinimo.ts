import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PrecoMinimoRow {
  product_id: any;
  nome_produto: string | null;
  preco_atual: number | null;
  custo_produto: number | null;
  preco_minimo_viavel: number | null;
  margem_atual_pct: number | null;
  status_preco: string | null;
  categoria: string | null;
}

export function usePrecoMinimo() {
  const [map, setMap] = useState<Map<string, PrecoMinimoRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const acc: PrecoMinimoRow[] = [];
        let from = 0;
        const size = 1000;
        for (let i = 0; i < 20; i++) {
          const { data, error } = await (supabase as any)
            .from("vw_preco_minimo_produtos")
            .select("*")
            .range(from, from + size - 1);
          if (error) throw error;
          const rows = (data || []) as PrecoMinimoRow[];
          acc.push(...rows);
          if (rows.length < size) break;
          from += size;
        }
        if (cancelled) return;
        const m = new Map<string, PrecoMinimoRow>();
        for (const r of acc) m.set(String(r.product_id), r);
        setMap(m);
      } catch (e: any) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { map, loading, error };
}
