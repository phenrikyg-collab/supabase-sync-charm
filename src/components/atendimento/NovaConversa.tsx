import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, ArrowLeft, Lock, MessageCircle } from "lucide-react";
import { chamarRpc } from "@/lib/supabaseRpc";

/** Mantém só os dígitos, que é o formato que o backend espera */
export const soDigitos = (v?: string | null) => (v ?? "").replace(/\D/g, "");

/** Exibe (11) 94700-0895 a partir de qualquer formato */
export function formatarTelefone(valor?: string | null): string {
  const d = soDigitos(valor);
  if (!d) return "";
  const nacional = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  return valor ?? "";
}

type TemplatePrimeiroContato = {
  id?: number | string | null;
  nome?: string | null;
  nome_template?: string | null;
  categoria?: string | null;
  idioma?: string | null;
  corpo?: string | null;
  body?: string | null;
  variaveis_exemplo?: string[] | null;
};

const nomeTemplate = (t: TemplatePrimeiroContato) => t.nome_template ?? t.nome ?? "";
const corpoTemplate = (t: TemplatePrimeiroContato) => t.corpo ?? t.body ?? "";

function variaveisDoCorpo(corpo?: string | null): number[] {
  if (!corpo) return [];
  const achados = new Set<number>();
  for (const m of corpo.matchAll(/\{\{(\d+)\}\}/g)) achados.add(Number(m[1]));
  return [...achados].sort((a, b) => a - b);
}

export function NovaConversaDialog({
  open,
  onOpenChange,
  telefoneInicial,
  onConversaPronta,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  telefoneInicial?: string | null;
  /** chamado quando a conversa existe e pode ser aberta na tela */
  onConversaPronta: (conversaId: number | string) => void;
}) {
  const [telefone, setTelefone] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [conversaId, setConversaId] = useState<number | string | null>(null);
  const [nomeCliente, setNomeCliente] = useState<string | null>(null);
  const [janelaAberta, setJanelaAberta] = useState<boolean | null>(null);
  const [escolhido, setEscolhido] = useState<TemplatePrimeiroContato | null>(null);
  const [valores, setValores] = useState<Record<number, string>>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (open) {
      setTelefone(formatarTelefone(telefoneInicial) || "");
      setConversaId(null);
      setNomeCliente(null);
      setJanelaAberta(null);
      setEscolhido(null);
      setValores({});
    }
  }, [open, telefoneInicial]);

  const { data: templates = [], isLoading: carregandoTemplates } = useQuery({
    queryKey: ["wpp-templates-primeiro-contato"],
    enabled: open && janelaAberta === false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_templates_primeiro_contato" as any)
        .select("*");
      if (error) throw error;
      return (data ?? []) as TemplatePrimeiroContato[];
    },
  });

  const digitos = soDigitos(telefone);
  const telefoneValido = digitos.length >= 10;

  const continuar = async () => {
    if (!telefoneValido) return;
    setBuscando(true);
    try {
      const { data, error } = await chamarRpc("whatsapp_get_or_create_conversa" as any, {
        p_telefone: digitos,
      });
      if (error) throw error;
      const conversa = (Array.isArray(data) ? data[0] : data) as any;
      const id = conversa?.id ?? conversa?.conversa_id;
      if (!id) throw new Error("Não foi possível abrir a conversa deste número.");
      setConversaId(id);
      setNomeCliente(conversa?.nome ?? conversa?.cliente_nome ?? conversa?.nome_cliente ?? null);

      const { data: janela, error: erroJanela } = await chamarRpc(
        "whatsapp_dentro_janela_24h" as any,
        { p_conversa_id: id },
      );
      if (erroJanela) throw erroJanela;
      const aberta = janela === true;
      setJanelaAberta(aberta);
      if (aberta) {
        onConversaPronta(id);
        onOpenChange(false);
      }
    } catch (e: any) {
      toast({ title: "Erro ao iniciar conversa", description: e.message, variant: "destructive" });
    } finally {
      setBuscando(false);
    }
  };

  const variaveis = useMemo(() => variaveisDoCorpo(corpoTemplate(escolhido ?? {})), [escolhido]);
  const faltando = variaveis.some((n) => !(valores[n] ?? "").trim());
  const previa = escolhido
    ? corpoTemplate(escolhido).replace(/\{\{(\d+)\}\}/g, (_, n) => valores[Number(n)] || `{{${n}}}`)
    : "";

  const enviarTemplate = async () => {
    if (!escolhido) return;
    setEnviando(true);
    try {
      const { data: corpo, error } = await supabase.functions.invoke(
        "whatsapp-enviar-template",
        {
          body: {
            telefone: digitos,
            conversa_id: conversaId,
            nome_template: nomeTemplate(escolhido),
            parametros: variaveis.map((n) => valores[n] ?? ""),
          },
        },
      );
      if (error || (corpo as any)?.error) {
        throw new Error(
          (corpo as any)?.error || (corpo as any)?.mensagem || error?.message || "Falha no envio",
        );
      }
      toast({ title: "Template enviado" });
      if (conversaId) onConversaPronta(conversaId);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao enviar template", description: e.message, variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-whatsapp max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>
            Informe o telefone da cliente. Se o número já estiver no cadastro, o nome vem junto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="nova-conversa-telefone">Telefone</Label>
          <div className="flex gap-2">
            <Input
              id="nova-conversa-telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              onBlur={() => setTelefone(formatarTelefone(telefone) || telefone)}
              placeholder="(11) 94700-0895"
              inputMode="tel"
              onKeyDown={(e) => {
                if (e.key === "Enter" && telefoneValido && !buscando) continuar();
              }}
            />
            <Button onClick={continuar} disabled={!telefoneValido || buscando}>
              {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              <span className="ml-2">Continuar</span>
            </Button>
          </div>
          {nomeCliente && (
            <p className="text-xs text-muted-foreground">Cliente: {nomeCliente}</p>
          )}
        </div>

        {janelaAberta === false && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border-2 border-warning bg-warning/10 p-3">
              <Lock className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">
                Essa cliente não escreve há mais de 24h. Pela regra do WhatsApp, o primeiro contato
                precisa ser um template aprovado.
              </p>
            </div>

            {!escolhido ? (
              carregandoTemplates ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum template de primeiro contato aprovado disponível.
                </p>
              ) : (
                <div className="space-y-2">
                  {templates.map((t, i) => (
                    <Card
                      key={String(t.id ?? nomeTemplate(t) ?? i)}
                      className="p-3 cursor-pointer hover:border-primary transition-colors"
                      onClick={() => {
                        setEscolhido(t);
                        setValores({});
                      }}
                    >
                      <p className="font-medium text-sm">{nomeTemplate(t)}</p>
                      {(t.categoria || t.idioma) && (
                        <p className="text-xs text-muted-foreground">
                          {[t.categoria, t.idioma ?? "pt_BR"].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <p className="text-xs mt-1 whitespace-pre-wrap">{corpoTemplate(t)}</p>
                    </Card>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-3">
                <Button variant="ghost" size="sm" onClick={() => setEscolhido(null)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Trocar template
                </Button>
                {variaveis.map((n, i) => (
                  <div key={n} className="space-y-1">
                    <Label>{`Variável {{${n}}}`}</Label>
                    <Input
                      value={valores[n] ?? ""}
                      onChange={(e) => setValores((p) => ({ ...p, [n]: e.target.value }))}
                      placeholder={escolhido.variaveis_exemplo?.[i] ?? `Valor para {{${n}}}`}
                    />
                  </div>
                ))}
                <div className="rounded-md border border-border bg-muted p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Prévia</p>
                  <p className="text-sm whitespace-pre-wrap">{previa}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {janelaAberta === false && escolhido && (
          <DialogFooter>
            <Button onClick={enviarTemplate} disabled={enviando || faltando}>
              {enviando ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar template
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
