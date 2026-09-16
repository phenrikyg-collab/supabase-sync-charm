import { AlertTriangle, GripVertical, Smartphone, Trash2, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CLASSE_STATUS_SLIDE, ROTULO_STATUS_SLIDE, ehVideo, slideInvalido, type Slide,
} from "@/lib/stories";

type Props = {
  slide: Slide;
  indice: number;
  selecionado: boolean;
  onSelecionar: () => void;
  onExcluir: () => void;
  onArrastarInicio: () => void;
  onSoltarSobre: () => void;
  ancora?: string;
};

export default function SlideCard({
  slide, indice, selecionado, onSelecionar, onExcluir, onArrastarInicio, onSoltarSobre, ancora,
}: Props) {
  const invalido = slideInvalido(slide);
  const status = String(slide.status ?? "pendente");

  return (
    <div
      id={ancora}
      draggable
      onDragStart={onArrastarInicio}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onSoltarSobre(); }}
      onClick={onSelecionar}
      className={cn(
        "flex gap-3 rounded-lg border p-2 cursor-pointer bg-card scroll-mt-4",
        selecionado && "ring-2 ring-primary",
        invalido && "border-destructive",
      )}
    >
      <div className="flex flex-col items-center justify-center text-muted-foreground">
        <GripVertical className="h-4 w-4" />
        <span className="text-sm font-semibold text-foreground">{indice + 1}</span>
      </div>

      <div className="relative w-14 shrink-0 aspect-[9/16] rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {slide.midia_url ? (
          ehVideo(slide.midia_url) ? (
            <Video className="h-5 w-5 text-muted-foreground" />
          ) : (
            <img src={slide.midia_url} alt={`Slide ${indice + 1}`} className="h-full w-full object-cover" />
          )
        ) : (
          <Smartphone className="h-5 w-5 text-muted-foreground" />
        )}
        {invalido && (
          <span className="absolute inset-0 flex items-center justify-center bg-destructive/25">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {slide.manual && <Badge variant="outline" className="text-[10px]">Publicar pelo app</Badge>}
          <Badge variant="outline" className={cn("text-[10px] border", CLASSE_STATUS_SLIDE[status])}>
            {ROTULO_STATUS_SLIDE[status] ?? status}
          </Badge>
          {(slide.enquete_opcoes?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="text-[10px]">Enquete por resposta</Badge>
          )}
          {(slide.palavras_gatilho?.length ?? 0) > 0 || slide.gatilho_qualquer ? (
            <Badge variant="secondary" className="text-[10px]">Gatilho de resposta</Badge>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground truncate">
          {slide.manual
            ? slide.observacao || "Sem observação"
            : slide.midia_url || "Sem mídia"}
        </p>

        {slide.erro && (
          <p className="text-xs text-destructive break-words">{slide.erro}</p>
        )}
        {!slide.erro && !slide.manual && !slide.midia_url && (
          <p className="text-xs text-destructive">Sem mídia. Suba um JPEG ou um MP4, ou marque como manual.</p>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground"
        onClick={(e) => { e.stopPropagation(); onExcluir(); }}
        aria-label="Excluir slide"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
