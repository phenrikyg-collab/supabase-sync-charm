import { cn } from "@/lib/utils";
import { corNota } from "@/lib/popups";

export function NotaCirculo({
  nota,
  tamanho = "md",
  onClick,
  titulo,
}: {
  nota: number | null | undefined;
  tamanho?: "sm" | "md";
  onClick?: () => void;
  titulo?: string;
}) {
  const valor = Number.isFinite(Number(nota)) ? Math.round(Number(nota)) : null;
  if (valor === null) return <span className="text-xs text-muted-foreground">sem dados</span>;
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      title={titulo ?? "Nota de boas práticas"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-semibold",
        tamanho === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
        corNota(valor),
        onClick && "transition hover:opacity-80"
      )}
    >
      {valor}
    </Tag>
  );
}
