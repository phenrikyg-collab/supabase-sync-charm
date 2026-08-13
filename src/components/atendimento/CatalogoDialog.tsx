import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";

export type TamanhoDisponivel = { tamanho: string; estoque: number };

export type ProdutoCatalogo = {
  id?: number | string;
  produto_id?: number | string;
  nome: string;
  preco?: number | null;
  preco_cheio?: number | null;
  preco_parcelado_5x?: number | null;
  preco_pix?: number | null;
  imagem?: string | null;
  disponivel?: boolean | null;
  tamanhos_disponiveis?: TamanhoDisponivel[] | null;
};

export function formatarPreco(v?: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Legenda de 3 informações usada ao enviar o produto na conversa. */
export function legendaProduto(p: ProdutoCatalogo) {
  const cheio = p.preco_cheio ?? p.preco;
  const partes = [formatarPreco(cheio)];
  if (p.preco_parcelado_5x != null) partes.push(`5x de ${formatarPreco(p.preco_parcelado_5x)} sem juros`);
  if (p.preco_pix != null) partes.push(`${formatarPreco(p.preco_pix)} no Pix (5% OFF)`);
  return `${p.nome}\n${partes.join(" | ")}`;
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
  const [cor, setCor] = useState<string | null>(null);
  const [tamanho, setTamanho] = useState<string | null>(null);

  const { data: opcoes } = useQuery({
    queryKey: ["catalogo-opcoes-filtro"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("catalogo_opcoes_filtro" as any);
      if (error) throw error;
      const raw = (Array.isArray(data) ? data[0] : data) as
        | { cores?: string[]; tamanhos?: string[] }
        | null;
      return { cores: raw?.cores ?? [], tamanhos: raw?.tamanhos ?? [] };
    },
  });

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["catalogo-buscar-produtos", busca, cor, tamanho],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("catalogo_buscar_produtos" as any, {
        p_palavra_chave: busca.trim() || null,
        p_cor: cor,
        p_tamanho: tamanho,
        p_limit: 30,
      });
      if (error) throw error;
      return (data ?? []) as ProdutoCatalogo[];
    },
  });

  const Pill = ({
    ativo,
    children,
    onClick,
  }: {
    ativo: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={
        ativo
          ? "rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
          : "rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
      }
    >
      {children}
    </button>
  );

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
                key={String(p.produto_id ?? p.id ?? i)}
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
                  <p className="text-sm font-bold">{formatarPreco(p.preco_cheio ?? p.preco)}</p>
                  {p.preco_parcelado_5x != null && (
                    <p className="text-[11px] text-muted-foreground">
                      ou 5x de {formatarPreco(p.preco_parcelado_5x)} sem juros
                    </p>
                  )}
                  {p.preco_pix != null && (
                    <p className="text-[11px] font-semibold text-success">
                      💚 {formatarPreco(p.preco_pix)} no Pix (5% OFF)
                    </p>
                  )}
                  {!!p.tamanhos_disponiveis?.length && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {p.tamanhos_disponiveis.map((t) => (
                        <span
                          key={t.tamanho}
                          title={`${t.estoque} em estoque`}
                          className={
                            t.estoque > 0
                              ? "inline-flex rounded bg-muted text-foreground px-1.5 py-0.5 text-[10px] font-medium"
                              : "inline-flex rounded bg-muted/50 text-muted-foreground line-through opacity-60 px-1.5 py-0.5 text-[10px]"
                          }
                        >
                          {t.tamanho}
                        </span>
                      ))}
                    </div>
                  )}
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
