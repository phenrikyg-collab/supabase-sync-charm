import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

export type TemplateContexto = {
  nome: string;
  categoria?: string | null;
  corpo_texto?: string | null;
  variaveis_rotulos?: unknown;
  botoes?: unknown;
  e_padrao?: boolean | null;
};

/** Templates aprovados de um contexto, com o padrão já marcado pela RPC. */
export function useTemplatesContexto(contexto: string) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["wpp-templates-contexto", contexto],
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_templates_para_contexto" as any, { p_contexto: contexto });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as TemplateContexto[];
    },
  });

  const padrao = data.find((t) => t.e_padrao === true) ?? null;
  return { templates: data, padrao, carregando: isLoading };
}

function SeloCategoria({ categoria }: { categoria?: string | null }) {
  const cat = String(categoria ?? "").toUpperCase();
  if (!cat) return null;
  const marketing = cat === "MARKETING";
  return (
    <span
      className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
        marketing ? "border-warning/30 bg-warning/10 text-warning" : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {cat}
    </span>
  );
}

const duasLinhas = (texto?: string | null) =>
  String(texto ?? "")
    .split("\n")
    .filter((l) => l.trim())
    .slice(0, 2)
    .join(" ");

/** Seletor do template padrão do contexto, com prévia e aviso de marketing. */
export function SeletorTemplatePadrao({
  contexto,
  templates,
  padrao,
}: {
  contexto: string;
  templates: TemplateContexto[];
  padrao: TemplateContexto | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const escolher = async (nome: string) => {
    const { data, error } = await chamarRpc("whatsapp_template_padrao_definir" as any, {
      p_contexto: contexto,
      p_template_nome: nome,
      p_por: user?.email ?? null,
    });
    const r = (data ?? {}) as any;
    if (error || r?.ok === false) {
      toast.error("Não foi possível salvar o template padrão", { description: r?.erro || error?.message });
      return;
    }
    toast.success("Template padrão salvo");
    qc.invalidateQueries({ queryKey: ["wpp-templates-contexto", contexto] });
  };

  const selecionado = padrao ?? null;
  const ehMarketing = String(selecionado?.categoria ?? "").toUpperCase() === "MARKETING";

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Template padrão</Label>
      <Select value={selecionado?.nome ?? ""} onValueChange={escolher}>
        <SelectTrigger className="h-9 w-[280px]">
          <SelectValue placeholder={templates.length ? "Escolha um template" : "Nenhum template aprovado"} />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.nome} value={t.nome}>
              <span className="inline-flex items-center">
                {t.nome}
                <SeloCategoria categoria={t.categoria} />
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selecionado?.corpo_texto && (
        <p className="max-w-[320px] text-[11px] leading-tight text-muted-foreground">
          {duasLinhas(selecionado.corpo_texto)}
        </p>
      )}
      {ehMarketing && (
        <p className="flex max-w-[320px] items-start gap-1 text-[11px] leading-tight text-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Template de marketing: só envie dentro do horário de campanha e para quem não deu opt-out.
        </p>
      )}
    </div>
  );
}

/** Envio do template padrão do contexto para uma cliente da lista. */
export function BotaoTemplatePadrao({
  telefone,
  nome,
  conversaId,
  padrao,
  rotulo,
  contatada,
  onContatada,
}: {
  telefone: string | null;
  nome: string | null;
  conversaId?: string | number | null;
  padrao: TemplateContexto | null;
  rotulo: string;
  contatada: boolean;
  onContatada: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  if (!telefone) return null;

  const primeiro = () => {
    const limpo = String(nome ?? "").trim();
    if (!limpo || limpo.toLowerCase() === "desconhecido") return "tudo bem";
    return limpo.split(/\s+/)[0];
  };

  const enviar = async () => {
    if (!padrao?.nome) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-enviar-template", {
        body: {
          telefone,
          conversa_id: conversaId ?? null,
          nome_template: padrao.nome,
          parametros: [primeiro()],
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

  const botao = (
    <span className="inline-block">
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={enviando || contatada || !padrao?.nome}
        onClick={enviar}
      >
        {enviando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        {contatada ? "Já contatada" : rotulo}
      </Button>
    </span>
  );

  if (padrao?.nome || contatada) return botao;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{botao}</TooltipTrigger>
        <TooltipContent>Escolha um template padrão no topo da tela</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
