import { useState } from "react";

/** Preferências de recolhimento compartilhadas entre conversas neste navegador. */
export function useAtendimentoCollapsible(secao: "cashback" | "cupons" | "extrato") {
  const chave = `atendimento-cashback-${secao}-aberto`;
  const [aberto, setAberto] = useState(() => {
    try {
      return localStorage.getItem(chave) !== "false";
    } catch {
      return true;
    }
  });

  const alterarAberto = (valor: boolean) => {
    setAberto(valor);
    try {
      localStorage.setItem(chave, String(valor));
    } catch {
      /* armazenamento indisponível */
    }
  };

  return [aberto, alterarAberto] as const;
}