import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TIPOS_NO, resumoNo, type NoData } from "./tipos";
import { MOTIVOS_PULO, moedaBRL } from "./api";
import { PreviaWhatsappJanela } from "./WhatsappJanelaEditor";

const pct = (parte: number, total: number) =>
  total > 0 ? `${((parte / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "";

function LinhaMetrica({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] text-muted-foreground">{children}</span>;
}

export function FluxoNode({ data, selected }: NodeProps) {
  const d = data as unknown as NoData;
  const meta = TIPOS_NO[d.tipo] ?? TIPOS_NO.fim;
  const Icone = meta.icon;
  const gatilho = d.tipo === "gatilho";
  const condicao = d.tipo === "condicao";
  const aguardando = d.tipo === "aguardar_botao";
  const m = d.metricas ?? null;
  const botoes = aguardando ? d.botoesEntrada ?? [] : [];
  const contagemBotoes: Record<string, number> = m?.botoes ?? {};
  const saidas = aguardando
    ? [
        ...botoes.map((b) => ({ id: b, rotulo: b, cor: "!bg-success", texto: "text-success", contagem: Number(contagemBotoes[b] ?? 0) })),
        { id: "sem resposta", rotulo: "sem resposta", cor: "!bg-muted-foreground", texto: "text-muted-foreground", contagem: Number(m?.sem_resposta ?? 0) },
        ...(d.config?.se_digitar === "caminho"
          ? [{ id: "respondeu", rotulo: "escreveu", cor: "!bg-info", texto: "text-info", contagem: Number(m?.escreveu_sem_botao ?? 0) }]
          : []),
      ]
    : [];

  const motivos: Record<string, number> = m?.motivos_pulo ?? {};

  // saídas laterais (uma por botão): ficam à direita, empilhadas dentro do card
  const saidasLaterais = saidas.filter((s) => s.id !== "sem resposta");
  const topoSaida = (i: number) => 58 + i * 34;
  const alturaMinima = saidasLaterais.length > 0 ? topoSaida(saidasLaterais.length - 1) + 18 : undefined;

  return (
    <div
      className={cn(
        "min-w-[210px] rounded-lg border bg-card px-3 py-2 shadow-sm",
        botoes.length >= 3 ? "max-w-[320px]" : "max-w-[250px]",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
        gatilho && "border-warning/60 bg-warning/5",
        d.comErro && "border-danger ring-2 ring-danger/30",
      )}
      style={alturaMinima ? { minHeight: `${alturaMinima}px` } : undefined}
    >
      {!gatilho && <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-muted-foreground" />}

      <div className="flex items-center gap-2">
        <Icone className={cn("h-4 w-4 shrink-0", meta.cor)} />
        <span className="truncate text-xs font-semibold">{d.rotulo || meta.label}</span>
      </div>
      {d.tipo === "whatsapp_janela" ? (
        <div className="mt-2"><PreviaWhatsappJanela config={d.config ?? {}} compacta /></div>
      ) : (
        <p className="mt-1 line-clamp-2 break-words text-[11px] text-muted-foreground">
          {gatilho ? d.gatilhoRotulo || "Gatilho do fluxo" : resumoNo(d.tipo, d.config ?? {}, d.catalogo)}
        </p>
      )}

      {m && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-1.5">
          <LinhaMetrica>{Number(m.entraram ?? 0)} entraram</LinhaMetrica>
          {Number(m.parados_agora ?? 0) > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[9px]">
              {m.parados_agora} aqui agora
            </Badge>
          )}
          {d.tipo === "enviar_email" && (
            <>
              <LinhaMetrica>{Number(m.enviados ?? 0)} enviados</LinhaMetrica>
              <LinhaMetrica>
                {Number(m.abertos ?? 0)} abertos {pct(Number(m.abertos ?? 0), Number(m.enviados ?? 0))}
              </LinhaMetrica>
              <LinhaMetrica>{Number(m.cliques ?? 0)} cliques</LinhaMetrica>
              {m.receita != null && <LinhaMetrica>{moedaBRL(m.receita)}</LinhaMetrica>}
            </>
          )}
          {(d.tipo === "whatsapp_template" || d.tipo === "whatsapp_janela") && (
            <>
              <LinhaMetrica>{Number(m.enviados ?? 0)} enviados</LinhaMetrica>
              <LinhaMetrica>{Number(m.entregues ?? 0)} entregues</LinhaMetrica>
              <LinhaMetrica>{Number(m.lidos ?? 0)} lidos</LinhaMetrica>
              {Number(m.como_texto ?? 0) > 0 && (
                <LinhaMetrica>{m.como_texto} como texto livre</LinhaMetrica>
              )}
              {m.receita != null && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[10px] text-muted-foreground underline decoration-dotted">
                        {moedaBRL(m.receita)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>influenciada: pedido em até 3 dias</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
          {aguardando && (
            <>
              <LinhaMetrica>{Number(m.parados_agora ?? 0)} esperando</LinhaMetrica>
              {(Number(m.escreveu_sem_botao ?? 0) > 0 || Number(m.botao_por_texto ?? 0) > 0) && (
                <LinhaMetrica>
                  {Number(m.escreveu_sem_botao ?? 0)} escreveram · {Number(m.botao_por_texto ?? 0)} entendidos pelo texto
                </LinhaMetrica>
              )}
            </>
          )}
          {(d.tipo === "condicao" || d.tipo === "filtro") && (
            <>
              <LinhaMetrica>sim {Number(m.sim ?? 0)}</LinhaMetrica>
              <LinhaMetrica>não {Number(m.nao ?? 0)}</LinhaMetrica>
            </>
          )}
          {Number(m.pulados ?? 0) > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="h-4 border-warning/40 bg-warning/10 px-1 text-[9px] text-warning" variant="outline">
                    {m.pulados} pulados
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <ul className="space-y-0.5 text-xs">
                    {Object.entries(motivos).map(([k, v]) => (
                      <li key={k}>
                        {v} {MOTIVOS_PULO[k] ?? k}
                      </li>
                    ))}
                    {Object.keys(motivos).length === 0 && <li>sem detalhe do motivo</li>}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {Number(m.erros ?? 0) > 0 && (
            <Badge variant="outline" className="h-4 border-danger/40 bg-danger/10 px-1 text-[9px] text-danger">
              {m.erros} erros
            </Badge>
          )}
        </div>
      )}

      {condicao ? (
        <>
          <Handle
            id="sim"
            type="source"
            position={Position.Bottom}
            style={{ left: "28%" }}
            className="!h-2.5 !w-2.5 !bg-success"
          />
          <Handle
            id="nao"
            type="source"
            position={Position.Bottom}
            style={{ left: "72%" }}
            className="!h-2.5 !w-2.5 !bg-danger"
          />
          <div className="absolute -bottom-4 left-[20%] text-[9px] font-semibold text-success">sim</div>
          <div className="absolute -bottom-4 left-[66%] text-[9px] font-semibold text-danger">não</div>
        </>
      ) : aguardando ? (
        <>
          {!d.temTemplateAntes && (
            <p className="mt-1 text-[10px] text-warning">ligue a um template com botões</p>
          )}
          {saidas.map((s) => {
            const ehSemResposta = s.id === "sem resposta";
            const top = `${topoSaida(saidasLaterais.findIndex((x) => x.id === s.id))}px`;
            return (
              <div key={s.id}>
                <Handle
                  id={s.id}
                  type="source"
                  position={ehSemResposta ? Position.Bottom : Position.Right}
                  style={ehSemResposta ? { left: "50%" } : { top }}
                  className={cn("!h-2.5 !w-2.5", s.cor)}
                />
                <div
                  title={s.rotulo}
                  className={cn(
                    "absolute whitespace-nowrap text-[9px] font-semibold",
                    ehSemResposta ? "-bottom-4 left-1/2 -translate-x-1/2" : "-right-2 translate-x-full -translate-y-1/2",
                    s.texto,
                  )}
                  style={ehSemResposta ? undefined : { top }}
                >
                  {s.rotulo.length > 14 ? `${s.rotulo.slice(0, 14)}…` : s.rotulo}
                  {s.contagem > 0 ? ` ${s.contagem}` : ""}
                </div>
              </div>
            );
          })}
        </>
      ) : d.tipo !== "fim" ? (
        <Handle type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !bg-primary" />
      ) : null}
    </div>
  );
}

export const nodeTypes = { fluxo: FluxoNode };
