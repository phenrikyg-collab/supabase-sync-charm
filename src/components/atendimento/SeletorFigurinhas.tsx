import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Smile, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/edgeFunctions";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Figurinha = {
  id?: string | number;
  intent_tag: string;
  label?: string | null;
  media_url: string;
  funnel_stage?: string | null;
};

const ORDEM_ETAPAS = ["topo", "meio", "fundo", "pos", "sac", "reacao"];

const ROTULO_ETAPA: Record<string, string> = {
  topo: "Topo de funil",
  meio: "Meio de funil",
  fundo: "Fundo de funil",
  pos: "Pós-venda",
  sac: "SAC",
  reacao: "Reações",
};

export function SeletorFigurinhas({
  telefone,
  conversaId,
  onEnviada,
}: {
  telefone: string | null;
  conversaId: string | number;
  onEnviada?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [janelaFechada, setJanelaFechada] = useState(false);

  const { data: figurinhas = [], isLoading } = useQuery({
    queryKey: ["vw-figurinhas"],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_figurinhas" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Figurinha[];
    },
  });

  const grupos = ORDEM_ETAPAS.map((etapa) => ({
    etapa,
    itens: figurinhas.filter((f) => (f.funnel_stage ?? "").toLowerCase() === etapa),
  })).filter((g) => g.itens.length > 0);

  const outras = figurinhas.filter(
    (f) => !ORDEM_ETAPAS.includes((f.funnel_stage ?? "").toLowerCase()),
  );
  if (outras.length > 0) grupos.push({ etapa: "outras", itens: outras });

  const enviar = async (f: Figurinha) => {
    if (janelaFechada) return;
    if (!telefone) {
      toast({ title: "Conversa sem telefone", variant: "destructive" });
      return;
    }
    setEnviando(f.intent_tag);
    try {
      const resposta = await fetch(`${SUPABASE_URL}/functions/v1/figurinhas-enviar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ telefone, intent_tag: f.intent_tag, conversa_id: conversaId }),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (resposta.status === 409 && corpo?.janela_fechada) {
        setJanelaFechada(true);
        toast({
          title: "Passou de 24h desde a última mensagem da cliente, só dá para reabrir por template",
          variant: "destructive",
        });
        return;
      }
      if (!resposta.ok || corpo?.error) {
        throw new Error(corpo?.error || corpo?.mensagem || `Falha no envio (${resposta.status})`);
      }
      setAberto(false);
      onEnviada?.();
    } catch (e: any) {
      toast({ title: "Erro ao enviar figurinha", description: e.message, variant: "destructive" });
    } finally {
      setEnviando(null);
    }
  };

  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) setJanelaFechada(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button size="icon" variant="outline" title="Enviar figurinha">
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[70vh] w-80 overflow-hidden p-0" align="start">
        {janelaFechada && (
          <p className="m-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-foreground">
            Passou de 24h desde a última mensagem da cliente, só dá para reabrir por template
          </p>
        )}
        <div className="max-h-[22rem] overflow-y-auto overscroll-contain">
          <div className="p-3 space-y-4">
            {isLoading && <p className="text-xs text-muted-foreground">Carregando figurinhas…</p>}
            {!isLoading && grupos.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma figurinha cadastrada.</p>
            )}
            {grupos.map((g) => (
              <div key={g.etapa}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {ROTULO_ETAPA[g.etapa] ?? g.etapa}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {g.itens.map((f) => (
                    <button
                      key={String(f.id ?? f.intent_tag)}
                      title={f.label ?? f.intent_tag}
                      disabled={janelaFechada || enviando !== null}
                      onClick={() => enviar(f)}
                      className={cn(
                        "relative flex aspect-square items-center justify-center rounded-md p-1 transition-colors hover:bg-accent",
                        (janelaFechada || enviando !== null) && "opacity-50",
                      )}
                    >
                      <img
                        src={f.media_url}
                        alt={f.label ?? f.intent_tag}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                      />
                      {enviando === f.intent_tag && (
                        <Loader2 className="absolute h-4 w-4 animate-spin text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
