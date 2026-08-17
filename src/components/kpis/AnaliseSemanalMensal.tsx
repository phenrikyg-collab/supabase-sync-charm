import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";

const OURO = "#C9A84C";

const fmtBRL = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));
const fmtNum = (n: number | null | undefined) => new Intl.NumberFormat("pt-BR").format(Math.round(Number(n ?? 0)));
const fmtPct = (n: number | null | undefined, d = 2) => `${Number(n ?? 0).toFixed(d)}%`.replace(".", ",");
const num = (v: any) => (typeof v === "number" ? v : Number(v ?? 0) || 0);

const CANCELADOS = ["canceled", "4"];

// ---------------------------------------------------------------- MOCKS
const MOCK_DIAS = [
  { date: "2026-08-17", pedidos: 14, receita: 3351.99, ticket_medio: 239.43, desconto_medio: 56.02, cancelados: 0, clientes_unicos: 14 },
  { date: "2026-08-16", pedidos: 11, receita: 3311.52, ticket_medio: 301.05, desconto_medio: 0, cancelados: 6, clientes_unicos: 11 },
  { date: "2026-08-15", pedidos: 13, receita: 4453.21, ticket_medio: 342.55, desconto_medio: 0, cancelados: 3, clientes_unicos: 13 },
  { date: "2026-08-14", pedidos: 12, receita: 5886.61, ticket_medio: 490.55, desconto_medio: 69.83, cancelados: 1, clientes_unicos: 12 },
  { date: "2026-08-13", pedidos: 19, receita: 5977.88, ticket_medio: 314.63, desconto_medio: 39.2, cancelados: 5, clientes_unicos: 18 },
  { date: "2026-08-12", pedidos: 22, receita: 10959.88, ticket_medio: 498.18, desconto_medio: 29.74, cancelados: 2, clientes_unicos: 20 },
  { date: "2026-08-11", pedidos: 27, receita: 8540.15, ticket_medio: 316.3, desconto_medio: 22.73, cancelados: 5, clientes_unicos: 25 },
  { date: "2026-08-10", pedidos: 24, receita: 8150.4, ticket_medio: 339.6, desconto_medio: 39.87, cancelados: 2, clientes_unicos: 24 },
  { date: "2026-08-09", pedidos: 9, receita: 2072.4, ticket_medio: 230.27, desconto_medio: 0, cancelados: 0, clientes_unicos: 9 },
  { date: "2026-08-08", pedidos: 22, receita: 6434.98, ticket_medio: 292.5, desconto_medio: 6.72, cancelados: 3, clientes_unicos: 22 },
  { date: "2026-08-07", pedidos: 20, receita: 5197.61, ticket_medio: 259.88, desconto_medio: 6.47, cancelados: 3, clientes_unicos: 20 },
  { date: "2026-08-06", pedidos: 17, receita: 4722.13, ticket_medio: 277.77, desconto_medio: 3.26, cancelados: 4, clientes_unicos: 16 },
  { date: "2026-08-05", pedidos: 17, receita: 4602.73, ticket_medio: 270.75, desconto_medio: 1.88, cancelados: 1, clientes_unicos: 17 },
  { date: "2026-08-04", pedidos: 24, receita: 8176.06, ticket_medio: 340.67, desconto_medio: 18.45, cancelados: 1, clientes_unicos: 22 },
];

const MOCK_CANAIS = [
  { canal: "WHATSAPP", pedidos: 51, receita: 22209.75, ticket_medio: 435.48 },
  { canal: "LOJA VIRTUAL", pedidos: 65, receita: 19753.06, ticket_medio: 303.89 },
  { canal: "APP", pedidos: 2, receita: 518.43, ticket_medio: 259.22 },
];

const MOCK_MESES = [
  { mes_referencia: "2026-08", total_sessoes: 18445, total_pedidos: 275, receita_total: 89605.97, receita_liquida: 89605.97, ticket_medio: 325.84, taxa_conversao_pct: 1.49, investimento_total: 31000, roas: 2.89, clientes_novos: 97, clientes_recorrentes: 139, clientes_unicos: 236, taxa_aquisicao: 35.27, taxa_conv_funil: 1.38 },
  { mes_referencia: "2026-07", total_sessoes: 35503, total_pedidos: 654, receita_total: 206600.13, receita_liquida: 206600.13, ticket_medio: 315.9, taxa_conversao_pct: 1.84, investimento_total: 31000, roas: 6.66, clientes_novos: 218, clientes_recorrentes: 321, clientes_unicos: 539, taxa_aquisicao: 33.33, taxa_conv_funil: 1.83 },
  { mes_referencia: "2026-06", total_sessoes: 38173, total_pedidos: 640, receita_total: 200550.19, receita_liquida: 200550.19, ticket_medio: 313.36, taxa_conversao_pct: 1.68, investimento_total: 31000, roas: 6.47, clientes_novos: 280, clientes_recorrentes: 285, clientes_unicos: 565, taxa_aquisicao: 43.75, taxa_conv_funil: 1.68 },
  { mes_referencia: "2026-05", total_sessoes: 12793, total_pedidos: 780, receita_total: 250933.74, receita_liquida: 250933.74, ticket_medio: 321.71, taxa_conversao_pct: 6.1, investimento_total: 29000, roas: 8.65, clientes_novos: 230, clientes_recorrentes: 389, clientes_unicos: 619, taxa_aquisicao: 29.49, taxa_conv_funil: 2.58 },
  { mes_referencia: "2026-04", total_sessoes: 23497, total_pedidos: 623, receita_total: 194218.27, receita_liquida: 194218.27, ticket_medio: 311.75, taxa_conversao_pct: 2.65, investimento_total: 29000, roas: 6.7, clientes_novos: 223, clientes_recorrentes: 310, clientes_unicos: 533, taxa_aquisicao: 35.79, taxa_conv_funil: 2.65 },
  { mes_referencia: "2026-03", total_sessoes: 22375, total_pedidos: 600, receita_total: 183012.0, receita_liquida: 183012.0, ticket_medio: 305.02, taxa_conversao_pct: 2.68, investimento_total: 27000, roas: 6.78, clientes_novos: 195, clientes_recorrentes: 307, clientes_unicos: 502, taxa_aquisicao: 32.5, taxa_conv_funil: 2.68 },
];

const MOCK_SESSOES_CANAL = [
  { canal: "01. Facebook CPC", sessoes: 13194, usuarios: 12740, novos_usuarios: 12732 },
  { canal: "02. Google CPC", sessoes: 5935, usuarios: 5760, novos_usuarios: 5774 },
  { canal: "07. Direto", sessoes: 4746, usuarios: 4082, novos_usuarios: 3944 },
  { canal: "05. Facebook e Instagram Referral", sessoes: 3548, usuarios: 3323, novos_usuarios: 3349 },
  { canal: "17. WhatsApp", sessoes: 1362, usuarios: 1289, novos_usuarios: 1262 },
  { canal: "08. Instagram Perfil", sessoes: 1317, usuarios: 1254, novos_usuarios: 1219 },
  { canal: "06. Organico", sessoes: 630, usuarios: 553, novos_usuarios: 531 },
  { canal: "04. E-mail", sessoes: 169, usuarios: 151, novos_usuarios: 131 },
];

// ---------------------------------------------------------------- helpers
function diasAtras(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return format(d, "yyyy-MM-dd");
}

interface DiaLinha {
  date: string;
  pedidos: number;
  receita: number;
  ticket_medio: number;
  desconto_medio: number;
  cancelados: number;
  clientes_unicos: number;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{children}</p>
  );
}

function Titulo({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div>
      <h2 className="font-serif text-[22px] font-normal text-foreground">{titulo}</h2>
      <p className="text-sm text-muted-foreground">{subtitulo}</p>
    </div>
  );
}

// ================================================================ SEÇÃO 1
export function Analise7DiasSection() {
  const [metricaBarra, setMetricaBarra] = useState<"receita" | "pedidos">("receita");

  const dias = useQuery({
    queryKey: ["kpis_ultimos_14_dias"],
    queryFn: async (): Promise<DiaLinha[]> => {
      const { data, error } = await supabase
        .from("tray_orders")
        .select("date,total,discount,orderstatus_type,customer_id")
        .gte("date", diasAtras(13))
        .limit(20000);
      if (error) throw error;
      const mapa = new Map<string, { validos: number[]; descontos: number[]; cancelados: number; clientes: Set<string> }>();
      (data ?? []).forEach((r: any) => {
        const dia = String(r.date ?? "").slice(0, 10);
        if (!dia) return;
        if (!mapa.has(dia)) mapa.set(dia, { validos: [], descontos: [], cancelados: 0, clientes: new Set() });
        const bucket = mapa.get(dia)!;
        const cancelado = CANCELADOS.includes(String(r.orderstatus_type ?? "").toLowerCase());
        if (cancelado) bucket.cancelados += 1;
        else {
          bucket.validos.push(num(r.total));
          bucket.descontos.push(num(r.discount));
          if (r.customer_id) bucket.clientes.add(String(r.customer_id));
        }
      });
      const linhas: DiaLinha[] = Array.from(mapa.entries()).map(([date, b]) => ({
        date,
        pedidos: b.validos.length,
        receita: b.validos.reduce((s, v) => s + v, 0),
        ticket_medio: b.validos.length ? b.validos.reduce((s, v) => s + v, 0) / b.validos.length : 0,
        desconto_medio: b.descontos.length ? b.descontos.reduce((s, v) => s + v, 0) / b.descontos.length : 0,
        cancelados: b.cancelados,
        clientes_unicos: b.clientes.size,
      }));
      linhas.sort((a, b) => (a.date < b.date ? 1 : -1));
      return linhas.length ? linhas : MOCK_DIAS;
    },
  });

  const canais = useQuery({
    queryKey: ["kpis_canais_7_dias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tray_orders")
        .select("point_sale,total,orderstatus_type")
        .gte("date", diasAtras(6))
        .limit(20000);
      if (error) throw error;
      const mapa = new Map<string, number[]>();
      (data ?? []).forEach((r: any) => {
        if (CANCELADOS.includes(String(r.orderstatus_type ?? "").toLowerCase())) return;
        const canal = String(r.point_sale ?? "—");
        if (!mapa.has(canal)) mapa.set(canal, []);
        mapa.get(canal)!.push(num(r.total));
      });
      const linhas = Array.from(mapa.entries()).map(([canal, vals]) => ({
        canal,
        pedidos: vals.length,
        receita: vals.reduce((s, v) => s + v, 0),
        ticket_medio: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0,
      }));
      linhas.sort((a, b) => b.receita - a.receita);
      return linhas.length ? linhas : MOCK_CANAIS;
    },
  });

  const linhas = (dias.data ?? MOCK_DIAS) as DiaLinha[];

  const kpis = useMemo(() => {
    const atual = linhas.slice(0, 7);
    const anterior = linhas.slice(7, 14);
    const soma = (arr: DiaLinha[], k: keyof DiaLinha) => arr.reduce((s, d) => s + num(d[k]), 0);
    const media = (arr: DiaLinha[], k: keyof DiaLinha) => (arr.length ? soma(arr, k) / arr.length : 0);
    const calc = (label: string, a: number, p: number, formato: "moeda" | "numero", subirBom: boolean) => ({
      label,
      atual: a,
      anterior: p,
      variacao: p ? ((a - p) / p) * 100 : 0,
      formato,
      subirBom,
    });
    return [
      calc("Pedidos", soma(atual, "pedidos"), soma(anterior, "pedidos"), "numero", true),
      calc("Receita", soma(atual, "receita"), soma(anterior, "receita"), "moeda", true),
      calc("Ticket Médio", media(atual, "ticket_medio"), media(anterior, "ticket_medio"), "moeda", true),
      calc("Cancelamentos", soma(atual, "cancelados"), soma(anterior, "cancelados"), "numero", false),
      calc("Desconto Médio", media(atual, "desconto_medio"), media(anterior, "desconto_medio"), "moeda", false),
    ];
  }, [linhas]);

  const dadosGrafico = useMemo(
    () =>
      linhas
        .slice(0, 7)
        .slice()
        .reverse()
        .map((d) => ({
          dia: format(parseISO(d.date), "EEE dd/MM", { locale: ptBR }),
          receita: Number(d.receita.toFixed(2)),
          pedidos: d.pedidos,
        })),
    [linhas]
  );

  const listaCanais = canais.data ?? MOCK_CANAIS;
  const totalReceitaCanais = listaCanais.reduce((s, c) => s + num(c.receita), 0);
  const maiorCanal = listaCanais[0]?.canal;

  return (
    <div className="space-y-4">
      <SectionLabel>Semana</SectionLabel>
      <Titulo titulo="Últimos 7 dias" subtitulo="vs. 7 dias anteriores" />

      {dias.isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* 1.1 KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {kpis.map((k) => {
              const subiu = k.variacao >= 0;
              const bom = subiu === k.subirBom;
              const Icon = subiu ? TrendingUp : TrendingDown;
              return (
                <Card key={k.label} className="rounded-xl p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
                  <p className="mt-1 font-serif text-xl font-bold">
                    {k.formato === "moeda" ? fmtBRL(k.atual) : fmtNum(k.atual)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-medium",
                        bom ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"
                      )}
                    >
                      <Icon className="mr-1 h-3 w-3" />
                      {`${subiu ? "+" : ""}${fmtPct(k.variacao, 1)}`}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    anterior: {k.formato === "moeda" ? fmtBRL(k.anterior) : fmtNum(k.anterior)}
                  </p>
                </Card>
              );
            })}
          </div>

          {/* 1.2 Gráfico */}
          <Card className="rounded-xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Desempenho diário</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={metricaBarra === "receita" ? "default" : "outline"}
                  onClick={() => setMetricaBarra("receita")}
                >
                  Receita
                </Button>
                <Button
                  size="sm"
                  variant={metricaBarra === "pedidos" ? "default" : "outline"}
                  onClick={() => setMetricaBarra("pedidos")}
                >
                  Pedidos
                </Button>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: any) =>
                      metricaBarra === "receita" ? fmtBRL(Number(v)) : fmtNum(Number(v))
                    }
                  />
                  <Bar dataKey={metricaBarra} fill={OURO} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 1.3 Canais */}
          <Card className="rounded-xl p-5">
            <h3 className="mb-3 font-semibold">Canais dos últimos 7 dias</h3>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-right">% da Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaCanais.map((c) => (
                    <TableRow key={c.canal} className={cn(c.canal === maiorCanal && "bg-primary/5")}>
                      <TableCell className="font-medium">{c.canal}</TableCell>
                      <TableCell className="text-right">{fmtNum(c.pedidos)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(c.receita)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(c.ticket_medio)}</TableCell>
                      <TableCell className="text-right">
                        {fmtPct(totalReceitaCanais ? (num(c.receita) / totalReceitaCanais) * 100 : 0, 1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ================================================================ SEÇÃO 2
interface MesLinha {
  mes_referencia: string;
  total_sessoes: number;
  total_pedidos: number;
  receita_total: number;
  receita_liquida: number;
  ticket_medio: number;
  taxa_conversao_pct: number;
  investimento_total: number;
  roas: number;
  clientes_novos: number;
  clientes_recorrentes: number;
  clientes_unicos: number;
  taxa_aquisicao: number;
  taxa_conv_funil: number;
}

const METRICAS = [
  { chave: "receita_liquida", label: "Receita Líquida (R$)", cor: "#C9A84C", tipo: "moeda" },
  { chave: "total_sessoes", label: "Sessões", cor: "#3B82F6", tipo: "numero" },
  { chave: "taxa_conversao_pct", label: "Taxa de Conversão (%)", cor: "#2D6A4F", tipo: "pct" },
  { chave: "ticket_medio", label: "Ticket Médio (R$)", cor: "#7C3AED", tipo: "moeda" },
  { chave: "roas", label: "ROAS", cor: "#B45309", tipo: "numero" },
] as const;

function rotuloMes(mes: string) {
  const [ano, m] = String(mes).split("-");
  if (!ano || !m) return mes;
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[Number(m) - 1] ?? m}/${ano.slice(2)}`;
}

export function ComparativoMensalSection() {
  const [selecionadas, setSelecionadas] = useState<string[]>(["receita_liquida", "total_sessoes"]);

  const meses = useQuery({
    queryKey: ["kpis_comparativo_mensal"],
    queryFn: async (): Promise<MesLinha[]> => {
      const { data: trafego } = await supabase
        .from("vw_kpis_trafego")
        .select("*")
        .order("mes_referencia", { ascending: false })
        .limit(6);
      if (!trafego || trafego.length === 0) return MOCK_MESES as unknown as MesLinha[];

      const { data: vendas } = await supabase.from("vw_dashboard_vendas").select("*");
      const { data: conv } = await supabase.from("vw_taxa_conversao_mensal").select("*");

      return (trafego as any[]).map((k) => {
        const [ano, mes] = String(k.mes_referencia).split("-");
        const v = (vendas as any[] | null)?.find(
          (x) => Number(x.ano) === Number(ano) && Number(x.mes) === Number(mes)
        );
        const t = (conv as any[] | null)?.find((x) => String(x.mes) === String(k.mes_referencia));
        return {
          mes_referencia: String(k.mes_referencia),
          total_sessoes: num(k.total_sessoes),
          total_pedidos: num(k.total_pedidos),
          receita_total: num(k.receita_total),
          receita_liquida: num(v?.receita_liquida ?? k.receita_total),
          ticket_medio: num(k.ticket_medio),
          taxa_conversao_pct: num(k.taxa_conversao_pct),
          investimento_total: num(k.investimento_total),
          roas: num(k.roas),
          clientes_novos: num(t?.clientes_novos),
          clientes_recorrentes: num(t?.clientes_recorrentes),
          clientes_unicos: num(t?.clientes_unicos),
          taxa_aquisicao: num(t?.taxa_aquisicao),
          taxa_conv_funil: num(t?.taxa_conversao),
        } as MesLinha;
      });
    },
  });

  const sessoesCanal = useQuery({
    queryKey: ["kpis_sessoes_canal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_sessoes_canal").select("*").order("sessoes", { ascending: false });
      if (error || !data || data.length === 0) return MOCK_SESSOES_CANAL;
      return data as any[];
    },
  });

  const linhas = (meses.data ?? (MOCK_MESES as unknown as MesLinha[])).slice(0, 6);
  const maiorReceita = useMemo(
    () => linhas.reduce((max, l) => (l.receita_liquida > (max?.receita_liquida ?? -1) ? l : max), linhas[0]),
    [linhas]
  );

  const dadosLinha = useMemo(() => linhas.slice().reverse().map((l) => ({ ...l, mes: rotuloMes(l.mes_referencia) })), [linhas]);

  function toggleMetrica(chave: string) {
    setSelecionadas((prev) => {
      if (prev.includes(chave)) return prev.filter((c) => c !== chave);
      if (prev.length >= 2) return [prev[1], chave];
      return [...prev, chave];
    });
  }

  const diagnosticos = useMemo(() => {
    if (linhas.length < 2) return [] as { icone: string; titulo: string; texto: string; acao?: { label: string; to: string } }[];
    const atual = linhas[0];
    const ant = linhas[1];
    const delta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
    const dReceita = delta(atual.receita_liquida, ant.receita_liquida);
    const dSessoes = delta(atual.total_sessoes, ant.total_sessoes);
    const dConv = delta(atual.taxa_conversao_pct, ant.taxa_conversao_pct);
    const dRoas = delta(atual.roas, ant.roas);
    const rel = (v: number) => Math.abs(v) > 5;
    const out: { icone: string; titulo: string; texto: string; acao?: { label: string; to: string } }[] = [];

    if (rel(dReceita) && dReceita < 0 && dSessoes < 0)
      out.push({ icone: "📉", titulo: "Queda de tráfego", texto: "Menos pessoas chegando à loja. Revisar investimento em mídia paga.", acao: { label: "Ver criativos", to: "/marketing" } });
    if (rel(dReceita) && dReceita < 0 && dSessoes > 0 && dConv < -5)
      out.push({ icone: "⚠️", titulo: "Tráfego cresceu mas conversão caiu", texto: "Problema na oferta, preço ou experiência da loja.", acao: { label: "Ver produtos", to: "/dashboard-produtos" } });
    if (rel(dReceita) && dReceita < 0 && dSessoes > 0 && Math.abs(dConv) <= 5)
      out.push({ icone: "🎯", titulo: "Mais sessões, ticket médio menor", texto: "Avaliar mix de produtos vendidos.", acao: { label: "Ver produtos", to: "/dashboard-produtos" } });
    if (rel(dReceita) && dReceita > 0 && dSessoes < 0)
      out.push({ icone: "✅", titulo: "Tráfego mais qualificado", texto: "Menos sessões mas mais receita — ticket ou conversão subiram." });
    if (dConv < -5 && dRoas < -5)
      out.push({ icone: "🚨", titulo: "Conversão e ROAS caindo juntos", texto: "Criativo ou segmentação fora do ponto.", acao: { label: "Ver criativos", to: "/marketing" } });
    const ratio = atual.clientes_unicos ? atual.clientes_novos / atual.clientes_unicos : 0;
    if (ratio > 0 && ratio < 0.3)
      out.push({ icone: "🔁", titulo: "Base recorrente forte (+70%)", texto: "Bom momento para lançamento exclusivo para clientes.", acao: { label: "Ver CRM", to: "/dashboard-rfm" } });
    if (ratio > 0.5)
      out.push({ icone: "🆕", titulo: "Alta aquisição", texto: "Verificar se a retenção está sendo trabalhada (CRM, pós-venda).", acao: { label: "Ver CRM", to: "/dashboard-rfm" } });
    return out;
  }, [linhas]);

  const canaisSessoes = sessoesCanal.data ?? MOCK_SESSOES_CANAL;
  const totalSessoes = canaisSessoes.reduce((s: number, c: any) => s + num(c.sessoes), 0);

  function corRoas(roas: number) {
    if (roas >= 5) return "border-success/30 bg-success/10 text-success";
    if (roas >= 3) return "border-warning/30 bg-warning/10 text-warning";
    return "border-danger/30 bg-danger/10 text-danger";
  }

  return (
    <div className="space-y-4">
      <SectionLabel>Mensal</SectionLabel>
      <Titulo titulo="Comparativo Mensal" subtitulo="Últimos 6 meses — vendas × sessões × conversão × canais" />

      {meses.isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* 2.1 Tabela */}
          <Card className="rounded-xl p-5">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Receita Líquida</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-right">Sessões</TableHead>
                    <TableHead className="text-right">Taxa Conv.</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">Investimento</TableHead>
                    <TableHead className="text-right">Novos</TableHead>
                    <TableHead className="text-right">Recorrentes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l) => (
                    <TableRow
                      key={l.mes_referencia}
                      className={cn(l.mes_referencia === maiorReceita?.mes_referencia && "border-l-4 border-l-primary")}
                    >
                      <TableCell className="font-medium">{rotuloMes(l.mes_referencia)}</TableCell>
                      <TableCell className="text-right">{fmtNum(l.total_pedidos)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(l.receita_liquida)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(l.ticket_medio)}</TableCell>
                      <TableCell className="text-right">{fmtNum(l.total_sessoes)}</TableCell>
                      <TableCell className="text-right">{fmtPct(l.taxa_conversao_pct)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={cn("font-medium", corRoas(l.roas))}>
                          {l.roas.toFixed(2).replace(".", ",")}x
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmtBRL(l.investimento_total)}</TableCell>
                      <TableCell className="text-right">{fmtNum(l.clientes_novos)}</TableCell>
                      <TableCell className="text-right">{fmtNum(l.clientes_recorrentes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* 2.2 Gráfico de linhas */}
          <Card className="rounded-xl p-5">
            <h3 className="mb-3 font-semibold">Evolução (até 2 métricas)</h3>
            <div className="mb-4 flex flex-wrap gap-4">
              {METRICAS.map((m) => (
                <label key={m.chave} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={selecionadas.includes(m.chave)}
                    onCheckedChange={() => toggleMetrica(m.chave)}
                  />
                  <span style={{ color: m.cor }}>{m.label}</span>
                </label>
              ))}
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosLinha}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {selecionadas.map((chave, i) => {
                    const m = METRICAS.find((x) => x.chave === chave)!;
                    return (
                      <Line
                        key={chave}
                        yAxisId={i === 0 ? "left" : "right"}
                        type="monotone"
                        dataKey={chave}
                        name={m.label}
                        stroke={m.cor}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 2.3 Diagnósticos */}
          {diagnosticos.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {diagnosticos.map((d) => (
                <Card key={d.titulo} className="rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{d.icone}</span>
                    <div className="space-y-1">
                      <p className="font-semibold">{d.titulo}</p>
                      <p className="text-sm text-muted-foreground">{d.texto}</p>
                      {d.acao && (
                        <Button asChild size="sm" variant="outline" className="mt-2">
                          <Link to={d.acao.to}>{d.acao.label}</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* 2.4 Sessões por canal */}
          <Card className="rounded-xl p-5">
            <h3 className="mb-3 font-semibold">Sessões por canal</h3>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Sessões</TableHead>
                    <TableHead className="text-right">Usuários</TableHead>
                    <TableHead className="text-right">Novos</TableHead>
                    <TableHead className="w-[220px]">% do Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {canaisSessoes.map((c: any) => {
                    const pct = totalSessoes ? (num(c.sessoes) / totalSessoes) * 100 : 0;
                    return (
                      <TableRow key={c.canal}>
                        <TableCell className="font-medium">{c.canal}</TableCell>
                        <TableCell className="text-right">{fmtNum(c.sessoes)}</TableCell>
                        <TableCell className="text-right">{fmtNum(c.usuarios)}</TableCell>
                        <TableCell className="text-right">{fmtNum(c.novos_usuarios)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: OURO }} />
                            </div>
                            <span className="w-12 text-right text-xs text-muted-foreground">{fmtPct(pct, 1)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
