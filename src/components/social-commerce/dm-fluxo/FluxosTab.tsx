import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, Copy, Pencil, Plus, Radio } from "lucide-react";
import { ConstrutorFluxo } from "./ConstrutorFluxo";
import {
  arquivarFluxo, definirFluxoDaLive, duplicarFluxo, listarFluxos, type FluxoResumo,
} from "@/lib/igDmFluxos";
import { dataHoraLonga } from "@/lib/kitsLive";

export function FluxosTab({ onMudou }: { onMudou?: () => void }) {
  const [fluxos, setFluxos] = useState<FluxoResumo[] | null>(null);
  const [aberto, setAberto] = useState<{ id: number | null } | null>(null);
  const [arquivar, setArquivar] = useState<FluxoResumo | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const l = await listarFluxos();
      setFluxos(
        [...l].sort(
          (a, b) => Number(!!b.modelo) - Number(!!a.modelo) || a.nome.localeCompare(b.nome),
        ),
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível carregar os fluxos.");
      setFluxos([]);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const aposMudanca = () => {
    recarregar();
    onMudou?.();
  };

  const duplicar = async (f: FluxoResumo, paraLive: boolean) => {
    try {
      await duplicarFluxo(f.id, paraLive);
      toast.success(paraLive ? "Cópia criada e escolhida para esta live." : "Cópia criada.");
      aposMudanca();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível duplicar.");
    }
  };

  const usarNaLive = async (f: FluxoResumo) => {
    try {
      const r = await definirFluxoDaLive(f.id);
      if (r?.ok === false) {
        toast.error(r.erro || r.motivo || "O fluxo ainda tem erros.", {
          description: (r.validacao?.erros ?? []).join(" · ") || undefined,
        });
        return;
      }
      toast.success("Fluxo escolhido para esta live.");
      aposMudanca();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível escolher o fluxo.");
    }
  };

  const confirmarArquivar = async () => {
    if (!arquivar) return;
    try {
      await arquivarFluxo(arquivar.id);
      toast.success("Fluxo arquivado.");
      setArquivar(null);
      aposMudanca();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível arquivar.");
    }
  };

  if (aberto) {
    return (
      <ConstrutorFluxo
        fluxoId={aberto.id}
        onVoltar={() => {
          setAberto(null);
          recarregar();
        }}
        onMudou={aposMudanca}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Modelos reutilizáveis de conversa no Direct. Cada live escolhe um e pode ajustar a cópia
          dela.
        </p>
        <Button size="sm" className="h-8" onClick={() => setAberto({ id: null })}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Novo fluxo
        </Button>
      </div>

      {fluxos === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : fluxos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum fluxo criado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fluxos.map((f) => (
            <Card key={f.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{f.nome}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {f.descricao || "-"}
                    </p>
                  </div>
                  {f.modelo && <Badge variant="outline">Modelo</Badge>}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={f.status === "pronto" ? "default" : "outline"}>
                    {f.status === "pronto" ? "Pronto" : "Rascunho"}
                  </Badge>
                  {f.na_live_atual && (
                    <Badge className="gap-1 border-success/30 bg-success/10 text-success" variant="outline">
                      <Radio className="h-3 w-3" /> Na live atual
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="font-semibold">{f.passos ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">passos</p>
                  </div>
                  <div>
                    <p className="font-semibold">{f.conversas ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">conversas</p>
                  </div>
                  <div>
                    <p className="font-semibold">{f.emails ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">e-mails</p>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  atualizado em {dataHoraLonga(f.atualizado_em)}
                </p>

                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAberto({ id: f.id })}>
                    <Pencil className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => duplicar(f, false)}>
                    <Copy className="mr-1 h-3 w-3" /> Duplicar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => duplicar(f, true)}>
                    Duplicar para esta live
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => usarNaLive(f)}>
                    Usar nesta live
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setArquivar(f)}>
                    <Archive className="mr-1 h-3 w-3" /> Arquivar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!arquivar} onOpenChange={(v) => !v && setArquivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar o fluxo "{arquivar?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele sai da lista de fluxos disponíveis para as próximas lives. O histórico das
              conversas continua guardado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarArquivar}>Arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
