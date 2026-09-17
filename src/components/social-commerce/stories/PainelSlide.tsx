import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Info, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  converterParaJpeg, duracaoDoVideo, ehVideo, subirMidiaStory, validarDuracao, validarMidia,
  type Slide,
} from "@/lib/stories";
import { carregarProdutosPai, normalizarBusca, type ProdutoPai } from "@/components/social-commerce/SeletorProdutos";

function Chips({
  valores, onChange, placeholder, max,
}: { valores: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number }) {
  const [texto, setTexto] = useState("");
  const adicionar = () => {
    const v = texto.trim();
    if (!v) return;
    if (max && valores.length >= max) {
      toast.error(`No máximo ${max} opções.`);
      return;
    }
    if (valores.some((x) => x.toLowerCase() === v.toLowerCase())) { setTexto(""); return; }
    onChange([...valores, v]);
    setTexto("");
  };
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          value={texto}
          placeholder={placeholder}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); adicionar(); }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={adicionar}>Adicionar</Button>
      </div>
      {valores.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {valores.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 text-xs">
              {v}
              <button type="button" onClick={() => onChange(valores.filter((x) => x !== v))} aria-label={`Remover ${v}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PainelSlide({
  slide, indice, onMudar, somenteLeitura,
}: { slide: Slide; indice: number; onMudar: (patch: Partial<Slide>) => void; somenteLeitura?: boolean }) {
  const [enviando, setEnviando] = useState(false);
  const [paraConverter, setParaConverter] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [produtos, setProdutos] = useState<ProdutoPai[]>([]);
  const [buscaProduto, setBuscaProduto] = useState("");
  const ehFalha = slide.status === "falhou";

  useEffect(() => {
    carregarProdutosPai().then(setProdutos).catch(() => setProdutos([]));
  }, []);

  const subir = async (file: File) => {
    setEnviando(true);
    try {
      const url = await subirMidiaStory(file);
      onMudar({ midia_url: url, erro: null });
      toast.success("Mídia carregada.");
      setParaConverter(null);
    } catch (e: any) {
      toast.error("Não deu para subir a mídia", { description: e?.message });
    } finally {
      setEnviando(false);
    }
  };

  const escolher = async (file?: File | null) => {
    if (!file) return;
    setParaConverter(null);
    const v = validarMidia(file);
    if (!v.ok) {
      toast.error(v.msg);
      if (v.acao === "converter") setParaConverter(file);
      return;
    }
    if (v.checarDuracao) {
      try {
        const segundos = await duracaoDoVideo(file);
        const d = validarDuracao(segundos);
        if (!d.ok) { toast.error(d.msg); return; }
      } catch (e: any) {
        toast.error(e?.message ?? "Não deu para ler a duração do vídeo.");
        return;
      }
    }
    await subir(file);
  };

  const converter = async () => {
    if (!paraConverter) return;
    setEnviando(true);
    try {
      const jpg = await converterParaJpeg(paraConverter);
      const v = validarMidia(jpg);
      if (!v.ok) { toast.error(v.msg); return; }
      await subir(jpg);
    } catch (e: any) {
      toast.error("Não deu para converter", { description: e?.message });
    } finally {
      setEnviando(false);
    }
  };

  const produtoEscolhido = produtos.find((p) => String(p.produto_id) === String(slide.produto_id ?? ""));
  const filtrados = (() => {
    const q = normalizarBusca(buscaProduto);
    if (!q) return produtos.slice(0, 20);
    return produtos
      .filter((p) =>
        normalizarBusca(p.nome ?? "").includes(q) ||
        normalizarBusca(p.codigo_sku ?? "").includes(q) ||
        (p.chave_busca ?? "").includes(q))
      .slice(0, 20);
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Slide {indice + 1}</h3>
        {slide.status && <span className="text-xs text-muted-foreground">{slide.status}</span>}
      </div>

      {slide.erro && (
        <div className={cn(
          "flex items-start gap-2 rounded-md border p-2 text-xs",
          ehFalha ? "border-destructive bg-destructive/10 text-destructive" : "border-warning bg-warning/10 text-warning",
        )}>
          {ehFalha ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
          <p><strong>{ehFalha ? "Falhou" : "Aviso"}:</strong> {ehFalha ? slide.erro : `${slide.status === "publicado" ? "Publicado" : "O slide segue no fluxo"} com um aviso: ${slide.erro}`}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Mídia do slide</Label>
        {slide.midia_url && (
          <div className="flex items-start gap-3">
            <div className="w-20 aspect-[9/16] rounded-md overflow-hidden bg-muted">
              {ehVideo(slide.midia_url) ? (
                <video src={slide.midia_url} className="h-full w-full object-cover" controls preload="metadata" />
              ) : (
                <img src={slide.midia_url} alt={`Slide ${indice + 1}`} className="h-full w-full object-cover" />
              )}
            </div>
            <Button
              variant="ghost" size="sm" disabled={somenteLeitura}
              onClick={() => onMudar({ midia_url: null })}
            >
              Remover
            </Button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,video/mp4,video/quicktime,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => { escolher(e.target.files?.[0]); e.currentTarget.value = ""; }}
        />
        <Button
          variant="outline" size="sm" className="gap-2"
          disabled={enviando || somenteLeitura}
          onClick={() => inputRef.current?.click()}
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {slide.midia_url ? "Trocar mídia" : "Subir mídia"}
        </Button>
        {paraConverter && (
          <Button size="sm" className="ml-2" disabled={enviando} onClick={converter}>
            Converter para JPEG
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground">
          Imagem: JPEG até 8 MB, largura de 320px a 1440px. Vídeo: MP4 ou MOV, de 3 a 60 segundos, até 100 MB, 9:16.
        </p>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-xs">Publicar pelo app (manual)</Label>
          <p className="text-[11px] text-muted-foreground">
            Para enquete nativa, link sticker, marcação de produto ou música.
          </p>
        </div>
        <Switch
          checked={!!slide.manual}
          disabled={somenteLeitura}
          onCheckedChange={(v) => onMudar({ manual: v })}
        />
      </div>
      {slide.manual && (
        <Textarea
          rows={2}
          placeholder="O que fazer neste slide pelo app"
          value={slide.observacao ?? ""}
          disabled={somenteLeitura}
          onChange={(e) => onMudar({ observacao: e.target.value })}
        />
      )}

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs">Palavras que disparam a resposta no Direct</Label>
        <Chips
          valores={slide.palavras_gatilho ?? []}
          onChange={(v) => onMudar({ palavras_gatilho: v })}
          placeholder="quero, link, eu"
        />
        <div className="flex items-center justify-between">
          <Label className="text-xs">Qualquer resposta vale</Label>
          <Switch
            checked={!!slide.gatilho_qualquer}
            disabled={somenteLeitura}
            onCheckedChange={(v) => onMudar({ gatilho_qualquer: v })}
          />
        </div>
        <Textarea
          rows={3}
          placeholder="Resposta que a cliente recebe no Direct"
          value={slide.resposta_dm ?? ""}
          disabled={somenteLeitura}
          onChange={(e) => onMudar({ resposta_dm: e.target.value })}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs">Produto do slide</Label>
        {produtoEscolhido ? (
          <div className="flex items-center justify-between rounded-md border p-2">
            <span className="text-xs truncate">{produtoEscolhido.nome}</span>
            <Button variant="ghost" size="sm" disabled={somenteLeitura} onClick={() => onMudar({ produto_id: null })}>
              Trocar
            </Button>
          </div>
        ) : (
          <>
            <Input
              value={buscaProduto}
              placeholder="Buscar produto por nome ou código"
              disabled={somenteLeitura}
              onChange={(e) => setBuscaProduto(e.target.value)}
            />
            {buscaProduto && (
              <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                {filtrados.map((p) => (
                  <button
                    key={p.produto_id}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent"
                    onClick={() => { onMudar({ produto_id: String(p.produto_id) }); setBuscaProduto(""); }}
                  >
                    {p.nome}
                  </button>
                ))}
                {filtrados.length === 0 && (
                  <p className="p-2 text-xs text-muted-foreground">Nenhum produto com esse nome.</p>
                )}
              </div>
            )}
          </>
        )}
        <Label className="text-xs">Ou link avulso</Label>
        <Input
          value={slide.link ?? ""}
          placeholder="https://"
          disabled={somenteLeitura}
          onChange={(e) => onMudar({ link: e.target.value })}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs">Opções de enquete por resposta (2 a 4)</Label>
        <Chips
          valores={slide.enquete_opcoes ?? []}
          onChange={(v) => onMudar({ enquete_opcoes: v })}
          placeholder="flare, reta"
          max={4}
        />
        {(slide.enquete_opcoes?.length ?? 0) === 1 && (
          <p className="text-xs text-destructive">Uma opção só não é enquete. Coloque pelo menos duas.</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          A enquete acontece no Direct: a cliente responde o story com a palavra da opção e o voto é contado.
        </p>
      </div>
    </div>
  );
}
