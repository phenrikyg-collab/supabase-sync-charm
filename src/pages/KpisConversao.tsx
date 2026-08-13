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
...
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="analise">
          <AnaliseDiariaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
