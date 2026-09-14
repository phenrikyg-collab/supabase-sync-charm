import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ArrowUpRight, CircleAlert, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AjudaInfo, Variacao } from "./Variacao";
import { brl, corSemaforo, diaCurto, inteiro, numero, pct1, rpcEmails } from "@/lib/emails";

const ORDENACOES = [
  { valor: "cliques", rotulo: "Cliques" },
  { valor: "abertura", rotulo: "Abertura" },
  { valor: "receita", rotulo: "Receita" },
  { valor: "conversao", rotulo: "Conversão" },
  { valor: "receita_por_mil", rotulo: "Receita/mil" },
  { valor: "ctor", rotulo: "CTOR" },
];

function CardMetrica({
  titulo, valor, subtitulo, variacao, inverter, ajuda,
}: {
  titulo: string; valor: string; subtitulo?: string; variacao?: any; inverter?: boolean; ajuda?: string;
}) {
  return (
    <Card className="p-4 space-y-1">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{titulo}</p>
        {ajuda && <AjudaInfo texto={ajuda} />}
      </div>
      <p className="font-serif text-2xl">{valor}</p>
      {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
      <Variacao v={variacao} inverter={inverter} />
    </Card>
  );
}

const ICONE_NIVEL: Record<string, { Icone: any; cor: string }> = {
  bom: { Icone: ArrowUpRight, cor: "text-success" },
  atencao: { Icone: AlertTriangle, cor: "text-warning" },
  ruim: { Icone: CircleAlert, cor: "text-danger" },
  neutro: { Icone: Circle, cor: "text-muted-foreground" },
};

export function VisaoGeralTab({ dias, onAbrirCampanha }: { dias: number; onAbrirCampanha?: (id: any) => void }) {
  const [pior, setPior] = useState(false);
  const [ordenarPor, setOrdenarPor] = useState("cliques");
  const [minEnvios, setMinEnvios] = useState(100);
  const [seriesOcultas, setSeriesOcultas] = useState<string[]>([]);

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["emails-kpis", dias],
    queryFn: () => rpcEmails<any>("emails_kpis", { p_dias: dias }),
  });

  const { data: serie = [] } = useQuery({
    queryKey: ["emails-serie", dias],
    queryFn: async () => (await rpcEmails<any>("emails_serie_diaria", { p_dias: dias })) ?? [],
  });

  const { data: insights = [] } = useQuery({
    queryKey: ["emails-insights", dias],
    queryFn: async () => (await rpcEmails<any>("emails_insights", { p_dias: dias })) ?? [],
  });

  const { data: comparativo = [] } = useQuery({
    queryKey: ["emails-comparativo", dias, minEnvios, ordenarPor, pior],
    queryFn: async () =>
      (await rpcEmails<any>("emails_comparativo", {
        p_dias: dias,
        p_min_envios: minEnvios,
        p_ordenar_por: ordenarPor,
        p_pior: pior,
        p_limite: 10,
      })) ?? [],
  });

  const atual = kpis?.atual ?? {};
  const variacao = kpis?.variacao ?? {};
  const limites = kpis?.limites_ses ?? {};
  const semEnvio = !isLoading && numero(atual.enviados) === 0;

  const alertaReclamacao =
    atual.taxa_reclamacao_pct != null &&
    limites.reclamacao_pct != null &&
    numero(atual.taxa_reclamacao_pct) > numero(limites.reclamacao_pct);

  const dadosSerie = (Array.isArray(serie) ? serie : []).map((d: any) => ({
    dia: diaCurto(d.data ?? d.dia ?? d.data_envio),
    enviados: numero(d.enviados),
    aberturas: numero(d.aberturas),
    pedidos: numero(d.pedidos),
  }));

  const oculta = (k: string) => seriesOcultas.includes(k);
  const alternar = (k: string) =>
    setSeriesOcultas((prev) => (prev.includes(k) ? prev.filter((s) => s !== k) : [...prev, k]));

  const linhas = Array.isArray(comparativo) ? comparativo : [];

  return (
    <div className="space-y-6">
      {alertaReclamacao && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          A AWS suspende a conta acima de {pct1(limites.reclamacao_pct)} de reclamação. Pare os disparos e investigue.
        </div>
      )}

      {semEnvio && (
        <Card className="p-5 text-sm text-muted-foreground">
          Nenhum e-mail enviado neste período. O sistema está esperando a AWS liberar a saída do sandbox.
        </Card>
      )}

      {/* FAIXA A */}
      <section className="space-y-2">
        <h2 className="font-serif text-lg">Saúde do canal</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CardMetrica
            titulo="Envios"
            valor={inteiro(atual.enviados)}
            subtitulo={`${inteiro(atual.destinatarios)} destinatários`}
            variacao={variacao.enviados}
            ajuda="Destinatários entraram na fila. Envios saíram de fato. A diferença é fila, erro e supressão."
          />
          <CardMetrica
            titulo="Entregabilidade"
            valor={pct1(atual.entregabilidade_pct)}
            subtitulo={`${inteiro(atual.entregues)} entregues`}
            variacao={variacao.entregabilidade_pct}
            ajuda="Estimativa: enviados menos bounces. O evento de entrega do SES entra quando o SNS for ligado."
          />
          <CardMetrica
            titulo="Abertura"
            valor={pct1(atual.taxa_abertura_pct)}
            subtitulo={`${inteiro(atual.aberturas_unicas)} aberturas`}
            variacao={variacao.taxa_abertura_pct}
          />
          <CardMetrica
            titulo="Clique / CTOR"
            valor={`${pct1(atual.taxa_clique_pct)} / ${atual.ctor_pct == null ? "sem base" : pct1(atual.ctor_pct)}`}
            subtitulo={`${inteiro(atual.cliques_unicos)} cliques`}
            variacao={variacao.taxa_clique_pct}
          />
        </div>
      </section>

      {/* FAIXA B */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
        <span className={cn("font-medium", corSemaforo(atual.taxa_bounce_pct, 2, 5))}>
          Bounce {pct1(atual.taxa_bounce_pct)}
        </span>
        <span className={cn("font-medium", corSemaforo(atual.taxa_reclamacao_pct, 0.05, 0.1))}>
          Reclamações {pct1(atual.taxa_reclamacao_pct, 3)}
        </span>
        <span className={cn("font-medium", corSemaforo(atual.taxa_descadastro_pct, 0.3, 999))}>
          Descadastros {pct1(atual.taxa_descadastro_pct, 3)}
        </span>
      </Card>

      {/* FAIXA C */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-lg">Resultado atribuído às campanhas do período</h2>
          <p className="text-xs text-muted-foreground">
            Períodos recentes podem amadurecer por até {kpis?.maturacao_dias ?? 7} dias
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5 space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Receita atribuída</p>
              <p className="font-serif text-3xl">{brl(atual.receita_atribuida)}</p>
              <Variacao v={variacao.receita_atribuida} />
            </div>
            <div className="space-y-1 border-t pt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pedidos atribuídos</p>
              <p className="font-serif text-2xl">{inteiro(atual.pedidos_atribuidos)}</p>
              <Variacao v={variacao.pedidos_atribuidos} />
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <CardMetrica titulo="Conversão por envio" valor={pct1(atual.conversao_por_envio_pct, 3)} variacao={variacao.conversao_por_envio_pct} />
            <CardMetrica titulo="Receita por mil envios" valor={brl(atual.receita_por_mil_envios)} variacao={variacao.receita_por_mil_envios} />
            <CardMetrica titulo="Ticket médio" valor={brl(atual.ticket_medio)} variacao={variacao.ticket_medio} />
            <CardMetrica
              titulo="Assistências"
              valor={inteiro(atual.assistencias)}
              subtitulo={`${brl(atual.receita_assistida)} em receita assistida`}
              variacao={variacao.assistencias}
            />
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Último clique, janela de 7 dias, coorte por data de envio. Receita assistida é quem abriu, não clicou e
          comprou: é influência, não atribuição, e não soma com a atribuída.
        </p>
      </section>

      {/* FAIXA D */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5 space-y-3">
          <div>
            <h3 className="font-serif text-lg">Tendência por data de envio</h3>
            <p className="text-xs text-muted-foreground">
              Barras representam envios; linhas mostram aberturas e pedidos atribuídos por data de envio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { k: "enviados", r: "Envios" },
              { k: "aberturas", r: "Aberturas" },
              { k: "pedidos", r: "Pedidos" },
            ].map((s) => (
              <Button
                key={s.k}
                size="sm"
                variant={oculta(s.k) ? "outline" : "secondary"}
                onClick={() => alternar(s.k)}
              >
                {s.r}
              </Button>
            ))}
          </div>
          <div className="h-72">
            {dadosSerie.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Ainda não há envios neste período para desenhar a tendência.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosSerie}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="esq" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="dir" orientation="right" tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Legend />
                  {!oculta("enviados") && (
                    <Bar yAxisId="esq" dataKey="enviados" name="Envios" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  )}
                  {!oculta("aberturas") && (
                    <Line yAxisId="esq" type="monotone" dataKey="aberturas" name="Aberturas" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                  )}
                  {!oculta("pedidos") && (
                    <Line yAxisId="dir" type="monotone" dataKey="pedidos" name="Pedidos" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="font-serif text-lg">Insights do período</h3>
          {(!insights || insights.length === 0) && (
            <p className="text-sm text-muted-foreground">Sem leituras por enquanto: elas aparecem quando houver envio.</p>
          )}
          <div className="space-y-2">
            {(insights as any[]).map((i: any, idx: number) => {
              const { Icone, cor } = ICONE_NIVEL[i.nivel] ?? ICONE_NIVEL.neutro;
              return (
                <div key={idx} className="flex gap-2 rounded-lg border p-3">
                  <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", cor)} />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">{i.titulo}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{i.texto}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* FAIXA E */}
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg">Comparativo de campanhas</h3>
            <p className="text-xs text-muted-foreground">
              {pior ? "Piores" : "Melhores"} resultados entre campanhas com pelo menos {minEnvios} envios.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              <Button size="sm" variant={pior ? "outline" : "secondary"} onClick={() => setPior(false)}>Melhores</Button>
              <Button size="sm" variant={pior ? "secondary" : "outline"} onClick={() => setPior(true)}>Piores</Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {ORDENACOES.map((o) => (
                <Button
                  key={o.valor}
                  size="sm"
                  variant={ordenarPor === o.valor ? "secondary" : "outline"}
                  onClick={() => setOrdenarPor(o.valor)}
                >
                  {o.rotulo}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              className="h-8 w-24"
              value={minEnvios}
              min={0}
              onChange={(e) => setMinEnvios(Math.max(0, Number(e.target.value) || 0))}
              aria-label="Mínimo de envios"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead className="text-right">Envios</TableHead>
                <TableHead className="text-right">Abertura</TableHead>
                <TableHead className="text-right">Clique</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Relatório</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Nenhuma campanha atingiu o corte mínimo de envios neste período.
                  </TableCell>
                </TableRow>
              )}
              {linhas.map((l: any, i: number) => {
                const resultadoBruto = l.resultado ?? l.valor ?? l[ordenarPor];
                const resultado =
                  ordenarPor === "receita" || ordenarPor === "receita_por_mil"
                    ? brl(resultadoBruto)
                    : ordenarPor === "cliques"
                      ? inteiro(resultadoBruto)
                      : pct1(resultadoBruto);
                return (
                  <TableRow key={l.id ?? `${l.nome}-${i}`}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{l.nome}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {l.familia === "automacao" ? "automação" : "campanha"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{inteiro(l.enviados)}</TableCell>
                    <TableCell className="text-right">{pct1(l.taxa_abertura_pct ?? l.abertura)}</TableCell>
                    <TableCell className="text-right">{pct1(l.taxa_clique_pct ?? l.clique)}</TableCell>
                    <TableCell className="text-right font-medium">{resultado}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => onAbrirCampanha?.(l.campanha_id ?? null)}>
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
