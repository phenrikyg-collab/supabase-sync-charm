import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FiltroPeriodo, Periodo, periodoUltimosDias } from "@/components/recuperacao/FiltroPeriodo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Target, Loader2, TrendingDown, MousePointerClick, LogOut } from "lucide-react";
import AnaliseDiariaTab from "@/components/kpis/AnaliseDiariaTab";

type Row = Record<string, any>;

const num = (v: any) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const fmt = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v));
const pct = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString("pt-BR")}%`;

/** Converte "YYYY-MM-DD" (ou Date) para "YYYYMMDD" usado nas views GA4. */
function paraGa4(data: string | Date | null) {
  if (!data) return null;
  const iso = typeof data === "string" ? data : data.toISOString();
  return iso.slice(0, 10).replace(/-/g, "");
}

/** Escolhe a primeira chave existente na linha entre os candidatos. */
function pega(row: Row | undefined, candidatos: string[]) {
  if (!row) return 0;
  for (const c of candidatos) {
    if (row[c] !== undefined && row[c] !== null) return num(row[c]);
  }
  return 0;
}

const ETAPAS: { label: string; keys: string[] }[] = [
  { label: "Sessões", keys: ["sessoes", "sessions", "total_sessoes", "sessoes_totais", "inicio_sessao"] },
  { label: "Visualização de Produto", keys: ["visualizou_produto", "visualizacao_produto", "view_item", "product_view", "visualizacoes_produto"] },
  { label: "Carrinho", keys: ["adicionou_carrinho", "carrinho", "add_to_cart"] },
  { label: "Checkout", keys: ["iniciou_pagamento", "checkout", "begin_checkout", "checkout_start", "checkouts"] },
  { label: "Compra", keys: ["comprou", "compra", "compras", "purchase", "purchases"] },
];


export default function KpisConversao() {
  const [periodo, setPeriodo] = useState<Periodo>(periodoUltimosDias(30));
  const de = paraGa4(periodo.inicio);
  const ate = paraGa4(periodo.fim);

  const regua = useQuery({
    queryKey: ["vw_regua_conversao", de, ate],
    queryFn: async () => {
      let q = supabase.from("vw_regua_conversao" as any).select("*");
      if (de) q = q.gte("event_date", de);
      if (ate) q = q.lte("event_date", ate);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const perdas = useQuery({
    queryKey: ["vw_funil_perdas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_funil_perdas" as any).select("*");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const canais = useQuery({
    queryKey: ["vw_sessoes_canal", de, ate],
    queryFn: async () => {
      let q = supabase.from("vw_sessoes_canal" as any).select("*");
      if (de) q = q.gte("event_date", de);
      if (ate) q = q.lte("event_date", ate);
      const { data, error } = await q;
      if (error) {
        const { data: d2 } = await supabase.from("vw_sessoes_canal" as any).select("*");
        return (d2 ?? []) as Row[];
      }
      return (data ?? []) as Row[];
    },
  });

  const paginas = useQuery({
    queryKey: ["vw_paginas_mais_acessadas", de, ate],
    queryFn: async () => {
      let q = supabase.from("vw_paginas_mais_acessadas" as any).select("*");
      if (de) q = q.gte("event_date", de);
      if (ate) q = q.lte("event_date", ate);
      const { data, error } = await q;
      if (error) {
        const { data: d2 } = await supabase.from("vw_paginas_mais_acessadas" as any).select("*");
        return (d2 ?? []) as Row[];
      }
      return (data ?? []) as Row[];
    },
  });

  const semEngajamento = useQuery({
    queryKey: ["vw_sessoes_sem_engajamento"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_sessoes_sem_engajamento" as any).select("*");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const saidas = useQuery({
    queryKey: ["vw_paginas_de_saida"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_paginas_de_saida" as any).select("*");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const funil = useMemo(() => {
    const linhas = regua.data ?? [];
    const totais = ETAPAS.map((e) => linhas.reduce((s, r) => s + pega(r, e.keys), 0));
    const base = totais[0] || Math.max(...totais, 1);
    return ETAPAS.map((e, i) => ({
      label: e.label,
      valor: totais[i],
      largura: totais[i] > 0 ? Math.max((totais[i] / base) * 100, 3) : 0,
      passagem: i === 0 ? null : totais[i - 1] > 0 ? (totais[i] / totais[i - 1]) * 100 : 0,
    }));
  }, [regua.data]);

  const perdasOrdenadas = useMemo(
    () => [...(perdas.data ?? [])].sort((a, b) => pega(b, ["perda_relativa_pct", "perda_relativa"]) - pega(a, ["perda_relativa_pct", "perda_relativa"])),
    [perdas.data],
  );
  const prioridade = perdasOrdenadas[0];


  const canaisAgg = useMemo(() => {
    const mapa = new Map<string, { canal: string; sessoes: number; usuarios: number; novos: number }>();
    (canais.data ?? []).forEach((r) => {
      const canal = String(r.canal ?? r.channel ?? r.origem ?? "—");
      const atual = mapa.get(canal) ?? { canal, sessoes: 0, usuarios: 0, novos: 0 };
      atual.sessoes += pega(r, ["sessoes", "sessions"]);
      atual.usuarios += pega(r, ["usuarios", "users", "total_users"]);
      atual.novos += pega(r, ["novos_usuarios", "new_users", "novos"]);
      mapa.set(canal, atual);
    });
    return [...mapa.values()].sort((a, b) => b.sessoes - a.sessoes);
  }, [canais.data]);

  const paginasAgg = useMemo(() => {
    const mapa = new Map<string, { pagina: string; titulo: string; sessoes: number }>();
    (paginas.data ?? []).forEach((r) => {
      const pagina = String(r.pagina ?? r.page_path ?? r.url ?? "—");
      const atual = mapa.get(pagina) ?? {
        pagina,
        titulo: String(r.titulo ?? r.titulo_pagina ?? r.page_title ?? ""),
        sessoes: 0,
      };
      atual.sessoes += pega(r, ["total_sessoes", "sessoes", "sessions", "views", "visualizacoes"]);
      mapa.set(pagina, atual);
    });
    return [...mapa.values()].sort((a, b) => b.sessoes - a.sessoes).slice(0, 50);
  }, [paginas.data]);

  const totalSemEngajamento = useMemo(() => {
    const linhas = semEngajamento.data ?? [];
    if (linhas.length === 1) {
      const v = pega(linhas[0], ["sessoes_sem_engajamento", "total", "sessoes", "qtd"]);
      if (v) return v;
    }
    const soma = linhas.reduce((s, r) => s + pega(r, ["sessoes_sem_engajamento", "sessoes", "qtd"]), 0);
    return soma || linhas.length;
  }, [semEngajamento.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">KPIs de Conversão</h1>
          <p className="text-sm text-muted-foreground">
            Régua completa do anúncio até a compra, com o gargalo prioritário do período.
          </p>
        </div>
        <FiltroPeriodo periodo={periodo} onChange={setPeriodo} />
      </div>

      <Tabs defaultValue="regua" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="regua">Régua de Conversão</TabsTrigger>
          <TabsTrigger value="analise">Análise Diária</TabsTrigger>
        </TabsList>

        <TabsContent value="regua" className="space-y-6">
          {/* Maior oportunidade */}
          <Card className="rounded-xl border-primary/40 bg-primary/5 p-5">
            {perdas.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : !prioridade ? (
              <p className="text-sm text-muted-foreground">Sem dados de perdas do funil.</p>
            ) : (
              <div className="flex flex-wrap items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">
                    🎯 Maior oportunidade: {String(prioridade.etapa ?? "—")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    De cada 100 pessoas nessa etapa, só{" "}
                    <strong className="text-foreground">
                      {pct(pega(prioridade, ["taxa_passagem_pct", "taxa_passagem"]))}
                    </strong>{" "}
                    avançam — uma pequena melhoria aqui vale mais que aumentar verba de anúncio.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Perda relativa</p>
                  <p className="font-serif text-3xl font-bold text-danger">
                    {pct(pega(prioridade, ["perda_relativa_pct", "perda_relativa"]))}
                  </p>
                </div>
              </div>
            )}
          </Card>
    
          {/* Régua de conversão */}
          <Card className="rounded-xl p-5">
            <h2 className="font-semibold">Régua de conversão</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Sessão → Produto → Carrinho → Checkout → Compra
            </p>
            {regua.isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2">
                {funil.map((e) => (
                  <div key={e.label} className="flex items-center gap-3">
                    <span className="w-48 shrink-0 text-sm text-muted-foreground">{e.label}</span>
                    <div className="flex h-9 flex-1 items-center rounded-md bg-muted/50">
                      {e.valor > 0 ? (
                        <div
                          className="flex h-9 items-center justify-end rounded-md bg-primary/70 px-3 text-sm font-semibold text-primary-foreground transition-all"
                          style={{ width: `${e.largura}%` }}
                        >
                          {fmt(e.valor)}
                        </div>
                      ) : (
                        <span className="px-3 text-sm text-muted-foreground">0</span>
                      )}
                    </div>
    
                    <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                      {e.passagem === null ? "—" : pct(e.passagem)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Dados do GA4 no período selecionado — o funil começa na sessão do site.
            </p>
          </Card>
    
          {/* Tabela de perdas */}
          <Card className="rounded-xl p-5">
            <h2 className="font-semibold">Perdas por etapa</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Ordenado pelo que mais importa: % perdido, não quantidade.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Saída</TableHead>
                  <TableHead className="text-right">Taxa de passagem</TableHead>
                  <TableHead className="text-right">Perda relativa</TableHead>
                  <TableHead className="text-right">Perda absoluta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perdasOrdenadas.map((r, i) => (
                  <TableRow key={i} className={cn(i === 0 && "bg-danger/5")}>
                    <TableCell className="font-medium">
                      {i === 0 && <Badge variant="outline" className="mr-2 border-danger/30 bg-danger/10 text-danger">#1</Badge>}
                      {String(r.etapa ?? "—")}
                    </TableCell>
                    <TableCell className="text-right">{fmt(pega(r, ["entrada"]))}</TableCell>
                    <TableCell className="text-right">{fmt(pega(r, ["saida", "saída"]))}</TableCell>
                    <TableCell className="text-right">{pct(pega(r, ["taxa_passagem_pct", "taxa_passagem"]))}</TableCell>
                    <TableCell className="text-right font-semibold text-danger">
                      {pct(pega(r, ["perda_relativa_pct", "perda_relativa"]))}
                    </TableCell>
                    <TableCell className="text-right">{fmt(pega(r, ["perda_absoluta", "perda_absoluta_qtd"]))}</TableCell>
                  </TableRow>
                ))}
                {!perdas.isLoading && (perdas.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Sem dados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
    
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sessões por canal */}
            <Card className="rounded-xl p-5">
              <h2 className="mb-4 font-semibold">Sessões por canal</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={canaisAgg.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="canal" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => fmt(num(v))} />
                    <Bar dataKey="sessoes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Sessões</TableHead>
                    <TableHead className="text-right">Usuários</TableHead>
                    <TableHead className="text-right">Novos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {canaisAgg.map((c) => (
                    <TableRow key={c.canal}>
                      <TableCell className="font-medium">{c.canal}</TableCell>
                      <TableCell className="text-right">{fmt(c.sessoes)}</TableCell>
                      <TableCell className="text-right">{fmt(c.usuarios)}</TableCell>
                      <TableCell className="text-right">{fmt(c.novos)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
    
            <div className="space-y-6">
              {/* Sessões sem engajamento */}
              <Card className="rounded-xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Sessões sem engajamento (30 dias)
                    </p>
                    <p className="mt-1 font-serif text-3xl font-bold">{fmt(totalSemEngajamento)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Entrou e saiu sem navegar (1 evento só) — proxy de bounce disponível hoje.
                    </p>
                  </div>
                  <div className="rounded-lg bg-warning/10 p-2.5">
                    <TrendingDown className="h-5 w-5 text-warning" />
                  </div>
                </div>
              </Card>
    
              {/* Páginas mais acessadas */}
              <Card className="rounded-xl p-5">
                <h2 className="mb-4 flex items-center gap-2 font-semibold">
                  <MousePointerClick className="h-4 w-4 text-primary" /> Páginas mais acessadas
                </h2>
                <div className="max-h-[420px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Página</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead className="text-right">Sessões</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginasAgg.map((p) => (
                        <TableRow key={p.pagina}>
                          <TableCell className="max-w-[220px] truncate font-medium">{p.pagina}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">{p.titulo}</TableCell>
                          <TableCell className="text-right">{fmt(p.sessoes)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </div>
    
          {/* Páginas de saída */}
          <Card className="rounded-xl p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <LogOut className="h-4 w-4 text-danger" /> Páginas onde mais perdemos visitantes
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Última página vista antes da sessão ficar inativa — rastreamento próprio, últimos 30 dias.
            </p>
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Página</TableHead>
                    <TableHead className="text-right">Saídas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(saidas.data ?? []).map((r, i) => (
                    <TableRow key={`${r.pagina ?? i}`}>
                      <TableCell className="max-w-[420px] truncate font-medium">
                        {String(r.pagina ?? "—")}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-danger">
                        {fmt(pega(r, ["total_saidas"]))}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!saidas.isLoading && (saidas.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                        Sem dados de saída ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
    
          <Card className="rounded-xl border-dashed p-5">
            <h2 className="mb-2 font-semibold">Limitações atuais</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Funil por canal ainda não disponível — o GA4 sincroniza por data/dispositivo, sem dimensão de canal.</li>
              <li>Heatmap de cliques/scroll não existe: exige uma camada de rastreamento adicional (projeto à parte).</li>
              <li>Páginas de saída vêm do rastreamento próprio (30 dias fixos), não do GA4.</li>
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="analise" className="space-y-10">
          <AnaliseDiariaTab />
          <Analise7DiasSection />
          <ComparativoMensalSection />
        </TabsContent>

      </Tabs>
    </div>
  );
}
