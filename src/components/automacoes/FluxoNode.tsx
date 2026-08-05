import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { TIPOS_NO, resumoGatilho, resumoNo, type NoData } from "./tipos";

export function FluxoNode({ data, selected }: NodeProps) {
  const d = data as unknown as NoData;
  const meta = TIPOS_NO[d.tipo] ?? TIPOS_NO.fim;
  const Icone = meta.icon;
  const gatilho = d.tipo === "gatilho";
  const condicao = d.tipo === "condicao";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-3 py-2 shadow-sm min-w-[190px] max-w-[230px]",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
        gatilho && "border-warning/60 bg-warning/5",
      )}
    >
      {!gatilho && <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2 !h-2" />}

      <div className="flex items-center gap-2">
        <Icone className={cn("h-4 w-4 shrink-0", meta.cor)} />
        <span className="text-xs font-semibold truncate">{meta.label}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 break-words">
        {gatilho ? resumoGatilho(d.gatilhoTipo, d.gatilhoConfig) : resumoNo(d.tipo, d.config)}
      </p>

      {condicao ? (
        <>
          <Handle
            id="sim"
            type="source"
            position={Position.Right}
            style={{ top: "35%" }}
            className="!bg-success !w-2.5 !h-2.5"
          />
          <Handle
            id="nao"
            type="source"
            position={Position.Right}
            style={{ top: "72%" }}
            className="!bg-danger !w-2.5 !h-2.5"
          />
          <div className="absolute -right-8 top-[26%] text-[9px] text-success font-semibold">sim</div>
          <div className="absolute -right-8 top-[63%] text-[9px] text-danger font-semibold">não</div>
        </>
      ) : d.tipo !== "fim" ? (
        <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
      ) : null}
    </div>
  );
}

export const nodeTypes = { fluxo: FluxoNode };
