import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { brl, dataBr } from "@/lib/financeiroFormat";
import { useView, n, hojeISO, somaDias, ehConfirmado, rotuloMes, Linha } from "@/lib/finViews";
import { cn } from "@/lib/utils";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function ContasPagar() {
  const q = useView("vw_fin_contas_a_pagar", { col: "vencimento" });
  const rq = useView("vw_fin_contas_a_pagar_resumo");
  const [origem, setOrigem] = useState("todas");
  const [soConf, setSoConf] = useState(false);
  const [busca, setBusca] = useState("");
  const [verTodos, setVerTodos] = useState(false);

  const origens = useMemo(() => [...new Set((q.data ?? []).map((c) => c.origem).filter(Boolean))].sort(), [q.data]);
  const hoje = hojeISO();
  const fimSemana = somaDias(hoje, 7);
  const fimMes = hoje.slice(0, 7);

  const filtradas = (q.data ?? []).filter(
    (c) =>
      (origem === "todas" || c.origem === origem) &&
      (!soConf || ehConfirmado(c)) &&
      (!busca || norm(String(c.credor ?? "")).includes(norm(busca))),
  );

  const grupos: { rot: string; cor?: string; itens: Linha[] }[] = [
    { rot: "Vencidos", cor: "text-destructive", itens: [] },
    { rot: "Esta semana", itens: [] },
    { rot: "Este mês", itens: [] },
    { rot: "Próximos meses", itens: [] },
  ];
  const futuro: Linha[] = [];
  filtradas.forEach((c) => {
    const v = String(c.vencimento ?? "").slice(0, 10);
    if (v < hoje) grupos[0].itens.push(c);
    else if (v <= fimSemana) grupos[1].itens.push(c);
    else if (v.slice(0, 7) === fimMes) grupos[2].itens.push(c);
    else if (v < "2027-01-01") grupos[3].itens.push(c);
    else futuro.push(c);
  });

  const resumo = useMemo(() => {
    const rows = [...(rq.data ?? [])];
    const periodos = [...new Set(rows.map((r) => String(r.periodo)))].sort();
    const origensR = [...new Set(rows.map((r) => String(r.origem)))].sort();
    return { rows, periodos, origensR };
  }, [rq.data]);

  const tabela = (itens: Linha[]) => (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Vencimento</TableHead><TableHead>Credor</TableHead><TableHead>Descrição</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        {itens.map((c, i) => {
          const est = !ehConfirmado(c);
          return (
            <TableRow key={c.id ?? i} className={cn(est && "opacity-60")}>
              <TableCell className="whitespace-nowrap">{dataBr(c.vencimento)}</TableCell>
              <TableCell className="font-medium">
                {c.credor || "-"}
                {est && <Badge variant="outline" className="ml-2 text-[10px]">Estimado</Badge>}
                {c.nota && (
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="ml-1 inline h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">{c.nota}</TooltipContent>
                  </Tooltip>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{c.descricao || "-"}</TableCell>
              <TableCell className="text-xs">{c.origem || "-"}</TableCell>
              <TableCell className="text-right font-mono">{brl(c.valor)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  if (q.isLoading) return <div className="py-20 text-center text-muted-foreground">Carregando...</div>;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground mt-1">Compromissos confirmados e estimados</p>
        </div>
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

        <Card>
          <CardHeader><CardTitle className="text-base">Resumo por período</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  {resumo.periodos.map((p) => <TableHead key={p} className="text-right">{p.startsWith("0.") ? "Vencido" : rotuloMes(p)}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...resumo.origensR, "__total"].map((o) => (
                  <TableRow key={o} className={o === "__total" ? "font-semibold bg-muted/40" : ""}>
                    <TableCell>{o === "__total" ? "Total" : o}</TableCell>
                    {resumo.periodos.map((p) => {
                      const rs = resumo.rows.filter((r) => String(r.periodo) === p && (o === "__total" || String(r.origem) === o));
                      const conf = rs.reduce((s, r) => s + n(r.valor_confirmado), 0);
                      const est = rs.reduce((s, r) => s + n(r.valor_estimado), 0);
                      const tot = rs.reduce((s, r) => s + n(r.valor_total), 0);
                      return (
                        <TableCell key={p} className={cn("text-right font-mono text-sm", p.startsWith("0.") && tot > 0 && "text-destructive")}>
                          {tot ? brl(tot) : "-"}
                          {est > 0 && <div className="text-[10px] text-muted-foreground">{brl(conf)} conf. · {brl(est)} est.</div>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={origem} onValueChange={setOrigem}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as origens</SelectItem>
              {origens.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Buscar credor" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-[220px]" />
          <div className="flex items-center gap-2"><Switch id="soconf" checked={soConf} onCheckedChange={setSoConf} /><Label htmlFor="soconf">Apenas confirmados</Label></div>
        </div>

        {grupos.map((g) => g.itens.length > 0 && (
          <Card key={g.rot}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className={cn("text-base", g.cor)}>{g.rot} <span className="text-muted-foreground font-normal">({g.itens.length})</span></CardTitle>
              <span className={cn("font-mono font-semibold", g.cor)}>{brl(g.itens.reduce((s, c) => s + n(c.valor), 0))}</span>
            </CardHeader>
            <CardContent className="p-0">{tabela(g.itens)}</CardContent>
          </Card>
        ))}

        {futuro.length > 0 && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">2027 em diante <span className="text-muted-foreground font-normal">({futuro.length})</span></CardTitle>
              <div className="flex items-center gap-3">
                <span className="font-mono font-semibold">{brl(futuro.reduce((s, c) => s + n(c.valor), 0))}</span>
                <Button size="sm" variant="outline" onClick={() => setVerTodos(!verTodos)}>{verTodos ? "Recolher" : "Ver todos"}</Button>
              </div>
            </CardHeader>
            {verTodos && <CardContent className="p-0">{tabela(futuro)}</CardContent>}
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
