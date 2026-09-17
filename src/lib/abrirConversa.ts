import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Abre uma conversa do WhatsApp de forma consistente em todas as telas.
 * Dentro do painel de Atendimento, usa o callback que apenas troca a aba.
 * Fora dele, navega para /atendimento?conversa=ID, que a página lê ao montar.
 */
export function useAbrirConversa(
  onAbrirConversa?: (conversaId: string, ...resto: any[]) => void,
) {
  const navigate = useNavigate();
  return useCallback(
    (conversaId: string | number, ...resto: any[]) => {
      const id = String(conversaId);
      if (onAbrirConversa) {
        onAbrirConversa(id, ...resto);
        return;
      }
      const textoPronto = typeof resto[0] === "string" ? resto[0] : "";
      const extra = textoPronto ? `&texto=${encodeURIComponent(textoPronto)}` : "";
      navigate(`/atendimento?conversa=${encodeURIComponent(id)}${extra}`);
    },
    [navigate, onAbrirConversa],
  );
}
