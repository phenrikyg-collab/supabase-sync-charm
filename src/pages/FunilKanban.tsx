import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, ExternalLink, MessageCircle } from "lucide-react";

type Etapa =
  | "oportunidade"
  | "atendimento"
  | "interesse"
  | "pagamento_enviado"
  | "pago"
  | "perdido";

const COLUNAS: { key: Etapa; label: string; topo: string }[] = [
  { key: "oportunidade", label: "Oportunidade", topo: "border-t-muted-foreground/30" },
  { key: "atendimento", label: "Atendimento", topo: "border-t-muted-foreground/50" },
  { key: "interesse", label: "Interesse", topo: "border-t-primary/60" },
  { key: "pagamento_enviado", label: "Pagamento enviado", topo: "border-t-warning/70" },
  { key: "pago", label: "Pago", topo: "border-t-emerald-500/70" },
  { key: "perdido", label: "Perdido", topo: "border-t-danger/70" },
];

type CardFunil = {
  card_id: string | number;
  conversa_id: string | number | null;
  etapa: Etapa | string;
  ordem: number | null;
  ordem_coluna: number | null;
  prioridade: number | null;
  nome: string | null;
  titulo: string | null;
  detalhe: string | null;
  valor_real: number | null;
  valor_potencial: number | null;
  origem: string | null;
  contato_permitido: string | null;
  wa_link: string | null;
  nivel: string | null;
  motivos: string[] | null;
  data?: string | null;
};

const brl = (v?: number | null) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const hoje = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

const bordaNivel = (nivel?: string | null) => {
  const n = (nivel ?? "").toLowerCase();
  if (n === "quente") return "border-l-4 border-l-danger";
  if (n === "atencao") return "border-l-4 border-l-warning";
  return "border-l-4 border-l-transparent";
};

export default function FunilKanban() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const atendente =
    (user?.user_metadata?.nome as string) || user?.email || "Painel";

  const [cards, setCards] = useState<CardFunil[]>([]);
  const [loading, setLoading] = useState(true);
  const [arrastando, setArrastando] = useState<string | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { data, error } = await supabase
      .from("vw_funil_kanban" as any)
      .select("*")
      .eq("data", hoje());
    if (error) {
      if (!silencioso) toast.error("Erro ao carregar o funil: " + error.message);
    } else {
      setCards(((data ?? []) as unknown as CardFunil[]));
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const t = setInterval(() => carregar(true), 60000);
    return () => clearInterval(t);
  }, [carregar]);

  const mover = useCallback(
    async (card: CardFunil, etapa: Etapa) => {
      if (card.etapa === etapa) return;
      const anterior = cards;
      const ordem = cards.filter((c) => c.etapa === etapa).length;
      setCards((prev) =>
        prev.map((c) => (String(c.card_id) === String(card.card_id) ? { ...c, etapa, ordem } : c)),
      );
      const { error } = await supabase.rpc("funil_mover_card" as any, {
        p_card_id: card.card_id,
        p_etapa: etapa,
        p_ordem: ordem,
        p_atendente: atendente,
      });
      if (error) {
        setCards(anterior);
        toast.error("Não foi possível mover: " + error.message);
      } else {
        carregar(true);
      }
    },
    [cards, atendente, carregar],
  );

  const totalReal = cards.reduce((s, c) => s + (Number(c.valor_real) || 0), 0);
  const totalPotencial = cards.reduce(
    (s, c) => s + (c.valor_real ? 0 : Number(c.valor_potencial) || 0),
    0,
  );

  return (
    <div className="h-screen flex flex-col p-6 gap-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-heading">Kanban do Funil</h1>
          <p className="text-muted-foreground text-sm">
            Oportunidades de hoje no WhatsApp e no site.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => carregar()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cards no board</p>
            <p className="text-2xl font-semibold mt-1">{cards.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Valor real</p>
            <p className="text-2xl font-semibold mt-1">{brl(totalReal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Potencial</p>
            <p className="text-2xl font-semibold mt-1 text-muted-foreground">
              {brl(totalPotencial)}
            </p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-6 lg:grid-cols-3 sm:grid-cols-2">
          {COLUNAS.map((col) => {
            const lista = cards
              .filter((c) => c.etapa === col.key)
              .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
            return (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const card = cards.find((c) => String(c.card_id) === arrastando);
                  setArrastando(null);
                  if (card) mover(card, col.key);
                }}
                className={cn(
                  "rounded-lg border border-t-4 bg-muted/30 p-2 min-h-[240px] space-y-2",
                  col.topo,
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-medium">{col.label}</span>
                  <Badge variant="secondary">{lista.length}</Badge>
                </div>
                {lista.map((card) => (
                  <CardKanban
                    key={String(card.card_id)}
                    card={card}
                    onDragStart={() => setArrastando(String(card.card_id))}
                    onAbrirConversa={() =>
                      card.conversa_id && navigate(`/atendimento?conversa=${card.conversa_id}`)
                    }
                  />
                ))}
                {lista.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1 py-6 text-center">Vazio</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardKanban({
  card, onDragStart, onAbrirConversa,
}: {
  card: CardFunil;
  onDragStart: () => void;
  onAbrirConversa: () => void;
}) {
  const contato = (card.contato_permitido ?? "").toLowerCase();

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        "rounded-md border bg-card p-2 space-y-1.5 cursor-grab active:cursor-grabbing",
        bordaNivel(card.nivel),
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-medium truncate">{card.nome || "Sem nome"}</p>
        {(card.origem ?? "").toLowerCase() === "site" && (
          <Badge variant="outline" className="text-[10px] shrink-0">site</Badge>
        )}
      </div>

      {card.titulo && <p className="text-xs text-foreground/80 line-clamp-2">{card.titulo}</p>}
      {card.detalhe && (
        <p className="text-[11px] text-muted-foreground line-clamp-2">{card.detalhe}</p>
      )}

      {card.valor_real ? (
        <p className="text-sm font-semibold">{brl(card.valor_real)}</p>
      ) : card.valor_potencial ? (
        <p className="text-xs text-muted-foreground">
          {brl(card.valor_potencial)} <span className="text-[10px]">potencial</span>
        </p>
      ) : null}

      {card.motivos && card.motivos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.motivos.map((m, i) => (
            <span
              key={`${m}-${i}`}
              className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground whitespace-nowrap"
            >
              {m}
            </span>
          ))}
        </div>
      )}

      {contato === "livre" && card.conversa_id ? (
        <Button size="sm" className="w-full h-7 text-xs" onClick={onAbrirConversa}>
          <MessageCircle className="h-3.5 w-3.5 mr-1" />
          Abrir conversa
        </Button>
      ) : contato === "template" ? (
        <div className="space-y-1">
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs"
            disabled={!card.wa_link}
            onClick={() => card.wa_link && window.open(card.wa_link, "_blank", "noopener")}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Abrir no WhatsApp
          </Button>
          <p className="text-[10px] text-muted-foreground leading-tight">
            fora da janela de 24h, só template ou mensagem manual
          </p>
        </div>
      ) : contato === "sem_telefone" ? (
        <p className="text-[10px] text-muted-foreground">só e-mail</p>
      ) : null}
    </div>
  );
}
