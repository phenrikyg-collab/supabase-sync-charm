import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PrecoMinimoRow } from "@/hooks/usePrecoMinimo";
import { AlertTriangle } from "lucide-react";

function brl(v: number | null | undefined) {
  return v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function margemColor(pct: number | null | undefined): string {
  const n = Number(pct ?? 0);
  if (n > 50) return "bg-green-100 text-green-800 border-green-300";
  if (n >= 30) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-red-100 text-red-800 border-red-300";
}

export function PrecoMinimoInfo({ row, compact = false }: { row?: PrecoMinimoRow; compact?: boolean }) {
  if (!row) return null;
  const abaixo = row.status_preco === "abaixo_minimo";
  return (
    <TooltipProvider>
      <div className={compact ? "flex flex-wrap items-center gap-1 text-xs" : "flex flex-wrap items-center gap-2 text-sm"}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-muted text-muted-foreground cursor-help">
              Min: {brl(row.preco_minimo_viavel)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Custo + encargos</TooltipContent>
        </Tooltip>
        {row.margem_atual_pct != null && (
          <Badge variant="outline" className={margemColor(row.margem_atual_pct)}>
            MC {Number(row.margem_atual_pct).toFixed(0)}%
          </Badge>
        )}
        {abaixo && (
          <Badge className="bg-red-600 text-white border-0 gap-1">
            <AlertTriangle className="h-3 w-3" /> Abaixo do mínimo
          </Badge>
        )}
      </div>
    </TooltipProvider>
  );
}
