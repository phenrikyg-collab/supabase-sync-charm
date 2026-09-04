import { erroRh } from "./useRhAuth";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Printer, RefreshCw, FileText, Download, Receipt, Send, Copy, MessageCircle, Check } from "lucide-react";
import { brl, competenciaLabel, dataBR } from "@/lib/rh";
import { slug } from "@/lib/rhDocumento";
import { cn } from "@/lib/utils";
import { Holerite, HoleriteRecibo, holeriteNome, normalizarHolerite } from "./HoleriteRecibo";
import {
  baixarDocumentoRh,
  mesTag,
  nomeArquivo,
  nomeArquivoColetivo,
  prefixoComprovante,
  prefixoHolerite,
  prefixoHoleriteColetivo,
} from "@/lib/rhDocumento";
import { EnviarWhatsAppDialog } from "./EnviarWhatsAppDialog";
import { EnviarLoteWhatsAppDialog } from "./EnviarLoteWhatsAppDialog";
import { EnviosWhatsAppHistorico } from "./EnviosWhatsAppHistorico";
import { FilaItem } from "@/lib/rhWhatsapp";



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

function telefoneWa(h: Holerite): string | null {
  const tipo = (h.tipo_chave_pix ?? "").toLowerCase();
  const chave = String(h.chave_pix ?? "");
  const digitos = chave.replace(/\D/g, "");
  const ehTelefone = tipo === "telefone" || (!tipo && (digitos.length === 10 || digitos.length === 11));
  if (!ehTelefone) return null;
  const semDdi = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
  if (semDdi.length < 10) return null;
  return `55${semDdi}`;
}

function mensagemCiencia(h: Holerite, competencia: string, url: string) {
  return `Oi, ${slug(holeriteNome(h))}! Segue o recibo de ${competenciaLabel(h.competencia ?? competencia)} para você conferir e confirmar o recebimento: ${url}`;
}

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
  const [ciencia, setCiencia] = useState<{ h: Holerite; url: string } | null>(null);
  const [gerandoLink, setGerandoLink] = useState<string | null>(null);
  const [linksLote, setLinksLote] = useState<{ nome: string; url: string; h: Holerite }[] | null>(null);
  const [gerandoLote, setGerandoLote] = useState(false);
  const [soPendentes, setSoPendentes] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

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
  const pendentesCiencia = useMemo(() => holerites.filter((h) => !h.ciente).length, [holerites]);
  const listaVisivel = useMemo(
    () => (soPendentes ? holerites.filter((h) => !h.ciente) : holerites),
    [holerites, soPendentes],
  );

  const [waAberto, setWaAberto] = useState<Holerite | null>(null);
  const [waLoteAberto, setWaLoteAberto] = useState(false);

  const { data: fila, refetch: refetchFila } = useQuery({
    queryKey: ["rh-whatsapp-fila", competencia, tipo],
    enabled: !!competencia,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_whatsapp_fila" as any, {
        p_competencia: competencia,
        p_tipo: tipo,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as FilaItem[];
    },
  });

  const filaPorHolerite = useMemo(() => {
    const m = new Map<string, FilaItem>();
    (fila ?? []).forEach((f) => f.holerite_id && m.set(f.holerite_id, f));
    return m;
  }, [fila]);

  const filaVisivel = useMemo(
    () => (fila ?? []).filter((f) => listaVisivel.some((h) => h.id === f.holerite_id)),
    [fila, listaVisivel],
  );

  const aposEnvio = () => {
    refetchFila();
    refetch();
  };

  const ChipsEnvio = ({ h }: { h: Holerite }) => {
    const f = h.id ? filaPorHolerite.get(h.id) : undefined;
    if (!f) return null;
    const chips: string[] = [];
    if ((f.holerite_enviado ?? 0) > 0) chips.push("holerite enviado");
    if ((f.comprovante_enviado ?? 0) > 0) chips.push("comprovante enviado");
    if ((f.ciencia_enviada ?? 0) > 0) chips.push("link enviado");
    if (!chips.length && !f.tem_numero)
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          sem WhatsApp
        </span>
      );
    return (
      <>
        {chips.map((c) => (
          <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
            {c}
          </span>
        ))}
      </>
    );
  };


  const gerar = async () => {
    setGerando(true);
    const { error } = await supabase.rpc("rh_holerites_gerar", { p_competencia: competencia, p_tipo: tipo });
    setGerando(false);
    if (error) return toast({ title: "Erro ao gerar holerites", description: erroRh(error).mensagem, variant: "destructive" });
    toast({ title: "Holerites gerados" });
    refetch();
  };

  const gerarLinkCiencia = async (h: Holerite): Promise<string | null> => {
    if (!h.id) {
      toast({ title: "Recibo sem identificador", variant: "destructive" });
      return null;
    }
    const { data, error } = await supabase.rpc("rh_holerite_link" as any, {
      p_holerite_id: h.id,
      p_dias: 30,
    });
    if (error) {
      toast({ title: "Erro ao gerar link", description: erroRh(error).mensagem, variant: "destructive" });
      return null;
    }
    const r: any = Array.isArray(data) ? data[0] : data;
    return r?.url ?? null;
  };

  const enviarCiencia = async (h: Holerite) => {
    setGerandoLink(h.id ?? null);
    const url = await gerarLinkCiencia(h);
    setGerandoLink(null);
    if (url) setCiencia({ h, url });
  };

  const enviarTodosCiencia = async () => {
    setGerandoLote(true);
    const resultados: { nome: string; url: string; h: Holerite }[] = [];
    for (const h of holerites) {
      const url = await gerarLinkCiencia(h);
      if (url) resultados.push({ nome: holeriteNome(h), url, h });
    }
    setGerandoLote(false);
    setLinksLote(resultados);
    refetch();
  };

  const copiar = async (texto: string, chave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      setTimeout(() => setCopiado(null), 2000);
      toast({ title: "Link copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
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

  const baixarPdfServidor = async (h: Holerite) => {
    if (!h.id) return toast({ title: "Holerite sem identificador", variant: "destructive" });
    setBaixandoId(h.id);
    try {
      const tipoTag = (h.tipo ?? tipo) as TipoHolerite;
      const nome = nomeArquivo(holeriteNome(h), prefixoHolerite(tipoTag), competencia);
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
      const nome = nomeArquivo(holeriteNome(h), prefixoComprovante(tipoTag), competencia);
      await baixarDocumentoRh("comprovante", h.pagamento_id, nome);
    } catch (e: any) {
      toast({ title: "Erro ao baixar comprovante", description: e?.message, variant: "destructive" });
    } finally {
      setComprovanteId(null);
    }
  };

  const ChipCiencia = ({ h }: { h: Holerite }) =>
    h.ciente ? (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        ciente em {dataBR(h.ciencia_em)}
        {h.ciencia_protocolo ? ` · #${h.ciencia_protocolo}` : ""}
      </span>
    ) : (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        aguardando ciência
      </span>
    );

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
            onClick={() => baixarPdf(holerites, nomeArquivoColetivo(prefixoHoleriteColetivo(tipo), competencia))}
          >
            <Download className={cn("h-3.5 w-3.5 mr-2", baixando && "animate-pulse")} />Baixar todos (PDF)
          </Button>
          <Button
            variant={soPendentes ? "default" : "outline"}
            size="sm"
            onClick={() => setSoPendentes((v) => !v)}
            disabled={!holerites.length}
          >
            Pendentes de ciência ({pendentesCiencia})
          </Button>
          <Button variant="outline" size="sm" onClick={enviarTodosCiencia} disabled={!holerites.length || gerandoLote}>
            <Send className={cn("h-3.5 w-3.5 mr-2", gerandoLote && "animate-pulse")} />
            {gerandoLote ? "Gerando..." : "Enviar todos para ciência"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWaLoteAberto(true)} disabled={!fila?.length}>
            <MessageCircle className="h-3.5 w-3.5 mr-2" />
            Enviar tudo no WhatsApp
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
          {listaVisivel.map((h, i) => (
            <Card key={h.id ?? i}>
              <CardContent className="p-4 space-y-2">
                <div>
                  <p className="font-medium">{holeriteNome(h)}</p>
                  <p className="text-xs text-muted-foreground uppercase">
                    {h.tipo ?? tipo} · {competenciaLabel(h.competencia ?? competencia)}
                  </p>
                </div>
                <p className="text-xl font-serif font-bold tabular-nums">{brl(h.liquido)}</p>
                {(h as any).ciencia_divergente && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2 space-y-0.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                      valor mudou depois da assinatura
                    </span>
                    <p className="text-[11px] text-amber-900 tabular-nums">
                      assinado: {brl((h as any).liquido_assinado)} · atual: {brl(h.liquido)}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <ChipCiencia h={h} />
                  <ChipsEnvio h={h} />
                </div>
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
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={gerandoLink === h.id}
                    onClick={() => enviarCiencia(h)}
                  >
                    <Send className={cn("h-3.5 w-3.5 mr-1", gerandoLink === h.id && "animate-pulse")} />
                    {h.ciente || (h as any).ciencia_divergente
                      ? "Reenviar link de ciência"
                      : "Enviar para ciência"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setWaAberto(h)}>
                    <MessageCircle className="h-3.5 w-3.5 mr-1" />
                    Enviar no WhatsApp
                  </Button>
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

      <Dialog open={!!ciencia} onOpenChange={(o) => !o && setCiencia(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Enviar para ciência</DialogTitle>
          </DialogHeader>
          {ciencia && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {holeriteNome(ciencia.h)} · {competenciaLabel(ciencia.h.competencia ?? competencia)} — o link expira em 30 dias
                e a confirmação é única.
              </p>
              <Input readOnly value={ciencia.url} onFocus={(e) => e.currentTarget.select()} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copiar(ciencia.url, "modal")}>
                  {copiado === "modal" ? <Check className="h-3.5 w-3.5 mr-2" /> : <Copy className="h-3.5 w-3.5 mr-2" />}
                  Copiar link
                </Button>
                {telefoneWa(ciencia.h) ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      window.open(
                        `https://wa.me/${telefoneWa(ciencia.h)}?text=${encodeURIComponent(
                          mensagemCiencia(ciencia.h, competencia, ciencia.url),
                        )}`,
                        "_blank",
                        "noopener",
                      )
                    }
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-2" />Abrir WhatsApp
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground self-center">
                    Sem telefone cadastrado — envie o link copiado.
                  </span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!linksLote} onOpenChange={(o) => !o && setLinksLote(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Links de ciência · {competenciaLabel(competencia)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(linksLote ?? []).map((l, i) => (
              <div key={i} className="flex items-center gap-2 border-b pb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{l.nome}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{l.url}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => copiar(l.url, `lote-${i}`)}>
                  {copiado === `lote-${i}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                {telefoneWa(l.h) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      window.open(
                        `https://wa.me/${telefoneWa(l.h)}?text=${encodeURIComponent(
                          mensagemCiencia(l.h, competencia, l.url),
                        )}`,
                        "_blank",
                        "noopener",
                      )
                    }
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {!linksLote?.length && (
              <p className="text-sm text-muted-foreground">Nenhum link gerado.</p>
            )}
          </div>
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
