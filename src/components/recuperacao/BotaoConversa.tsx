import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAbrirConversa } from "@/lib/abrirConversa";
import { cn } from "@/lib/utils";

/**
 * Abre a conversa da cliente dentro do painel. Quando ainda não existe conversa,
 * cria pelo telefone e abre em seguida. Nunca leva para o WhatsApp Web.
 */
export function BotaoConversa({
  conversaId,
  telefone,
  onAbrirConversa,
  onAberta,
  className,
  size = "sm",
  variant = "outline",
}: {
  conversaId?: string | number | null;
  telefone?: string | null;
  onAbrirConversa?: (conversaId: string) => void;
  /** Avisa que a conversa foi aberta a partir deste botão. */
  onAberta?: () => void;
  className?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
}) {
  const abrirConversa = useAbrirConversa(onAbrirConversa);
  const [criando, setCriando] = useState(false);

  const temTelefone = !!String(telefone ?? "").trim();
  if (!conversaId && !temTelefone) return null;

  const clicar = async () => {
    if (conversaId) {
      abrirConversa(conversaId);
      onAberta?.();
      return;
    }
    setCriando(true);
    try {
      const { data, error } = await (supabase as any).rpc("whatsapp_get_or_create_conversa", {
        p_telefone: telefone,
      });
      if (error) throw error;
      const conversa = Array.isArray(data) ? data[0] : data;
      const id = conversa?.id ?? conversa?.conversa_id;
      if (!id) throw new Error("Não foi possível abrir a conversa");
      abrirConversa(id);
      onAberta?.();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível abrir a conversa");
    } finally {
      setCriando(false);
    }
  };

  return (
    <Button size={size} variant={variant} className={cn("gap-1.5", className)} onClick={clicar} disabled={criando}>
      {criando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
      {conversaId ? "Abrir conversa" : "Iniciar conversa"}
    </Button>
  );
}
