import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Check, Loader2, MessageCircle, X } from "lucide-react";
import { dataBRCompleta } from "@/lib/rh";
import {
  chamarWhatsapp,
  ehAviso,
  ItemEnvio,
  ITEM_LABEL,
  mascaraTelefone,
  RespostaEnvio,
  ResultadoItem,
  telefoneBonito,
  telefoneValido,
} from "@/lib/rhWhatsapp";
import { AvisoEvolution } from "./AvisoEvolution";

export function EnviarWhatsAppDialog({
  open,
  onOpenChange,
  holeriteId,
  funcionarioId,
  nome,
  whatsapp,
  ciente,
  cienciaEm,
  pagamentoId,
  onEnviado,
  onIrParaCadastro,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  holeriteId: string;
  funcionarioId?: string | null;
  nome: string;
  whatsapp?: string | null;
  ciente?: boolean | null;
  cienciaEm?: string | null;
  pagamentoId?: string | null;
  onEnviado?: () => void;
  onIrParaCadastro?: () => void;
}) {
  const { toast } = useToast();
  const [itens, setItens] = useState<ItemEnvio[]>([]);
  const [numeroTeste, setNumeroTeste] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoItem[] | null>(null);

  const { data: destinatario } = useQuery({
    queryKey: ["rh-wa-destinatario", funcionarioId],
    enabled: open && !!funcionarioId && !whatsapp,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_whatsapp_destinatario" as any, {
        p_funcionario_id: funcionarioId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as any;
    },
  });

  const numero = whatsapp ?? destinatario?.numero ?? destinatario?.whatsapp ?? null;
  const temNumero = !!numero;
  const podeComprovante = !!pagamentoId;
  const podeCiencia = !ciente;

  useEffect(() => {
    if (!open) return;
    setResultado(null);
    setNumeroTeste("");
    const iniciais: ItemEnvio[] = ["holerite"];
    if (podeComprovante) iniciais.push("comprovante");
    if (podeCiencia) iniciais.push("ciencia");
    setItens(iniciais);
  }, [open, podeComprovante, podeCiencia]);

  const alternar = (item: ItemEnvio) =>
    setItens((s) => (s.includes(item) ? s.filter((i) => i !== item) : [...s, item]));

  const testeInvalido = numeroTeste.trim().length > 0 && !telefoneValido(numeroTeste);
  const destinoFinal = numeroTeste.trim() ? mascaraTelefone(numeroTeste) : telefoneBonito(numero);

  const enviar = async () => {
    setEnviando(true);
    setResultado(null);
    const { data, erro } = await chamarWhatsapp<RespostaEnvio>({
      acao: "enviar",
      holerite_id: holeriteId,
      itens,
      ...(numeroTeste.trim() ? { numero_teste: numeroTeste.replace(/\D/g, "") } : {}),
    });
    setEnviando(false);
    if (erro) {
      toast({ title: "Envio não concluído", description: erro, variant: "destructive" });
      return;
    }
    const r = data?.resultados?.[0];
    setResultado(r?.resultados ?? []);
    const okCount = (r?.resultados ?? []).filter((x) => x.ok).length;
    toast({
      title: okCount ? `Enviado no WhatsApp (${okCount} item${okCount > 1 ? "ns" : ""})` : "Nada foi enviado",
      description: data?.teste ? "Envio de teste — foi para o número informado." : undefined,
    });
    onEnviado?.();
  };

  const cienciaEmBR = useMemo(() => dataBRCompleta(cienciaEm), [cienciaEm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">Enviar no WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3">
            <p className="font-medium">{nome}</p>
            {temNumero ? (
              <p className="text-sm text-muted-foreground tabular-nums">{telefoneBonito(numero)}</p>
            ) : (
              <div className="mt-1 flex items-start gap-2 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p>Sem número de WhatsApp cadastrado.</p>
                  {onIrParaCadastro && (
                    <button type="button" className="underline" onClick={onIrParaCadastro}>
                      abrir o cadastro dela
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Opcao
              item="holerite"
              marcado={itens.includes("holerite")}
              onChange={() => alternar("holerite")}
            />
            <Opcao
              item="comprovante"
              marcado={itens.includes("comprovante")}
              desabilitado={!podeComprovante}
              titulo="pagamento não passou pelo lote do Inter, não há comprovante"
              onChange={() => alternar("comprovante")}
            />
            <Opcao
              item="ciencia"
              marcado={itens.includes("ciencia")}
              desabilitado={!podeCiencia}
              titulo={`já assinou em ${cienciaEmBR}`}
              onChange={() => alternar("ciencia")}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Mandar para outro número (teste)</Label>
            <Input
              value={numeroTeste}
              onChange={(e) => setNumeroTeste(mascaraTelefone(e.target.value))}
              placeholder="(11) 99999-9999"
            />
            <p className="text-[10px] text-muted-foreground">
              opcional — tudo vai para esse número em vez do número da funcionária, e o envio fica registrado como teste
            </p>
          </div>

          <AvisoEvolution />

          {resultado && (
            <div className="space-y-1.5 rounded-md border p-3">
              {resultado.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {r.ok ? (
                    <Check className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                  ) : ehAviso(r) ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium">{ITEM_LABEL[r.item] ?? r.item}</span>
                    {r.arquivo && <span className="text-muted-foreground"> · {r.arquivo}</span>}
                    {!r.ok && (
                      <p className={ehAviso(r) ? "text-amber-700" : "text-red-600"}>{r.erro}</p>
                    )}
                  </div>
                </div>
              ))}
              {!resultado.length && <p className="text-xs text-muted-foreground">Nenhum item enviado.</p>}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              onClick={enviar}
              disabled={enviando || !itens.length || testeInvalido || (!temNumero && !numeroTeste.trim())}
            >
              {enviando ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <MessageCircle className="h-3.5 w-3.5 mr-2" />
              )}
              {enviando ? "Enviando..." : "Enviar"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-right">
            Destino: <span className="tabular-nums">{destinoFinal}</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Opcao({
  item,
  marcado,
  desabilitado,
  titulo,
  onChange,
}: {
  item: ItemEnvio;
  marcado: boolean;
  desabilitado?: boolean;
  titulo?: string;
  onChange: () => void;
}) {
  return (
    <label
      title={desabilitado ? titulo : undefined}
      className={`flex items-center gap-2 text-sm ${desabilitado ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <Checkbox checked={marcado && !desabilitado} disabled={desabilitado} onCheckedChange={onChange} />
      <span>{ITEM_LABEL[item]}</span>
      {desabilitado && titulo && <span className="text-[10px] text-muted-foreground">— {titulo}</span>}
    </label>
  );
}
