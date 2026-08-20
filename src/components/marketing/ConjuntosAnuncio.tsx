import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";
import {
  ArrowDown, ArrowUp, AlertTriangle, ChevronDown, DollarSign, ShoppingBag, TrendingUp, Layers,
} from "lucide-react";

type Conjunto = {
  adset_name: string | null;
  campaign_name: string | null;
  publico: string | null;
  status: string | null;
  investimento: number | null;
  impressions: number | null;
  reach: number | null;
  frequency: number | null;
  link_clicks: number | null;
  cps: number | null;
  cpm: number | null;
  ctr_link: number | null;
  add_to_cart: number | null;
  initiate_checkout: number | null;
  purchases: number | null;
  conversao_rate: number | null;
  receita: number | null;
  cpa: number | null;
  roas: number | null;
  prev_investimento: number | null;
  prev_cps: number | null;
  prev_cpm: number | null;
  prev_frequency: number | null;
  prev_conversao: number | null;
  prev_cpa: number | null;
  prev_roas: number | null;
};

const n = (v: unknown) => (v === null || v === undefined || isNaN(Number(v)) ? 0 : Number(v));
const brl = (v: unknown) =>
  n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const num = (v: unknown, d = 0) => n(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: unknown) => `${n(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const publicoChip = (p?: string | null) => {
  const k = (p ?? "").toLowerCase();
  if (k.includes("lookalike")) return "bg-purple-500/10 text-purple-600 border-purple-500/20";
  if (k.includes("frio") || k.includes("novo")) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  if (k.includes("engaj")) return "bg-orange-500/10 text-orange-600 border-orange-500/20";
  if (k.includes("client")) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  return "bg-muted text-muted-foreground border-border";
};

function Delta({ atual, anterior, invertido = false }: { atual: number | null; anterior: number | null; invertido?: boolean }) {
  if (anterior === null || anterior === undefined || Number(anterior) === 0) {
    return <Badge variant="outline" className="ml-1 px-1 py-0 text-[9px]">novo</Badge>;
  }
  const a = n(atual);
  const b = n(anterior);
  if (a === b) return null;
  const melhor = invertido ? a < b : a > b;
  const Icon = a > b ? ArrowUp : ArrowDown;
  return <Icon className={cn("inline h-3 w-3 ml-1", melhor ? "text-emerald-600" : "text-danger")} />;
}

const emAlerta = (c: Conjunto) =>
  c.prev_roas !== null && n(c.prev_roas) > 0 && n(c.roas) < n(c.prev_roas) * 0.7;

export function ConjuntosAnuncio() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<Conjunto[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("meta_conjuntos_periodo" as never, { p_dias: dias } as never);
      if (cancel) return;
      if (error) console.error("meta_conjuntos_periodo", error);
      setDados(((data as Conjunto[] | null) ?? []) as Conjunto[]);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [dias]);

  const grupos = useMemo(() => {
    const map = new Map<string, Conjunto[]>();
    for (const c of dados) {
      const k = c.campaign_name ?? "Sem campanha";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    }
    return Array.from(map.entries())
      .map(([campanha, itens]) => ({
        campanha,
        itens: [...itens].sort((a, b) => n(b.investimento) - n(a.investimento)),
        investimento: itens.reduce((s, i) => s + n(i.investimento), 0),
      }))
      .sort((a, b) => b.investimento - a.investimento);
  }, [dados]);

  const resumo = useMemo(() => {
    const inv = dados.reduce((s, c) => s + n(c.investimento), 0);
    const rec = dados.reduce((s, c) => s + n(c.receita), 0);
    const compras = dados.reduce((s, c) => s + n(c.purchases), 0);
    return { inv, rec, compras, roas: inv > 0 ? rec / inv : 0, alertas: dados.filter(emAlerta).length };
  }, [dados]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-serif font-bold">Conjuntos de Anúncio</h2>
        <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[7, 14, 30, 90].map((d) => (
              <SelectItem key={d} value={String(d)}>{`Últimos ${d} dias`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Investido total" value={brl(resumo.inv)} icon={DollarSign} variant="primary" />
        <StatCard title="Compras totais" value={num(resumo.compras)} icon={ShoppingBag} />
        <StatCard title="ROAS médio" value={`${num(resumo.roas, 2)}x`} icon={TrendingUp} variant="success" />
        <StatCard
          title="Conjuntos em alerta"
          value={num(resumo.alertas)}
          subtitle="Queda >30% no ROAS"
          icon={AlertTriangle}
          variant={resumo.alertas > 0 ? "warning" : "default"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desempenho por conjunto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : grupos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum conjunto de anúncio no período selecionado.
            </p>
          ) : (
            grupos.map((g) => (
              <div key={g.campanha} className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2">
                  <span className="font-medium text-sm">{g.campanha}</span>
                  <span className="text-xs text-muted-foreground">{brl(g.investimento)} investidos</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="text-left font-medium py-2 pr-3 w-8" />
                        <th className="text-left font-medium py-2 pr-3">Conjunto</th>
                        <th className="text-left font-medium py-2 pr-3">Público</th>
                        <th className="text-left font-medium py-2 pr-3">Status</th>
                        <th className="text-right font-medium py-2 pr-3">Investimento</th>
                        <th className="text-right font-medium py-2 pr-3">Freq.</th>
                        <th className="text-right font-medium py-2 pr-3">CPS</th>
                        <th className="text-right font-medium py-2 pr-3">CPM</th>
                        <th className="text-right font-medium py-2 pr-3">CTR Link</th>
                        <th className="text-right font-medium py-2 pr-3">Compras</th>
                        <th className="text-right font-medium py-2 pr-3">Tx. Conv.</th>
                        <th className="text-right font-medium py-2 pr-3">ROAS</th>
                        <th className="text-right font-medium py-2">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.itens.map((c, idx) => {
                        const key = `${g.campanha}::${c.adset_name}::${idx}`;
                        const alerta = emAlerta(c);
                        const open = aberto === key;
                        return (
                          <Fragment key={key}>
                            <tr
                              onClick={() => setAberto(open ? null : key)}
                              className={cn(
                                "border-b cursor-pointer hover:bg-muted/40 transition-colors",
                                alerta && "bg-warning/10 border-l-2 border-l-warning"
                              )}
                            >
                              <td className="py-2 pr-3">
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                              </td>
                              <td className="py-2 pr-3">
                                <span className="flex items-center gap-1.5">
                                  {alerta && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
                                  <span className="font-medium">{c.adset_name ?? "—"}</span>
                                </span>
                              </td>
                              <td className="py-2 pr-3">
                                <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", publicoChip(c.publico))}>
                                  {c.publico ?? "Misto"}
                                </span>
                              </td>
                              <td className="py-2 pr-3">
                                <span className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                                  (c.status ?? "").toUpperCase() === "ACTIVE"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : "bg-muted text-muted-foreground border-border"
                                )}>
                                  {c.status ?? "—"}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-right">{brl(c.investimento)}</td>
                              <td className="py-2 pr-3 text-right">{num(c.frequency, 2)}</td>
                              <td className="py-2 pr-3 text-right whitespace-nowrap">
                                {brl(c.cps)}<Delta atual={c.cps} anterior={c.prev_cps} invertido />
                              </td>
                              <td className="py-2 pr-3 text-right whitespace-nowrap">
                                {brl(c.cpm)}<Delta atual={c.cpm} anterior={c.prev_cpm} invertido />
                              </td>
                              <td className="py-2 pr-3 text-right">{pct(c.ctr_link)}</td>
                              <td className="py-2 pr-3 text-right">{num(c.purchases)}</td>
                              <td className="py-2 pr-3 text-right whitespace-nowrap">
                                {pct(c.conversao_rate)}<Delta atual={c.conversao_rate} anterior={c.prev_conversao} />
                              </td>
                              <td className="py-2 pr-3 text-right whitespace-nowrap font-medium">
                                {num(c.roas, 2)}x<Delta atual={c.roas} anterior={c.prev_roas} />
                              </td>
                              <td className="py-2 text-right">{brl(c.receita)}</td>
                            </tr>
                            {open && (
                              <tr className="border-b bg-muted/20">
                                <td colSpan={13} className="py-4 px-4">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {[
                                      ["Impressões", num(c.impressions)],
                                      ["Alcance", num(c.reach)],
                                      ["Cliques no link", num(c.link_clicks)],
                                      ["Add to Cart", num(c.add_to_cart)],
                                      ["Initiate Checkout", num(c.initiate_checkout)],
                                      ["Compras", num(c.purchases)],
                                    ].map(([label, valor], i, arr) => (
                                      <span key={label} className="flex items-center gap-2">
                                        <span className="rounded-md border bg-card px-3 py-2 text-center min-w-[120px]">
                                          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
                                          <span className="block font-serif font-bold">{valor}</span>
                                        </span>
                                        {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="mt-3 text-xs text-muted-foreground">
                                    CPA: {brl(c.cpa)} · Investimento período anterior: {c.prev_investimento === null ? "—" : brl(c.prev_investimento)} · Frequência anterior: {c.prev_frequency === null ? "—" : num(c.prev_frequency, 2)}
                                  </p>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          <p className="flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Frequência calculada por impressões ÷ alcance somado no nível de conjunto (aproximado) — não usa o alcance
            agregado real da Meta, que só está disponível a nível de campanha por limite de chamadas de API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
