import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search } from "lucide-react";

export type ProdutoPagamento = {
  produto_id: string | number;
  nome: string;
  preco_cheio?: number | null;
  preco_promocional?: number | null;
  imagem?: string | null;
};

export const moedaBR = (v?: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function precoProduto(p: ProdutoPagamento) {
  return p.preco_promocional ?? p.preco_cheio ?? 0;
}

/** Autocomplete de produtos reais do catálogo (RPC pagamentos_buscar_produtos) */
export function BuscaProduto({
  onSelecionar,
  placeholder = "Buscar produto no catálogo…",
}: {
  onSelecionar: (produto: ProdutoPagamento) => void;
  placeholder?: string;
}) {
  const [termo, setTermo] = useState("");
  const [debounced, setDebounced] = useState("");
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(termo.trim()), 300);
    return () => clearTimeout(t);
  }, [termo]);

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["pagamentos-buscar-produtos", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pagamentos_buscar_produtos" as any, {
        p_palavra_chave: debounced,
      });
      if (error) throw error;
      return (data ?? []) as ProdutoPagamento[];
    },
  });

  return (
    <Popover open={aberto && debounced.length >= 2} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            placeholder={placeholder}
            className="pl-8"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[380px] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {isLoading && <p className="p-2 text-xs text-muted-foreground">Buscando…</p>}
        {!isLoading && produtos.length === 0 && (
          <p className="p-2 text-xs text-muted-foreground">Nenhum produto encontrado.</p>
        )}
        <div className="max-h-64 overflow-y-auto">
          {produtos.map((p) => (
            <button
              key={String(p.produto_id)}
              type="button"
              onClick={() => {
                onSelecionar(p);
                setTermo("");
                setDebounced("");
                setAberto(false);
              }}
              className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-muted"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                {p.imagem ? (
                  <img src={p.imagem} alt={p.nome} className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{p.nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {p.preco_promocional != null && p.preco_promocional !== p.preco_cheio ? (
                    <>
                      <span className="line-through">{moedaBR(p.preco_cheio)}</span>{" "}
                      <span className="font-semibold text-success">{moedaBR(p.preco_promocional)}</span>
                    </>
                  ) : (
                    moedaBR(p.preco_cheio)
                  )}
                </p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
