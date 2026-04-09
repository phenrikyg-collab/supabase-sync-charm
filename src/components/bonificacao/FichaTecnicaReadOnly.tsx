import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";

interface Etapa {
  numero_etapa: number;
  operacao: string;
  tempo_minutos: number;
  observacao?: string | null;
  nome_etapa?: string | null;
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

function parseOperacao(op: string): { maquina: string; nome: string; grupo: number } {
  const parts = op.split("|");
  if (parts.length >= 3) {
    return { maquina: parts[0], nome: parts.slice(1, -1).join("|"), grupo: parseInt(parts[parts.length - 1]) || 0 };
  }
  if (parts.length === 2) {
    return { maquina: parts[0], nome: parts[1], grupo: 0 };
  }
  const maqMap: Record<string, string> = { reta: "Reta", overloque: "Overloque", galoneira: "Galoneira" };
  return { maquina: maqMap[op.toLowerCase()] || "Reta", nome: op, grupo: 0 };
}

function calcTempoEfetivo(etapas: { tempo: number; grupo: number }[]): number {
  const grupos = new Map<number, number>();
  let totalSeq = 0;
  for (const e of etapas) {
    if (e.grupo === 0) {
      totalSeq += e.tempo;
    } else {
      const current = grupos.get(e.grupo) || 0;
      grupos.set(e.grupo, Math.max(current, e.tempo));
    }
  }
  let totalGrupos = 0;
  grupos.forEach((v) => { totalGrupos += v; });
  return totalSeq + totalGrupos;
}

export default function FichaTecnicaReadOnly({ produtoNome, etapas }: Props) {
  const sorted = useMemo(() =>
    [...etapas].sort((a, b) => (a.numero_etapa || 1) - (b.numero_etapa || 1)),
    [etapas]
  );

  const parsedAll = useMemo(() =>
    sorted.map((e) => {
      const hasNomeEtapa = e.nome_etapa && e.nome_etapa.trim();
      const p = parseOperacao(e.operacao);
      const tempoSeg = (e.tempo_minutos || 0) * 60;
      return {
        maquina: hasNomeEtapa ? "Reta" : p.maquina,
        nome: hasNomeEtapa ? e.nome_etapa! : p.nome,
        grupo: hasNomeEtapa ? 0 : p.grupo,
        tempo: Math.round(tempoSeg),
        obs: e.observacao,
        idx: e.numero_etapa,
      };
    }),
    [sorted]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, { etapas: typeof parsedAll; total: number }> = {};
    parsedAll.forEach((e) => {
      if (!groups[e.maquina]) groups[e.maquina] = { etapas: [], total: 0 };
      groups[e.maquina].etapas.push(e);
      groups[e.maquina].total += e.tempo;
    });
    return groups;
  }, [parsedAll]);

  const tempoEfetivo = useMemo(() => calcTempoEfetivo(parsedAll), [parsedAll]);
  const totalBruto = sorted.reduce((s, e) => s + (e.tempo_minutos || 0), 0);
  const hasConjuntos = parsedAll.some(e => e.grupo > 0);
  const maquinaOrder = ["Overloque", "Reta", "Galoneira"];
  const allMaquinas = [...maquinaOrder.filter(m => grouped[m]), ...Object.keys(grouped).filter(m => !maquinaOrder.includes(m))];

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-foreground border-b border-border pb-2">
        FICHA TÉCNICA — {produtoNome}
      </div>

      {allMaquinas.map((maquina) => {
        const g = grouped[maquina];
        return (
          <div key={maquina} className="space-y-1">
            <div className="flex items-center gap-2">
              <span>{MAQUINA_ICONS[maquina] || "⚙️"}</span>
              <Badge variant="outline" className={MAQUINA_COLORS[maquina] || ""}>
                {maquina}
              </Badge>
              <span className="text-xs text-muted-foreground">
                ({g.etapas.length} {g.etapas.length === 1 ? "etapa" : "etapas"} · {g.total} seg)
              </span>
            </div>
            <div className="pl-6 space-y-0.5">
              {g.etapas.map((e) => (
                <div key={e.idx} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground font-mono w-5 text-right">{e.idx}.</span>
                  <span className="flex-1 text-foreground">{e.nome}</span>
                  <span className="text-muted-foreground tabular-nums">{e.tempo} seg</span>
                  {e.grupo > 0 && (
                    <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-300">
                      <Link2 className="h-3 w-3 mr-0.5" /> Conjunto {e.grupo}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="border-t border-border pt-2 space-y-1">
        {hasConjuntos && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>📊</span>
            <span>Tempo bruto (soma): {totalBruto} seg</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span>⏱</span>
          <span>Tempo efetivo por peça: {tempoEfetivo} seg</span>
          {hasConjuntos && (
            <span className="text-xs text-muted-foreground font-normal">(conjuntos = maior tempo)</span>
          )}
        </div>
      </div>
    </div>
  );
}
