import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, ImagePlus, LayoutGrid, Plus, Send, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  BotaoRespostasRapidas, ListaRespostas, filtrarRespostas, registrarUso, useRespostasRapidas,
  type RespostaRapida,
} from "@/components/atendimento/RespostasRapidas";

export type ComposerHandle = {
  /** Escreve um texto pronto na caixa, sem enviar. */
  definirTexto: (t: string) => void;
  /** Texto atual da caixa. */
  obterTexto: () => string;
  /** Limpa a caixa e devolve o que estava escrito. */
  pegarELimpar: () => string;
  focar: () => void;
  abrirArquivos: () => void;
};

type Props = {
  onEnviar: (texto: string) => void;
  onImagens: (arquivos: File[]) => void;
  onAbrirCatalogo: () => void;
  onAbrirTemplate: () => void;
  /** Avisa o pai só quando a caixa passa de vazia para escrita (e o contrário). */
  onDigitandoMudou?: (digitando: boolean) => void;
  figurinhas?: ReactNode;
  mobile?: boolean;
};

/**
 * Caixa de escrever da conversa. Guarda o texto no próprio estado para que
 * digitar não repinte a lista de conversas, as mensagens nem o perfil.
 */
export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { onEnviar, onImagens, onAbrirCatalogo, onAbrirTemplate, onDigitandoMudou, figurinhas, mobile = false },
  ref,
) {
  const [texto, setTexto] = useState("");
  const textoRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const digitandoRef = useRef(false);

  const { data: respostasRapidas = [] } = useRespostasRapidas(false);
  const [indiceRapida, setIndiceRapida] = useState(0);
  const [ferramentasAbertas, setFerramentasAbertas] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [rapidasAbertas, setRapidasAbertas] = useState(false);
  const slashAtivo = texto.startsWith("/") && !texto.includes("\n");
  const rapidasFiltradas = useMemo(
    () => (slashAtivo ? filtrarRespostas(respostasRapidas, texto.slice(1)) : []),
    [slashAtivo, respostasRapidas, texto],
  );
  const listaRapidaAberta = slashAtivo && rapidasFiltradas.length > 0;

  useEffect(() => {
    setIndiceRapida(0);
  }, [texto]);

  useEffect(() => {
    const campo = textoRef.current;
    if (!campo) return;
    campo.style.height = "auto";
    campo.style.height = `${Math.min(campo.scrollHeight, 96)}px`;
  }, [texto]);

  useEffect(() => {
    const digitando = texto.trim().length > 0;
    if (digitando !== digitandoRef.current) {
      digitandoRef.current = digitando;
      onDigitandoMudou?.(digitando);
    }
  }, [texto, onDigitandoMudou]);

  useImperativeHandle(ref, () => ({
    definirTexto: (t: string) => {
      setTexto(t);
      setTimeout(() => textoRef.current?.focus(), 0);
    },
    obterTexto: () => texto,
    pegarELimpar: () => {
      const atual = texto;
      setTexto("");
      return atual;
    },
    focar: () => textoRef.current?.focus(),
    abrirArquivos: () => fileRef.current?.click(),
  }));

  const inserirResposta = (r: RespostaRapida) => {
    setTexto(r.texto);
    registrarUso(r.id);
    setTimeout(() => textoRef.current?.focus(), 0);
  };

  const despachar = () => {
    const limpo = texto.trim();
    if (!limpo) return;
    setTexto("");
    onEnviar(limpo);
  };

  return (
    <div className="relative flex min-w-0 max-w-full items-end gap-1 overflow-visible">
      {listaRapidaAberta && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-md rounded-md border border-border bg-popover shadow-lg">
          <p className="border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
            Mensagens rápidas: setas para escolher, Enter para inserir, Esc para fechar
          </p>
          <ListaRespostas
            itens={rapidasFiltradas}
            indice={indiceRapida}
            onIndice={setIndiceRapida}
            onEscolher={inserirResposta}
          />
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onImagens(Array.from(e.target.files ?? []));
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      {mobile ? (
        <>
          <Button
            size="icon"
            variant="outline"
            className="h-11 w-11 shrink-0 rounded-full"
            onClick={() => setFerramentasAbertas(true)}
            aria-label="Abrir ferramentas de envio"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Sheet open={ferramentasAbertas} onOpenChange={setFerramentasAbertas}>
            <SheetContent side="bottom" className="max-h-[70dvh] rounded-t-lg px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5">
              <SheetTitle className="mb-4">Adicionar à conversa</SheetTitle>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3">
                  {figurinhas}
                  <span className="text-sm font-medium">Figurinhas</span>
                </div>
                <Button variant="outline" className="h-11 justify-start gap-3" onClick={() => { setFerramentasAbertas(false); fileRef.current?.click(); }}>
                  <ImagePlus className="h-4 w-4" />
                  Enviar imagem
                </Button>
                <Button variant="outline" className="h-11 justify-start gap-3" onClick={() => { setFerramentasAbertas(false); onAbrirTemplate(); }}>
                  <FileText className="h-4 w-4" />
                  Enviar template
                </Button>
                <Button variant="outline" className="h-11 justify-start gap-3" onClick={() => setRapidasAbertas((v) => !v)}>
                  <Zap className="h-4 w-4" />
                  Respostas rápidas
                </Button>
              </div>
              {rapidasAbertas && (
                <div className="mt-3 overflow-hidden rounded-md border border-border">
                  <ListaRespostas
                    itens={respostasRapidas}
                    indice={indiceRapida}
                    onIndice={setIndiceRapida}
                    onEscolher={(r) => { inserirResposta(r); setFerramentasAbertas(false); setRapidasAbertas(false); }}
                  />
                </div>
              )}
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => fileRef.current?.click()} title="Enviar imagem">
            <ImagePlus className="h-4 w-4" />
          </Button>
          {figurinhas}
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onAbrirCatalogo} title="Catálogo">
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onAbrirTemplate} title="Enviar template">
            <FileText className="h-4 w-4" />
          </Button>
          <BotaoRespostasRapidas onEscolher={inserirResposta} />
        </>
      )}
      <Textarea
        ref={textoRef}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onPaste={(e) => {
          const itens = Array.from(e.clipboardData?.items ?? []);
          const arquivos = itens
            .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
            .map((i) => i.getAsFile())
            .filter((f): f is File => !!f);
          if (arquivos.length === 0) return;
          e.preventDefault();
          onImagens(arquivos);
        }}
        placeholder="Escreva sua resposta ou digite / para as mensagens rápidas"
        rows={1}
        className={mobile ? "min-h-11 max-h-24 min-w-0 flex-1 resize-none overflow-y-auto py-2.5" : "min-h-8 max-h-24 min-w-0 flex-1 resize-none overflow-y-auto py-1.5"}
        onKeyDown={(e) => {
          if (listaRapidaAberta) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndiceRapida((i) => (i + 1) % rapidasFiltradas.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndiceRapida((i) => (i - 1 + rapidasFiltradas.length) % rapidasFiltradas.length);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setTexto("");
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const escolhida = rapidasFiltradas[indiceRapida];
              if (escolhida) inserirResposta(escolhida);
              return;
            }
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            despachar();
          }
        }}
      />
      <Button
        size="icon"
        className={mobile ? "h-11 w-11 shrink-0 rounded-full" : "h-8 w-8 shrink-0 rounded-full"}
        onClick={despachar}
        disabled={!texto.trim()}
        title="Enviar"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
});
