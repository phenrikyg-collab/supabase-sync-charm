import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAtendimentoCollapsible } from "@/hooks/useAtendimentoCollapsible";
import { cn } from "@/lib/utils";
import { chamarRpc } from "@/lib/supabaseRpc";
import { brl, dataBr, objetoDe, numero } from "@/lib/cashback";
import { ExtratoCashback, cuponsAtivosDe } from "@/components/cashback/ExtratoCashback";

/** Extrato de cashback da cliente pelo telefone da conversa. */
export function useExtratoCashbackTelefone(telefone?: string | null) {
  return useQuery({
    queryKey: ["cashback-extrato-telefone", telefone ?? ""],
    enabled: !!telefone,
    queryFn: async () => {
      const { data, error } = await chamarRpc("cashback_extrato_por_telefone" as any, {
        p_telefone: telefone,
      });
      if (error) throw error;
      return objetoDe(data) as Record<string, any>;
    },
  });
}

/** Mensagem pronta com os cupons ativos, uma linha por cupom. */
export function textoCupons(extrato: Record<string, any>): string {
  const ativos = [...cuponsAtivosDe(extrato)].sort((a, b) => numero(b.valor) - numero(a.valor));
  return ativos
    .map(
      (c) =>
        `Seu cupom de cashback é o ${c.code ?? "-"}: vale ${brl(c.valor)} em pedidos a partir de ${brl(c.valor_minimo)}, até ${dataBr(c.validade)} 💛`,
    )
    .join("\n");
}

export function SeloCashback({ telefone, onAbrir }: { telefone?: string | null; onAbrir: () => void }) {
  const { data } = useExtratoCashbackTelefone(telefone);
  if (!data?.ok) return null;
  const ativos = cuponsAtivosDe(data);
  if (ativos.length === 0) return null;
  const saldo = numero(data.saldo) || ativos.reduce((s, c) => s + numero(c.valor), 0);
  return (
    <button
      type="button"
      onClick={onAbrir}
      title="Ver o cashback da cliente"
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success"
    >
      <Ticket className="h-3 w-3" />
      Cashback {brl(saldo)}
    </button>
  );
}

export function BotaoEnviarCupom({
  telefone,
  onTexto,
  mobile = false,
}: {
  telefone?: string | null;
  onTexto: (t: string) => void;
  mobile?: boolean;
}) {
  const { data } = useExtratoCashbackTelefone(telefone);
  if (!data?.ok || cuponsAtivosDe(data).length === 0) return null;
  const inserir = () => onTexto(textoCupons(data));
  if (mobile) {
    return (
      <Button variant="outline" className="h-11 justify-start gap-3" onClick={inserir}>
        <Ticket className="h-4 w-4" />
        Enviar cupom
      </Button>
    );
  }
  return (
    <Button size="sm" variant="ghost" className="h-8 shrink-0 gap-1 px-2" onClick={inserir} title="Enviar cupom">
      <Ticket className="h-4 w-4" />
      <span className="hidden xl:inline">Enviar cupom</span>
    </Button>
  );
}

/** Bloco "Cashback" do painel da cliente, com o mesmo conteúdo da página Cashback. */
export function CashbackConversa({ telefone }: { telefone: string }) {
  const { data, isLoading, refetch } = useExtratoCashbackTelefone(telefone);
  const cliente = objetoDe(data?.cliente);
  const [aberto, alterarAberto] = useAtendimentoCollapsible("cashback");

  return (
    <Collapsible open={aberto} onOpenChange={alterarAberto} className="border-b border-border p-3">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="h-8 w-full justify-between gap-2 px-0 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <Ticket className="h-3.5 w-3.5 shrink-0" />
            <span>Cupons e cashback · {isLoading ? "..." : brl(data?.saldo)}</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", aberto && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando cashback...</p>}

        {!isLoading && !data?.ok && (
          <p className="text-sm text-muted-foreground">Nenhum cadastro com este telefone</p>
        )}

        {!isLoading && data?.ok && (
          <>
            <div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Saldo</span>
              <p className="text-2xl text-primary">{brl(data.saldo)}</p>
            </div>
            <ExtratoCashback
              extrato={data}
              customer={cliente.id ? String(cliente.id) : null}
              onAtualizado={() => void refetch()}
              compacto
            />
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
