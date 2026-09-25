import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Copy } from "lucide-react";
import { toast } from "sonner";
import { qrSvg } from "@/lib/qrOrdem";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string;
  titulo: string; // ex.: "OC-2026-001"
  subtitulo?: string; // ex.: "Vestido Ana - Preto"
  onImprimirFicha?: () => void;
};

export function QrCodeOrdemDialog({ open, onOpenChange, url, titulo, subtitulo, onImprimirFicha }: Props) {
  const wrap = useRef<HTMLDivElement>(null);

  const baixar = () => {
    const canvas = wrap.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${titulo.replace(/[^\w-]+/g, "_")}.png`;
    a.click();
  };

  const imprimirEtiqueta = () => {
    const win = window.open("", "_blank", "width=420,height=560");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${titulo}</title>
      <style>@page{size:auto;margin:10mm}body{font-family:Arial,sans-serif;text-align:center;color:#000}
      h1{font-size:22px;margin:8px 0 2px}p{margin:2px 0;font-size:12px}</style></head>
      <body>${qrSvg(url, 260)}<h1>${titulo}</h1>${subtitulo ? `<p>${subtitulo}</p>` : ""}
      <p style="font-size:9px;color:#555;word-break:break-all">${url}</p>
      <script>window.onload=function(){window.print();}</script></body></html>`);
    win.document.close();
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado"); } catch { toast.error("Não foi possível copiar"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>QR Code - {titulo}</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div ref={wrap} className="rounded-lg border border-border bg-card p-3">
            <QRCodeCanvas value={url} size={240} marginSize={2} level="M" bgColor="#ffffff" fgColor="#000000" />
          </div>
          {subtitulo && <p className="text-center text-sm text-muted-foreground">{subtitulo}</p>}
          <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" size="sm" onClick={copiar}><Copy className="mr-1 h-4 w-4" />Copiar link</Button>
          <Button variant="outline" size="sm" onClick={baixar}><Download className="mr-1 h-4 w-4" />Baixar</Button>
          <Button variant="outline" size="sm" onClick={imprimirEtiqueta}><Printer className="mr-1 h-4 w-4" />Imprimir QR</Button>
          {onImprimirFicha && (
            <Button size="sm" onClick={onImprimirFicha}><Printer className="mr-1 h-4 w-4" />Ficha com QR</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
