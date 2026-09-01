import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Send, Loader2, X, Link2, AlertTriangle } from "lucide-react";
import {
  crmDestinosListar, botoesUrl, corpoTemUrl, removerUrlDoCorpo,
} from "@/lib/crmLinks";

type Template = {
  id: number | string;
  nome: string;
  categoria?: string | null;
  idioma?: string | null;
  corpo?: string | null;
  rodape?: string | null;
  botoes?: any;
  status_aprovacao?: string | null;
  motivo_rejeicao?: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  pendente: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  aprovado: "bg-green-500/15 text-green-700 dark:text-green-400",
  rejeitado: "bg-destructive/15 text-destructive",
};

export function StatusTemplateBadge({ status }: { status?: string | null }) {
  const s = (status ?? "rascunho").toLowerCase();
  return (
    <Badge variant="outline" className={STATUS_STYLE[s] ?? STATUS_STYLE.rascunho}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </Badge>
  );
}

const NOME_REGEX = /^[a-z0-9_]+$/;
const AVISO_CORPO_COM_URL =
  "A Meta reprova template que traz endereço escrito no texto e botão de link ao mesmo tempo. Tira o endereço do corpo.";

function NovoTemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("MARKETING");
  const [idioma, setIdioma] = useState("pt_BR");
  const [corpo, setCorpo] = useState("");
  const [rodape, setRodape] = useState("");
  const [exemplos, setExemplos] = useState<string[]>([""]);
  const [botaoAtivo, setBotaoAtivo] = useState(false);
  const [botaoTexto, setBotaoTexto] = useState("Ver na loja");
  const [botaoSlug, setBotaoSlug] = useState("");

  const { data: portas = [] } = useQuery({
    queryKey: ["crm-portas"],
    queryFn: crmDestinosListar,
    enabled: open,
  });

  const nomeInvalido = nome.length > 0 && !NOME_REGEX.test(nome);
  const portaEscolhida = portas.find((p) => p.slug === botaoSlug);
  const conflitoUrlCorpo = botaoAtivo && corpoTemUrl(corpo);

  const salvar = useMutation({
    mutationFn: async () => {
      const p_botoes = botaoAtivo && portaEscolhida?.url
        ? [{ type: "URL", text: botaoTexto, url: portaEscolhida.url }]
        : null;
      const { error } = await supabase.rpc("whatsapp_templates_salvar_rascunho" as any, {
        p_nome: nome,
        p_categoria: categoria,
        p_idioma: idioma,
        p_corpo: corpo,
        p_rodape: rodape || null,
        p_exemplos: exemplos.filter((e) => e.trim() !== ""),
        p_botoes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Rascunho salvo" });
      queryClient.invalidateQueries({ queryKey: ["wpp-templates"] });
      onOpenChange(false);
      setNome(""); setCorpo(""); setRodape(""); setExemplos([""]);
      setBotaoAtivo(false); setBotaoTexto("Ver na loja"); setBotaoSlug("");
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo template</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome técnico</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
              placeholder="reativacao_cliente_v1"
            />
            <p className={`text-xs mt-1 ${nomeInvalido ? "text-destructive" : "text-muted-foreground"}`}>
              Somente letras minúsculas, números e underline — sem espaços nem acentos.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">MARKETING</SelectItem>
                  <SelectItem value="UTILITY">UTILITY</SelectItem>
                  <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Idioma</Label>
              <Input value={idioma} onChange={(e) => setIdioma(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Corpo do texto</Label>
            <Textarea rows={5} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Use {"{{1}}"} para o primeiro nome do cliente (preenchido automaticamente no envio),
              {" "}{"{{2}}"}, {"{{3}}"} etc. para outras variáveis.
            </p>
            {conflitoUrlCorpo && (
              <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p className="text-xs">{AVISO_CORPO_COM_URL}</p>
                  <Button size="sm" variant="outline" onClick={() => setCorpo(removerUrlDoCorpo(corpo))}>
                    Remover do corpo
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
          <div>
            <Label>Exemplos das variáveis</Label>
            <div className="space-y-2 mt-1">
              {exemplos.map((ex, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={ex}
                    placeholder={`Exemplo para {{${i + 1}}}`}
                    onChange={(e) =>
                      setExemplos((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExemplos((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setExemplos((p) => [...p, ""])}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar exemplo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Obrigatório: a Meta usa os exemplos para avaliar o template.
            </p>
          </div>
          <div>
            <Label>Rodapé (opcional)</Label>
            <Input value={rodape} onChange={(e) => setRodape(e.target.value)} />
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <Label className="cursor-pointer">Botão de link (opcional)</Label>
              </div>
              <Switch checked={botaoAtivo} onCheckedChange={setBotaoAtivo} />
            </div>

            {botaoAtivo && (
              <div className="space-y-3">
                <div>
                  <Label>Texto do botão</Label>
                  <Input
                    value={botaoTexto}
                    maxLength={25}
                    onChange={(e) => setBotaoTexto(e.target.value.slice(0, 25))}
                    placeholder="Ver na loja"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{botaoTexto.length}/25 caracteres</p>
                </div>
                <div>
                  <Label>Porta</Label>
                  <Select value={botaoSlug} onValueChange={setBotaoSlug}>
                    <SelectTrigger><SelectValue placeholder="Selecione a porta" /></SelectTrigger>
                    <SelectContent>
                      {portas.map((p) => (
                        <SelectItem key={p.slug} value={p.slug}>
                          <span className="flex flex-col items-start">
                            <span>{p.nome || p.slug}</span>
                            <span className="text-[11px] text-muted-foreground">{p.url}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {portas.length === 0 && (
                    <p className="text-xs text-destructive mt-1">
                      Nenhuma porta cadastrada. Crie uma na aba Portas antes de usar botão de link.
                    </p>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Essa URL é fixa e aprovada uma vez só. Cada campanha escolhe para onde ela vai
              apontar, sem precisar de template novo.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => salvar.mutate()}
            disabled={
              !nome || nomeInvalido || !corpo || salvar.isPending ||
              (botaoAtivo && (!botaoTexto.trim() || !botaoSlug))
            }
          >
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesWppTab() {
  const queryClient = useQueryClient();
  const [novo, setNovo] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["wpp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_templates_listar" as any);
      if (error) throw error;
      return (data ?? []) as Template[];
    },
    refetchInterval: 60_000,
  });

  const submeter = useMutation({
    mutationFn: async (template_id: number | string) => {
      const { error } = await supabase.functions.invoke("whatsapp-submeter-template", {
        body: { template_id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Enviado para aprovação",
        description: "A Meta pode levar de horas a poucos dias. O status atualiza sozinho.",
      });
      queryClient.invalidateQueries({ queryKey: ["wpp-templates"] });
    },
    onError: (e: any) => toast({ title: "Erro ao submeter", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNovo(true)}><Plus className="h-4 w-4 mr-2" /> Novo template</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhum template criado ainda.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => <TemplateCard key={t.id} t={t} submeter={submeter} />)}
        </div>
      )}

      <NovoTemplateDialog open={novo} onOpenChange={setNovo} />
    </div>
  );
}

function TemplateCard({ t, submeter }: { t: Template; submeter: any }) {
  const status = (t.status_aprovacao ?? "rascunho").toLowerCase();
  const botoes = useMemo(() => botoesUrl(t.botoes), [t.botoes]);
  const bloqueado = botoes.length > 0 && corpoTemUrl(t.corpo ?? "");

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{t.nome}</p>
          <p className="text-xs text-muted-foreground">{t.categoria} · {t.idioma ?? "pt_BR"}</p>
        </div>
        <StatusTemplateBadge status={status} />
      </div>
      {t.corpo && <p className="text-sm whitespace-pre-wrap">{t.corpo}</p>}
      {t.rodape && <p className="text-xs text-muted-foreground">{t.rodape}</p>}
      {botoes.map((b, i) => (
        <div key={i} className="rounded-md border border-dashed p-2">
          <p className="text-sm flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> {b.text}</p>
          <p className="text-[11px] text-muted-foreground font-mono break-all">{b.url}</p>
        </div>
      ))}
      {t.motivo_rejeicao && <p className="text-xs text-destructive">Motivo: {t.motivo_rejeicao}</p>}

      {bloqueado && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">{AVISO_CORPO_COM_URL}</AlertDescription>
        </Alert>
      )}

      {(status === "rascunho" || status === "rejeitado") && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => submeter.mutate(t.id)}
          disabled={submeter.isPending || bloqueado}
        >
          <Send className="h-4 w-4 mr-2" /> Enviar para aprovação
        </Button>
      )}
    </Card>
  );
}
