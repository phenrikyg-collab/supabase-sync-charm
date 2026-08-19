import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Grid3x3 } from "lucide-react";

type Row = Record<string, any>;

const num = (v: any) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const fmt = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v));
const TAMANHOS = ["P", "M", "G", "GG", "EG"];

type Situacao = "Ruptura" | "Critico" | "Encalhe" | "Ok";

function normSituacao(s: any): Situacao {
  const v = String(s ?? "").toLowerCase();
  if (v.startsWith("rupt")) return "Ruptura";
  if (v.startsWith("crit") || v.startsWith("crít")) return "Critico";
  if (v.startsWith("encalh")) return "Encalhe";
  return "Ok";
}

const CORES: Record<Situacao, string> = {
  Ruptura: "bg-red-500/20 text-red-700 border-red-500/30",
  Critico: "bg-orange-500/20 text-orange-700 border-orange-500/30",
  Encalhe: "bg-slate-400/25 text-slate-700 border-slate-400/40",
  Ok: "bg-green-500/15 text-green-700 border-green-500/25",
};

const LEGENDA: { s: Situacao; label: string }[] = [
  { s: "Ruptura", label: "Ruptura" },
  { s: "Critico", label: "Crítico" },
  { s: "Encalhe", label: "Encalhe" },
  { s: "Ok", label: "Ok" },
];

export default function CorTamanhoHeatmap() {
  const { toast } = useToast();

  const dados = useQuery({
    queryKey: ["vw_kpi_cor_tamanho"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_kpi_cor_tamanho" as any).select("*");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const msgErro = dados.isError ? (dados.error as Error)?.message ?? "Erro" : "";
  useEffect(() => {
    if (!msgErro) return;
    toast({ variant: "destructive", title: "Cor × Tamanho", description: msgErro });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgErro]);

  const linhas = useMemo(
    () =>
      (dados.data ?? []).map((r) => ({
        cor: String(r.cor ?? "—"),
        tamanho: String(r.tamanho ?? "").trim().toUpperCase(),
        vendas: num(r.vendas_90d),
        estoque: num(r.estoque),
        disp: num(r.variantes_disponiveis),
        totalVar: num(r.variantes_total),
        pctDisp: num(r.pct_disponivel),
        pctVendas: num(r.pct_das_vendas),
        situacao: normSituacao(r.situacao),
      })),
    [dados.data],
  );

  const cores = useMemo(() => {
    const mapa = new Map<string, number>();
    linhas.forEach((l) => mapa.set(l.cor, (mapa.get(l.cor) ?? 0) + l.vendas));
    return [...mapa.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([cor]) => cor);
  }, [linhas]);

  const celula = (cor: string, tam: string) =>
    linhas.find((l) => l.cor === cor && l.tamanho === tam);

  const criticas = useMemo(
    () =>
      linhas
        .filter((l) => l.situacao === "Ruptura" || l.situacao === "Critico")
        .sort((a, b) => b.vendas - a.vendas)
        .slice(0, 10),
    [linhas],
  );

  return (
    <Card className="rounded-xl p-5">
      <div className="mb-1 flex items-center gap-2">
        <Grid3x3 className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Cor × Tamanho</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Vendas dos últimos 90 dias e estoque atual por combinação.
      </p>

      {dados.isLoading ? (
        <Skeleton className="h-72 w-full rounded-lg" />
      ) : dados.isError ? (
        <p className="text-sm text-muted-foreground">Não foi possível carregar cor × tamanho.</p>
      ) : cores.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados de cor × tamanho.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-32 text-left text-xs font-medium text-muted-foreground">Cor</th>
                  {TAMANHOS.map((t) => (
                    <th key={t} className="text-center text-xs font-medium text-muted-foreground">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cores.map((cor) => (
                  <tr key={cor}>
                    <td className="max-w-[128px] truncate pr-2 text-sm font-medium">{cor}</td>
                    {TAMANHOS.map((t) => {
                      const c = celula(cor, t);
                      if (!c)
                        return (
                          <td key={t} className="rounded-md border border-dashed border-border p-2 text-center text-xs text-muted-foreground">
                            —
                          </td>
                        );
                      return (
                        <td
                          key={t}
                          title={`${c.cor} ${c.tamanho}\nVendas 90d: ${fmt(c.vendas)}\nEstoque: ${fmt(c.estoque)}\nVariantes disponíveis: ${fmt(c.disp)} de ${fmt(c.totalVar)}\n% disponível: ${c.pctDisp.toFixed(1)}%\n% das vendas: ${c.pctVendas.toFixed(1)}%\nSituação: ${c.situacao}`}
                          className={cn(
                            "cursor-default rounded-md border p-2 text-center leading-tight",
                            CORES[c.situacao],
                          )}
                        >
                          <div className="text-sm font-semibold">{fmt(c.vendas)}</div>
                          <div className="text-[11px] opacity-80">{fmt(c.estoque)} em estoque</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {LEGENDA.map((l) => (
              <span key={l.s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-3 w-3 rounded border", CORES[l.s])} />
                {l.label}
              </span>
            ))}
          </div>

          <div className="mt-5">
            <h4 className="mb-2 text-sm font-semibold">Combinações em ruptura ou crítico</h4>
            {criticas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma combinação crítica.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {criticas.map((c, i) => (
                  <li key={`${c.cor}-${c.tamanho}-${i}`}>
                    <span className="font-medium">
                      {c.cor} {c.tamanho}
                    </span>{" "}
                    — {fmt(c.vendas)} vendas, {fmt(c.estoque)} em estoque
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
