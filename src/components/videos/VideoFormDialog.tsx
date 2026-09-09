import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { SeletorProdutos } from "./SeletorProdutos";
import { PlacementsEditor } from "./PlacementsEditor";
import {
  salvarVideo, subirArquivo, VIDEO_MAX_BYTES,
  type Placement, type VideoLinha, type VideoProduto,
} from "@/lib/videosVitrine";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  video: VideoLinha | null;
  onSalvo: () => void;
}

export function VideoFormDialog({ aberto, onFechar, video, onSalvo }: Props) {
  const { toast } = useToast();
  const ehInstagram = video?.origem === "instagram";

  const [titulo, setTitulo] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [somLiberado, setSomLiberado] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [produtos, setProdutos] = useState<VideoProduto[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [subindo, setSubindo] = useState<null | "video" | "capa">(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTitulo(video?.titulo ?? "");
    setVideoUrl(video?.video_url ?? "");
    setPosterUrl(video?.poster_url ?? "");
    setStoragePath(video?.storage_path ?? null);
    setSomLiberado(video?.som_liberado ?? false);
    setAtivo(video?.ativo ?? true);
    setProdutos(
      (video?.videos_produtos ?? []).map((p, i) => ({
        tray_product_id: String(p.tray_product_id),
        principal: !!p.principal,
        ordem: p.ordem ?? i,
      })),
    );
    setPlacements(
      (video?.videos_placement ?? []).map((p, i) => ({
        tipo: p.tipo, alvo: p.alvo ?? null, formato: p.formato,
        ordem: p.ordem ?? i, inicio: p.inicio ?? null, fim: p.fim ?? null, ativo: p.ativo ?? true,
      })),
    );
    setSubindo(null);
  }, [aberto, video]);

  const enviarVideo = async (file: File) => {
    if (file.size > VIDEO_MAX_BYTES) {
      toast({
        title: "Arquivo grande demais",
        description: "O limite é 200 MB por vídeo. Reduza o arquivo e tente de novo.",
        variant: "destructive",
      });
      return;
    }
    setSubindo("video");
    try {
      const { url, path } = await subirArquivo(file, "mp4");
      setVideoUrl(url);
      setStoragePath(path);
      toast({ title: "Vídeo enviado" });
    } catch (e: any) {
      toast({ title: "Falha no envio", description: e.message, variant: "destructive" });
    } finally {
      setSubindo(null);
    }
  };

  const enviarCapa = async (file: File) => {
    setSubindo("capa");
    try {
      const ext = file.type.includes("webp") ? "webp" : "jpg";
      const { url } = await subirArquivo(file, ext);
      setPosterUrl(url);
      toast({ title: "Capa enviada" });
    } catch (e: any) {
      toast({ title: "Falha no envio da capa", description: e.message, variant: "destructive" });
    } finally {
      setSubindo(null);
    }
  };

  const salvar = async () => {
    if (!titulo.trim()) {
      toast({ title: "Dê um título ao vídeo", variant: "destructive" });
      return;
    }
    if (!videoUrl) {
      toast({ title: "Falta o arquivo do vídeo", variant: "destructive" });
      return;
    }
    if (!posterUrl) {
      toast({
        title: "Sem capa",
        description: "O vídeo vai carregar sem imagem e pesa mais para a cliente.",
      });
    }
    setSalvando(true);
    try {
      await salvarVideo({
        id: video?.id,
        titulo,
        video_url: videoUrl,
        poster_url: posterUrl || null,
        storage_path: storagePath,
        som_liberado: somLiberado,
        ativo,
        produtos: produtos.map((p, i) => ({ ...p, ordem: i })),
        placements: placements.map((p, i) => ({ ...p, ordem: p.ordem ?? i })),
      });
      toast({ title: "Vídeo salvo" });
      onSalvo();
      onFechar();
    } catch (e: any) {
      toast({ title: "Não deu para salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{video ? "Editar vídeo" : "Novo vídeo"}</DialogTitle>
          <DialogDescription>
            {ehInstagram
              ? "Este vídeo veio do Instagram: o arquivo já foi baixado pelo robô."
              : "Suba o arquivo, a capa e escolha onde ele aparece."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {!ehInstagram && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Arquivo do vídeo (até 200 MB)</Label>
                <Input
                  type="file"
                  accept="video/mp4,video/*"
                  disabled={!!subindo}
                  onChange={(e) => e.target.files?.[0] && enviarVideo(e.target.files[0])}
                />
                {subindo === "video" && <Progress value={70} className="h-1.5" />}
                {videoUrl && <p className="truncate text-xs text-muted-foreground">{videoUrl}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Capa (jpg ou webp)</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/webp"
                  disabled={!!subindo}
                  onChange={(e) => e.target.files?.[0] && enviarCapa(e.target.files[0])}
                />
                {subindo === "capa" && <Progress value={70} className="h-1.5" />}
                {!posterUrl && (
                  <p className="text-xs text-warning">
                    Sem capa o vídeo carrega sem imagem e pesa mais.
                  </p>
                )}
              </div>
            </div>
          )}

          {(videoUrl || posterUrl) && (
            <video
              src={videoUrl || undefined}
              poster={posterUrl || undefined}
              controls
              preload="none"
              className="max-h-64 rounded-lg border"
            />
          )}

          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-8">
            <div>
              <div className="flex items-center gap-2">
                <Switch checked={somLiberado} onCheckedChange={setSomLiberado} />
                <span className="text-sm">Som liberado</span>
              </div>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Deixe desligado quando o áudio for música do acervo do Instagram. A licença vale para o
                Instagram, não para o site.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <span className="text-sm">Ativo</span>
            </div>
          </div>

          <Separator />
          <div className="space-y-2">
            <Label>Produtos do vídeo</Label>
            <SeletorProdutos valor={produtos} onChange={setProdutos} />
          </div>

          <Separator />
          <div className="space-y-2">
            <Label>Onde aparece</Label>
            <PlacementsEditor valor={placements} onChange={setPlacements} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !!subindo}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
