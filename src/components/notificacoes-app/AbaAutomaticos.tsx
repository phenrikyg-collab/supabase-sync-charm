import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  pushApi, ROTULO_SITUACAO, TEXTO_AUTOMATICO,
  type ResumoPush, type SituacaoRastreio,
} from "./api";

const SITUACOES: SituacaoRastreio[] = [
  "em_transito",
  "saiu_para_entrega",
  "entregue",
  "aguardando_retirada",
  "tentativa_falhou",
];

export function AbaAutomaticos({ resumo }: { resumo: ResumoPush | undefined }) {
  const qc = useQueryClient();
  const [ligado, setLigado] = useState(false);
  const [situacoes, setSituacoes] = useState<SituacaoRastreio[]>([]);

  useEffect(() => {
    if (!resumo) return;
    setLigado(resumo.auto_logistica);
    setSituacoes(resumo.auto_situacoes ?? []);
  }, [resumo]);

  const salvar = useMutation({
    mutationFn: () => pushApi.salvarConfig({ auto_logistica: ligado, auto_situacoes: situacoes }),
    onSuccess: (novo) => {
      qc.setQueryData(["app-push-resumo"], novo);
      qc.invalidateQueries({ queryKey: ["app-push-resumo"] });
      toast.success("Avisos automáticos salvos");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div>
            <Label className="text-base">Avisar o andamento do pedido</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando ligado, o sistema manda sozinho o aviso para a cliente que tem os avisos ativos e o CPF salvo,
              sempre que o rastreio muda de situação.
            </p>
          </div>
          <Switch checked={ligado} onCheckedChange={setLigado} />
        </div>

        <div className="space-y-3">
          {SITUACOES.map((s) => (
            <div key={s} className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                className="mt-1"
                checked={situacoes.includes(s)}
                disabled={!ligado}
                onCheckedChange={() =>
                  setSituacoes((atual) =>
                    atual.includes(s) ? atual.filter((x) => x !== s) : [...atual, s],
                  )
                }
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{ROTULO_SITUACAO[s]}</p>
                <p className="text-sm">{TEXTO_AUTOMATICO[s].titulo}</p>
                <p className="text-sm text-muted-foreground">{TEXTO_AUTOMATICO[s].corpo}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          O aviso no celular é gratuito e complementa o WhatsApp. Não substitui.
        </p>

        <p className="text-xs text-muted-foreground">
          No iPhone, o aviso mostra a linha "from Minha MC" embaixo do título. Isso é do próprio
          iPhone e não dá para mudar.
        </p>


        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
