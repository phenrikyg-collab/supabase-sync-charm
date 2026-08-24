import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ddmm, ehFimDeSemana, fmtBRL, fmtNum, fmtPct } from "@/lib/dashComercial";
import { Variacao } from "./ui";

/* -------------------------- Seção 5 — Ritmo diário ----------------------- */

export interface DiaRitmo {
  dia: string;
  receita: number;
  meta_diaria: number;
  spend: number;
  pedidos: number;
}

export function RitmoDiario({ dias }: { dias: DiaRitmo[] }) {
  const dados = dias.map((d) => ({ ...d, label: ddmm(d.dia), fds: ehFimDeSemana(d.dia) }));
  const zerados = dados.filter((d) => d.spend === 0);

  return (
    <Card id="ritmo">
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-xl">Ritmo diário</CardTitle>
        <p className="text-xs text-muted-foreground">
          Receita líquida vs meta diária necessária, com investimento em mídia no eixo secundário.
          Fim de semana sombreado · destaque em vermelho para dia com spend zerado.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              {dados.map((d, i) => (d.fds ? (
                <ReferenceArea key={d.dia} x1={dados[Math.max(0, i - 0)].label} x2={d.label} fill="hsl(var(--muted))" fillOpacity={0.5} />
              ) : null))}
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v)}`} />
              <Tooltip
                formatter={(v: any, n: any) => [fmtBRL(Number(v)), n]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              />
              <Legend />
              <Bar yAxisId="l" dataKey="receita" name="Receita líquida" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Line yAxisId="l" type="monotone" dataKey="meta_diaria" name="Meta diária" stroke="hsl(var(--neg))" strokeDasharray="4 4" strokeWidth={2} dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="spend" name="Invest. mídia" stroke="hsl(var(--pos))" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {zerados.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {zerados.map((d) => (
              <Badge key={d.dia} variant="outline" className="border-neg/30 bg-neg/10 text-neg">
                <i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-neg" />{ddmm(d.dia)} · mídia R$ 0,00 · {fmtNum(d.pedidos)} pedidos
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------- Seção 6 — Mix de clientes -------------------- */

export interface MixDados {
  clientes_unicos: number;
  novos: number;
  recorrentes: number;
  taxa_recorrencia: number;
  taxa_aquisicao_cliente: number;
  taxa_aquisicao_pedido: number;
  cac_novos: number | null;
  origens: { origem: string; receita: number; pedidos: number; receita_comp: number }[];
}

export function MixClientes({ mix }: { mix: MixDados }) {
  const cards = [
    { t: "Clientes únicos", v: fmtNum(mix.clientes_unicos), s: "pedidos não-cancelados do período" },
    { t: "Novos", v: fmtNum(mix.novos), s: `${fmtPct(mix.taxa_aquisicao_cliente, 1)} dos clientes únicos do mês` },
    { t: "Recorrentes", v: fmtNum(mix.recorrentes), s: `${fmtPct(mix.taxa_recorrencia, 1)} dos clientes únicos do mês` },
    { t: "Aquisição (base pedido)", v: fmtPct(mix.taxa_aquisicao_pedido, 2), s: "% dos pedidos não-cancelados" },
    { t: "CAC novos", v: mix.cac_novos === null ? "—" : fmtBRL(mix.cac_novos), s: "invest. Meta Ads ÷ clientes novos" },
  ];
  return (
    <div id="mix" className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.t}>
            <CardContent className="space-y-1 p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.t}</p>
              <p className="font-serif text-2xl font-bold tabular-nums">{c.v}</p>
              <p className="text-[11px] text-muted-foreground">{c.s}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-xl">Receita por origem de venda</CardTitle>
          <p className="text-xs text-muted-foreground">
            Campo point_sale — separa venda do site de venda humana (WhatsApp/consultora).
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-card">
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">vs comparativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mix.origens.map((o) => (
                <TableRow key={o.origem}>
                  <TableCell className="font-medium">{o.origem || "(não informado)"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(o.receita)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(o.pedidos)}</TableCell>
                  <TableCell className="text-right">
                    <Variacao pct={o.receita_comp ? ((o.receita - o.receita_comp) / o.receita_comp) * 100 : null} />
                  </TableCell>
                </TableRow>
              ))}
              {!mix.origens.length && (
                <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Sem dados de origem.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------- Seção 7 — Canais e top 10 produtos ------------------ */

export interface LinhaProduto {
  product_id: string;
  nome: string;
  receita: number;
  unidades: number;
  receita_comp: number;
}

export function CanaisEProdutos({
  canais,
  produtos,
}: {
  canais: { canal: string; sessoes: number; receita: number; compras: number }[];
  produtos: LinhaProduto[];
}) {
  return (
    <div id="canais" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-xl">Sessões e receita por canal</CardTitle>
          <p className="text-xs text-muted-foreground">Atribuição GA4 — não soma com a receita da Tray.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-card">
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Sessões</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">Receita GA4</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {canais.map((c) => (
                <TableRow key={c.canal}>
                  <TableCell className="font-medium">{c.canal}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(c.sessoes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(c.compras)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(c.receita)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-xl">Top 10 produtos do período</CardTitle>
          <p className="text-xs text-muted-foreground">Itens vendidos em pedidos não-cancelados.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-card">
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Un.</TableHead>
                <TableHead className="text-right">Δ vs comp.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((p) => (
                <TableRow key={p.product_id}>
                  <TableCell className="max-w-[220px] truncate font-medium" title={p.nome}>{p.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(p.receita)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(p.unidades)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", p.receita - p.receita_comp >= 0 ? "text-pos" : "text-neg")}>
                    {p.receita - p.receita_comp >= 0 ? "+" : "−"}{fmtBRL(Math.abs(p.receita - p.receita_comp))}
                  </TableCell>
                </TableRow>
              ))}
              {!produtos.length && (
                <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Sem itens no período.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------- Parte 5 — Painel de saúde das fontes ---------------- */

export interface LinhaFonte {
  fonte: string;
  ultima_carga: string | null;
  status: "ok" | "atencao" | "vazia" | "descontinuada";
  cobertura: string;
  nota?: string;
}

const STATUS_FONTE: Record<LinhaFonte["status"], { icone: string; cls: string; label: string }> = {
  ok: { icone: "●", cls: "text-pos", label: "operando" },
  atencao: { icone: "●", cls: "text-warn", label: "atraso/parcial" },
  vazia: { icone: "●", cls: "text-neg", label: "vazia" },
  descontinuada: { icone: "■", cls: "text-neg", label: "descontinuada" },
};

export function SaudeFontes({ fontes }: { fontes: LinhaFonte[] }) {
  return (
    <Card id="fontes">
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-xl">Saúde das fontes</CardTitle>
        <p className="text-xs text-muted-foreground">
          Nenhum card exibe número de fonte vazia ou descontinuada sem selo de aviso visível.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-card">
            <TableRow>
              <TableHead>Fonte</TableHead>
              <TableHead>Última carga</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cobertura do período</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fontes.map((f) => {
              const s = STATUS_FONTE[f.status];
              return (
                <TableRow key={f.fonte}>
                  <TableCell className="font-mono text-xs">{f.fonte}</TableCell>
                  <TableCell className="text-sm">{f.ultima_carga ?? "—"}</TableCell>
                  <TableCell className={cn("text-sm font-medium", s.cls)}>{s.icone} {s.label}</TableCell>
                  <TableCell className="text-sm">
                    {f.cobertura}
                    {f.nota && <span className="block text-[11px] text-muted-foreground">{f.nota}</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
