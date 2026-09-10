import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GripVertical, Loader2, Search, Star, X } from "lucide-react";
import {
  produtosBuscar, produtosPorIds, videoProdutosDefinir, formatarMoeda,
  type ProdutoBusca, type VideoProduto,
} from "@/lib/videosVitrine";

interface Info {
  nome: string;
  preco: number | null;
  imagem: string | null;
  categoria: string | null;
  estoque: number | null;
}

interface Props {
  aberto: boolean;
  videoId: string | null;
  produtosIniciais: VideoProduto[];
  onFechar: () => void;
  onSalvo?: () => void;
}

export function PecasVideoDialog({ aberto, videoId, produtosIniciais, onFechar, onSalvo }: Props) {
  const { toast } = useToast();
  const [termo, setTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [lista, setLista] = useState<VideoProduto[]>([]);
  const [info, setInfo] = useState<Record<string, Info>>({});
  const [salvando, setSalvando] = useState(false);
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setTermo("");
    setResultados([]);
    const inicial = produtosIniciais.map((p, i) => ({
      tray_product_id: String(p.tray_product_id),
      principal: !!p.principal,
      ordem: p.ordem ?? i,
    }));
    setLista(inicial.sort((a, b) => a.ordem - b.ordem));
    if (inicial.length) {
      produtosPorIds(inicial.map((p) => p.tray_product_id))
        .then((m) => {
          const novo: Record<string, Info> = {};
          for (const [id, p] of Object.entries(m)) {
            novo[id] = {
              nome: p.nome,
              preco: p.preco_venda,
              imagem: p.imagem,
              categoria: null,
              estoque: p.estoque,
            };
          }
          setInfo((a) => ({ ...novo, ...a }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, videoId]);

  useEffect(() => {
    if (!aberto) return;
    const t = setTimeout(async () => {
      if (!termo.trim()) return setResultados([]);
      setBuscando(true);
      try {
        setResultados(await produtosBuscar(termo));
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [termo, aberto]);

  const adicionar = (p: ProdutoBusca) => {
    const id = String(p.tray_product_id);
    setInfo((a) => ({
      ...a,
      [id]: { nome: p.nome, preco: p.preco, imagem: p.imagem, categoria: p.categoria, estoque: p.estoque },
    }));
    setLista((l) =>
      l.some((v) => v.tray_product_id === id)
        ? l
        : [...l, { tray_product_id: id, principal: l.length === 0, ordem: l.length }],
    );
    setTermo("");
    setResultados([]);
  };

  const remover = (id: string) =>
    setLista((l) => {
      const restante = l.filter((v) => v.tray_product_id !== id).map((v, i) => ({ ...v, ordem: i }));
      if (restante.length && !restante.some((v) => v.principal)) restante[0].principal = true;
      return restante;
    });

  const marcarPrincipal = (id: string) =>
    setLista((l) => l.map((v) => ({ ...v, principal: v.tray_product_id === id })));

  const soltar = (destino: number) => {
    const origem = dragIndex.current;
    dragIndex.current = null;
    if (origem == null || origem === destino) return;
    setLista((l) => {
      const copia = [...l];
      const [movido] = copia.splice(origem, 1);
      copia.splice(destino, 0, movido);
      return copia.map((v, i) => ({ ...v, ordem: i }));
    });
  };

  const salvar = async () => {
    if (!videoId) return;
    setSalvando(true);
    try {
      await videoProdutosDefinir(videoId, lista);
      toast({
        title: "Peças salvas",
        description: lista.length
          ? "O vídeo passa a aparecer na página de cada peça marcada."
          : "Nenhuma peça marcada: o vídeo sai das páginas de produto.",
      });
      onSalvo?.();
      onFechar();
    } catch (e: any) {
      toast({ title: "Não deu para salvar as peças", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Peças do vídeo</DialogTitle>
          <DialogDescription>
            Marque a peça principal e as peças complementares que aparecem no vídeo. O mesmo vídeo vai
            aparecer na página de todas elas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar pelo nome da peça ou pelo código..."
            />
            {buscando && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {resultados.length > 0 && (
            <div className="max-h-60 divide-y overflow-y-auto rounded-md border">
              {resultados.map((p) => (
                <button
                  key={p.tray_product_id}
                  type="button"
                  onClick={() => adicionar(p)}
                  className="flex w-full items-center gap-3 p-2 text-left hover:bg-muted"
                >
                  {p.imagem ? (
                    <img src={p.imagem} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted" />
                  )}
                  <span className="flex-1">
                    <span className="block truncate text-sm">{p.nome}</span>
                    {p.categoria && (
                      <span className="block truncate text-xs text-muted-foreground">{p.categoria}</span>
                    )}
                  </span>
                  {(p.estoque ?? 0) <= 0 && (
                    <Badge className="bg-warning text-warning-foreground hover:bg-warning">esgotado</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{formatarMoeda(p.preco)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1 rounded-lg border p-2">
            {lista.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">Nenhuma peça marcada ainda.</p>
            ) : (
              lista.map((v, i) => {
                const p = info[v.tray_product_id];
                return (
                  <div
                    key={v.tray_product_id}
                    draggable
                    onDragStart={() => { dragIndex.current = i; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => soltar(i)}
                    className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1.5 hover:bg-accent/40"
                  >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
                    <span className="w-4 shrink-0 text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                    {p?.imagem ? (
                      <img src={p.imagem} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                    ) : (
                      <div className="h-8 w-8 shrink-0 rounded bg-muted" />
                    )}
                    <span className="flex-1 truncate text-sm">{p?.nome ?? v.tray_product_id}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatarMoeda(p?.preco)}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant={v.principal ? "secondary" : "ghost"}
                      className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                      onClick={() => marcarPrincipal(v.tray_product_id)}
                    >
                      <Star className={`h-3 w-3 ${v.principal ? "fill-primary text-primary" : ""}`} />
                      principal
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => remover(v.tray_product_id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
            <p className="px-1 pt-1 text-[10px] text-muted-foreground">
              A ordem vale para quem chega por fora. Na página de um produto marcado, aquela peça sempre
              aparece primeiro, seja qual for a ordem aqui.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !videoId}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar peças
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
