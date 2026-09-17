import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useAbrirConversa } from "@/lib/abrirConversa";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Loader2, MessageCircle, Globe, Sparkles, Download, Search, Upload, Send, RefreshCw, FilterX,
} from "lucide-react";

const SUPABASE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co";

const COLUNAS: { status: string; titulo: string; proximo?: string }[] = [
  { status: "provou", titulo: "Provou", proximo: "em_contato" },
  { status: "em_contato", titulo: "Em Contato", proximo: "convertido" },
  { status: "convertido", titulo: "Convertido" },
];

function tempoDesde(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function CanalIcone({ canal }: { canal: string | null }) {
  if (canal === "whatsapp") return <MessageCircle className="h-3.5 w-3.5 text-success" />;
  if (canal === "site") return <Globe className="h-3.5 w-3.5 text-info" />;
  return <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />;
}



type Lead = {
  id: string;
  nome: string | null;
  telefone: string | null;
  produto_id: string | null;
  produto_nome: string | null;
  status_funil: string | null;
  canal: string | null;
  foto_resultado_url: string | null;
  criado_em: string;
  tray_customer_id: string | number | null;
  tamanho_indicado?: string | null;
  temperatura?: "checkout" | "carrinho" | "comprou" | "respondeu" | "provou" | string | null;
  score?: number | null;
  carrinho_status?: string | null;
  carrinho_valor?: number | null;
  carrinho_itens?: unknown;
  checkout_em?: string | null;
  houve_contato?: boolean | null;
  houve_contato_humano?: boolean | null;
  ultima_saida?: string | null;
  conversa_id?: string | number | null;
  ultima_entrada?: string | null;
  conversa_status?: string | null;
  conversa_nao_lida?: boolean | null;
  conversa_aberta?: boolean | null;
  template_enviado_em?: string | null;
  template_entrega?: string | null;
  template_nome?: string | null;
  msgs_saida?: number | null;
  msgs_entrada?: number | null;
  ultima_msg_em?: string | null;
  ultima_msg_texto?: string | null;

};

/** Abre a conversa no painel; quando vem texto, ele entra pronto no campo de mensagem. */
export type AbrirConversaProvador = (
  conversaId: string,
  texto?: string,
  leadId?: string,
) => void;

const brlProvador = (v?: number | null) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function BadgeTemperatura({ lead }: { lead: Lead }) {
  const t = (lead.temperatura ?? "").toLowerCase();
  const mapa: Record<string, { texto: string; classe: string }> = {
    checkout: { texto: "Chegou no checkout", classe: "border-danger/30 bg-danger/10 text-danger" },
    carrinho: {
      texto: `Está no carrinho (${brlProvador(lead.carrinho_valor)})`,
      classe: "border-warning/30 bg-warning/10 text-warning",
    },
    comprou: { texto: "Comprou", classe: "border-success/30 bg-success/10 text-success" },
    respondeu: { texto: "Respondeu", classe: "border-info/30 bg-info/10 text-info" },
    provou: { texto: "Só provou", classe: "border-border bg-muted text-muted-foreground" },
  };
  const m = mapa[t];
  if (!m) return null;
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", m.classe)}>
      {m.texto}
    </span>
  );
}

function tempoRel(iso?: string | null) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

function primeiroNome(nome?: string | null) {
  return (nome || "").trim().split(/\s+/)[0] || "cliente";
}

function textoPrevia(lead: Lead) {
  const tamanho = lead.tamanho_indicado?.trim() || "vamos descobrir juntas por aqui";
  return (
    `Oi ${primeiroNome(lead.nome)}! Sua prova virtual da ${lead.produto_nome || "peça"} está pronta, é a imagem acima.\n\n` +
    `Tamanho indicado: ${tamanho}.\n\n` +
    `Qualquer dúvida sobre a peça ou o tamanho, é só responder por aqui.`
  );
}

const CHIP = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold";

function ChipsSinal({ lead }: { lead: Lead }) {
  const chips: { chave: string; texto: string; classe: string; ponto?: boolean }[] = [];

  if (lead.conversa_aberta) {
    const emAtendimento = lead.conversa_status === "em_atendimento" || lead.conversa_status === "escalado";
    chips.push({
      chave: "conversa",
      texto: emAtendimento ? "Em atendimento" : "Conversa aberta",
      classe: "border-success/30 bg-success/10 text-success",
      ponto: !!lead.conversa_nao_lida,
    });
  }
  if (lead.ultima_entrada) {
    chips.push({
      chave: "respondeu",
      texto: `Respondeu ${tempoRel(lead.ultima_entrada)}`,
      classe: "border-info/30 bg-info/10 text-info",
    });
  }
  if (lead.template_enviado_em) {
    if (lead.template_entrega === "falhou") {
      chips.push({
        chave: "prova",
        texto: "Prova não entregue",
        classe: "border-danger/40 bg-danger/10 text-danger",
      });
    } else if (lead.template_entrega === "lido") {
      chips.push({
        chave: "prova",
        texto: `Prova lida ${tempoRel(lead.template_enviado_em)}`,
        classe: "border-primary/40 bg-primary/10 text-primary",
      });
    } else if (lead.template_entrega === "entregue") {
      chips.push({
        chave: "prova",
        texto: `Prova entregue ${tempoRel(lead.template_enviado_em)}`,
        classe: "border-primary/40 bg-primary/10 text-primary",
      });
    } else {
      chips.push({
        chave: "prova",
        texto: `Prova enviada ${tempoRel(lead.template_enviado_em)}`,
        classe: "border-primary/40 bg-primary/10 text-primary",
      });
    }
  }
  if (lead.houve_contato && !lead.template_enviado_em) {
    chips.push({
      chave: "contato",
      texto: `Já recebeu mensagem ${tempoRel(lead.ultima_saida)}`.trim(),
      classe: "border-border bg-muted text-muted-foreground",
    });
  }
  if (chips.length === 0) {
    chips.push({ chave: "sem", texto: "Sem contato", classe: "border-border bg-muted text-muted-foreground" });
  }

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span key={c.chave} className={cn(CHIP, c.classe)}>
          {c.ponto && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
          {c.texto}
        </span>
      ))}
    </div>
  );
}
/* ---------------- Filtros do funil ---------------- */

type PeriodoFunil = "todos" | "hoje" | "7" | "30";
type ContatoFunil = "todos" | "sem_contato" | "prova_enviada" | "nao_entregue" | "respondeu" | "conversa_aberta";

type FiltrosFunil = {
  busca: string;
  periodo: PeriodoFunil;
  temperaturas: string[];
  contato: ContatoFunil;
  peca: string;
  tamanho: string;
};

const FILTROS_PADRAO: FiltrosFunil = {
  busca: "",
  periodo: "todos",
  temperaturas: [],
  contato: "todos",
  peca: "todas",
  tamanho: "todos",
};

const CHAVE_FILTROS_FUNIL = "provador_funil_filtros";

function lerFiltrosSalvos(): FiltrosFunil {
  try {
    const raw = window.localStorage.getItem(CHAVE_FILTROS_FUNIL);
    if (!raw) return FILTROS_PADRAO;
    const salvo = JSON.parse(raw);
    return {
      busca: typeof salvo.busca === "string" ? salvo.busca : "",
      periodo: ["todos", "hoje", "7", "30"].includes(salvo.periodo) ? salvo.periodo : "todos",
      temperaturas: Array.isArray(salvo.temperaturas) ? salvo.temperaturas.filter((t: unknown) => typeof t === "string") : [],
      contato: ["todos", "sem_contato", "prova_enviada", "nao_entregue", "respondeu", "conversa_aberta"].includes(salvo.contato) ? salvo.contato : "todos",
      peca: typeof salvo.peca === "string" ? salvo.peca : "todas",
      tamanho: typeof salvo.tamanho === "string" ? salvo.tamanho : "todos",
    };
  } catch {
    return FILTROS_PADRAO;
  }
}

function filtrosAtivos(f: FiltrosFunil) {
  return (
    f.busca.trim() !== "" ||
    f.periodo !== "todos" ||
    f.temperaturas.length > 0 ||
    f.contato !== "todos" ||
    f.peca !== "todas" ||
    f.tamanho !== "todos"
  );
}

function passaPeriodo(iso: string, periodo: PeriodoFunil) {
  if (periodo === "todos") return true;
  const data = new Date(iso).getTime();
  if (periodo === "hoje") {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return data >= hoje.getTime();
  }
  const dias = periodo === "7" ? 7 : 30;
  return data >= Date.now() - dias * 24 * 3600 * 1000;
}

function passaContato(lead: Lead, contato: ContatoFunil) {
  switch (contato) {
    case "todos": return true;
    case "sem_contato": return !lead.houve_contato && !lead.template_enviado_em;
    case "prova_enviada": return !!lead.template_enviado_em;
    case "nao_entregue": return lead.template_entrega === "falhou";
    case "respondeu": return !!lead.ultima_entrada;
    case "conversa_aberta": return !!lead.conversa_aberta;
  }
}

function filtrarLeads(leads: Lead[], f: FiltrosFunil) {
  const busca = f.busca.trim().toLowerCase();
  const buscaDigitos = f.busca.replace(/\D/g, "");
  return leads.filter((lead) => {
    if (busca) {
      const nome = (lead.nome || "").toLowerCase();
      const peca = (lead.produto_nome || "").toLowerCase();
      const telDigitos = (lead.telefone || "").replace(/\D/g, "");
      const bateu =
        nome.includes(busca) ||
        peca.includes(busca) ||
        (buscaDigitos.length > 0 && telDigitos.includes(buscaDigitos));
      if (!bateu) return false;
    }
    if (!passaPeriodo(lead.criado_em, f.periodo)) return false;
    if (f.temperaturas.length > 0 && !f.temperaturas.includes((lead.temperatura ?? "").toLowerCase())) return false;
    if (!passaContato(lead, f.contato)) return false;
    if (f.peca !== "todas" && (lead.produto_nome || "") !== f.peca) return false;
    if (f.tamanho !== "todos") {
      const t = (lead.tamanho_indicado || "").trim().toUpperCase();
      if (f.tamanho === "sem") {
        if (t !== "") return false;
      } else if (t !== f.tamanho) return false;
    }
    return true;
  });
}

function ChipFiltro({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
        ativo
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

const OPCOES_PERIODO: { valor: PeriodoFunil; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "7", rotulo: "7 dias" },
  { valor: "30", rotulo: "30 dias" },
  { valor: "todos", rotulo: "Todos" },
];

const OPCOES_TEMPERATURA: { valor: string; rotulo: string }[] = [
  { valor: "checkout", rotulo: "Checkout" },
  { valor: "carrinho", rotulo: "Carrinho" },
  { valor: "respondeu", rotulo: "Respondeu" },
  { valor: "comprou", rotulo: "Comprou" },
  { valor: "provou", rotulo: "Provou" },
];

const OPCOES_CONTATO: { valor: ContatoFunil; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "sem_contato", rotulo: "Sem contato" },
  { valor: "prova_enviada", rotulo: "Prova enviada" },
  { valor: "nao_entregue", rotulo: "Não entregue" },
  { valor: "respondeu", rotulo: "Respondeu" },
  { valor: "conversa_aberta", rotulo: "Conversa aberta" },
];

const OPCOES_TAMANHO = ["PP", "P", "M", "G", "GG", "EG"];

function FunilLeads({
  onAbrirConversa,
  onContagem,
}: {
  onAbrirConversa?: AbrirConversaProvador;
  onContagem?: (n: number) => void;
}) {
  const qc = useQueryClient();
  const abrirConversa = useAbrirConversa(onAbrirConversa);
  const [filtros, setFiltros] = useState<FiltrosFunil>(lerFiltrosSalvos);
  const [fotoAberta, setFotoAberta] = useState<string | null>(null);
  const [preparando, setPreparando] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [leadEnvio, setLeadEnvio] = useState<Lead | null>(null);
  const [conflito, setConflito] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["provador-leads"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("provador_listar_leads");
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  const { data: templateAprovado = false } = useQuery({
    queryKey: ["provador-template-status"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("provador_template_status");
        if (error) return false;
        return (data as any)?.aprovado === true;
      } catch {
        return false;
      }
    },
  });

  async function abrirChat(lead: Lead) {
    if (lead.conversa_id) {
      abrirConversa(lead.conversa_id);
      return;
    }
    if (!lead.telefone) {
      toast.error("Esta cliente não tem telefone cadastrado");
      return;
    }
    setAbrindo(lead.id);
    try {
      const { data, error } = await (supabase as any).rpc("whatsapp_get_or_create_conversa", {
        p_telefone: lead.telefone,
      });
      if (error) throw error;
      const conversa = Array.isArray(data) ? data[0] : data;
      const conversaId = conversa?.id;
      if (!conversaId) throw new Error("Não foi possível abrir a conversa");
      await (supabase as any).rpc("provador_registrar_contato", {
        p_id: lead.id,
        p_conversa_id: conversaId,
      });
      qc.invalidateQueries({ queryKey: ["provador-leads"] });
      abrirConversa(conversaId);
    } catch (e: any) {
      toast.error(e.message || "Não foi possível abrir a conversa");
    } finally {
      setAbrindo(null);
    }
  }

  async function enviarProva(lead: Lead, forcar: boolean) {
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("provador-enviar-template", {
        body: forcar ? { prova_id: lead.id, forcar: true } : { prova_id: lead.id },
      });
      if (error) {
        let corpo: any = null;
        try {
          corpo = await (error as any)?.context?.json?.();
        } catch {
          corpo = null;
        }
        if (corpo?.error === "ja_enviado") {
          setConflito(corpo.mensagem || "Esta prova já foi enviada para a cliente.");
          return;
        }
        if (corpo?.error === "bloqueada") {
          toast.error(corpo.mensagem || "Envio bloqueado: verifique o número da cliente.");
          return;
        }
        toast.error(corpo?.mensagem || error.message || "Não foi possível enviar", {
          description: corpo?.detalhe,
        });
        return;
      }
      if ((data as any)?.ok === false) {
        toast.error((data as any)?.mensagem || "Não foi possível enviar", {
          description: (data as any)?.detalhe,
        });
        return;
      }
      toast.success(`Prova enviada para ${lead.nome || "a cliente"}`);
      setLeadEnvio(null);
      setConflito(null);
      qc.invalidateQueries({ queryKey: ["provador-leads"] });
    } catch (e: any) {
      toast.error(e.message || "Não foi possível enviar");
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => { onContagem?.(leads.length); }, [leads.length, onContagem]);



  const mover = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).rpc("provador_atualizar_status_funil", {
        p_id: id,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead movido");
      qc.invalidateQueries({ queryKey: ["provador-leads"] });
    },
    onError: (e: any) => toast.error(e.message || "Não foi possível mover o lead"),
  });

  async function mensagemPronta(lead: Lead) {
    setPreparando(lead.id);
    try {
      const { data, error } = await (supabase as any).rpc("provador_texto_abordagem", { p_id: lead.id });
      if (error) throw error;
      const texto = typeof data === "string" ? data : data?.texto ?? String(data ?? "");
      if (!texto.trim()) throw new Error("A mensagem veio vazia");
      if (lead.conversa_id) {
        abrirConversa(lead.conversa_id, texto, lead.id);
      } else {
        await navigator.clipboard.writeText(texto);
        toast.success("Mensagem copiada. Esta cliente ainda não tem conversa aberta.");
      }
    } catch (e: any) {
      toast.error(e.message || "Não foi possível montar a mensagem");
    } finally {
      setPreparando(null);
    }
  }

  // A RPC já devolve ordenada por score: mantemos a ordem recebida dentro de cada coluna.
  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE_FILTROS_FUNIL, JSON.stringify(filtros));
    } catch {
      // sem localStorage disponível: segue sem persistir
    }
  }, [filtros]);

  const pecasDisponiveis = useMemo(() => {
    const conjunto = new Set<string>();
    for (const l of leads) {
      const nome = (l.produto_nome || "").trim();
      if (nome) conjunto.add(nome);
    }
    return Array.from(conjunto).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [leads]);

  const leadsFiltrados = useMemo(() => filtrarLeads(leads, filtros), [leads, filtros]);

  const porStatus = useMemo(() => {
    const mapa: Record<string, Lead[]> = { provou: [], em_contato: [], convertido: [] };
    for (const l of leadsFiltrados) {
      const s = (l.status_funil || "provou").toLowerCase();
      (mapa[s] ??= []).push(l);
    }
    return mapa;
  }, [leadsFiltrados]);

  const temFiltroAtivo = filtrosAtivos(filtros);

  function alternarTemperatura(valor: string) {
    setFiltros((f) => ({
      ...f,
      temperaturas: f.temperaturas.includes(valor)
        ? f.temperaturas.filter((t) => t !== valor)
        : [...f.temperaturas, valor],
    }));
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 space-y-2 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filtros.busca}
              onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
              placeholder="Nome, telefone ou peça"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {OPCOES_PERIODO.map((op) => (
              <ChipFiltro
                key={op.valor}
                ativo={filtros.periodo === op.valor}
                onClick={() => setFiltros((f) => ({ ...f, periodo: op.valor }))}
              >
                {op.rotulo}
              </ChipFiltro>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {leadsFiltrados.length} de {leads.length} leads
          </span>
          {temFiltroAtivo && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => setFiltros(FILTROS_PADRAO)}
            >
              <FilterX className="mr-1 h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {OPCOES_TEMPERATURA.map((op) => (
            <ChipFiltro
              key={op.valor}
              ativo={filtros.temperaturas.includes(op.valor)}
              onClick={() => alternarTemperatura(op.valor)}
            >
              {op.rotulo}
            </ChipFiltro>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
          {OPCOES_CONTATO.map((op) => (
            <ChipFiltro
              key={op.valor}
              ativo={filtros.contato === op.valor}
              onClick={() => setFiltros((f) => ({ ...f, contato: op.valor }))}
            >
              {op.rotulo}
            </ChipFiltro>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
          <Select
            value={filtros.peca}
            onValueChange={(v) => setFiltros((f) => ({ ...f, peca: v }))}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Peça" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as peças</SelectItem>
              {pecasDisponiveis.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filtros.tamanho}
            onValueChange={(v) => setFiltros((f) => ({ ...f, tamanho: v }))}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="Tamanho" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tamanhos</SelectItem>
              {OPCOES_TAMANHO.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
              <SelectItem value="sem">Sem tamanho</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {COLUNAS.map((col) => {
          const itens = porStatus[col.status] ?? [];
          return (
            <div key={col.status} className="rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold">{col.titulo}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {itens.length}
                </span>
              </div>
              <div className="space-y-3 p-3">
                {itens.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lead</p>
                )}
                {itens.map((lead) => {
                  const antigo =
                    col.status === "provou" &&
                    !lead.tray_customer_id &&
                    !lead.telefone &&
                    Date.now() - new Date(lead.criado_em).getTime() > 24 * 3600 * 1000;
                  return (
                    <div
                      key={lead.id}
                      className={cn(
                        "rounded-lg border bg-background p-3 transition-shadow hover:shadow-md",
                        antigo && "border-warning/70"
                      )}
                    >
                      <button
                        type="button"
                        className="flex w-full gap-3 text-left"
                        onClick={() => lead.foto_resultado_url && setFotoAberta(lead.foto_resultado_url)}
                      >
                        {lead.foto_resultado_url ? (
                          <img
                            src={lead.foto_resultado_url}
                            alt={`Prova virtual de ${lead.nome || "cliente"}`}
                            loading="lazy"
                            className="h-20 w-16 flex-shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-16 flex-shrink-0 items-center justify-center rounded bg-muted">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate text-sm font-semibold">{lead.nome || "Sem nome"}</p>
                          <p className="truncate text-xs text-muted-foreground">{lead.telefone || "sem telefone"}</p>
                          <ChipsSinal lead={lead} />
                          {lead.ultima_msg_texto && (
                            <p className="truncate text-[11px] text-muted-foreground">{lead.ultima_msg_texto}</p>
                          )}

                          <p className="truncate text-xs">{lead.produto_nome || "sem produto"}</p>
                          {lead.tamanho_indicado && (
                            <p className="text-xs text-muted-foreground">
                              Tamanho indicado: <span className="font-medium text-foreground">{lead.tamanho_indicado}</span>
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CanalIcone canal={lead.canal} />
                            <span>{tempoDesde(lead.criado_em)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <BadgeTemperatura lead={lead} />
                            {lead.houve_contato_humano && (
                              <span className="inline-flex rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                                Você já falou
                              </span>
                            )}
                            {lead.tray_customer_id && (
                              <span className="inline-flex rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                                Cliente conhecida
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={abrindo === lead.id}
                          onClick={() => abrirChat(lead)}
                        >
                          {abrindo === lead.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Abrir chat
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={preparando === lead.id}
                          onClick={() => mensagemPronta(lead)}
                        >
                          {preparando === lead.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Mensagem pronta
                        </Button>
                        {lead.foto_resultado_url && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex-1">
                                <Button
                                  size="sm"
                                  variant={lead.template_enviado_em && lead.template_entrega !== "falhou" ? "outline" : "default"}
                                  className="w-full"
                                  disabled={!templateAprovado}
                                  onClick={() => { setConflito(null); setLeadEnvio(lead); }}
                                >
                                  <Send className="mr-1.5 h-3.5 w-3.5" />
                                  {lead.template_enviado_em && lead.template_entrega !== "falhou"
                                    ? "Reenviar prova"
                                    : "Enviar prova por WhatsApp"}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {!templateAprovado && (
                              <TooltipContent>Template em análise na Meta</TooltipContent>
                            )}
                          </Tooltip>
                        )}
                      </div>


                      {col.proximo && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 w-full"
                          disabled={mover.isPending}
                          onClick={() => mover.mutate({ id: lead.id, status: col.proximo! })}
                        >
                          Mover para {col.proximo === "em_contato" ? "Em Contato" : "Convertido"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!fotoAberta} onOpenChange={(o) => !o && setFotoAberta(null)}>
        <DialogContent className="max-w-2xl">
          {fotoAberta && (
            <img src={fotoAberta} alt="Resultado da prova virtual" className="max-h-[75vh] w-full rounded object-contain" />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!leadEnvio} onOpenChange={(o) => { if (!o) { setLeadEnvio(null); setConflito(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar prova por WhatsApp</DialogTitle>
            <DialogDescription>Confira como a cliente vai receber a mensagem.</DialogDescription>
          </DialogHeader>
          {leadEnvio && (
            <div className="space-y-3">
              {leadEnvio.foto_resultado_url && (
                <img
                  src={leadEnvio.foto_resultado_url}
                  alt="Prévia da prova virtual"
                  className="mx-auto max-h-[260px] rounded object-contain"
                />
              )}
              <div className="whitespace-pre-line rounded-lg border bg-muted/40 p-3 text-sm">
                {textoPrevia(leadEnvio)}
              </div>
              <Button variant="outline" size="sm" className="w-full" disabled>
                Ver a peça
              </Button>
              {conflito && (
                <p className="rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                  {conflito}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setLeadEnvio(null); setConflito(null); }}>
              Cancelar
            </Button>
            <Button
              disabled={enviando}
              onClick={() => leadEnvio && enviarProva(leadEnvio, !!conflito)}
            >
              {enviando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {conflito ? "Reenviar mesmo assim" : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}

/* ---------------- Tela 2 — Gerar Prova Manualmente ---------------- */

type Produto = {
  produto_id: string;
  nome?: string;
  imagem?: string | null;
  disponivel?: boolean | null;
  preco_cheio?: number | null;
  preco_promocional?: number | null;
  tamanhos_disponiveis?: string[] | null;
};

function GerarProva({
  conversaId,
  nomeInicial,
  telefoneInicial,
}: {
  conversaId: string | null;
  nomeInicial: string;
  telefoneInicial: string;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [produto, setProduto] = useState<Produto | null>(null);
  const [nome, setNome] = useState(nomeInicial);
  const [telefone, setTelefone] = useState(telefoneInicial);
  const [urlColada, setUrlColada] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [consentimento, setConsentimento] = useState(false);
  const inputFile = useRef<HTMLInputElement>(null);

  useEffect(() => { setNome(nomeInicial); }, [nomeInicial]);
  useEffect(() => { setTelefone(telefoneInicial); }, [telefoneInicial]);

  async function buscar(termoBusca?: string) {
    const q = (termoBusca ?? termo).trim();
    if (q.length < 2) { setResultados([]); return; }
    setBuscando(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/provador-buscar-produto?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error(`Erro ${res.status} ao buscar produtos`);
      const json = await res.json();
      const lista: Produto[] = Array.isArray(json)
        ? json
        : json?.produtos ?? json?.data ?? [];
      setResultados(lista);
      if (lista.length === 0) toast.info("Nenhum produto encontrado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao buscar produtos");
    } finally {
      setBuscando(false);
    }
  }

  // Debounce: busca automaticamente enquanto digita (a partir de 2 caracteres)
  useEffect(() => {
    const q = termo.trim();
    if (q.length < 2) { setResultados([]); return; }
    const t = window.setTimeout(() => { buscar(q); }, 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo]);

  function selecionarArquivo(f: File | null) {
    setArquivo(f);
    setPrevia(f ? URL.createObjectURL(f) : null);
    if (f) setUrlColada("");
  }

  function fileParaBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result)); // data:image/...;base64,XXXX
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function uploadFoto(f: File): Promise<string> {
    const base64 = await fileParaBase64(f);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/provador-upload-foto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagem_base64: base64, tipo_mime: f.type }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.url) throw new Error(json?.error || "Falha ao enviar a foto");
    return json.url as string;
  }

  async function gerar() {
    if (!produto) return toast.error("Selecione um produto");
    if (!arquivo && !urlColada.trim()) return toast.error("Envie uma foto ou cole uma URL");
    setGerando(true);
    setErro(null);
    setResultado(null);
    try {
      let fotoUrl = urlColada.trim();
      if (arquivo) fotoUrl = await uploadFoto(arquivo);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 120_000);
      let res: Response;
      try {
        res = await fetch(`${SUPABASE_URL}/functions/v1/provador-virtual-gerar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canal: "manual",
            conversa_id: conversaId || null,
            produto_id: produto.produto_id,
            foto_cliente_url: fotoUrl,
            consentimento,
            nome: nome || null,
            telefone: telefone || null,
          }),
          signal: controller.signal,
        });
      } catch (err: any) {
        window.clearTimeout(timeoutId);
        if (err?.name === "AbortError")
          throw new Error("A geração demorou mais que o esperado. Tente novamente em instantes.");
        throw err;
      }
      window.clearTimeout(timeoutId);
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.error) throw new Error(json?.detalhe || json?.error || `Erro ${res.status}`);
      const img = json?.imagem_url || json?.url;
      if (!img) throw new Error("A geração não retornou uma imagem");
      setResultado(img);
      toast.success("Prova gerada!");
    } catch (e: any) {
      setErro(e.message || "Não foi possível gerar a prova. Tente uma foto de corpo inteiro e boa iluminação.");
    } finally {
      setGerando(false);
    }
  }

  async function enviarWhatsApp() {
    if (!resultado) return;
    try {
      let id = conversaId;
      if (!id) {
        const { data, error } = await (supabase as any).rpc("whatsapp_get_or_create_conversa", {
          p_telefone: telefone,
        });
        if (error) throw error;
        id = Array.isArray(data) ? data[0]?.id : data?.id ?? data;
      }
      const { error: err2 } = await (supabase as any).rpc("whatsapp_registrar_mensagem_humana", {
        p_conversa_id: id,
        p_conteudo: "Ficou assim em você! 💛",
        p_tipo: "imagem",
        p_media_url: resultado,
      });
      if (err2) throw err2;
      toast.success("Enviado no WhatsApp");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível enviar");
    }
  }

  const podeEnviar = !!resultado && (!!conversaId || telefone.trim().length > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-lg">Dados da prova</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Produto</Label>
            <div className="flex gap-2">
              <Input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscar()}
                placeholder="Buscar produto… (ex: calça)"
              />
              <Button variant="outline" onClick={() => buscar()} disabled={buscando}>
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {resultados.length > 0 && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-1">
                {resultados.map((p) => (
                  <button
                    key={p.produto_id}
                    type="button"
                    onClick={() => { setProduto(p); setResultados([]); }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    {p.imagem && <img src={p.imagem} alt="" className="h-8 w-8 rounded object-cover" />}
                    <span className="truncate">{p.nome}</span>
                    {p.disponivel === false && (
                      <span className="ml-auto text-[10px] text-muted-foreground">indisponível</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {produto && (
              <p className="text-sm text-muted-foreground">
                Selecionado: <span className="font-medium text-foreground">{produto.nome}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Foto da cliente</Label>
            <div className="flex gap-2">
              <input
                ref={inputFile}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => selecionarArquivo(e.target.files?.[0] ?? null)}
              />
              <Button variant="outline" onClick={() => inputFile.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Enviar arquivo
              </Button>
              {arquivo && <span className="self-center truncate text-xs text-muted-foreground">{arquivo.name}</span>}
            </div>
            <Input
              value={urlColada}
              onChange={(e) => { setUrlColada(e.target.value); setArquivo(null); setPrevia(e.target.value || null); }}
              placeholder="…ou cole uma URL de imagem"
            />
            {previa && <img src={previa} alt="Pré-visualização da foto" className="h-40 rounded object-contain" />}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome (opcional)</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Deixe em branco para gerar sem lead" />
            </div>
            <div className="space-y-2">
              <Label>Telefone (opcional)</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="55119…" />
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-md border bg-muted/30 p-3 text-sm">
            <input
              type="checkbox"
              checked={consentimento}
              onChange={(e) => setConsentimento(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-muted-foreground">
              Confirmo que tenho o consentimento da cliente para usar a foto nesta prova virtual.
            </span>
          </label>

          <Button
            className="w-full"
            onClick={gerar}
            disabled={gerando || !produto || (!arquivo && !urlColada.trim()) || !consentimento}
          >
            {gerando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando… (até 30s)</> : <><Sparkles className="mr-2 h-4 w-4" /> Gerar prova</>}
          </Button>
          {!consentimento && (
            <p className="text-center text-xs text-muted-foreground">Marque o consentimento acima para liberar a geração.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Resultado</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {gerando && (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Gerando a prova virtual…</p>
            </div>
          )}
          {!gerando && erro && (
            <div className="space-y-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
              <p className="text-sm text-danger">{erro}</p>
              <Button variant="outline" size="sm" onClick={gerar}>
                <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
              </Button>
            </div>
          )}
          {!gerando && !erro && !resultado && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              O resultado aparece aqui depois de gerar.
            </p>
          )}
          {resultado && (
            <>
              <img src={resultado} alt="Resultado da prova virtual" className="max-h-[60vh] w-full rounded object-contain" />
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <a href={resultado} target="_blank" rel="noopener noreferrer" download>
                    <Download className="mr-2 h-4 w-4" /> Baixar imagem
                  </a>
                </Button>
                {podeEnviar && (
                  <Button onClick={enviarWhatsApp}>
                    <Send className="mr-2 h-4 w-4" /> Enviar por WhatsApp
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Conteúdo compartilhado ---------------- */

export function ProvadorVirtualConteudo({
  semCabecalho = false,
  conversaId = null,
  nomeInicial = "",
  telefoneInicial = "",
  onAbrirConversa,
  onContagem,
}: {
  semCabecalho?: boolean;
  conversaId?: string | null;
  nomeInicial?: string;
  telefoneInicial?: string;
  onAbrirConversa?: AbrirConversaProvador;
  onContagem?: (n: number) => void;
}) {
  const [aba, setAba] = useState(conversaId ? "gerar" : "funil");

  return (
    <div className={semCabecalho ? "space-y-6" : "space-y-6 p-6"}>
      {!semCabecalho && (
        <div>
          <h1 className="text-3xl font-bold">Provador Virtual</h1>
          <p className="text-muted-foreground">Funil de leads e geração manual de provas virtuais.</p>
        </div>
      )}
      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="funil">Funil de Leads</TabsTrigger>
          <TabsTrigger value="gerar">Gerar Prova</TabsTrigger>
        </TabsList>
        <TabsContent value="funil" className="mt-6">
          <FunilLeads onAbrirConversa={onAbrirConversa} onContagem={onContagem} />
        </TabsContent>
        <TabsContent value="gerar" className="mt-6">
          <GerarProva conversaId={conversaId} nomeInicial={nomeInicial} telefoneInicial={telefoneInicial} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Página ---------------- */

export default function ProvadorVirtual() {
  const [params] = useSearchParams();
  return (
    <ProvadorVirtualConteudo
      conversaId={params.get("conversa_id")}
      nomeInicial={params.get("nome") ?? ""}
      telefoneInicial={params.get("telefone") ?? ""}
    />
  );
}
