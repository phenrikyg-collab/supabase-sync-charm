import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, Copy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  formatarData,
  funcaoTroca,
  mensagemBackend,
  moeda,
  texto,
  traco,
  vincularPedidoNovo,
} from "@/lib/reversaPainel";

type Previa = { tipo: "cupom" | "bling"; dados: Record<string, any> };

function BotaoCopiar({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2"
      onClick={() => {
        navigator.clipboard.writeText(valor);
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 1500);
      }}
    >
      {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export function AcoesTroca({
  s,
  aoMudar,
  semBling = false,
}: {
  s: Record<string, any>;
  semBling?: boolean;
  aoMudar: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [ocupado, setOcupado] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [avisoCupom, setAvisoCupom] = useState("");
  const [avisoBling, setAvisoBling] = useState("");
  const [pedidoTray, setPedidoTray] = useState("");
  const [credito, setCredito] = useState("");

  const temCupom = Boolean(s.credito_cupom_codigo);
  const temPedidoNovo = Boolean(s.pedido_novo_origem);
  const blingBloqueado = Boolean(avisoBling);

  async function simular(tipo: "cupom" | "bling") {
    setOcupado(tipo);
    if (tipo === "cupom") setAvisoCupom("");
    else setAvisoBling("");
    try {
      const nome = tipo === "cupom" ? "reversa-troca-cupom" : "reversa-troca-bling";
      const { status, dados } = await funcaoTroca(nome, { acao: "simular", solicitacao_id: s.id });
      const msg = mensagemBackend(dados, "Não deu certo");
      if (status === 409) {
        if (tipo === "cupom") setAvisoCupom(msg);
        else setAvisoBling(msg);
        return;
      }
      if (status >= 400) {
        toast({ title: "Não deu certo", description: msg, variant: "destructive" });
        return;
      }
      setPrevia({ tipo, dados: dados ?? {} });
    } catch (e: any) {
      toast({ title: "Não deu certo", description: e.message, variant: "destructive" });
    } finally {
      setOcupado("");
    }
  }

  async function confirmar() {
    if (!previa) return;
    const tipo = previa.tipo;
    setOcupado(`criar-${tipo}`);
    try {
      const nome = tipo === "cupom" ? "reversa-troca-cupom" : "reversa-troca-bling";
      const { status, dados } = await funcaoTroca(nome, { acao: "criar", solicitacao_id: s.id });
      const msg = mensagemBackend(dados, "Não deu certo");
      if (status === 409) {
        if (tipo === "cupom") setAvisoCupom(msg);
        else setAvisoBling(msg);
        setPrevia(null);
        return;
      }
      if (status >= 400) {
        toast({ title: "Não deu certo", description: msg, variant: "destructive" });
        return;
      }
      setPrevia(null);
      toast({ title: tipo === "cupom" ? "Cupom criado" : "Pedido criado no Bling" });
      await aoMudar();
    } catch (e: any) {
      toast({ title: "Não deu certo", description: e.message, variant: "destructive" });
    } finally {
      setOcupado("");
    }
  }

  async function vincular() {
    setOcupado("vincular");
    try {
      await vincularPedidoNovo(s.id, pedidoTray.trim(), credito ? Number(credito) : null);
      toast({ title: "Pedido da Tray vinculado" });
      setPedidoTray("");
      setCredito("");
      await aoMudar();
    } catch (e: any) {
      toast({ title: "Não deu certo", description: e.message, variant: "destructive" });
    } finally {
      setOcupado("");
    }
  }

  const p = previa?.dados ?? {};

  return (
    <div className="space-y-4">
      {/* Ação 1 - cupom do crédito */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <p className="text-sm font-medium">Cupom do crédito</p>
        {temCupom ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base">{texto(s.credito_cupom_codigo)}</span>
              <BotaoCopiar valor={String(s.credito_cupom_codigo)} />
            </div>
            <p className="text-sm text-muted-foreground">
              {moeda(s.credito_cupom_valor)} · vale até {formatarData(s.credito_cupom_expira_em)}
            </p>
            {s.credito_cupom_recado && (
              <div className="flex items-start gap-2 rounded border border-border bg-muted/40 p-2">
                <p className="flex-1 whitespace-pre-wrap text-sm">{s.credito_cupom_recado}</p>
                <BotaoCopiar valor={String(s.credito_cupom_recado)} />
              </div>
            )}
          </div>
        ) : (
          <>
            <Button size="sm" disabled={!!ocupado} onClick={() => simular("cupom")}>
              {ocupado === "cupom" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar cupom do crédito
            </Button>
            {avisoCupom && (
              <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                {avisoCupom}
              </p>
            )}
          </>
        )}
      </div>

      {temPedidoNovo && semBling && s.pedido_novo_origem === "bling" ? null : temPedidoNovo ? (
        <div className="rounded-lg border border-border p-3 space-y-1">
          <p className="text-sm font-medium">Pedido novo</p>
          <p className="text-sm text-muted-foreground">
            Origem: {s.pedido_novo_origem === "bling" ? "Bling" : "Tray"} · pedido{" "}
            {texto(s.pedido_novo_numero ?? s.pedido_novo_bling_id)}
          </p>
          <p className="text-sm text-muted-foreground">
            Crédito aplicado: {moeda(s.credito_aplicado ?? s.credito_cupom_valor)}
          </p>
          <Badge variant="secondary">Solicitação concluída</Badge>
        </div>
      ) : (
        <>
          {/* Ação 2 - pedido no Bling */}
          {!semBling && (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium">Pedido no Bling</p>
            <p className="text-xs text-muted-foreground">
              Para troca só de tamanho, sem diferença de valor.
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      size="sm"
                      disabled={!!ocupado || blingBloqueado}
                      onClick={() => simular("bling")}
                    >
                      {ocupado === "bling" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Criar pedido no Bling
                    </Button>
                  </span>
                </TooltipTrigger>
                {blingBloqueado && (
                  <TooltipContent>
                    Esta troca tem diferença a pagar, então o pedido vai pela Tray.
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            {avisoBling && (
              <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                {avisoBling} Crie o pedido na loja e use "Vincular pedido da Tray" abaixo.
              </p>
            )}
          </div>
          )}

          {/* Ação 3 - vincular pedido da Tray */}
          <div
            className={`rounded-lg border p-3 space-y-2 ${
              blingBloqueado ? "border-primary ring-2 ring-primary/30" : "border-border"
            }`}
          >
            <p className="text-sm font-medium">Vincular pedido da Tray</p>
            <p className="text-xs text-muted-foreground">
              Para troca com diferença a pagar, quando o pedido já foi criado na loja.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="pedido-tray">Número do pedido</Label>
                <Input
                  id="pedido-tray"
                  value={pedidoTray}
                  onChange={(e) => setPedidoTray(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="credito-tray">Crédito aplicado</Label>
                <Input
                  id="credito-tray"
                  type="number"
                  step="0.01"
                  value={credito}
                  onChange={(e) => setCredito(e.target.value)}
                />
              </div>
            </div>
            <Button size="sm" disabled={!!ocupado || !pedidoTray.trim()} onClick={vincular}>
              {ocupado === "vincular" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Vincular pedido da Tray
            </Button>
          </div>
        </>
      )}

      <AlertDialog open={!!previa} onOpenChange={(v) => !v && setPrevia(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {previa?.tipo === "cupom" ? "Gerar cupom do crédito?" : "Criar pedido no Bling?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                {previa?.tipo === "cupom" ? (
                  <>
                    <p>Valor: {moeda(p.valor ?? p.credito)}</p>
                    <p>Validade: {texto(p.validade_dias ?? p.dias)} dias</p>
                    <p>Expira em: {formatarData(p.expira_em ?? p.validade)}</p>
                    <p>
                      Código: <span className="font-mono">{texto(p.codigo ?? p.code)}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p>Peça: {texto(p.peca ?? p.produto ?? p.produto_nome)}</p>
                    <p>Valor total: {moeda(p.valor_total ?? p.total)}</p>
                    <p>Crédito: {moeda(p.credito)}</p>
                    <p>Diferença: {moeda(p.diferenca)}</p>
                    <p>Cliente: {texto(p.cliente_nome ?? p.cliente)}</p>
                    <p>Contato no Bling: {texto(p.contato_nome ?? p.contato ?? traco)}</p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!ocupado}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!ocupado}
              onClick={(e) => {
                e.preventDefault();
                confirmar();
              }}
            >
              {ocupado.startsWith("criar-") && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
