import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { GripVertical, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AVISO_LIMITE_LOTE, prepararLote, ROTULO_ORDEM_LOTE, validarArquivoStory, type OrdemLote } from "@/lib/stories";
import { uploadMidia } from "./midiaUpload";
import type { ItemMidia } from "./CardsCarrossel";

export type ItemStory = ItemMidia & { publicUrl?: string; validado?: boolean; envio?: "fila" | "enviando" | "erro"; erro?: string };

export function MidiasStories({ itens, setItens, bloqueado, onBloqueado }: {
  itens: ItemStory[];
  setItens: Dispatch<SetStateAction<ItemStory[]>>;
  bloqueado: boolean;
  onBloqueado: (valor: boolean) => void;
}) {
  const [ordem, setOrdem] = useState<OrdemLote>(() => {
    try { const v = localStorage.getItem("stories-ordem-lote"); return v === "nome" || v === "data" ? v : "selecao"; }
    catch { return "selecao"; }
  });
  const [validando, setValidando] = useState(false);
  const recebendo = useRef(false);
  const atuais = useRef(itens);
  atuais.current = itens;
  const ativos = useRef(0);
  const fila = useRef<ItemStory[]>([]);
  const vistos = useRef(new Set<string>());
  const vivo = useRef(true);
  const arrastando = useRef<number | null>(null);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; fila.current = []; }; }, []);
  useEffect(() => {
    onBloqueado(validando || itens.length === 0 || itens.some((i) => !!i.file && !i.publicUrl));
  }, [itens, validando, onBloqueado]);

  const processar = () => {
    while (ativos.current < 3 && fila.current.length && vivo.current) {
      const item = fila.current.shift();
      if (!item?.file || !atuais.current.some((i) => i.key === item.key)) continue;
      const file = item.file;
      ativos.current++;
      setItens((p) => p.map((i) => i.key === item.key ? { ...i, envio: "enviando", erro: undefined } : i));
      void (async () => {
        try {
          const validacao = item.validado ? { ok: true, file } : await validarArquivoStory(file);
          if (!vivo.current) return;
          if (!validacao.ok || !validacao.file) {
            toast.warning(`${item.nome}: ${validacao.msg}`);
            setItens((p) => p.filter((i) => i.key !== item.key));
            URL.revokeObjectURL(item.url);
            return;
          }
          const publicUrl = await uploadMidia(validacao.file);
          if (vivo.current) setItens((p) => p.map((i) => i.key === item.key ? { ...i, publicUrl, envio: undefined, erro: undefined } : i));
        } catch (e) {
          if (vivo.current) setItens((p) => p.map((i) => i.key === item.key ? { ...i, envio: "erro", erro: e instanceof Error ? e.message : "Falha ao enviar" } : i));
        } finally { ativos.current--; processar(); }
      })();
    }
  };
  useEffect(() => {
    for (const item of itens) {
      if (item.file && !item.publicUrl && !vistos.current.has(item.key)) {
        vistos.current.add(item.key); fila.current.push(item);
      }
    }
    processar();
  }, [itens]);

  const adicionar = async (files: File[]) => {
    if (recebendo.current || bloqueado) return;
    recebendo.current = true;
    const lote = prepararLote(files, ordem);
    if (lote.excedeu) toast.warning(AVISO_LIMITE_LOTE);
    setValidando(true);
    const novos: ItemStory[] = [];
    try {
      for (const file of lote.aceitos) {
        const v = await validarArquivoStory(file);
        if (!vivo.current) return;
        if (!v.ok || !v.file) { toast.warning(`${file.name}: ${v.msg}`); continue; }
        novos.push({ key: crypto.randomUUID(), file: v.file, validado: true, url: URL.createObjectURL(v.file), nome: file.name, isVideo: v.file.type.startsWith("video/"), envio: "fila" });
      }
      if (vivo.current) setItens((p) => [...p, ...novos]);
    } finally { recebendo.current = false; if (vivo.current) setValidando(false); }
  };

  return <div className="space-y-2">
    <div className="space-y-1">
      <Label>Ordem dos slides</Label>
      <Select value={ordem} disabled={bloqueado} onValueChange={(v: OrdemLote) => { setOrdem(v); try { localStorage.setItem("stories-ordem-lote", v); } catch { /* armazenamento indisponível */ } }}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>{(Object.keys(ROTULO_ORDEM_LOTE) as OrdemLote[]).map((v) => <SelectItem key={v} value={v}>{ROTULO_ORDEM_LOTE[v]}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void adicionar(Array.from(e.dataTransfer.files)); }} className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 cursor-pointer text-sm text-muted-foreground hover:bg-accent/40">
      {validando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {validando ? "Validando mídias..." : "Selecionar mídias"}
      <input type="file" multiple accept="image/*,video/*" aria-label="Mídias dos stories" className="hidden" disabled={bloqueado || validando} onChange={(e) => { void adicionar(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    </label>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {itens.map((item, indice) => <div key={item.key} className="w-28 shrink-0 space-y-1" draggable={!bloqueado} onDragStart={() => { arrastando.current = indice; }} onDragEnd={() => { arrastando.current = null; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
        e.preventDefault(); const de = arrastando.current; arrastando.current = null;
        if (de === null || de === indice || bloqueado) return;
        setItens((p) => { const copia = [...p]; const [movido] = copia.splice(de, 1); if (movido) copia.splice(indice, 0, movido); return copia; });
      }}>
        <div className="relative aspect-[9/16] overflow-hidden rounded-md border bg-muted">
          {item.isVideo ? <video src={item.url} className="h-full w-full object-cover" muted playsInline preload="metadata" /> : <img src={item.url} alt={`Story ${indice + 1}`} className="h-full w-full object-cover" />}
          <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 text-xs text-background">{indice + 1}</span>
          <Button size="icon" variant="secondary" className="absolute right-1 top-1 h-6 w-6" disabled={bloqueado} aria-label={`Remover story ${indice + 1}`} onClick={() => { if (item.file) URL.revokeObjectURL(item.url); setItens((p) => p.filter((i) => i.key !== item.key)); }}><X className="h-3 w-3" /></Button>
          <GripVertical className="absolute bottom-1 right-1 h-4 w-4 text-background" />
        </div>
        <p className="truncate text-[10px] text-muted-foreground" title={item.nome}>{item.nome}</p>
        {(item.envio === "fila" || item.envio === "enviando") && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{item.envio === "fila" ? "Na fila" : "Enviando"}</p>}
        {item.envio === "erro" && <><p className="break-words text-xs text-destructive">{item.erro}</p><Button variant="outline" size="sm" disabled={bloqueado} className="h-7 px-1 text-xs" onClick={() => { setItens((p) => p.map((i) => i.key === item.key ? { ...i, envio: "fila" } : i)); fila.current.push(item); processar(); }}><RotateCcw className="mr-1 h-3 w-3" />Tentar de novo</Button></>}
      </div>)}
    </div>
  </div>;
}