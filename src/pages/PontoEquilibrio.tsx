import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, pctBr, num } from "@/lib/financeiroFormat";
import { parseValorBR, formatValorBR } from "@/lib/rhMoeda";
import { useView, n, mesDe, rotuloMes } from "@/lib/finViews";
import { cn } from "@/lib/utils";

const PCTS: [string, string][] = [
  ["imposto_pct", "Impostos"], ["gateway_pct", "Taxas gateway"], ["desconto_pct", "Descontos"],
  ["estorno_pct", "Estornos"], ["cmv_pct", "CMV"], ["variaveis_pct", "Custos variáveis"],
];
const VALORES: [string, string][] = [["custos_fixos_mes", "Custos fixos/mês (R$)"], ["nao_operacional_mes", "Não operacional/mês (R$)"], ["ticket_medio", "Ticket médio (R$)"]];
const CAMPOS = [...PCTS, ...VALORES].map(([k]) => k);

export default function PontoEquilibrio() {
  const pq = useView("vw_fin_premissas_equilibrio");
  const dq = useView("vw_fin_dre_mensal");
  const real = pq.data?.[0];
  const ultimo = useMemo(() => [...(dq.data ?? [])].sort((a, b) => mesDe(a).localeCompare(mesDe(b))).pop(), [dq.data]);

  const [txt, setTxt] = useState<Record<string, string>>({});
  const [incluirDividas, setIncluirDividas] = useState(false);
  const [lucroTxt, setLucroTxt] = useState("20.000,00");
  const [vendaTxt, setVendaTxt] = useState("");

  const reset = () => { if (real) setTxt(Object.fromEntries(CAMPOS.map((k) => [k, formatValorBR(n(real[k]))]))); };
  useEffect(() => { if (real && !Object.keys(txt).length) reset(); }, [real]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = (k: string) => parseValorBR(txt[k]) ?? 0;
  const somaPct = PCTS.reduce((s, [k]) => s + v(k), 0);
  const mc = 100 - somaPct;
  const custos = v("custos_fixos_mes") + (incluirDividas ? v("nao_operacional_mes") : 0);
  const ticket = v("ticket_medio");
  const receitaUlt = n(ultimo?.receita_bruta);

  const eq = mc > 0 ? custos / (mc / 100) : 0;
  const pedidos = ticket ? eq / ticket : 0;

  const sens = (dCmv: number, dDesc: number) => {
    const m = mc - dCmv - dDesc;
    return m > 0 ? custos / (m / 100) : Infinity;
  };

  const lucro = parseValorBR(lucroTxt) ?? 0;
  const receitaMeta = mc > 0 ? (custos + lucro) / (mc / 100) : 0;
  const venda = parseValorBR(vendaTxt) ?? 0;
  const mcNec = venda ? ((custos + lucro) / venda) * 100 : 0;
  const cmvMax = v("cmv_pct") + (mc - mcNec);
  const corteFixos = Math.max(0, custos + lucro - venda * (mc / 100));

  if (pq.isLoading) return <div className="py-20 text-center text-muted-foreground">Carregando...</div>;

  const dreResumo = (receita: number) => [
    ["Receita bruta", receita],
    ...PCTS.map(([k, r]) => [`(-) ${r}`, -receita * v(k) / 100] as [string, number]),
    ["= Margem de contribuição", receita * mc / 100],
    [incluirDividas ? "(-) Fixos + empréstimos/juros" : "(-) Custos fixos", -custos],
    ["= Resultado", receita * mc / 100 - custos],
  ] as [string, number][];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Ponto de Equilíbrio</h1>
        <p className="text-sm text-muted-foreground mt-1">Simule premissas e metas. Nada aqui é salvo.</p>
      </div>
      {pq.error && <p className="text-sm text-destructive">{(pq.error as Error).message}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Premissas (% sobre a receita bruta)</CardTitle>
          <Button size="sm" variant="outline" onClick={reset}>Voltar aos valores reais</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[...PCTS.map(([k, r]) => [k, `${r} (%)`]), ...VALORES].map(([k, r]) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{r}</Label>
                <Input value={txt[k] ?? ""} onChange={(e) => setTxt({ ...txt, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={incluirDividas} onCheckedChange={(c) => setIncluirDividas(!!c)} /> Incluir empréstimos e juros</label>
            <span>MC: <b className={cn(mc <= 0 && "text-destructive")}>{pctBr(mc, 1)}</b></span>
            <span>Custos considerados: <b>{brl(custos)}</b></span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="eq">
        <TabsList><TabsTrigger value="eq">Ponto de equilíbrio</TabsTrigger><TabsTrigger value="meta">Meta de lucro</TabsTrigger></TabsList>

        <TabsContent value="eq" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Receita bruta de equilíbrio</p><p className="text-xl font-serif font-bold">{mc > 0 ? brl(eq) : "MC negativa"}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Pedidos no mês</p><p className="text-xl font-serif font-bold">{num(pedidos)}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground">Por dia</p><p className="text-xl font-serif font-bold">{brl(eq / 30)}</p><p className="text-xs text-muted-foreground">{num(pedidos / 30, 1)} pedidos</p></CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">Último mês {ultimo ? `(${rotuloMes(mesDe(ultimo))})` : ""}</p>
              <p className="text-xl font-serif font-bold">{brl(receitaUlt)}</p>
              <p className={cn("text-xs", receitaUlt >= eq ? "text-success" : "text-destructive")}>
                {receitaUlt >= eq ? `${brl(receitaUlt - eq)} acima` : `${brl(eq - receitaUlt)} abaixo`}
              </p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Sensibilidade: receita de equilíbrio</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CMV \ Descontos</TableHead>
                    {[-2, -1, 0, 1, 2].map((d) => <TableHead key={d} className="text-right">{d > 0 ? "+" : ""}{d} p.p. ({pctBr(v("desconto_pct") + d, 1)})</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[-3, -2, -1, 0, 1, 2, 3].map((c) => (
                    <TableRow key={c}>
                      <TableCell className="font-medium">{c > 0 ? "+" : ""}{c} p.p. ({pctBr(v("cmv_pct") + c, 1)})</TableCell>
                      {[-2, -1, 0, 1, 2].map((d) => {
                        const r = sens(c, d);
                        return <TableCell key={d} className={cn("text-right font-mono text-sm", c === 0 && d === 0 && "font-bold bg-muted/50", r > receitaUlt && "text-destructive")}>{Number.isFinite(r) ? brl(r) : "-"}</TableCell>;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meta" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Quanto preciso vender?</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1"><Label>Lucro líquido desejado (R$)</Label><Input value={lucroTxt} onChange={(e) => setLucroTxt(e.target.value)} /></div>
              <p>Receita necessária: <b>{mc > 0 ? brl(receitaMeta) : "-"}</b> · {num(ticket ? receitaMeta / ticket : 0)} pedidos ({num(ticket ? receitaMeta / ticket / 30 : 0, 1)}/dia)</p>
              <Table><TableBody>
                {dreResumo(receitaMeta).map(([r, val]) => (
                  <TableRow key={r} className={r.startsWith("=") || r === "Receita bruta" ? "font-semibold" : ""}>
                    <TableCell>{r}</TableCell><TableCell className="text-right font-mono">{brl(val)}</TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Com a venda que consigo fazer</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1"><Label>Venda bruta possível (R$)</Label><Input value={vendaTxt} onChange={(e) => setVendaTxt(e.target.value)} placeholder="0,00" /></div>
              {venda > 0 && (
                <>
                  <p>MC necessária: <b>{pctBr(mcNec, 1)}</b> (atual {pctBr(mc, 1)})</p>
                  <p>CMV máximo mantendo o resto: <b className={cn(cmvMax < 0 && "text-destructive")}>{pctBr(cmvMax, 1)}</b> (atual {pctBr(v("cmv_pct"), 1)})</p>
                  <p>Corte necessário nos fixos: <b className={cn(corteFixos > 0 && "text-destructive")}>{brl(corteFixos)}</b>{corteFixos === 0 && " (já atinge a meta)"}</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
