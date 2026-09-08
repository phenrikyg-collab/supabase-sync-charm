import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ImagePlus, Loader2, Save, Trash2, X } from "lucide-react";
import {
  FotoCatalogo,
  MAX_IMAGENS,
  caminhoDaUrl,
  enviarFoto,
  removerFoto,
  salvarImagens,
} from "@/lib/catalogoImagens";

interface Props {
  catalogoId: string | null;
  cores: string[];
  imagensIniciais?: string[];
  imagensPorCorIniciais?: Record<string, string[]>;
  enviadasEm?: string | null;
}

type Mapa = Record<string, FotoCatalogo[]>;

const CHAVE_PRODUTO = "__produto__";

function paraFotos(urls?: string[] | null): FotoCatalogo[] {
  return (urls ?? []).map((url) => ({ url, caminho: caminhoDaUrl(url) }));
}

interface Envio {
  nome: string;
  progresso: number;
  erro?: string;
}

export default function FotosCatalogo({
  catalogoId,
  cores,
  imagensIniciais,
  imagensPorCorIniciais,
  enviadasEm,
}: Props) {
  const [mapa, setMapa] = useState<Mapa>({ [CHAVE_PRODUTO]: [] });
  const [envios, setEnvios] = useState<Record<string, Envio[]>>({});
  const [urlNova, setUrlNova] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const arrastando = useRef<{ chave: string; indice: number } | null>(null);

  useEffect(() => {
    const base: Mapa = { [CHAVE_PRODUTO]: paraFotos(imagensIniciais) };
    Object.entries(imagensPorCorIniciais ?? {}).forEach(([cor, urls]) => {
      base[cor] = paraFotos(urls as string[]);
    });
    setMapa(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogoId, JSON.stringify(imagensIniciais), JSON.stringify(imagensPorCorIniciais)]);

  const lista = (chave: string) => mapa[chave] ?? [];

  const setLista = (chave: string, fn: (atual: FotoCatalogo[]) => FotoCatalogo[]) =>
    setMapa((m) => ({ ...m, [chave]: fn(m[chave] ?? []) }));

  const registrarEnvio = (chave: string, indice: number, dados: Partial<Envio>) =>
    setEnvios((e) => {
      const atual = [...(e[chave] ?? [])];
      atual[indice] = { ...atual[indice], ...dados } as Envio;
      return { ...e, [chave]: atual };
    });

  const enviarArquivos = async (chave: string, arquivos: File[]) => {
    if (!catalogoId) {
      toast.error("Salve a publicação antes de enviar fotos.");
      return;
    }
    const espaco = MAX_IMAGENS - lista(chave).length;
    if (espaco <= 0) {
      toast.error(`Máximo de ${MAX_IMAGENS} imagens.`);
      return;
    }
    const selecionados = arquivos.slice(0, espaco);
    const base = envios[chave]?.length ?? 0;
    setEnvios((e) => ({
      ...e,
      [chave]: [...(e[chave] ?? []), ...selecionados.map((a) => ({ nome: a.name, progresso: 5 }))],
    }));

    for (let i = 0; i < selecionados.length; i++) {
      const arquivo = selecionados[i];
      const idx = base + i;
      if (!["image/jpeg", "image/png"].includes(arquivo.type)) {
        registrarEnvio(chave, idx, { progresso: 100, erro: "só JPG ou PNG" });
        continue;
      }
      try {
        registrarEnvio(chave, idx, { progresso: 35 });
        const foto = await enviarFoto(catalogoId, chave === CHAVE_PRODUTO ? null : chave, arquivo);
        registrarEnvio(chave, idx, { progresso: 100 });
        setLista(chave, (a) => [...a, foto]);
      } catch (e: any) {
        registrarEnvio(chave, idx, { progresso: 100, erro: e.message });
        toast.error(`${arquivo.name}: ${e.message}`);
      }
    }
    setTimeout(() => setEnvios((e) => ({ ...e, [chave]: (e[chave] ?? []).filter((x) => x.erro) })), 1200);
  };

  const adicionarUrl = (chave: string) => {
    const url = (urlNova[chave] ?? "").trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Cole uma URL pública começando com http.");
      return;
    }
    if (lista(chave).some((f) => f.url === url)) {
      toast.error("Essa imagem já está na lista.");
      return;
    }
    if (lista(chave).length >= MAX_IMAGENS) {
      toast.error(`Máximo de ${MAX_IMAGENS} imagens.`);
      return;
    }
    setLista(chave, (a) => [...a, { url, caminho: caminhoDaUrl(url) }]);
    setUrlNova((u) => ({ ...u, [chave]: "" }));
  };

  const remover = async (chave: string, indice: number) => {
    const foto = lista(chave)[indice];
    setLista(chave, (a) => a.filter((_, i) => i !== indice));
    try {
      await removerFoto(foto?.caminho);
    } catch {
      /* imagem externa ou já removida */
    }
  };

  const soltar = (chave: string, destino: number) => {
    const origem = arrastando.current;
    arrastando.current = null;
    if (!origem || origem.chave !== chave || origem.indice === destino) return;
    setLista(chave, (a) => {
      const copia = [...a];
      const [item] = copia.splice(origem.indice, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
  };

  const salvar = async () => {
    if (!catalogoId) {
      toast.error("Salve a publicação antes de gravar as fotos.");
      return;
    }
    setSalvando(true);
    try {
      const porCor: Record<string, string[]> = {};
      cores.forEach((cor) => {
        const urls = lista(cor).map((f) => f.url);
        if (urls.length) porCor[cor] = urls;
      });
      await salvarImagens(
        catalogoId,
        lista(CHAVE_PRODUTO).map((f) => f.url),
        porCor,
      );
      toast.success("Fotos salvas.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const Area = ({ chave, titulo }: { chave: string; titulo: string }) => {
    const itens = lista(chave);
    const emAndamento = envios[chave] ?? [];
    return (
      <div className="space-y-2 rounded-md border border-border p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{titulo}</Label>
          <span className="text-xs text-muted-foreground">
            {itens.length}/{MAX_IMAGENS}
          </span>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const arquivos = Array.from(e.dataTransfer.files || []);
            if (arquivos.length) enviarArquivos(chave, arquivos);
          }}
          className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground"
        >
          arraste as fotos aqui ou
          <label className="ml-1 cursor-pointer text-primary underline">
            escolha no computador
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const arquivos = Array.from(e.target.files || []);
                if (arquivos.length) enviarArquivos(chave, arquivos);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="ou cole uma URL pública"
            value={urlNova[chave] ?? ""}
            onChange={(e) => setUrlNova((u) => ({ ...u, [chave]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionarUrl(chave);
              }
            }}
          />
          <Button type="button" variant="outline" onClick={() => adicionarUrl(chave)}>
            <ImagePlus className="h-4 w-4" />
          </Button>
        </div>

        {emAndamento.map((e, i) => (
          <div key={`${e.nome}-${i}`} className="space-y-1">
            <p className="text-xs text-muted-foreground truncate">
              {e.nome} {e.erro ? `— ${e.erro}` : e.progresso < 100 ? "— enviando" : "— pronto"}
            </p>
            <Progress value={e.progresso} className="h-1" />
          </div>
        ))}

        {itens.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {itens.map((foto, i) => (
              <div
                key={`${foto.url}-${i}`}
                draggable
                onDragStart={() => (arrastando.current = { chave, indice: i })}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  soltar(chave, i);
                }}
                className="relative h-24 w-24 overflow-hidden rounded-md border border-border"
              >
                <img src={foto.url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && (
                  <Badge className="absolute left-1 top-1 px-1 py-0 text-[10px]">principal</Badge>
                )}
                <button
                  type="button"
                  onClick={() => remover(chave, i)}
                  className="absolute right-1 top-1 rounded bg-background/90 p-0.5"
                  aria-label="Remover foto"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-serif font-bold text-foreground">Fotos</h3>
        {enviadasEm && <Badge variant="secondary">fotos já enviadas para a Tray</Badge>}
      </div>

      <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
        <li>até {MAX_IMAGENS} imagens por produto</li>
        <li>JPG ou PNG, no máximo 350 KB e 2000x2000 (o app comprime sozinho)</li>
        <li>
          o limite de 150 MB anunciado pela Tray vale só para upload manual no painel dela, não para envio
          por API
        </li>
        <li>a mesma imagem não deve ser enviada com URLs diferentes: a Tray baixa cada URL</li>
      </ul>

      <Area chave={CHAVE_PRODUTO} titulo="Fotos do produto (a primeira é a principal)" />

      {cores.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Fotos por cor</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cores.map((cor) => (
              <Area key={cor} chave={cor} titulo={cor} />
            ))}
          </div>
        </div>
      )}

      <Button type="button" variant="outline" onClick={salvar} disabled={salvando || !catalogoId}>
        {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
        Salvar fotos
      </Button>
      {!!enviadasEm && (
        <p className="text-xs text-muted-foreground">
          As fotos deste produto já foram enviadas para a Tray; o reenvio está bloqueado.
        </p>
      )}
    </div>
  );
}
