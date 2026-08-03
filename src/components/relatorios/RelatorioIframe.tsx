import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Printer, FileQuestion } from "lucide-react";

interface RelatorioIframeProps {
  src: string;
  title: string;
  /** mensagem exibida quando o arquivo ainda não existe */
  emptyMessage?: string;
}

export function RelatorioIframe({ src, title, emptyMessage }: RelatorioIframeProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"checking" | "ok" | "missing">("checking");

  useEffect(() => {
    let ativo = true;
    setStatus("checking");
    fetch(src, { method: "GET" })
      .then((r) => {
        const tipo = r.headers.get("content-type") ?? "";
        if (!ativo) return;
        setStatus(r.ok && tipo.includes("html") ? "ok" : "missing");
      })
      .catch(() => ativo && setStatus("missing"));
    return () => {
      ativo = false;
    };
  }, [src]);

  const imprimir = () => {
    const win = ref.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    } else {
      window.open(src, "_blank", "noopener");
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

  return (
    <div className="space-y-3">
      <div className="px-4 sm:px-0 flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => window.open(src, "_blank", "noopener")}>
          <ExternalLink className="h-4 w-4 mr-2" /> Abrir em nova aba
        </Button>
        <Button size="sm" onClick={imprimir}>
          <Printer className="h-4 w-4 mr-2" /> Imprimir
        </Button>
      </div>
      <iframe
        ref={ref}
        key={src}
        src={src}
        title={title}
        className="w-full h-[70vh] sm:h-[calc(100vh-190px)] min-h-[520px] border-0 bg-background"
      />
    </div>
  );
}
