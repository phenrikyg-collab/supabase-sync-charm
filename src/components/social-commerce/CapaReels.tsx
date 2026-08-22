import { useRef, useState } from "react";
import { uploadMidia } from "./midiaUpload";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { Film, ImagePlus, Loader2, Trash2 } from "lucide-react";

function fmtSegundos(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(".", ",")}s`;
}

/**
 * Bloco CAPA do agendamento (Reels e vídeo de feed).
 * Dois caminhos: imagem própria (capa_url → cover_url) ou frame do vídeo
 * (capa_offset_ms → thumb_offset). Se os dois estiverem preenchidos,
 * a imagem enviada é a que vale.
 */
export function CapaReels({
  videoSrc,
  capaUrl,
  onCapaUrl,
  capaOffsetMs,
  onCapaOffsetMs,
}: {
  /** URL (objeto ou pública) do primeiro vídeo da publicação, para o preview do frame. */
  videoSrc: string | null;
  capaUrl: string;
  onCapaUrl: (url: string) => void;
  capaOffsetMs: number | null;
  onCapaOffsetMs: (ms: number | null) => void;
}) {
  const [aba, setAba] = useState<"imagem" | "frame">("imagem");
  const [subindo, setSubindo] = useState(false);
  const [duracaoMs, setDuracaoMs] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const enviarCapa = async (file: File) => {
    if (subindo) return;
    setSubindo(true);
    try {
      const url = await uploadMidia(file, "capas");
      onCapaUrl(url);
      toast.success("Capa enviada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar a capa");
    } finally {
      setSubindo(false);
    }
  };

  const escolherFrame = (ms: number) => {
    onCapaOffsetMs(ms);
    if (videoRef.current) videoRef.current.currentTime = ms / 1000;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label>Capa do vídeo</Label>
        <ToggleGroup
          type="single"
          value={aba}
          onValueChange={(v) => v && setAba(v as "imagem" | "frame")}
          className="h-8"
        >
          <ToggleGroupItem value="imagem" className="gap-1.5 h-8 px-2.5 text-xs">
            <ImagePlus className="h-3.5 w-3.5" /> Enviar imagem
          </ToggleGroupItem>
          <ToggleGroupItem value="frame" className="gap-1.5 h-8 px-2.5 text-xs">
            <Film className="h-3.5 w-3.5" /> Frame do vídeo
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {aba === "imagem" ? (
        capaUrl ? (
          <div className="flex gap-4 items-start">
            <div className="w-28 aspect-[9/16] rounded-lg overflow-hidden border bg-muted shrink-0">
              <img src={capaUrl} alt="Capa do Reels" className="h-full w-full object-cover" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Imagem 9:16. O Instagram corta para 4:5 na grade do perfil — deixe o assunto no centro.
              </p>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onCapaUrl("")}>
                <Trash2 className="h-3 w-3 mr-1" /> Remover imagem
              </Button>
            </div>
          </div>
        ) : (
          <label
            className={`flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors ${
              subindo ? "opacity-60 cursor-wait" : "cursor-pointer hover:bg-accent/40"
            }`}
          >
            {subindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {subindo ? "Enviando capa…" : "Enviar imagem de capa (JPEG, 9:16)"}
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/*"
              className="hidden"
              disabled={subindo}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) enviarCapa(f);
                e.target.value = "";
              }}
            />
          </label>
        )
      ) : videoSrc ? (
        <div className="flex gap-4 items-start">
          <div className="w-28 aspect-[9/16] rounded-lg overflow-hidden border bg-muted shrink-0">
            <video
              ref={videoRef}
              src={videoSrc}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                setDuracaoMs(Number.isFinite(d) ? Math.round(d * 1000) : null);
              }}
            />
          </div>
          <div className="flex-1 space-y-2 pt-1">
            <input
              type="range"
              min={0}
              max={duracaoMs ?? 0}
              step={100}
              value={capaOffsetMs ?? 0}
              onChange={(e) => escolherFrame(Number(e.target.value))}
              className="w-full accent-primary"
              disabled={duracaoMs == null}
            />
            <p className="text-xs text-muted-foreground">
              Frame em {fmtSegundos(capaOffsetMs ?? 0)}
              {duracaoMs != null && ` de ${fmtSegundos(duracaoMs)}`}
              {duracaoMs == null && " — carregando vídeo…"}
            </p>
            {capaOffsetMs != null && (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onCapaOffsetMs(null)}>
                <Trash2 className="h-3 w-3 mr-1" /> Limpar frame
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-4 text-center">
          Envie o vídeo no campo Mídia acima para escolher o frame.
        </p>
      )}

      <p className="text-[10px] text-muted-foreground">
        Sem imagem nem frame, o Instagram escolhe a capa sozinho. Se os dois estiverem preenchidos,
        a imagem enviada é a que vale.
      </p>
    </div>
  );
}
