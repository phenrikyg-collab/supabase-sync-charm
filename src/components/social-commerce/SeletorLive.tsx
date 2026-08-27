import { useMemo, useState } from "react";
import { db } from "@/lib/socialCommerce";
import { brl } from "@/lib/financeiroFormat";
import { toast } from "sonner";
import {
  Kit, Live, dataHoraLonga, encerrarLive, renomearLive, tituloPadraoLive,
} from "@/lib/kitsLive";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle, Download, Loader2, MessageSquare, Package, Pencil, Radio,
  ShoppingCart, Users, Zap,
} from "lucide-react";

function csvCampo(v: any): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function baixarCsv(nome: string, linhas: string[][]) {
  const conteudo = "\uFEFF" + linhas.map((l) => l.map(csvCampo).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function minutosDesde(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

function Contador({ icone: Icone, label, valor }: { icone: any; label: string; valor: string | number }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icone className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold">{valor}</p>
    </div>
  );
}

export function SeletorLive({
  lives,
  selecionada,
  onSelecionar,
  kits,
  ultimoComentarioEm,
  onAtualizar,
}: {
  lives: Live[];
  selecionada: Live | null;
  onSelecionar: (mediaId: string) => void;
  kits: Kit[];
  ultimoComentarioEm?: string | null;
  onAtualizar: () => void;
}) {
  const [abrirEncerrar, setAbrirEncerrar] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [encerrando, setEncerrando] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [exportando, setExportando] = useState(false);

  const aoVivo = useMemo(() => lives.find((l) => l.status === "ao_vivo") ?? null, [lives]);
  const estaAoVivo = !!selecionada && selecionada.status === "ao_vivo";

  const nomesKits = useMemo(() => {
    const m = new Map<string, string>();
    kits.forEach((k) => k.id != null && m.set(String(k.id), k.nome));
    return m;
  }, [kits]);

  const minSemComentario = minutosDesde(ultimoComentarioEm ?? selecionada?.inicio);
  const pareceAcabou = estaAoVivo && minSemComentario != null && minSemComentario >= 45;

  const rotulo = (l: Live) =>
    `${l.titulo || tituloPadraoLive(l.inicio)} · ${dataHoraLonga(l.inicio)}`;

  const abrirModalEncerrar = () => {
    setTitulo(selecionada?.titulo || tituloPadraoLive(selecionada?.inicio));
    setObservacoes(selecionada?.observacoes ?? "");
    setConfirmado(false);
    setAbrirEncerrar(true);
  };

  const confirmarEncerrar = async () => {
    if (!selecionada) return;
    setEncerrando(true);
    try {
      if (observacoes.trim()) {
        await db
          .from("instagram_lives")
          .update({ observacoes: observacoes.trim() })
          .eq("media_id", selecionada.media_id);
      }
      await encerrarLive(selecionada.media_id, titulo.trim() || tituloPadraoLive(selecionada.inicio));
      toast.success("Live encerrada e arquivada.");
      setAbrirEncerrar(false);
      onAtualizar();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível encerrar a live.");
    } finally {
      setEncerrando(false);
    }
  };

  const confirmarRenomear = async () => {
    if (!selecionada || !novoTitulo.trim()) return;
    try {
      await renomearLive(selecionada.media_id, novoTitulo.trim());
      toast.success("Título atualizado.");
      setRenomeando(false);
      onAtualizar();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível renomear.");
    }
  };

  const exportarCsv = async () => {
    if (!selecionada) return;
    setExportando(true);
    try {
      const { data, error } = await db
        .from("vw_comentarios_live")
        .select("*")
        .eq("media_id", selecionada.media_id)
        .order("publicado_em", { ascending: true })
        .limit(5000);
      if (error) throw error;
      const linhas: string[][] = [["hora", "usuario", "texto", "kit", "resposta", "status"]];
      (data ?? []).forEach((c: any) => {
        linhas.push([
          dataHoraLonga(c.publicado_em),
          `@${c.from_username ?? ""}`,
          c.texto ?? "",
          c.kit_id != null ? (nomesKits.get(String(c.kit_id)) ?? String(c.kit_id)) : "",
          c.resposta_texto ?? "",
          c.status ?? "",
        ]);
      });
      const nome = (selecionada.titulo || tituloPadraoLive(selecionada.inicio))
        .replace(/[^\w\d]+/g, "_")
        .replace(/^_|_$/g, "");
      baixarCsv(`${nome}.csv`, linhas);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível exportar.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* seletor */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selecionada?.media_id ?? ""} onValueChange={onSelecionar}>
          <SelectTrigger className="w-full sm:w-[420px]">
            <SelectValue placeholder="Escolha uma live" />
          </SelectTrigger>
          <SelectContent>
            {aoVivo && (
              <SelectItem value={aoVivo.media_id}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                  Live atual · {dataHoraLonga(aoVivo.inicio)}
                </span>
              </SelectItem>
            )}
            {lives
              .filter((l) => l.media_id !== aoVivo?.media_id)
              .map((l) => (
                <SelectItem key={l.media_id} value={l.media_id}>
                  {rotulo(l)}
                </SelectItem>
              ))}
            {lives.length === 0 && (
              <SelectItem value="__vazio" disabled>
                Nenhuma live registrada ainda
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        {estaAoVivo ? (
          <Badge className="gap-1.5 border-success/30 bg-success/10 text-success" variant="outline">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> AO VIVO
          </Badge>
        ) : selecionada ? (
          <Badge variant="outline">Encerrada</Badge>
        ) : null}

        {selecionada && !estaAoVivo && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Renomear live"
            onClick={() => {
              setNovoTitulo(selecionada.titulo || tituloPadraoLive(selecionada.inicio));
              setRenomeando(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}

        {estaAoVivo && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={abrirModalEncerrar}>
            <Radio className="h-3.5 w-3.5" /> Encerrar e arquivar
          </Button>
        )}
      </div>

      {pareceAcabou && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="flex-1">Parece que a live acabou. Encerrar e arquivar?</span>
          <Button size="sm" variant="outline" onClick={abrirModalEncerrar}>
            Encerrar e arquivar
          </Button>
        </div>
      )}

      {/* resumo */}
      {selecionada && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <h3 className="text-base font-semibold">
                {selecionada.titulo || tituloPadraoLive(selecionada.inicio)}
              </h3>
              <span className="text-xs text-muted-foreground">
                início {dataHoraLonga(selecionada.inicio)}
              </span>
              <span className="text-xs text-muted-foreground">
                {selecionada.fim
                  ? `fim ${dataHoraLonga(selecionada.fim)}`
                  : minutosDesde(selecionada.inicio) != null
                    ? `ao vivo há ${minutosDesde(selecionada.inicio)} min`
                    : "ao vivo"}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto gap-1.5"
                onClick={exportarCsv}
                disabled={exportando}
              >
                {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Exportar CSV
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Contador icone={MessageSquare} label="comentários" valor={selecionada.comentarios ?? 0} />
              <Contador icone={Zap} label="quer comprar" valor={selecionada.quer_comprar ?? 0} />
              <Contador icone={Users} label="Directs" valor={selecionada.directs ?? 0} />
              <Contador icone={ShoppingCart} label="carrinhos" valor={selecionada.carrinhos ?? 0} />
              <Contador icone={Package} label="R$ em carrinhos" valor={brl(Number(selecionada.valor_carrinhos ?? 0))} />
            </div>

            {selecionada.observacoes && (
              <p className="text-[11px] text-muted-foreground">{selecionada.observacoes}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* modal encerrar */}
      <Dialog open={abrirEncerrar} onOpenChange={setAbrirEncerrar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar e arquivar a live</DialogTitle>
            <DialogDescription>
              Depois de encerrada, não dá mais para responder comentários desta live.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título da live</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="O que funcionou, o que repetir na próxima…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setAbrirEncerrar(false)}>
              Cancelar
            </Button>
            {confirmado ? (
              <Button onClick={confirmarEncerrar} disabled={encerrando} className="gap-1.5">
                {encerrando && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar encerramento
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => setConfirmado(true)}>
                Encerrar live
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* modal renomear */}
      <Dialog open={renomeando} onOpenChange={setRenomeando}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear live</DialogTitle>
          </DialogHeader>
          <Input value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenomeando(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarRenomear} disabled={!novoTitulo.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
