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
import { AcompanhamentoMeta, DiagnosticoMes, ComoFecharMeta } from "@/components/marketing/AcompanhamentoMeta";
import { MESES } from "@/hooks/usePlanejamentoMensal";

const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtInt = (n: number) => Math.round(n || 0).toLocaleString("pt-BR");
const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;

const getDateRangeGA4 = (periodo: string) => {
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
    mai2026: { inicio: "20260501", fim: "20260531" },
    jun2026: { inicio: "20260601", fim: "20260630" },
    jul2026: { inicio: "20260701", fim: "20260731" },
  };
  return (
    meses[periodo] ?? {
      inicio: toYMD(new Date(new Date().setDate(hoje.getDate() - 30))),
      fim: toYMD(hoje),
    }
  );
};

const getDateRangeWindsor = (periodo: string) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hoje = new Date();

  if (periodo === "7dias") {
    const ini = new Date(); ini.setDate(hoje.getDate() - 7);
    return { inicio: toISO(ini), fim: toISO(hoje) };
  }
  if (periodo === "30dias") {
    const ini = new Date(); ini.setDate(hoje.getDate() - 30);
    return { inicio: toISO(ini), fim: toISO(hoje) };
  }
  if (periodo === "90dias") {
    const ini = new Date(); ini.setDate(hoje.getDate() - 90);
    return { inicio: toISO(ini), fim: toISO(hoje) };
  }
  const meses: Record<string, { inicio: string; fim: string }> = {
    mar2026: { inicio: "2026-03-01", fim: "2026-03-31" },
    abr2026: { inicio: "2026-04-01", fim: "2026-04-30" },
    mai2026: { inicio: "2026-05-01", fim: "2026-05-31" },
    jun2026: { inicio: "2026-06-01", fim: "2026-06-30" },
    jul2026: { inicio: "2026-07-01", fim: "2026-07-31" },
  };
  return (
    meses[periodo] ?? {
      inicio: toISO(new Date(new Date().setDate(hoje.getDate() - 30))),
      fim: toISO(hoje),
    }
  );
};

const PERIODOS_BASE = [
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "90dias", label: "Últimos 90 dias" },
  { value: "mai2026", label: "Maio 2026" },
  { value: "jun2026", label: "Junho 2026" },
  { value: "jul2026", label: "Julho 2026" },
];

const PERIODOS_EXT = [
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "90dias", label: "Últimos 90 dias" },
  { value: "mar2026", label: "Março 2026" },
  { value: "abr2026", label: "Abril 2026" },
  { value: "mai2026", label: "Maio 2026" },
  { value: "jun2026", label: "Junho 2026" },
  { value: "jul2026", label: "Julho 2026" },
];

const num = (v: any) => (typeof v === "number" ? v : Number(v) || 0);

export default function Marketing() {
  const [periodoPaginas, setPeriodoPaginas] = useState("30dias");
  const [periodoProdutos, setPeriodoProdutos] = useState("30dias");
  const [periodoCanais, setPeriodoCanais] = useState("30dias");
  const [periodoMeta, setPeriodoMeta] = useState("30dias");
  const hoje = new Date();
  const [metaAno, setMetaAno] = useState(hoje.getFullYear());
  const [metaMes, setMetaMes] = useState(hoje.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [aquisicao, setAquisicao] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [funil, setFunil] = useState<any[]>([]);
  const [paginas, setPaginas] = useState<any[]>([]);
  const [windsorProdutos, setWindsorProdutos] = useState<any[]>([]);
  const [windsorCanais, setWindsorCanais] = useState<any[]>([]);
  const [metaAds, setMetaAds] = useState<any[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

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

  // ===== Páginas (GA4) =====
  useEffect(() => {
    const { inicio, fim } = getDateRangeGA4(periodoPaginas);
    setLoading(true);
    Promise.all([
      supabase.from("ga4_aquisicao_canais").select("*").gte("event_date", inicio).lte("event_date", fim),
      supabase.from("ga4_produtos_ecommerce").select("*").gte("event_date", inicio).lte("event_date", fim),
      supabase.from("ga4_funil_compra").select("*").gte("event_date", inicio).lte("event_date", fim),
      supabase.from("ga4_sessoes_paginas").select("pagina, titulo, sessoes").gte("event_date", inicio).lte("event_date", fim),
    ])
      .then(([a, p, f, pg]: any[]) => {
        setAquisicao(a.data || []);
        setProdutos(p.data || []);
        setFunil(f.data || []);
        setPaginas(pg.data || []);
      })
      .finally(() => setLoading(false));
  }, [periodoPaginas]);

  // ===== Windsor Produtos =====
  useEffect(() => {
    const { inicio: ini, fim } = getDateRangeWindsor(periodoProdutos);
    fetchAll("windsor_produtos", "date", ini, fim, "date, item_name, sessions, items_viewed, items_added_to_cart, items_purchased, item_revenue")
      .then((rows) => setWindsorProdutos(rows))
      .catch(() => setWindsorProdutos([]));
  }, [periodoProdutos]);

  // ===== Windsor Canais =====
  useEffect(() => {
    const { inicio: ini, fim } = getDateRangeWindsor(periodoCanais);
    fetchAll("windsor_canais", "date", ini, fim, "date, session_custom_channel_group, sessions, add_to_carts, checkouts, items_purchased, purchase_revenue")
      .then((rows) => setWindsorCanais(rows))
      .catch(() => setWindsorCanais([]));
  }, [periodoCanais]);

  // ===== Meta Ads =====
  useEffect(() => {
    const { inicio: ini, fim } = getDateRangeWindsor(periodoMeta);
    setLoadingMeta(true);
    fetchAll("windsor_meta_ads", "date", ini, fim, "date, campaign, spend, clicks, cpc, cpm, ctr, purchase_roas, actions_add_to_cart, actions_initiate_checkout, actions_video_view, actions_purchase, action_values_purchase")
      .then((rows) => setMetaAds(rows))
      .catch(() => setMetaAds([]))
      .finally(() => setLoadingMeta(false));
  }, [periodoMeta]);

  const metaAdsTotais = useMemo(() => {
    const t = metaAds.reduce(
      (a, r) => {
        a.spend += num(r.spend);
        a.clicks += num(r.clicks);
        a.compras += num(r.actions_purchase);
        a.receita += num(r.action_values_purchase);
        return a;
      },
      { spend: 0, clicks: 0, compras: 0, receita: 0 }
    );
    return {
      spend: t.spend,
      clicks: t.clicks,
      compras: t.compras,
      receita: t.receita,
      cpc: t.clicks > 0 ? t.spend / t.clicks : 0,
      roas: t.spend > 0 ? t.receita / t.spend : 0,
    };
  }, [metaAds]);

  const metaAdsDaily = useMemo(() => {
    const map = new Map<string, { spend: number; receita: number }>();
    for (const r of metaAds) {
      const d = r.date;
      const cur = map.get(d) || { spend: 0, receita: 0 };
      cur.spend += num(r.spend);
      cur.receita += num(r.action_values_purchase);
      map.set(d, cur);
    }
    return [...map.entries()]
      .map(([date, v]) => ({ date, spend: v.spend, receita: v.receita }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metaAds]);

  // ===== Constantes de eficiência =====
  const MARGEM_BRUTA = 0.5;
  const ROAS_EQUILIBRIO = 2.0;
  const ROAS_SAUDAVEL = 4.0;
  const TICKET_MEDIO = 320;

  const metaAdsCampanhas = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of metaAds) {
      const key = r.campaign || "—";
      const cur =
        map.get(key) || {
          campaign: key,
          spend: 0,
          clicks: 0,
          add_to_cart: 0,
          checkout: 0,
          compras: 0,
          receita: 0,
          ctr_latest: null as number | null,
        };
      cur.spend += num(r.spend);
      cur.clicks += num(r.clicks);
      cur.add_to_cart += num(r.actions_add_to_cart);
      cur.checkout += num(r.actions_initiate_checkout);
      cur.compras += num(r.actions_purchase);
      cur.receita += num(r.action_values_purchase);
      if (cur.ctr_latest === null && r.ctr != null) cur.ctr_latest = num(r.ctr);
      map.set(key, cur);
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
        ctr: r.ctr_latest ?? 0,
        roas: r.spend > 0 ? r.receita / r.spend : 0,
        cpa: r.compras > 0 ? r.spend / r.compras : 0,
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [metaAds]);

  // ===== Matriz de Eficiência de Campanhas =====
  const matrizCampanhas = useMemo(() => {
    const todas = metaAdsCampanhas.map((c) => ({
      campaign: c.campaign,
      spend: c.spend,
      clicks: c.clicks,
      roas: c.roas,
      receita_atribuida: c.receita_atribuida,
    }));
    const semAtribuicao = todas.filter((c) => c.roas === 0);
    const comAtribuicao = todas.filter((c) => c.roas > 0);

    const clicksOrdenados = [...comAtribuicao.map((a) => a.clicks)].sort((a, b) => a - b);
    let mediana = 0;
    if (clicksOrdenados.length) {
      const m = Math.floor(clicksOrdenados.length / 2);
      mediana =
        clicksOrdenados.length % 2 === 0
          ? (clicksOrdenados[m - 1] + clicksOrdenados[m]) / 2
          : clicksOrdenados[m];
    }
    const classify = (roas: number, clicks: number) => {
      if (roas >= ROAS_SAUDAVEL && clicks >= mediana) return "estrelas";
      if (roas >= ROAS_SAUDAVEL && clicks < mediana) return "escalar";
      if (roas < ROAS_SAUDAVEL && clicks >= mediana) return "corrigir";
      return "observar";
    };
    const spendMax = Math.max(...comAtribuicao.map((a) => a.spend), 1);
    const dados = comAtribuicao.map((a) => ({
      ...a,
      classificacao: classify(a.roas, a.clicks),
      tamanho: 8 + (a.spend / spendMax) * 16,
    }));
    return { dados, mediana, semAtribuicao };
  }, [metaAdsCampanhas]);


  const QUADRANTES: Record<string, { label: string; emoji: string; color: string; acao: string }> = {
    estrelas: { label: "Estrelas", emoji: "⭐", color: "#22c55e", acao: "🟢 Manter e escalar com segurança" },
    escalar: { label: "Escalar", emoji: "📈", color: "#3b82f6", acao: "🟢 Aumentar verba — alta eficiência subexposta" },
    corrigir: { label: "Corrigir", emoji: "❗", color: "#ef4444", acao: "🔴 Revisar criativos ou página antes de escalar" },
    observar: { label: "Observar", emoji: "👁", color: "#6b7280", acao: "⚫ Aguardar mais dados ou pausar" },
  };



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


  const renderPeriodo = (value: string, onChange: (v: string) => void, options: { value: string; label: string }[]) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((p) => (
          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-serif font-bold">Marketing</h1>
      </div>

      <Tabs defaultValue="acompanhamento">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="acompanhamento">Acompanhamento da Meta</TabsTrigger>
          <TabsTrigger value="paginas">Páginas</TabsTrigger>
          <TabsTrigger value="windsor-produtos">Produtos - Mariana Cardoso</TabsTrigger>
          <TabsTrigger value="windsor-canais">Sessões por Canal - Mariana Cardoso</TabsTrigger>
          <TabsTrigger value="meta-ads">Meta Ads</TabsTrigger>
        </TabsList>

        {/* ===== ACOMPANHAMENTO DA META ===== */}
        <TabsContent value="acompanhamento" className="space-y-6">
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Mês de referência da meta:</span>
            <Select value={String(metaMes)} onValueChange={(v) => setMetaMes(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((n, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(metaAno)} onValueChange={(v) => setMetaAno(Number(v))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AcompanhamentoMeta ano={metaAno} mes={metaMes} />
          <DiagnosticoMes ano={metaAno} mes={metaMes} />
          <ComoFecharMeta ano={metaAno} mes={metaMes} />

        </TabsContent>

        {/* ===== PÁGINAS ===== */}
        <TabsContent value="paginas" className="space-y-6">
          <div className="flex justify-end">
            {renderPeriodo(periodoPaginas, setPeriodoPaginas, PERIODOS_BASE)}
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados do GA4...
            </div>
          )}

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
          <div className="flex justify-end">
            {renderPeriodo(periodoProdutos, setPeriodoProdutos, PERIODOS_EXT)}
          </div>

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
          <div className="flex justify-end">
            {renderPeriodo(periodoCanais, setPeriodoCanais, PERIODOS_EXT)}
          </div>

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
        {/* ===== META ADS ===== */}
        <TabsContent value="meta-ads" className="space-y-6">
          <div className="flex justify-end">
            {renderPeriodo(periodoMeta, setPeriodoMeta, PERIODOS_EXT)}
          </div>

          {loadingMeta ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
              </div>
              <Skeleton className="h-[320px]" />
              <Skeleton className="h-[400px]" />
            </>
          ) : metaAds.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhum dado de Meta Ads encontrado para o período selecionado.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard title="Investimento Total" value={fmtBRL(metaAdsTotais.spend)} icon={DollarSign} variant="primary" />
                <StatCard title="Cliques" value={fmtInt(metaAdsTotais.clicks)} icon={MousePointerClick} />
                <StatCard title="CPC Médio" value={fmtBRL(metaAdsTotais.cpc)} icon={DollarSign} />
                <StatCard title="ROAS Médio" value={`${(metaAdsTotais.roas || 0).toFixed(1)}x`} icon={ShoppingBag} variant="success" />
              </div>

              <Card>
                <CardHeader><CardTitle className="text-lg">Investimento diário</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={metaAdsDaily} margin={{ left: 10, right: 20, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => fmtBRL(v)} tick={{ fontSize: 11 }} width={90} />
                      <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                      <Line type="monotone" dataKey="spend" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Performance por campanha</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campanha</TableHead>
                        <TableHead className="text-right">Investimento</TableHead>
                        <TableHead className="text-right">Cliques</TableHead>
                        <TableHead className="text-right">CPC</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">ROAS</TableHead>
                        <TableHead className="text-right">Add to Cart</TableHead>
                        <TableHead className="text-right">Checkout</TableHead>
                        <TableHead className="text-right">Valor de Compras</TableHead>
                        <TableHead className="text-right">Compras Est.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metaAdsCampanhas.map((r) => {
                        const roasColor =
                          r.roas === 0
                            ? { bg: "#6b728020", fg: "#6b7280", label: "Sem atrib." }
                            : r.roas >= 4
                            ? { bg: "#22c55e20", fg: "#16a34a", label: `${r.roas.toFixed(1)}x` }
                            : r.roas >= 2
                            ? { bg: "#eab30820", fg: "#a16207", label: `${r.roas.toFixed(1)}x` }
                            : { bg: "#ef444420", fg: "#dc2626", label: `${r.roas.toFixed(1)}x` };
                        return (
                          <TableRow key={r.campaign}>
                            <TableCell className="font-medium max-w-[320px] truncate">{r.campaign}</TableCell>
                            <TableCell className="text-right">{fmtBRL(r.spend)}</TableCell>
                            <TableCell className="text-right">{fmtInt(r.clicks)}</TableCell>
                            <TableCell className="text-right">{fmtBRL(r.cpc)}</TableCell>
                            <TableCell className="text-right">{(r.ctr || 0).toFixed(2)}%</TableCell>
                            <TableCell className="text-right">
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ backgroundColor: roasColor.bg, color: roasColor.fg }}
                              >
                                {roasColor.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{fmtInt(r.add_to_cart)}</TableCell>
                            <TableCell className="text-right">{fmtInt(r.checkout)}</TableCell>
                            <TableCell className="text-right">{fmtBRL(r.receita_atribuida)}</TableCell>
                            <TableCell className="text-right">{fmtInt(r.compras_estimadas)}</TableCell>
                          </TableRow>
                        );
                      })}

                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Matriz de Eficiência de Campanhas */}
              <Card>
                <CardHeader>
                  <CardTitle>Matriz de Eficiência de Campanhas</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    ROAS de Equilíbrio: 2,0x · ROAS Saudável: 4,0x · Margem Bruta: 50%
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Cards de resumo */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(["estrelas", "escalar", "corrigir", "observar"] as const).map((k) => {
                      const q = QUADRANTES[k];
                      const n = matrizCampanhas.dados.filter((d) => d.classificacao === k).length;
                      return (
                        <div
                          key={k}
                          className="rounded-lg border p-4"
                          style={{ borderColor: q.color, backgroundColor: `${q.color}10` }}
                        >
                          <div className="text-sm font-medium" style={{ color: q.color }}>
                            {q.emoji} {q.label}
                          </div>
                          <div className="text-2xl font-bold mt-1">{n}</div>
                          <div className="text-xs text-muted-foreground">campanhas</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Scatter Chart */}
                  <div className="h-[480px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 30, right: 40, bottom: 50, left: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          dataKey="clicks"
                          name="Cliques"
                          label={{ value: "Volume (Cliques)", position: "insideBottom", offset: -10 }}
                        />
                        <YAxis
                          type="number"
                          dataKey="roas"
                          name="ROAS"
                          label={{ value: "ROAS", angle: -90, position: "insideLeft" }}
                        />
                        <ZAxis type="number" dataKey="tamanho" range={[64, 576]} />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d: any = payload[0].payload;
                            const q = QUADRANTES[d.classificacao];
                            return (
                              <div className="rounded-md border bg-background p-3 shadow-md text-xs space-y-1">
                                <div className="font-medium max-w-[280px] truncate">{d.campaign}</div>
                                <div>ROAS: <span className="font-medium">{d.roas.toFixed(2)}x</span></div>
                                <div>Cliques: <span className="font-medium">{fmtInt(d.clicks)}</span></div>
                                <div>Investimento: <span className="font-medium">{fmtBRL(d.spend)}</span></div>
                                <div style={{ color: q.color }}>{q.emoji} {q.label}</div>
                              </div>
                            );
                          }}
                        />
                        <ReferenceLine
                          y={ROAS_SAUDAVEL}
                          stroke="#22c55e"
                          strokeDasharray="5 5"
                          label={{ value: "ROAS Saudável 4x", position: "insideTopRight", fill: "#22c55e", fontSize: 11 }}
                        />
                        <ReferenceLine
                          y={ROAS_EQUILIBRIO}
                          stroke="#ef4444"
                          strokeDasharray="5 5"
                          label={{ value: "Equilíbrio 2x", position: "insideTopRight", fill: "#ef4444", fontSize: 11 }}
                        />
                        <ReferenceLine
                          x={matrizCampanhas.mediana}
                          stroke="#6b7280"
                          strokeDasharray="5 5"
                          label={{ value: "Volume médio", position: "top", fill: "#6b7280", fontSize: 11 }}
                        />
                        <Scatter data={matrizCampanhas.dados}>
                          {matrizCampanhas.dados.map((d, i) => (
                            <Cell key={i} fill={QUADRANTES[d.classificacao].color} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                    {/* Labels dos quadrantes */}
                    <div className="pointer-events-none absolute top-2 right-4 text-xs font-medium" style={{ color: "#22c55e" }}>⭐ Estrelas</div>
                    <div className="pointer-events-none absolute top-2 left-16 text-xs font-medium" style={{ color: "#3b82f6" }}>📈 Escalar</div>
                    <div className="pointer-events-none absolute bottom-12 right-4 text-xs font-medium" style={{ color: "#ef4444" }}>❗ Corrigir</div>
                    <div className="pointer-events-none absolute bottom-12 left-16 text-xs font-medium" style={{ color: "#6b7280" }}>👁 Observar</div>
                  </div>

                  {matrizCampanhas.semAtribuicao.length > 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      * {matrizCampanhas.semAtribuicao.length} campanha{matrizCampanhas.semAtribuicao.length > 1 ? "s" : ""} sem atribuição de conversão (Leads/Engajamento) foram excluídas da matriz.
                    </p>
                  )}

                  {/* Tabela de Ação */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campanha</TableHead>
                          <TableHead>Classificação</TableHead>
                          <TableHead className="text-right">Investimento</TableHead>
                          <TableHead className="text-right">Cliques</TableHead>
                          <TableHead className="text-right">ROAS</TableHead>
                          <TableHead>Ação Recomendada</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...matrizCampanhas.dados].sort((a, b) => b.roas - a.roas).map((d) => {
                          const q = QUADRANTES[d.classificacao];
                          return (
                            <TableRow key={d.campaign}>
                              <TableCell className="font-medium max-w-[280px] truncate">{d.campaign}</TableCell>
                              <TableCell>
                                <span
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                  style={{ backgroundColor: `${q.color}20`, color: q.color }}
                                >
                                  {q.emoji} {q.label}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{fmtBRL(d.spend)}</TableCell>
                              <TableCell className="text-right">{fmtInt(d.clicks)}</TableCell>
                              <TableCell className="text-right">{d.roas.toFixed(2)}x</TableCell>
                              <TableCell className="text-sm">{q.acao}</TableCell>
                            </TableRow>
                          );
                        })}
                        {matrizCampanhas.dados.length > 0 && (() => {
                          const totSpend = matrizCampanhas.dados.reduce((a, d) => a + d.spend, 0);
                          const totClicks = matrizCampanhas.dados.reduce((a, d) => a + d.clicks, 0);
                          const totRoas = totSpend > 0
                            ? matrizCampanhas.dados.reduce((a, d) => a + d.spend * d.roas, 0) / totSpend
                            : 0;
                          return (
                            <TableRow className="font-semibold bg-muted/50">
                              <TableCell>Subtotal (com atribuição)</TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-right">{fmtBRL(totSpend)}</TableCell>
                              <TableCell className="text-right">{fmtInt(totClicks)}</TableCell>
                              <TableCell className="text-right">{totRoas.toFixed(2)}x</TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          );
                        })()}

                        {matrizCampanhas.semAtribuicao.length > 0 && (
                          <>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={6} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Campanhas sem atribuição de conversão
                              </TableCell>
                            </TableRow>
                            {[...matrizCampanhas.semAtribuicao].sort((a, b) => b.spend - a.spend).map((d) => (
                              <TableRow key={`sem-${d.campaign}`}>
                                <TableCell className="font-medium max-w-[280px] truncate">{d.campaign}</TableCell>
                                <TableCell>
                                  <span
                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                    style={{ backgroundColor: "#6b728020", color: "#6b7280" }}
                                  >
                                    Sem atrib.
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">{fmtBRL(d.spend)}</TableCell>
                                <TableCell className="text-right">{fmtInt(d.clicks)}</TableCell>
                                <TableCell className="text-right">—</TableCell>
                                <TableCell className="text-sm">⚪ Objetivo de topo de funil — avaliar custo por lead/engajamento separadamente</TableCell>
                              </TableRow>
                            ))}
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                </CardContent>
              </Card>
            </>

          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}
