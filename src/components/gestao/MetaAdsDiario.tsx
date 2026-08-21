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

const CPA_PISO = 131.46;

export default function MetaAdsDiario() {
  const [dias, setDias] = useState("14");

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["gestao-meta-diario", dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("meta_acompanhamento_diario" as any, { p_dias: Number(dias) });
      if (error) throw error;
      const arr = Array.isArray(data) ? data : [];
      return [...arr].sort((a: any, b: any) => String(b.data).localeCompare(String(a.data)));
    },
  });

  const { data: googleAds = [] } = useQuery({
    queryKey: ["gestao-google-ads", dias],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_ads_diario" as any)
        .select("data, campaign_name, impressions, clicks, custo, conversoes, valor_conversoes")
        .order("data", { ascending: false })
        .limit(200);
      if (error) return [] as any[];
      return (data ?? []) as any[];
    },
    retry: false,
  });

  const totais = useMemo(() => {
    const investido = linhas.reduce((s: number, r: any) => s + num(r.valor_usado), 0);
    const vendido = linhas.reduce((s: number, r: any) => s + num(r.valor_venda), 0);
    const lucro = linhas.reduce((s: number, r: any) => s + num(r.lucro), 0);
    return { investido, vendido, lucro, roas: investido > 0 ? vendido / investido : 0 };
  }, [linhas]);

  const cpaCor = (v: number) => (v <= 0 ? "" : v < 90 ? "text-emerald-600" : v <= CPA_PISO ? "text-amber-600" : "text-red-600");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Meta Ads diário</h2>
        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="14">14 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          { l: "Investido", v: brl(totais.investido) },
          { l: "Vendido", v: brl(totais.vendido) },
          { l: "Lucro", v: brl(totais.lucro), c: totais.lucro >= 0 ? "text-emerald-600" : "text-red-600" },
          { l: "ROAS médio", v: dec(totais.roas, 2) },
        ].map((t) => (
          <Card key={t.l}>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.l}</p>
              <p className={cn("text-xl font-semibold mt-1", t.c)}>{t.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Alcance</TableHead>
                    <TableHead className="text-right">CPM</TableHead>
                    <TableHead className="text-right">CTR link</TableHead>
                    <TableHead className="text-right">CTR todos</TableHead>
                    <TableHead className="text-right">Sessões anúncio</TableHead>
                    <TableHead className="text-right">Connect rate</TableHead>
                    <TableHead className="text-right">CPS</TableHead>
                    <TableHead className="text-right">Carrinho</TableHead>
                    <TableHead className="text-right">Checkout</TableHead>
                    <TableHead className="text-right">Compras</TableHead>
                    <TableHead className="text-right">CPA</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">Investido</TableHead>
                    <TableHead className="text-right">Vendido</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((r: any, i: number) => {
                    const parcial = num(r.valor_usado) < 200;
                    const row = (
                      <TableRow key={i} className={cn(parcial && "opacity-50")}>
                        <TableCell className="whitespace-nowrap">{ddmm(r.data)}</TableCell>
                        <TableCell className="text-right">{int(r.alcance)}</TableCell>
                        <TableCell className="text-right">{brl(r.cpm)}</TableCell>
                        <TableCell className="text-right">{pct(r.ctr_link, 2)}</TableCell>
                        <TableCell className="text-right">{pct(r.ctr_todos, 2)}</TableCell>
                        <TableCell className="text-right">{int(r.sessoes_anuncio)}</TableCell>
                        <TableCell className={cn("text-right", num(r.connect_rate) < 30 && "text-red-600 font-medium")}>
                          {pct(r.connect_rate, 1)}
                        </TableCell>
                        <TableCell className={cn("text-right", num(r.cps) > 1.8 && "text-amber-600 font-medium")}>
                          {brl(r.cps)}
                        </TableCell>
                        <TableCell className="text-right">{int(r.carrinho)}</TableCell>
                        <TableCell className="text-right">{int(r.checkout)}</TableCell>
                        <TableCell className="text-right">{int(r.compras)}</TableCell>
                        <TableCell className={cn("text-right font-medium", cpaCor(num(r.cpa)))}>{brl(r.cpa)}</TableCell>
                        <TableCell className="text-right">{dec(r.roas, 2)}</TableCell>
                        <TableCell className="text-right">{brl(r.valor_usado)}</TableCell>
                        <TableCell className="text-right">{brl(r.valor_venda)}</TableCell>
                        <TableCell className={cn("text-right font-medium", num(r.lucro) > 0 ? "text-emerald-600" : num(r.lucro) < 0 ? "text-red-600" : "")}>
                          {brl(r.lucro)}
                        </TableCell>
                      </TableRow>
                    );
                    if (!parcial) return row;
                    return (
                      <UITooltip key={i}>
                        <TooltipTrigger asChild>{row}</TooltipTrigger>
                        <TooltipContent>dia com sync parcial — números incompletos</TooltipContent>
                      </UITooltip>
                    );
                  })}
                  {linhas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={16} className="text-center text-muted-foreground py-8">
                        Sem dados no período.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Fonte: meta_ads_conjuntos · Alcance é somado por conjunto (aproximado) · Lucro = venda atribuída −
            investimento (não desconta custo do produto; margem de contribuição real ≈ 38,4% da receita).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Google Ads</CardTitle></CardHeader>
        <CardContent>
          {googleAds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Integração aprovada e configurada — aguardando liberação da API pela Google. Os dados aparecerão aqui
              automaticamente.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead className="text-right">Impressões</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Conversões</TableHead>
                    <TableHead className="text-right">Valor conversões</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {googleAds.map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{ddmm(r.data)}</TableCell>
                      <TableCell>{r.campaign_name ?? "—"}</TableCell>
                      <TableCell className="text-right">{int(r.impressions)}</TableCell>
                      <TableCell className="text-right">{int(r.clicks)}</TableCell>
                      <TableCell className="text-right">{brl(r.custo)}</TableCell>
                      <TableCell className="text-right">{dec(r.conversoes, 0)}</TableCell>
                      <TableCell className="text-right">{brl(r.valor_conversoes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
