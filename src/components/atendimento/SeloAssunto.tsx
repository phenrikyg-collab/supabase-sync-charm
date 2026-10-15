import { cn } from "@/lib/utils";

/** Selo de assunto da conversa (coluna assunto de vw_conversas_painel_com_tags). */
export function SeloAssunto({
  assunto,
  motivo,
  className,
}: {
  assunto?: "venda" | "sac" | "indefinido" | string | null;
  motivo?: string | null;
  className?: string;
}) {
  const a = (assunto ?? "").toLowerCase();
  if (a !== "venda" && a !== "sac") return null;
  const venda = a === "venda";
  return (
    <span
      title={motivo || undefined}
      className={cn(
        "inline-flex shrink-0 cursor-help items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap",
        venda
          ? "border-emerald-600/30 bg-emerald-100 text-emerald-900"
          : "border-slate-400/40 bg-slate-200/70 text-slate-700",
        className,
      )}
    >
      {venda ? "🛍️ Venda" : "🎧 SAC"}
    </span>
  );
}
