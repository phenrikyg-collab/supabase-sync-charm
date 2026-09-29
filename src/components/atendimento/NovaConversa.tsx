import { useEffect, useMemo, useRef, useState } from "react";
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
import { Loader2, Send, ArrowLeft, Lock, MessageCircle, Search } from "lucide-react";
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
  corpo_texto?: string | null;
  variaveis_exemplo?: string[] | null;
};

const nomeTemplate = (t: TemplatePrimeiroContato) => t.nome_template ?? t.nome ?? "";
const corpoTemplate = (t: TemplatePrimeiroContato) => t.corpo_texto ?? t.corpo ?? t.body ?? "";

/** Minúsculas, sem acento e com espaço e underline equivalentes, para a busca */
const normalizar = (v?: string | null) =>
  (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ");

const ORDEM_CATEGORIA: Record<string, number> = { UTILITY: 0, MARKETING: 1 };

/** UTILITY primeiro, depois MARKETING; dentro de cada categoria, por nome */
const ordenarTemplates = (lista: TemplatePrimeiroContato[]) =>
  [...lista].sort((a, b) => {
    const oa = ORDEM_CATEGORIA[(a.categoria ?? "").toUpperCase()] ?? 2;
    const ob = ORDEM_CATEGORIA[(b.categoria ?? "").toUpperCase()] ?? 2;
    if (oa !== ob) return oa - ob;
    return nomeTemplate(a).localeCompare(nomeTemplate(b), "pt-BR");
  });

/** Primeira linha com conteúdo do texto, cortada para caber no card */
const primeiraLinha = (texto?: string | null) => {
  const linha = String(texto ?? "").split("\n").find((l) => l.trim()) ?? "";
  return linha.length > 90 ? `${linha.slice(0, 90).trimEnd()}...` : linha;
};

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
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "utility" | "marketing">("todos");
  const inputBuscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTelefone(formatarTelefone(telefoneInicial) || "");
      setConversaId(null);
      setNomeCliente(null);
      setJanelaAberta(null);
      setEscolhido(null);
      setValores({});
      setBusca("");
      setFiltro("todos");
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

  /** Foco automático no campo de busca quando a lista aparece */
  useEffect(() => {
    if (open && janelaAberta === false && !carregandoTemplates) {
      inputBuscaRef.current?.focus();
    }
  }, [open, janelaAberta, carregandoTemplates]);

  const ordenados = useMemo(() => ordenarTemplates(templates), [templates]);

  const contagem = useMemo(() => {
    const utility = ordenados.filter((t) => (t.categoria ?? "").toUpperCase() === "UTILITY").length;
    const marketing = ordenados.filter((t) => (t.categoria ?? "").toUpperCase() === "MARKETING").length;
    return { todos: ordenados.length, utility, marketing };
  }, [ordenados]);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca).trim();
    return ordenados.filter((t) => {
      const cat = (t.categoria ?? "").toUpperCase();
      if (filtro === "utility" && cat !== "UTILITY") return false;
      if (filtro === "marketing" && cat !== "MARKETING") return false;
      if (!termo) return true;
      const alvo = `${normalizar(nomeTemplate(t))} ${normalizar(corpoTemplate(t))}`;
      return alvo.includes(termo);
    });
  }, [ordenados, filtro, busca]);

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
      <DialogContent className="font-whatsapp flex max-h-[85vh] flex-col overflow-hidden max-w-lg">
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
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-start gap-2 rounded-md border-2 border-warning bg-warning/10 p-3">
              <Lock className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">
                Essa cliente não escreve há mais de 24h. Pela regra do WhatsApp, o primeiro contato
                precisa ser um template aprovado.
              </p>
            </div>

            {!escolhido && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={inputBuscaRef}
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar template"
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { chave: "todos", rotulo: "Todos", n: contagem.todos },
                      { chave: "utility", rotulo: "Utilidade", n: contagem.utility },
                      { chave: "marketing", rotulo: "Marketing", n: contagem.marketing },
                    ] as const
                  ).map((c) => (
                    <Button
                      key={c.chave}
                      size="sm"
                      variant={filtro === c.chave ? "default" : "outline"}
                      className="h-7 rounded-full px-3 text-xs"
                      onClick={() => setFiltro(c.chave)}
                    >
                      {c.rotulo} ({c.n})
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{filtrados.length} templates</p>
              </div>
            )}

            {!escolhido ? (
              carregandoTemplates ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : filtrados.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum template com esse nome ou texto
                </p>
              ) : (
                <div className="-mx-1 min-h-0 flex-1 space-y-2 overflow-y-auto px-1 pb-1">
                  {filtrados.map((t, i) => (
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
                      <p className="mt-1 truncate text-xs text-muted-foreground">{primeiraLinha(corpoTemplate(t))}</p>
                    </Card>
                  ))}
                </div>
              )
            ) : (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
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
