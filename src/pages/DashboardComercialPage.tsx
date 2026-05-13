import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  CalendarIcon, DollarSign, ShoppingCart, Receipt, Target, Percent,
  TrendingDown, TrendingUp, ArrowUpRight, ArrowDownRight, Sparkles, Loader2,
  Package, AlertTriangle, Zap, CreditCard, Wallet,
} from "lucide-react";
import {
  format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  subMonths, subDays, eachDayOfInterval, isWeekend, parseISO, differenceInCalendarDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { callClaude } from "@/lib/claudeApi";
import { useMetasFinanceiras, useProdutos } from "@/hooks/useSupabase";

// ============ helpers ============
const fmtBRL = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));
const fmtNum = (n: number | null | undefined) => new Intl.NumberFormat("pt-BR").format(Number(n ?? 0));
const fmtPct = (n: number | null | undefined, d = 1) => `${Number(n ?? 0).toFixed(d)}%`;
const fmtData = (d: Date) => format(d, "dd/MM/yyyy");

const CHANNEL_COLORS = ["hsl(38, 60%, 50%)", "hsl(152, 60%, 40%)", "hsl(220, 60%, 50%)", "hsl(280, 60%, 50%)", "hsl(0, 72%, 51%)", "hsl(200, 70%, 50%)"];

type Periodo = "hoje" | "semana" | "mes" | "mes-anterior" | "personalizado";

// dias úteis (seg-sex) entre duas datas inclusivas
function diasUteis(de: Date, ate: Date) {
  if (ate < de) return 0;
  return eachDayOfInterval({ start: de, end: ate }).filter((d) => !isWeekend(d)).length;
}

// fetch all rows respecting Supabase 1000-row pagination limit
async function fetchAll<T = any>(table: string, build: (q: any) => any): Promise<T[]> {
  const acc: T[] = [];
  let from = 0;
  const size = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await build(supabase.from(table).select("*").range(from, from + size - 1));
    if (error) throw error;
    const rows = (data ?? []) as T[];
    acc.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return acc;
}

// ============ types ============
interface TrayOrder {
  id: number;
  date: string | null;
  total: number | null;
  discount: number | null;
  discount_coupon: string | null;
  payment_form: string | null;
  point_sale: string | null;
  orderstatus_status: string | null;
  orderstatus_type: string | null;
}

// extrai o valor de desconto do cupom no formato "NOME/24.90"
function parseCupomValor(s: string | null | undefined): number {
  if (!s) return 0;
  const parts = String(s).split("/");
  if (parts.length < 2) return 0;
  const n = parseFloat(parts[parts.length - 1].replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// soma desconto bruto + cupom
function descontoTotal(p: { discount: number | null; discount_coupon: string | null }): number {
  return Number(p.discount ?? 0) + parseCupomValor(p.discount_coupon);
}
interface TrayVariant {
  variant_id: number;
  variant_product_id: number | null;
  variant_stock: number | null;
  variant_quantity_sold: number | null;
  variant_price: number | null;
  variant_sku: string | null;
}

// ============ component ============
export default function DashboardComercialPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [aiInsights, setAiInsights] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);

  const { dataInicio, dataFim, label } = useMemo(() => {
    const hoje = new Date();
    if (periodo === "hoje") return { dataInicio: startOfDay(hoje), dataFim: endOfDay(hoje), label: "Hoje" };
    if (periodo === "semana") return { dataInicio: startOfWeek(hoje, { weekStartsOn: 1 }), dataFim: endOfWeek(hoje, { weekStartsOn: 1 }), label: "Esta semana" };
    if (periodo === "mes") return { dataInicio: startOfMonth(hoje), dataFim: endOfMonth(hoje), label: "Este mês" };
    if (periodo === "mes-anterior") {
      const ant = subMonths(hoje, 1);
      return { dataInicio: startOfMonth(ant), dataFim: endOfMonth(ant), label: "Mês anterior" };
    }
    const di = customRange.from ?? startOfMonth(hoje);
    const df = customRange.to ?? endOfMonth(hoje);
    return { dataInicio: startOfDay(di), dataFim: endOfDay(df), label: `${fmtData(di)} – ${fmtData(df)}` };
  }, [periodo, customRange]);

  // período comparativo (mesma duração imediatamente anterior)
  const { compInicio, compFim } = useMemo(() => {
    const dur = differenceInCalendarDays(dataFim, dataInicio);
    return {
      compInicio: subDays(dataInicio, dur + 1),
      compFim: subDays(dataInicio, 1),
    };
  }, [dataInicio, dataFim]);

  // ===== fetch pedidos do período + período anterior (juntos) =====
  const { data: pedidos = [], isLoading: loadPedidos } = useQuery({
    queryKey: ["dash-comercial-pedidos", dataInicio.toISOString(), dataFim.toISOString(), compInicio.toISOString()],
    queryFn: async () => {
      return await fetchAll<TrayOrder>("tray_orders", (q) =>
        q.gte("date", format(compInicio, "yyyy-MM-dd"))
         .lte("date", format(dataFim, "yyyy-MM-dd"))
         .neq("orderstatus_type", "canceled")
         .order("date", { ascending: false })
      );
    },
  });

  // ===== fetch variants (apenas para estoque) =====
  const { data: variants = [], isLoading: loadVar } = useQuery({
    queryKey: ["dash-comercial-variants"],
    queryFn: async () => fetchAll<TrayVariant>("tray_products_variants", (q) => q),
  });

  // ===== fetch detalhes de pedidos (para preço médio de venda por produto) =====
  const { data: detalhes = [] } = useQuery({
    queryKey: ["dash-comercial-detalhes"],
    queryFn: async () =>
      fetchAll<{ product_id: number | null; quantity: number | null; price: number | null; discount: number | null }>(
        "tray_orders_detalhes",
        (q) => q
      ),
  });

  // ===== fetch produtos vendidos (tray_productssold) — para top produtos =====
  const { data: productssold = [] } = useQuery({
    queryKey: ["dash-comercial-productssold"],
    queryFn: async () =>
      fetchAll<{
        order_id: string | null;
        product_id: string | null;
        variant_id: string | null;
        name: string | null;
        model: string | null;
        reference: string | null;
        price: number | null;
        cost_price: number | null;
        quantity: number | null;
      }>("tray_productssold", (q) => q),
  });

  const { data: metas = [] } = useMetasFinanceiras();
  const { data: produtos = [] } = useProdutos();

  // ===== métricas =====
  const noPeriodo = useMemo(
    () => pedidos.filter((p) => p.date && p.date >= format(dataInicio, "yyyy-MM-dd") && p.date <= format(dataFim, "yyyy-MM-dd")),
    [pedidos, dataInicio, dataFim]
  );
  const noComp = useMemo(
    () => pedidos.filter((p) => p.date && p.date >= format(compInicio, "yyyy-MM-dd") && p.date <= format(compFim, "yyyy-MM-dd")),
    [pedidos, compInicio, compFim]
  );

  const sum = (arr: TrayOrder[], k: keyof TrayOrder) => arr.reduce((a, b) => a + Number((b[k] as number) ?? 0), 0);
  const receitaBruta = sum(noPeriodo, "total");
  const receitaComp = sum(noComp, "total");
  const totalPedidos = noPeriodo.length;
  const pedidosComp = noComp.length;
  const totalDesconto = noPeriodo.reduce((a, b) => a + descontoTotal(b), 0);
  const descontoComp = noComp.reduce((a, b) => a + descontoTotal(b), 0);
  const ticketMedio = totalPedidos > 0 ? receitaBruta / totalPedidos : 0;
  const ticketMedioComp = pedidosComp > 0 ? receitaComp / pedidosComp : 0;
  const descontoMedio = totalPedidos > 0 ? totalDesconto / totalPedidos : 0;
  const descontoPct = receitaBruta > 0 ? (totalDesconto / receitaBruta) * 100 : 0;
  const receitaLiquida = receitaBruta - totalDesconto;
  const receitaLiquidaComp = receitaComp - descontoComp;

  // ===== meta do mês atual =====
  const metaAtual = useMemo(() => {
    const hojeMes = format(new Date(), "yyyy-MM");
    return metas.find((m: any) => (m.mes ?? "").startsWith(hojeMes));
  }, [metas]);
  const metaMensal = Number(metaAtual?.meta_mensal ?? 0);
  const metaTicket = Number(metaAtual?.meta_ticket_medio ?? 0);
  const diasUteisMes = Number(metaAtual?.dias_uteis ?? diasUteis(startOfMonth(new Date()), endOfMonth(new Date())));

  // realizado mês p/ progresso da meta (independente do período selecionado)
  const realizadoMes = useMemo(() => {
    const ini = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const fim = format(endOfMonth(new Date()), "yyyy-MM-dd");
    return pedidos
      .filter((p) => p.date && p.date >= ini && p.date <= fim)
      .reduce((a, b) => a + Number(b.total ?? 0), 0);
  }, [pedidos]);

  const pctMeta = metaMensal > 0 ? (realizadoMes / metaMensal) * 100 : 0;
  const faltaMeta = Math.max(metaMensal - realizadoMes, 0);
  const hoje = new Date();
  const diasUteisPassados = diasUteis(startOfMonth(hoje), hoje);
  const diasUteisRestantes = Math.max(diasUteisMes - diasUteisPassados, 0);
  const metaDiariaHoje = diasUteisRestantes > 0 ? faltaMeta / diasUteisRestantes : 0;

  // ===== série diária =====
  const serieDiaria = useMemo(() => {
    const dias = eachDayOfInterval({ start: dataInicio, end: dataFim });
    return dias.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const dia = noPeriodo.filter((p) => p.date === key);
      const receita = dia.reduce((a, b) => a + Number(b.total ?? 0), 0);
      return {
        data: format(d, "dd/MM"),
        receita,
        meta: isWeekend(d) ? 0 : metaDiariaHoje,
      };
    });
  }, [noPeriodo, dataInicio, dataFim, metaDiariaHoje]);

  // ===== canais (point_sale) =====
  const canais = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number; pedidos: number }>();
    for (const p of noPeriodo) {
      const raw = (p.point_sale ?? "").trim();
      const nome = raw ? raw : "Não informado";
      const cur = map.get(nome) ?? { nome, valor: 0, pedidos: 0 };
      cur.valor += Number(p.total ?? 0);
      cur.pedidos += 1;
      map.set(nome, cur);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.valor - a.valor);
    const total = arr.reduce((a, b) => a + b.valor, 0);
    return arr.map((c) => ({ ...c, pct: total > 0 ? (c.valor / total) * 100 : 0 }));
  }, [noPeriodo]);

  // ===== detalhe por canal (faturamento, ticket médio, desconto) =====
  const canaisDetalhe = useMemo(() => {
    const map = new Map<string, { nome: string; faturamento: number; pedidos: number; desconto: number }>();
    for (const p of noPeriodo) {
      const raw = (p.point_sale ?? "").trim();
      const nome = raw ? raw : "Não informado";
      const cur = map.get(nome) ?? { nome, faturamento: 0, pedidos: 0, desconto: 0 };
      cur.faturamento += Number(p.total ?? 0);
      cur.pedidos += 1;
      cur.desconto += descontoTotal(p);
      map.set(nome, cur);
    }
    return Array.from(map.values())
      .map((c) => ({
        ...c,
        ticketMedio: c.pedidos > 0 ? c.faturamento / c.pedidos : 0,
        descontoPct: c.faturamento > 0 ? (c.desconto / c.faturamento) * 100 : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [noPeriodo]);

  // ===== top produtos (tray_productssold filtrado pelo período) =====
  const topProdutos = useMemo(() => {
    const orderIds = new Set(noPeriodo.map((p) => String(p.id)));
    const byProduct = new Map<string, { nome: string; vendido: number; receita: number; product_id: string }>();
    for (const s of productssold) {
      if (!s.order_id || !orderIds.has(String(s.order_id))) continue;
      const k = String(s.product_id ?? "");
      if (!k) continue;
      const qtd = Number(s.quantity ?? 0);
      const receita = Number(s.price ?? 0) * qtd;
      const nome = (s.model || s.name?.split("<br>")[0] || s.reference || `#${k}`).trim();
      const cur = byProduct.get(k) ?? { nome, vendido: 0, receita: 0, product_id: k };
      cur.vendido += qtd;
      cur.receita += receita;
      byProduct.set(k, cur);
    }
    // estoque a partir das variants
    const estoquePor = new Map<string, number>();
    for (const v of variants) {
      const k = String(v.variant_product_id ?? "");
      estoquePor.set(k, (estoquePor.get(k) ?? 0) + Number(v.variant_stock ?? 0));
    }
    return Array.from(byProduct.values())
      .map((p) => ({
        ...p,
        estoque: estoquePor.get(p.product_id) ?? 0,
        preco: p.vendido > 0 ? p.receita / p.vendido : 0,
      }))
      .sort((a, b) => b.vendido - a.vendido)
      .slice(0, 10);
  }, [productssold, noPeriodo, variants]);

  // preço médio de venda por bling_produto_id (líquido de desconto, ponderado por quantidade)
  const precoMedioPorProduto = useMemo(() => {
    const map = new Map<string, { receita: number; qtd: number }>();
    for (const d of detalhes) {
      const k = String(d.product_id ?? "");
      if (!k) continue;
      const qtd = Number(d.quantity ?? 0);
      const receita = (Number(d.price ?? 0) - Number(d.discount ?? 0)) * qtd;
      const cur = map.get(k) ?? { receita: 0, qtd: 0 };
      cur.receita += receita;
      cur.qtd += qtd;
      map.set(k, cur);
    }
    const out = new Map<string, number>();
    for (const [k, v] of map.entries()) out.set(k, v.qtd > 0 ? v.receita / v.qtd : 0);
    return out;
  }, [detalhes]);

  const lucrativos = useMemo(
    () =>
      [...produtos]
        .filter((p: any) => p.ativo)
        .map((p: any) => ({
          ...p,
          preco_venda_medio: precoMedioPorProduto.get(String(p.bling_produto_id ?? "")) ?? 0,
        }))
        .sort((a: any, b: any) => Number(b.margem_real_percentual ?? 0) - Number(a.margem_real_percentual ?? 0))
        .slice(0, 10),
    [produtos, precoMedioPorProduto]
  );

  // ===== sugestões de produção =====
  const sugestoes = useMemo(() => {
    const dias = Math.max(differenceInCalendarDays(dataFim, dataInicio) + 1, 1);
    return topProdutos
      .filter((p) => p.estoque < 5 && p.vendido > 0)
      .map((p) => {
        const mediaDia = p.vendido / dias;
        const sugestao = Math.max(Math.ceil(mediaDia * 30), 30);
        return { ...p, mediaDia, sugestao };
      })
      .slice(0, 6);
  }, [topProdutos, dataInicio, dataFim]);

  // ===== IA =====
  const gerarInsights = async () => {
    setLoadingAi(true);
    setAiInsights("");
    try {
      const contexto = {
        periodo: label,
        receitaBruta, totalPedidos, ticketMedio,
        metaMensal, percentualMeta: Number(pctMeta.toFixed(1)),
        diasRestantes: diasUteisRestantes, metaDiariaHoje,
        descontoMedio, descontoPercentual: Number(descontoPct.toFixed(2)),
        topProdutos: topProdutos.slice(0, 5),
        estoquesCriticos: sugestoes,
        canaisVenda: canais,
      };
      const prompt = `Você é um consultor de e-commerce especializado em moda feminina brasileira.
Analise os dados de vendas abaixo e forneça 3-5 insights acionáveis e específicos.

Dados: ${JSON.stringify(contexto)}

Foque em:
1. Performance vs meta (o que fazer para atingir a meta)
2. Produtos com estoque crítico (urgência de produção)
3. Canal de vendas com melhor performance
4. Desconto médio (está alto ou adequado?)
5. Sugestão de ação para hoje

Seja direto e específico. Use valores reais dos dados. Responda em português.`;
      const resp = await callClaude(prompt);
      setAiInsights(resp);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar insights");
    } finally {
      setLoadingAi(false);
    }
  };

  const Delta = ({ atual, anterior, invert = false, fmt }: { atual: number; anterior: number; invert?: boolean; fmt?: (n: number) => string }) => {
    if (anterior === 0 && atual === 0) return <span className="text-xs text-muted-foreground">—</span>;
    const diff = atual - anterior;
    const pct = anterior !== 0 ? (diff / Math.abs(anterior)) * 100 : 100;
    const positivo = invert ? diff < 0 : diff > 0;
    const Icon = positivo ? ArrowUpRight : ArrowDownRight;
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <span className={cn("inline-flex items-center gap-0.5 font-medium", positivo ? "text-success" : "text-danger")}>
          <Icon className="h-3 w-3" />
          {fmtPct(Math.abs(pct))}
        </span>
        {fmt && <span className="text-muted-foreground">· {fmt(anterior)}</span>}
      </span>
    );
  };

  const loading = loadPedidos || loadVar;

  return (
    <div className="space-y-6 pb-12">
      {/* SEÇÃO 1 — header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Dashboard Comercial</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <CalendarIcon className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            <span className="font-medium text-foreground">{fmtData(hoje)}</span>
            <span className="mx-2">•</span>
            <span>Período: <strong>{label}</strong></span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["hoje", "Hoje"],
            ["semana", "Esta semana"],
            ["mes", "Este mês"],
            ["mes-anterior", "Mês anterior"],
          ] as const).map(([k, l]) => (
            <Button key={k} size="sm" variant={periodo === k ? "default" : "outline"} onClick={() => setPeriodo(k)}>
              {l}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={periodo === "personalizado" ? "default" : "outline"}>
                <CalendarIcon className="h-4 w-4 mr-1.5" /> Personalizado
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                locale={ptBR}
                selected={customRange as any}
                onSelect={(r: any) => { setCustomRange(r ?? {}); if (r?.from && r?.to) setPeriodo("personalizado"); }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={gerarInsights} disabled={loadingAi} className="bg-primary text-primary-foreground">
            {loadingAi ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            Gerar insights com IA
          </Button>
        </div>
      </motion.div>

      {/* SEÇÃO 2 — KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Receita Bruta" value={fmtBRL(receitaBruta)} delta={<Delta atual={receitaBruta} anterior={receitaComp} fmt={fmtBRL} />} sub="vs período anterior" />
        <KpiCard icon={ShoppingCart} label="Nº de Pedidos" value={`${fmtNum(totalPedidos)} pedidos`} delta={<Delta atual={totalPedidos} anterior={pedidosComp} fmt={(n) => `${fmtNum(n)} ped.`} />} sub="vs período anterior" />
        <KpiCard icon={Receipt} label="Ticket Médio" value={fmtBRL(ticketMedio)} delta={<Delta atual={ticketMedio} anterior={metaTicket || ticketMedioComp} fmt={fmtBRL} />} sub={metaTicket ? `meta ${fmtBRL(metaTicket)}` : "vs período anterior"} />
        <KpiCard icon={Target} label="Meta do Mês" value={fmtPct(pctMeta)} delta={<span className="text-xs text-muted-foreground">faltam {fmtBRL(faltaMeta)}</span>} sub={`de ${fmtBRL(metaMensal)}`} progress={Math.min(pctMeta, 100)} />

        <KpiCard icon={Percent} label="Desconto Médio" value={`${fmtBRL(descontoMedio)} (${fmtPct(descontoPct)})`} delta={<Delta atual={descontoMedio} anterior={pedidosComp > 0 ? descontoComp / pedidosComp : 0} invert fmt={fmtBRL} />} sub="vs período anterior" />
        <KpiCard icon={TrendingDown} label="Desconto Total" value={fmtBRL(totalDesconto)} delta={<Delta atual={totalDesconto} anterior={descontoComp} invert fmt={fmtBRL} />} sub="inclui cupons" />
        <KpiCard icon={Wallet} label="Receita Líquida" value={fmtBRL(receitaLiquida)} delta={<Delta atual={receitaLiquida} anterior={receitaLiquidaComp} fmt={fmtBRL} />} sub="vs período anterior" />
        <KpiCard icon={Zap} label="Meta Diária" value={fmtBRL(metaDiariaHoje)} delta={<span className="text-xs text-muted-foreground">{diasUteisRestantes} dias úteis</span>} sub="necessário hoje" />
      </div>

      {/* SEÇÃO 3 — gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-serif">Evolução de vendas</CardTitle>
            <p className="text-xs text-muted-foreground">Receita diária vs meta diária necessária</p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serieDiaria} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                  <XAxis dataKey="data" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => fmtBRL(Number(v))}
                  />
                  <Area type="monotone" dataKey="receita" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#grad)" />
                  {metaDiariaHoje > 0 && (
                    <ReferenceLine y={metaDiariaHoje} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Meta diária", position: "right", fill: "hsl(var(--destructive))", fontSize: 10, fontWeight: 600 }} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Vendas por canal</CardTitle>
            <p className="text-xs text-muted-foreground">Distribuição da receita por origem</p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {canais.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem vendas no período</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={canais} dataKey="valor" nameKey="nome" innerRadius={50} outerRadius={90} paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}>
                      {canais.map((_, i) => <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any, _n: any, p: any) => [`${fmtBRL(Number(v))} • ${fmtPct(p?.payload?.pct ?? 0)}`, p?.payload?.nome]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO 3.5 — Detalhamento por canal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalhamento por canal
            <Badge variant="secondary" className="ml-2 font-normal">{canaisDetalhe.length} canais</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">% Desc.</TableHead>
                <TableHead className="text-right">Participação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {canaisDetalhe.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem vendas no período</TableCell></TableRow>
              ) : canaisDetalhe.map((c, i) => {
                const totFat = canaisDetalhe.reduce((a, b) => a + b.faturamento, 0);
                const part = totFat > 0 ? (c.faturamento / totFat) * 100 : 0;
                return (
                  <TableRow key={c.nome}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }} />
                      {c.nome}
                    </TableCell>
                    <TableCell className="text-right">{fmtNum(c.pedidos)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtBRL(c.faturamento)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(c.ticketMedio)}</TableCell>
                    <TableCell className="text-right text-danger">{c.desconto > 0 ? `−${fmtBRL(c.desconto)}` : "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtPct(c.descontoPct)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground w-12 text-right">{fmtPct(part)}</span>
                        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(part, 100)}%`, background: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SEÇÃO 4 — tabelas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-lg font-serif flex items-center gap-2"><Package className="h-5 w-5" /> Produtos mais vendidos</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProdutos.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
                ) : topProdutos.map((p, i) => {
                  const status = p.estoque < 5 ? { l: "Crítico", c: "bg-danger/15 text-danger" } : p.estoque <= 20 ? { l: "Baixo", c: "bg-warning/15 text-warning" } : { l: "OK", c: "bg-success/15 text-success" };
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell className="text-right">{fmtNum(p.vendido)}</TableCell>
                      <TableCell className="text-right">{fmtNum(p.estoque)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(p.preco)}</TableCell>
                      <TableCell className="text-center"><Badge className={cn("border-0", status.c)}>{status.l}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg font-serif flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Produtos mais lucrativos</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Venda média</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lucrativos.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
                ) : lucrativos.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome_do_produto}</TableCell>
                    <TableCell className="text-right">
                      {p.preco_venda_medio > 0 ? fmtBRL(p.preco_venda_medio) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-success">{fmtPct(p.margem_real_percentual)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO 5 — sugestões + IA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-lg font-serif flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Sugestões de produção</CardTitle></CardHeader>
          <CardContent>
            {sugestoes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum produto em situação crítica.</p>
            ) : (
              <ul className="space-y-3">
                {sugestoes.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-foreground">{s.nome}</p>
                      <p className="text-muted-foreground">
                        Estoque crítico ({fmtNum(s.estoque)} un). Média de venda: {s.mediaDia.toFixed(1)}/dia.
                      </p>
                      <p className="text-foreground mt-0.5">
                        Sugestão: produzir <strong>{fmtNum(s.sugestao)} unidades</strong>.
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg font-serif flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Insights de IA</CardTitle></CardHeader>
          <CardContent>
            {loadingAi ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analisando dados…</p>
              </div>
            ) : aiInsights ? (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {aiInsights}
              </div>
            ) : (
              <div className="text-center py-8">
                <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground mb-4">Clique em "Gerar insights com IA" para receber recomendações personalizadas.</p>
                <Button size="sm" onClick={gerarInsights} variant="outline">
                  <Sparkles className="h-4 w-4 mr-1.5" /> Gerar agora
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {loading && (
        <div className="fixed bottom-4 right-4 bg-card border rounded-lg px-3 py-2 shadow-lg flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Atualizando…
        </div>
      )}
    </div>
  );
}

// ============ KPI Card ============
function KpiCard({
  icon: Icon, label, value, delta, sub, progress,
}: {
  icon: any; label: string; value: string; delta?: React.ReactNode; sub?: string; progress?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="h-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-serif font-bold text-foreground">{value}</div>
          <div className="flex items-center justify-between mt-1">
            {delta}
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          </div>
          {typeof progress === "number" && <Progress value={progress} className="h-1.5 mt-2" />}
        </CardContent>
      </Card>
    </motion.div>
  );
}
