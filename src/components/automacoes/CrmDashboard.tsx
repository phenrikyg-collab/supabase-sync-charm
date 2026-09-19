import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, BadgeDollarSign, HandCoins, ReceiptText, ShoppingBag, Store, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CrmKpiCard, classeRoas } from "./CrmKpiCard";
import { brlCrm, numeroCrm, percentualCrm, roasCrm, type AbaCrm, type MetricasCrm, type PainelCrm } from "./crmTipos";

function ResumoGrupo({ titulo, dados, abrir }: { titulo: string; dados?: MetricasCrm; abrir: () => void }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-xl">{titulo}</CardTitle>
        <Button variant="ghost" size="sm" onClick={abrir}>Ver todas <ArrowRight className="ml-1 h-4 w-4" /></Button>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-xs text-muted-foreground">Inclui e-mail; o detalhe do e-mail fica na área de E-mails.</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {[
          ["Receita", brlCrm(dados?.receita)],
          ["% faturamento", percentualCrm(dados?.pct_faturamento)],
          ["Custo", brlCrm(dados?.custo), `mensagens ${brlCrm(dados?.custo_mensagens)} · IA ${brlCrm(dados?.custo_ia)}`],
          ["ROAS", roasCrm(dados?.roas, dados?.custo)],
          ["Pedidos", numeroCrm(dados?.pedidos)],
          ["Pessoas", numeroCrm(dados?.pessoas)],
          ["Enviados", numeroCrm(dados?.enviados)],
        ].map(([rotulo, valor, detalhe]) => (
          <div key={rotulo as string}>
            <p className="text-xs text-muted-foreground">{rotulo}</p>
            <p className={cn("mt-1 font-semibold", rotulo === "ROAS" && classeRoas(dados?.roas, dados?.custo))}>{valor}</p>
            {detalhe && <p className="mt-0.5 text-[11px] text-muted-foreground">{detalhe}</p>}
          </div>
        ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CrmDashboard({ dados, onAba }: { dados: PainelCrm; onAba: (aba: AbaCrm) => void }) {
  const geral = dados.geral ?? {};
  const top = [...(dados.campanhas?.itens_lista ?? []), ...(dados.automacoes?.itens_lista ?? [])]
    .sort((a, b) => Number(b.receita ?? 0) - Number(a.receita ?? 0)).slice(0, 5);
  const periodo = dados.periodo ?? {};
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <CrmKpiCard titulo="Faturamento da loja" valor={brlCrm(dados.faturamento?.valor)} detalhe={`${numeroCrm(dados.faturamento?.pedidos)} pedidos`} icon={Store} />
        <CrmKpiCard titulo="Receita influenciada" valor={brlCrm(geral.receita)} detalhe={`${percentualCrm(geral.pct_faturamento)} do faturamento`} icon={BadgeDollarSign} />
        <CrmKpiCard titulo="Custo dos envios" valor={brlCrm(geral.custo)} detalhe={`mensagens ${brlCrm(geral.custo_mensagens)} · IA ${brlCrm(geral.custo_ia)}`} icon={WalletCards} />
        <CrmKpiCard titulo="ROAS" valor={roasCrm(geral.roas, geral.custo)} detalhe={geral.roas == null || Number(geral.custo ?? 0) === 0 ? undefined : `${brlCrm(geral.roas)} de venda para cada R$ 1`} icon={HandCoins} className={classeRoas(geral.roas, geral.custo)} />
        <CrmKpiCard titulo="Pedidos influenciados" valor={numeroCrm(geral.pedidos)} icon={ShoppingBag} />
        <CrmKpiCard titulo="Ticket médio" valor={brlCrm(geral.ticket_medio)} icon={ReceiptText} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ResumoGrupo titulo="Campanhas" dados={dados.campanhas} abrir={() => onAba("campanhas")} />
        <ResumoGrupo titulo="Automações" dados={dados.automacoes} abrir={() => onAba("automacoes")} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-xl">Receita influenciada por dia</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.serie ?? []} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="dia" tickFormatter={(v) => String(v).slice(5).split("-").reverse().join("/")} fontSize={11} />
                <YAxis tickFormatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { notation: "compact" })}`} fontSize={11} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const linha = payload[0]?.payload;
                  const influenciada = Number(linha?.receita_campanhas ?? 0) + Number(linha?.receita_automacoes ?? 0);
                  const faturamento = Number(linha?.faturamento ?? 0);
                  return <div className="rounded-md border bg-popover p-3 text-xs shadow-md"><p className="mb-2 font-medium">{String(label).slice(0, 10).split("-").reverse().join("/")}</p><p>Campanhas: {brlCrm(linha?.receita_campanhas)}</p><p>Automações: {brlCrm(linha?.receita_automacoes)}</p><p>Faturamento: {brlCrm(faturamento)}</p><p>Influenciado: {faturamento ? percentualCrm((influenciada / faturamento) * 100) : "–"}</p></div>;
                }} />
                <Legend />
                <Bar dataKey="receita_campanhas" name="Campanhas" stackId="receita" fill="hsl(var(--primary))" />
                <Bar dataKey="receita_automacoes" name="Automações" stackId="receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-28 border-t pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.serie ?? []} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="dia" hide />
                <YAxis tickFormatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { notation: "compact" })}`} fontSize={10} />
                <Tooltip formatter={(v) => brlCrm(v)} labelFormatter={(v) => String(v).slice(0, 10).split("-").reverse().join("/")} />
                <Line type="monotone" dataKey="custo" name="Custo" stroke="hsl(var(--danger))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle className="text-xl">Por canal</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Canal</TableHead><TableHead className="text-right">Enviados</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">ROAS</TableHead></TableRow></TableHeader>
              <TableBody>{(dados.por_canal ?? []).map((linha) => <TableRow key={linha.canal}><TableCell className="font-medium">{linha.canal}</TableCell><TableCell className="text-right">{numeroCrm(linha.enviados)}</TableCell><TableCell className="text-right">{brlCrm(linha.custo)}</TableCell><TableCell className="text-right">{numeroCrm(linha.pedidos)}</TableCell><TableCell className="text-right">{brlCrm(linha.receita)}</TableCell><TableCell className={cn("text-right font-medium", classeRoas(linha.roas, linha.custo))}>{roasCrm(linha.roas, linha.custo)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xl">Top 5 por receita</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {top.map((item, indice) => <div key={item.origem_id} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{indice + 1}. {item.nome}</p><Badge variant="outline" className="mt-1 text-[10px]">{item.origem === "campanha" ? "Campanha" : "Automação"}</Badge></div><p className="shrink-0 font-semibold">{brlCrm(item.receita)}</p></div>)}
            {top.length === 0 && <p className="text-sm text-muted-foreground">Nenhum resultado no período.</p>}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">Modelo de atribuição: último toque. Cada pedido conta uma vez, para a última mensagem antes da compra: WhatsApp recebido até {numeroCrm(periodo.janela_whatsapp_horas)}h antes, ou e-mail clicado até {numeroCrm(periodo.janela_email_dias)} dias antes. Custos pela tabela da Meta, dólar a {brlCrm(periodo.cotacao_usd_brl)}. O custo soma as mensagens cobradas pela Meta e o uso de IA no atendimento das conversas geradas pelo fluxo.</p>
    </div>
  );
}