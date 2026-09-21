import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ETAPAS_FUNIL_WHATSAPP } from "@/lib/funilWhatsAppEtapas";
import { Loader2, RefreshCw, Zap } from "lucide-react";

const COLUNAS = ETAPAS_FUNIL_WHATSAPP;

type CardTag = {
  conversa_id: string | number;
  etapa: string | null;
  etapa_origem: "auto" | "manual" | "inferida" | string | null;
  nome: string | null;
  telefone: string | null;
  ultima_mensagem_texto: string | null;
  temperatura: "quente" | "morno" | "frio" | string | null;
  sac: boolean | null;
  aguardando_resposta: boolean | null;
  pix_aberto_valor: number | null;
};

type FiltroOrigem = "todas" | "auto" | "manual";

const brl = (v?: number | null) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CORE_TEMPERATURA: Record<string, string> = {
  quente: "bg-danger",
  morno: "bg-warning",
  frio: "bg-muted-foreground/40",
};

export function FunilKanbanConteudo({
  onAbrirConversa,
}: {
  onAbrirConversa?: (conversaId: string) => void;
} = {}) {
  return <FunilKanban semCabecalho onAbrirConversa={onAbrirConversa} />;
}

export default function FunilKanban({
  semCabecalho,
  onAbrirConversa,
}: {
  semCabecalho?: boolean;
  onAbrirConversa?: (conversaId: string) => void;
} = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cards, setCards] = useState<CardTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [filtroOrigem, setFiltroOrigem] = useState<FiltroOrigem>("todas");

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data, error } = await (supabase as any).rpc("whatsapp_kanban_tags", { p_dias: 30 });
    if (error) {
      if (!silencioso) toast.error("Erro ao carregar o funil: " + error.message);
    } else {
      setCards((Array.isArray(data) ? data : []) as CardTag[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const t = setInterval(() => carregar(true), 60000);
    return () => clearInterval(t);
  }, [carregar]);

  const abrir = (id: string | number) => {
    if (onAbrirConversa) onAbrirConversa(String(id));
    else navigate(`/atendimento?conversa=${id}`);
  };

  const mover = useCallback(
    async (card: CardTag, etapa: string) => {
      if ((card.etapa ?? "") === etapa) return;
      const anterior = cards;
      setCards((prev) =>
        prev.map((c) => (String(c.conversa_id) === String(card.conversa_id) ? { ...c, etapa } : c)),
      );
      const { error } = await (supabase as any).rpc("whatsapp_mover_etapa_tag", {
        p_conversa_id: card.conversa_id,
        p_etapa: etapa,
        p_origem: "manual",
        p_por: user?.email ?? null,
      });
      if (error) {
        setCards(anterior);
        toast.error("Não foi possível mover: " + error.message);
      } else {
        carregar(true);
      }
    },
    [cards, carregar, user?.email],
  );

  const totais = useMemo(() => {
    const quentes = cards.filter((c) => (c.temperatura ?? "") === "quente").length;
    const esperando = cards.filter((c) => c.aguardando_resposta).length;
    return { quentes, esperando };
  }, [cards]);

  const visiveis = useMemo(() => {
    if (filtroOrigem === "todas") return cards;
    return cards.filter((c) => c.etapa_origem === filtroOrigem);
  }, [cards, filtroOrigem]);

  const SeloOrigem = ({ origem }: { origem: CardTag["etapa_origem"] }) => {
    if (origem === "manual" || !origem) return null;
    if (origem === "auto") {
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                <Zap className="h-2.5 w-2.5" />
                auto
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-52 text-xs">
              Etapa aplicada pela automação. Mover o card assume o controle.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 shrink-0">
              sem etiqueta
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-52 text-xs">
            Ainda sem etiqueta de etapa
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-4 overflow-hidden",
        semCabecalho ? "h-full min-h-0" : "h-screen p-6",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 shrink-0">
        {!semCabecalho && (
          <div>
            <h1 className="text-3xl font-heading">Kanban do Funil</h1>
            <p className="text-muted-foreground text-sm">
              As conversas do WhatsApp organizadas pelas tags de etapa.
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {cards.length} conversas · {totais.quentes} quentes · {totais.esperando} esperando resposta
          </span>
          <Button variant="outline" size="sm" onClick={() => carregar()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <p className="text-xs text-muted-foreground max-w-3xl">
          A automação preenche as etapas sozinha a cada 20 minutos. Assim que você move um card, aquela conversa passa a ser sua e a automação não mexe mais nela. A única exceção é pedido pago, que sempre marca Fechado.
        </p>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Origem da etapa:</span>
          {([
            { valor: "todas", rotulo: "Todas" },
            { valor: "auto", rotulo: "Só automáticas" },
            { valor: "manual", rotulo: "Só manuais" },
          ] as { valor: FiltroOrigem; rotulo: string }[]).map((op) => (
            <Button
              key={op.valor}
              variant={filtroOrigem === op.valor ? "default" : "outline"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setFiltroOrigem(op.valor)}
            >
              {op.rotulo}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto pb-2">
          {COLUNAS.map((col) => {
            const lista = visiveis.filter((c) => (c.etapa ?? "") === col.nome);
            return (
              <div
                key={col.nome}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const card = cards.find((c) => String(c.conversa_id) === arrastando);
                  setArrastando(null);
                  if (card) mover(card, col.nome);
                }}
                className={cn(
                  "rounded-lg border border-t-4 bg-muted/30 flex flex-col w-72 shrink-0 min-h-0",
                  col.topoClassName,
                )}
              >
                <div className="flex items-center justify-between px-3 py-2 shrink-0">
                  <span className="text-sm font-medium">{col.nome}</span>
                  <Badge variant="secondary">{lista.length}</Badge>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2 pt-0 space-y-2">
                  {lista.map((card) => (
                    <button
                      key={String(card.conversa_id)}
                      draggable
                      onDragStart={() => setArrastando(String(card.conversa_id))}
                      onClick={() => abrir(card.conversa_id)}
                      className="w-full rounded-md border bg-card p-2 space-y-1.5 text-left cursor-grab active:cursor-grabbing hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full shrink-0",
                            CORE_TEMPERATURA[(card.temperatura ?? "frio").toLowerCase()] ?? "bg-muted-foreground/40",
                          )}
                        />
                        <p className="text-sm font-medium truncate flex-1">{card.nome || "Sem nome"}</p>
                        <SeloOrigem origem={card.etapa_origem} />
                        {card.sac && (
                          <Badge variant="outline" className="text-[10px] shrink-0">SAC</Badge>
                        )}
                      </div>
                      {card.telefone && (
                        <p className="text-[11px] text-muted-foreground">{card.telefone}</p>
                      )}
                      {card.ultima_mensagem_texto && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {card.ultima_mensagem_texto}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1">
                        {card.aguardando_resposta && (
                          <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                            Aguardando resposta
                          </span>
                        )}
                        {card.pix_aberto_valor != null && (
                          <span className="text-xs font-semibold">{brl(card.pix_aberto_valor)}</span>
                        )}
                      </div>
                    </button>
                  ))}
                  {lista.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1 py-6 text-center">Vazio</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
