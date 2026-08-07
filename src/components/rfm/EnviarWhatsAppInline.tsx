import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";

export const AVISO_JANELA_24H =
  "⚠️ Só funciona se a cliente falou com vocês nas últimas 24h. Fora disso, a Meta exige um template aprovado — a mensagem pode falhar.";

export async function enviarWhatsApp(telefone: string, conteudo: string) {
  const { data: conversa, error: erroConversa } = await supabase.rpc(
    "whatsapp_get_or_create_conversa" as any,
    { p_telefone: telefone }
  );
  if (erroConversa) throw new Error(erroConversa.message || "Falha ao abrir conversa");

  const registro: any = Array.isArray(conversa) ? conversa[0] : conversa;
  const conversaId = registro?.id ?? registro;

  const { data, error } = await supabase.functions.invoke("whatsapp-enviar-mensagem-humano", {
    body: { conversa_id: conversaId, telefone, conteudo },
  });
  if (error) {
    let detalhe = error.message || "Falha no envio";
    try {
      const corpo = await (error as any)?.context?.text?.();
      if (corpo) detalhe = corpo;
    } catch {
      /* ignora */
    }
    if (detalhe.includes("janela_24h_fechada")) {
      throw new Error(
        "Fora da janela de 24h: a cliente não fala com vocês há mais de 24h. Só um template aprovado reabre o contato — use a tela de Campanhas (Marketing WhatsApp)."
      );
    }
    throw new Error(detalhe);
  }
  if (data && (data as any).error) {
    const msg = String((data as any).error);
    if (msg.includes("janela_24h_fechada")) {
      throw new Error(
        "Fora da janela de 24h: a cliente não fala com vocês há mais de 24h. Só um template aprovado reabre o contato — use a tela de Campanhas (Marketing WhatsApp)."
      );
    }
    throw new Error(msg);
  }

  return data;
}

type Props = {
  telefone: string | null | undefined;
  placeholder?: string;
  mostrarAviso?: boolean;
};

export function EnviarWhatsAppInline({ telefone, placeholder = "Mensagem...", mostrarAviso }: Props) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!telefone) return <span className="text-xs text-muted-foreground">Sem telefone</span>;

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await enviarWhatsApp(telefone, texto.trim());
      toast.success("Mensagem enviada");
      setTexto("");
    } catch (e: any) {
      toast.error("Falha ao enviar no WhatsApp", {
        description: e?.message ?? "Erro desconhecido",
        duration: 8000,
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-1 min-w-[220px]">
      <div className="flex gap-1">
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enviar();
          }}
          placeholder={placeholder}
          className="h-8 text-xs"
          disabled={enviando}
        />
        <Button size="sm" className="h-8" onClick={enviar} disabled={enviando || !texto.trim()}>
          {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {mostrarAviso && <p className="text-[10px] leading-tight text-warning">{AVISO_JANELA_24H}</p>}
    </div>
  );
}
