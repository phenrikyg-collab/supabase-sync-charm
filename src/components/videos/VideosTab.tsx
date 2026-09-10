import { useEffect, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Tag } from "lucide-react";
import { VideoFormDialog } from "./VideoFormDialog";
import { PecasVideoDialog } from "./PecasVideoDialog";
import {
  listarVideos, excluirVideo, metricasPorVideo, produtosPorIds, pct,
  type MetricaVideo, type ProdutoPai, type VideoLinha,
} from "@/lib/videosVitrine";

function resumoPlacements(v: VideoLinha) {
  const ps = v.videos_placement ?? [];
  if (!ps.length) return "—";
  return ps
    .map((p) => `${p.tipo}${p.alvo ? `:${p.alvo}` : ""} (${p.formato})`)
    .join(", ");
}

export function VideosTab() {
  const { toast } = useToast();
  const [videos, setVideos] = useState<VideoLinha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [produtos, setProdutos] = useState<Record<string, ProdutoPai>>({});
  const [metricas, setMetricas] = useState<Record<string, MetricaVideo>>({});
  const [form, setForm] = useState<{ aberto: boolean; video: VideoLinha | null }>({ aberto: false, video: null });
  const [excluir, setExcluir] = useState<VideoLinha | null>(null);
  const [pecas, setPecas] = useState<VideoLinha | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const lista = await listarVideos();
      setVideos(lista);
      const ids = lista.flatMap((v) => (v.videos_produtos ?? []).map((p) => String(p.tray_product_id)));
      if (ids.length) setProdutos(await produtosPorIds(ids));
      const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
      setMetricas(await metricasPorVideo(desde).catch(() => ({})));
    } catch (e: any) {
      toast({ title: "Não deu para carregar os vídeos", description: e.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const confirmarExclusao = async () => {
    if (!excluir) return;
    try {
      await excluirVideo(excluir.id);
      toast({ title: "Vídeo removido da vitrine", description: "O arquivo continua guardado no armazenamento." });
      setExcluir(null);
      carregar();
    } catch (e: any) {
      toast({ title: "Não deu para excluir", description: e.message, variant: "destructive" });
    }
  };

  const temEvento = Object.keys(metricas).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ aberto: true, video: null })}>
          <Plus className="mr-1 h-4 w-4" /> Novo vídeo
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Capa</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Produtos</TableHead>
              <TableHead>Onde aparece</TableHead>
              <TableHead>Som</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ))
            ) : videos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum vídeo na vitrine ainda.
                </TableCell>
              </TableRow>
            ) : (
              videos.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    {v.poster_url ? (
                      <img src={v.poster_url} alt="" className="h-14 w-9 rounded object-cover" />
                    ) : (
                      <div className="h-14 w-9 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-sm">{v.titulo ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{v.origem ?? "—"}</Badge></TableCell>
                  <TableCell className="text-sm">{v.tipo ?? "vod"}</TableCell>
                  <TableCell className="max-w-[200px] text-xs">
                    {(v.videos_produtos ?? []).length
                      ? (v.videos_produtos ?? [])
                          .map((p) => produtos[String(p.tray_product_id)]?.nome ?? p.tray_product_id)
                          .join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs">{resumoPlacements(v)}</TableCell>
                  <TableCell className="text-sm">{v.som_liberado ? "liberado" : "mudo"}</TableCell>
                  <TableCell className="text-sm">{v.ativo ? "sim" : "não"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setForm({ aberto: true, video: v })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setExcluir(v)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desempenho dos últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {!temEvento ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vídeo</TableHead>
                  <TableHead>Play / impressão</TableHead>
                  <TableHead>Clique / play</TableHead>
                  <TableHead>Carrinho / clique</TableHead>
                  <TableHead>Conclusões</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((v) => {
                  const m = metricas[v.id];
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="max-w-[240px] truncate text-sm">{v.titulo ?? v.id}</TableCell>
                      {m ? (
                        <>
                          <TableCell>{pct(m.plays, m.impressoes)}</TableCell>
                          <TableCell>{pct(m.cliques, m.plays)}</TableCell>
                          <TableCell>{pct(m.add_cart, m.cliques)}</TableCell>
                          <TableCell>{m.conclusoes}</TableCell>
                        </>
                      ) : (
                        <TableCell colSpan={4} className="text-sm text-muted-foreground">Sem dados ainda</TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <VideoFormDialog
        aberto={form.aberto}
        video={form.video}
        onFechar={() => setForm({ aberto: false, video: null })}
        onSalvo={carregar}
      />

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este vídeo da vitrine?</AlertDialogTitle>
            <AlertDialogDescription>
              Sai da vitrine do site. O arquivo continua guardado. Se for só para tirar do ar,
              prefira desmarcar "Ativo".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
