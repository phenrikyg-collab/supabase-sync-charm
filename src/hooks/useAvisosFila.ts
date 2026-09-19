import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const URL_PUSH = "https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/app-push";

export type SituacaoAvisosFila = {
  ok?: boolean;
  ativo_neste_aparelho?: boolean;
  meus_aparelhos?: number;
  equipe_total?: number;
  aviso_de_fila_ligado?: boolean;
  janela?: string | null;
};

type RespostaRpc = { ok?: boolean; erro?: string };

function base64UrlParaUint8Array(valor: string) {
  const base64 = valor.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(valor.length / 4) * 4, "=");
  const binario = window.atob(base64);
  return Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
}

async function chavePublica() {
  const resposta = await fetch(`${URL_PUSH}?acao=chave`);
  if (!resposta.ok) throw new Error("Não foi possível consultar a chave dos avisos.");
  const dados = await resposta.json() as { chave?: string; ativo?: boolean };
  if (!dados.ativo || !dados.chave) throw new Error("Os avisos ainda não estão disponíveis no servidor.");
  return dados;
}

function plataformaAtual(): "ios" | "android" | "outro" {
  const agente = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(agente)) return "ios";
  if (agente.includes("android")) return "android";
  return "outro";
}

function instalado() {
  const navegadorIos = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navegadorIos.standalone === true;
}

export function useAvisosFila() {
  const { session } = useAuth();
  const [situacao, setSituacao] = useState<SituacaoAvisosFila | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [alterando, setAlterando] = useState(false);
  const suportado = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  const recarregar = useCallback(async () => {
    if (!session || !suportado) return;
    setCarregando(true);
    try {
      const registro = await navigator.serviceWorker.ready;
      const assinatura = await registro.pushManager.getSubscription();
      const { data, error } = await supabase.rpc("app_push_equipe_situacao" as never, {
        p_endpoint: assinatura?.endpoint ?? null,
      } as never);
      if (error) throw error;
      setSituacao((data ?? null) as SituacaoAvisosFila | null);
    } catch (erro) {
      toast({
        title: "Não foi possível consultar os avisos",
        description: erro instanceof Error ? erro.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCarregando(false);
    }
  }, [session, suportado]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const ativar = useCallback(async () => {
    if (!session || !suportado) return;
    setAlterando(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        throw new Error(permissao === "denied" ? "Os avisos foram bloqueados pelo navegador." : "A permissão para avisos não foi concedida.");
      }
      const { chave } = await chavePublica();
      const registro = await navigator.serviceWorker.ready;
      const assinaturaExistente = await registro.pushManager.getSubscription();
      const assinatura = assinaturaExistente ?? await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlParaUint8Array(chave),
      });
      const json = assinatura.toJSON();
      const { data, error } = await supabase.rpc("app_push_equipe_inscrever" as never, {
        p: {
          endpoint: assinatura.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          plataforma: plataformaAtual(),
          instalado: instalado(),
          user_agent: navigator.userAgent,
        },
      } as never);
      if (error) throw error;
      const resposta = (data ?? {}) as RespostaRpc;
      if (resposta.ok === false) throw new Error(resposta.erro || "Não foi possível ativar os avisos.");
      toast({ title: "Avisos ativados neste aparelho" });
      await recarregar();
    } catch (erro) {
      toast({
        title: "Não foi possível ativar",
        description: erro instanceof Error ? erro.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setAlterando(false);
    }
  }, [recarregar, session, suportado]);

  const desativar = useCallback(async () => {
    if (!session || !suportado) return;
    setAlterando(true);
    try {
      const registro = await navigator.serviceWorker.ready;
      const assinatura = await registro.pushManager.getSubscription();
      const endpoint = assinatura?.endpoint ?? null;
      if (assinatura) await assinatura.unsubscribe();
      const { data, error } = await supabase.rpc("app_push_equipe_cancelar" as never, {
        p_endpoint: endpoint,
      } as never);
      if (error) throw error;
      const resposta = (data ?? {}) as RespostaRpc;
      if (resposta.ok === false) throw new Error(resposta.erro || "Não foi possível desativar os avisos.");
      toast({ title: "Avisos desativados neste aparelho" });
      await recarregar();
    } catch (erro) {
      toast({
        title: "Não foi possível desativar",
        description: erro instanceof Error ? erro.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setAlterando(false);
    }
  }, [recarregar, session, suportado]);

  return { situacao, suportado, carregando, alterando, ativar, desativar, recarregar };
}