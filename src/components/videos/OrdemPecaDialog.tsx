import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { produtoVideosListar, produtoVideosOrdenar, type ProdutoVideoLinha } from "@/lib/videosVitrine";

export function OrdemPecaDialog({
  aberto, trayProductId, nomeProduto, onFechar, onSalvo,
}: {
  aberto: boolean;
  trayProductId: string | null;
  nomeProduto?: string;
  onFechar: () => void;
  onSalvo?: () => void;
}) {
  const { toast } = useToast();
  const [lista, setLista] = useState<ProdutoVideoLinha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arrastando, setArrastando] = useState<number | null>(null);

  useEffect(() => {
    if (!aberto || !trayProductId) return;
    setCarregando(true);
    produtoVideosListar(trayProductId)
      .then(setLista)
      .catch((e: any) => toast({ title: "Não deu para carregar os vídeos da peça", description: e.message, variant: "destructive" }))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line
  }, [aberto, trayProductId]);

  const mover = (de: number, para: number) => {
    if (de === para) return;
    const item = lista[de];
    if (para === 0 && !item.tem_arquivo) {
      toast({ title: "Ainda na fila", description: "Este vídeo não pode ser o primeiro enquanto o arquivo não chega." });
      return;
    }
    const novo = [...lista];
    novo.splice(de, 1);
    novo.splice(para, 0, item);
    setLista(novo);
  };

  const salvar = async () => {
    if (!trayProductId) return;
    setSalvando(true);
    try {
      await produtoVideosOrdenar(trayProductId, lista.map((v) => v.video_id));
      toast({ title: "Ordem salva" });
      onSalvo?.();
      onFechar();
    } catch (e: any) {
      toast({ title: "Não deu para salvar a ordem", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ordem dos vídeos {nomeProduto ? `— ${nomeProduto}` : ""}</DialogTitle>
          <DialogDescription>
            Esta ordem vale só na página desta peça. O mesmo vídeo pode ser o primeiro aqui e o
            terceiro em outra peça.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <Skeleton className="h-40 w-full" />
        ) : lista.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum vídeo nesta peça.</p>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {lista.map((v, i) => (
              <div
                key={v.video_id}
                draggable
                onDragStart={() => setArrastando(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (arrastando !== null) mover(arrastando, i); setArrastando(null); }}
                className={`flex items-center gap-3 rounded-md border p-2 ${v.tem_arquivo ? "" : "opacity-50"}`}
              >
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                {v.poster_url
                  ? <img src={v.poster_url} alt="" className="h-14 w-9 rounded object-cover" />
                  : <div className="h-14 w-9 rounded bg-muted" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{v.titulo ?? v.video_id}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {v.eh_principal && <Badge variant="secondary">principal</Badge>}
                    {!v.tem_arquivo && (
                      <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">na fila</Badge>
                    )}
                    {!v.ativo && <Badge variant="outline">inativo</Badge>}
                  </div>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{i + 1}º</span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || carregando || lista.length === 0}>
            {salvando ? "Salvando..." : "Salvar ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
