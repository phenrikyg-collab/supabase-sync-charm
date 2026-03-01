import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusMap: Record<string, { label: string; className: string }> = {
  baixo: { label: "Baixo", className: "bg-success/10 text-success border-success/20" },
  moderado: { label: "Moderado", className: "bg-warning/10 text-warning border-warning/20" },
  alto: { label: "Alto", className: "bg-danger/10 text-danger border-danger/20" },
  planejada: { label: "Planejada", className: "bg-muted text-muted-foreground border-border" },
  "em corte": { label: "Em Corte", className: "bg-primary/10 text-primary border-primary/20" },
  finalizada: { label: "Finalizada", className: "bg-success/10 text-success border-success/20" },
  corte: { label: "Corte", className: "bg-primary/10 text-primary border-primary/20" },
  costura: { label: "Costura", className: "bg-warning/10 text-warning border-warning/20" },
  revisao: { label: "Revisão", className: "bg-accent text-accent-foreground border-border" },
  revisão: { label: "Revisão", className: "bg-accent text-accent-foreground border-border" },
  finalizado: { label: "Finalizado", className: "bg-success/10 text-success border-success/20" },
  "no prazo": { label: "No Prazo", className: "bg-success/10 text-success border-success/20" },
  "em alerta": { label: "Em Alerta", className: "bg-warning/10 text-warning border-warning/20" },
  critico: { label: "Crítico", className: "bg-danger/10 text-danger border-danger/20" },
  crítico: { label: "Crítico", className: "bg-danger/10 text-danger border-danger/20" },
  "em conserto": { label: "Em Conserto", className: "bg-danger/10 text-danger border-danger/20" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status?.toLowerCase() ?? "";
  const config = statusMap[key] ?? { label: status, className: "bg-muted text-muted-foreground border-border" };

  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}
