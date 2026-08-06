import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Send, Loader2, X } from "lucide-react";

type Template = {
  id: number | string;
  nome: string;
  categoria?: string | null;
  idioma?: string | null;
  corpo?: string | null;
  rodape?: string | null;
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

function NovoTemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("MARKETING");
  const [idioma, setIdioma] = useState("pt_BR");
  const [corpo, setCorpo] = useState("");
  const [rodape, setRodape] = useState("");
  const [exemplos, setExemplos] = useState<string[]>([""]);

  const nomeInvalido = nome.length > 0 && !NOME_REGEX.test(nome);

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("whatsapp_templates_salvar_rascunho" as any, {
        p_nome: nome,
        p_categoria: categoria,
        p_idioma: idioma,
        p_corpo: corpo,
        p_rodape: rodape || null,
        p_exemplos: exemplos.filter((e) => e.trim() !== ""),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Rascunho salvo" });
      queryClient.invalidateQueries({ queryKey: ["wpp-templates"] });
      onOpenChange(false);
      setNome(""); setCorpo(""); setRodape(""); setExemplos([""]);
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
        </div>
        <DialogFooter>
          <Button
            onClick={() => salvar.mutate()}
            disabled={!nome || nomeInvalido || !corpo || salvar.isPending}
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
          {templates.map((t) => {
            const status = (t.status_aprovacao ?? "rascunho").toLowerCase();
            return (
              <Card key={t.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.categoria} · {t.idioma ?? "pt_BR"}
                    </p>
                  </div>
                  <StatusTemplateBadge status={status} />
                </div>
                {t.corpo && <p className="text-sm whitespace-pre-wrap">{t.corpo}</p>}
                {t.rodape && <p className="text-xs text-muted-foreground">{t.rodape}</p>}
                {t.motivo_rejeicao && (
                  <p className="text-xs text-destructive">Motivo: {t.motivo_rejeicao}</p>
                )}
                {(status === "rascunho" || status === "rejeitado") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => submeter.mutate(t.id)}
                    disabled={submeter.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" /> Enviar para aprovação
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <NovoTemplateDialog open={novo} onOpenChange={setNovo} />
    </div>
  );
}
