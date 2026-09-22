import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import {
  Clock, Flag, GitBranch, HelpCircle, MessageCircle, ShoppingBag, Sparkles, Tag, UserRound,
} from "lucide-react";
import {
  MAX_TITULO_BOTAO, ROTULO_TIPO, saidasDoNo, type ConfigNo, type MetricasNo, type TipoNo,
} from "@/lib/igDmFluxos";

const ICONES: Record<TipoNo, any> = {
  mensagem: MessageCircle,
  pergunta: HelpCircle,
  cartao: ShoppingBag,
  espera: Clock,
  condicao: GitBranch,
  tag: Tag,
  humano: UserRound,
  anna: Sparkles,
  fim: Flag,
};

function previa(tipo: TipoNo, config: ConfigNo): string {
  switch (tipo) {
    case "mensagem":
    case "pergunta":
    case "humano":
      return (config.texto ?? "").trim() || "-";
    case "cartao":
      return config.usar_pecas_da_live
        ? "Peças da live"
        : `${(config.produtos ?? []).length} peça(s) escolhida(s)`;
    case "espera": {
      const s = Number(config.segundos ?? 0);
      if (s >= 3600) return `Espera ${Math.round(s / 3600)} h`;
      if (s >= 60) return `Espera ${Math.round(s / 60)} min`;
      return `Espera ${s || 0} s`;
    }
    case "condicao":
      return `Se ${config.campo ?? "campo"} ${config.operador ?? "existe"} ${config.valor ?? ""}`.trim();
    case "tag":
      return config.tag ? `Tag ${config.tag}` : "-";
    case "anna":
      return "A Anna assume a conversa";
    case "fim":
      return "Encerra o fluxo";
    default:
      return "-";
  }
}

export type DadosNoDm = {
  tipo: TipoNo;
  rotulo: string;
  config: ConfigNo;
  inicial: boolean;
  erroInicio: boolean;
  metricas?: MetricasNo;
};

export function NoFluxoDm({ data, selected }: NodeProps) {
  const d = data as unknown as DadosNoDm;
  const Icone = ICONES[d.tipo] ?? MessageCircle;
  const saidas = saidasDoNo(d.tipo, d.config);
  const m = d.metricas ?? {};
  const ehEmail = d.tipo === "pergunta" && d.config.validacao === "email";
  const botoesLongos = (d.config.botoes ?? []).some(
    (b) => (b.titulo ?? "").length > MAX_TITULO_BOTAO,
  );

  return (
    <div
      className={cn(
        "w-64 rounded-xl border bg-card shadow-sm",
        selected ? "border-primary ring-1 ring-primary/40" : "border-border",
        d.erroInicio && "border-danger ring-1 ring-danger/40",
      )}
      style={{ minHeight: 96 + saidas.length * 22 }}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-muted-foreground" />

      <div className="flex items-start gap-2 border-b px-3 py-2">
        <Icone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{d.rotulo || ROTULO_TIPO[d.tipo]}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {ROTULO_TIPO[d.tipo]}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {d.inicial && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
              Início
            </span>
          )}
          {ehEmail && (
            <span className="rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[9px] font-semibold text-success">
              Identifica a cliente
            </span>
          )}
        </div>
      </div>

      <div className="px-3 py-2">
        <p className="line-clamp-1 text-xs text-muted-foreground">{previa(d.tipo, d.config)}</p>
        {d.erroInicio && (
          <p className="mt-1 text-[10px] font-semibold text-danger">
            O primeiro passo precisa ser uma Mensagem.
          </p>
        )}
        {botoesLongos && (
          <p className="mt-1 text-[10px] font-semibold text-danger">
            Botão com mais de {MAX_TITULO_BOTAO} caracteres.
          </p>
        )}
      </div>

      {saidas.length > 0 && (
        <div className="border-t">
          {saidas.map((s, i) => (
            <div
              key={s.chave}
              className="relative flex items-center justify-end px-3 py-1 text-[11px] text-muted-foreground"
            >
              <span className="truncate">{s.rotulo}</span>
              <Handle
                id={s.chave}
                type="source"
                position={Position.Right}
                style={{ top: 11 + i * 22 }}
                className="!h-2.5 !w-2.5 !bg-primary"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>{m.enviado ?? 0} enviados</span>
        <span>{m.clique ?? 0} cliques</span>
        <span>{m.resposta ?? 0} respostas</span>
      </div>
    </div>
  );
}
