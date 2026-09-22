import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Archive, Copy, Pencil, Plus, Radio, Unlink, X } from "lucide-react";
import { ConstrutorFluxo } from "./ConstrutorFluxo";
import {
  arquivarFluxo, definirFluxoDaLive, desvincularFluxoDaLive, duplicarFluxo, listarFluxos,
  listarFluxosDaLive, vincularFluxoNaLive,
  type FluxoResumo, type FluxosDaLive,
} from "@/lib/igDmFluxos";
import { dataHoraLonga } from "@/lib/kitsLive";

export function FluxosTab({ onMudou }: { onMudou?: () => void }) {
  const [fluxos, setFluxos] = useState<FluxoResumo[] | null>(null);
  const [naLive, setNaLive] = useState<FluxosDaLive | null>(null);
  const [aberto, setAberto] = useState<{ id: number | null } | null>(null);
  const [arquivar, setArquivar] = useState<FluxoResumo | null>(null);
  const [vincular, setVincular] = useState<FluxoResumo | null>(null);
  const [palavrasTexto, setPalavrasTexto] = useState("");
  const [prioridade, setPrioridade] = useState("100");
  const [salvandoVinculo, setSalvandoVinculo] = useState(false);
  const [removendoId, setRemovendoId] = useState<number | null>(null);

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
    try {
      setNaLive(await listarFluxosDaLive());
    } catch {
      setNaLive(null);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const aposMudanca = () => {
    recarregar();
    onMudou?.();
  };

  /** Papel de cada fluxo na live atual: principal ou extra ativo (com palavras). */
  const papelNaLive = useMemo(() => {
    const mapa = new Map<number, { tipo: "principal" } | { tipo: "extra"; palavras: string[] }>();
    if (!naLive) return mapa;
    if (naLive.principal?.fluxo_id != null) {
      mapa.set(naLive.principal.fluxo_id, { tipo: "principal" });
    }
    for (const e of naLive.extras ?? []) {
      if (e.fluxo_id != null && e.ativo) {
        mapa.set(e.fluxo_id, { tipo: "extra", palavras: e.palavras ?? [] });
      }
    }
    return mapa;
  }, [naLive]);

  const extrasAtivos = useMemo(
    () => (naLive?.extras ?? []).filter((e) => e.ativo && e.fluxo_id != null),
    [naLive],
  );

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
      toast.success("Fluxo definido como principal desta live.");
      aposMudanca();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível escolher o fluxo.");
    }
  };

  const abrirVinculo = (f: FluxoResumo) => {
    setVincular(f);
    setPalavrasTexto("");
    setPrioridade("100");
  };

  const confirmarVinculo = async () => {
    if (!vincular) return;
    const palavras = palavrasTexto
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (palavras.length === 0) {
      toast.error("Informe ao menos uma palavra, separada por vírgula.");
      return;
    }
    const prio = Number.parseInt(prioridade, 10);
    setSalvandoVinculo(true);
    try {
      const r = await vincularFluxoNaLive({
        p_fluxo_id: vincular.id,
        p_palavras: palavras,
        p_prioridade: Number.isFinite(prio) ? prio : 100,
      });
      if (r?.ok === false) {
        toast.error(r.motivo || r.erro || "Não foi possível adicionar o fluxo à live.");
        return;
      }
      toast.success(`"${vincular.nome}" adicionado à live por palavra.`);
      setVincular(null);
      aposMudanca();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível adicionar o fluxo à live.");
    } finally {
      setSalvandoVinculo(false);
    }
  };

  const tirarDaLive = async (fluxoId: number) => {
    setRemovendoId(fluxoId);
    try {
      const r = await desvincularFluxoDaLive(fluxoId);
      if (r?.ok === false) {
        toast.error(r.motivo || r.erro || "Não foi possível tirar o fluxo da live.");
        return;
      }
      toast.success("Fluxo removido da live.");
      aposMudanca();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível tirar o fluxo da live.");
    } finally {
      setRemovendoId(null);
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

  const palavrasChips = palavrasTexto
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Modelos reutilizáveis de conversa no Direct. Cada live escolhe um principal e pode ter
          outros ativados por palavra.
        </p>
        <Button size="sm" className="h-8 shrink-0" onClick={() => setAberto({ id: null })}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Novo fluxo
        </Button>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 text-sm">
          <span className="font-medium">Automações na live: </span>
          {naLive?.principal ? (
            <>
              principal <span className="font-semibold">{naLive.principal.nome ?? "-"}</span>
              {extrasAtivos.length > 0 && (
                <span> + {extrasAtivos.length} por palavra</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">
              {extrasAtivos.length > 0
                ? `${extrasAtivos.length} por palavra, sem fluxo principal`
                : "nenhum fluxo escolhido (texto fixo)"}
            </span>
          )}
        </CardContent>
      </Card>

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
          {fluxos.map((f) => {
            const papel = papelNaLive.get(f.id) ?? (f.na_live_atual ? { tipo: "principal" as const } : undefined);
            return (
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
                    {papel?.tipo === "principal" && (
                      <Badge className="gap-1 border-success/30 bg-success/10 text-success" variant="outline">
                        <Radio className="h-3 w-3" /> Na live atual · principal
                      </Badge>
                    )}
                    {papel?.tipo === "extra" && (
                      <Badge className="gap-1 border-success/30 bg-success/10 text-success" variant="outline">
                        <Radio className="h-3 w-3" /> Na live atual · palavras:{" "}
                        {papel.palavras.length ? papel.palavras.join(", ") : "-"}
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
                      Usar como principal
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => abrirVinculo(f)}>
                      Adicionar à live por palavra
                    </Button>
                    {papel?.tipo === "extra" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive"
                        disabled={removendoId === f.id}
                        onClick={() => tirarDaLive(f.id)}
                      >
                        <Unlink className="mr-1 h-3 w-3" /> Tirar da live
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setArquivar(f)}>
                      <Archive className="mr-1 h-3 w-3" /> Arquivar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!vincular} onOpenChange={(v) => !v && setVincular(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar "{vincular?.nome}" à live por palavra</DialogTitle>
            <DialogDescription>
              Quando a cliente escrever uma dessas palavras no Direct, este fluxo assume a
              conversa, mesmo com outro fluxo principal na live.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="palavras-fluxo">Palavras (separadas por vírgula)</Label>
              <Input
                id="palavras-fluxo"
                placeholder="ex.: trocar, segunda via, boleto"
                value={palavrasTexto}
                onChange={(e) => setPalavrasTexto(e.target.value)}
                autoFocus
              />
              {palavrasChips.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {palavrasChips.map((p, i) => (
                    <Badge key={`${p}-${i}`} variant="secondary" className="gap-1">
                      {p}
                      <button
                        type="button"
                        aria-label={`Remover ${p}`}
                        className="ml-0.5 rounded-full hover:text-destructive"
                        onClick={() =>
                          setPalavrasTexto(palavrasChips.filter((_, j) => j !== i).join(", "))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prioridade-fluxo">Prioridade</Label>
              <Input
                id="prioridade-fluxo"
                type="number"
                min={0}
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value)}
                className="w-28"
              />
              <p className="text-xs text-muted-foreground">
                Padrão 100. Quando duas palavras batem na mesma mensagem, ganha a do fluxo com o
                menor número.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVincular(null)} disabled={salvandoVinculo}>
              Cancelar
            </Button>
            <Button onClick={confirmarVinculo} disabled={salvandoVinculo}>
              {salvandoVinculo ? "Salvando..." : "Adicionar à live"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
