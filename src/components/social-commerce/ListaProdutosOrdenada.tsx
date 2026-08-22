import { useMemo, useRef } from "react";
import type { ProdutoPai } from "./SeletorProdutos";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Star } from "lucide-react";

/**
 * Ordem dos produtos vinculados à publicação. produto_ids[0] é o produto
 * principal — é o preço dele que a Anna cita na resposta completa de comentário.
 */
export function ListaProdutosOrdenada({
  ids,
  produtos,
  onChange,
}: {
  ids: string[];
  produtos: ProdutoPai[];
  onChange: (ids: string[]) => void;
}) {
  const dragIndex = useRef<number | null>(null);
  const mapa = useMemo(() => new Map(produtos.map((p) => [p.produto_id, p])), [produtos]);

  if (ids.length === 0) return null;

  return (
    <div className="space-y-1 rounded-lg border p-2">
      {ids.map((id, i) => {
        const p = mapa.get(id);
        return (
          <div
            key={id}
            draggable
            onDragStart={() => {
              dragIndex.current = i;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex.current != null && dragIndex.current !== i) {
                const copia = [...ids];
                const [movido] = copia.splice(dragIndex.current, 1);
                copia.splice(i, 0, movido);
                onChange(copia);
              }
              dragIndex.current = null;
            }}
            className="flex items-center gap-2 rounded px-2 py-1.5 bg-muted/50 hover:bg-accent/40 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
            <span className="flex-1 truncate text-sm">{p?.nome ?? id}</span>
            {i === 0 && (
              <Badge variant="secondary" className="gap-1 text-[9px] px-1.5 py-px shrink-0">
                <Star className="h-2.5 w-2.5 fill-warning text-warning" /> Principal
              </Badge>
            )}
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground px-1 pt-1">
        O primeiro da lista é o produto principal — é o preço dele que a Anna cita na resposta de
        comentário. Arraste para reordenar.
      </p>
    </div>
  );
}
