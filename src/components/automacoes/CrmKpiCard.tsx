import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CrmKpiCard({
  titulo,
  valor,
  detalhe,
  icon: Icon,
  className,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-muted-foreground">{titulo}</p>
          <p className="mt-2 font-serif text-2xl font-semibold">{valor}</p>
          {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
        </div>
        {Icon && <Icon className="h-5 w-5 shrink-0 text-primary" />}
      </div>
    </Card>
  );
}

export function classeRoas(valor?: number | null, custo?: number | null) {
  if (valor == null || Number(custo ?? 0) === 0) return "text-muted-foreground";
  if (valor < 1) return "text-danger";
  if (valor <= 3) return "text-warning";
  return "text-success";
}