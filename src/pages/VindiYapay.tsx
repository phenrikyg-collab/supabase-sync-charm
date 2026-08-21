import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SeletorDias } from "@/components/financeiro/SeletorDias";
import { brl, pctBr, num, dataCurta } from "@/lib/financeiroFormat";
import { ArrowDown, ArrowUp, Info } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
} from "recharts";

type Row = Record<string, any>;

interface VindiKpis {
  resumo?: Row;
  comparativo?: Row;
  por_meio?: Row[];
  por_parcelas?: Row[];
  serie_diaria?: Row[];
  a_liberar?: Row[];
  estimadas_pct?: number;
}

function corTaxa(v: number, limites: [number, number]) {
  if (v < limites[0]) return "text-success";
  if (v <= limites[1]) return "text-warning";
  return "text-danger";
}

function Variacao({ atual, anterior, inverso }: { atual?: number; anterior?: number; inverso?: boolean }) {
  if (anterior == null || anterior === 0 || atual == null) return null;
  const delta = ((Number(atual) - Number(anterior)) / Math.abs(Number(anterior))) * 100;
  if (!isFinite(delta)) return null;
  const subindo = delta >= 0;
  const bom = inverso ? !subindo : subindo;
  const Icon = subindo ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", bom ? "text-success" : "text-danger")}>
      <Icon className="h-3 w-3" />
      {pctBr(Math.abs(delta), 1)}
    </span>
  );
}

function Tile({
  label,
  value,
  loading,
  atual,
  anterior,
  inverso,
  valueClass,
}: {
  label: string;
  value: string;
  loading: boolean;
  atual?: number;
  anterior?: number;
  inverso?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <p className={cn("text-2xl font-semibold tabular-nums text-card-foreground", valueClass)}>{value}</p>
          <Variacao atual={atual} anterior={anterior} inverso={inverso} />
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, children, descricao }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4">
        <h2 className="font-serif text-lg font-semibold text-card-foreground">{titulo}</h2>
        {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

export default function VindiYapay() {
  const [dias, setDias] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["vindi_kpis", dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vindi_kpis" as any, { p_dias: dias });
      if (error) throw error;
      return (data ?? {}) as VindiKpis;
    },
  });

  const resumo = data?.resumo ?? {};
  const comp = data?.comparativo ?? {};
  const porMeio = [...(data?.por_meio ?? [])].sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0));
  const porParcelas = [...(data?.por_parcelas ?? [])].sort((a, b) => Number(a.parcelas ?? 0) - Number(b.parcelas ?? 0));
  const serie = (data?.serie_diaria ?? []).map((d) => ({
    ...d,
    dia: dataCurta(d.data ?? d.dia),
    volume: Number(d.volume ?? 0),
    taxas: Number(d.taxas ?? 0),
  }));
  const aLiberar = data?.a_liberar ?? [];
  const totalLiberar = aLiberar.reduce((s, r) => s + Number(r.valor ?? 0), 0);
  const estimadas = Number(data?.estimadas_pct ?? 0);
  const taxaEfetiva = Number(resumo.taxa_efetiva_pct ?? 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Vindi / Yapay</h1>
          <p className="text-sm text-muted-foreground">Custo real do meio de pagamento no checkout da loja</p>
        </div>
        <SeletorDias valor={dias} onChange={setDias} />
      </div>

      {/* Bloco A */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Tile label="Volume bruto" value={brl(resumo.volume_bruto)} loading={isLoading} atual={Number(resumo.volume_bruto ?? 0)} anterior={Number(comp.volume_bruto ?? 0)} />
        <Tile label="Taxas pagas" value={brl(resumo.taxas_total)} loading={isLoading} valueClass="text-danger" atual={Number(resumo.taxas_total ?? 0)} anterior={Number(comp.taxas_total ?? 0)} inverso />
        <Tile label="Líquido recebido" value={brl(resumo.liquido_recebido)} loading={isLoading} atual={Number(resumo.liquido_recebido ?? 0)} anterior={Number(comp.liquido_recebido ?? 0)} />
        <Tile
          label="Taxa efetiva"
          value={pctBr(taxaEfetiva)}
          loading={isLoading}
          valueClass={corTaxa(taxaEfetiva, [5, 7])}
          atual={taxaEfetiva}
          anterior={Number(comp.taxa_efetiva_pct ?? 0)}
          inverso
        />
        <Tile label="Ticket médio" value={brl(resumo.ticket_medio)} loading={isLoading} atual={Number(resumo.ticket_medio ?? 0)} anterior={Number(comp.ticket_medio ?? 0)} />
        <Tile
          label="Parcelamento médio (cartão)"
          value={`${num(resumo.parcelamento_medio_cartao, 2)}x`}
          loading={isLoading}
          atual={Number(resumo.parcelamento_medio_cartao ?? 0)}
          anterior={Number(comp.parcelamento_medio_cartao ?? 0)}
          inverso
        />
      </div>

      {/* Bloco B */}
      <Secao titulo="Custo por meio de pagamento">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Meio</th>
                <th className="py-2 pr-3 text-right">Transações</th>
                <th className="py-2 pr-3 text-right">Volume</th>
                <th className="py-2 pr-3">Share</th>
                <th className="py-2 pr-3 text-right">Taxa</th>
                <th className="py-2 pr-3 text-right">Taxas (R$)</th>
                <th className="py-2 pr-3 text-right">Ticket médio</th>
                <th className="py-2 text-right">Parcelamento</th>
              </tr>
            </thead>
            <tbody>
              {porMeio.map((m) => {
                const taxa = Number(m.taxa_pct ?? 0);
                const share = Number(m.share_pct ?? 0);
                return (
                  <tr key={String(m.meio)} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium text-foreground">{m.meio}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{num(m.transacoes)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{brl(m.volume)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
                        </div>
                        <span className="tabular-nums text-xs text-muted-foreground">{pctBr(share, 1)}</span>
                      </div>
                    </td>
                    <td className={cn("py-2 pr-3 text-right font-medium tabular-nums", corTaxa(taxa, [5, 8]))}>{pctBr(taxa)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{brl(m.taxas)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{brl(m.ticket_medio)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {m.parcelamento_medio ? `${num(m.parcelamento_medio, 2)}x` : "—"}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && porMeio.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">Sem dados no período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Secao>

      {/* Bloco C */}
      <Secao titulo="Custo do parcelamento">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={porParcelas.map((p) => ({ ...p, parcelas: `${p.parcelas}x`, volume: Number(p.volume ?? 0), taxa_pct: Number(p.taxa_pct ?? 0) }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="parcelas" fontSize={11} />
                <YAxis yAxisId="l" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <YAxis yAxisId="r" orientation="right" fontSize={11} tickFormatter={(v) => `${v}%`} />
                <RTooltip
                  formatter={(value: any, name: any) => (name === "taxa_pct" ? pctBr(Number(value)) : brl(Number(value)))}
                />
                <Legend />
                <Bar yAxisId="l" dataKey="volume" name="Volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" dataKey="taxa_pct" name="Taxa" stroke="hsl(var(--danger))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Parcelas</th>
                  <th className="py-2 pr-3 text-right">Transações</th>
                  <th className="py-2 pr-3 text-right">Volume</th>
                  <th className="py-2 pr-3 text-right">Taxa</th>
                  <th className="py-2 text-right">Custo taxas</th>
                </tr>
              </thead>
              <tbody>
                {porParcelas.map((p) => (
                  <tr key={String(p.parcelas)} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{p.parcelas}x</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{num(p.transacoes)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{brl(p.volume)}</td>
                    <td className={cn("py-2 pr-3 text-right tabular-nums", corTaxa(Number(p.taxa_pct ?? 0), [5, 8]))}>{pctBr(p.taxa_pct)}</td>
                    <td className="py-2 text-right tabular-nums">{brl(p.custo_taxas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Cada parcela adicional custa cerca de 0,8 ponto percentual de taxa. De 1x (4,58%) a 10x (12,49%) a diferença é de
          quase 8 pontos sobre o faturamento.
        </p>
      </Secao>

      {/* Bloco D */}
      <Secao titulo="Evolução">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="dia" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <RTooltip formatter={(value: any) => brl(Number(value))} />
              <Legend />
              <Line dataKey="volume" name="Volume" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line dataKey="taxas" name="Taxas" stroke="hsl(var(--danger))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Secao>

      {/* Bloco E */}
      <Secao titulo="A liberar" descricao="Pix libera no mesmo dia; cartões em D+2.">
        <p className="mb-3 text-2xl font-semibold tabular-nums text-foreground">{brl(totalLiberar)}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 text-right">Transações</th>
              </tr>
            </thead>
            <tbody>
              {aLiberar.map((r, i) => (
                <tr key={`${r.data}-${i}`} className="border-b last:border-0">
                  <td className="py-2 pr-3">{dataCurta(r.data)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{brl(r.valor)}</td>
                  <td className="py-2 text-right tabular-nums">{num(r.transacoes)}</td>
                </tr>
              ))}
              {!isLoading && aLiberar.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">Nada a liberar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Secao>

      {estimadas > 0 && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {pctBr(estimadas, 1)} das transações do período são estimadas a partir das taxas contratuais (a API da Vindi
            não expõe transações do checkout Tray ao lojista). Os valores seguem a tabela de taxas vigente; uma
            conferência mensal com o CSV do painel valida o cálculo.
          </span>
        </p>
      )}
    </div>
  );
}
