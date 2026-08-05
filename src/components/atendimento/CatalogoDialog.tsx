import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";

export type ProdutoCatalogo = {
  id?: number | string;
  nome: string;
  preco?: number | null;
  imagem?: string | null;
  disponivel?: boolean | null;
};

export function formatarPreco(v?: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CatalogoDialog({
  open,
  onOpenChange,
  onSelecionar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelecionar: (produto: ProdutoCatalogo) => void;
}) {
  const [busca, setBusca] = useState("");

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["whatsapp-catalogo", busca],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_buscar_catalogo" as any, { p_busca: busca });
      if (error) throw error;
      return (data ?? []) as ProdutoCatalogo[];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Catálogo de produtos</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto…"
            className="pl-8"
          />
        </div>
        <ScrollArea className="h-[420px] pr-2">
          {isLoading && <p className="text-sm text-muted-foreground p-2">Carregando…</p>}
          {!isLoading && produtos.length === 0 && (
            <p className="text-sm text-muted-foreground p-2">Nenhum produto encontrado.</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {produtos.map((p, i) => (
              <button
                key={String(p.id ?? i)}
                onClick={() => onSelecionar(p)}
                className="text-left border border-border rounded-lg overflow-hidden hover:border-primary transition-colors"
              >
                <div className="aspect-square bg-muted overflow-hidden">
                  {p.imagem ? (
                    <img src={p.imagem} alt={p.nome} className="w-full h-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-xs font-medium line-clamp-2">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{formatarPreco(p.preco)}</p>
                  {p.disponivel === false && (
                    <span className="inline-flex rounded-full border border-danger/20 bg-danger/10 text-danger px-2 py-0.5 text-[10px] font-semibold">
                      indisponível
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
