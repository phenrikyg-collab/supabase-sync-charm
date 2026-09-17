import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, MessageCircle, CreditCard, LifeBuoy, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { enviarWhatsApp } from "@/components/rfm/EnviarWhatsAppInline";
import { digitos } from "@/components/atendimento/contatoTelefones";

export type Caminho = "janela_aberta" | "pedido_pendente" | "atrito_no_site" | "sem_sinal";

export type CaminhoContato = {
  chave_telefone: string | null;
  telefone: string | null;
  caminho: Caminho | null;
  motivo: string | null;
  template_sugerido: string | null;
  janela_aberta: boolean | null;
  minutos_desde_cliente: number | null;
  conversa_id: number | string | null;
};

export const ROTULO_CAMINHO: Record<Caminho, string> = {
  janela_aberta: "Janela aberta",
  pedido_pendente: "Pedido pendente",
  atrito_no_site: "Teve atrito no site",
  sem_sinal: "Sem sinal",
};

const CLASSE_SELO: Record<Caminho, string> = {
  janela_aberta: "border-success/30 bg-success/10 text-success",
  pedido_pendente: "border-primary/30 bg-primary/10 text-primary",
  atrito_no_site: "border-warning/30 bg-warning/10 text-warning",
  sem_sinal: "border-border bg-muted text-muted-foreground",
};

export const ICONE_CAMINHO: Record<Caminho, typeof MessageCircle> = {
  janela_aberta: MessageCircle,
  pedido_pendente: CreditCard,
  atrito_no_site: LifeBuoy,
  sem_sinal: Megaphone,
};

export function SeloCaminho({ caminho }: { caminho: Caminho }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${CLASSE_SELO[caminho]}`}
    >
      {ROTULO_CAMINHO[caminho]}
    </span>
  );
}

/** Uma chamada por tela: caminho de contato por telefone de carrinho. */
export function useCaminhosContato(dias = 30) {
  const { data = [] } = useQuery({
    queryKey: ["carrinhos-caminho-contato", dias],
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await chamarRpc("carrinhos_caminho_contato" as any, { p_dias: dias });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as CaminhoContato[];
    },
  });

  const mapa = useMemo(() => {
    const m = new Map<string, CaminhoContato>();
    for (const c of data) {
      const chave = String(c.chave_telefone ?? "").trim();
      if (chave) m.set(chave, c);
      const d = digitos(c.telefone);
      if (d) m.set(d, c);
    }
    return m;
  }, [data]);

  const caminhoDe = (tel?: string | null): CaminhoContato | undefined => {
    const bruto = String(tel ?? "").trim();
    if (bruto && mapa.has(bruto)) return mapa.get(bruto);
    const d = digitos(tel);
    if (!d) return undefined;
    return mapa.get(d) ?? mapa.get(d.replace(/^55/, "")) ?? mapa.get(`55${d}`);
  };

  return { caminhoDe };
}

/** Templates aprovados, para saber se o botão pode disparar. */
export function useStatusTemplates() {
  const { data = [] } = useQuery({
    queryKey: ["wpp-templates-status"],
    staleTime: 300000,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_templates_listar" as any);
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as { nome: string; status_aprovacao?: string | null }[];
    },
  });

  const aprovado = (nome?: string | null) => {
    if (!nome) return false;
    const t = data.find((x) => x.nome === nome);
    return (t?.status_aprovacao ?? "").toLowerCase() === "aprovado";
  };

  return { aprovado };
}

const primeiroNome = (nome?: string | null) => {
  const limpo = String(nome ?? "").trim();
  if (!limpo || limpo.toLowerCase() === "desconhecido") return "tudo bem";
  return limpo.split(/\s+/)[0];
};

export function CelulaRecuperar({
  telefone,
  nome,
  info,
  templateAprovado,
  templatePadrao,
  contatada,
  onContatada,
}: {
  telefone: string | null;
  nome: string | null;
  info?: CaminhoContato;
  templateAprovado: (nome?: string | null) => boolean;
  /** Template padrão configurado no topo da tela; sem ele o envio fica desabilitado. */
  templatePadrao?: string | null;
  contatada: boolean;
  onContatada: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!telefone) return <span className="text-xs text-muted-foreground">Cliente não identificado</span>;

  const caminho: Caminho = info?.caminho ?? (info?.janela_aberta ? "janela_aberta" : "sem_sinal");

  const enviarLivre = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await enviarWhatsApp(telefone, texto.trim());
      toast.success("Mensagem enviada");
      setTexto("");
      onContatada();
    } catch (e: any) {
      toast.error("Falha ao enviar no WhatsApp", { description: e?.message, duration: 8000 });
    } finally {
      setEnviando(false);
    }
  };

  const enviarTemplate = async (nomeTemplate: string) => {
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-enviar-template", {
        body: {
          telefone,
          conversa_id: info?.conversa_id ?? null,
          nome_template: nomeTemplate,
          parametros: [primeiroNome(nome)],
        },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || (data as any)?.mensagem || error?.message || "Falha no envio");
      }
      toast.success("Template enviado");
      onContatada();
    } catch (e: any) {
      toast.error("Falha ao enviar template", { description: e?.message, duration: 8000 });
    } finally {
      setEnviando(false);
    }
  };

  if (caminho === "janela_aberta") {
    return (
      <div className="min-w-[230px] space-y-1">
        <SeloCaminho caminho="janela_aberta" />
        <div className="flex gap-1">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") enviarLivre();
            }}
            placeholder="Mensagem de recuperação..."
            className="h-8 text-xs"
            disabled={enviando}
          />
          <Button size="sm" className="h-8" onClick={enviarLivre} disabled={enviando || !texto.trim()}>
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-[10px] leading-tight text-muted-foreground">Sem custo de template</p>
      </div>
    );
  }

  if (caminho === "sem_sinal") {
    return (
      <div className="min-w-[210px] space-y-1">
        <SeloCaminho caminho="sem_sinal" />
        <p className="text-[11px] leading-tight text-muted-foreground">
          Sem sinal de problema. Contato aqui seria marketing, use uma campanha.
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => toast("Em breve")}
        >
          Incluir em campanha
        </Button>
      </div>
    );
  }

  const ehPedido = caminho === "pedido_pendente";
  const nomeTemplate = info?.template_sugerido ?? (ehPedido ? "pedido_aguardando_pagamento" : "ajuda_dificuldade_site");
  const rotulo = ehPedido ? "Enviar lembrete de pagamento" : "Perguntar se teve problema";
  const aprovado = templateAprovado(nomeTemplate);
  const desabilitado = enviando || contatada || !aprovado;

  const botao = (
    <span className="inline-block">
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={desabilitado}
        onClick={() => enviarTemplate(nomeTemplate)}
      >
        {enviando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        {contatada ? "Já contatada" : rotulo}
      </Button>
    </span>
  );

  return (
    <div className="min-w-[210px] space-y-1">
      <SeloCaminho caminho={caminho} />
      {!aprovado && !contatada ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{botao}</TooltipTrigger>
            <TooltipContent>Template aguardando aprovação da Meta</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        botao
      )}
      {caminho === "atrito_no_site" && info?.motivo && (
        <p className="text-[11px] leading-tight text-muted-foreground">{info.motivo}</p>
      )}
    </div>
  );
}
