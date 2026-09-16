import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { rpcCashback, objetoDe, numero } from "@/lib/cashback";

export function ConfigTab({ resumo, onAtualizar }: { resumo: Record<string, any>; onAtualizar: () => void }) {
  const config = objetoDe(resumo.config);

  const [percentual, setPercentual] = useState("");
  const [validade, setValidade] = useState("");
  const [usoMaximo, setUsoMaximo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmacao, setConfirmacao] = useState(false);
  const [digitado, setDigitado] = useState("");

  useEffect(() => {
    setPercentual(String(config.percentual ?? ""));
    setValidade(String(config.validade_dias ?? ""));
    setUsoMaximo(String(config.uso_max_pct ?? ""));
    setDataInicio(String(config.data_inicio ?? "").slice(0, 10));
  }, [resumo]);

  const gatilhos: string[] = Array.isArray(config.gatilho_status)
    ? config.gatilho_status.map((g: any) => String(g))
    : [];

  function montarPatch() {
    return {
      percentual: numero(percentual),
      validade_dias: Math.round(numero(validade)),
      uso_max_pct: numero(usoMaximo),
      data_inicio: dataInicio || null,
    };
  }

  async function gravar() {
    setSalvando(true);
    try {
      await rpcCashback("cashback_config_salvar", { p_patch: montarPatch() });
      toast.success("Configuração salva.");
      setConfirmacao(false);
      setDigitado("");
      onAtualizar();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function salvar() {
    const original = String(config.data_inicio ?? "").slice(0, 10);
    if (dataInicio && original && dataInicio < original) {
      setConfirmacao(true);
      return;
    }
    gravar();
  }

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardContent className="grid gap-5 p-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Percentual de cashback (%)</Label>
            <Input type="number" step="0.1" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
            <p className="text-xs text-muted-foreground">Percentual do valor pago em produtos, sem frete.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Validade em dias</Label>
            <Input type="number" value={validade} onChange={(e) => setValidade(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Cada cupom vale este prazo. Cupom novo não estende o anterior.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Uso máximo (%)</Label>
            <Input type="number" step="0.1" value={usoMaximo} onChange={(e) => setUsoMaximo(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              O cupom exige pedido de 4x o valor, que é o mesmo que usar até 25%.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Data de início</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            <p className="text-xs text-muted-foreground">Só pedidos a partir desta data geram cashback.</p>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status de gatilho</Label>
            <div className="flex flex-wrap gap-2">
              {gatilhos.length === 0 ? (
                <span className="text-xs text-muted-foreground">Nenhum gatilho configurado.</span>
              ) : (
                gatilhos.map((g) => (
                  <Badge key={g} variant="outline">{g}</Badge>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Pedido em qualquer um destes status gera o cupom.
            </p>
          </div>

          <div className="md:col-span-2">
            <Button onClick={salvar} disabled={salvando}>Salvar configuração</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmacao} onOpenChange={(o) => { setConfirmacao(o); if (!o) setDigitado(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar mudança na data de início</DialogTitle>
            <DialogDescription>
              Isso faz o sistema gerar cupom para pedidos antigos na próxima rodada. Digite CONFIRMO para continuar.
            </DialogDescription>
          </DialogHeader>
          <Input value={digitado} onChange={(e) => setDigitado(e.target.value)} placeholder="CONFIRMO" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmacao(false)}>Cancelar</Button>
            <Button onClick={gravar} disabled={digitado.trim().toUpperCase() !== "CONFIRMO" || salvando}>
              Salvar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
