import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  avalKpis,
  avalRegua,
  decimal,
  numero,
  pares,
  percentual,
  rotulo,
  texto,
  formatarData,
  type PainelKpis,
  type PainelRegua,
} from "@/lib/avaliacoes";

const PERIODOS = [7, 30, 90];

const CARDS: { chave: string[]; rotulo: string; tipo?: "num" | "pct" | "media" }[] = [
  { chave: ["pedidos_fila", "fila"], rotulo: "Pedidos na fila" },
  { chave: ["enviadas"], rotulo: "Enviadas" },
  { chave: ["respondidas"], rotulo: "Respondidas" },
  { chave: ["taxa_resposta"], rotulo: "Taxa de resposta", tipo: "pct" },
  { chave: ["avaliacoes_novas", "novas"], rotulo: "Avaliações novas" },
  { chave: ["media_novas"], rotulo: "Média das novas", tipo: "media" },
  { chave: ["com_foto"], rotulo: "Com foto" },
  { chave: ["pendentes_moderacao", "pendentes"], rotulo: "Pendentes de moderação" },
  { chave: ["total_publicadas", "publicadas"], rotulo: "Total publicadas" },
  { chave: ["media_geral"], rotulo: "Média geral", tipo: "media" },
  { chave: ["media_loja"], rotulo: "Média da loja", tipo: "media" },
  { chave: ["recusaram", "recusados"], rotulo: "Recusaram" },
];

function valorCard(kpis: PainelKpis, c: (typeof CARDS)[number]) {
  const chave = c.chave.find((k) => kpis?.[k] !== undefined && kpis?.[k] !== null);
  const v = chave ? kpis[chave] : null;
  if (c.tipo === "pct") return percentual(v);
  if (c.tipo === "media") return decimal(v, 1);
  return numero(v);
}

export function VisaoGeralTab() {
  const { toast } = useToast();
  const [dias, setDias] = useState(30);
  const [carregando, setCarregando] = useState(true);
  const [kpis, setKpis] = useState<PainelKpis>({});
  const [regua, setRegua] = useState<PainelRegua>({});

  async function carregar() {
    setCarregando(true);
    try {
      const [k, r] = await Promise.all([avalKpis(dias), avalRegua(dias)]);
      setKpis(k);
      setRegua(r);
    } catch (e: any) {
      toast({ title: "Não foi possível carregar", description: e.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  const porDia = (regua.por_dia ?? []) as Array<Record<string, any>>;
  const maximo = Math.max(
    1,
    ...porDia.map((d) => Math.max(Number(d.enviadas ?? 0), Number(d.respondidas ?? 0))),
  );
  const entrega = pares(regua.entrega_whatsapp);
  const fluxo = pares(regua.fluxo);
  const erros = (regua.erros_whatsapp ?? []) as Array<Record<string, any>>;

  return (
    <div className="space-y-5 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {PERIODOS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={dias === d ? "default" : "outline"}
              onClick={() => setDias(d)}
            >
              {d} dias
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
          <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {carregando ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {CARDS.map((c) => (
              <Card key={c.rotulo} className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.rotulo}</p>
                <p className="mt-1 font-serif text-2xl tabular-nums">{valorCard(kpis, c)}</p>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <h3 className="font-serif text-lg">Enviadas e respondidas por dia</h3>
            {!porDia.length ? (
              <p className="py-6 text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="mt-4 flex h-48 items-end gap-2 overflow-x-auto">
                {porDia.map((d, i) => (
                  <div key={i} className="flex min-w-[28px] flex-1 flex-col items-center gap-1">
                    <div className="flex h-40 w-full items-end justify-center gap-0.5">
                      <div
                        className="w-1/2 rounded-t bg-primary/70"
                        style={{ height: `${(Number(d.enviadas ?? 0) / maximo) * 100}%` }}
                        title={`Enviadas: ${numero(d.enviadas)}`}
                      />
                      <div
                        className="w-1/2 rounded-t bg-success/70"
                        style={{ height: `${(Number(d.respondidas ?? 0) / maximo) * 100}%` }}
                        title={`Respondidas: ${numero(d.respondidas)}`}
                      />
                    </div>
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                      {formatarData(d.dia ?? d.data).slice(0, 5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary/70" /> Enviadas
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-success/70" /> Respondidas
              </span>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-serif text-lg">Entrega no WhatsApp</h3>
              {!entrega.length ? (
                <p className="py-4 text-sm text-muted-foreground">Sem dados no período.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {entrega.map((e) => (
                    <li key={e.chave} className="flex justify-between border-b border-border pb-1">
                      <span>{rotulo(e.chave)}</span>
                      <span className="tabular-nums">{numero(e.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-serif text-lg">Em que ponto da conversa</h3>
              {!fluxo.length ? (
                <p className="py-4 text-sm text-muted-foreground">Sem dados no período.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {fluxo.map((e) => (
                    <li key={e.chave} className="flex justify-between border-b border-border pb-1">
                      <span>{rotulo(e.chave)}</span>
                      <span className="tabular-nums">{numero(e.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {erros.length > 0 && (
            <Card className="p-4">
              <h3 className="font-serif text-lg">Erros no envio</h3>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 font-medium">Pedido</th>
                    <th className="py-1 font-medium">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {erros.map((e, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-1.5 whitespace-nowrap">{texto(e.pedido)}</td>
                      <td className="py-1.5 text-destructive">{texto(e.erro)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
