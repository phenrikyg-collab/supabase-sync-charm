import { useRef } from "react";
import { Film, GripVertical, Plus, X } from "lucide-react";

export const MAX_CARDS_CARROSSEL = 10;
export const MIN_CARDS_CARROSSEL = 2;

export type ItemMidia = {
  key: string;
  /** Presente quando é um arquivo novo (ainda não enviado ao bucket). */
  file?: File;
  /** Object URL (arquivo novo) ou URL pública (mídia já salva). */
  url: string;
  isVideo: boolean;
  nome?: string;
};

/**
 * Lista arrastável dos cards do carrossel (2 a 10 mídias, imagem e vídeo misturados).
 * A ordem da lista é a ordem que a seguidora desliza; o primeiro card é a capa
 * do post na grade do perfil.
 */
export function CardsCarrossel({
  itens,
  onReordenar,
  onRemover,
  onAdicionar,
}: {
  itens: ItemMidia[];
  onReordenar: (de: number, para: number) => void;
  onRemover: (key: string) => void;
  onAdicionar: (files: File[]) => void;
}) {
  const dragIndex = useRef<number | null>(null);
  const cheio = itens.length >= MAX_CARDS_CARROSSEL;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {itens.map((item, i) => (
          <div
            key={item.key}
            draggable
            onDragStart={() => {
              dragIndex.current = i;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex.current != null && dragIndex.current !== i) {
                onReordenar(dragIndex.current, i);
              }
              dragIndex.current = null;
            }}
            className="relative rounded-lg border overflow-hidden bg-muted cursor-grab active:cursor-grabbing"
            title={item.nome ?? `Card ${i + 1}`}
          >
            <div className="aspect-square">
              {item.isVideo ? (
                <div className="relative h-full w-full">
                  <video src={item.url} className="h-full w-full object-cover" muted preload="metadata" playsInline />
                  <Film className="absolute bottom-1 right-1 h-3.5 w-3.5 text-background drop-shadow" />
                </div>
              ) : (
                <img src={item.url} alt={item.nome ?? `Card ${i + 1}`} className="h-full w-full object-cover" />
              )}
            </div>
            <span className="absolute top-1 left-1 rounded bg-foreground/70 text-background text-[10px] font-bold px-1.5 py-0.5">
              {i + 1}
            </span>
            {i === 0 && (
              <span className="absolute bottom-1 left-1 rounded bg-primary text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5">
                Capa
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemover(item.key)}
              className="absolute top-1 right-1 rounded-full bg-foreground/70 text-background p-0.5 hover:bg-foreground/90"
              title="Remover card"
            >
              <X className="h-3 w-3" />
            </button>
            <GripVertical className="absolute bottom-1 right-1 h-3.5 w-3.5 text-background/80 drop-shadow pointer-events-none" />
          </div>
        ))}

        <label
          className={`aspect-square rounded-lg border border-dashed flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors ${
            cheio ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-accent/40"
          }`}
          title={cheio ? "O Instagram aceita no máximo 10." : "Adicionar card"}
        >
          <Plus className="h-4 w-4" />
          Adicionar card
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            disabled={cheio}
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              if (fs.length > 0) onAdicionar(fs);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <p className="text-[10px] text-muted-foreground">
        {cheio
          ? "O Instagram aceita no máximo 10."
          : "Arraste para reordenar — a ordem aqui é a ordem que a seguidora desliza. O primeiro card é a capa do post na grade."}
      </p>
    </div>
  );
}
