import { erroRh } from "./useRhAuth";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Printer, RefreshCw, FileText } from "lucide-react";
import { brl, competenciaLabel } from "@/lib/rh";
import { cn } from "@/lib/utils";
import { Holerite, HoleriteRecibo, holeriteNome, normalizarHolerite } from "./HoleriteRecibo";

export type TipoHolerite = "adiantamento" | "fechamento";

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #rh-print-area, #rh-print-area * { visibility: visible !important; }
  #rh-print-area { display: block !important; position: absolute; top: 0; left: 0; width: 100%; padding: 0; }
  .holerite-pagina { page-break-after: always; padding: 8mm; }
  .holerite-pagina:last-child { page-break-after: auto; }
  .holerite-via + .holerite-via { margin-top: 8mm; border-top: 1px dashed #999; padding-top: 8mm; }
  @page { margin: 6mm; size: A4 portrait; }
}
`;

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
  const [aberto, setAberto] = useState<Holerite | null>(null);
  const [imprimir, setImprimir] = useState<Holerite[]>([]);

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

  const disparar = (lista: Holerite[]) => {
    if (!lista.length) return;
    setImprimir(lista);
    setTimeout(() => {
      window.print();
      setTimeout(() => setImprimir([]), 500);
    }, 100);
  };

  return (
    <div className="space-y-6">
      <style>{PRINT_CSS}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex rounded-md border p-1">
          {(["adiantamento", "fechamento"] as TipoHolerite[]).map((t) => (
            <button
              key={t}
              onClick={() => onTipoChange(t)}
              className={cn(
                "px-3 py-1.5 text-sm rounded",
                tipo === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t === "adiantamento" ? "Adiantamento (dia 20)" : "Fechamento (dia 5)"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => disparar(holerites)} disabled={!holerites.length}>
            <Printer className="h-3.5 w-3.5 mr-2" />Imprimir todos
          </Button>
          <Button size="sm" onClick={gerar} disabled={gerando}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-2", gerando && "animate-spin")} />
            Gerar holerites da competência
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
              Nenhum holerite de {tipo} em {competenciaLabel(competencia)}.
            </p>
            <Button onClick={gerar} disabled={gerando}>Gerar holerites da competência</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {holerites.map((h, i) => (
            <Card key={h.id ?? i}>
              <CardContent className="p-4 space-y-2">
                <div>
                  <p className="font-medium">{holeriteNome(h)}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {h.tipo ?? tipo} · {competenciaLabel(h.competencia ?? competencia)}
                  </p>
                </div>
                <p className="text-xl font-serif font-bold tabular-nums">{brl(h.liquido)}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setAberto(h)}>Visualizar</Button>
                  <Button size="sm" variant="ghost" onClick={() => disparar([h])}>
                    <Printer className="h-3.5 w-3.5" />
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
              <div className="flex justify-end">
                <Button size="sm" onClick={() => disparar([aberto])}>
                  <Printer className="h-3.5 w-3.5 mr-2" />Imprimir
                </Button>
              </div>
              <HoleriteRecibo h={aberto} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div id="rh-print-area" className="hidden">
        {imprimir.map((h, i) => (
          <div className="holerite-pagina" key={h.id ?? i}>
            <div className="holerite-via"><HoleriteRecibo h={h} via="1ª via - Empresa" /></div>
            <div className="holerite-via"><HoleriteRecibo h={h} via="2ª via - Funcionário" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
