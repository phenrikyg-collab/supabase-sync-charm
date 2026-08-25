import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Repeat, CalendarClock, ChevronDown, ChevronRight, ArrowRight, RefreshCw } from "lucide-react";
import { int, dec, pct } from "@/lib/gestaoFormat";
import { ddmmyyyy } from "@/lib/gestaoFormat";

type TopProduto = {
  tray_product_id: string;
  nome_produto: string;
  clientes: number;
  unidades: number;
  pct_dos_clientes: number;
};

type ProximaCompra = {
  produto_2a_compra_id?: string;
  produto_2a_compra_nome?: string;
  produto_3a_compra_id?: string;
  produto_3a_compra_nome?: string;
  clientes: number;
  media_dias_ate_recompra: number;
};

type Caminho = {
  produto_1a_compra_id?: string;
  produto_1a_compra_nome?: string;
  produto_2a_compra_id?: string;
  produto_2a_compra_nome?: string;
  proximas_compras: ProximaCompra[];
};

type Jornada = {
  gerado_em: string;
  resumo: {
    clientes_1a_compra: number;
    clientes_2a_compra: number;
    clientes_3a_compra: number;
    taxa_recompra_1_para_2_pct: number;
    taxa_recompra_2_para_3_pct: number;
  };
  tempo_entre_compras: {
    primeira_para_segunda: { amostras: number; media_dias: number; mediana_dias: number };
    segunda_para_terceira: { amostras: number; media_dias: number; mediana_dias: number };
  };
  top_produtos_primeira_compra: TopProduto[];
  top_produtos_segunda_compra: TopProduto[];
  top_produtos_terceira_compra: TopProduto[];
  caminho_1a_para_2a_compra: Caminho[];
  caminho_2a_para_3a_compra: Caminho[];
};

function TabelaTop({ dados }: { dados: TopProduto[] }) {
  if (!dados?.length) return <p className="text-sm text-muted-foreground p-4">Sem dados.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead className="text-right">Clientes</TableHead>
          <TableHead className="text-right">Unidades</TableHead>
          <TableHead className="text-right">% dos clientes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dados.map((p, i) => (
          <TableRow key={`${p.tray_product_id}-${i}`}>
            <TableCell className="font-medium">{p.nome_produto}</TableCell>
            <TableCell className="text-right">{int(p.clientes)}</TableCell>
            <TableCell className="text-right">{int(p.unidades)}</TableCell>
            <TableCell className="text-right">{pct(p.pct_dos_clientes)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CaminhoLista({
  dados,
  origem,
  destino,
  medianaGeral,
}: {
  dados: Caminho[];
  origem: "1a" | "2a";
  destino: "2ª compra" | "3ª compra";
  medianaGeral: number;
}) {
  const [abertos, setAbertos] = useState<Record<number, boolean>>({ 0: true });
  if (!dados?.length) return <p className="text-sm text-muted-foreground">Sem dados.</p>;

  return (
    <div className="space-y-2">
      {dados.map((c, idx) => {
        const nome = origem === "1a" ? c.produto_1a_compra_nome : c.produto_2a_compra_nome;
        const aberto = !!abertos[idx];
        const totalClientes = (c.proximas_compras || []).reduce((s, p) => s + (p.clientes || 0), 0);
        return (
          <div key={idx} className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setAbertos((a) => ({ ...a, [idx]: !a[idx] }))}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {nome}
              </span>
              <span className="text-xs text-muted-foreground">
                {int(totalClientes)} clientes seguiram para a {destino}
              </span>
            </button>
            {aberto && (
              <div className="border-t border-border divide-y divide-border">
                {(c.proximas_compras || []).map((p, i) => {
                  const nomeProx = origem === "1a" ? p.produto_2a_compra_nome : p.produto_3a_compra_nome;
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 pl-10 text-sm">
                      <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                      <span className="flex-1 min-w-[180px]">{nomeProx}</span>
                      <span className="text-muted-foreground">{int(p.clientes)} clientes</span>
                      <span
                        className="text-muted-foreground"
                        title={`Mediana geral do intervalo: ${dec(medianaGeral, 0)} dias`}
                      >
                        média {dec(p.media_dias_ate_recompra, 0)} dias
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function JornadaCompra() {
  const [data, setData] = useState<Jornada | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    const { data: res, error } = await supabase.rpc("jornada_compra_produtos_cache" as any);
    if (error) setErro(error.message);
    else setData(res as unknown as Jornada);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const geradoEm = useMemo(() => {
    if (!data?.gerado_em) return "—";
    const d = new Date(data.gerado_em);
    return `${ddmmyyyy(d.toISOString().slice(0, 10))} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-tight">Jornada de Compra por Produto</h1>
          <p className="text-sm text-muted-foreground">
            O que a cliente compra na 1ª, 2ª e 3ª compra — e quanto tempo leva entre elas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      {erro && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">Erro ao carregar: {erro}</CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Clientes com 1ª compra" value={int(data.resumo.clientes_1a_compra)} icon={Users} variant="primary" />
            <StatCard
              title="Clientes com 2ª compra"
              value={int(data.resumo.clientes_2a_compra)}
              subtitle={`Recompra 1→2: ${pct(data.resumo.taxa_recompra_1_para_2_pct)}`}
              icon={Repeat}
              variant="success"
            />
            <StatCard
              title="Clientes com 3ª compra"
              value={int(data.resumo.clientes_3a_compra)}
              subtitle={`Recompra 2→3: ${pct(data.resumo.taxa_recompra_2_para_3_pct)}`}
              icon={Repeat}
              variant="success"
            />
            <StatCard
              title="Mediana 1ª → 2ª compra"
              value={`${dec(data.tempo_entre_compras.primeira_para_segunda.mediana_dias, 0)} dias`}
              subtitle={`Média ${dec(data.tempo_entre_compras.primeira_para_segunda.media_dias, 0)} dias · ${int(
                data.tempo_entre_compras.primeira_para_segunda.amostras,
              )} amostras`}
              icon={CalendarClock}
              variant="warning"
            />
            <StatCard
              title="Mediana 2ª → 3ª compra"
              value={`${dec(data.tempo_entre_compras.segunda_para_terceira.mediana_dias, 0)} dias`}
              subtitle={`Média ${dec(data.tempo_entre_compras.segunda_para_terceira.media_dias, 0)} dias · ${int(
                data.tempo_entre_compras.segunda_para_terceira.amostras,
              )} amostras`}
              icon={CalendarClock}
              variant="warning"
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top produtos por posição na jornada</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="p1">
                <TabsList>
                  <TabsTrigger value="p1">1ª compra</TabsTrigger>
                  <TabsTrigger value="p2">2ª compra</TabsTrigger>
                  <TabsTrigger value="p3">3ª compra</TabsTrigger>
                </TabsList>
                <TabsContent value="p1"><TabelaTop dados={data.top_produtos_primeira_compra} /></TabsContent>
                <TabsContent value="p2"><TabelaTop dados={data.top_produtos_segunda_compra} /></TabsContent>
                <TabsContent value="p3"><TabelaTop dados={data.top_produtos_terceira_compra} /></TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Caminho de recompra</CardTitle>
              <p className="text-xs text-muted-foreground">
                Para cada produto da compra anterior, os produtos mais comprados na compra seguinte. Referência de
                timing: mediana de {dec(data.tempo_entre_compras.primeira_para_segunda.mediana_dias, 0)} dias (1ª→2ª) e{" "}
                {dec(data.tempo_entre_compras.segunda_para_terceira.mediana_dias, 0)} dias (2ª→3ª).
              </p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="c12">
                <TabsList>
                  <TabsTrigger value="c12">1ª → 2ª compra</TabsTrigger>
                  <TabsTrigger value="c23">2ª → 3ª compra</TabsTrigger>
                </TabsList>
                <TabsContent value="c12">
                  <CaminhoLista
                    dados={data.caminho_1a_para_2a_compra}
                    origem="1a"
                    destino="2ª compra"
                    medianaGeral={data.tempo_entre_compras.primeira_para_segunda.mediana_dias}
                  />
                </TabsContent>
                <TabsContent value="c23">
                  <CaminhoLista
                    dados={data.caminho_2a_para_3a_compra}
                    origem="2a"
                    destino="3ª compra"
                    medianaGeral={data.tempo_entre_compras.segunda_para_terceira.mediana_dias}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Dados atualizados diariamente (6h) — última geração: {geradoEm}. Baseado no histórico completo de pedidos
            válidos (não cancelados).
          </p>
        </>
      )}
    </div>
  );
}
