import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserPlus, MousePointerClick, ShoppingCart, DollarSign, ShoppingBag, Loader2, Megaphone } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

type Periodo = "7" | "30" | "90";

const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtInt = (n: number) => Math.round(n || 0).toLocaleString("pt-BR");
const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;

function gerarRangeYYYYMMDD(dias: number) {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(fim.getDate() - dias + 1);
  const toYmd = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: toYmd(inicio), fim: toYmd(fim) };
}

const num = (v: any) => (typeof v === "number" ? v : Number(v) || 0);

export default function Marketing() {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [loading, setLoading] = useState(false);
  const [aquisicao, setAquisicao] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [funil, setFunil] = useState<any[]>([]);

  useEffect(() => {
    const { inicio, fim } = gerarRangeYYYYMMDD(Number(periodo));
    setLoading(true);
    Promise.all([
      supabase.from("ga4_aquisicao_canais").select("*").gte("event_date", inicio).lte("event_date", fim),
      supabase.from("ga4_produtos_ecommerce").select("*").gte("event_date", inicio).lte("event_date", fim),
      supabase.from("ga4_funil_compra").select("*").gte("event_date", inicio).lte("event_date", fim),
    ])
      .then(([a, p, f]) => {
        setAquisicao(a.data || []);
        setProdutos(p.data || []);
        setFunil(f.data || []);
      })
      .finally(() => setLoading(false));
  }, [periodo]);

  // ===== Aquisição =====
  const aquisicaoAgg = useMemo(() => {
    const map = new Map<string, { canal: string; usuarios: number; novos_usuarios: number; sessoes: number }>();
    for (const r of aquisicao) {
      const canal = r.canal || r.channel || r.default_channel_group || "Desconhecido";
      const cur = map.get(canal) || { canal, usuarios: 0, novos_usuarios: 0, sessoes: 0 };
      cur.usuarios += num(r.usuarios ?? r.users);
      cur.novos_usuarios += num(r.novos_usuarios ?? r.new_users);
      cur.sessoes += num(r.sessoes ?? r.sessions);
      map.set(canal, cur);
    }
    return [...map.values()].sort((a, b) => b.usuarios - a.usuarios);
  }, [aquisicao]);

  const aquisicaoTotais = useMemo(() => {
    return aquisicaoAgg.reduce(
      (acc, r) => ({
        usuarios: acc.usuarios + r.usuarios,
        novos: acc.novos + r.novos_usuarios,
        sessoes: acc.sessoes + r.sessoes,
      }),
      { usuarios: 0, novos: 0, sessoes: 0 }
    );
  }, [aquisicaoAgg]);

  // ===== Produtos =====
  const produtosAgg = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of produtos) {
      const nome = r.nome_item || r.item_name || "Sem nome";
      const cur = map.get(nome) || {
        nome,
        sessoes: 0,
        itens_vistos: 0,
        adicionados_carrinho: 0,
        compras: 0,
        receita: 0,
      };
      cur.sessoes += num(r.sessoes ?? r.sessions);
      cur.itens_vistos += num(r.itens_vistos ?? r.items_viewed ?? r.item_views);
      cur.adicionados_carrinho += num(r.adicionados_carrinho ?? r.add_to_cart ?? r.itens_add_carrinho);
      cur.compras += num(r.compras ?? r.purchases ?? r.itens_comprados);
      cur.receita += num(r.receita ?? r.revenue ?? r.item_revenue);
      map.set(nome, cur);
    }
    return [...map.values()]
      .map((r) => ({ ...r, taxa_conv: r.sessoes > 0 ? (r.compras / r.sessoes) * 100 : 0 }))
      .sort((a, b) => b.compras - a.compras);
  }, [produtos]);

  const produtosTotais = useMemo(
    () =>
      produtosAgg.reduce(
        (a, r) => ({
          sessoes: a.sessoes + r.sessoes,
          carrinho: a.carrinho + r.adicionados_carrinho,
          compras: a.compras + r.compras,
          receita: a.receita + r.receita,
        }),
        { sessoes: 0, carrinho: 0, compras: 0, receita: 0 }
      ),
    [produtosAgg]
  );

  const taxaMediaConv = useMemo(() => {
    const validos = produtosAgg.filter((p) => p.sessoes > 0);
    if (!validos.length) return 0;
    return validos.reduce((s, p) => s + p.taxa_conv, 0) / validos.length;
  }, [produtosAgg]);

  // ===== Funil =====
  const ETAPAS = [
    { key: "inicio_sessao", label: "Início de Sessão", alts: ["session_start", "sessions"] },
    { key: "visualizou_produto", label: "Visualizou Produto", alts: ["view_item", "product_views"] },
    { key: "adicionou_carrinho", label: "Adicionou Carrinho", alts: ["add_to_cart"] },
    { key: "iniciou_pagamento", label: "Iniciou Pagamento", alts: ["begin_checkout", "checkout"] },
    { key: "comprou", label: "Comprou", alts: ["purchase", "purchases"] },
  ];

  const valorEtapa = (r: any, etapa: typeof ETAPAS[number]) =>
    num(r[etapa.key] ?? etapa.alts.reduce((acc, k) => acc ?? r[k], undefined));

  const funilAgg = useMemo(() => {
    return ETAPAS.map((e) => ({
      label: e.label,
      total: funil.reduce((s, r) => s + valorEtapa(r, e), 0),
    }));
  }, [funil]);

  const funilDispositivo = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of funil) {
      const dev = (r.dispositivo || r.device_category || "outros").toLowerCase();
      const cur =
        map.get(dev) ||
        { dispositivo: dev, ...Object.fromEntries(ETAPAS.map((e) => [e.key, 0])) };
      for (const e of ETAPAS) cur[e.key] += valorEtapa(r, e);
      map.set(dev, cur);
    }
    return [...map.values()];
  }, [funil]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Megaphone className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-serif font-bold">Marketing</h1>
        </div>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados do GA4...
        </div>
      )}

      <Tabs defaultValue="aquisicao">
        <TabsList>
          <TabsTrigger value="aquisicao">Aquisição</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="funil">Funil de Compra</TabsTrigger>
        </TabsList>

        {/* ===== AQUISIÇÃO ===== */}
        <TabsContent value="aquisicao" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Total de Usuários" value={fmtInt(aquisicaoTotais.usuarios)} icon={Users} variant="primary" />
            <StatCard title="Novos Usuários" value={fmtInt(aquisicaoTotais.novos)} icon={UserPlus} variant="success" />
            <StatCard title="Total de Sessões" value={fmtInt(aquisicaoTotais.sessoes)} icon={MousePointerClick} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Top 10 canais por usuários</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={aquisicaoAgg.slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="canal" type="category" width={120} />
                  <Tooltip formatter={(v: any) => fmtInt(v)} />
                  <Bar dataKey="usuarios" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Detalhamento por canal</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Usuários</TableHead>
                    <TableHead className="text-right">Novos</TableHead>
                    <TableHead className="text-right">Sessões</TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aquisicaoAgg.map((r) => (
                    <TableRow key={r.canal}>
                      <TableCell className="font-medium">{r.canal}</TableCell>
                      <TableCell className="text-right">{fmtInt(r.usuarios)}</TableCell>
                      <TableCell className="text-right">{fmtInt(r.novos_usuarios)}</TableCell>
                      <TableCell className="text-right">{fmtInt(r.sessoes)}</TableCell>
                      <TableCell className="text-right">
                        {fmtPct(aquisicaoTotais.usuarios > 0 ? (r.usuarios / aquisicaoTotais.usuarios) * 100 : 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!aquisicaoAgg.length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem dados no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PRODUTOS ===== */}
        <TabsContent value="produtos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Sessões" value={fmtInt(produtosTotais.sessoes)} icon={MousePointerClick} />
            <StatCard title="Add. ao Carrinho" value={fmtInt(produtosTotais.carrinho)} icon={ShoppingCart} variant="warning" />
            <StatCard title="Compras" value={fmtInt(produtosTotais.compras)} icon={ShoppingBag} variant="success" />
            <StatCard title="Receita" value={fmtBRL(produtosTotais.receita)} icon={DollarSign} variant="primary" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance por produto</CardTitle>
              <p className="text-xs text-muted-foreground">
                Taxa de conversão média: <span className="font-medium">{fmtPct(taxaMediaConv)}</span> — produtos acima da média destacados em verde
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Sessões</TableHead>
                    <TableHead className="text-right">Itens Vistos</TableHead>
                    <TableHead className="text-right">Add. Carrinho</TableHead>
                    <TableHead className="text-right">Compras</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Taxa Conv.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosAgg.map((r) => {
                    const acima = r.taxa_conv > taxaMediaConv && r.sessoes > 0;
                    return (
                      <TableRow key={r.nome} className={acima ? "bg-success/10" : ""}>
                        <TableCell className="font-medium max-w-[280px] truncate">{r.nome}</TableCell>
                        <TableCell className="text-right">{fmtInt(r.sessoes)}</TableCell>
                        <TableCell className="text-right">{fmtInt(r.itens_vistos)}</TableCell>
                        <TableCell className="text-right">{fmtInt(r.adicionados_carrinho)}</TableCell>
                        <TableCell className="text-right">{fmtInt(r.compras)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(r.receita)}</TableCell>
                        <TableCell className={`text-right font-medium ${acima ? "text-success" : ""}`}>
                          {fmtPct(r.taxa_conv)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!produtosAgg.length && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem dados no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== FUNIL ===== */}
        <TabsContent value="funil" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Funil de compra</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {funilAgg.map((etapa, i) => {
                  const max = funilAgg[0]?.total || 1;
                  const widthPct = max > 0 ? (etapa.total / max) * 100 : 0;
                  const anterior = i > 0 ? funilAgg[i - 1].total : null;
                  const taxa = anterior && anterior > 0 ? (etapa.total / anterior) * 100 : null;
                  const perda = taxa !== null ? 100 - taxa : null;
                  return (
                    <div key={etapa.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{etapa.label}</span>
                        <span className="text-muted-foreground">
                          {fmtInt(etapa.total)}
                          {taxa !== null && (
                            <span className="ml-3">
                              <span className="text-success">{fmtPct(taxa)}</span>
                              <span className="text-danger ml-2">(-{fmtPct(perda!)})</span>
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-8 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Funil por dispositivo</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dispositivo</TableHead>
                    {ETAPAS.map((e) => (
                      <TableHead key={e.key} className="text-right">{e.label}</TableHead>
                    ))}
                    <TableHead className="text-right">Conv. Final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funilDispositivo.map((r) => {
                    const inicio = r[ETAPAS[0].key] || 0;
                    const fim = r[ETAPAS[ETAPAS.length - 1].key] || 0;
                    const conv = inicio > 0 ? (fim / inicio) * 100 : 0;
                    return (
                      <TableRow key={r.dispositivo}>
                        <TableCell className="font-medium capitalize">{r.dispositivo}</TableCell>
                        {ETAPAS.map((e) => (
                          <TableCell key={e.key} className="text-right">{fmtInt(r[e.key])}</TableCell>
                        ))}
                        <TableCell className="text-right font-medium text-primary">{fmtPct(conv)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!funilDispositivo.length && (
                    <TableRow><TableCell colSpan={ETAPAS.length + 2} className="text-center text-muted-foreground">Sem dados no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
