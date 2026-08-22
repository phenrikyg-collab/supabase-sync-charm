import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lerErroEdge } from "@/lib/edgeError";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export type RespostasGeradas = {
  respostaPublica: string;
  respostaDm: string;
  aviso: string | null;
};

type Props = {
  produtoIds: string[];
  gatilhos: string[];
  /** Só existe no modal de post já publicado */
  mediaId?: string | null;
  contexto?: string | null;
  onResultado: (r: RespostasGeradas) => void;
};

/**
 * Botão "Gerar respostas com IA" — chama a Edge Function instagram-gerar-respostas
 * e devolve resposta pública, resposta de Direct e aviso via onResultado.
 */
export function BotaoGerarRespostas({ produtoIds, gatilhos, mediaId, contexto, onResultado }: Props) {
  const [gerando, setGerando] = useState(false);
  const desabilitado = produtoIds.length === 0;

  const gerar = async () => {
    if (gerando || desabilitado) return;
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-gerar-respostas", {
        body: {
          produto_ids: produtoIds,
          palavras_gatilho: gatilhos,
          ...(mediaId ? { media_id: mediaId } : {}),
          ...(contexto?.trim() ? { contexto: contexto.trim() } : {}),
        },
      });
      if (error) {
        const det = await lerErroEdge(error, "Falha ao gerar as respostas. Tente novamente.");
        toast.error(det.mensagem, { description: det.dica });
        return;
      }
      if (!data || data.ok === false || data.erro || data.error) {
        toast.error(data?.erro ?? data?.error ?? "A IA não devolveu respostas.", {
          description: data?.dica,
        });
        return;
      }
      onResultado({
        respostaPublica: String(data.resposta_gatilho_publica ?? ""),
        respostaDm: String(data.resposta_gatilho_dm ?? ""),
        aviso: data.aviso ? String(data.aviso) : null,
      });
      toast.success("Respostas geradas — revise antes de salvar");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar as respostas");
    } finally {
      setGerando(false);
    }
  };

  const botao = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={gerar}
      disabled={desabilitado || gerando}
      className="gap-1.5"
    >
      {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {gerando ? "Gerando respostas…" : "Gerar respostas com IA"}
    </Button>
  );

  // Tooltip não dispara em botão desabilitado — por isso o <span> envolve
  if (!desabilitado) return botao;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">{botao}</span>
        </TooltipTrigger>
        <TooltipContent>Selecione ao menos um produto</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
