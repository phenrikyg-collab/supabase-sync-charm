import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, ArrowLeft } from "lucide-react";

type Template = {
  id: number | string;
  nome: string;
  categoria?: string | null;
  idioma?: string | null;
  corpo?: string | null;
  exemplo_variaveis?: string[] | null;
  status_aprovacao?: string | null;
};

const ENDPOINT =
  "https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/whatsapp-enviar-template";

function variaveisDoCorpo(corpo?: string | null): number[] {
  if (!corpo) return [];
  const encontrados = new Set<number>();
  for (const m of corpo.matchAll(/\{\{(\d+)\}\}/g)) encontrados.add(Number(m[1]));
  return [...encontrados].sort((a, b) => a - b);
}

export function EnviarTemplateDialog({
  open,
  onOpenChange,
  telefone,
  conversaId,
  onEnviado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  telefone: string | null | undefined;
  conversaId: number | string;
  onEnviado?: () => void;
}) {
  const [escolhido, setEscolhido] = useState<Template | null>(null);
  const [valores, setValores] = useState<Record<number, string>>({});
  const [enviando, setEnviando] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["wpp-templates-aprovados"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_templates_listar" as any);
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const aprovados = useMemo(
    () => templates.filter((t) => (t.status_aprovacao ?? "").toLowerCase() === "aprovado"),
    [templates],
  );

  const variaveis = variaveisDoCorpo(escolhido?.corpo);
  const faltando = variaveis.some((n) => !(valores[n] ?? "").trim());

  const fechar = (v: boolean) => {
    if (!v) {
      setEscolhido(null);
      setValores({});
    }
    onOpenChange(v);
  };

  const enviar = async () => {
    if (!escolhido) return;
    if (!telefone) {
      toast({ title: "Conversa sem telefone", variant: "destructive" });
      return;
    }
    setEnviando(true);
    try {
      const resposta = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone,
          conversa_id: conversaId,
          nome_template: escolhido.nome,
          parametros: variaveis.map((n) => valores[n] ?? ""),
        }),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok || corpo?.error) {
        throw new Error(corpo?.error || corpo?.mensagem || `Falha no envio (${resposta.status})`);
      }
      toast({ title: "Template enviado" });
      onEnviado?.();
      fechar(false);
    } catch (e: any) {
      toast({ title: "Erro ao enviar template", description: e.message, variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  const preview = escolhido?.corpo
    ? escolhido.corpo.replace(/\{\{(\d+)\}\}/g, (_, n) => valores[Number(n)] || `{{${n}}}`)
    : "";

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar template aprovado</DialogTitle>
        </DialogHeader>

        {!escolhido ? (
          isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : aprovados.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum template aprovado disponível. Crie e envie para aprovação em Marketing WhatsApp.
            </p>
          ) : (
            <div className="space-y-2">
              {aprovados.map((t) => (
                <Card
                  key={String(t.id)}
                  className="p-3 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    setEscolhido(t);
                    setValores({});
                  }}
                >
                  <p className="font-medium text-sm">{t.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.categoria} · {t.idioma ?? "pt_BR"}
                  </p>
                  {t.corpo && (
                    <p className="text-xs mt-1 whitespace-pre-wrap line-clamp-3">{t.corpo}</p>
                  )}
                </Card>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setEscolhido(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Trocar template
            </Button>

            {variaveis.map((n, i) => (
              <div key={n}>
                <Label>{`Variável {{${n}}}`}</Label>
                <Input
                  value={valores[n] ?? ""}
                  onChange={(e) => setValores((p) => ({ ...p, [n]: e.target.value }))}
                  placeholder={escolhido.exemplo_variaveis?.[i] ?? `Valor para {{${n}}}`}
                />
              </div>
            ))}

            <div className="rounded-md border border-border bg-muted p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Prévia</p>
              <p className="text-sm whitespace-pre-wrap">{preview}</p>
            </div>
          </div>
        )}

        {escolhido && (
          <DialogFooter>
            <Button onClick={enviar} disabled={enviando || faltando}>
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
