import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { enviarImagem, popupsApi, type Figurinha } from "@/lib/popups";

const TODAS = "__todas__";

/** Grade de figurinhas prontas, com filtro por pasta e busca por nome. */
export function GradeFigurinhas({
  aberto, onOpenChange, aoEscolher,
}: { aberto: boolean; onOpenChange: (v: boolean) => void; aoEscolher: (f: Figurinha) => void }) {
  const [pasta, setPasta] = useState(TODAS);
  const [busca, setBusca] = useState("");

  const { data: figurinhas = [], isLoading, error } = useQuery({
    queryKey: ["popups-figurinhas"],
    queryFn: () => popupsApi.figurinhas(),
    enabled: aberto,
  });

  const pastas = useMemo(
    () => [...new Set(figurinhas.map((f) => f.pasta).filter(Boolean) as string[])],
    [figurinhas],
  );

  const lista = figurinhas.filter(
    (f) =>
      (pasta === TODAS || f.pasta === pasta) &&
      (!busca.trim() || f.nome.toLowerCase().includes(busca.trim().toLowerCase())),
  );

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Escolher figurinha</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Select value={pasta} onValueChange={setPasta}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Pasta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as pastas</SelectItem>
              {pastas.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            className="w-52"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pelo nome"
          />
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando figurinhas...</p>}
        {error && <p className="text-sm text-danger">Não deu para carregar: {(error as Error).message}</p>}
        {!isLoading && lista.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma figurinha com esse filtro.</p>
        )}

        <div className="grid max-h-[55vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-5">
          {lista.map((f) => (
            <button
              key={f.url}
              type="button"
              onClick={() => { aoEscolher(f); onOpenChange(false); }}
              className="rounded-md border border-border p-2 text-left transition hover:border-primary"
            >
              <img src={f.url} alt={f.nome} className="mx-auto h-20 w-full object-contain" />
              <p className="mt-1 truncate text-[11px]">{f.nome}</p>
              {f.animada && <p className="text-[10px] text-warning">animada</p>}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Miniatura + botões de escolher, subir e remover, usado na etapa e na aba minimizada. */
export function SeletorFigurinha({
  rotulo, valor, aoMudar, popupId, compacto,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (url: string) => void;
  popupId: number | string;
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [animada, setAnimada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);

  async function subir(arquivo?: File | null) {
    if (!arquivo) return;
    setEnviando(true);
    try {
      const { url, pesada } = await enviarImagem(arquivo, popupId);
      aoMudar(url);
      setAnimada(false);
      if (pesada) toast.warning("Imagem pesada deixa o popup lento no celular.");
      else toast.success("Imagem enviada.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">{rotulo}</Label>
      <div className={cn("flex items-center gap-2", compacto && "gap-1.5")}>
        {valor ? (
          <img src={valor} alt="" className="h-14 w-14 rounded-md border border-border object-contain" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
            Sem figurinha
          </span>
        )}
        <div className="flex flex-col gap-1">
          <Button variant="outline" size="sm" onClick={() => setAberto(true)}>Escolher figurinha</Button>
          <Button variant="ghost" size="sm" disabled={enviando} onClick={() => ref.current?.click()}>
            {enviando ? "Enviando..." : "Subir imagem"}
          </Button>
          {valor && (
            <Button variant="ghost" size="sm" onClick={() => { aoMudar(""); setAnimada(false); }}>
              Remover figurinha
            </Button>
          )}
        </div>
      </div>
      {animada && (
        <p className="text-[11px] text-warning">
          Figurinha animada pesa cerca de 400 KB; prefira a estática no popup.
        </p>
      )}
      <input
        ref={ref} type="file" className="hidden"
        accept="image/webp,image/png,image/jpeg,image/gif,image/avif"
        onChange={(e) => subir(e.target.files?.[0])}
      />
      <GradeFigurinhas
        aberto={aberto}
        onOpenChange={setAberto}
        aoEscolher={(f) => { aoMudar(f.url); setAnimada(!!f.animada); }}
      />
    </div>
  );
}

export default SeletorFigurinha;
