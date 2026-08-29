import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronDown, TrendingUp } from "lucide-react";
import {
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  CampanhaPeriodo,
  MetaAlertaPeriodo,
  MetaAlertaResumo,
  PUBLICO_BADGE,
  brl,
  ehOportunidadeEscala,
  freqFmt,
  int,
  metaAlertasPeriodo,
  metaAlertasResumo,
  n,
  pct,
  roasFmt,
} from "./metaCriativos";

const TODOS = "__todos__";
export const PUBLICOS = ["Novo (frio)", "Novo (Lookalike)", "Engajado", "Clientes", "Misto", "Indefinido"];

export function PublicoBadge({ publico }: { publico: string | null }) {
  const p = publico || "Indefinido";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", PUBLICO_BADGE[p] || PUBLICO_BADGE.Indefinido)}>
      {p}
    </span>
  );
}

const ancora = (id: string) => `campanha-${id}`;

function irParaCampanha(id: string) {
  const el = document.getElementById(ancora(id));
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-primary");
  window.setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2500);
}

// ===== 6. Resumo e Próximos Passos =====
export function ResumoProximosPassos({ campanhas, loading }: { campanhas: CampanhaPeriodo[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-[220px]" />;

  const ativas = campanhas.filter((c) => (c.status || "").toUpperCase() !== "ARCHIVED");
  const oportunidades = ativas.filter(ehOportunidadeEscala);

  type Aviso = { id: string; nome: string; texto: string; nivel: "danger" | "warning" };
  const avisos: Aviso[] = [];
  for (const c of ativas) {
    const nome = c.campaign_name || "—";
    if (n(c.roas) < 2 && n(c.investimento) > 300)
      avisos.push({ id: c.campaign_id, nome, texto: "Queimando margem — pausar até reestruturar", nivel: "danger" });
    if (n(c.frequency) > 4)
      avisos.push({ id: c.campaign_id, nome, texto: "Audiência saturada — pausar ou expandir público", nivel: "danger" });
    if (n(c.cpm) > 25)
      avisos.push({ id: c.campaign_id, nome, texto: "CPM alto — leilão caro ou criativo de baixa relevância", nivel: "warning" });
    if (n(c.conversao_rate) < 0.5 && n(c.link_clicks) > 200 && n(c.ctr_link) >= 1 && n(c.cps) <= 1.5)
      avisos.push({ id: c.campaign_id, nome, texto: "Sessão boa não está convertendo — auditar página/oferta, não o anúncio", nivel: "warning" });
  }

  const cpsMedioOportunidade =
    oportunidades.length > 0
      ? oportunidades.reduce((s, c) => s + n(c.cps), 0) / oportunidades.length
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Resumo e Próximos Passos</CardTitle>
        <p className="text-sm text-muted-foreground">Gerado automaticamente a partir das campanhas do período</p>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-success/20 bg-success/5 p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <Rocket className="h-4 w-4" /> Oportunidades
          </p>
          {oportunidades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha de público frio atingiu todos os critérios de escala no período.</p>
          ) : (
            <>
              <p className="text-sm">
                {oportunidades.length} campanha(s) prontas para escalar — público frio convertendo com CPS de {brl(cpsMedioOportunidade)}
              </p>
              <ul className="space-y-1">
                {oportunidades.map((c) => (
                  <li key={c.campaign_id}>
                    <button onClick={() => irParaCampanha(c.campaign_id)} className="text-left text-sm hover:underline">
                      ⭐ {c.campaign_name} <span className="text-muted-foreground">· CPS {brl(c.cps)} · ROAS {roasFmt(c.roas)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger">
            <AlertTriangle className="h-4 w-4" /> Pausas / Atenção
          </p>
          {avisos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta de pausa no período.</p>
          ) : (
            <ul className="space-y-1">
              {avisos.map((a, i) => (
                <li key={`${a.id}-${i}`}>
                  <button onClick={() => irParaCampanha(a.id)} className="text-left text-sm hover:underline">
                    <span className={a.nivel === "danger" ? "text-danger" : "text-warning"}>●</span> {a.nome}{" "}
                    <span className="text-muted-foreground">— {a.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ===== 5. Oportunidades de Escala =====
export function OportunidadesEscala({ campanhas, loading }: { campanhas: CampanhaPeriodo[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-[180px]" />;
  const lista = campanhas.filter((c) => (c.status || "").toUpperCase() !== "ARCHIVED").filter(ehOportunidadeEscala);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Oportunidades de Escala</CardTitle>
        <p className="text-sm text-muted-foreground">
          Público frio · CPS até R$ 1,50 · CPM entre R$ 12 e R$ 20 · conversão saudável · ROAS a partir de 2x
        </p>
      </CardHeader>
      <CardContent>
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma campanha atende a todos os critérios de escala no período.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lista.map((c) => (
              <button
                key={c.campaign_id}
                onClick={() => irParaCampanha(c.campaign_id)}
                className="text-left rounded-lg border border-success/30 bg-success/5 p-3 space-y-2 hover:shadow-md transition-shadow"
              >
                <p className="text-sm font-medium line-clamp-2">⭐ {c.campaign_name || "—"}</p>
                <PublicoBadge publico={c.publico} />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">CPS</p>
                    <p className="text-sm font-semibold">{brl(c.cps)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">CPM</p>
                    <p className="text-sm font-semibold">{brl(c.cpm)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">ROAS</p>
                    <p className="text-sm font-semibold">{roasFmt(c.roas)}</p>
                  </div>
                </div>
                <p className="text-xs text-success font-medium">Pronta para escalar +20-30%</p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Investimento por público =====
function InvestimentoPorPublico({ campanhas }: { campanhas: CampanhaPeriodo[] }) {
  const linhas = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of campanhas) {
      const p = c.publico || "Indefinido";
      map.set(p, (map.get(p) || 0) + n(c.investimento));
    }
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    return [...map.entries()]
      .map(([publico, valor]) => ({ publico, valor, share: total > 0 ? (valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [campanhas]);

  if (!linhas.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Investimento por tipo de público</p>
      {linhas.map((l) => (
        <div key={l.publico} className="space-y-1">
          <div className="flex justify-between items-center text-xs gap-2">
            <PublicoBadge publico={l.publico} />
            <span className="text-muted-foreground">{pct(l.share)} · {brl(l.valor)}</span>
          </div>
          <div className="h-2.5 rounded bg-muted">
            <div className="h-2.5 rounded bg-primary" style={{ width: `${Math.max(l.share, 1)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== 2/3/4. Performance por campanha =====
const QUADRANTES: Record<string, { label: string; emoji: string; color: string; acao: string }> = {
  estrelas: { label: "Estrelas", emoji: "⭐", color: "#22c55e", acao: "🟢 Manter e escalar com segurança" },
  escalar: { label: "Escalar", emoji: "📈", color: "#3b82f6", acao: "🟢 Aumentar verba — alta eficiência subexposta" },
  corrigir: { label: "Corrigir", emoji: "❗", color: "#ef4444", acao: "🔴 Revisar criativos ou página antes de escalar" },
  observar: { label: "Observar", emoji: "👁", color: "#6b7280", acao: "⚫ Aguardar mais dados ou pausar" },
};

function FiltrosCard({
  status,
  setStatus,
  publico,
  setPublico,
}: {
  status: string;
  setStatus: (v: string) => void;
  publico: string;
  setPublico: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ACTIVE">Ativas</SelectItem>
          <SelectItem value="PAUSED">Pausadas</SelectItem>
          <SelectItem value={TODOS}>Todas</SelectItem>
        </SelectContent>
      </Select>
      <Select value={publico} onValueChange={setPublico}>
        <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os públicos</SelectItem>
          {PUBLICOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CampanhasSecao({ campanhas, loading }: { campanhas: CampanhaPeriodo[]; loading: boolean }) {
  const [status, setStatus] = useState("ACTIVE");
  const [publico, setPublico] = useState(TODOS);

  const lista = useMemo(
    () =>
      campanhas
        .filter((c) => (status === TODOS ? true : (c.status || "").toUpperCase() === status))
        .filter((c) => (publico === TODOS ? true : (c.publico || "Indefinido") === publico))
        .sort((a, b) => n(b.investimento) - n(a.investimento)),
    [campanhas, status, publico]
  );

  const matriz = useMemo(() => {
    const comAtribuicao = lista.filter((c) => n(c.roas) > 0);
    const semAtribuicao = lista.filter((c) => n(c.roas) <= 0);
    const clicks = comAtribuicao.map((c) => n(c.link_clicks)).sort((a, b) => a - b);
    let mediana = 0;
    if (clicks.length) {
      const m = Math.floor(clicks.length / 2);
      mediana = clicks.length % 2 === 0 ? (clicks[m - 1] + clicks[m]) / 2 : clicks[m];
    }
    const spendMax = Math.max(...comAtribuicao.map((c) => n(c.investimento)), 1);
    const classify = (roas: number, cl: number) => {
      if (roas >= 4 && cl >= mediana) return "estrelas";
      if (roas >= 4) return "escalar";
      if (cl >= mediana) return "corrigir";
      return "observar";
    };
    const dados = comAtribuicao.map((c) => ({
      campaign_id: c.campaign_id,
      campaign: c.campaign_name || "—",
      spend: n(c.investimento),
      clicks: n(c.link_clicks),
      roas: n(c.roas),
      classificacao: classify(n(c.roas), n(c.link_clicks)),
      tamanho: 8 + (n(c.investimento) / spendMax) * 16,
    }));
    return { dados, mediana, semAtribuicao };
  }, [lista]);

  if (loading) return <Skeleton className="h-[600px]" />;

  const filtros = <FiltrosCard status={status} setStatus={setStatus} publico={publico} setPublico={setPublico} />;

  return (
    <div className="space-y-6">
      {/* Matriz de Eficiência */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Matriz de Eficiência de Campanhas</CardTitle>
            <p className="text-sm text-muted-foreground">ROAS de Equilíbrio: 2,0x · ROAS Saudável: 4,0x</p>
          </div>
          {filtros}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["estrelas", "escalar", "corrigir", "observar"] as const).map((k) => {
              const q = QUADRANTES[k];
              const qtd = matriz.dados.filter((d) => d.classificacao === k).length;
              return (
                <div key={k} className="rounded-lg border p-4" style={{ borderColor: q.color, backgroundColor: `${q.color}10` }}>
                  <div className="text-sm font-medium" style={{ color: q.color }}>{q.emoji} {q.label}</div>
                  <div className="text-2xl font-bold mt-1">{qtd}</div>
                  <div className="text-xs text-muted-foreground">campanhas</div>
                </div>
              );
            })}
          </div>

          {matriz.dados.length > 0 && (
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 30, right: 40, bottom: 50, left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="clicks" name="Cliques no link" label={{ value: "Volume (cliques no link)", position: "insideBottom", offset: -10 }} />
                  <YAxis type="number" dataKey="roas" name="ROAS" label={{ value: "ROAS", angle: -90, position: "insideLeft" }} />
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
                          <div>ROAS: <span className="font-medium">{roasFmt(d.roas)}</span></div>
                          <div>Cliques: <span className="font-medium">{int(d.clicks)}</span></div>
                          <div>Investimento: <span className="font-medium">{brl(d.spend)}</span></div>
                          <div style={{ color: q.color }}>{q.emoji} {q.label}</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={4} stroke="#22c55e" strokeDasharray="5 5" label={{ value: "ROAS Saudável 4x", position: "insideTopRight", fill: "#22c55e", fontSize: 11 }} />
                  <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Equilíbrio 2x", position: "insideTopRight", fill: "#ef4444", fontSize: 11 }} />
                  <ReferenceLine x={matriz.mediana} stroke="#6b7280" strokeDasharray="5 5" label={{ value: "Volume médio", position: "top", fill: "#6b7280", fontSize: 11 }} />
                  <Scatter data={matriz.dados}>
                    {matriz.dados.map((d, i) => <Cell key={i} fill={QUADRANTES[d.classificacao].color} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          {matriz.semAtribuicao.length > 0 && (
            <p className="text-xs text-muted-foreground italic">
              * {matriz.semAtribuicao.length} campanha(s) sem atribuição de conversão foram excluídas da matriz.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Performance por campanha */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-lg">Performance por campanha</CardTitle>
            <p className="text-sm text-muted-foreground">{lista.length} campanha(s) no filtro atual</p>
          </div>
          {filtros}
        </CardHeader>
        <CardContent className="space-y-6">
          <InvestimentoPorPublico campanhas={lista} />

          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período</p>
          ) : (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Público</TableHead>
                      <TableHead className="text-right">Investimento</TableHead>
                      <TableHead className="text-right">Alcance</TableHead>
                      <TableHead className="text-right">Freq.</TableHead>
                      <TableHead className="text-right">Cliques link</TableHead>
                      <TableHead className="text-right">CPS</TableHead>
                      <TableHead className="text-right">CPM</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">Add Carrinho</TableHead>
                      <TableHead className="text-right">Checkout</TableHead>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead className="text-right">Conversão</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">CPA</TableHead>
                      <TableHead className="text-right">ROAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lista.map((c) => {
                      const roas = n(c.roas);
                      const cor = roas >= 4 ? "text-success" : roas >= 2 ? "text-warning" : "text-danger";
                      const oportunidade = ehOportunidadeEscala(c);
                      return (
                        <TableRow key={c.campaign_id} id={ancora(c.campaign_id)} className="scroll-mt-24">
                          <TableCell className="font-medium max-w-[280px]">
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate">
                                  {oportunidade && "⭐ "}
                                  {c.campaign_name || "—"}
                                  {(c.status || "").toUpperCase() === "PAUSED" && (
                                    <span className="ml-1 text-[10px] text-muted-foreground">(pausada)</span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[320px]">
                                <p className="text-xs font-medium">{c.campaign_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {c.targeting_resumo || "Targeting ainda não sincronizado"}
                                </p>
                              </TooltipContent>
                            </UITooltip>
                          </TableCell>
                          <TableCell><PublicoBadge publico={c.publico} /></TableCell>
                          <TableCell className="text-right">{brl(c.investimento)}</TableCell>
                          <TableCell className="text-right">{int(c.reach)}</TableCell>
                          <TableCell className="text-right">{freqFmt(c.frequency)}</TableCell>
                          <TableCell className="text-right">{int(c.link_clicks)}</TableCell>
                          <TableCell className="text-right">{brl(c.cps)}</TableCell>
                          <TableCell className="text-right">{brl(c.cpm)}</TableCell>
                          <TableCell className="text-right">{pct(c.ctr_link, 2)}</TableCell>
                          <TableCell className="text-right">{int(c.add_to_cart)}</TableCell>
                          <TableCell className="text-right">{int(c.initiate_checkout)}</TableCell>
                          <TableCell className="text-right">{int(c.purchases)}</TableCell>
                          <TableCell className="text-right">{pct(c.conversao_rate, 2)}</TableCell>
                          <TableCell className="text-right">{brl(c.receita)}</TableCell>
                          <TableCell className="text-right">{n(c.purchases) > 0 ? brl(c.cpa) : "—"}</TableCell>
                          <TableCell className={cn("text-right font-semibold", cor)}>{roasFmt(c.roas)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Cards complementares do funil: Alcance, Frequência, Add to Cart, Checkout. */
export function MetricasComplementares({ campanhas, loading }: { campanhas: CampanhaPeriodo[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-[100px]" />;
  if (!campanhas.length) return null;
  const soma = (k: keyof CampanhaPeriodo) => campanhas.reduce((s, c) => s + n(c[k] as number), 0);
  const reach = soma("reach");
  const imp = soma("impressions");
  const freq = reach > 0 ? imp / reach : null;

  const cards = [
    { label: "Alcance", valor: int(reach), extra: `${int(imp)} impressões` },
    { label: "Frequência média", valor: freqFmt(freq), extra: "Ideal 2,5–3,5 · 🔴 acima de 4" },
    { label: "Add to Cart", valor: int(soma("add_to_cart")), extra: "" },
    { label: "Initiate Checkout", valor: int(soma("initiate_checkout")), extra: "" },
    { label: "Compras", valor: int(soma("purchases")), extra: "" },
    { label: "Receita", valor: brl(soma("receita")), extra: "" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> {c.label}
          </p>
          <p className="text-xl font-serif font-bold mt-1">{c.valor}</p>
          {c.extra && <p className="text-[11px] text-muted-foreground">{c.extra}</p>}
        </div>
      ))}
    </div>
  );
}
