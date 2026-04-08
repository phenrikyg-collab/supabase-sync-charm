import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Brain } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";

interface Categoria {
  id: string;
  grupo_dre: string | null;
  nome_categoria: string | null;
  descricao_categoria: string | null;
}

interface LinhaComparativo {
  categoriaId: string;
  faixa: string;
  categoria: string;
  plano: string;
  orcado: number;
  realizado: number;
  desvioR: number;
  desvioPct: number;
  status: string;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OrcamentoComparativo() {
  const { toast } = useToast();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [orcados, setOrcados] = useState<Record<string, number>>({});
  const [realizados, setRealizados] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("categorias_financeiras")
      .select("id, grupo_dre, nome_categoria, descricao_categoria")
      .then(({ data }) => {
        if (data) setCategorias(data as Categoria[]);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    setInsights(null);

    const startDate = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const endM = mes === 12 ? 1 : mes + 1;
    const endY = mes === 12 ? ano + 1 : ano;
    const endDate = `${endY}-${String(endM).padStart(2, "0")}-01`;

    Promise.all([
      supabase
        .from("orcamentos")
        .select("categoria_id, valor_orcado")
        .eq("mes", mes)
        .eq("ano", ano),
      supabase
        .from("movimentacoes_financeiras")
        .select("categoria_id, valor")
        .eq("impacta_dre", true)
        .gte("data", startDate)
        .lt("data", endDate)
        .not("categoria_id", "is", null),
    ]).then(([orcRes, realRes]) => {
      const oMap: Record<string, number> = {};
      orcRes.data?.forEach((r: any) => {
        oMap[r.categoria_id] = Number(r.valor_orcado);
      });
      setOrcados(oMap);

      const rMap: Record<string, number> = {};
      realRes.data?.forEach((r: any) => {
        if (!r.categoria_id) return;
        rMap[r.categoria_id] = (rMap[r.categoria_id] || 0) + Math.abs(Number(r.valor));
      });
      setRealizados(rMap);
      setLoading(false);
    });
  }, [mes, ano]);

  const linhas: LinhaComparativo[] = useMemo(() => {
    const ids = new Set([...Object.keys(orcados), ...Object.keys(realizados)]);
    const result: LinhaComparativo[] = [];
    ids.forEach((id) => {
      const cat = categorias.find((c) => c.id === id);
      if (!cat || !cat.grupo_dre) return;
      const orcado = orcados[id] || 0;
      const realizado = realizados[id] || 0;
      const desvioR = realizado - orcado;
      const desvioPct = orcado > 0 ? (desvioR / orcado) * 100 : 0;
      let status = "✅ Dentro";
      if (orcado > 0 && realizado > orcado) status = "🔴 Estourado";
      else if (orcado > 0 && realizado >= orcado * 0.8) status = "⚠️ Próximo";

      result.push({
        categoriaId: id,
        faixa: cat.grupo_dre!,
        categoria: cat.nome_categoria || "",
        plano: cat.descricao_categoria || "",
        orcado,
        realizado,
        desvioR,
        desvioPct,
        status,
      });
    });
    return result.sort((a, b) => a.faixa.localeCompare(b.faixa) || a.categoria.localeCompare(b.categoria));
  }, [categorias, orcados, realizados]);

  const totalOrcado = linhas.reduce((s, l) => s + l.orcado, 0);
  const totalRealizado = linhas.reduce((s, l) => s + l.realizado, 0);
  const desvioTotal = totalRealizado - totalOrcado;
  const desvioPctTotal = totalOrcado > 0 ? (desvioTotal / totalOrcado) * 100 : 0;
  const estouradas = linhas.filter((l) => l.status.includes("Estourado")).length;

  // Chart data grouped by categoria (nome_categoria)
  const chartData = useMemo(() => {
    const map: Record<string, { name: string; orcado: number; realizado: number }> = {};
    linhas.forEach((l) => {
      if (!map[l.categoria]) map[l.categoria] = { name: l.categoria, orcado: 0, realizado: 0 };
      map[l.categoria].orcado += l.orcado;
      map[l.categoria].realizado += l.realizado;
    });
    return Object.values(map).filter((d) => d.orcado > 0 || d.realizado > 0);
  }, [linhas]);

  const handleGerarInsights = async () => {
    setAiLoading(true);
    try {
      const estourados = linhas
        .filter((l) => l.status.includes("Estourado"))
        .map((l) => `${l.plano}: orçado ${fmt(l.orcado)}, realizado ${fmt(l.realizado)}, desvio ${fmt(l.desvioR)}`);

      const prompt = `Analise os seguintes itens que estouraram o orçamento em ${MESES[mes - 1]}/${ano} e sugira ações para redução de custos:\n${estourados.join("\n")}\n\nTotal orçado: ${fmt(totalOrcado)}\nTotal realizado: ${fmt(totalRealizado)}\nDesvio: ${fmt(desvioTotal)} (${desvioPctTotal.toFixed(1)}%)`;

      const result = await invokeEdgeFunction("categorizar-despesa", {
        descricao: prompt,
        valor: desvioTotal,
      });

      setInsights(
        result?.motivo ||
          result?.nome ||
          JSON.stringify(result, null, 2)
      );
    } catch (err: any) {
      toast({ title: "Erro ao gerar insights", description: err.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-3">
        <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESES.map((label, i) => (
              <SelectItem key={i} value={String(i + 1)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[ano - 1, ano, ano + 1].map((a) => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Orçado</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{fmt(totalOrcado)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Realizado</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{fmt(totalRealizado)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Desvio Total</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${desvioTotal > 0 ? "text-destructive" : "text-green-600"}`}>
                  {fmt(desvioTotal)} ({desvioPctTotal.toFixed(1)}%)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Categorias Estouradas</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-destructive">{estouradas}</p></CardContent>
            </Card>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Orçado × Realizado por Categoria</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="orcado" name="Orçado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="realizado" name="Realizado" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.realizado > entry.orcado ? "hsl(0 84% 60%)" : "hsl(142 76% 36%)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Detail Table */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Detalhamento</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faixa</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Plano de conta</TableHead>
                      <TableHead className="text-right">Orçado</TableHead>
                      <TableHead className="text-right">Realizado</TableHead>
                      <TableHead className="text-right">Desvio R$</TableHead>
                      <TableHead className="text-right">Desvio %</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l) => (
                      <TableRow
                        key={l.categoriaId}
                        className={l.status.includes("Estourado") ? "bg-destructive/10" : ""}
                      >
                        <TableCell className="text-muted-foreground">{l.faixa}</TableCell>
                        <TableCell>{l.categoria}</TableCell>
                        <TableCell>{l.plano}</TableCell>
                        <TableCell className="text-right">{fmt(l.orcado)}</TableCell>
                        <TableCell className="text-right">{fmt(l.realizado)}</TableCell>
                        <TableCell className={`text-right ${l.desvioR > 0 ? "text-destructive" : "text-green-600"}`}>
                          {fmt(l.desvioR)}
                        </TableCell>
                        <TableCell className="text-right">{l.desvioPct.toFixed(1)}%</TableCell>
                        <TableCell>{l.status}</TableCell>
                      </TableRow>
                    ))}
                    {linhas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhum dado para o período selecionado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5" /> Insights de IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleGerarInsights} disabled={aiLoading || estouradas === 0}>
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                Gerar insights com IA
              </Button>
              {estouradas === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma categoria estourada — nada para analisar.</p>
              )}
              {insights && (
                <div className="rounded-lg border bg-muted/50 p-4 whitespace-pre-wrap text-sm">
                  {insights}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
