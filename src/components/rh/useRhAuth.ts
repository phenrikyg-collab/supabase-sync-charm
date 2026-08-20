import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface OperadorInfo {
  nome?: string | null;
  email?: string | null;
  pode_aprovar?: boolean;
  pode_executar?: boolean;
}

export const MSG_SEM_ACESSO = "Sua conta não tem acesso à folha. Peça liberação ao administrador.";

/** Traduz mensagens de erro vindas das RPCs de RH. */
export function erroRh(error: { message?: string } | null | undefined) {
  const m = (error?.message ?? "").toLowerCase();
  if (m.includes("sessao nao autenticada") || m.includes("sessão não autenticada"))
    return { tipo: "sessao" as const, mensagem: "Sua sessão expirou. Faça login novamente." };
  if (m.includes("acesso negado") && (m.includes("rh") || m.includes("restrita")))
    return {
      tipo: "sem_acesso" as const,
      mensagem: "Acesso negado: área de RH restrita (requer módulo RH ou perfil admin)",
    };
  if (m.includes("sem permissao na folha") || m.includes("sem permissão na folha"))
    return { tipo: "sem_acesso" as const, mensagem: MSG_SEM_ACESSO };
  if (m.includes("nao tem permissao para aprovar") || m.includes("não tem permissão para aprovar"))
    return { tipo: "sem_aprovar" as const, mensagem: "Você não tem permissão para aprovar a folha." };
  return { tipo: "outro" as const, mensagem: error?.message ?? "Erro inesperado" };
}

/** Sessão Supabase + info do operador de folha (rh_operador_atual_info). */
export function useRhAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [operador, setOperador] = useState<OperadorInfo | null>(null);
  const [semAcesso, setSemAcesso] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setCarregandoSessao(false);
      if (!s) {
        setOperador(null);
        setSemAcesso(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setCarregandoSessao(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const carregarOperador = useCallback(async () => {
    const { data, error } = await supabase.rpc("rh_operador_atual_info");
    if (error) {
      const e = erroRh(error);
      setOperador(null);
      setSemAcesso(e.tipo === "sessao" ? null : e.mensagem);
      if (e.tipo === "sessao") await supabase.auth.signOut();
      return;
    }
    const info = (Array.isArray(data) ? data[0] : data) as OperadorInfo | null;
    setSemAcesso(null);
    setOperador(info ?? {});
  }, []);

  useEffect(() => {
    if (session) carregarOperador();
  }, [session?.user?.id, carregarOperador]);

  const sair = useCallback(() => supabase.auth.signOut(), []);

  return { session, carregandoSessao, operador, semAcesso, sair, recarregarOperador: carregarOperador };
}
