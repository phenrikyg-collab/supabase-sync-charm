import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type ConversaAtencao = {
  conversa_id: string | number;
  score?: number | null;
  nivel?: string | null;
  motivos?: string[] | null;
  min_desde_cliente?: number | null;
  dono?: "humana" | "automacao" | "bot" | string | null;
  automacao?: "avaliacao" | "cashback" | string | null;
  fluxo_avaliacao?: boolean | null;
  ultima_entrada?: string | null;
  ultima_saida?: string | null;
};

/** Rótulo discreto da régua em andamento, para o selo do header do chat. */
export function rotuloAutomacao(a?: ConversaAtencao | null): string | null {
  if (!a || a.dono !== "automacao") return null;
  if (a.automacao === "avaliacao") return "Régua de avaliação em andamento";
  if (a.automacao === "cashback") return "Cashback automático em andamento";
  return "Automação em andamento";
}

/** Lê vw_conversas_atencao e devolve um mapa por conversa_id. */
export function useConversasAtencao() {
  const { data = [] } = useQuery({
    queryKey: ["vw-conversas-atencao"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_conversas_atencao" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as ConversaAtencao[];
    },
  });

  const mapa = new Map<string, ConversaAtencao>();
  for (const a of data) mapa.set(String(a.conversa_id), a);
  return { atencoes: data, mapaAtencao: mapa };
}

export function classeBordaNivel(nivel?: string | null) {
  const n = (nivel ?? "").toLowerCase();
  if (n === "quente") return "border-l-danger";
  if (n === "atencao") return "border-l-warning";
  return null;
}

export function ChipMotivo({ motivo }: { motivo: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground whitespace-nowrap">
      {motivo}
    </span>
  );
}

export function ChipsMotivos({ motivos, className }: { motivos?: string[] | null; className?: string }) {
  if (!motivos || motivos.length === 0) return null;
  return (
    <div className={cn("mt-1 flex flex-wrap items-center gap-1", className)}>
      {motivos.map((m, i) => (
        <ChipMotivo key={`${m}-${i}`} motivo={m} />
      ))}
    </div>
  );
}

/** Selo com a posição da conversa na fila de atendimento. */
export function SeloFila({ conversaId }: { conversaId: string | number }) {
  const { data: posicao } = useQuery({
    queryKey: ["fila-posicao", String(conversaId)],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fila_posicao" as any, {
        conversa_id: Number.isNaN(Number(conversaId)) ? conversaId : Number(conversaId),
      });
      if (error) throw error;
      const valor = Array.isArray(data) ? (data[0] as any)?.fila_posicao ?? data[0] : data;
      return typeof valor === "number" ? valor : Number(valor);
    },
  });

  if (!posicao || Number.isNaN(posicao)) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning whitespace-nowrap">
      {posicao}º na fila
    </span>
  );
}
