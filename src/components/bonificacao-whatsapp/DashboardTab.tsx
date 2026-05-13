import { useApurarMes } from "@/hooks/useBonificacaoWhatsApp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { corPorAtingimento } from "@/lib/bonificacaoWhatsApp";
import { Trophy, DollarSign, Target, Receipt, Percent, ShoppingCart, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));
const fmtPct = (n: number, d = 1) => `${Number(n ?? 0).toFixed(d)}%`;

export default function DashboardTab({ mes }: { mes: string }) {
  const r = useApurarMes(mes);

  if (r.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando apuração...
      </div>
    );
  }

  const { totais, linhas } = r;
  const cor = corPorAtingimento(totais.pct);

  const cards = [
    { icon: DollarSign, label: "Faturamento líquido", value: fmtBRL(totais.faturamento_liquido) },
    { icon: Target, label: "Meta do canal", value: fmtBRL(totais.meta) },
    { icon: Trophy, label: "% Atingimento", value: fmtPct(totais.pct), accent: cor.text },
    { icon: Receipt, label: "Ticket médio", value: fmtBRL(totais.ticket_medio) },
    { icon: Percent, label: "Desconto médio", value: fmtPct(totais.desconto_medio_pct, 2) },
    { icon: ShoppingCart, label: "Pedidos válidos", value: totais.qtd_pedidos.toString() },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c, i) => (
          <Card key={i} className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
                <c.icon className="h-3.5 w-3.5" /> {c.label}
              </div>
              <div className={`mt-2 font-serif text-2xl ${c.accent ?? "text-foreground"}`}>
                {c.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bônus projetado */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Bônus total projetado do mês</p>
            <p className="font-serif text-4xl text-primary mt-1">{fmtBRL(totais.bonus)}</p>
          </div>
          <div className="min-w-[280px] flex-1 max-w-md">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Atingimento global</span>
              <span className={cor.text}>{cor.label} · {fmtPct(totais.pct)}</span>
            </div>
            <Progress value={Math.min(totais.pct, 150)} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Ranking */}
      <Card>
        <CardHeader><CardTitle className="font-serif text-xl">Ranking de consultoras</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultora</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead>Atingimento</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Ticket</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">Bônus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhuma consultora cadastrada. Vá em Configurações para começar.
                  </TableCell>
                </TableRow>
              )}
              {linhas.map((l, idx) => {
                const c = corPorAtingimento(l.pct_atingimento);
                return (
                  <TableRow key={l.consultora.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-5">{idx + 1}º</span>
                        <span className="font-medium">{l.consultora.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{fmtBRL(l.faturamento_liquido)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtBRL(l.meta)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[150px]">
                        <Progress value={Math.min(l.pct_atingimento, 150)} className="h-2 flex-1" />
                        <Badge variant="outline" className={`${c.bg} ${c.text} border-0 text-[10px]`}>
                          {fmtPct(l.pct_atingimento, 0)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{l.qtd_pedidos}</TableCell>
                    <TableCell className="text-right">{fmtBRL(l.ticket_medio)}</TableCell>
                    <TableCell className="text-right">{fmtPct(l.desconto_medio_pct, 1)}</TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {fmtBRL(l.bonus_final)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Comparativo */}
      {linhas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-serif text-xl">Comparativo de bônus projetado</CardTitle></CardHeader>
          <CardContent style={{ height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={linhas.map((l) => ({ nome: l.consultora.nome, bonus: l.bonus_final, pct: l.pct_atingimento }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => fmtBRL(Number(v))} />
                <Tooltip
                  formatter={(v: number) => fmtBRL(Number(v))}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Bar dataKey="bonus" radius={[6, 6, 0, 0]}>
                  {linhas.map((l, i) => {
                    const c = corPorAtingimento(l.pct_atingimento);
                    const fill =
                      l.pct_atingimento >= 120 ? "hsl(280, 60%, 55%)" :
                      l.pct_atingimento >= 110 ? "hsl(152, 60%, 45%)" :
                      l.pct_atingimento >= 95  ? "hsl(152, 55%, 50%)" :
                      l.pct_atingimento >= 80  ? "hsl(38,  80%, 55%)" :
                                                 "hsl(0,   72%, 51%)";
                    return <Cell key={i} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
