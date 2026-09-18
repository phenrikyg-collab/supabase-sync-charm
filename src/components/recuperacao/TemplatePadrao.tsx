import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

/* ============ Variáveis do template ============ */

export const ROTULOS_VARIAVEIS: Record<string, string> = {
  primeiro_nome: "Primeiro nome",
  id_pedido: "Número do pedido",
  valor: "Valor",
  link: "Link",
  produtos: "Produtos",
  rastreio: "Código de rastreio",
  endereco: "Endereço",
  cupom: "Cupom",
  validade: "Validade",
  valor_cashback: "Valor do cashback",
  valor_minimo: "Valor mínimo",
  email: "E-mail",
  prazo: "Prazo",
  data: "Data",
  situacao: "Situação",
  motivo: "Motivo",
};

export function rotuloLegivel(rotulo: string) {
  const conhecido = ROTULOS_VARIAVEIS[rotulo];
  if (conhecido) return conhecido;
  const texto = String(rotulo ?? "").replace(/_/g, " ").trim();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "Variável";
}

type Preenchimento = {
  ok?: boolean;
  template?: string;
  nomeados?: boolean;
  esperados?: number;
  rotulos?: string[];
  parametros?: string[];
  faltando?: string[];
};

/** Prévia com as variáveis trocadas pelos valores digitados e negrito do WhatsApp. */
function PreviaTemplate({
  corpo,
  rotulos,
  valores,
}: {
  corpo: string;
  rotulos: string[];
  valores: string[];
}) {
  const vazio = (i: number) =>
    `<span class="text-warning">[${rotuloLegivel(rotulos[i] ?? String(i + 1))}]</span>`;

  let html = corpo
    .replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string))
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_todo, chave: string) => {
      const indice = /^\d+$/.test(chave)
        ? Number(chave) - 1
        : rotulos.findIndex((r) => r === chave);
      if (indice < 0 || indice >= rotulos.length) return vazio(0);
      const valor = (valores[indice] ?? "").trim();
      return valor ? valor : vazio(indice);
    })
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");

  return (
    <div
      className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm leading-snug"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

async function detalharErroEnvio(error: any, data: any): Promise<string> {
  const corpo = (data ?? {}) as any;
  let codigo = corpo?.codigo ?? null;
  let mensagem = corpo?.mensagem ?? corpo?.error ?? null;

  if (!mensagem && error?.context) {
    try {
      const texto = await error.context.text();
      const json = JSON.parse(texto);
      codigo = json?.codigo ?? codigo;
      mensagem = json?.mensagem ?? json?.error ?? mensagem;
    } catch {
      /* corpo não veio em JSON */
    }
  }

  if (!mensagem) mensagem = "Não foi possível enviar a mensagem.";
  return codigo ? `${mensagem} (${codigo})` : String(mensagem);
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
  dados,
}: {
  telefone: string | null;
  nome: string | null;
  conversaId?: string | number | null;
  padrao: TemplateContexto | null;
  rotulo: string;
  contatada: boolean;
  onContatada: () => void;
  dados?: Record<string, string | number | null | undefined>;
}) {
  const [enviando, setEnviando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [preenchimento, setPreenchimento] = useState<Preenchimento | null>(null);
  const [valores, setValores] = useState<string[]>([]);

  if (!telefone) return null;

  const primeiro = () => {
    const limpo = String(nome ?? "").trim();
    if (!limpo || limpo.toLowerCase() === "desconhecido") return "tudo bem";
    return limpo.split(/\s+/)[0];
  };

  const rotulos = preenchimento?.rotulos ?? [];
  const faltando = preenchimento?.faltando ?? [];
  const esperados = preenchimento?.esperados ?? 0;
  const vazios = valores
    .map((v, i) => (String(v ?? "").trim() ? null : rotuloLegivel(rotulos[i] ?? String(i + 1))))
    .filter(Boolean) as string[];

  const revisar = async () => {
    if (!padrao?.nome) return;
    setAbrindo(true);
    try {
      const base: Record<string, string> = { primeiro_nome: primeiro() };
      for (const [k, v] of Object.entries(dados ?? {})) {
        if (v !== null && v !== undefined && String(v).trim()) base[k] = String(v);
      }
      const { data, error } = await chamarRpc("whatsapp_template_preencher" as any, {
        p_nome: padrao.nome,
        p_dados: base,
      });
      if (error) throw new Error(error.message);
      const r = (Array.isArray(data) ? data[0] : data) as Preenchimento;
      setPreenchimento(r ?? null);
      setValores((r?.parametros ?? []).map((p) => (String(p ?? "").trim() === "-" ? "" : String(p ?? ""))));
      setAberto(true);
    } catch (e: any) {
      toast.error("Não foi possível montar a mensagem", { description: e?.message });
    } finally {
      setAbrindo(false);
    }
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
          parametros: valores,
        },
      });
      if (error || (data as any)?.error) {
        throw new Error(await detalharErroEnvio(error, data));
      }
      toast.success("Template enviado");
      setAberto(false);
      onContatada();
    } catch (e: any) {
      toast.error("Falha ao enviar template", { description: e?.message, duration: 10000 });
    } finally {
      setEnviando(false);
    }
  };

  const dialogo = (
    <Dialog open={aberto} onOpenChange={(v) => !enviando && setAberto(v)}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto sm:w-full">
        <DialogHeader><DialogTitle>Revisar mensagem</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <PreviaTemplate corpo={String(padrao?.corpo_texto ?? "")} rotulos={rotulos} valores={valores} />

          {esperados > 0 &&
            rotulos.map((r, i) => {
              const atencao = faltando.includes(r) && !String(valores[i] ?? "").trim();
              return (
                <div key={`${r}-${i}`} className="space-y-1">
                  <Label className="text-xs">{rotuloLegivel(r)}</Label>
                  <Input
                    value={valores[i] ?? ""}
                    onChange={(e) =>
                      setValores((atual) => atual.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    className={atencao ? "border-warning focus-visible:ring-warning" : undefined}
                  />
                </div>
              );
            })}

          {vazios.length > 0 && (
            <p className="text-xs text-warning">Preencha: {vazios.join(", ")}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={enviar} disabled={enviando || vazios.length > 0}>
            {enviando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const botao = (
    <span className="inline-block">
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={enviando || abrindo || contatada || !padrao?.nome}
        onClick={revisar}
      >
        {abrindo || enviando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        {contatada ? "Já contatada" : rotulo}
      </Button>
      {dialogo}
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
