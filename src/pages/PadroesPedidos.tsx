import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Sun, Sunset, Moon, Copy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { callClaude } from "@/lib/claudeApi";
import { useToast } from "@/hooks/use-toast";

type Periodo = "manha" | "tarde" | "noite";
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const PERIODOS: { key: Periodo; label: string; icon: any; range: string }[] = [
  { key: "manha", label: "Manhã", icon: Sun, range: "06h – 12h" },
  { key: "tarde", label: "Tarde", icon: Sunset, range: "12h – 18h" },
  { key: "noite", label: "Noite", icon: Moon, range: "18h – 06h" },
];

interface PedidoRow {
  id: number;
  date: string;
  total: number;
  store_note: string | null;
  orderstatus_type: string | null;
  point_sale: string | null;
}

interface ProdutoEstoque {
  id: number;
  name: string;
  stock: number;
  price: number;
  quantity_sold: number | null;
  promotional_price: number | null;
}

function classificarPeriodo(hour: number): Periodo {
  if (hour >= 6 && hour < 12) return "manha";
  if (hour >= 12 && hour < 18) return "tarde";
  return "noite";
}

function extrairHora(p: PedidoRow): number | null {
  const note = p.store_note ?? "";
  const m = note.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (m) return parseInt(m[4], 10);
  return null;
}

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

export default function PadroesPedidos() {
  const { toast } = useToast();
  const [periodo, setPeriodo] = useState("30dias");
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [sugestao, setSugestao] = useState<string>("");
  const [gerando, setGerando] = useState(false);

  const getDateRange = (p: string) => {
    const hoje = new Date();
    const fim = hoje.toISOString().slice(0, 10);
    const dias = p === "7dias" ? 7 : p === "30dias" ? 30 : p === "60dias" ? 60 : 90;
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - dias);
    return { inicio: inicio.toISOString().slice(0, 10), fim };
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { inicio, fim } = getDateRange(periodo);

      const all: PedidoRow[] = [];
      let from = 0;
      const size = 1000;
      // paginate
      while (true) {
        const { data, error } = await supabase
          .from("tray_orders" as any)
          .select("id,date,total,store_note,orderstatus_type,point_sale")
          .gte("date", inicio)
          .lte("date", fim)
          .range(from, from + size - 1);
        if (error) { console.error(error); break; }
        if (!data || data.length === 0) break;
        all.push(...(data as any));
        if (data.length < size) break;
        from += size;
      }
      setPedidos(all);

      const { data: prods } = await supabase
        .from("tray_products" as any)
        .select("id,name,stock,price,quantity_sold,promotional_price,available")
        .eq("available", 1)
        .gt("stock", 0)
        .order("quantity_sold", { ascending: false })
        .limit(60);
      setProdutos((prods as any) || []);
      setLoading(false);
    })();
  }, [periodo]);

  // Heatmap: dia da semana x período
  const heatmap = useMemo(() => {
    const matrix: number[][] = Array.from({ length: 7 }, () => [0, 0, 0]);
    const valor: number[][] = Array.from({ length: 7 }, () => [0, 0, 0]);
    let totalComHora = 0;
    pedidos.forEach((p) => {
      const hora = extrairHora(p);
      if (hora === null) return;
      // parse date as local
      const [y, m, d] = p.date.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      const dia = dt.getDay();
      const per = classificarPeriodo(hora);
      const col = per === "manha" ? 0 : per === "tarde" ? 1 : 2;
      matrix[dia][col] += 1;
      valor[dia][col] += Number(p.total) || 0;
      totalComHora += 1;
    });
    return { matrix, valor, totalComHora };
  }, [pedidos]);

  const maxCell = useMemo(() => {
    let max = 0;
    heatmap.matrix.forEach((row) => row.forEach((c) => (max = Math.max(max, c))));
    return max || 1;
  }, [heatmap]);

  // Por dia da semana (total)
  const porDiaSemana = useMemo(() => {
    return DIAS.map((nome, i) => {
      const total = heatmap.matrix[i].reduce((a, b) => a + b, 0);
      const valor = heatmap.valor[i].reduce((a, b) => a + b, 0);
      return { dia: nome.slice(0, 3), total, valor };
    });
  }, [heatmap]);

  // Por período (total)
  const porPeriodo = useMemo(() => {
    return PERIODOS.map((p, idx) => {
      let total = 0;
      let valor = 0;
      for (let i = 0; i < 7; i++) {
        total += heatmap.matrix[i][idx];
        valor += heatmap.valor[i][idx];
      }
      return { ...p, total, valor };
    });
  }, [heatmap]);

  // Insights
  const insights = useMemo(() => {
    if (heatmap.totalComHora === 0) return null;
    let bestDia = { dia: "—", total: 0 };
    porDiaSemana.forEach((d) => { if (d.total > bestDia.total) bestDia = { dia: DIAS[porDiaSemana.indexOf(d)], total: d.total }; });
    let bestPer = { label: "—", total: 0 };
    porPeriodo.forEach((p) => { if (p.total > bestPer.total) bestPer = { label: p.label, total: p.total }; });

    // worst day (oportunidade)
    let worstDia = { dia: "—", total: Infinity };
    porDiaSemana.forEach((d, idx) => { if (d.total < worstDia.total) worstDia = { dia: DIAS[idx], total: d.total }; });

    return { bestDia, bestPer, worstDia };
  }, [heatmap, porDiaSemana, porPeriodo]);

  const totalPedidos = pedidos.length;
  const totalFat = pedidos.reduce((s, p) => s + (Number(p.total) || 0), 0);
  const ticket = totalPedidos ? totalFat / totalPedidos : 0;

  const gerarSugestao = async () => {
    setGerando(true);
    setSugestao("");
    try {
      const hoje = new Date();
      const diaHoje = DIAS[hoje.getDay()];
      const topProdutos = produtos.slice(0, 12).map(
        (p) => `- ${p.name} (estoque: ${p.stock}, preço: ${brl(p.price)}, vendidos: ${p.quantity_sold ?? 0})`
      ).join("\n");

      const padrao = porDiaSemana.map((d, i) => `${DIAS[i]}: ${d.total} pedidos (${brl(d.valor)})`).join("\n");
      const periodos = porPeriodo.map((p) => `${p.label} (${p.range}): ${p.total} pedidos`).join("\n");

      const prompt = `Você é estrategista de marketing da Use Mariana Cardoso (moda feminina premium, calças modeladoras).

HOJE é ${diaHoje}, ${hoje.toLocaleDateString("pt-BR")}.

PADRÃO DE VENDAS (últimos ${periodo}):
${padrao}

POR PERÍODO DO DIA:
${periodos}

MELHOR DIA: ${insights?.bestDia.dia} | MELHOR PERÍODO: ${insights?.bestPer.label}
OPORTUNIDADE (dia mais fraco): ${insights?.worstDia.dia}

PRODUTOS COM ESTOQUE DISPONÍVEL (top vendidos):
${topProdutos}

Crie 3 ideias de campanhas pontuais para disparo no WhatsApp HOJE, considerando:
1. Os melhores horários para disparar
2. Aproveitar os produtos com estoque
3. Estimular venda em dias/horários mais fracos quando aplicável
4. Tom de voz Mariana Cardoso: sofisticado, próximo, empoderador

Para cada ideia retorne:
**Campanha [N]: [Nome]**
- 🎯 Objetivo
- ⏰ Melhor horário de disparo (hoje)
- 🛍️ Produtos sugeridos (use os com estoque)
- 💬 Copy pronta para WhatsApp (texto curto, com emoji, CTA claro)
- 💡 Por que vai funcionar

Seja direto e acionável. Markdown.`;

      const res = await callClaude(prompt);
      setSugestao(res);
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao gerar sugestões", variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  const copiarSugestao = () => {
    navigator.clipboard.writeText(sugestao);
    toast({ title: "Copiado!", description: "Sugestões copiadas para a área de transferência." });
  };

  const cellColor = (v: number) => {
    const intensity = v / maxCell;
    return `hsl(38 60% ${95 - intensity * 50}%)`;
  };

  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold">Padrões de Pedidos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Dias e horários de maior conversão + sugestões de campanhas WhatsApp
          </p>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7dias">Últimos 7 dias</SelectItem>
            <SelectItem value="30dias">Últimos 30 dias</SelectItem>
            <SelectItem value="60dias">Últimos 60 dias</SelectItem>
            <SelectItem value="90dias">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardDescription>Total de pedidos</CardDescription><CardTitle className="text-2xl">{totalPedidos}</CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Faturamento</CardDescription><CardTitle className="text-2xl">{brl(totalFat)}</CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Ticket médio</CardDescription><CardTitle className="text-2xl">{brl(ticket)}</CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Com horário identificado</CardDescription><CardTitle className="text-2xl">{heatmap.totalComHora}</CardTitle></CardHeader></Card>
          </div>

          {/* Insights */}
          {insights && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-2"><CardDescription>🏆 Melhor dia</CardDescription><CardTitle className="text-xl">{insights.bestDia.dia}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">{insights.bestDia.total} pedidos no período</CardContent>
              </Card>
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-2"><CardDescription>⏰ Melhor período</CardDescription><CardTitle className="text-xl">{insights.bestPer.label}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">{insights.bestPer.total} pedidos no período</CardContent>
              </Card>
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="pb-2"><CardDescription>💡 Oportunidade</CardDescription><CardTitle className="text-xl">{insights.worstDia.dia}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">Dia mais fraco — foco em campanhas</CardContent>
              </Card>
            </div>
          )}

          {/* Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle>Mapa de calor — Dia × Período</CardTitle>
              <CardDescription>Quantidade de pedidos por dia da semana e horário</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-xs uppercase text-muted-foreground">Dia</th>
                      {PERIODOS.map((p) => (
                        <th key={p.key} className="text-center p-2 text-xs uppercase text-muted-foreground">
                          <div className="flex flex-col items-center gap-1">
                            <p.icon className="h-4 w-4" />
                            <span>{p.label}</span>
                            <span className="text-[10px] font-normal normal-case">{p.range}</span>
                          </div>
                        </th>
                      ))}
                      <th className="text-center p-2 text-xs uppercase text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DIAS.map((nome, i) => {
                      const total = heatmap.matrix[i].reduce((a, b) => a + b, 0);
                      return (
                        <tr key={nome} className="border-t">
                          <td className="p-2 font-medium">{nome}</td>
                          {heatmap.matrix[i].map((v, j) => (
                            <td key={j} className="p-1">
                              <div
                                className="rounded p-3 text-center font-semibold"
                                style={{ backgroundColor: cellColor(v), color: v / maxCell > 0.5 ? "#1D1D1B" : "#666" }}
                              >
                                <div className="text-lg">{v}</div>
                                <div className="text-[10px] font-normal opacity-70">{brl(heatmap.valor[i][j])}</div>
                              </div>
                            </td>
                          ))}
                          <td className="p-2 text-center font-bold">{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {heatmap.totalComHora === 0 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Nenhum pedido com horário identificado no período selecionado.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Gráfico por dia */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Pedidos por dia da semana</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={porDiaSemana}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="dia" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {porDiaSemana.map((d, i) => (
                        <Cell key={i} fill={d.total === Math.max(...porDiaSemana.map((x) => x.total)) ? "hsl(45 65% 55%)" : "hsl(45 40% 75%)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Distribuição por período</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4 pt-2">
                  {porPeriodo.map((p) => {
                    const totalAll = porPeriodo.reduce((s, x) => s + x.total, 0) || 1;
                    const pct = (p.total / totalAll) * 100;
                    return (
                      <div key={p.key}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="flex items-center gap-2 text-sm font-medium"><p.icon className="h-4 w-4" />{p.label} <span className="text-muted-foreground text-xs">({p.range})</span></span>
                          <span className="text-sm font-semibold">{p.total} · {pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{brl(p.valor)}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* IA Sugestões */}
          <Card className="border-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Sugestões de campanha WhatsApp</CardTitle>
                  <CardDescription>IA gera 3 ideias acionáveis com base nos padrões + estoque disponível</CardDescription>
                </div>
                <div className="flex gap-2">
                  {sugestao && (
                    <Button variant="outline" size="sm" onClick={copiarSugestao}><Copy className="h-4 w-4 mr-2" />Copiar</Button>
                  )}
                  <Button onClick={gerarSugestao} disabled={gerando || produtos.length === 0}>
                    {gerando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" />Gerar ideias para hoje</>}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sugestao ? (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">{sugestao}</div>
              ) : (
                <p className="text-sm text-muted-foreground">Clique em "Gerar ideias para hoje" para receber campanhas personalizadas.</p>
              )}
            </CardContent>
          </Card>

          {/* Produtos em estoque */}
          <Card>
            <CardHeader>
              <CardTitle>Produtos disponíveis para campanha</CardTitle>
              <CardDescription>Top vendidos com estoque positivo ({produtos.length} produtos)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Vendidos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.slice(0, 25).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right"><Badge variant={p.stock > 10 ? "default" : "secondary"}>{p.stock}</Badge></TableCell>
                        <TableCell className="text-right">{brl(p.promotional_price && p.promotional_price > 0 ? p.promotional_price : p.price)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.quantity_sold ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
