import { ArrowDown, ArrowUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Var = { tipo?: string; delta?: number | null; delta_pct?: number | null; anterior?: number | null } | null | undefined;

/**
 * Mostra a variação de uma métrica seguindo o campo `tipo` devolvido pelo banco.
 * pp = pontos percentuais, pct = variação percentual, sem_base = traço cinza.
 */
export function Variacao({ v, inverter = false, className }: { v: Var; inverter?: boolean; className?: string }) {
  const tipo = v?.tipo;
  if (!v || !tipo || tipo === "sem_base") {
    return <p className={cn("text-xs text-muted-foreground", className)}>&mdash;</p>;
  }

  const bruto = tipo === "pp" ? v.delta : v.delta_pct;
  if (bruto == null) return <p className={cn("text-xs text-muted-foreground", className)}>&mdash;</p>;

  const sobe = bruto > 0;
  const neutro = bruto === 0;
  const bom = inverter ? !sobe : sobe;
  const cor = neutro ? "text-muted-foreground" : bom ? "text-success" : "text-danger";
  const Seta = sobe ? ArrowUp : ArrowDown;
  const fmt = Math.abs(bruto).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const unidade = tipo === "pp" ? "p.p." : "%";

  return (
    <p className={cn("flex items-center gap-1 text-xs", cor, className)}>
      {!neutro && <Seta className="h-3 w-3" />}
      <span>
        {sobe ? "+" : neutro ? "" : "-"}
        {fmt} {unidade} vs. período anterior
      </span>
    </p>
  );
}

export function AjudaInfo({ texto }: { texto: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="Mais informações" className="text-muted-foreground hover:text-foreground">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{texto}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
