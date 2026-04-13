import { useState } from "react";
import { formatarSegundos, formatarData } from "@/utils/producao";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Etapa {
  id: string;
  tipo_maquina: string;
  numero_etapa: number;
  nome_etapa: string;
  tempo_segundos_por_peca: number;
  pecas_planejadas: number;
  segundos_utilizados: number;
  capacidade_segundos_dia: number;
}

interface Props {
  plano: {
    id: string;
    data_planejada: string;
    pecas_planejadas: number;
    segundos_utilizados: number;
    status: string;
    horas_disponiveis: number;
  };
  etapas: Etapa[];
}

const statusConfig: Record<string, { label: string; variant: "secondary" | "default" | "outline" }> = {
  planejado: { label: "Planejado", variant: "secondary" },
  "em andamento": { label: "Em andamento", variant: "default" },
  concluido: { label: "Concluído", variant: "outline" },
};

export default function PlanoProducaoCard({ plano, etapas }: Props) {
  const [expanded, setExpanded] = useState(false);
  const st = statusConfig[plano.status] || statusConfig.planejado;

  // Tempo total por peça = soma dos tempos de cada etapa
  const tempoTotalPorPeca = etapas.reduce((a, e) => a + e.tempo_segundos_por_peca, 0);

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-medium text-sm">{formatarData(plano.data_planejada)}</span>
          <span className="text-sm text-muted-foreground">{plano.pecas_planejadas} peças</span>
          <span className="text-sm text-muted-foreground">
            Tempo/peça: {formatarSegundos(tempoTotalPorPeca)}
          </span>
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </div>

      {expanded && (
        <CardContent className="pt-0 space-y-3">
          {etapas.map((e) => {
            const ocupacao = e.capacidade_segundos_dia > 0
              ? (e.segundos_utilizados / e.capacidade_segundos_dia) * 100
              : 0;
            const corBarra = ocupacao <= 80 ? "bg-green-500" : ocupacao <= 95 ? "bg-yellow-500" : "bg-red-500";

            return (
              <div key={e.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    Etapa {e.numero_etapa} — {e.nome_etapa} | {e.tipo_maquina}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>Tempo/peça: {formatarSegundos(e.tempo_segundos_por_peca)}</span>
                  <span>Peças: {e.pecas_planejadas}</span>
                  <span>Utilizado: {formatarSegundos(e.segundos_utilizados)}</span>
                  <span>Capacidade: {formatarSegundos(e.capacidade_segundos_dia)}</span>
                  <span>Ocupação: {ocupacao.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", corBarra)}
                    style={{ width: `${Math.min(ocupacao, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
