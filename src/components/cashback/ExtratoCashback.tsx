import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAtendimentoCollapsible } from "@/hooks/useAtendimentoCollapsible";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  rpcCashback, listaDe, brl, dataBr, dataHoraBr, corStatus, ROTULO_STATUS,
  rotuloTipo, valorComSinal, numero, type Linha,
} from "@/lib/cashback";
import { EstadoVazio } from "./Estados";

type Props = {
  /** JSON do extrato: { cliente, saldo, cupons, lancamentos }. */
  extrato: Record<string, any>;
  /** Id da cliente usado nas RPCs de crédito. */
  customer: string | null;
  onAtualizado?: () => void;
  compacto?: boolean;
};

export function cuponsAtivosDe(extrato: Record<string, any>): Linha[] {
  return listaDe(extrato?.cupons).filter((c) => String(c.status ?? "").toLowerCase() === "ativo");
}

/** Miolo do painel de cashback da cliente: resumo, cupons, extrato e ações. */
export function ExtratoCashback({ extrato, customer, onAtualizado, compacto = false }: Props) {
  const { user } = useAuth();
  const usuario = (user?.user_metadata as any)?.nome || user?.email || "painel";

  const [dialogoCredito, setDialogoCredito] = useState(false);
  const [valorCredito, setValorCredito] = useState("");
  const [motivoCredito, setMotivoCredito] = useState("");
  const [cupomRetirar, setCupomRetirar] = useState<Linha | null>(null);
  const [motivoRetirada, setMotivoRetirada] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [cuponsAbertos, alterarCuponsAbertos] = useAtendimentoCollapsible("cupons");
  const [extratoAberto, alterarExtratoAberto] = useAtendimentoCollapsible("extrato");

  const cupons = listaDe(extrato?.cupons);
  const lancamentos = listaDe(extrato?.lancamentos);
  const ativos = cuponsAtivosDe(extrato);
  const cupomAtivo = ativos[0] ?? null;
  const somaAtivos = ativos.reduce((s, c) => s + numero(c.valor), 0);
  const totalUsado = lancamentos
    .filter((l) => String(l.tipo ?? "") === "debito_uso")
    .reduce((s, l) => s + Math.abs(numero(l.valor)), 0);

  async function darCredito() {
    const valor = Math.round(numero(valorCredito));
    if (valor <= 0) return toast.error("Informe um valor inteiro em reais maior que zero.");
    if (!motivoCredito.trim()) return toast.error("O motivo é obrigatório.");
    setSalvando(true);
    try {
      await rpcCashback("cashback_emissao_manual", {
        p_customer: customer,
        p_valor: valor,
        p_motivo: motivoCredito.trim(),
        p_usuario: usuario,
      });
      toast.success("Crédito registrado. O cupom é criado na próxima rodada da geração.");
      setDialogoCredito(false);
      setValorCredito("");
      setMotivoCredito("");
      onAtualizado?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível dar o crédito.");
    } finally {
      setSalvando(false);
    }
  }

  async function retirarCupom() {
    if (!cupomRetirar) return;
    if (!motivoRetirada.trim()) return toast.error("O motivo é obrigatório.");
    setSalvando(true);
    try {
      await rpcCashback("cashback_ajuste_debito", {
        p_cupom_id: cupomRetirar.id ?? cupomRetirar.cupom_id,
        p_motivo: motivoRetirada.trim(),
        p_usuario: usuario,
      });
      toast.success("Cupom retirado.");
      setCupomRetirar(null);
      setMotivoRetirada("");
      onAtualizado?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível retirar o cupom.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Cupons ativos</p>
          <p className="font-serif text-xl">{ativos.length}</p>
          <p className="text-xs text-muted-foreground">{brl(somaAtivos)} disponíveis</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total usado</p>
          <p className="font-serif text-xl">{brl(totalUsado)}</p>
          <p className="text-xs text-muted-foreground">em compras da cliente</p>
        </div>
      </div>

      <Collapsible open={!compacto || cuponsAbertos} onOpenChange={alterarCuponsAbertos}>
        {compacto ? (
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="h-8 w-full justify-between px-0 text-left text-sm font-medium">
              <span>Cupons ({cupons.length})</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", cuponsAbertos && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
        ) : (
          <h3 className="mb-2 text-sm font-medium">Cupons</h3>
        )}
        <CollapsibleContent className={compacto ? "pt-2" : undefined}>
        {cupons.length === 0 ? (
          <EstadoVazio titulo="Nenhum cupom para esta cliente." />
        ) : (
          <div className="space-y-2">
            {cupons.map((c, i) => (
              <div key={c.id ?? i} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm">{c.code ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">
                    {brl(c.valor)} · mínimo {brl(c.valor_minimo)} · vale até {dataBr(c.validade)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.pedido_origem ? `do pedido ${c.pedido_origem}` : "sem pedido de origem"}
                    {c.pedido_id ? ` · usado no pedido ${c.pedido_id}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className={corStatus(c.status)}>
                  {ROTULO_STATUS[String(c.status).toLowerCase()] ?? c.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={!compacto || extratoAberto} onOpenChange={alterarExtratoAberto}>
        {compacto ? (
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="h-8 w-full justify-between px-0 text-left text-sm font-medium">
              <span>Extrato ({lancamentos.length})</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", extratoAberto && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
        ) : (
          <h3 className="mb-2 text-sm font-medium">Extrato</h3>
        )}
        <CollapsibleContent className={compacto ? "pt-2" : undefined}>
        {lancamentos.length === 0 ? (
          <EstadoVazio titulo="Nenhum lançamento registrado." />
        ) : (
          <div className="divide-y rounded-md border">
            {lancamentos.map((l, i) => {
              const v = valorComSinal(l.tipo, l.valor);
              return (
                <div key={l.id ?? i} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm">{rotuloTipo(l.tipo)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {dataHoraBr(l.criado_em ?? l.data)}
                      {l.pedido_id ? ` · pedido ${l.pedido_id}` : ""}
                      {l.motivo ? ` · ${l.motivo}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-medium ${v.negativo ? "text-danger" : "text-success"}`}>
                    {v.texto}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        </CollapsibleContent>
      </Collapsible>

      <div className={`flex gap-2 ${compacto ? "" : "border-t pt-4"}`}>
        <Button size="sm" onClick={() => setDialogoCredito(true)} disabled={!customer}>Dar crédito</Button>
        {cupomAtivo && (
          <Button size="sm" variant="outline" onClick={() => setCupomRetirar(cupomAtivo)}>
            Retirar cupom
          </Button>
        )}
      </div>

      <Dialog open={dialogoCredito} onOpenChange={setDialogoCredito}>
        <DialogContent className={compacto ? "font-whatsapp" : undefined}>
          <DialogHeader>
            <DialogTitle>Dar crédito</DialogTitle>
            <DialogDescription>
              O cupom é criado na próxima rodada da geração, em até 10 minutos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Valor em reais</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={valorCredito}
                onChange={(e) => setValorCredito(e.target.value)}
                placeholder="50"
              />
            </div>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Textarea
                value={motivoCredito}
                onChange={(e) => setMotivoCredito(e.target.value)}
                placeholder="Por que este crédito está sendo dado"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoCredito(false)}>Cancelar</Button>
            <Button onClick={darCredito} disabled={salvando}>Dar crédito</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cupomRetirar} onOpenChange={(o) => !o && setCupomRetirar(null)}>
        <DialogContent className={compacto ? "font-whatsapp" : undefined}>
          <DialogHeader>
            <DialogTitle>Retirar cupom</DialogTitle>
            <DialogDescription>
              Isso apaga o cupom da loja e tira o crédito. A cliente perde o valor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Textarea
              value={motivoRetirada}
              onChange={(e) => setMotivoRetirada(e.target.value)}
              placeholder="Por que o cupom está sendo retirado"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCupomRetirar(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={retirarCupom} disabled={salvando}>
              Retirar cupom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
