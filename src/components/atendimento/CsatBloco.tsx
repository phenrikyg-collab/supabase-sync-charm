import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { chamarRpc } from "@/lib/supabaseRpc";

type Metricas = {
  dias: number;
  conversas_encerradas: number;
  pesquisas_abertas: number;
  enviadas: number;
  nao_enviadas_janela: number;
  respondidas: number;
  taxa_resposta_pct: number | null;
  csat_medio: number | null;
  satisfacao_pct: number | null;
  insatisfeitas: number;
  por_nota?: Record<string, number> | null;
  por_atendente?: { atendente: string | null; respostas: number; csat: number | null }[] | null;
};

type ItemCsat = {
  csat_id: number;
  conversa_id: number | string | null;
  nome: string | null;
  telefone: string | null;
  atendente: string | null;
  nota: number | null;
  rotulo: string | null;
  comentario: string | null;
  respondida_em: string | null;
  status: string | null;
};

const numero = (v?: number | null) => (v == null ? "0" : String(v));

const pct1 = (v?: number | null) =>
  v == null ? "sem dados" : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const nota1 = (v?: number | null) =>
  v == null ? "sem dados" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const quando = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const corDaNota = (nota?: number | null) => {
  if (nota != null && nota >= 5) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  if (nota != null && nota >= 3) return "bg-amber-500/10 text-amber-700 border-amber-500/30";
  return "bg-destructive/10 text-destructive border-destructive/30";
};

const PERIODOS: number[] = [7, 30, 90];

export function CsatBloco({ onAbrirConversa }: { onAbrirConversa?: (conversaId: string) => void }) {
  const [dias, setDias] = useState(30);
  const [soRuins, setSoRuins] = useState(false);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [lista, setLista] = useState<ItemCsat[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      const { data, error } = await chamarRpc("whatsapp_metricas_atendimento" as any, { p_dias: dias });
      if (!ativo) return;
      if (error) toast.error(error.message);
      else setMetricas((data as unknown) as Metricas);
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [dias]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data, error } = await chamarRpc("whatsapp_csat_lista" as any, { p_dias: dias, p_so_ruins: soRuins });
      if (!ativo) return;
      if (error) toast.error(error.message);
      else setLista(((data ?? []) as unknown) as ItemCsat[]);
    })();
    return () => { ativo = false; };
  }, [dias, soRuins]);

  const semRespostas = !metricas || (metricas.respondidas ?? 0) === 0;
  const porNota = Object.entries(metricas?.por_nota ?? {});
  const maxNota = Math.max(1, ...porNota.map(([, v]) => Number(v) || 0));
  const porAtendente = metricas?.por_atendente ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">Pesquisa de satisfação</CardTitle>
        <div className="flex gap-1">
          {PERIODOS.map((d) => (
            <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>
              {d} dias
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {carregando ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className={cn("grid gap-3 sm:grid-cols-2 md:grid-cols-4", semRespostas && "text-muted-foreground")}>
              <Numerao titulo="Satisfação" valor={semRespostas ? "Ainda sem respostas" : pct1(metricas?.satisfacao_pct)} destaque={!semRespostas} apagado={semRespostas} />
              <Numerao titulo="CSAT médio" valor={semRespostas ? "Ainda sem respostas" : nota1(metricas?.csat_medio)} apagado={semRespostas} />
              <Numerao titulo="Taxa de resposta" valor={semRespostas ? "Ainda sem respostas" : pct1(metricas?.taxa_resposta_pct)} apagado={semRespostas} />
              <Numerao
                titulo="Insatisfeitas"
                valor={numero(metricas?.insatisfeitas)}
                apagado={semRespostas}
                classeValor={!semRespostas && (metricas?.insatisfeitas ?? 0) > 0 ? "text-destructive" : undefined}
              />
            </div>

            <div className="space-y-0.5 text-xs text-muted-foreground">
              <p>
                {numero(metricas?.enviadas)} pesquisas enviadas de {numero(metricas?.conversas_encerradas)} conversas encerradas
              </p>
              {(metricas?.nao_enviadas_janela ?? 0) > 0 && (
                <p>{numero(metricas?.nao_enviadas_janela)} não enviadas porque a janela de 24h estava fechada</p>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Respostas por nota</p>
                {porNota.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ainda sem respostas.</p>
                ) : (
                  <div className="space-y-2">
                    {porNota.map(([rotulo, qtd]) => (
                      <div key={rotulo} className="flex items-center gap-3">
                        <span className="w-36 shrink-0 truncate text-sm text-muted-foreground">{rotulo}</span>
                        <div className="h-6 flex-1 overflow-hidden rounded bg-muted">
                          <div
                            className="flex h-full items-center justify-end bg-primary/70 px-2"
                            style={{ width: `${Math.max(6, ((Number(qtd) || 0) / maxNota) * 100)}%` }}
                          >
                            <span className="text-xs font-medium text-primary-foreground">{Number(qtd) || 0}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Por atendente</p>
                {porAtendente.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ainda sem respostas.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1 font-medium">Atendente</th>
                        <th className="py-1 font-medium">Respostas</th>
                        <th className="py-1 font-medium">CSAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porAtendente.map((a, i) => (
                        <tr key={`${a.atendente ?? "sem"}-${i}`} className="border-t border-border/60">
                          <td className="py-1">{a.atendente || "sem atendente"}</td>
                          <td className="py-1">{a.respostas}</td>
                          <td className="py-1">{nota1(a.csat)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Avaliações</p>
                <div className="flex items-center gap-2">
                  <Switch id="csat-so-ruins" checked={soRuins} onCheckedChange={setSoRuins} />
                  <Label htmlFor="csat-so-ruins" className="text-xs text-muted-foreground">Só as ruins</Label>
                </div>
              </div>
              {lista.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {soRuins ? "Nenhuma avaliação ruim no período." : "Nenhuma avaliação respondida no período."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1 font-medium">Cliente</th>
                        <th className="py-1 font-medium">Nota</th>
                        <th className="py-1 font-medium">Atendente</th>
                        <th className="py-1 font-medium">Comentário</th>
                        <th className="py-1 font-medium">Quando</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((it) => (
                        <tr
                          key={it.csat_id}
                          className={cn("border-t border-border/60", it.conversa_id != null && "cursor-pointer hover:bg-muted/50")}
                          onClick={() => it.conversa_id != null && onAbrirConversa?.(String(it.conversa_id))}
                        >
                          <td className="py-1.5">{it.nome || it.telefone || "sem nome"}</td>
                          <td className="py-1.5">
                            <Badge variant="outline" className={corDaNota(it.nota)}>
                              {it.rotulo || nota1(it.nota)}
                            </Badge>
                          </td>
                          <td className="py-1.5 text-muted-foreground">{it.atendente || "sem atendente"}</td>
                          <td className="py-1.5 max-w-[280px] truncate">{it.comentario || ""}</td>
                          <td className="py-1.5 text-muted-foreground">{quando(it.respondida_em)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Numerao({
  titulo,
  valor,
  destaque,
  apagado,
  classeValor,
}: {
  titulo: string;
  valor: string;
  destaque?: boolean;
  apagado?: boolean;
  classeValor?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p
        className={cn(
          "mt-1 font-semibold",
          destaque ? "text-3xl" : "text-2xl",
          apagado && "text-base text-muted-foreground",
          classeValor,
        )}
      >
        {valor}
      </p>
    </div>
  );
}
