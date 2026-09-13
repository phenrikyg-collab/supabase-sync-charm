import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type FilaAbandonada = {
  conversa_id?: string | number;
  nome?: string | null;
  telefone?: string | null;
  horas_sem_contato?: number | null;
};

export function AbandonadasTab() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["vw-fila-abandonada"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_fila_abandonada" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as FilaAbandonada[];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
        <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
        <p className="text-sm text-foreground">
          Estas conversas ficaram sem contato. Passou da janela de 24h — só um template aprovado
          reabre o atendimento.
        </p>
      </div>

      <Card className="divide-y divide-border overflow-hidden">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && data.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa abandonada.</p>
        )}
        {data.map((f, i) => (
          <div key={String(f.conversa_id ?? i)} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{f.nome?.trim() || "Desconhecida"}</p>
              {f.telefone && <p className="text-xs text-muted-foreground">{f.telefone}</p>}
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-danger/20 bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger whitespace-nowrap">
              <Clock className="h-3 w-3" />
              {Math.round(Number(f.horas_sem_contato ?? 0))}h sem contato
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
