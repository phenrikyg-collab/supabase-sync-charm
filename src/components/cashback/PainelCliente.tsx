import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { rpcCashback, objetoDe, brl } from "@/lib/cashback";
import { CarregandoBloco, EstadoErro } from "./Estados";
import { ExtratoCashback } from "./ExtratoCashback";

type Props = {
  customer: string | null;
  onFechar: () => void;
  onAtualizado?: () => void;
};

export function PainelCliente({ customer, onFechar, onAtualizado }: Props) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [extrato, setExtrato] = useState<Record<string, any>>({});


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
            <p className="font-serif text-2xl text-primary">{brl(saldo)}</p>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {carregando ? (
            <CarregandoBloco />
          ) : erro ? (
            <EstadoErro mensagem={erro} onTentar={carregar} />
          ) : (
            <ExtratoCashback
              extrato={extrato}
              customer={customer}
              onAtualizado={() => {
                void carregar();
                onAtualizado?.();
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
