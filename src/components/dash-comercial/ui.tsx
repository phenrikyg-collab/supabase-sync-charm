import { ReactNode } from "react";
import { ArrowDown, ArrowUp, Info, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/dashComercial";

/** Intensidade proporcional ao impacto: variações pequenas quase não pesam. */
export function intensidade(pct: number): "forte" | "media" | "fraca" {
  const a = Math.abs(pct);
  if (a >= 15) return "forte";
  if (a >= 5) return "media";
  return "fraca";
}

export function corVariacao(delta: number, inverso = false) {
  const bom = inverso ? delta < 0 : delta > 0;
  if (Math.abs(delta) < 1e-9) return "text-muted-foreground";
  return bom ? "text-pos" : "text-neg";
}

export function Variacao({
  pct,
  inverso = false,
  sufixo = "",
  className,
}: {
  pct: number | null;
  inverso?: boolean;
  sufixo?: string;
  className?: string;
}) {
  if (pct === null || !Number.isFinite(pct)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const int = intensidade(pct);
  const Icon = pct > 0 ? ArrowUp : pct < 0 ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        corVariacao(pct, inverso),
        int === "forte" ? "text-sm font-bold" : int === "media" ? "text-xs font-semibold" : "text-xs font-normal opacity-70",
        className,
      )}
    >
      <Icon className={int === "forte" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {fmtPct(Math.abs(pct), 1)}{sufixo}
    </span>
  );
}

export function variacaoPct(atual: number, anterior: number): number | null {
  if (!Number.isFinite(anterior) || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

export function Sparkline({ dados, negativo }: { dados: { v: number }[]; negativo?: boolean }) {
  if (!dados.length) return <div className="h-10" />;
  const cor = negativo ? "hsl(var(--neg))" : "hsl(var(--pos))";
  return (
    <div className="h-10 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dados} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={`spark-${negativo ? "n" : "p"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone" dataKey="v" stroke={cor} strokeWidth={1.5} dot={false}
            fill={`url(#spark-${negativo ? "n" : "p"})`} isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeloAviso({ texto, tom = "warn" }: { texto: string; tom?: "warn" | "neg" | "muted" }) {
  const cls =
    tom === "neg" ? "border-neg/40 bg-neg/10 text-neg"
    : tom === "warn" ? "border-warn/40 bg-warn/10 text-warn"
    : "border-border bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", cls)}>
      {texto}
    </span>
  );
}

export function Ajuda({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={100}>
      <UITooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Detalhe da métrica">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{children}</TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

export function Tile({
  titulo,
  valor,
  sub,
  pct,
  inverso,
  spark,
  selo,
  ajuda,
  rodape,
  loading,
  className,
}: {
  titulo: string;
  valor: string;
  sub?: ReactNode;
  pct?: number | null;
  inverso?: boolean;
  spark?: { v: number }[];
  selo?: ReactNode;
  ajuda?: ReactNode;
  rodape?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  if (loading) return <SkeletonCard />;
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{titulo}</p>
          {ajuda && <Ajuda>{ajuda}</Ajuda>}
          {selo}
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="font-serif text-2xl font-bold leading-tight tabular-nums">{valor}</p>
          {pct !== undefined && <Variacao pct={pct ?? null} inverso={inverso} />}
        </div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        {spark && <Sparkline dados={spark} negativo={(pct ?? 0) < 0} />}
        {rodape}
      </CardContent>
    </Card>
  );
}

export function SkeletonCard({ h = "h-[122px]" }: { h?: string }) {
  return (
    <Card>
      <CardContent className={cn("p-4 space-y-3", h)}>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-full" />
      </CardContent>
    </Card>
  );
}

export function SkeletonBloco({ altura = 260 }: { altura?: number }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton style={{ height: altura }} className="w-full" />
      </CardContent>
    </Card>
  );
}

export const brl = fmtBRL;
export const numero = fmtNum;
export const pctBr = fmtPct;
