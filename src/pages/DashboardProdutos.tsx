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
import { Loader2, Search, AlertTriangle, PauseCircle, Info, Circle } from "lucide-react";
import { formatarData } from "@/utils/formatters";
import { SortableHead, useSortable, useOrdenado } from "@/components/SortableHead";
import { FiltroPeriodo, Periodo } from "@/components/recuperacao/FiltroPeriodo";


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

type SugestaoCor = {
  produto_id: string;
  nome: string;
  cor: string | null;
  percentual_vendas_cor: number | null;
  estoque_cor: number | null;
  sugestao_produzir_cor: number | null;
  eh_preto: boolean | null;
};

type ItemEstrategico = {
  produto_id: string;
  nome: string;
  receita_total: number | null;
  unidades_vendidas: number | null;
  preco_medio: number | null;
  margem_contribuicao_pct: number | null;
  estoque_atual: number | null;
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
type BaixaRotatividadeResumo = {
  total_produtos: number | null;
  total_unidades: number | null;
  custo_total_estoque: number | null;
  valor_total_venda_potencial: number | null;
  margem_total_potencial: number | null;
};

type BaixaRotatividadeItem = {
  produto_id: string;
  nome: string;
  unidades_em_estoque: number | null;
  custo_unitario: number | null;
  preco_venda_unitario: number | null;
  custo_total_estoque: number | null;
  valor_total_venda_potencial: number | null;
  margem_pct: number | null;
  margem_total_potencial: number | null;
  unidades_vendidas_90d: number | null;
  ultima_venda: string | null;
  data_cadastro: string | null;
  meses_de_cobertura_estoque: number | null;
  classe_abc: string | null;
};


const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));
const fmtInt = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR").format(Math.round(Number(n ?? 0)));
const fmtPct = (n: number | null | undefined) => `${Number(n ?? 0).toFixed(2)}%`;

const badgeClasse = (classe: string) => {
  if (classe === "A") return "bg-[hsl(142_60%_40%)] text-white hover:bg-[hsl(142_60%_40%)]";
  if (classe === "B") return "bg-[hsl(38_92%_50%)] text-black hover:bg-[hsl(38_92%_50%)]";
  return "bg-muted text-muted-foreground hover:bg-muted";
};

const corMargem = (pct: number | null | undefined) => {
  const v = Number(pct ?? 0);
  if (v >= 60) return "text-[hsl(142_60%_35%)] font-semibold";
  if (v >= 40) return "text-[hsl(38_92%_40%)] font-semibold";
  return "text-destructive font-semibold";
};

type ChaveABC = "nome" | "classe_abc" | "receita_total" | "percentual_receita" | "unidades_vendidas" | "estoque_atual" | "ultima_venda";
type ChaveBaixaRot = "nome" | "unidades_em_estoque" | "custo_unitario" | "preco_venda_unitario" | "custo_total_estoque" | "margem_pct" | "unidades_vendidas_90d" | "meses_de_cobertura_estoque" | "ultima_venda";
type ChaveCor = "nome" | "cor" | "percentual_vendas_cor" | "estoque_cor" | "sugestao_produzir_cor";
type ChaveEstrat = "nome" | "receita_total" | "unidades_vendidas" | "preco_medio" | "margem_contribuicao_pct" | "estoque_atual";

export default function DashboardProdutos() {
  const [filtroClasse, setFiltroClasse] = useState<"todas" | "A" | "B" | "C">("todas");
  const [buscaTabela, setBuscaTabela] = useState("");
  const [buscaEstoque, setBuscaEstoque] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>({ inicio: null, fim: null });

  const { data: abc = [], isLoading } = useQuery({
    queryKey: ["fn_curva_abc_produtos", periodo.inicio, periodo.fim],
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_curva_abc_produtos" as any, {
        p_data_inicio: periodo.inicio,
        p_data_fim: periodo.fim,
      });
      if (error) throw error;
      const linhas = ((data ?? []) as unknown as CurvaABC[]).slice();
      linhas.sort((a, b) => Number(b.receita_total ?? 0) - Number(a.receita_total ?? 0));
      return linhas;
    },
  });


  const { data: sugestoes = [], isLoading: loadingSug } = useQuery({
    queryKey: ["vw_sugestao_producao_por_cor"],
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_sugestao_producao_por_cor" as any)
        .select("*")
        .order("sugestao_produzir_cor", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SugestaoCor[];
    },
  });

  const { data: itensEstrategicos = [], isLoading: loadingItens } = useQuery({
    queryKey: ["vw_itens_estrategicos"],
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_itens_estrategicos" as any)
        .select("*")
        .order("receita_total", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ItemEstrategico[];
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

  const { data: baixaRotResumo } = useQuery({
    queryKey: ["vw_produtos_baixa_rotatividade_resumo"],
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_produtos_baixa_rotatividade_resumo" as any)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as BaixaRotatividadeResumo | null;
    },
  });

  const { data: baixaRotItens = [], isLoading: loadingBaixaRot } = useQuery({
    queryKey: ["vw_produtos_baixa_rotatividade"],
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_produtos_baixa_rotatividade" as any)
        .select("*")
        .order("custo_total_estoque", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BaixaRotatividadeItem[];
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

  const sortAbc = useSortable<ChaveABC>({ key: "receita_total", dir: "desc" });
  const abcOrdenada = useOrdenado<CurvaABC, ChaveABC>(abcFiltrada, sortAbc.sort, {
    nome: (p) => p.nome,
    classe_abc: (p) => p.classe_abc,
    receita_total: (p) => Number(p.receita_total ?? 0),
    percentual_receita: (p) => Number(p.percentual_receita ?? 0),
    unidades_vendidas: (p) => Number(p.unidades_vendidas ?? 0),
    estoque_atual: (p) => Number(p.estoque_atual ?? 0),
    ultima_venda: (p) => p.ultima_venda ?? "",
  });

  const sortCor = useSortable<ChaveCor>({ key: "sugestao_produzir_cor", dir: "desc" });
  const sugestoesOrdenadas = useOrdenado<SugestaoCor, ChaveCor>(
    sugestoes,
    sortCor.sort,
    {
      nome: (s) => s.nome,
      cor: (s) => s.cor ?? "",
      percentual_vendas_cor: (s) => Number(s.percentual_vendas_cor ?? 0),
      estoque_cor: (s) => Number(s.estoque_cor ?? 0),
      sugestao_produzir_cor: (s) => Number(s.sugestao_produzir_cor ?? 0),
    },
    // preto sempre no topo
    (a, b) => Number(!!b.eh_preto) - Number(!!a.eh_preto)
  );

  const sortEstrat = useSortable<ChaveEstrat>({ key: "receita_total", dir: "desc" });
  const itensOrdenados = useOrdenado<ItemEstrategico, ChaveEstrat>(itensEstrategicos, sortEstrat.sort, {
    nome: (p) => p.nome,
    receita_total: (p) => Number(p.receita_total ?? 0),
    unidades_vendidas: (p) => Number(p.unidades_vendidas ?? 0),
    preco_medio: (p) => Number(p.preco_medio ?? 0),
    margem_contribuicao_pct: (p) => Number(p.margem_contribuicao_pct ?? 0),
    estoque_atual: (p) => Number(p.estoque_atual ?? 0),
  });

  const sortBaixaRot = useSortable<ChaveBaixaRot>({ key: "custo_total_estoque", dir: "desc" });
  const baixaRotOrdenada = useOrdenado<BaixaRotatividadeItem, ChaveBaixaRot>(baixaRotItens, sortBaixaRot.sort, {
    nome: (p) => p.nome,
    unidades_em_estoque: (p) => Number(p.unidades_em_estoque ?? 0),
    custo_unitario: (p) => Number(p.custo_unitario ?? 0),
    preco_venda_unitario: (p) => Number(p.preco_venda_unitario ?? 0),
    custo_total_estoque: (p) => Number(p.custo_total_estoque ?? 0),
    margem_pct: (p) => Number(p.margem_pct ?? 0),
    unidades_vendidas_90d: (p) => Number(p.unidades_vendidas_90d ?? 0),
    meses_de_cobertura_estoque: (p) => p.meses_de_cobertura_estoque,
    ultima_venda: (p) => p.ultima_venda,
  });

  const consultaEstoque = useMemo(() => {
    const q = buscaEstoque.trim().toLowerCase();
    if (!q) return [];
    return abc.filter((p) => (p.nome ?? "").toLowerCase().includes(q)).slice(0, 20);
  }, [abc, buscaEstoque]);

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
          Curva ABC, sugestão de produção por cor e itens estratégicos
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2">
          <FiltroPeriodo periodo={periodo} onChange={setPeriodo} />
          <p className="text-[11px] text-muted-foreground">
            A Curva ABC é recalculada para o período selecionado. Sugestão de Produção e Itens Estratégicos usam o histórico completo.
          </p>
        </CardContent>
      </Card>



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

      {/* Produtos com Baixa Rotatividade */}
      <Card className="border-[hsl(38_92%_50%)]/40">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PauseCircle className="h-4 w-4 text-[hsl(38_92%_45%)]" />
            Produtos com Baixa Rotatividade
          </CardTitle>
          <Badge variant="destructive" className="text-[10px]">
            {fmtInt(baixaRotItens.filter((p) => p.meses_de_cobertura_estoque == null || Number(p.meses_de_cobertura_estoque) > 12).length)} casos urgentes
          </Badge>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-2xl font-bold">{fmtMoney(baixaRotResumo?.custo_total_estoque)}</p>
          <p className="text-xs text-muted-foreground">Capital parado em estoque</p>
          <p className="text-xs text-muted-foreground">
            {fmtInt(baixaRotResumo?.total_produtos)} produtos · {fmtInt(baixaRotResumo?.total_unidades)} unidades
          </p>
          <p className="text-xs text-muted-foreground">
            {fmtMoney(baixaRotResumo?.margem_total_potencial)} · Margem recuperada se vendido a preço cheio
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            {fmtMoney(baixaRotResumo?.valor_total_venda_potencial)} · valor de venda total se tudo vendesse
          </p>
        </CardContent>
      </Card>



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
                    <SortableHead campo="nome" sort={sortAbc.sort} onSort={sortAbc.alternar}>Produto</SortableHead>
                    <SortableHead campo="classe_abc" sort={sortAbc.sort} onSort={sortAbc.alternar}>Classe</SortableHead>
                    <SortableHead campo="receita_total" sort={sortAbc.sort} onSort={sortAbc.alternar} className="text-right">Receita</SortableHead>
                    <SortableHead campo="percentual_receita" sort={sortAbc.sort} onSort={sortAbc.alternar} className="text-right">% Receita</SortableHead>
                    <SortableHead campo="unidades_vendidas" sort={sortAbc.sort} onSort={sortAbc.alternar} className="text-right">Unidades</SortableHead>
                    <SortableHead campo="estoque_atual" sort={sortAbc.sort} onSort={sortAbc.alternar} className="text-right">Estoque</SortableHead>
                    <SortableHead campo="ultima_venda" sort={sortAbc.sort} onSort={sortAbc.alternar}>Última venda</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abcOrdenada.map((p) => (
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
                  {abcOrdenada.length === 0 && (
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

      {/* Sugestão de Produção por cor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sugestão de Produção por Cor</CardTitle>
          <p className="text-xs text-muted-foreground">
            Distribuição histórica de vendas por cor — o preto aparece sempre no topo
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingSug ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : sugestoesOrdenadas.length === 0 ? (
            <div className="flex items-start gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5" />
              Cadastre a meta do mês para ver sugestões de produção.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead campo="nome" sort={sortCor.sort} onSort={sortCor.alternar}>Produto</SortableHead>
                    <SortableHead campo="cor" sort={sortCor.sort} onSort={sortCor.alternar}>Cor</SortableHead>
                    <SortableHead campo="percentual_vendas_cor" sort={sortCor.sort} onSort={sortCor.alternar} className="text-right">% vendas da cor</SortableHead>
                    <SortableHead campo="estoque_cor" sort={sortCor.sort} onSort={sortCor.alternar} className="text-right">Estoque da cor</SortableHead>
                    <SortableHead campo="sugestao_produzir_cor" sort={sortCor.sort} onSort={sortCor.alternar} className="text-right">Produzir</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sugestoesOrdenadas.map((s, i) => (
                    <TableRow
                      key={`${s.produto_id}-${s.cor}-${i}`}
                      className={s.eh_preto ? "bg-muted/60" : undefined}
                    >
                      <TableCell className="font-medium">{s.nome}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          {s.eh_preto && <Circle className="h-3 w-3 fill-foreground text-foreground" />}
                          <span className={s.eh_preto ? "font-semibold" : undefined}>{s.cor ?? "—"}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{fmtPct(s.percentual_vendas_cor)}</TableCell>
                      <TableCell className="text-right">{fmtInt(s.estoque_cor)}</TableCell>
                      <TableCell
                        className={`text-right ${
                          Number(s.sugestao_produzir_cor) > 0
                            ? "font-bold text-[hsl(25_90%_45%)]"
                            : "text-muted-foreground"
                        }`}
                      >
                        {fmtInt(s.sugestao_produzir_cor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
          <p className="text-xs text-muted-foreground">
            Produtos que mais pesam no resultado, com margem de contribuição
          </p>
        </CardHeader>
        <CardContent>
          {loadingItens ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead campo="nome" sort={sortEstrat.sort} onSort={sortEstrat.alternar}>Produto</SortableHead>
                    <SortableHead campo="receita_total" sort={sortEstrat.sort} onSort={sortEstrat.alternar} className="text-right">Receita</SortableHead>
                    <SortableHead campo="unidades_vendidas" sort={sortEstrat.sort} onSort={sortEstrat.alternar} className="text-right">Unidades</SortableHead>
                    <SortableHead campo="preco_medio" sort={sortEstrat.sort} onSort={sortEstrat.alternar} className="text-right">Preço médio</SortableHead>
                    <SortableHead campo="margem_contribuicao_pct" sort={sortEstrat.sort} onSort={sortEstrat.alternar} className="text-right">Margem contrib.</SortableHead>
                    <SortableHead campo="estoque_atual" sort={sortEstrat.sort} onSort={sortEstrat.alternar} className="text-right">Estoque</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensOrdenados.map((p) => (
                    <TableRow key={p.produto_id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell className="text-right">{fmtMoney(p.receita_total)}</TableCell>
                      <TableCell className="text-right">{fmtInt(p.unidades_vendidas)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(p.preco_medio)}</TableCell>
                      <TableCell className={`text-right ${corMargem(p.margem_contribuicao_pct)}`}>
                        {fmtPct(p.margem_contribuicao_pct)}
                      </TableCell>
                      <TableCell className="text-right">{fmtInt(p.estoque_atual)}</TableCell>
                    </TableRow>
                  ))}
                  {itensOrdenados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum item estratégico encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas de Estoque */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas de Estoque</CardTitle>
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
                <TabsTrigger value="parado180">
                  <PauseCircle className="h-3.5 w-3.5 mr-1 text-[hsl(38_92%_45%)]" />
                  Baixa Rotatividade ({baixaRotItens.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="parado180" className="mt-4">
                {loadingBaixaRot ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[420px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableHead campo="nome" sort={sortBaixaRot.sort} onSort={sortBaixaRot.alternar}>Produto</SortableHead>
                          <SortableHead campo="unidades_em_estoque" sort={sortBaixaRot.sort} onSort={sortBaixaRot.alternar} className="text-right">Unid. estoque</SortableHead>
                          <SortableHead campo="custo_unitario" sort={sortBaixaRot.sort} onSort={sortBaixaRot.alternar} className="text-right">Custo unit.</SortableHead>
                          <SortableHead campo="preco_venda_unitario" sort={sortBaixaRot.sort} onSort={sortBaixaRot.alternar} className="text-right">Preço venda</SortableHead>
                          <SortableHead campo="margem_pct" sort={sortBaixaRot.sort} onSort={sortBaixaRot.alternar} className="text-right">Margem %</SortableHead>
                          <SortableHead campo="unidades_vendidas_90d" sort={sortBaixaRot.sort} onSort={sortBaixaRot.alternar} className="text-right">Vendas 90d</SortableHead>
                          <SortableHead campo="meses_de_cobertura_estoque" sort={sortBaixaRot.sort} onSort={sortBaixaRot.alternar} className="text-right">Meses cobertura</SortableHead>
                          <SortableHead campo="ultima_venda" sort={sortBaixaRot.sort} onSort={sortBaixaRot.alternar}>Última venda</SortableHead>
                          <SortableHead campo="custo_total_estoque" sort={sortBaixaRot.sort} onSort={sortBaixaRot.alternar} className="text-right">Capital parado</SortableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {baixaRotOrdenada.map((p) => {
                          const urgente = p.meses_de_cobertura_estoque == null || Number(p.meses_de_cobertura_estoque) > 12;
                          return (
                            <TableRow key={p.produto_id} className={urgente ? "bg-destructive/5" : undefined}>
                              <TableCell className="font-medium">{p.nome}</TableCell>
                              <TableCell className="text-right">{fmtInt(p.unidades_em_estoque)}</TableCell>
                              <TableCell className="text-right">{fmtMoney(p.custo_unitario)}</TableCell>
                              <TableCell className="text-right">{fmtMoney(p.preco_venda_unitario)}</TableCell>
                              <TableCell className={`text-right ${corMargem(p.margem_pct)}`}>{fmtPct(p.margem_pct)}</TableCell>
                              <TableCell className="text-right">{fmtInt(p.unidades_vendidas_90d)}</TableCell>
                              <TableCell className="text-right">
                                {p.meses_de_cobertura_estoque == null ? (
                                  <Badge variant="destructive" className="text-[10px]">Sem venda no período</Badge>
                                ) : (
                                  <Badge
                                    variant={Number(p.meses_de_cobertura_estoque) > 12 ? "destructive" : "secondary"}
                                    className="text-[10px]"
                                  >
                                    {Number(p.meses_de_cobertura_estoque).toFixed(1)} meses
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {p.ultima_venda ? (
                                  formatarData(p.ultima_venda)
                                ) : (
                                  <span className="text-muted-foreground">
                                    nunca vendeu{p.data_cadastro ? ` · cadastro ${formatarData(p.data_cadastro)}` : ""}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold">{fmtMoney(p.custo_total_estoque)}</TableCell>
                            </TableRow>
                          );
                        })}
                        {baixaRotOrdenada.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                              Nenhum produto com baixa rotatividade
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>



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
