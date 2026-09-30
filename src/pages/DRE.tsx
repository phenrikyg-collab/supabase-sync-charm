import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, pctBr, dataBr } from "@/lib/financeiroFormat";
import { useView, n, campo, mesDe, rotuloMes, Linha } from "@/lib/finViews";
import { cn } from "@/lib/utils";

type Def = {
  rot: string;
  campos: string[];
  tipo: "base" | "menos" | "total";
  pct?: string[];
  drill?: string[];
};

const LINHAS: Def[] = [
  { rot: "Receita bruta", campos: ["receita_bruta"], tipo: "base" },
  { rot: "(-) Impostos", campos: ["impostos", "imposto"], tipo: "menos" },
  { rot: "(-) Taxas gateway", campos: ["taxas_gateway", "gateway"], tipo: "menos" },
  { rot: "(-) Descontos", campos: ["descontos", "desconto"], tipo: "menos" },
  { rot: "(-) Estornos", campos: ["estornos", "estorno"], tipo: "menos" },
  { rot: "= Receita líquida", campos: ["receita_liquida"], tipo: "total" },
  { rot: "(-) CMV", campos: ["cmv"], tipo: "menos", drill: ["cmv"] },
  { rot: "= Lucro bruto", campos: ["lucro_bruto"], tipo: "total", pct: ["margem_bruta_pct"] },
  { rot: "(-) Custos variáveis", campos: ["custos_variaveis"], tipo: "menos", drill: ["custos_variaveis"] },
  { rot: "= Margem de contribuição", campos: ["margem_contribuicao"], tipo: "total", pct: ["margem_contribuicao_pct"] },
  { rot: "(-) Despesas fixas", campos: ["despesas_fixas"], tipo: "menos", drill: ["despesas_fixas"] },
  { rot: "= Resultado operacional", campos: ["resultado_operacional"], tipo: "total", pct: ["margem_operacional_pct"] },
  { rot: "(-) Não operacional (juros, empréstimos, gastos pessoais)", campos: ["nao_operacional"], tipo: "menos", drill: ["nao_operacional"] },
  { rot: "(-) Pendente de classificação", campos: ["pendente_classificacao", "pendente", "pendentes"], tipo: "menos", drill: ["pendente", "sem_categoria"] },
  { rot: "= Resultado líquido", campos: ["resultado_liquido"], tipo: "total", pct: ["margem_liquida_pct"] },
];

function Drill({ mes, def, onClose }: { mes: string; def: Def | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["fin-lanc", mes, def?.drill],
    enabled: !!def,
    queryFn: async () => {
      const out: Linha[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await supabase
          .from("vw_fin_lancamentos" as never)
          .select("*")
          .eq("mes", mes)
          .in("linha_dre", def!.drill!)
          .range(de, de + 999);
        if (error) throw new Error(error.message);
        out.push(...((data ?? []) as Linha[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });
  const [aberto, setAberto] = useState<string | null>(null);
  const grupos = useMemo(() => {
    const m = new Map<string, Linha[]>();
    (q.data ?? []).forEach((l) => {
      const k = l.nome_categoria || "Sem categoria";
      m.set(k, [...(m.get(k) ?? []), l]);
    });
    return [...m.entries()]
      .map(([k, ls]) => ({ k, ls, total: ls.reduce((s, l) => s + n(l.valor), 0) }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [q.data]);

  return (
    <Sheet open={!!def} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>{def?.rot} · {rotuloMes(mes)}</SheetTitle></SheetHeader>
        {q.isLoading && <p className="py-6 text-muted-foreground">Carregando...</p>}
        {q.error && <p className="py-6 text-destructive">{(q.error as Error).message}</p>}
        <div className="mt-4 space-y-2">
          {grupos.map((g) => (
            <div key={g.k} className="rounded border border-border">
              <button className="flex w-full justify-between p-3 text-left text-sm font-medium" onClick={() => setAberto(aberto === g.k ? null : g.k)}>
                <span>{g.k} <span className="text-muted-foreground">({g.ls.length})</span></span>
                <span className="font-mono">{brl(g.total)}</span>
              </button>
              {aberto === g.k && (
                <Table>
                  <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Competência</TableHead><TableHead>Descrição</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {g.ls.map((l, i) => (
                      <TableRow key={l.id ?? i}>
                        <TableCell className="whitespace-nowrap text-xs">{dataBr(l.data)}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{dataBr(l.data_competencia)}</TableCell>
                        <TableCell className="text-xs">{l.descricao || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.origem || "-"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{brl(l.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ))}
          {!q.isLoading && grupos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lançamento.</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function DRE() {
  const q = useView("vw_fin_dre_mensal");
  const dre = useMemo(() => [...(q.data ?? [])].sort((a, b) => mesDe(a).localeCompare(mesDe(b))), [q.data]);
  const [drill, setDrill] = useState<{ mes: string; def: Def } | null>(null);

  if (q.isLoading) return <div className="py-20 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">DRE</h1>
        <p className="text-sm text-muted-foreground mt-1">Por competência. Clique em CMV, custos, despesas, não operacional ou pendente para ver os lançamentos.</p>
      </div>
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card min-w-[260px]">Linha</TableHead>
                {dre.map((l) => (
                  <TableHead key={mesDe(l)} className="text-right min-w-[130px] align-top">
                    <div className="font-semibold text-foreground">{rotuloMes(mesDe(l))}</div>
                    {l.cobertura && <div className="text-[10px] font-normal text-muted-foreground whitespace-normal">{l.cobertura}</div>}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {LINHAS.map((def) => (
                <TableRow key={def.rot} className={cn(def.tipo === "total" && "bg-muted/40 font-semibold", def.drill && "cursor-pointer hover:bg-muted/60")}>
                  <TableCell className={cn("sticky left-0 bg-card", def.tipo === "menos" && "pl-6 text-muted-foreground")}>{def.rot}</TableCell>
                  {dre.map((l) => {
                    const v = n(campo(l, ...def.campos));
                    const p = def.pct ? campo(l, ...def.pct) : undefined;
                    return (
                      <TableCell
                        key={mesDe(l)}
                        className={cn("text-right font-mono text-sm", def.tipo === "total" && v < 0 && "text-destructive")}
                        onClick={() => def.drill && setDrill({ mes: mesDe(l), def })}
                      >
                        {brl(def.tipo === "menos" ? -Math.abs(v) : v)}
                        {p != null && <div className="text-[11px] font-normal text-muted-foreground">{pctBr(p, 1)}</div>}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="sticky left-0 bg-card text-muted-foreground">Pedidos</TableCell>
                {dre.map((l) => <TableCell key={mesDe(l)} className="text-right text-sm">{n(l.pedidos).toLocaleString("pt-BR")}</TableCell>)}
              </TableRow>
              <TableRow>
                <TableCell className="sticky left-0 bg-card text-muted-foreground">Ticket médio</TableCell>
                {dre.map((l) => <TableCell key={mesDe(l)} className="text-right text-sm font-mono">{brl(l.ticket_medio_dre)}</TableCell>)}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Drill mes={drill?.mes ?? ""} def={drill?.def ?? null} onClose={() => setDrill(null)} />
    </div>
  );
}
