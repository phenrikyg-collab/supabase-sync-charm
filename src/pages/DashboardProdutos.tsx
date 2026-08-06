import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Search, AlertTriangle, PauseCircle, Info } from "lucide-react";
import { formatarData } from "@/utils/formatters";

type CurvaABC = {
  produto_id: string;
  nome: string;
  available: boolean | null;
  unidades_vendidas: number;
  receita_total: number;
  preco_medio: number;
  ultima_venda: string | null;
  estoque_atual: number;
  percentual_receita: number;
  percentual_acumulado: number;
  classe_abc: "A" | "B" | "C";
};

type SugestaoProducao = {
  produto_id: string;
  nome: string;
  classe_abc: string;
  mes: string;
  estoque_atual: number;
  quantidade_necessaria_mes: number;
  sugestao_produzir: number;
};

type EstoqueEstrategico = {
  produto_id: string;
  nome: string;
  classe_abc: string;
  estoque_atual: number;
  ultima_venda: string | null;
  dias_cobertura_estoque: number | null;
  risco_ruptura: boolean;
  estoque_parado: boolean;
};

const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));
const fmtInt = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR").format(Math.round(Number(n ?? 0)));
const fmtPct = (n: number | null | undefined) => `${Number(n ?? 0).toFixed(2)}%`;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const fmtMes = (mes: string | null) => {
  if (!mes) return "—";
  const [ano, m] = mes.split("-");
  const idx = Number(m) - 1;
  return MESES[idx] ? `${MESES[idx]}/${ano}` : mes;
};

const badgeClasse = (classe: string) => {
  if (classe === "A") return "bg-[hsl(142_60%_40%)] text-white hover:bg-[hsl(142_60%_40%)]";
  if (classe === "B") return "bg-[hsl(38_92%_50%)] text-black hover:bg-[hsl(38_92%_50%)]";
  return "bg-muted text-muted-foreground hover:bg-muted";
};

export default function DashboardProdutos() {
  const [filtroClasse, setFiltroClasse] = useState<"todas" | "A" | "B" | "C">("todas");
  const [buscaTabela, setBuscaTabela] = useState("");
  const [buscaEstoque, setBuscaEstoque] = useState("");

  const { data: abc = [], isLoading } = useQuery({
    queryKey: ["vw_curva_abc_produtos"],
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_curva_abc_produtos" as any)
        .select("*")
        .order("receita_total", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CurvaABC[];
    },
  });

  const { data: sugestoes = [], isLoading: loadingSug } = useQuery({
    queryKey: ["vw_sugestao_producao"],
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_sugestao_producao" as any)
        .select("*")
        .order("sugestao_produzir", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SugestaoProducao[];
    },
  });

  const { data: estrategico = [], isLoading: loadingEstrat } = useQuery({
    queryKey: ["vw_estoque_estrategico"],
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_estoque_estrategico" as any)
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as EstoqueEstrategico[];
    },
  });

  const resumoClasses = useMemo(() => {
    const base: Record<string, { produtos: number; receita: number; pct: number }> = {
      A: { produtos: 0, receita: 0, pct: 0 },
      B: { produtos: 0, receita: 0, pct: 0 },
      C: { produtos: 0, receita: 0, pct: 0 },
    };
    abc.forEach((p) => {
      const c = base[p.classe_abc];
      if (!c) return;
      c.produtos += 1;
      c.receita += Number(p.receita_total ?? 0);
      c.pct += Number(p.percentual_receita ?? 0);
    });
    return base;
  }, [abc]);

  const abcFiltrada = useMemo(() => {
    const q = buscaTabela.trim().toLowerCase();
    return abc.filter(
      (p) =>
        (filtroClasse === "todas" || p.classe_abc === filtroClasse) &&
        (!q || (p.nome ?? "").toLowerCase().includes(q))
    );
  }, [abc, filtroClasse, buscaTabela]);

  const consultaEstoque = useMemo(() => {
    const q = buscaEstoque.trim().toLowerCase();
    if (!q) return [];
    return abc.filter((p) => (p.nome ?? "").toLowerCase().includes(q)).slice(0, 20);
  }, [abc, buscaEstoque]);

  const mesesSugestao = useMemo(
    () => Array.from(new Set(sugestoes.map((s) => s.mes))).sort(),
    [sugestoes]
  );

  const ruptura = useMemo(
    () =>
      estrategico
        .filter((e) => e.risco_ruptura)
        .sort((a, b) => Number(a.dias_cobertura_estoque ?? 0) - Number(b.dias_cobertura_estoque ?? 0)),
    [estrategico]
  );
  const parado = useMemo(
    () => estrategico.filter((e) => e.estoque_parado).sort((a, b) => Number(b.estoque_atual) - Number(a.estoque_atual)),
    [estrategico]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-3xl font-serif font-bold text-foreground">
          Dashboard de <span className="text-primary">Produtos</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Curva ABC, sugestão de produção e itens estratégicos de estoque
        </p>
      </div>

      {/* Cards resumo ABC */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(["A", "B", "C"] as const).map((c) => (
          <Card key={c}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Badge className={badgeClasse(c)}>Classe {c}</Badge>
                <span className="text-muted-foreground text-xs">
                  {fmtInt(resumoClasses[c].produtos)} produtos
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{fmtPct(resumoClasses[c].pct)}</p>
              <p className="text-xs text-muted-foreground">
                da receita · {fmtMoney(resumoClasses[c].receita)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Curva ABC */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">Curva ABC de Produtos</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Tabs value={filtroClasse} onValueChange={(v) => setFiltroClasse(v as any)}>
              <TabsList>
                <TabsTrigger value="todas">Todas</TabsTrigger>
                <TabsTrigger value="A">A</TabsTrigger>
                <TabsTrigger value="B">B</TabsTrigger>
                <TabsTrigger value="C">C</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto"
                value={buscaTabela}
                onChange={(e) => setBuscaTabela(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">% Receita</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead>Última venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abcFiltrada.map((p) => (
                    <TableRow key={p.produto_id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>
                        <Badge className={badgeClasse(p.classe_abc)}>{p.classe_abc}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmtMoney(p.receita_total)}</TableCell>
                      <TableCell className="text-right">{fmtPct(p.percentual_receita)}</TableCell>
                      <TableCell className="text-right">{fmtInt(p.unidades_vendidas)}</TableCell>
                      <TableCell className="text-right">{fmtInt(p.estoque_atual)}</TableCell>
                      <TableCell>{formatarData(p.ultima_venda)}</TableCell>
                    </TableRow>
                  ))}
                  {abcFiltrada.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum produto encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sugestão de Produção */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sugestão de Produção</CardTitle>
          <p className="text-xs text-muted-foreground">
            Produtos classe A/B disponíveis, cruzados com a meta financeira do mês
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingSug ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : sugestoes.length === 0 ? (
            <div className="flex items-start gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5" />
              Cadastre a meta do mês para ver sugestões de produção.
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Meses com meta cadastrada: {mesesSugestao.map(fmtMes).join(", ")}
              </p>
              <div className="overflow-x-auto max-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Estoque atual</TableHead>
                      <TableHead className="text-right">Necessário no mês</TableHead>
                      <TableHead className="text-right">Produzir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sugestoes.map((s, i) => (
                      <TableRow key={`${s.produto_id}-${s.mes}-${i}`}>
                        <TableCell className="font-medium">{s.nome}</TableCell>
                        <TableCell>{fmtMes(s.mes)}</TableCell>
                        <TableCell className="text-right">{fmtInt(s.estoque_atual)}</TableCell>
                        <TableCell className="text-right">{fmtInt(s.quantidade_necessaria_mes)}</TableCell>
                        <TableCell
                          className={`text-right ${
                            Number(s.sugestao_produzir) > 0
                              ? "font-bold text-[hsl(25_90%_45%)]"
                              : "text-muted-foreground"
                          }`}
                        >
                          {fmtInt(s.sugestao_produzir)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Consulta de Estoque */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consulta de Estoque</CardTitle>
          <p className="text-xs text-muted-foreground">
            Busque pelo nome do produto para ver disponibilidade e classe
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ex.: Calça Skinny"
              value={buscaEstoque}
              onChange={(e) => setBuscaEstoque(e.target.value)}
              className="pl-8"
            />
          </div>
          {buscaEstoque.trim() && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead className="text-right">Estoque atual</TableHead>
                    <TableHead>Última venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consultaEstoque.map((p) => (
                    <TableRow key={p.produto_id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>
                        <Badge className={badgeClasse(p.classe_abc)}>{p.classe_abc}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmtInt(p.estoque_atual)}</TableCell>
                      <TableCell>{formatarData(p.ultima_venda)}</TableCell>
                    </TableRow>
                  ))}
                  {consultaEstoque.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        Nenhum produto encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Itens Estratégicos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens Estratégicos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEstrat ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="ruptura">
              <TabsList>
                <TabsTrigger value="ruptura">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1 text-destructive" />
                  Risco de Ruptura ({ruptura.length})
                </TabsTrigger>
                <TabsTrigger value="parado">
                  <PauseCircle className="h-3.5 w-3.5 mr-1 text-[hsl(38_92%_45%)]" />
                  Estoque Parado ({parado.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ruptura" className="mt-4">
                <div className="overflow-x-auto max-h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Estoque atual</TableHead>
                        <TableHead className="text-right">Dias de cobertura</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ruptura.map((p) => (
                        <TableRow key={p.produto_id}>
                          <TableCell className="font-medium">{p.nome}</TableCell>
                          <TableCell className="text-right">{fmtInt(p.estoque_atual)}</TableCell>
                          <TableCell className="text-right font-semibold text-destructive">
                            {Number(p.dias_cobertura_estoque ?? 0).toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {ruptura.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                            Nenhum produto em risco de ruptura
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="parado" className="mt-4 space-y-3">
                <div className="flex justify-end">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/produtos-campanha">Criar ação de liquidação</Link>
                  </Button>
                </div>
                <div className="overflow-x-auto max-h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Estoque atual</TableHead>
                        <TableHead>Última venda</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parado.map((p) => (
                        <TableRow key={p.produto_id}>
                          <TableCell className="font-medium">{p.nome}</TableCell>
                          <TableCell className="text-right">{fmtInt(p.estoque_atual)}</TableCell>
                          <TableCell>
                            {p.ultima_venda ? formatarData(p.ultima_venda) : "nunca vendeu"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {parado.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                            Nenhum produto parado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
