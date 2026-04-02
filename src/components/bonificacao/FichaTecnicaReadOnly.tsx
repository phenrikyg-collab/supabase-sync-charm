import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface Etapa {
  numero_etapa: number;
  operacao: string;
  tempo_minutos: number;
  observacao?: string | null;
}

interface Props {
  produtoNome: string;
  etapas: Etapa[];
}

const MAQUINA_ICONS: Record<string, string> = {
  Reta: "🧵",
  Overloque: "🔵",
  Galoneira: "🟡",
};

const MAQUINA_COLORS: Record<string, string> = {
  Reta: "bg-blue-100 text-blue-800 border-blue-300",
  Overloque: "bg-purple-100 text-purple-800 border-purple-300",
  Galoneira: "bg-green-100 text-green-800 border-green-300",
};

function parseOperacao(op: string): { maquina: string; nome: string } {
  if (op.includes("|")) {
    const [maquina, ...rest] = op.split("|");
    return { maquina, nome: rest.join("|") };
  }
  const maqMap: Record<string, string> = { reta: "Reta", overloque: "Overloque", galoneira: "Galoneira" };
  return { maquina: maqMap[op.toLowerCase()] || "Reta", nome: op };
}

export default function FichaTecnicaReadOnly({ produtoNome, etapas }: Props) {
  const sorted = useMemo(() =>
    [...etapas].sort((a, b) => (a.numero_etapa || 1) - (b.numero_etapa || 1)),
    [etapas]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, { etapas: { idx: number; nome: string; tempo: number; obs?: string | null }[]; total: number }> = {};
    sorted.forEach((e) => {
      const parsed = parseOperacao(e.operacao);
      if (!groups[parsed.maquina]) groups[parsed.maquina] = { etapas: [], total: 0 };
      groups[parsed.maquina].etapas.push({
        idx: e.numero_etapa,
        nome: parsed.nome,
        tempo: e.tempo_minutos,
        obs: e.observacao,
      });
      groups[parsed.maquina].total += e.tempo_minutos;
    });
    return groups;
  }, [sorted]);

  const totalGeral = sorted.reduce((s, e) => s + (e.tempo_minutos || 0), 0);
  const maquinaOrder = ["Overloque", "Reta", "Galoneira"];

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-foreground border-b border-border pb-2">
        FICHA TÉCNICA — {produtoNome}
      </div>

      {maquinaOrder.filter(m => grouped[m]).map((maquina) => {
        const g = grouped[maquina];
        return (
          <div key={maquina} className="space-y-1">
            <div className="flex items-center gap-2">
              <span>{MAQUINA_ICONS[maquina] || "⚙️"}</span>
              <Badge variant="outline" className={MAQUINA_COLORS[maquina] || ""}>
                {maquina}
              </Badge>
              <span className="text-xs text-muted-foreground">
                ({g.etapas.length} {g.etapas.length === 1 ? "etapa" : "etapas"} · {g.total} min)
              </span>
            </div>
            <div className="pl-6 space-y-0.5">
              {g.etapas.map((e) => (
                <div key={e.idx} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground font-mono w-5 text-right">{e.idx}.</span>
                  <span className="flex-1 text-foreground">{e.nome}</span>
                  <span className="text-muted-foreground tabular-nums">{e.tempo} min</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Máquinas não na ordem padrão */}
      {Object.keys(grouped).filter(m => !maquinaOrder.includes(m)).map((maquina) => {
        const g = grouped[maquina];
        return (
          <div key={maquina} className="space-y-1">
            <div className="flex items-center gap-2">
              <span>⚙️</span>
              <Badge variant="outline">{maquina}</Badge>
              <span className="text-xs text-muted-foreground">
                ({g.etapas.length} {g.etapas.length === 1 ? "etapa" : "etapas"} · {g.total} min)
              </span>
            </div>
            <div className="pl-6 space-y-0.5">
              {g.etapas.map((e) => (
                <div key={e.idx} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground font-mono w-5 text-right">{e.idx}.</span>
                  <span className="flex-1 text-foreground">{e.nome}</span>
                  <span className="text-muted-foreground tabular-nums">{e.tempo} min</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="border-t border-border pt-2 flex items-center gap-2 text-sm font-semibold">
        <span>⏱</span>
        <span>Total por peça: {totalGeral} min</span>
      </div>
    </div>
  );
}
