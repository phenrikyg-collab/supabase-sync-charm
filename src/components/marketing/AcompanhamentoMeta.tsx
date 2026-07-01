import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import {
  useRealizadoMes,
  PILAR_LABELS,
  PILAR_FORMATOS,
  formatPilar,
  type PilarKey,
  type PilarStatus,
} from "@/hooks/useRealizadoMes";
import { MESES } from "@/hooks/usePlanejamentoMensal";

const PILARES_ORDEM: PilarKey[] = [
  "receita_faturada",
  "receita_captada",
  "sessoes_totais",
  "sessoes_organicas",
  "sessoes_midia",
  "taxa_conversao",
  "taxa_aprovacao",
  "taxa_aquisicao",
  "pedidos_captados",
  "investimento_total",
  "adcost_pct",
  "cpc_medio",
  "cac_novos",
  "roas_faturado",
];

const statusDot = (s: PilarStatus) => {
  if (s === "verde") return "🟢";
  if (s === "amarelo") return "🟡";
  if (s === "vermelho") return "🔴";
  return "⚪";
};

const statusColor = (s: PilarStatus) => {
  if (s === "verde") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "amarelo") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "vermelho") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-muted text-muted-foreground";
};

export function AcompanhamentoMeta({ ano, mes }: { ano: number; mes: number }) {
  const r = useRealizadoMes(ano, mes);

  const ritmoCard = (
    label: string,
    pctAtingido: number | null,
    pctDecorrido: number,
  ) => {
    const ok = pctAtingido != null && pctAtingido >= pctDecorrido;
    const cls = pctAtingido == null
      ? "bg-muted"
      : ok
        ? "bg-emerald-50 border-emerald-200"
        : "bg-rose-50 border-rose-200";
    return (
      <div className={`rounded-lg border p-3 ${cls}`}>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xl font-serif mt-1">
          {pctAtingido == null ? "—" : `${pctAtingido.toFixed(0)}%`}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          mês decorrido: {pctDecorrido.toFixed(0)}%
        </div>
      </div>
    );
  };

  return (
    <Card style={{ borderColor: "#E8CD7E" }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="font-serif text-lg">
            Acompanhamento da Meta — {MESES[mes - 1]} {ano}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Meta do Planejamento Mensal × Realizado até hoje × Projeção de fechamento
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => r.refetch()} disabled={r.isRefreshing} className="gap-1">
          {r.isRefreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {r.isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Carregando meta × realizado…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ritmoCard("Ritmo do mês", r.ritmoMes.pctDecorrido, r.ritmoMes.pctDecorrido)}
              {ritmoCard("Receita atingida", r.ritmoMes.pctReceita, r.ritmoMes.pctDecorrido)}
              {ritmoCard("Sessões atingidas", r.ritmoMes.pctSessoes, r.ritmoMes.pctDecorrido)}
            </div>

            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "#1D1D1B" }}>
                    <TableHead className="text-[#E8CD7E] uppercase text-[10px] tracking-wider">Pilar</TableHead>
                    <TableHead className="text-[#E8CD7E] uppercase text-[10px] tracking-wider text-right">Meta</TableHead>
                    <TableHead className="text-[#E8CD7E] uppercase text-[10px] tracking-wider text-right">Realizado</TableHead>
                    <TableHead className="text-[#E8CD7E] uppercase text-[10px] tracking-wider text-right">Projeção</TableHead>
                    <TableHead className="text-[#E8CD7E] uppercase text-[10px] tracking-wider text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PILARES_ORDEM.map((k, i) => {
                    const fmt = PILAR_FORMATOS[k];
                    const meta = r.meta[k] ?? null;
                    const real = r.realizado[k] ?? null;
                    const proj = r.projecao[k] ?? null;
                    const st = r.statusPorPilar[k] ?? "neutro";
                    return (
                      <TableRow key={k} className={i % 2 ? "bg-[#FAF8F3]" : "bg-white"}>
                        <TableCell className="font-medium">{PILAR_LABELS[k]}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatPilar(meta, fmt)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatPilar(real, fmt)}</TableCell>
                        <TableCell className="text-right">{formatPilar(proj, fmt)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={statusColor(st)}>
                            {statusDot(st)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Meta vem do Planejamento Mensal (aba PLANEJADO). Realizado é acumulado até hoje (GA4, Meta Ads e vendas). Projeção = realizado × (dias do mês / dias decorridos).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DiagnosticoMes({ ano, mes }: { ano: number; mes: number }) {
  const r = useRealizadoMes(ano, mes);
  const diagnosticos: { titulo: string; evidencia: string; acao: string; cor: string }[] = [];
  const pctDec = r.ritmoMes.pctDecorrido;

  // 1. Sessões abaixo do ritmo
  const sT = r.realizado.sessoes_totais ?? 0;
  const sMeta = r.meta.sessoes_totais ?? 0;
  if (sMeta > 0 && sT / sMeta * 100 < pctDec * 0.95) {
    // encontrar canal com maior queda
    const quedas = r.canaisAtual
      .map((c) => ({
        grupo: c.grupo,
        atual: c.participacao,
        hist: r.canaisHistoricos[c.grupo] ?? 0,
        queda: (r.canaisHistoricos[c.grupo] ?? 0) - c.participacao,
      }))
      .filter((q) => q.hist > 5)
      .sort((a, b) => b.queda - a.queda);
    const pior = quedas[0];
    diagnosticos.push({
      titulo: "Sessões abaixo do ritmo da meta",
      evidencia: pior
        ? `Canal com maior queda de participação: ${pior.grupo} (${pior.atual.toFixed(1)}% atual vs ${pior.hist.toFixed(1)}% histórico).`
        : `Volume acumulado ${((sT / sMeta) * 100).toFixed(0)}% da meta com ${pctDec.toFixed(0)}% do mês decorrido.`,
      acao: pior
        ? `Escalar campanhas ou revisar SEO/criativos em ${pior.grupo}. Considere aumentar investimento em canais pagos ou publicar mais conteúdo orgânico.`
        : "Aumentar investimento em mídia paga ou intensificar publicações orgânicas.",
      cor: "border-rose-200 bg-rose-50",
    });
  }

  // 2. Taxa de conversão abaixo da meta
  const tc = r.realizado.taxa_conversao ?? null;
  const tcMeta = r.meta.taxa_conversao ?? null;
  if (tc != null && tcMeta != null && tc < tcMeta * 0.9) {
    diagnosticos.push({
      titulo: "Taxa de conversão abaixo da meta",
      evidencia: `Conversão atual ${tc.toFixed(2)}% vs meta ${tcMeta.toFixed(2)}%.`,
      acao: "Revisar funil de checkout, testar novos CTAs, revisar preço/frete e provas sociais em páginas de produto.",
      cor: "border-amber-200 bg-amber-50",
    });
  }

  // 3. ROAS baixo
  const roas = r.realizado.roas_faturado ?? 0;
  if (roas > 0 && roas < 2 && r.campanhasBaixoRoas.length > 0) {
    diagnosticos.push({
      titulo: "ROAS abaixo do ponto de equilíbrio",
      evidencia: `Top campanhas com pior ROAS: ${r.campanhasBaixoRoas.map((c) => `${c.campaign} (${c.roas.toFixed(2)}x)`).join(", ")}.`,
      acao: "Pausar ou reduzir orçamento dessas campanhas; realocar para as com melhor performance ou revisar criativos.",
      cor: "border-rose-200 bg-rose-50",
    });
  }

  // 4. CAC alto
  const cac = r.realizado.cac_novos ?? null;
  const cacMeta = r.meta.cac_novos ?? null;
  if (cac != null && cacMeta != null && cac > cacMeta * 1.2) {
    diagnosticos.push({
      titulo: "CAC de novos acima da meta",
      evidencia: `CAC atual R$ ${cac.toFixed(0)} vs meta R$ ${cacMeta.toFixed(0)}.`,
      acao: "Revisar mix de canais: reduzir gasto em canais caros, escalar canais com melhor eficiência de aquisição.",
      cor: "border-amber-200 bg-amber-50",
    });
  }

  // 5. Investimento estourando
  const inv = r.projecao.investimento_total ?? null;
  const invMeta = r.meta.investimento_total ?? null;
  if (inv != null && invMeta != null && invMeta > 0 && inv > invMeta * 1.15) {
    diagnosticos.push({
      titulo: "Projeção de investimento acima do orçado",
      evidencia: `Projeção R$ ${inv.toFixed(0)} vs meta R$ ${invMeta.toFixed(0)}.`,
      acao: "Ajustar ritmo diário de gasto ou revisar campanhas com maior consumo.",
      cor: "border-rose-200 bg-rose-50",
    });
  }

  return (
    <Card style={{ borderColor: "#F5E9B8" }}>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Diagnóstico do Mês</CardTitle>
        <p className="text-xs text-muted-foreground">
          Regras determinísticas baseadas nos dados reais do sistema.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {r.isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Analisando…
          </div>
        ) : diagnosticos.length === 0 ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm">
            ✅ Todos os pilares estão dentro do esperado para o ritmo do mês.
          </div>
        ) : (
          diagnosticos.map((d, i) => (
            <div key={i} className={`rounded-md border p-4 ${d.cor}`}>
              <div className="font-semibold text-sm">{d.titulo}</div>
              <div className="text-xs text-muted-foreground mt-1">{d.evidencia}</div>
              <div className="text-xs mt-2">
                <strong>Ação sugerida:</strong> {d.acao}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
