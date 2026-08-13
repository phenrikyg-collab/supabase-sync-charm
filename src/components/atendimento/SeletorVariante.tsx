import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type VarianteProduto = {
  variant_id: string | number;
  cor?: string | null;
  tamanho?: string | null;
  estoque?: number | null;
  disponivel?: boolean | null;
};

/** Selects de Cor/Tamanho para um produto do catálogo (RPC pagamentos_listar_variantes_produto). */
export function SeletorVariante({
  produtoId,
  cor,
  tamanho,
  onChange,
}: {
  produtoId: string | number;
  cor?: string | null;
  tamanho?: string | null;
  onChange: (v: { variant_id: string | number | null; cor: string | null; tamanho: string | null }) => void;
}) {
  const { data: variantes = [], isLoading } = useQuery({
    queryKey: ["pagamentos-variantes", String(produtoId)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pagamentos_listar_variantes_produto" as any, {
        p_produto_id: produtoId,
      });
      if (error) throw error;
      return (data ?? []) as VarianteProduto[];
    },
  });

  const disponiveis = useMemo(
    () => variantes.filter((v) => v.disponivel !== false && (v.estoque == null || v.estoque > 0)),
    [variantes],
  );

  const cores = useMemo(
    () => Array.from(new Set(disponiveis.map((v) => v.cor).filter(Boolean) as string[])).sort(),
    [disponiveis],
  );

  const tamanhos = useMemo(
    () =>
      Array.from(
        new Set(
          disponiveis
            .filter((v) => !cor || v.cor === cor)
            .map((v) => v.tamanho)
            .filter(Boolean) as string[],
        ),
      ),
    [disponiveis, cor],
  );

  const resolverVariante = (novaCor: string | null, novoTamanho: string | null) =>
    disponiveis.find(
      (v) => (!novaCor || v.cor === novaCor) && (!novoTamanho || v.tamanho === novoTamanho),
    ) ?? null;

  if (isLoading) {
    return <p className="text-[11px] text-muted-foreground">Carregando variações…</p>;
  }
  if (disponiveis.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="text-[11px]">Cor</Label>
        <Select
          value={cor ?? undefined}
          onValueChange={(v) => {
            const variante = resolverVariante(v, tamanho ?? null);
            const tamanhoOk = variante?.tamanho === tamanho ? tamanho ?? null : null;
            const final = resolverVariante(v, tamanhoOk);
            onChange({ variant_id: final?.variant_id ?? null, cor: v, tamanho: tamanhoOk });
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecionar" />
          </SelectTrigger>
          <SelectContent>
            {cores.map((c) => (
              <SelectItem key={c} value={c} className="text-xs">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Tamanho</Label>
        <Select
          value={tamanho ?? undefined}
          disabled={tamanhos.length === 0}
          onValueChange={(t) => {
            const final = resolverVariante(cor ?? null, t);
            onChange({
              variant_id: final?.variant_id ?? null,
              cor: cor ?? final?.cor ?? null,
              tamanho: t,
            });
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecionar" />
          </SelectTrigger>
          <SelectContent>
            {tamanhos.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
