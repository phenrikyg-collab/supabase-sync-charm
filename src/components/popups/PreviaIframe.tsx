import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Popup } from "@/lib/popups";

const SRCDOC = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>html,body{margin:0;min-height:100%;background:#e9e6e1;font-family:Poppins,sans-serif}</style>
</head><body><div id="mcp-palco"></div>
<script src="https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/mc-popup-js?runtime=1"></script>
</body></html>`;

type Props = {
  popup: Popup;
  etapa: number;
  dispositivo?: "desktop" | "mobile";
  convertido?: boolean;
  onEtapa?: (idx: number) => void;
  escala?: number;
  interativo?: boolean;
  alturaMinima?: number;
  className?: string;
};

export function PreviaIframe({
  popup,
  etapa,
  dispositivo = "desktop",
  convertido = false,
  onEtapa,
  escala,
  interativo = true,
  alturaMinima = 640,
  className,
}: Props) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [pronto, setPronto] = useState(false);
  const [altura, setAltura] = useState(alturaMinima);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    function aoReceber(ev: MessageEvent) {
      const d = ev.data;
      if (!d || typeof d !== "object" || !d.mcp) return;
      if (ev.source !== ref.current?.contentWindow) return;
      if (d.mcp === "pronto") setPronto(true);
      else if (d.mcp === "altura") setAltura(Math.max(alturaMinima, Number(d.h) || 0));
      else if (d.mcp === "etapa") onEtapa?.(Number(d.idx) || 0);
      else if (d.mcp === "erro") toast.error(String(d.erro ?? "Erro na prévia"));
    }
    window.addEventListener("message", aoReceber);
    return () => window.removeEventListener("message", aoReceber);
  }, [onEtapa, alturaMinima]);

  useEffect(() => {
    if (!pronto) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const janela = ref.current?.contentWindow;
      if (!janela) return;
      janela.postMessage(
        {
          mcp: "render",
          popup: {
            id: popup.id ?? 0,
            v: popup.versao ?? 0,
            nome: popup.nome,
            formato: popup.formato,
            design: popup.design,
            regras: popup.regras,
            oferta: popup.oferta,
            fim: popup.fim ?? null,
          },
          etapa,
          dispositivo,
          convertido,
        },
        "*"
      );
    }, 150);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [pronto, popup, etapa, dispositivo, convertido]);

  const estiloEscala = escala
    ? { transform: `scale(${escala})`, transformOrigin: "top left", width: `${100 / escala}%`, height: altura }
    : { height: altura };

  return (
    <iframe
      ref={ref}
      title="Prévia do popup"
      sandbox="allow-scripts allow-same-origin"
      srcDoc={SRCDOC}
      className={className ?? "w-full rounded-md border border-border bg-muted"}
      style={{ ...estiloEscala, pointerEvents: interativo ? "auto" : "none" }}
    />
  );
}
