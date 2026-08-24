import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SortableHead, useSortable } from "@/components/SortableHead";
import { brl, int, num, pct } from "@/lib/gestaoFormat";
import {
  BadgeClassificacao, CardMargemContribuicao, CelulaMargemContrib, Variacao, corClassificacao, fundoClassificacao,
} from "@/components/gestao/margemContribuicao";
import { cn } from "@/lib/utils";

const PERIODOS = [7, 30, 90];

function corMargem(p: number) {
  if (p < 40) return "text-red-600";
  if (p <= 55) return "text-amber-600";
  return "text-emerald-600";
}

function Tile({
  titulo, valor, tom = "default",
}: { titulo: string; valor: string; tom?: "default" | "red" | "green" | "muted" }) {
  const cor = tom === "red" ? "text-red-600" : tom === "green" ? "text-emerald-600" : tom === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className={cn("text-2xl font-serif font-bold", cor)}>{valor}</p>
      </CardContent>
    </Card>
  );
}

type SortCampo = "unidades_vendidas" | "receita_total" | "margem_pct" | "lucro_liquido_total" | "lucro_liquido_unitario";

export default function ProdutosLucro() {
  const [dias, setDias] = useState(30);
  const [canal, setCanal] = useState<string>("todos");
  const { sort, alternar } = useSortable<SortCampo>({ key: "lucro_liquido_total", dir: "desc" });

  const { data, isLoading } = useQuery({
    queryKey: ["produtos-lucro", dias, canal],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("produtos_lucro" as any, {
        p_dias: dias,
        p_canal: canal === "todos" ? null : canal,
      });
      if (error) throw error;
      return (data ?? {}) as any;
    },
  });

  const resumo = data?.resumo ?? {};
  const porCanal = useMemo(
    () => [...(data?.por_canal ?? [])].sort((a: any, b: any) => num(b.receita_total) - num(a.receita_total)),
    [data],
  );
  const produtos = useMemo(() => {
    const lista = [...(data?.produtos ?? [])];
    const fator = sort.dir === "asc" ? 1 : -1;
    lista.sort((a: any, b: any) => (num(a[sort.key as string]) - num(b[sort.key as string])) * fator);
    return lista;
  }, [data, sort]);

  const topGrafico = useMemo(
    () =>
      [...(data?.produtos ?? [])]
        .sort((a: any, b: any) => num(b.lucro_liquido_total) - num(a.lucro_liquido_total))
        .slice(0, 12)
        .map((p: any) => ({
          produto: String(p.nome_produto ?? "—").slice(0, 28),
          lucro: num(p.lucro_liquido_total),
        })),
    [data],
  );

  const opcoesCanal = useMemo(
    () => (data?.por_canal ?? []).map((c: any) => String(c.canal ?? "—")),
    [data],
  );

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Produtos × Lucro</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {PERIODOS.map((d) => (
              <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} className="h-9" onClick={() => setDias(d)}>
                {d} dias
              </Button>
            ))}
          </div>
          <Select value={canal} onValueChange={setCanal}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os canais</SelectItem>
              {opcoesCanal.map((c: string) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile titulo="Produtos distintos" valor={int(resumo.produtos_distintos)} />
        <Tile titulo="Unidades vendidas" valor={int(resumo.unidades_vendidas)} />
        <Tile titulo="Receita total" valor={brl(resumo.receita_total)} />
        <Tile titulo="CMV" valor={brl(resumo.cmv_total)} tom="red" />
        <Tile titulo="Frete" valor={brl(resumo.frete_total)} tom="red" />
        <Tile titulo="Embalagem" valor={brl(resumo.embalagem_total)} tom="red" />
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Margem de contribuição</p>
            <p className="text-2xl font-serif font-bold text-emerald-600">{brl(resumo.margem_total)}</p>
            <p className={cn("text-xs font-medium", corMargem(num(resumo.margem_media_pct)))}>
              {pct(resumo.margem_media_pct, 1)} de margem média
            </p>
          </CardContent>
        </Card>
        <Tile titulo="Lucro líquido total" valor={brl(resumo.lucro_liquido_total)} tom="green" />
      </div>

      {/* Canal + gráfico */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Resultado por canal</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table containerClassName="max-h-[70vh]">
              <TableHeader className="sticky top-0 z-20 bg-card">
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Unid.</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">CMV</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                  <TableHead className="text-right">Lucro líq.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCanal.map((c: any) => (
                  <TableRow key={String(c.canal ?? "—")}>
                    <TableCell className="whitespace-nowrap font-medium">{c.canal ?? "—"}</TableCell>
                    <TableCell className="text-right">{int(c.unidades_vendidas)}</TableCell>
                    <TableCell className="text-right">{brl(c.receita_total)}</TableCell>
                    <TableCell className="text-right text-red-600">{brl(c.cmv_total)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{brl(c.margem_total)}</TableCell>
                    <TableCell className={cn("text-right font-medium", corMargem(num(c.margem_media_pct)))}>
                      {pct(c.margem_media_pct, 1)}
                    </TableCell>
                    <TableCell className="text-right">{brl(c.lucro_liquido_total)}</TableCell>
                  </TableRow>
                ))}
                {!porCanal.length && !isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Sem dados no período.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top produtos por lucro líquido</CardTitle></CardHeader>
          <CardContent className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topGrafico} layout="vertical" margin={{ left: 24, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => brl(v, 0)} fontSize={11} />
                <YAxis type="category" dataKey="produto" width={150} fontSize={10} />
                <Tooltip formatter={(v: any) => brl(v)} />
                <Bar dataKey="lucro" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de produtos */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Produtos ({int(produtos.length)})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table containerClassName="max-h-[70vh]">
            <TableHeader className="sticky top-0 z-20 bg-card">
              <TableRow>
                <TableHead>Produto</TableHead>
                <SortableHead campo="unidades_vendidas" sort={sort} onSort={alternar} className="text-right">Unid.</SortableHead>
                <TableHead className="text-right">Preço médio</TableHead>
                <SortableHead campo="receita_total" sort={sort} onSort={alternar} className="text-right">Receita</SortableHead>
                <TableHead className="text-right">CMV</TableHead>
                <TableHead className="text-right">Frete</TableHead>
                <TableHead className="text-right">Embalagem</TableHead>
                <TableHead className="text-right">CAC</TableHead>
                <SortableHead campo="margem_pct" sort={sort} onSort={alternar} className="text-right">Margem %</SortableHead>
                <SortableHead campo="lucro_liquido_total" sort={sort} onSort={alternar} className="text-right">Lucro líq.</SortableHead>
                <SortableHead campo="lucro_liquido_unitario" sort={sort} onSort={alternar} className="text-right">Lucro líq./un.</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((p: any, i: number) => (
                <TableRow key={p.tray_product_id ?? `${p.nome_produto}-${i}`}>
                  <TableCell className="min-w-[220px] font-medium">{p.nome_produto ?? "—"}</TableCell>
                  <TableCell className="text-right">{int(p.unidades_vendidas)}</TableCell>
                  <TableCell className="text-right">{brl(p.preco_medio)}</TableCell>
                  <TableCell className="text-right">{brl(p.receita_total)}</TableCell>
                  <TableCell className="text-right text-red-600">{brl(p.cmv_total)}</TableCell>
                  <TableCell className="text-right">{brl(p.frete_total)}</TableCell>
                  <TableCell className="text-right">{brl(p.embalagem_total)}</TableCell>
                  <TableCell className="text-right">{brl(p.cac_total)}</TableCell>
                  <TableCell className={cn("text-right font-medium", corMargem(num(p.margem_pct)))}>{pct(p.margem_pct, 1)}</TableCell>
                  <TableCell className="text-right">{brl(p.lucro_liquido_total)}</TableCell>
                  <TableCell className={cn("text-right", num(p.lucro_liquido_unitario) < 0 && "text-red-600 font-medium")}>
                    {brl(p.lucro_liquido_unitario)}
                  </TableCell>
                </TableRow>
              ))}
              {!produtos.length && !isLoading && (
                <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground">Sem produtos no período.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Frete e embalagem calculados como se cada peça fosse vendida sozinha — números não somam 1:1 com Pedidos ×
        Lucro. Taxa de gateway, imposto e CAC são rateados pela participação de receita da peça dentro do pedido; o
        preço considerado é o de venda do item antes de descontos do pedido.
      </p>
    </div>
  );
}
