import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { brl, dec, ddmm, int, num, pct } from "@/lib/gestaoFormat";
import { cn } from "@/lib/utils";

type Linha = {
  data: string;
  campaign_id?: string | null;
  campaign_name?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  custo?: number | null;
  conversoes?: number | null;
  valor_conversoes?: number | null;
};

function isoMenosDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - (dias - 1));
  return d.toISOString().slice(0, 10);
}

function agrega(rows: Linha[]) {
  const custo = rows.reduce((s, r) => s + num(r.custo), 0);
  const cliques = rows.reduce((s, r) => s + num(r.clicks), 0);
  const impressoes = rows.reduce((s, r) => s + num(r.impressions), 0);
  const conv = rows.reduce((s, r) => s + num(r.conversoes), 0);
  const valorConv = rows.reduce((s, r) => s + num(r.valor_conversoes), 0);
  return {
    custo, cliques, impressoes, conv, valorConv,
    ctr: impressoes > 0 ? (cliques / impressoes) * 100 : 0,
    cpc: cliques > 0 ? custo / cliques : 0,
    cpm: impressoes > 0 ? (custo / impressoes) * 1000 : 0,
    cpa: conv > 0 ? custo / conv : 0,
    roas: custo > 0 ? valorConv / custo : 0,
  };
}

function GoogleStatus({ google }: { google: any }) {
  const semaforo = google?.semaforo ?? "desativado";
  const configs: Record<string, { emoji: string; label: string; cor: string }> = {
    verde: { emoji: "🟢", label: "Veiculando", cor: "text-emerald-600" },
    amarelo: { emoji: "🟡", label: "Sem veiculação ontem", cor: "text-amber-600" },
    vermelho: { emoji: "🔴", label: `Parado há ${google?.dias_sem_veiculacao ?? "?"} dias`, cor: "text-red-600" },
    pausa_planejada: { emoji: "⚪", label: "Pausa planejada", cor: "text-muted-foreground" },
    erro_tecnico: { emoji: "🔴", label: "Erro de integração", cor: "text-red-600" },
    desativado: { emoji: "⚪", label: "Integração desligada", cor: "text-muted-foreground" },
  };
  const cfg = configs[semaforo] ?? configs.desativado;
  const tooltip =
    semaforo === "pausa_planejada" ? google?.pausa_observacao
    : semaforo === "erro_tecnico" ? google?.ultimo_erro
    : null;

  const content = (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-sm font-medium", cfg.cor)}>{cfg.emoji} {cfg.label}</span>
        {semaforo === "verde" && google?.custo_ontem != null && (
          <span className="text-xs text-muted-foreground">{brl(google.custo_ontem)}</span>
        )}
      </div>
      {google?.ultimo_dia_com_veiculacao && (
        <p className="text-[11px] text-muted-foreground">
          Última veiculação: {ddmm(google.ultimo_dia_com_veiculacao)}
        </p>
      )}
    </div>
  );

  if (!tooltip) return content;
  return (
    <UITooltip>
      <TooltipTrigger asChild><div className="cursor-help inline-block">{content}</div></TooltipTrigger>
      <TooltipContent className="max-w-xs"><p>{tooltip}</p></TooltipContent>
    </UITooltip>
  );
}

export default function GoogleAds() {
  const [dias, setDias] = useState("14");

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["google-ads-diario", dias],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_ads_diario" as any)
        .select("data, campaign_id, campaign_name, impressions, clicks, custo, conversoes, valor_conversoes")
        .gte("data", isoMenosDias(Number(dias)))
        .order("data", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as Linha[];
    },
  });

  const { data: googleStatus } = useQuery({
    queryKey: ["google-ads-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gestao_checklist_diario" as any);
      if (error) return null;
      return (data as any)?.midia?.google ?? null;
    },
    retry: false,
  });

  const totais = useMemo(() => agrega(linhas), [linhas]);

  const porDia = useMemo(() => {
    const map = new Map<string, Linha[]>();
    linhas.forEach((r) => {
      const k = String(r.data);
      map.set(k, [...(map.get(k) ?? []), r]);
    });
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([data, rows]) => ({ data, ...agrega(rows) }));
  }, [linhas]);

  const porCampanha = useMemo(() => {
    const map = new Map<string, Linha[]>();
    linhas.forEach((r) => {
      const k = r.campaign_name || r.campaign_id || "—";
      map.set(k, [...(map.get(k) ?? []), r]);
    });
    return [...map.entries()]
      .map(([nome, rows]) => ({ nome, ...agrega(rows) }))
      .sort((a, b) => b.custo - a.custo);
  }, [linhas]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-tight">Google Ads</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhamento diário do investimento, cliques e conversões do Google Ads.
          </p>
        </div>
        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="14">14 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TooltipProvider>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Status da veiculação</CardTitle></CardHeader>
          <CardContent><GoogleStatus google={googleStatus} /></CardContent>
        </Card>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mt-6">
          {[
            { l: "Investido", v: brl(totais.custo) },
            { l: "Cliques", v: int(totais.cliques) },
            { l: "CPC médio", v: brl(totais.cpc) },
            { l: "CTR", v: pct(totais.ctr, 2) },
            { l: "Conversões", v: dec(totais.conv, 0) },
            { l: "CPA", v: brl(totais.cpa) },
            { l: "Valor de conversões", v: brl(totais.valorConv) },
            {
              l: "ROAS",
              v: dec(totais.roas, 2),
              c: totais.roas >= 1 ? "text-emerald-600" : totais.custo > 0 ? "text-red-600" : "",
            },
          ].map((t) => (
            <Card key={t.l}>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.l}</p>
                <p className={cn("text-xl font-semibold mt-1", (t as any).c)}>{t.v}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6">
          <CardHeader className="pb-3"><CardTitle className="text-base">Por dia</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
              </div>
            ) : (
              <Table containerClassName="max-h-[70vh]">
                <TableHeader className="sticky top-0 z-20 bg-card">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Impressões</TableHead>
                    <TableHead className="text-right">CPM</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">CPC</TableHead>
                    <TableHead className="text-right">Investido</TableHead>
                    <TableHead className="text-right">Conversões</TableHead>
                    <TableHead className="text-right">CPA</TableHead>
                    <TableHead className="text-right">Valor conv.</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porDia.map((r) => (
                    <TableRow key={r.data} className={cn(r.custo <= 0 && "opacity-50")}>
                      <TableCell className="whitespace-nowrap">{ddmm(r.data)}</TableCell>
                      <TableCell className="text-right">{int(r.impressoes)}</TableCell>
                      <TableCell className="text-right">{brl(r.cpm)}</TableCell>
                      <TableCell className="text-right">{int(r.cliques)}</TableCell>
                      <TableCell className="text-right">{pct(r.ctr, 2)}</TableCell>
                      <TableCell className="text-right">{brl(r.cpc)}</TableCell>
                      <TableCell className="text-right">{brl(r.custo)}</TableCell>
                      <TableCell className="text-right">{dec(r.conv, 0)}</TableCell>
                      <TableCell className="text-right">{brl(r.cpa)}</TableCell>
                      <TableCell className="text-right">{brl(r.valorConv)}</TableCell>
                      <TableCell className={cn("text-right font-medium", r.roas >= 1 ? "text-emerald-600" : r.custo > 0 ? "text-red-600" : "")}>
                        {dec(r.roas, 2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {porDia.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                        Sem dados no período.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader className="pb-3"><CardTitle className="text-base">Por campanha</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table containerClassName="max-h-[70vh]">
              <TableHeader className="sticky top-0 z-20 bg-card">
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">Investido</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right">Valor conv.</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCampanha.map((r) => (
                  <TableRow key={r.nome}>
                    <TableCell className="max-w-[280px] truncate">{r.nome}</TableCell>
                    <TableCell className="text-right">{int(r.impressoes)}</TableCell>
                    <TableCell className="text-right">{int(r.cliques)}</TableCell>
                    <TableCell className="text-right">{pct(r.ctr, 2)}</TableCell>
                    <TableCell className="text-right">{brl(r.cpc)}</TableCell>
                    <TableCell className="text-right">{brl(r.custo)}</TableCell>
                    <TableCell className="text-right">{dec(r.conv, 0)}</TableCell>
                    <TableCell className="text-right">{brl(r.cpa)}</TableCell>
                    <TableCell className="text-right">{brl(r.valorConv)}</TableCell>
                    <TableCell className={cn("text-right font-medium", r.roas >= 1 ? "text-emerald-600" : r.custo > 0 ? "text-red-600" : "")}>
                      {dec(r.roas, 2)}
                    </TableCell>
                  </TableRow>
                ))}
                {porCampanha.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Sem campanhas no período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-4">
              Fonte: google_ads_diario · conversões e valor de conversões conforme atribuição do Google Ads.
            </p>
          </CardContent>
        </Card>
      </TooltipProvider>
    </div>
  );
}
