import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, ArrowLeft, Search, Star } from "lucide-react";
import { chamarRpc } from "@/lib/supabaseRpc";
import { useIsMobile } from "@/hooks/use-mobile";
import { BalaoWhats } from "@/components/whatsapp-marketing/nova-campanha/BalaoWhats";

type BotaoMeta = { type?: string; text?: string; url?: string };

type TemplateChat = {
  nome: string;
  categoria?: string | null;
  corpo?: string | null;
  rodape?: string | null;
  variaveis?: string[] | null;
  qtd_variaveis?: number | null;
  rotulos?: string[] | null;
  exemplos?: string[] | null;
  botoes?: BotaoMeta[] | null;
  precisa_url?: boolean | null;
  precisa_cupom?: boolean | null;
  precisa_imagem?: boolean | null;
  favorito?: boolean | null;
  sugestao_primeira_variavel?: string | null;
};

const semAcento = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const nomeLegivel = (n: string) => n.replace(/_/g, " ");

function rotuloVariavel(t: TemplateChat, i: number): string {
  const rotulo = t.rotulos?.[i];
  if (rotulo && rotulo.trim()) return nomeLegivel(rotulo);
  const nome = t.variaveis?.[i];
  if (nome && !/^\d+$/.test(String(nome))) return nomeLegivel(String(nome));
  return `Variável ${i + 1}`;
}

function preencher(corpo: string, t: TemplateChat, valores: string[]): string {
  let saida = corpo;
  (t.variaveis ?? []).forEach((nome, i) => {
    const valor = valores[i] || `{{${nome}}}`;
    saida = saida.split(`{{${nome}}}`).join(valor);
  });
  saida = saida.replace(/\{\{(\d+)\}\}/g, (_, n) => valores[Number(n) - 1] || `{{${n}}}`);
  return saida;
}

const ABAS = [
  { id: "favoritos", rotulo: "Favoritos" },
  { id: "todos", rotulo: "Todos" },
  { id: "utility", rotulo: "Utilidade" },
  { id: "marketing", rotulo: "Marketing" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

export function EnviarTemplateDialog({
  open,
  onOpenChange,
  telefone,
  conversaId,
  onEnviado,
  autor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  telefone: string | null | undefined;
  conversaId: number | string;
  onEnviado?: () => void;
  autor?: string | null;
}) {
  const ehCelular = useIsMobile();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<AbaId>("todos");
  const [escolhido, setEscolhido] = useState<TemplateChat | null>(null);
  const [valores, setValores] = useState<string[]>([]);
  const [finalLink, setFinalLink] = useState("");
  const [cupom, setCupom] = useState("");
  const [imagem, setImagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const chave = ["whatsapp-templates-chat", String(conversaId)];

  const { data: templates = [], isLoading } = useQuery({
    queryKey: chave,
    enabled: open,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_templates_chat" as any, {
        p_conversa_id: conversaId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as TemplateChat[];
    },
  });

  useEffect(() => {
    if (!open) return;
    setBusca("");
    setEscolhido(null);
  }, [open]);

  useEffect(() => {
    if (!open || isLoading) return;
    setAba(templates.some((t) => t.favorito) ? "favoritos" : "todos");
  }, [open, isLoading, templates]);

  const lista = useMemo(() => {
    const termo = semAcento(busca.trim());
    return templates.filter((t) => {
      const cat = (t.categoria ?? "").toUpperCase();
      if (aba === "favoritos" && !t.favorito) return false;
      if (aba === "utility" && cat !== "UTILITY") return false;
      if (aba === "marketing" && cat !== "MARKETING") return false;
      if (!termo) return true;
      return semAcento(`${t.nome} ${t.corpo ?? ""}`).includes(termo);
    });
  }, [templates, aba, busca]);

  const favoritar = async (t: TemplateChat) => {
    const novo = !t.favorito;
    queryClient.setQueryData<TemplateChat[]>(chave, (antigo) =>
      (antigo ?? []).map((x) => (x.nome === t.nome ? { ...x, favorito: novo } : x)),
    );
    const { error } = await chamarRpc("whatsapp_template_favoritar" as any, {
      p_nome: t.nome,
      p_favorito: novo,
    });
    if (error) {
      queryClient.setQueryData<TemplateChat[]>(chave, (antigo) =>
        (antigo ?? []).map((x) => (x.nome === t.nome ? { ...x, favorito: !novo } : x)),
      );
      toast({ title: "Não deu para salvar o favorito", variant: "destructive" });
    }
  };

  const escolher = (t: TemplateChat) => {
    const qtd = t.qtd_variaveis ?? (t.variaveis ?? []).length;
    const iniciais = Array.from({ length: qtd }, (_, i) => t.exemplos?.[i] ?? "");
    if (t.sugestao_primeira_variavel && qtd > 0) iniciais[0] = t.sugestao_primeira_variavel;
    setValores(iniciais);
    setFinalLink("");
    setCupom("");
    setImagem("");
    setEscolhido(t);
  };

  const qtdVars = escolhido ? escolhido.qtd_variaveis ?? (escolhido.variaveis ?? []).length : 0;
  const completo =
    !!escolhido &&
    valores.slice(0, qtdVars).every((v) => (v ?? "").trim()) &&
    (!escolhido.precisa_url || finalLink.trim()) &&
    (!escolhido.precisa_cupom || cupom.trim()) &&
    (!escolhido.precisa_imagem || imagem.trim());

  const previa = escolhido ? preencher(escolhido.corpo ?? "", escolhido, valores) : "";

  const enviar = async () => {
    if (!escolhido) return;
    if (!telefone) {
      toast({ title: "Conversa sem telefone", variant: "destructive" });
      return;
    }
    setEnviando(true);
    try {
      const { data: corpo, error } = await supabase.functions.invoke("whatsapp-enviar-template", {
        body: {
          telefone,
          conversa_id: conversaId,
          nome_template: escolhido.nome,
          parametros: valores.slice(0, qtdVars),
          ...(escolhido.precisa_url ? { parametro_botao_url: finalLink.trim() } : {}),
          ...(escolhido.precisa_cupom ? { parametro_cupom: cupom.trim() } : {}),
          ...(escolhido.precisa_imagem ? { cabecalho_imagem_url: imagem.trim() } : {}),
          usar_numero_da_conversa: true,
          enviado_por: autor ?? null,
        },
      });
      if (error || (corpo as any)?.error) {
        throw new Error(
          (corpo as any)?.mensagem || (corpo as any)?.error || error?.message || "Falha no envio",
        );
      }
      toast({ title: "Template enviado" });
      onEnviado?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao enviar template", description: e.message, variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  const conteudo = (
    <div className="space-y-3">
      {!escolhido ? (
        <>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou texto"
              className="pl-8"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {ABAS.map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant={aba === a.id ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => setAba(a.id)}
              >
                {a.rotulo}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum template encontrado.
            </p>
          ) : (
            <div className="space-y-2">
              {lista.map((t) => (
                <Card
                  key={t.nome}
                  className="flex cursor-pointer items-start gap-2 p-3 transition-colors hover:border-primary"
                  onClick={() => escolher(t)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{nomeLegivel(t.nome)}</p>
                      {t.categoria && (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {(t.categoria ?? "").toUpperCase() === "MARKETING" ? "Marketing" : "Utilidade"}
                        </Badge>
                      )}
                    </div>
                    {t.corpo && (
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                        {t.corpo}
                      </p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    title={t.favorito ? "Remover dos favoritos" : "Favoritar"}
                    onClick={(e) => {
                      e.stopPropagation();
                      void favoritar(t);
                    }}
                  >
                    <Star
                      className={
                        t.favorito ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4 text-muted-foreground"
                      }
                    />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setEscolhido(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Trocar template
          </Button>

          <BalaoWhats
            texto={[previa, escolhido.rodape].filter(Boolean).join("\n\n")}
            botoes={escolhido.botoes ?? []}
          />

          {Array.from({ length: qtdVars }, (_, i) => (
            <div key={i} className="space-y-1">
              <Label>{rotuloVariavel(escolhido, i)}</Label>
              <Input
                value={valores[i] ?? ""}
                onChange={(e) =>
                  setValores((p) => {
                    const novo = [...p];
                    novo[i] = e.target.value;
                    return novo;
                  })
                }
                placeholder={escolhido.exemplos?.[i] ?? rotuloVariavel(escolhido, i)}
              />
            </div>
          ))}

          {escolhido.precisa_url && (
            <div className="space-y-1">
              <Label>Final do link</Label>
              <Input value={finalLink} onChange={(e) => setFinalLink(e.target.value)} />
            </div>
          )}
          {escolhido.precisa_cupom && (
            <div className="space-y-1">
              <Label>Código do cupom</Label>
              <Input value={cupom} onChange={(e) => setCupom(e.target.value)} />
            </div>
          )}
          {escolhido.precisa_imagem && (
            <div className="space-y-1">
              <Label>Link da imagem</Label>
              <Input value={imagem} onChange={(e) => setImagem(e.target.value)} />
            </div>
          )}
        </div>
      )}
    </div>
  );

  const rodape = escolhido ? (
    <Button onClick={enviar} disabled={enviando || !completo} className="w-full sm:w-auto">
      {enviando ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Send className="mr-2 h-4 w-4" />
      )}
      Enviar template
    </Button>
  ) : null;

  if (ehCelular) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="font-whatsapp max-h-[88vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Enviar template</SheetTitle>
          </SheetHeader>
          <div className="py-2">{conteudo}</div>
          {rodape && <SheetFooter>{rodape}</SheetFooter>}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-whatsapp max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar template</DialogTitle>
        </DialogHeader>
        {conteudo}
        {rodape && <DialogFooter>{rodape}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
