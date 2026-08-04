import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GripVertical, ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Produto = {
  id?: string;
  badge: string;
  titulo: string;
  imagem_url: string;
  galeria_urls: string[];
  features: string[];
  preco_original: string;
  preco_cupom: string;
  texto_cupom: string;
  cta_texto: string;
  cta_url: string;
  ativo: boolean;
  ordem: number;
};

const vazio = (ordem: number): Produto => ({
  badge: "", titulo: "", imagem_url: "", galeria_urls: [], features: [],
  preco_original: "", preco_cupom: "", texto_cupom: "", cta_texto: "", cta_url: "",
  ativo: true, ordem,
});

const fmtMoney = (v: string | number | null | undefined) => {
  const n = Number(v ?? 0);
  if (!n) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
};

async function uploadImagem(file: File, pasta: string) {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${pasta}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("linkbio")
    .upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return supabase.storage.from("linkbio").getPublicUrl(path).data.publicUrl;
}

export function ProdutosTab() {
  const qc = useQueryClient();
  const [itens, setItens] = useState<Produto[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [excluir, setExcluir] = useState<Produto | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["linkbio-config"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("linkbio_get_config" as any);
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (!data) return;
    const raiz = Array.isArray(data) ? data[0] ?? {} : data;
    const lista = (raiz as any).produtos_destaque ?? (raiz as any).produtos ?? [];
    setItens(
      (lista as any[]).map((p, i) => ({
        id: p.id,
        badge: p.badge ?? "",
        titulo: p.titulo ?? "",
        imagem_url: p.imagem_url ?? "",
        galeria_urls: p.galeria_urls ?? [],
        features: p.features ?? [],
        preco_original: p.preco_original != null ? String(p.preco_original) : "",
        preco_cupom: p.preco_cupom != null ? String(p.preco_cupom) : "",
        texto_cupom: p.texto_cupom ?? "",
        cta_texto: p.cta_texto ?? "",
        cta_url: p.cta_url ?? "",
        ativo: p.ativo ?? true,
        ordem: p.ordem ?? i + 1,
      })).sort((a, b) => a.ordem - b.ordem),
    );
  }, [data]);

  const salvarProduto = async (p: Produto, ordem: number) => {
    const { error } = await supabase.rpc("linkbio_admin_upsert_produto_destaque" as any, {
      p_id: p.id ?? null,
      p_badge: p.badge || null,
      p_titulo: p.titulo,
      p_imagem_url: p.imagem_url || null,
      p_galeria_urls: p.galeria_urls,
      p_features: p.features,
      p_preco_original: p.preco_original ? Number(p.preco_original) : null,
      p_preco_cupom: p.preco_cupom ? Number(p.preco_cupom) : null,
      p_texto_cupom: p.texto_cupom || null,
      p_cta_texto: p.cta_texto || null,
      p_cta_url: p.cta_url || null,
      p_ativo: p.ativo,
      p_ordem: ordem,
    });
    if (error) throw error;
  };

  const onDrop = async (destino: number) => {
    if (dragIdx === null || dragIdx === destino) return;
    const copia = [...itens];
    const [mov] = copia.splice(dragIdx, 1);
    copia.splice(destino, 0, mov);
    const reordenado = copia.map((it, i) => ({ ...it, ordem: i + 1 }));
    setItens(reordenado);
    setDragIdx(null);
    try {
      for (const [i, p] of reordenado.entries()) await salvarProduto(p, i + 1);
      toast.success("Ordem atualizada.");
      qc.invalidateQueries({ queryKey: ["linkbio-config"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao reordenar.");
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir?.id) { setExcluir(null); return; }
    const { error } = await supabase.rpc("linkbio_admin_delete_produto_destaque" as any, { p_id: excluir.id });
    setExcluir(null);
    if (error) return toast.error(error.message);
    toast.success("Produto excluído.");
    qc.invalidateQueries({ queryKey: ["linkbio-config"] });
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Arraste os cards para reordenar o carrossel</p>
        <Button onClick={() => setEditando(vazio(itens.length + 1))}>
          <Plus className="h-4 w-4 mr-2" /> Novo produto
        </Button>
      </div>

      {itens.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum produto em destaque cadastrado.
        </CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map((p, idx) => (
          <Card
            key={p.id ?? idx}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(idx)}
            className={`overflow-hidden ${dragIdx === idx ? "opacity-60" : ""} ${p.ativo ? "" : "opacity-70"}`}
          >
            <div className="relative aspect-[4/5] bg-muted">
              {p.imagem_url ? (
                <img src={p.imagem_url} alt={p.titulo} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-xs">Sem imagem</div>
              )}
              {p.badge && <Badge className="absolute left-2 top-2">{p.badge}</Badge>}
              <div
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragEnd={() => setDragIdx(null)}
                className="absolute right-2 top-2 cursor-grab rounded bg-background/80 p-1"
                aria-label="Reordenar produto"
              >
                <GripVertical className="h-4 w-4" />
              </div>
            </div>
            <CardContent className="space-y-2 pt-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium leading-tight">{p.titulo || "Sem título"}</h3>
                {!p.ativo && <Badge variant="outline">Inativo</Badge>}
              </div>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {p.features.slice(0, 3).map((f, i) => <li key={i}>• {f}</li>)}
              </ul>
              <div className="flex items-baseline gap-2 text-sm">
                {p.preco_original && <span className="line-through text-muted-foreground">{fmtMoney(p.preco_original)}</span>}
                <span className="font-semibold text-primary">{fmtMoney(p.preco_cupom || p.preco_original)}</span>
              </div>
              {p.texto_cupom && <p className="text-xs text-muted-foreground">{p.texto_cupom}</p>}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditando(p)}>Editar</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setExcluir(p)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editando && (
        <ProdutoDialog
          produto={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); qc.invalidateQueries({ queryKey: ["linkbio-config"] }); }}
          salvar={salvarProduto}
        />
      )}

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>Ele será removido do carrossel da página pública.</AlertDialogDescription>
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

function ProdutoDialog({
  produto, onClose, onSaved, salvar,
}: {
  produto: Produto;
  onClose: () => void;
  onSaved: () => void;
  salvar: (p: Produto, ordem: number) => Promise<void>;
}) {
  const [form, setForm] = useState<Produto>(produto);
  const [novaFeature, setNovaFeature] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const capaRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<Produto>) => setForm((f) => ({ ...f, ...patch }));

  const handleCapa = async (file?: File | null) => {
    if (!file) return;
    setEnviando(true);
    try {
      set({ imagem_url: await uploadImagem(file, "produtos/") });
      toast.success("Imagem enviada.");
    } catch (e: any) { toast.error(e.message ?? "Erro no upload."); }
    finally { setEnviando(false); }
  };

  const handleGaleria = async (files: FileList | null) => {
    if (!files?.length) return;
    setEnviando(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadImagem(f, "produtos/galeria/"));
      set({ galeria_urls: [...form.galeria_urls, ...urls] });
      toast.success(`${urls.length} imagem(ns) enviada(s).`);
    } catch (e: any) { toast.error(e.message ?? "Erro no upload."); }
    finally { setEnviando(false); }
  };

  const submeter = async () => {
    if (!form.titulo.trim()) return toast.error("Informe o título do produto.");
    if (!form.cta_url.trim()) return toast.error("Informe a URL de destino do CTA.");
    for (const [campo, valor] of [["Preço original", form.preco_original], ["Preço com cupom", form.preco_cupom]] as const) {
      if (valor && (isNaN(Number(valor)) || Number(valor) <= 0)) return toast.error(`${campo} deve ser um número positivo.`);
    }
    setSalvando(true);
    try {
      await salvar(form, form.ordem);
      toast.success("Produto salvo com sucesso.");
      onSaved();
    } catch (e: any) { toast.error(e.message ?? "Erro ao salvar produto."); }
    finally { setSalvando(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar produto" : "Novo produto em destaque"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Badge</Label>
            <Input value={form.badge} onChange={(e) => set({ badge: e.target.value })} placeholder="Ex: Mais vendido" />
          </div>
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => set({ titulo: e.target.value })} />
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <Switch id="prod-ativo" checked={form.ativo} onCheckedChange={(v) => set({ ativo: v })} />
            <Label htmlFor="prod-ativo" className="cursor-pointer">Ativo</Label>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Imagem principal</Label>
            <div className="flex items-center gap-3">
              {form.imagem_url && (
                <img src={form.imagem_url} alt="Prévia" className="h-20 w-16 rounded object-cover" />
              )}
              <input ref={capaRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleCapa(e.target.files?.[0])} />
              <Button type="button" variant="outline" disabled={enviando} onClick={() => capaRef.current?.click()}>
                <ImagePlus className="h-4 w-4 mr-2" /> Enviar imagem
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Galeria</Label>
            <div className="flex flex-wrap items-center gap-2">
              {form.galeria_urls.map((u) => (
                <div key={u} className="relative">
                  <img src={u} alt="Galeria" className="h-16 w-14 rounded object-cover" />
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    onClick={() => set({ galeria_urls: form.galeria_urls.filter((g) => g !== u) })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <input ref={galeriaRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => handleGaleria(e.target.files)} />
              <Button type="button" variant="outline" disabled={enviando} onClick={() => galeriaRef.current?.click()}>
                <ImagePlus className="h-4 w-4 mr-2" /> Adicionar imagens
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Features (callouts)</Label>
            <div className="flex gap-2">
              <Input
                value={novaFeature}
                onChange={(e) => setNovaFeature(e.target.value)}
                placeholder="Ex: alta sustentação"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && novaFeature.trim()) {
                    e.preventDefault();
                    set({ features: [...form.features, novaFeature.trim()] });
                    setNovaFeature("");
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => {
                if (!novaFeature.trim()) return;
                set({ features: [...form.features, novaFeature.trim()] });
                setNovaFeature("");
              }}>Adicionar</Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {form.features.map((f, i) => (
                <Badge key={`${f}-${i}`} variant="secondary" className="gap-1">
                  {f}
                  <button type="button" onClick={() => set({ features: form.features.filter((_, j) => j !== i) })}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Preço original</Label>
            <Input type="number" min="0" step="0.01" value={form.preco_original}
              onChange={(e) => set({ preco_original: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Preço com cupom</Label>
            <Input type="number" min="0" step="0.01" value={form.preco_cupom}
              onChange={(e) => set({ preco_cupom: e.target.value })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Texto do cupom</Label>
            <Input value={form.texto_cupom} onChange={(e) => set({ texto_cupom: e.target.value })} placeholder="Ex: com cupom BIO10" />
          </div>
          <div className="space-y-1.5">
            <Label>Texto do CTA</Label>
            <Input value={form.cta_texto} onChange={(e) => set({ cta_texto: e.target.value })} placeholder="Ex: Quero o meu" />
          </div>
          <div className="space-y-1.5">
            <Label>URL de destino *</Label>
            <Input value={form.cta_url} onChange={(e) => set({ cta_url: e.target.value })} placeholder="https://..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submeter} disabled={salvando || enviando}>
            {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
