import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserPlus, MousePointerClick, ShoppingCart, DollarSign, ShoppingBag, Loader2, Megaphone } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ScatterChart, Scatter, ZAxis, ReferenceLine, Cell, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtInt = (n: number) => Math.round(n || 0).toLocaleString("pt-BR");
const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;

const getDateRange = (periodo: string) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const toYMD = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

  const hoje = new Date();

  if (periodo === "7dias") {
    const ini = new Date(); ini.setDate(hoje.getDate() - 7);
    return { inicio: toYMD(ini), fim: toYMD(hoje) };
  }
  if (periodo === "30dias") {
    const ini = new Date(); ini.setDate(hoje.getDate() - 30);
    return { inicio: toYMD(ini), fim: toYMD(hoje) };
  }
  if (periodo === "90dias") {
    const ini = new Date(); ini.setDate(hoje.getDate() - 90);
    return { inicio: toYMD(ini), fim: toYMD(hoje) };
  }

  const meses: Record<string, { inicio: string; fim: string }> = {
    mar2026: { inicio: "20260301", fim: "20260331" },
    abr2026: { inicio: "20260401", fim: "20260430" },
    mai2026: { inicio: "20260501", fim: "20260531" },
    jun2026: { inicio: "20260601", fim: "20260630" },
  };
  return (
    meses[periodo] ?? {
      inicio: toYMD(new Date(new Date().setDate(hoje.getDate() - 30))),
      fim: toYMD(hoje),
    }
  );
};

const toDashDate = (ymd: string) =>
  ymd.length === 8 ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}` : ymd;


const PERIODOS = [
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "90dias", label: "Últimos 90 dias" },
  { value: "mar2026", label: "Março 2026" },
  { value: "abr2026", label: "Abril 2026" },
  { value: "mai2026", label: "Maio 2026" },
  { value: "jun2026", label: "Junho 2026" },
];

const num = (v: any) => (typeof v === "number" ? v : Number(v) || 0);

export default function Marketing() {
  const [periodo, setPeriodo] = useState("30dias");
  const [loading, setLoading] = useState(false);
  const [aquisicao, setAquisicao] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [funil, setFunil] = useState<any[]>([]);
  const [paginas, setPaginas] = useState<any[]>([]);
  const [windsorProdutos, setWindsorProdutos] = useState<any[]>([]);
  const [windsorCanais, setWindsorCanais] = useState<any[]>([]);
  const [metaAds, setMetaAds] = useState<any[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

  useEffect(() => {
    const { inicio, fim } = getDateRange(periodo);
    const inicioDash = toDashDate(inicio);
    const fimDash = toDashDate(fim);
    setLoading(true);

    // Recursive fetch to bypass PostgREST 1000-row default limit
    const fetchAll = async (table: string, dateCol: string, ini: string, end: string, columns = "*") => {
      const pageSize = 1000;
      let from = 0;
      const all: any[] = [];
      while (true) {
        const { data, error } = await (supabase.from(table as any) as any)
          .select(columns)
          .gte(dateCol, ini)
          .lte(dateCol, end)
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    };

    Promise.all([
      supabase.from("ga4_aquisicao_canais").select("*").gte("event_date", inicio).lte("event_date", fim),
      supabase.from("ga4_produtos_ecommerce").select("*").gte("event_date", inicio).lte("event_date", fim),
      supabase.from("ga4_funil_compra").select("*").gte("event_date", inicio).lte("event_date", fim),
      supabase.from("ga4_sessoes_paginas").select("pagina, titulo, sessoes").gte("event_date", inicio).lte("event_date", fim),
      fetchAll("windsor_produtos", "date", inicioDash, fimDash, "date, item_name, sessions, items_viewed, items_added_to_cart, items_purchased, item_revenue"),
      fetchAll("windsor_canais", "date", inicioDash, fimDash, "date, session_custom_channel_group, sessions, add_to_carts, checkouts, items_purchased, purchase_revenue"),
    ])
      .then(([a, p, f, pg, wp, wc]: any[]) => {
        setAquisicao(a.data || []);
        setProdutos(p.data || []);
        setFunil(f.data || []);
        setPaginas(pg.data || []);
        setWindsorProdutos(wp || []);
        setWindsorCanais(wc || []);
      })
      .finally(() => setLoading(false));
  }, [periodo]);

  // ===== Meta Ads =====
  useEffect(() => {
    const { inicio, fim } = getDateRange(periodo);
    const inicioDash = toDashDate(inicio);
    const fimDash = toDashDate(fim);
    setLoadingMeta(true);

    const fetchAll = async () => {
      const pageSize = 1000;
      let from = 0;
      const all: any[] = [];
      while (true) {
        const { data, error } = await (supabase.from("windsor_meta_ads" as any) as any)
          .select("date, campaign, spend, clicks, cpc, cpm, ctr, purchase_roas, actions_add_to_cart, actions_initiate_checkout, actions_video_view")
          .gte("date", inicioDash)
          .lte("date", fimDash)
          .order("date", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    };

    fetchAll()
      .then((rows) => setMetaAds(rows))
      .catch(() => setMetaAds([]))
      .finally(() => setLoadingMeta(false));
  }, [periodo]);

  const metaAdsTotais = useMemo(() => {
    const t = metaAds.reduce(
      (a, r) => {
        const sp = num(r.spend);
        const cl = num(r.clicks);
        const ro = num(r.purchase_roas);
        a.spend += sp;
        a.clicks += cl;
        a.spendRoas += sp * ro;
        return a;
      },
      { spend: 0, clicks: 0, spendRoas: 0 }
    );
    return {
      spend: t.spend,
      clicks: t.clicks,
      cpc: t.clicks > 0 ? t.spend / t.clicks : 0,
      roas: t.spend > 0 ? t.spendRoas / t.spend : 0,
    };
  }, [metaAds]);

  const metaAdsDaily = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of metaAds) {
      const d = r.date;
      map.set(d, (map.get(d) || 0) + num(r.spend));
    }
    return [...map.entries()]
      .map(([date, spend]) => ({ date, spend }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metaAds]);

  const metaAdsCampanhas = useMemo(() => {
    const map = new Map<string, any>();
    // Iterate from newest first so first occurrence keeps "most recent" rate values
    for (const r of metaAds) {
      const key = r.campaign || "—";
      const cur =
        map.get(key) || {
          campaign: key,
          spend: 0,
          clicks: 0,
          add_to_cart: 0,
          checkout: 0,
          video_view: 0,
          cpc_latest: null as number | null,
          ctr_latest: null as number | null,
          roas_latest: null as number | null,
        };
      cur.spend += num(r.spend);
      cur.clicks += num(r.clicks);
      cur.add_to_cart += num(r.actions_add_to_cart);
      cur.checkout += num(r.actions_initiate_checkout);
      cur.video_view += num(r.actions_video_view);
      if (cur.cpc_latest === null && r.cpc != null) cur.cpc_latest = num(r.cpc);
      if (cur.ctr_latest === null && r.ctr != null) cur.ctr_latest = num(r.ctr);
      if (cur.roas_latest === null && r.purchase_roas != null) cur.roas_latest = num(r.purchase_roas);
      map.set(key, cur);
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        cpc: r.clicks > 0 ? r.spend / r.clicks : r.cpc_latest || 0,
        ctr: r.ctr_latest ?? 0,
        roas: r.roas_latest ?? 0,
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [metaAds]);

  const roasBadgeVariant = (roas: number): "default" | "secondary" | "destructive" => {
    if (roas >= 4) return "default";
    if (roas >= 2) return "secondary";
    return "destructive";
  };




  // ===== Aquisição =====
  const aquisicaoAgg = useMemo(() => {
    const map = new Map<string, { canal: string; usuarios: number; novos_usuarios: number; sessoes: number }>();
    for (const r of aquisicao) {
      const canal = r.canal || "Desconhecido";
      const cur = map.get(canal) || { canal, usuarios: 0, novos_usuarios: 0, sessoes: 0 };
      cur.usuarios += num(r.usuarios);
      cur.novos_usuarios += num(r.novos_usuarios);
      cur.sessoes += num(r.sessoes);
      map.set(canal, cur);
    }
    return [...map.values()].sort((a, b) => b.usuarios - a.usuarios);
  }, [aquisicao]);

  const aquisicaoTotais = useMemo(
    () =>
      aquisicaoAgg.reduce(
        (acc, r) => ({
          usuarios: acc.usuarios + r.usuarios,
          novos: acc.novos + r.novos_usuarios,
          sessoes: acc.sessoes + r.sessoes,
        }),
        { usuarios: 0, novos: 0, sessoes: 0 }
      ),
    [aquisicaoAgg]
  );

  // ===== Produtos =====
  const produtosAgg = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of produtos) {
      const nome = r.nome_item || "Sem nome";
      const cur = map.get(nome) || {
        nome,
        sessoes: 0,
        itens_vistos: 0,
        adicionados_carrinho: 0,
        iniciaram_pagamento: 0,
        compras: 0,
        receita: 0,
      };
      cur.sessoes += num(r.sessoes);
      cur.itens_vistos += num(r.itens_vistos);
      cur.adicionados_carrinho += num(r.adicionados_carrinho);
      cur.iniciaram_pagamento += num(r.iniciaram_pagamento);
      cur.compras += num(r.compras);
      cur.receita += num(r.receita);
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
    { key: "inicio_sessao", label: "Início de Sessão" },
    { key: "visualizou_produto", label: "Visualizou Produto" },
    { key: "adicionou_carrinho", label: "Adicionou Carrinho" },
    { key: "iniciou_pagamento", label: "Iniciou Pagamento" },
    { key: "comprou", label: "Comprou" },
  ] as const;

  const funilAgg = useMemo(
    () =>
      ETAPAS.map((e) => ({
        label: e.label,
        total: funil.reduce((s, r) => s + num(r[e.key]), 0),
      })),
    [funil]
  );

  const funilDispositivo = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of funil) {
      const dev = (r.dispositivo || "outros").toLowerCase();
      const cur =
        map.get(dev) ||
        { dispositivo: dev, ...Object.fromEntries(ETAPAS.map((e) => [e.key, 0])) };
      for (const e of ETAPAS) cur[e.key] += num(r[e.key]);
      map.set(dev, cur);
    }
    return [...map.values()];
  }, [funil]);

  // ===== Páginas =====
  const limparUrl = (u: string) =>
    (u || "").replace(/^https?:\/\/[^/]+/i, "") || "/";

  const paginasAgg = useMemo(() => {
    const map = new Map<string, { pagina: string; titulo: string; sessoes: number }>();
    for (const r of paginas) {
      const key = limparUrl(r.pagina);
      const cur = map.get(key) || { pagina: key, titulo: r.titulo || "", sessoes: 0 };
      cur.sessoes += num(r.sessoes);
      if (!cur.titulo && r.titulo) cur.titulo = r.titulo;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.sessoes - a.sessoes);
  }, [paginas]);

  const paginasTotalSessoes = useMemo(
    () => paginasAgg.reduce((s, r) => s + r.sessoes, 0),
    [paginasAgg]
  );

  // ===== Windsor Produtos (Mariana Cardoso) =====
  const windsorProdutosAgg = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of windsorProdutos) {
      const key = r.item_name || "Sem nome";
      const cur = map.get(key) || {
        item_name: key, sessions: 0, items_viewed: 0,
        items_added_to_cart: 0, items_purchased: 0, item_revenue: 0,
      };
      cur.sessions += num(r.sessions);
      cur.items_viewed += num(r.items_viewed);
      cur.items_added_to_cart += num(r.items_added_to_cart);
      cur.items_purchased += num(r.items_purchased);
      cur.item_revenue += num(r.item_revenue);
      map.set(key, cur);
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        taxa_sc: r.items_viewed > 0 ? (r.items_added_to_cart / r.items_viewed) * 100 : 0,
        taxa_cc: r.items_added_to_cart > 0 ? (r.items_purchased / r.items_added_to_cart) * 100 : null,
        taxa_final: r.items_viewed > 0 ? (r.items_purchased / r.items_viewed) * 100 : 0,
      }))
      .sort((a, b) => b.items_purchased - a.items_purchased);
  }, [windsorProdutos]);

  const windsorProdutosTotais = useMemo(
    () => windsorProdutosAgg.reduce(
      (a, r) => ({
        sessions: a.sessions + r.sessions,
        items_viewed: a.items_viewed + r.items_viewed,
        items_added_to_cart: a.items_added_to_cart + r.items_added_to_cart,
        items_purchased: a.items_purchased + r.items_purchased,
        item_revenue: a.item_revenue + r.item_revenue,
      }),
      { sessions: 0, items_viewed: 0, items_added_to_cart: 0, items_purchased: 0, item_revenue: 0 }
    ),
    [windsorProdutosAgg]
  );

  const wpMedias = useMemo(() => {
    const v = windsorProdutosAgg;
    if (!v.length) return { sc: 0, cc: 0, final: 0 };
    const ccs = v.filter((x) => x.taxa_cc !== null);
    return {
      sc: v.reduce((s, x) => s + x.taxa_sc, 0) / v.length,
      cc: ccs.length ? ccs.reduce((s, x) => s + (x.taxa_cc || 0), 0) / ccs.length : 0,
      final: v.reduce((s, x) => s + x.taxa_final, 0) / v.length,
    };
  }, [windsorProdutosAgg]);

  // ===== Windsor Produtos: ordenação =====
  const [wpSortCol, setWpSortCol] = useState<string>("items_purchased");
  const [wpSortDir, setWpSortDir] = useState<"asc" | "desc">("desc");
  const wpToggleSort = (col: string) => {
    if (wpSortCol === col) setWpSortDir(wpSortDir === "desc" ? "asc" : "desc");
    else { setWpSortCol(col); setWpSortDir("desc"); }
  };
  const windsorProdutosSorted = useMemo(() => {
    const arr = [...windsorProdutosAgg];
    arr.sort((a: any, b: any) => {
      const av = a[wpSortCol]; const bv = b[wpSortCol];
      if (typeof av === "string" || typeof bv === "string") {
        return wpSortDir === "desc"
          ? String(bv ?? "").localeCompare(String(av ?? ""))
          : String(av ?? "").localeCompare(String(bv ?? ""));
      }
      const an = av ?? -Infinity; const bn = bv ?? -Infinity;
      return wpSortDir === "desc" ? (bn as number) - (an as number) : (an as number) - (bn as number);
    });
    return arr;
  }, [windsorProdutosAgg, wpSortCol, wpSortDir]);

  // ===== Matriz de Produtos (scatter) =====
  const wpMatriz = useMemo(() => {
    const pts = windsorProdutosAgg
      .filter((r) => r.items_viewed > 0)
      .map((r) => ({
        item_name: r.item_name,
        x: r.taxa_final,
        y: r.item_revenue,
        z: Math.max(r.items_purchased, 1),
        purchases: r.items_purchased,
      }));
    const produtosComReceita = windsorProdutosAgg.filter((p: any) => p.item_revenue > 0);
    const receitasOrdenadas = produtosComReceita
      .map((p: any) => p.item_revenue)
      .sort((a: number, b: number) => a - b);
    const medianaReceita = receitasOrdenadas.length > 0
      ? receitasOrdenadas[Math.floor(receitasOrdenadas.length / 2)]
      : 0;
    const quadrantColor = (p: any) => {
      const altaConv = p.x >= 5;
      const altaRec = p.y >= medianaReceita;
      if (altaConv && altaRec) return "#16a34a";
      if (altaConv && !altaRec) return "#2563eb";
      if (!altaConv && altaRec) return "#dc2626";
      return "#9ca3af";
    };
    const labelQuad = (p: any) => {
      const altaConv = p.x >= 5;
      const altaRec = p.y >= medianaReceita;
      if (altaConv && altaRec) return "Escalar";
      if (altaConv && !altaRec) return "Oportunidade";
      if (!altaConv && altaRec) return "Corrigir";
      return "Monitorar";
    };
    return {
      pts: pts.map((p) => ({ ...p, fill: quadrantColor(p), quadrante: labelQuad(p) })),
      medianaReceita,
    };
  }, [windsorProdutosAgg]);

  // ===== Windsor Canais (Mariana Cardoso) =====
  const [wcSortCol, setWcSortCol] = useState<string>("items_purchased");
  const [wcSortDir, setWcSortDir] = useState<"asc" | "desc">("desc");
  const wcToggleSort = (col: string) => {
    if (wcSortCol === col) setWcSortDir(wcSortDir === "desc" ? "asc" : "desc");
    else { setWcSortCol(col); setWcSortDir("desc"); }
  };

  const windsorCanaisAgg = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of windsorCanais) {
      const key = r.session_custom_channel_group || "Desconhecido";
      const cur = map.get(key) || {
        canal: key, sessions: 0, add_to_carts: 0,
        checkouts: 0, items_purchased: 0, purchase_revenue: 0,
      };
      cur.sessions += num(r.sessions);
      cur.add_to_carts += num(r.add_to_carts);
      cur.checkouts += num(r.checkouts);
      cur.items_purchased += num(r.items_purchased);
      cur.purchase_revenue += num(r.purchase_revenue);
      map.set(key, cur);
    }
    return [...map.values()].map((r) => ({
      ...r,
      taxa_sc: r.sessions > 0 ? (r.add_to_carts / r.sessions) * 100 : 0,
      taxa_cc: r.add_to_carts > 0 ? (r.checkouts / r.add_to_carts) * 100 : null,
      taxa_final: r.sessions > 0 ? (r.items_purchased / r.sessions) * 100 : 0,
    })).sort((a, b) => b.items_purchased - a.items_purchased);
  }, [windsorCanais]);

  const windsorCanaisSorted = useMemo(() => {
    const arr = [...windsorCanaisAgg];
    arr.sort((a: any, b: any) => {
      const av = a[wcSortCol]; const bv = b[wcSortCol];
      if (typeof av === "string" || typeof bv === "string") {
        return wcSortDir === "desc"
          ? String(bv ?? "").localeCompare(String(av ?? ""))
          : String(av ?? "").localeCompare(String(bv ?? ""));
      }
      const an = av ?? -Infinity; const bn = bv ?? -Infinity;
      return wcSortDir === "desc" ? (bn as number) - (an as number) : (an as number) - (bn as number);
    });
    return arr;
  }, [windsorCanaisAgg, wcSortCol, wcSortDir]);

  const windsorCanaisTotais = useMemo(
    () => windsorCanaisAgg.reduce(
      (a, r) => ({
        sessions: a.sessions + r.sessions,
        add_to_carts: a.add_to_carts + r.add_to_carts,
        checkouts: a.checkouts + r.checkouts,
        items_purchased: a.items_purchased + r.items_purchased,
        purchase_revenue: a.purchase_revenue + r.purchase_revenue,
      }),
      { sessions: 0, add_to_carts: 0, checkouts: 0, items_purchased: 0, purchase_revenue: 0 }
    ),
    [windsorCanaisAgg]
  );

  const wcMedias = useMemo(() => {
    const v = windsorCanaisAgg;
    if (!v.length) return { sc: 0, cc: 0, final: 0 };
    const ccs = v.filter((x) => x.taxa_cc !== null);
    return {
      sc: v.reduce((s, x) => s + x.taxa_sc, 0) / v.length,
      cc: ccs.length ? ccs.reduce((s, x) => s + (x.taxa_cc || 0), 0) / ccs.length : 0,
      final: v.reduce((s, x) => s + x.taxa_final, 0) / v.length,
    };
  }, [windsorCanaisAgg]);


  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Megaphone className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-serif font-bold">Marketing</h1>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados do GA4...
        </div>
      )}

      <Tabs defaultValue="paginas">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="paginas">Páginas</TabsTrigger>
          <TabsTrigger value="windsor-produtos">Produtos - Mariana Cardoso</TabsTrigger>
          <TabsTrigger value="windsor-canais">Sessões por Canal - Mariana Cardoso</TabsTrigger>
        </TabsList>





        {/* ===== PÁGINAS ===== */}
        <TabsContent value="paginas" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Total de Sessões" value={fmtInt(paginasTotalSessoes)} icon={MousePointerClick} variant="primary" />
            <StatCard title="Páginas únicas" value={fmtInt(paginasAgg.length)} icon={Megaphone} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Top 10 páginas por sessões</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={paginasAgg.slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="pagina" type="category" width={220} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => fmtInt(v)} />
                  <Bar dataKey="sessoes" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Detalhamento por página</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Página</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead className="text-right">Sessões</TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginasAgg.map((r) => (
                    <TableRow key={r.pagina}>
                      <TableCell className="font-mono text-xs max-w-[320px] truncate">{r.pagina}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{r.titulo}</TableCell>
                      <TableCell className="text-right">{fmtInt(r.sessoes)}</TableCell>
                      <TableCell className="text-right">
                        {fmtPct(paginasTotalSessoes > 0 ? (r.sessoes / paginasTotalSessoes) * 100 : 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!paginasAgg.length && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem dados no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== WINDSOR PRODUTOS ===== */}
        <TabsContent value="windsor-produtos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="VISUALIZAÇÕES" value={fmtInt(windsorProdutosTotais.items_viewed)} icon={MousePointerClick} />
            <StatCard title="Add. Carrinho" value={fmtInt(windsorProdutosTotais.items_added_to_cart)} icon={ShoppingCart} variant="warning" />
            <StatCard title="Compras" value={fmtInt(windsorProdutosTotais.items_purchased)} icon={ShoppingBag} variant="success" />
            <StatCard title="Receita Total" value={fmtBRL(windsorProdutosTotais.item_revenue)} icon={DollarSign} variant="primary" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Matriz de Produtos — Conversão × Receita</CardTitle>
              <p className="text-xs text-muted-foreground">
                Linha vertical em 5% de conversão · Linha horizontal na mediana de receita ({fmtBRL(wpMatriz.medianaReceita)})
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Conversão"
                    unit="%"
                    label={{ value: "Taxa de Conversão sobre Visualizações (%)", position: "insideBottom", offset: -10 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Receita"
                    tickFormatter={(v) => fmtBRL(v)}
                    label={{ value: "Receita", angle: -90, position: "insideLeft", offset: -10 }}
                  />
                  <ZAxis type="number" dataKey="z" range={[60, 600]} name="Compras" />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                          <div className="font-medium mb-1">{p.item_name}</div>
                          <div>Conversão: {fmtPct(p.x)}</div>
                          <div>Receita: {fmtBRL(p.y)}</div>
                          <div>Compras: {fmtInt(p.purchases)}</div>
                          <div className="mt-1 font-medium" style={{ color: p.fill }}>{p.quadrante}</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine x={5} stroke="#64748b" strokeDasharray="4 4" />
                  <ReferenceLine y={wpMatriz.medianaReceita} stroke="#64748b" strokeDasharray="4 4" />
                  <Scatter data={wpMatriz.pts}>
                    {wpMatriz.pts.map((p, i) => (
                      <Cell key={i} fill={p.fill} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 text-xs">
                <div className="flex items-start gap-2"><span className="mt-1 inline-block h-3 w-3 rounded-full" style={{ background: "#16a34a" }} /><div><div className="font-medium">Escalar</div><div className="text-muted-foreground">alta conversão + alta receita</div></div></div>
                <div className="flex items-start gap-2"><span className="mt-1 inline-block h-3 w-3 rounded-full" style={{ background: "#2563eb" }} /><div><div className="font-medium">Oportunidade</div><div className="text-muted-foreground">alta conversão + baixa receita</div></div></div>
                <div className="flex items-start gap-2"><span className="mt-1 inline-block h-3 w-3 rounded-full" style={{ background: "#dc2626" }} /><div><div className="font-medium">Corrigir</div><div className="text-muted-foreground">baixa conversão + alta receita</div></div></div>
                <div className="flex items-start gap-2"><span className="mt-1 inline-block h-3 w-3 rounded-full" style={{ background: "#9ca3af" }} /><div><div className="font-medium">Monitorar</div><div className="text-muted-foreground">baixa conversão + baixa receita</div></div></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance por produto (Windsor)</CardTitle>
              <p className="text-xs text-muted-foreground">
                Visualizações = total de vezes que o produto foi visualizado em sessões. Taxa de conversão calculada sobre visualizações.
              </p>
              <p className="text-xs text-muted-foreground">
                Médias — Vis.→Carrinho: <span className="font-medium">{fmtPct(wpMedias.sc)}</span> · Carrinho→Compra: <span className="font-medium">{fmtPct(wpMedias.cc)}</span> · Conv. Final: <span className="font-medium">{fmtPct(wpMedias.final)}</span>
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      { key: "item_name", label: "Produto", align: "left" },
                      { key: "sessions", label: "Visualizações de Produto", align: "right" },
                      { key: "items_viewed", label: "Visualizados", align: "right" },
                      { key: "items_added_to_cart", label: "Add. Carrinho", align: "right" },
                      { key: "items_purchased", label: "Compras", align: "right" },
                      { key: "item_revenue", label: "Receita", align: "right" },
                      { key: "taxa_sc", label: "Vis.→Carrinho", align: "right" },
                      { key: "taxa_cc", label: "Carrinho→Compra", align: "right" },
                      { key: "taxa_final", label: "Conv. Final", align: "right" },
                    ].map((c) => (
                      <TableHead
                        key={c.key}
                        className={`${c.align === "right" ? "text-right" : ""} cursor-pointer select-none`}
                        onClick={() => wpToggleSort(c.key)}
                      >
                        {c.label} {wpSortCol === c.key ? (wpSortDir === "desc" ? "↓" : "↑") : ""}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {windsorProdutosSorted.map((r) => {
                    const scOk = r.taxa_sc > wpMedias.sc;
                    const ccOk = r.taxa_cc !== null && r.taxa_cc > wpMedias.cc;
                    const fOk = r.taxa_final > wpMedias.final;
                    return (
                      <TableRow key={r.item_name}>
                        <TableCell className="font-medium max-w-[280px] truncate">{r.item_name}</TableCell>
                        <TableCell className="text-right">{fmtInt(r.sessions)}</TableCell>
                        <TableCell className="text-right">{fmtInt(r.items_viewed)}</TableCell>
                        <TableCell className="text-right">{fmtInt(r.items_added_to_cart)}</TableCell>
                        <TableCell className="text-right">{fmtInt(r.items_purchased)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(r.item_revenue)}</TableCell>
                        <TableCell className={`text-right ${scOk ? "text-success font-medium" : ""}`}>{fmtPct(r.taxa_sc)}</TableCell>
                        <TableCell className={`text-right ${ccOk ? "text-success font-medium" : ""}`}>{r.taxa_cc === null ? "—" : fmtPct(r.taxa_cc)}</TableCell>
                        <TableCell className={`text-right ${fOk ? "text-success font-medium" : ""}`}>{fmtPct(r.taxa_final)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!windsorProdutosSorted.length && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Sem dados no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== WINDSOR CANAIS ===== */}
        <TabsContent value="windsor-canais" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <StatCard title="Sessões" value={fmtInt(windsorCanaisTotais.sessions)} icon={MousePointerClick} />
            <StatCard title="Add. Carrinho" value={fmtInt(windsorCanaisTotais.add_to_carts)} icon={ShoppingCart} variant="warning" />
            <StatCard title="Iniciaram Pagamento" value={fmtInt(windsorCanaisTotais.checkouts)} icon={ShoppingCart} />
            <StatCard title="Compras" value={fmtInt(windsorCanaisTotais.items_purchased)} icon={ShoppingBag} variant="success" />
            <StatCard title="Receita Total" value={fmtBRL(windsorCanaisTotais.purchase_revenue)} icon={DollarSign} variant="primary" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance por canal - Mariana Cardoso</CardTitle>
              <p className="text-xs text-muted-foreground">
                Médias — Sessão→Carrinho: <span className="font-medium">{fmtPct(wcMedias.sc)}</span> · Carrinho→Checkout: <span className="font-medium">{fmtPct(wcMedias.cc)}</span> · Conv. Final: <span className="font-medium">{fmtPct(wcMedias.final)}</span>
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      { key: "canal", label: "Canal", align: "left" },
                      { key: "sessions", label: "Sessões", align: "right" },
                      { key: "add_to_carts", label: "Add. Carrinho", align: "right" },
                      { key: "checkouts", label: "Iniciaram Pagto", align: "right" },
                      { key: "items_purchased", label: "Compras", align: "right" },
                      { key: "purchase_revenue", label: "Receita", align: "right" },
                      { key: "taxa_sc", label: "Sessão→Carrinho", align: "right" },
                      { key: "taxa_cc", label: "Carrinho→Checkout", align: "right" },
                      { key: "taxa_final", label: "Conv. Final", align: "right" },
                    ].map((c) => (
                      <TableHead
                        key={c.key}
                        className={`${c.align === "right" ? "text-right" : ""} cursor-pointer select-none hover:text-foreground`}
                        onClick={() => wcToggleSort(c.key)}
                      >
                        {c.label}{wcSortCol === c.key ? (wcSortDir === "desc" ? " ↓" : " ↑") : ""}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {windsorCanaisSorted.map((r) => {
                    const scOk = r.taxa_sc > wcMedias.sc;
                    const ccOk = r.taxa_cc !== null && r.taxa_cc > wcMedias.cc;
                    const fOk = r.taxa_final > wcMedias.final;
                    return (
                      <TableRow key={r.canal}>
                        <TableCell className="font-medium">{r.canal}</TableCell>
                        <TableCell className="text-right">{fmtInt(r.sessions)}</TableCell>
                        <TableCell className="text-right">{fmtInt(r.add_to_carts)}</TableCell>
                        <TableCell className="text-right">{fmtInt(r.checkouts)}</TableCell>
                        <TableCell className="text-right">{fmtInt(r.items_purchased)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(r.purchase_revenue)}</TableCell>
                        <TableCell className={`text-right ${scOk ? "text-success font-medium" : ""}`}>{fmtPct(r.taxa_sc)}</TableCell>
                        <TableCell className={`text-right ${ccOk ? "text-success font-medium" : ""}`}>{r.taxa_cc === null ? "—" : fmtPct(r.taxa_cc)}</TableCell>
                        <TableCell className={`text-right ${fOk ? "text-success font-medium" : ""}`}>{fmtPct(r.taxa_final)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!windsorCanaisSorted.length && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Sem dados no período</TableCell></TableRow>
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
