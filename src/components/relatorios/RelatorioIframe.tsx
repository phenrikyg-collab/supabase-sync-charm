import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Printer, FileQuestion, Loader2 } from "lucide-react";

interface RelatorioIframeProps {
  src: string;
  title: string;
  /** mensagem exibida quando o arquivo ainda não existe */
  emptyMessage?: string;
}

export function RelatorioIframe({ src, title, emptyMessage }: RelatorioIframeProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"checking" | "ok" | "missing">("checking");
  /** URL efetivamente usada no iframe (blob para arquivos remotos servidos como text/plain) */
  const [finalSrc, setFinalSrc] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    let blobUrl: string | null = null;
    setStatus("checking");
    setFinalSrc(null);

    (async () => {
      try {
        const resp = await fetch(src);
        if (!resp.ok) throw new Error("not found");
        const texto = await resp.text();
        if (!ativo) return;
        // o storage devolve HTML como text/plain (CSP sandbox), então renderizamos via blob
        if (!/<\s*(!doctype|html|head|body|div|section)/i.test(texto)) {
          setStatus("missing");
          return;
        }
        blobUrl = URL.createObjectURL(new Blob([texto], { type: "text/html;charset=utf-8" }));
        setFinalSrc(blobUrl);
        setStatus("ok");
      } catch {
        if (ativo) setStatus("missing");
      }
    })();

    return () => {
      ativo = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src]);

  const abrir = () => window.open(finalSrc ?? src, "_blank", "noopener");

  const imprimir = () => {
    const win = ref.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    } else {
      abrir();
    }
  };

  if (status === "missing") {
    return (
      <div className="mx-4 sm:mx-0 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 px-6 text-center">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground max-w-md">
          {emptyMessage ?? "Relatório ainda não disponível. Ele aparecerá aqui assim que for publicado."}
        </p>
      </div>
    );
  }

  if (status === "checking" || !finalSrc) {
    return (
      <div className="mx-4 sm:mx-0 flex items-center justify-center gap-2 rounded-lg border border-border py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando relatório…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="px-4 sm:px-0 flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={abrir}>
          <ExternalLink className="h-4 w-4 mr-2" /> Abrir em nova aba
        </Button>
        <Button size="sm" onClick={imprimir}>
          <Printer className="h-4 w-4 mr-2" /> Imprimir
        </Button>
      </div>
      <iframe
        ref={ref}
        key={finalSrc}
        src={finalSrc}
        title={title}
        className="w-full h-[70vh] sm:h-[calc(100vh-190px)] min-h-[520px] border-0 bg-background"
      />
    </div>
  );
}
