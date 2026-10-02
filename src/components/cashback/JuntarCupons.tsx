import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { brl, dataBr } from "@/lib/cashback";

type CupomResumo = { valor?: number | null; valor_minimo?: number | null; validade?: string | null };
type Simulacao = {
  ok?: boolean;
  quantidade?: number;
  cupons?: { cupom_id: string | number; codigo?: string | null; valor?: number | null }[];
  hoje?: CupomResumo;
  depois?: CupomResumo;
  erro?: string;
};
export type ResultadoJuntar = {
  ok?: boolean;
  code?: string;
  valor?: number;
  valor_minimo?: number;
  validade?: string;
  juntados?: number;
  erro?: string;
};

async function chamar<T>(body: Record<string, any>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("cashback-meu", { body });
  let corpo: any = data;
  if (error) {
    try {
      corpo = await (error as any).context?.json?.();
    } catch {
      corpo = null;
    }
    if (!corpo?.erro) throw new Error(error.message);
  }
  if (corpo?.erro) {
    throw new Error(
      String(corpo.erro).toLowerCase().includes("nao autorizado")
        ? "Sessão expirada, entre de novo"
        : String(corpo.erro),
    );
  }
  return corpo as T;
}

/** Botão "Juntar cupons" com confirmação e simulação antes de juntar. */
export function JuntarCupons({
  customer,
  onJuntado,
  className,
  compacto,
}: {
  customer: string | number | null | undefined;
  onJuntado?: (r: ResultadoJuntar) => void;
  className?: string;
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [sim, setSim] = useState<Simulacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [juntando, setJuntando] = useState(false);

  const abrir = async () => {
    if (customer == null) return;
    setAberto(true);
    setSim(null);
    setCarregando(true);
    try {
      setSim(await chamar<Simulacao>({ acao: "painel_juntar_simular", customer: String(customer) }));
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível simular.");
      setAberto(false);
    } finally {
      setCarregando(false);
    }
  };

  const juntar = async () => {
    if (juntando || customer == null) return;
    setJuntando(true);
    try {
      const r = await chamar<ResultadoJuntar>({ acao: "painel_juntar", customer: String(customer) });
      if (r?.ok === false) throw new Error(r.erro ?? "Não foi possível juntar os cupons.");
      toast.success(`Cupons juntados: ${r.code ?? ""} de ${brl(r.valor)}`);
      setAberto(false);
      onJuntado?.(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível juntar os cupons.");
    } finally {
      setJuntando(false);
    }
  };

  const novo = sim?.depois;

  return (
    <>
      <Button type="button" size="sm" variant="outline" className={className} onClick={abrir} disabled={customer == null}>
        Juntar cupons
      </Button>
      <Dialog open={aberto} onOpenChange={(o) => !juntando && setAberto(o)}>
        <DialogContent className={compacto ? "font-whatsapp" : undefined}>
          <DialogHeader>
            <DialogTitle>Juntar cupons</DialogTitle>
            <DialogDescription>
              Os cupons antigos deixam de valer. A validade do novo é a do cupom que vence primeiro.
            </DialogDescription>
          </DialogHeader>
          {carregando ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : sim && sim.ok === false ? (
            <p className="text-sm text-muted-foreground">Não há o que juntar: a cliente precisa ter 2 ou mais cupons ativos.</p>
          ) : sim ? (
            <div className="space-y-3 text-sm">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vão virar um ({sim.quantidade ?? sim.cupons?.length ?? 0})
                </p>
                <div className="divide-y rounded-md border">
                  {(sim.cupons ?? []).map((c) => (
                    <div key={String(c.cupom_id)} className="flex justify-between gap-2 p-2">
                      <span className="font-mono text-xs">{c.codigo ?? "-"}</span>
                      <span>{brl(c.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {novo && (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cupom novo</p>
                  <p className="font-serif text-xl">{brl(novo.valor)}</p>
                  <p className="text-xs text-muted-foreground">
                    Pedido mínimo {brl(novo.valor_minimo)} · vale até {dataBr(novo.validade)}
                  </p>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} disabled={juntando}>Cancelar</Button>
            <Button onClick={juntar} disabled={juntando || carregando || !sim || sim.ok === false}>
              {juntando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Juntar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
