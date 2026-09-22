import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
  rpcCashback, listaDe, objetoDe, brl, dataBr, dataHoraBr, corStatus, ROTULO_STATUS,
  rotuloTipo, valorComSinal, numero, type Linha,
} from "@/lib/cashback";
import { CarregandoBloco, EstadoErro, EstadoVazio } from "./Estados";

type Props = {
  customer: string | null;
  onFechar: () => void;
  onAtualizado?: () => void;
};

export function PainelCliente({ customer, onFechar, onAtualizado }: Props) {
  const { user } = useAuth();
  const usuario = (user?.user_metadata as any)?.nome || user?.email || "painel";

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [extrato, setExtrato] = useState<Record<string, any>>({});

  const [dialogoCredito, setDialogoCredito] = useState(false);
  const [valorCredito, setValorCredito] = useState("");
  const [motivoCredito, setMotivoCredito] = useState("");

  const [cupomRetirar, setCupomRetirar] = useState<Linha | null>(null);
  const [motivoRetirada, setMotivoRetirada] = useState("");

  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!customer) return;
    setCarregando(true);
    setErro(null);
    try {
      const r = await rpcCashback("cashback_cliente_extrato", { p_customer: customer });
      setExtrato(objetoDe(r));
    } catch (e: any) {
      setErro(e?.message ?? "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  }, [customer]);

  useEffect(() => {
    if (customer) carregar();
  }, [customer, carregar]);

  const cliente = objetoDe(extrato.cliente ?? extrato);
  const saldo = extrato.saldo;
  const cupons = listaDe(extrato.cupons);
  const lancamentos = listaDe(extrato.lancamentos);
  const cupomAtivo = cupons.find((c) => String(c.status).toLowerCase() === "ativo") ?? null;

  const ativos = cupons.filter((c) => String(c.status).toLowerCase() === "ativo");
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
      await carregar();
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
      await carregar();
      onAtualizado?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível retirar o cupom.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet open={!!customer} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="font-serif text-xl">
            {cliente.nome || cliente.cliente || "Cliente"}
          </SheetTitle>
          <div className="text-xs text-muted-foreground">
            {[cliente.email, cliente.telefone].filter(Boolean).join(" · ")}
          </div>
          <div className="pt-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Saldo</span>
            <p className="font-serif text-2xl text-primary">{brl(cliente.saldo)}</p>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {carregando ? (
            <CarregandoBloco />
          ) : erro ? (
            <EstadoErro mensagem={erro} onTentar={carregar} />
          ) : (
            <div className="space-y-6">
              <section>
                <h3 className="mb-2 text-sm font-medium">Cupons</h3>
                {cupons.length === 0 ? (
                  <EstadoVazio titulo="Nenhum cupom para esta cliente." />
                ) : (
                  <div className="space-y-2">
                    {cupons.map((c, i) => (
                      <div key={c.id ?? i} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="font-mono text-sm">{c.codigo}</p>
                          <p className="text-xs text-muted-foreground">
                            {brl(c.valor)} · mínimo {brl(c.valor_minimo ?? c.minimo)} · vale até {dataBr(c.validade ?? c.expira_em)}
                          </p>
                        </div>
                        <Badge variant="outline" className={corStatus(c.status)}>
                          {ROTULO_STATUS[String(c.status).toLowerCase()] ?? c.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-medium">Extrato</h3>
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
                              {l.pedido ? ` · pedido ${l.pedido}` : ""}
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
              </section>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t p-4">
          <Button size="sm" onClick={() => setDialogoCredito(true)}>Dar crédito</Button>
          {cupomAtivo && (
            <Button size="sm" variant="outline" onClick={() => setCupomRetirar(cupomAtivo)}>
              Retirar cupom
            </Button>
          )}
        </div>
      </SheetContent>

      <Dialog open={dialogoCredito} onOpenChange={setDialogoCredito}>
        <DialogContent>
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
        <DialogContent>
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
    </Sheet>
  );
}
