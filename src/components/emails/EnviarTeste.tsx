import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { rpcEmails } from "@/lib/emails";
import type { ModoTemplate } from "./PreviaTemplate";

export type PayloadTeste = {
  p_assunto?: string | null;
  p_html?: string | null;
  p_modo?: ModoTemplate | null;
  p_preheader?: string | null;
  p_template_id?: any;
  p_slug?: string | null;
};

const NOTA_METRICAS = "O teste não conta nas métricas e os links dele não são rastreados.";
const NOTA_DESCADASTRO = "O link de sair não funciona no teste, é de propósito.";

function ehEmailInvalido(msg: string) {
  return /endere[cç]o de teste inv[aá]lido/i.test(msg);
}

export function BotaoEnviarTeste({
  montarPayload,
  desabilitado,
  variante = "ghost",
  rotulo = "Enviar teste",
}: {
  montarPayload: () => PayloadTeste;
  desabilitado?: boolean;
  variante?: "ghost" | "outline";
  rotulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [para, setPara] = useState("");
  const [tocado, setTocado] = useState(false);
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<
    | null
    | { fase: "aguardando"; para: string }
    | { fase: "ok"; para: string }
    | { fase: "erro"; para: string; texto: string }
  >(null);
  const [restantes, setRestantes] = useState<number | null>(null);

  const { data: config } = useQuery({
    queryKey: ["emails-config"],
    queryFn: () => rpcEmails<any>("emails_config_get"),
    enabled: aberto,
  });

  useEffect(() => {
    if (tocado) return;
    const padrao = (config?.emails_teste ?? [])[0];
    if (padrao) setPara(String(padrao));
  }, [config, tocado]);

  const enviar = async () => {
    const destino = para.trim();
    setErroCampo(null);
    if (!destino) { setErroCampo("Informe o endereço de teste."); return; }
    setEnviando(true);
    try {
      const r = await rpcEmails<any>("emails_teste_enviar", { p_para: destino, ...montarPayload() });
      if (typeof r?.restantes_na_hora === "number") setRestantes(r.restantes_na_hora);
      setEstado({ fase: "aguardando", para: String(r?.para ?? destino) });
      setEnviando(false);
      setTimeout(async () => {
        try {
          const s = await rpcEmails<any>("emails_teste_status", { p_teste_id: r?.teste_id });
          if (s?.entregue_ao_ses) setEstado({ fase: "ok", para: String(s?.para ?? destino) });
          else
            setEstado({
              fase: "erro",
              para: String(s?.para ?? destino),
              texto: typeof s?.resposta === "string" ? s.resposta : "A AWS não aceitou a mensagem.",
            });
        } catch (e: any) {
          setEstado({ fase: "erro", para: destino, texto: e?.message ?? "Não deu para conferir o envio." });
        }
      }, 2000);
    } catch (e: any) {
      setEnviando(false);
      const msg = String(e?.message ?? "Não deu para enviar o teste.");
      if (ehEmailInvalido(msg)) { setErroCampo(msg); return; }
      setEstado(null);
      toast({ title: "Não deu para enviar o teste", description: msg, variant: "destructive" });
    }
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={variante} disabled={desabilitado}>
          <Send className="mr-1 h-3.5 w-3.5" /> {rotulo}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2">
        <p className="text-sm font-medium">Enviar teste</p>
        <div className="flex gap-2">
          <Input
            value={para}
            onChange={(e) => { setTocado(true); setPara(e.target.value); setErroCampo(null); }}
            placeholder="alguem@exemplo.com"
            className={cn("h-9", erroCampo && "border-danger focus-visible:ring-danger")}
          />
          <Button size="sm" className="h-9" disabled={enviando} onClick={enviar}>
            {enviando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Enviar
          </Button>
        </div>
        {erroCampo && <p className="text-xs text-danger">{erroCampo}</p>}

        {estado?.fase === "aguardando" && (
          <p className="text-xs text-muted-foreground">Enviado para {estado.para}</p>
        )}
        {estado?.fase === "ok" && (
          <p className="text-xs text-success">A AWS aceitou. Enviado para {estado.para}</p>
        )}
        {estado?.fase === "erro" && <p className="text-xs text-danger">{estado.texto}</p>}

        {restantes != null && restantes < 10 && (
          <p className="text-xs text-warning">Restam {restantes} testes nesta hora.</p>
        )}

        <p className="text-[11px] text-muted-foreground">{NOTA_METRICAS}</p>
        <p className="text-[11px] text-muted-foreground">{NOTA_DESCADASTRO}</p>
      </PopoverContent>
    </Popover>
  );
}
