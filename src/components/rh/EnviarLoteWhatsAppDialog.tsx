import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Check, Clock, Loader2, MessageCircle, X } from "lucide-react";
import {
  chamarWhatsapp,
  ehAviso,
  FilaItem,
  ItemEnvio,
  ITEM_CURTO,
  ITEM_LABEL,
  RespostaEnvio,
  ResultadoEnvio,
  telefoneBonito,
} from "@/lib/rhWhatsapp";
import { AvisoEvolution } from "./AvisoEvolution";

const LOTE_MAX = 40;
const SEGUNDOS_POR_PESSOA = 8;

type Linha = {
  f: FilaItem;
  itens: ItemEnvio[];
  motivo?: string;
};

export function EnviarLoteWhatsAppDialog({
  open,
  onOpenChange,
  fila,
  onEnviado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fila: FilaItem[];
  onEnviado?: () => void;
}) {
  const { toast } = useToast();
  const [selecionados, setSelecionados] = useState<ItemEnvio[]>(["holerite", "comprovante", "ciencia"]);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState<ResultadoEnvio[] | null>(null);
  const [tempoInicio, setTempoInicio] = useState<number | null>(null);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);

  useEffect(() => {
    if (!open) return;
    setResultados(null);
    setProgresso(0);
    setTempoInicio(null);
    setTempoDecorrido(0);
  }, [open]);

  useEffect(() => {
    if (!enviando) return;
    const inicio = Date.now();
    setTempoInicio(inicio);
    const id = setInterval(() => setTempoDecorrido(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(id);
  }, [enviando]);

  const linhas: Linha[] = useMemo(
    () =>
      fila.map((f) => {
        if (!f.tem_numero || !f.whatsapp) return { f, itens: [], motivo: "sem número de WhatsApp" };
        const itens: ItemEnvio[] = [];
        const fora: string[] = [];
        if (selecionados.includes("holerite")) {
          if ((f.holerite_enviado ?? 0) > 0) fora.push("holerite já enviado");
          else itens.push("holerite");
        }
        if (selecionados.includes("comprovante")) {
          if (!f.pagamento_id) fora.push("sem comprovante");
          else if ((f.comprovante_enviado ?? 0) > 0) fora.push("comprovante já enviado");
          else itens.push("comprovante");
        }
        if (selecionados.includes("ciencia")) {
          if (f.ciente) fora.push("já assinou");
          else if ((f.ciencia_enviada ?? 0) > 0) fora.push("link já enviado");
          else itens.push("ciencia");
        }
        return { f, itens, motivo: itens.length ? undefined : fora.join(" · ") || "nada a enviar" };
      }),
    [fila, selecionados],
  );

  const aEnviar = linhas.filter((l) => l.itens.length);
  const deFora = linhas.filter((l) => !l.itens.length);

  const tempoEstimadoSegundos = useMemo(
    () => Math.max(1, aEnviar.length * SEGUNDOS_POR_PESSOA),
    [aEnviar.length],
  );

  const formatarTempo = (segundos: number) => {
    if (segundos < 60) return `${segundos}s`;
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return s > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${m} min`;
  };

  const estimativaTexto = useMemo(() => {
    const s = tempoEstimadoSegundos;
    if (s < 60) return `cerca de ${s} segundos`;
    const min = Math.ceil(s / 60);
    return min === 1 ? "cerca de 1 minuto" : `cerca de ${min} minutos`;
  }, [tempoEstimadoSegundos]);

  const alternar = (item: ItemEnvio) =>
    setSelecionados((s) => (s.includes(item) ? s.filter((i) => i !== item) : [...s, item]));

  const enviar = async () => {
    setEnviando(true);
    setResultados(null);
    setProgresso(0);
    setTempoInicio(Date.now());
    setTempoDecorrido(0);

    // agrupa por combinação de itens (a API aceita uma lista de itens por chamada)
    const grupos = new Map<string, Linha[]>();
    for (const l of aEnviar) {
      const chave = [...l.itens].sort().join(",");
      grupos.set(chave, [...(grupos.get(chave) ?? []), l]);
    }

    const acumulado: ResultadoEnvio[] = [];
    let feitos = 0;
    let falhou: string | null = null;

    for (const [chave, grupo] of grupos) {
      const itens = chave.split(",") as ItemEnvio[];
      for (let i = 0; i < grupo.length; i += LOTE_MAX) {
        const fatia = grupo.slice(i, i + LOTE_MAX);
        const { data, erro } = await chamarWhatsapp<RespostaEnvio>({
          acao: "enviar_lote",
          holerite_ids: fatia.map((l) => l.f.holerite_id),
          itens,
        });
        if (erro) {
          falhou = erro;
          break;
        }
        acumulado.push(...(data?.resultados ?? []));
        feitos += fatia.length;
        setProgresso(Math.round((feitos / aEnviar.length) * 100));
        setResultados([...acumulado]);
      }
      if (falhou) break;
    }

    setEnviando(false);
    if (falhou) {
      toast({ title: "Envio interrompido", description: falhou, variant: "destructive" });
    } else {
      const ok = acumulado.filter((r) => r.ok).length;
      toast({ title: `Envio concluído`, description: `${ok} de ${aEnviar.length} funcionárias receberam.` });
    }
    onEnviado?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!enviando ? onOpenChange(v) : null)}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Enviar tudo no WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {(["holerite", "comprovante", "ciencia"] as ItemEnvio[]).map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selecionados.includes(item)}
                  disabled={enviando}
                  onCheckedChange={() => alternar(item)}
                />
                {ITEM_LABEL[item]}
              </label>
            ))}
          </div>

          <AvisoEvolution />

          <div className="rounded-md border divide-y">
            {linhas.map((l) => {
              const res = resultados?.find((r) => r.holerite_id === l.f.holerite_id);
              return (
                <div
                  key={l.f.holerite_id}
                  className={`flex items-start justify-between gap-3 p-2.5 text-sm ${
                    l.itens.length ? "" : "opacity-50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{l.f.nome}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {telefoneBonito(l.f.whatsapp)}
                    </p>
                    {res && (
                      <div className="mt-1 space-y-0.5">
                        {res.resultados?.map((r, i) => (
                          <p
                            key={i}
                            className={`text-[11px] ${
                              r.ok ? "text-green-700" : ehAviso(r) ? "text-amber-700" : "text-red-600"
                            }`}
                          >
                            {r.ok ? "✓" : ehAviso(r) ? "!" : "✕"} {ITEM_CURTO[r.item] ?? r.item}
                            {!r.ok && r.erro ? ` — ${r.erro}` : ""}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs shrink-0">
                    {l.itens.length ? (
                      <span className="text-muted-foreground">
                        {l.itens.map((i) => ITEM_CURTO[i]).join(" + ")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{l.motivo}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {!linhas.length && (
              <p className="p-3 text-sm text-muted-foreground">Nenhum holerite nesta competência.</p>
            )}
          </div>

          {aEnviar.length > 0 && !enviando && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
              <Clock className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Isso leva {estimativaTexto} para {aEnviar.length} pessoa
                {aEnviar.length > 1 ? "s" : ""}. As mensagens saem uma a uma com pausa entre elas — mantenha esta
                janela aberta.
              </p>
            </div>
          )}

          {enviando && (
            <div className="space-y-1.5">
              <Progress value={progresso} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Enviando com intervalo entre as mensagens
                </span>
                <span className="tabular-nums">
                  {formatarTempo(tempoDecorrido)} / {formatarTempo(tempoEstimadoSegundos)}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {aEnviar.length} vão receber · {deFora.length} de fora
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
                Fechar
              </Button>
              <Button onClick={enviar} disabled={enviando || !aEnviar.length}>
                {enviando ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <MessageCircle className="h-3.5 w-3.5 mr-2" />
                )}
                {enviando ? "Enviando..." : `Enviar para ${aEnviar.length}`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
