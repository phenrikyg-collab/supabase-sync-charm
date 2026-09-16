import { Fragment, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ddmm, dec, isNil, n, valorPorUnidadeKpi } from "@/lib/registroAcoes";

export type KpiMeta = {
  codigo: string;
  nome: string;
  unidade?: string;
  sentido?: number;
  grupo?: string;
  ordem?: number;
};

type Props = {
  dados: any;
  isLoading: boolean;
  error: unknown;
  semanas: number;
  onSemanas: (v: number) => void;
  onSelecionarKpi: (codigo: string) => void;
  kpiSelecionado?: string;
  onAbrirAcao: (a: any) => void;
};

const COR_DIRECAO: Record<string, string> = {
  melhora: "text-emerald-600",
  piora: "text-red-600",
  estavel: "text-muted-foreground",
  insumo: "text-muted-foreground",
};

function Sparkline({ valores }: { valores: (number | null)[] }) {
  const limpos = valores.filter((v) => v !== null) as number[];
  if (limpos.length < 2) return null;
  const min = Math.min(...limpos);
  const max = Math.max(...limpos);
  const larg = 64;
  const alt = 16;
  const passo = valores.length > 1 ? larg / (valores.length - 1) : larg;
  const y = (v: number) => (max === min ? alt / 2 : alt - ((v - min) / (max - min)) * alt);
  let d = "";
  valores.forEach((v, i) => {
    if (v === null) return;
    d += `${d ? "L" : "M"}${(i * passo).toFixed(1)},${y(v).toFixed(1)} `;
  });
  return (
    <svg width={larg} height={alt} className="mt-0.5 overflow-visible">
      <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} />
    </svg>
  );
}

export default function TabelaKpis({
  dados, isLoading, error, semanas, onSemanas, onSelecionarKpi, kpiSelecionado, onAbrirAcao,
}: Props) {
  const kpis: KpiMeta[] = dados?.kpis ?? [];
  const linhasSemanas: any[] = useMemo(
    () => [...(dados?.semanas ?? [])].sort((a, b) => String(a.semana_inicio).localeCompare(String(b.semana_inicio))),
    [dados],
  );

  const grupos = useMemo(() => {
    const ordemGrupo = ["Resultado", "Tráfego", "Investimento"];
    const mapa = new Map<string, KpiMeta[]>();
    [...kpis]
      .sort((a, b) => n(a.ordem) - n(b.ordem))
      .forEach((k) => {
        const g = k.grupo ?? "Outros";
        if (!mapa.has(g)) mapa.set(g, []);
        mapa.get(g)!.push(k);
      });
    const idx = (g: string) => {
      const i = ordemGrupo.indexOf(g);
      return i < 0 ? 99 : i;
    };
    return [...mapa.entries()].sort((a, b) => idx(a[0]) - idx(b[0]));
  }, [kpis]);

  const seletor = (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Semanas</span>
      <Select value={String(semanas)} onValueChange={(v) => onSemanas(Number(v))}>
        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
        <SelectContent>
          {[8, 12, 16].map((v) => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (error) {
    return (
      <Card className="p-6 text-sm text-destructive">
        Não deu para carregar os KPIs: {(error as Error).message}
      </Card>
    );
  }
  if (!linhasSemanas.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
        Ainda não há semanas de KPIs para mostrar.
      </Card>
    );
  }

  const regra = dados?.regra
    || "Variação contra a semana anterior. Verde e vermelho só a partir de 5%, respeitando se o KPI é melhor para cima ou para baixo. Semana em curso não é comparada.";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">KPIs semana a semana</p>
        {seletor}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background text-left p-2 min-w-[180px] border-b">KPI</th>
              {linhasSemanas.map((s) => (
                <th
                  key={s.semana_inicio}
                  className={`p-2 text-right whitespace-nowrap border-b font-medium ${s.parcial ? "bg-muted/40" : ""}`}
                >
                  <div>{ddmm(s.semana_inicio)} a {ddmm(s.semana_fim)}</div>
                  {s.parcial && <div className="text-[10px] text-muted-foreground font-normal">em curso</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="sticky left-0 z-10 bg-background p-2 border-b text-muted-foreground">
                Ações comerciais
              </td>
              {linhasSemanas.map((s) => {
                const lista = s.acoes_comerciais ?? [];
                return (
                  <td key={s.semana_inicio} className={`p-2 text-center border-b ${s.parcial ? "bg-muted/40" : ""}`}>
                    {lista.length > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="h-2.5 w-2.5 rounded-full bg-primary inline-block"
                              onClick={() => onAbrirAcao(lista[0])}
                              aria-label="Ações da semana"
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-0.5">
                              {lista.map((a: any) => (
                                <div key={a.id} className="text-[11px]">{a.titulo}</div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </td>
                );
              })}
            </tr>

            {grupos.map(([grupo, lista]) => (
              <Fragment key={grupo}>
                <tr>
                  <td
                    className="sticky left-0 z-10 bg-muted/60 p-1.5 font-medium"
                    colSpan={1}
                  >
                    {grupo}
                  </td>
                  <td className="bg-muted/60" colSpan={linhasSemanas.length} />
                </tr>
                {lista.map((k) => {
                  const serie = linhasSemanas.map((s) => {
                    const v = s.valores?.[k.codigo]?.valor;
                    return isNil(v) ? null : n(v);
                  });
                  return (
                    <tr key={k.codigo} className={kpiSelecionado === k.codigo ? "bg-accent/40" : ""}>
                      <td className="sticky left-0 z-10 bg-background p-2 border-b align-top">
                        <button
                          type="button"
                          className="text-left hover:underline font-medium"
                          onClick={() => onSelecionarKpi(k.codigo)}
                        >
                          {k.nome}
                        </button>
                        <Sparkline valores={serie} />
                      </td>
                      {linhasSemanas.map((s) => {
                        const cel = s.valores?.[k.codigo] ?? {};
                        const cor = cel.direcao ? COR_DIRECAO[String(cel.direcao)] ?? "" : "";
                        const sobe = n(cel.wow_pct) >= 0;
                        const Icone = sobe ? ArrowUp : ArrowDown;
                        return (
                          <td
                            key={s.semana_inicio}
                            className={`p-2 text-right border-b whitespace-nowrap ${s.parcial ? "bg-muted/40" : ""}`}
                          >
                            <div>{valorPorUnidadeKpi(cel.valor, k.unidade)}</div>
                            {!isNil(cel.wow_pct) && cel.direcao && (
                              <div className={`text-[10px] inline-flex items-center gap-0.5 ${cor}`}>
                                <Icone className="h-2.5 w-2.5" />
                                {dec(Math.abs(n(cel.wow_pct)), 2)}%
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">{regra}</p>
    </Card>
  );
}
