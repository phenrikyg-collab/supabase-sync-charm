import { erroRh } from "./useRhAuth";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Printer, RefreshCw, FileText, Download, Receipt } from "lucide-react";
import { brl, competenciaLabel } from "@/lib/rh";
import { cn } from "@/lib/utils";
import { Holerite, HoleriteRecibo, holeriteNome, normalizarHolerite } from "./HoleriteRecibo";
import { baixarDocumentoRh, primeiroNome } from "@/lib/rhDocumento";


export type TipoHolerite = "adiantamento" | "fechamento" | "vt" | "va";

const TIPOS: { valor: TipoHolerite; label: string }[] = [
  { valor: "adiantamento", label: "Adiantamento (dia 20)" },
  { valor: "fechamento", label: "Fechamento (dia 5)" },
  { valor: "vt", label: "Recibo VT" },
  { valor: "va", label: "Recibo VA" },
];

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 10mm; }
  html, body { background: #fff !important; }
  body > *:not(#rh-print-area) { display: none !important; }
  #rh-print-area { display: block !important; width: 190mm; margin: 0; padding: 0; }
  #rh-print-area * {
    box-shadow: none !important;
    border-radius: 0 !important;
    background-image: none !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  #rh-print-area .holerite-pagina {
    width: 190mm;
    page-break-after: always;
    break-after: page;
    break-inside: avoid;
    page-break-inside: avoid;
    padding: 0;
  }
  #rh-print-area .holerite-pagina:last-child { page-break-after: auto; break-after: auto; }
  #rh-print-area .holerite-via { break-inside: avoid; page-break-inside: avoid; }
  #rh-print-area .holerite-via + .holerite-via { margin-top: 6mm; border-top: 1px dashed #999; padding-top: 4mm; }
  #rh-print-area .holerite-recibo { width: 190mm; font-size: 9px !important; line-height: 1.15 !important; }
  #rh-print-area .holerite-recibo table { font-size: 9px !important; }
  #rh-print-area .holerite-recibo th,
  #rh-print-area .holerite-recibo td {
    height: auto !important;
    min-height: 0 !important;
    padding: 0 2px !important;
    line-height: 1.15 !important;
  }
  #rh-print-area .holerite-recibo img { height: 8mm !important; width: 8mm !important; }
  #rh-print-area .holerite-recibo .bg-neutral-300 {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  #rh-print-area .holerite-recibo .bg-neutral-200,
  #rh-print-area .holerite-recibo .bg-neutral-100 { background: transparent !important; }
  #rh-print-area .holerite-recibo .p-3 { padding: 4px !important; }
  #rh-print-area .holerite-recibo .space-y-6 > * + * { margin-top: 8mm !important; }
}
`;

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toUpperCase();

const prefixo = (tipo: TipoHolerite) => (tipo === "vt" ? "RECIBO_VT" : tipo === "va" ? "RECIBO_VA" : `HOLERITE_${slug(tipo)}`);

export function HoleritesTab({
  competencia,
  tipo,
  onTipoChange,
}: {
  competencia: string;
  tipo: TipoHolerite;
  onTipoChange: (t: TipoHolerite) => void;
}) {
  const { toast } = useToast();
  const [gerando, setGerando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);
  const [comprovanteId, setComprovanteId] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Holerite | null>(null);

  const [imprimir, setImprimir] = useState<Holerite[]>([]);
  const areaRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["rh-holerites", competencia, tipo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_holerites_listar", {
        p_competencia: competencia,
        p_tipo: tipo,
      });
      if (error) throw error;
      const arr = Array.isArray(data) ? data : (data as any)?.holerites ?? [];
      return (arr as any[]).map(normalizarHolerite);
    },
    enabled: !!competencia,
  });

  const holerites = useMemo(() => data ?? [], [data]);

  const gerar = async () => {
    setGerando(true);
    const { error } = await supabase.rpc("rh_holerites_gerar", { p_competencia: competencia, p_tipo: tipo });
    setGerando(false);
    if (error) return toast({ title: "Erro ao gerar holerites", description: erroRh(error).mensagem, variant: "destructive" });
    toast({ title: "Holerites gerados" });
    refetch();
  };

  const montar = (lista: Holerite[]) =>
    new Promise<void>((resolve) => {
      setImprimir(lista);
      setTimeout(resolve, 150);
    });

  const disparar = async (lista: Holerite[]) => {
    if (!lista.length) return;
    await montar(lista);
    window.print();
    setTimeout(() => setImprimir([]), 500);
  };

  const baixarPdf = async (lista: Holerite[], nome: string) => {
    if (!lista.length) return;
    setBaixando(true);
    try {
      await montar(lista);
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const area = areaRef.current;
      if (!area) return;
      area.classList.remove("hidden");
      const paginas = Array.from(area.querySelectorAll<HTMLElement>(".holerite-pagina"));
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      for (let i = 0; i < paginas.length; i++) {
        const canvas = await html2canvas(paginas[i], { scale: 2, backgroundColor: "#ffffff" });
        const img = canvas.toDataURL("image/jpeg", 0.95);
        const largura = 210 - 12;
        const altura = Math.min((canvas.height * largura) / canvas.width, 297 - 12);
        if (i > 0) pdf.addPage();
        pdf.addImage(img, "JPEG", 6, 6, largura, altura);
      }
      pdf.save(`${nome}.pdf`);
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e?.message, variant: "destructive" });
    } finally {
      areaRef.current?.classList.add("hidden");
      setImprimir([]);
      setBaixando(false);
    }
  };

  const mesTag = competencia.slice(5, 7) + "_" + competencia.slice(0, 4);

  const baixarPdfServidor = async (h: Holerite) => {
    if (!h.id) return toast({ title: "Holerite sem identificador", variant: "destructive" });
    setBaixandoId(h.id);
    try {
      const tipoTag = (h.tipo ?? tipo) as TipoHolerite;
      const nome = `${prefixo(tipoTag)}_${primeiroNome(holeriteNome(h))}_${mesTag}.pdf`;
      await baixarDocumentoRh("holerite", h.id, nome);
    } catch (e: any) {
      toast({ title: "Erro ao baixar PDF", description: e?.message, variant: "destructive" });
    } finally {
      setBaixandoId(null);
    }
  };

  const baixarComprovante = async (h: Holerite) => {
    if (!h.pagamento_id) return toast({ title: "Pagamento não identificado", variant: "destructive" });
    setComprovanteId(h.pagamento_id);
    try {
      const tipoTag = (h.tipo ?? tipo) as TipoHolerite;
      const nome = `COMPROVANTE_${slug(tipoTag)}_${primeiroNome(holeriteNome(h))}_${mesTag}.pdf`;
      await baixarDocumentoRh("comprovante", h.pagamento_id, nome);
    } catch (e: any) {
      toast({ title: "Erro ao baixar comprovante", description: e?.message, variant: "destructive" });
    } finally {
      setComprovanteId(null);
    }
  };

  const BotaoComprovante = ({ h }: { h: Holerite }) => {
    const pago = h.pagamento_status === "pago" && !!h.pagamento_id;
    const carregando = !!h.pagamento_id && comprovanteId === h.pagamento_id;
    return (
      <span title={pago ? "Baixar comprovante de pagamento" : "disponível após o pagamento"}>
        <Button size="sm" variant="ghost" disabled={!pago || carregando} onClick={() => baixarComprovante(h)}>
          <Receipt className={cn("h-3.5 w-3.5 mr-1", carregando && "animate-pulse")} />
          {carregando ? "Gerando..." : "Comprovante"}
        </Button>
      </span>
    );
  };


  return (
    <div className="space-y-6">
      <style>{PRINT_CSS}</style>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-md border p-1">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              onClick={() => onTipoChange(t.valor)}
              className={cn(
                "px-3 py-1.5 text-sm rounded",
                tipo === t.valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => disparar(holerites)} disabled={!holerites.length}>
            <Printer className="h-3.5 w-3.5 mr-2" />Imprimir todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!holerites.length || baixando}
            onClick={() => baixarPdf(holerites, `${prefixo(tipo)}S_${mesTag}`)}
          >
            <Download className={cn("h-3.5 w-3.5 mr-2", baixando && "animate-pulse")} />Baixar todos (PDF)
          </Button>
          <Button size="sm" onClick={gerar} disabled={gerando}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-2", gerando && "animate-spin")} />
            Gerar da competência
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : !holerites.length ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              Nenhum recibo de {TIPOS.find((t) => t.valor === tipo)?.label.toLowerCase()} em {competenciaLabel(competencia)}.
            </p>
            <Button onClick={gerar} disabled={gerando}>Gerar da competência</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {holerites.map((h, i) => (
            <Card key={h.id ?? i}>
              <CardContent className="p-4 space-y-2">
                <div>
                  <p className="font-medium">{holeriteNome(h)}</p>
                  <p className="text-xs text-muted-foreground uppercase">
                    {h.tipo ?? tipo} · {competenciaLabel(h.competencia ?? competencia)}
                  </p>
                </div>
                <p className="text-xl font-serif font-bold tabular-nums">{brl(h.liquido)}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setAberto(h)}>Visualizar</Button>
                  <Button size="sm" variant="ghost" onClick={() => disparar([h])} title="Imprimir">
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Baixar PDF"
                    disabled={baixandoId === h.id}
                    onClick={() => baixarPdfServidor(h)}
                  >
                    <Download className={cn("h-3.5 w-3.5 mr-1", baixandoId === h.id && "animate-pulse")} />
                    {baixandoId === h.id ? "Gerando..." : "Baixar PDF"}
                  </Button>
                  <BotaoComprovante h={h} />
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          {aberto && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="outline" disabled={baixandoId === aberto.id}
                  onClick={() => baixarPdfServidor(aberto)}>
                  <Download className={cn("h-3.5 w-3.5 mr-2", baixandoId === aberto.id && "animate-pulse")} />
                  {baixandoId === aberto.id ? "Gerando..." : "Baixar PDF"}
                </Button>

                <BotaoComprovante h={aberto} />

                <Button size="sm" onClick={() => disparar([aberto])}>
                  <Printer className="h-3.5 w-3.5 mr-2" />Imprimir
                </Button>
              </div>
              <HoleriteRecibo h={aberto} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {createPortal(
        <div id="rh-print-area" ref={areaRef} className="hidden">
          {imprimir.map((h, i) => (
            <div className="holerite-pagina" key={h.id ?? i}>
              <div className="holerite-via"><HoleriteRecibo h={h} via="1ª via - Empresa" /></div>
              <div className="holerite-via"><HoleriteRecibo h={h} via="2ª via - Funcionário" /></div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
