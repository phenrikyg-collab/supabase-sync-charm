import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatarData } from "@/utils/formatters";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { statusPagamentoClasses, rotuloStatusPagamento } from "@/lib/statusPagamento";

interface ResultadoConsulta {
  pedido_id: string | number;
  data_pedido: string | null;
  valor: number | null;
  status_pagamento: string | null;
  forma_pagamento: string | null;
  boleto_url: string | null;
  url_pagamento: string | null;
}

function moeda(v: number | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
}

export function ConsultarTransacaoTab() {
  const [pedido, setPedido] = useState("");
  const [telefone, setTelefone] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [resultados, setResultados] = useState<ResultadoConsulta[]>([]);

  const buscar = async () => {
    if (!pedido.trim() && !telefone.trim()) return;
    setCarregando(true);
    try {
      const { data, error } = await supabase.rpc("atendimento_consultar_transacao" as any, {
        p_pedido_id: pedido.trim() || null,
        p_telefone: telefone.replace(/\D/g, "") || null,
      });
      if (error) throw error;
      setResultados((data ?? []) as ResultadoConsulta[]);
      setBuscou(true);
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro na consulta", description: mensagem, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <Card className="space-y-4 p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Consultar transação</h3>
          <p className="text-xs text-muted-foreground">
            Busque por número do pedido ou telefone da cliente para confirmar se o pagamento caiu.
          </p>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="consulta-pedido">Número do pedido</Label>
            <Input id="consulta-pedido" value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="123456" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="consulta-telefone">Telefone</Label>
            <Input
              id="consulta-telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
              inputMode="tel"
            />
          </div>
          <Button type="submit" disabled={carregando || (!pedido.trim() && !telefone.trim())}>
            {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Buscar
          </Button>
        </form>
      </Card>

      {buscou && resultados.length === 0 && (
        <p className="rounded-xl bg-muted/30 py-10 text-center text-sm text-muted-foreground">
          Nenhuma transação encontrada para essa busca.
        </p>
      )}

      {resultados.map((r) => {
        const link = r.boleto_url || r.url_pagamento;
        return (
          <Card key={`${r.pedido_id}-${r.data_pedido ?? ""}`} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Pedido #{r.pedido_id}</p>
                <p className="text-xs text-muted-foreground">
                  {r.data_pedido ? formatarData(String(r.data_pedido).slice(0, 10)) : "—"} · {r.forma_pagamento ?? "—"}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  statusPagamentoClasses(r.status_pagamento),
                )}
              >
                {rotuloStatusPagamento(r.status_pagamento)}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-lg font-semibold tabular-nums text-foreground">{moeda(r.valor)}</span>
              {link && (
                <Button size="sm" variant="outline" asChild>
                  <a href={link} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Abrir pagamento
                  </a>
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
