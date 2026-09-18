import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle, Bot, Check, CheckCheck, CheckCircle2, Globe, ImagePlus, LayoutGrid, Lock, MessageCircle,
  RotateCcw, Search, Send, User, X, UserCheck, Phone, QrCode, Link2,
  Truck, ShoppingCart, Plus, MoreHorizontal, PanelRight, Menu, Trash2, FileText, Clock, Mail, MailOpen,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  BotaoRespostasRapidas, ListaRespostas, MensagensRapidasTab, filtrarRespostas,
  registrarUso, useRespostasRapidas, type RespostaRapida,
} from "@/components/atendimento/RespostasRapidas";
import { TagsConversa, TagChip, type Tag } from "@/components/atendimento/TagsConversa";
import { CatalogoDialog, formatarPreco, legendaProduto, type ProdutoCatalogo, type EscolhaProduto } from "@/components/atendimento/CatalogoDialog";
import { PerfilCliente } from "@/components/atendimento/PerfilCliente";
import { AtividadesRecentes } from "@/components/atendimento/AtividadesRecentes";
import { CobrancaPixDialog, CobrancasTab, CobrancasDaConversa } from "@/components/atendimento/CobrancaPix";
import { LinksPagamentoTab, LinksDaConversa } from "@/components/atendimento/LinksPagamento";
import { LinkPagamentoCard, LinkPagamentoDialog } from "@/components/atendimento/LinkPagamento";
import { CalcularFreteDialog } from "@/components/atendimento/CalcularFrete";
import { ProporCarrinhoDialog, PropostaDaConversa } from "@/components/atendimento/ProporCarrinho";
import { EnviarTemplateDialog } from "@/components/atendimento/EnviarTemplate";

import { ConsultarTransacaoTab } from "@/components/atendimento/ConsultarTransacao";
import { MensagemMidia, ehTipoMidia } from "@/components/atendimento/MensagemMidia";
import { SeletorFigurinhas } from "@/components/atendimento/SeletorFigurinhas";
import { AbandonadasTab } from "@/components/atendimento/AbandonadasTab";
import { AprendizadoAnnaTab } from "@/components/atendimento/AprendizadoAnna";
import { useConversasAtencao, classeBordaNivel, ChipsMotivos, SeloFila, rotuloAutomacao } from "@/components/atendimento/atencao";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NovaConversaDialog, formatarTelefone, soDigitos } from "@/components/atendimento/NovaConversa";
import { OportunidadesTab } from "@/components/atendimento/OportunidadesTab";
import { ProvadorVirtualConteudo } from "@/pages/ProvadorVirtual";
import { CarrinhoAbandonadoConteudo } from "@/pages/CarrinhoAbandonado";
import { PedidosCanceladosConteudo } from "@/pages/PedidosCancelados";
import { DashboardFunil } from "@/pages/FunilWhatsApp";
import { FilaFollowups, TemplatesFollowup } from "@/components/funil/FollowUps";
import { FunilKanbanConteudo } from "@/pages/FunilKanban";
import { CashbackConteudo } from "@/pages/Cashback";
import { chamarRpc } from "@/lib/supabaseRpc";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { ImperativePanelGroupHandle } from "react-resizable-panels";
import { ProvadorBloco } from "@/components/atendimento/ProvadorBloco";

/** Telas largas ganham colunas arrastáveis; no celular o layout continua igual. */
function useTelaLarga() {
  const [larga, setLarga] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const aplicar = () => setLarga(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);
  return larga;
}

/** Larguras padrão das três colunas: lista, chat e perfil. */
const LARGURAS_PADRAO: [number, number, number] = [22, 53, 25];
const CHAVE_LARGURAS = "atendimento-larguras-paineis";

function lerLargurasSalvas(): [number, number, number] {
  try {
    const bruto = localStorage.getItem(CHAVE_LARGURAS);
    if (bruto) {
      const l = JSON.parse(bruto);
      if (Array.isArray(l) && l.length === 3 && l.every((n) => typeof n === "number")) {
        return l as [number, number, number];
      }
    }
  } catch {
    /* armazenamento indisponível */
  }
  return LARGURAS_PADRAO;
}

function Colunas({
  ajustavel,
  grupoRef,
  className,
  onLayout,
  children,
}: {
  ajustavel: boolean;
  grupoRef: React.RefObject<ImperativePanelGroupHandle>;
  className?: string;
  onLayout?: (layout: number[]) => void;
  children: React.ReactNode;
}) {
  if (!ajustavel) return <div className={className}>{children}</div>;
  return (
    <ResizablePanelGroup
      ref={grupoRef}
      direction="horizontal"
      onLayout={onLayout}
      className={className}
    >
      {children}
    </ResizablePanelGroup>
  );
}

function Coluna({
  ajustavel,
  id,
  order,
  defaultSize,
  minSize,
  maxSize,
  children,
}: {
  ajustavel: boolean;
  id: string;
  order: number;
  defaultSize: number;
  minSize: number;
  maxSize?: number;
  children: React.ReactNode;
}) {
  if (!ajustavel) return <>{children}</>;
  return (
    <ResizablePanel
      id={id}
      order={order}
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden"
    >
      {children}
    </ResizablePanel>
  );
}

/** Separador de data da lista de conversas. */
function grupoDia(valor?: string | null): string {
  if (!valor) return "Mais antigas";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "Mais antigas";
  const hoje = new Date();
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dia(hoje) - dia(d)) / 86400000);
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return "Esta semana";
  return "Mais antigas";
}

type BuscaConversa = {
  conversa_id: number | string;
  telefone?: string | null;
  nome?: string | null;
  status?: string | null;
  ultima_mensagem_em?: string | null;
  tray_customer_id?: string | null;
  janela_aberta?: boolean | null;
};

type BuscaCliente = {
  tray_customer_id?: string | null;
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
};



type Conversa = {
  id: number | string;
  conversa_id?: number | string;
  cliente_nome?: string | null;
  nome_cliente?: string | null;
  nome_cliente_tray?: string | null;
  nome_whatsapp?: string | null;
  telefone: string;
  canal?: "whatsapp" | "site" | string | null;
  telefone_real?: string | null;
  ultima_mensagem?: string | null;
  ultima_mensagem_em?: string | null;
  atualizado_em?: string | null;
  status: string;
  prioridade?: string | null;
  tags?: Tag[] | null;
  nao_lida?: boolean | null;
  urgencia?: "perdendo" | "quente" | "atencao" | "normal" | string | null;
  sinais?: string[] | null;
  ordem?: number | null;
  aguardando_resposta?: boolean | null;
  aguardando_desde?: string | null;
  tipo_interacao?: "conversa" | "clique" | "so_envio" | string | null;
  ultima_entrada_texto?: string | null;
  digitadas?: number | null;
  cliques?: number | null;
  pix_aberto_valor?: number | null;
  link_pendente?: boolean | null;
  desfecho?: string | null;
  historico?: boolean | null;
  so_kora?: boolean | null;
  tem_kora?: boolean | null;
  total_mensagens?: number | null;
  falha_envio?: boolean | null;
  falha_envio_motivo?: string | null;
  falha_envio_em?: string | null;
};


type Urgencia = "perdendo" | "quente" | "atencao" | "normal";

/** Nível de urgência vem de vw_conversas_atencao.nivel: quente/atencao pintam; normal e automacao não. */
const urgenciaDeNivel = (nivel?: string | null): Urgencia => {
  const n = (nivel ?? "").toLowerCase();
  return n === "perdendo" || n === "quente" || n === "atencao" ? n : "normal";
};

const URGENCIA_ESTILO: Record<Exclude<Urgencia, "normal">, { borda: string; badgeFundo: string; badgeTexto: string }> = {
  perdendo: { borda: "#EF4444", badgeFundo: "#FEE2E2", badgeTexto: "#991B1B" },
  quente: { borda: "#F59E0B", badgeFundo: "#FEF3C7", badgeTexto: "#92400E" },
  atencao: { borda: "#E8CD7E", badgeFundo: "#F5F5F5", badgeTexto: "#8B6914" },
};

function BadgeSinal({ conversa, urg }: { conversa: Conversa; urg: Urgencia }) {
  const sinais = conversa.sinais ?? [];
  if (sinais.length === 0) return null;
  if (urg === "normal") return null;
  const estilo = URGENCIA_ESTILO[urg];
  const primeiro = sinais[0];
  const demais = sinais.slice(1);
  return (
    <span className="mt-1 inline-flex items-center gap-1.5">
      {urg === "quente" && primeiro === "respondendo agora" && (
        <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#F59E0B" }} />
      )}
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
        style={{ backgroundColor: estilo.badgeFundo, color: estilo.badgeTexto }}
        title={demais.length > 0 ? demais.join("\n") : undefined}
      >
        {primeiro}
        {demais.length > 0 ? ` +${demais.length}` : ""}
      </span>
    </span>
  );
}

const ehSite = (c?: Conversa | null) =>
  (c?.canal ?? "").toLowerCase() === "site" || String(c?.telefone ?? "").startsWith("site:");

const limpo = (v?: string | null) => (v && v.trim() ? v.trim() : null);

const nomeTray = (c: Conversa) => limpo(c.nome_cliente_tray) ?? limpo(c.cliente_nome) ?? limpo(c.nome_cliente);

const nomeConversa = (c: Conversa) =>
  nomeTray(c) ?? limpo(c.nome_whatsapp) ?? (ehSite(c) ? "Visitante do site" : "Desconhecido");

/** true quando o nome exibido veio só do perfil do WhatsApp (cliente ainda não identificada na Tray) */
const nomeSoDoWhatsApp = (c: Conversa) => !nomeTray(c) && !!limpo(c.nome_whatsapp);

function BadgeViaWhatsApp() {
  return (
    <span className="inline-flex items-center rounded-full border border-success/20 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success whitespace-nowrap">
      via WhatsApp
    </span>
  );
}

const identificadorConversa = (c: Conversa) =>
  ehSite(c) ? "Chat do site" : formatarTelefone(c.telefone) || c.telefone;



type Mensagem = {
  id?: number | string;
  conteudo: string;
  direcao: "entrada" | "saida";
  origem?: string | null;
  tipo?: string | null;
  media_url?: string | null;
  criado_em?: string | null;
  criada_em?: string | null;
  enviado_em?: string | null;
  status_entrega?: "enviado" | "entregue" | "lido" | "falhou" | string | null;
  erro_entrega?: string | null;
  enviando?: boolean;
  /** Falha detectada no próprio envio (balão otimista), ainda não gravada no banco. */
  falha_local?: boolean;
};

/** Motivos de falha ligados à janela de 24h pedem template, não nova tentativa. */
const ehMotivoJanela = (motivo?: string | null) => /24\s*h|janela/i.test(motivo ?? "");


const STATUS_META: Record<string, { label: string; className: string }> = {
  escalado: { label: "Aguardando atendimento", className: "bg-danger/10 text-danger border-danger/20" },
  em_atendimento: { label: "Em atendimento", className: "bg-warning/10 text-warning border-warning/20" },
  bot_ativo: { label: "Bot ativo", className: "bg-muted text-muted-foreground border-border" },
  resolvido: { label: "Resolvido", className: "bg-success/10 text-success border-success/20" },
};

function StatusPill({
  status,
  aguardandoDesde,
  className,
}: {
  status: string;
  aguardandoDesde?: string | null;
  className?: string;
}) {
  // A tarja "Aguardando atendimento" só vale quando a conversa está mesmo na fila humana
  if (status === "escalado" && !aguardandoDesde) return null;
  const meta = STATUS_META[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

function tempoRelativo(valor?: string | null) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

function horaCurta(valor?: string | null) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  const fmtDia = (x: Date) =>
    x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  if (fmtDia(d) === fmtDia(new Date())) return hora;
  return `${fmtDia(d)} ${hora}`;
}


function StatusEntrega({ status, erro }: { status?: string | null; erro?: string | null }) {
  if (!status) return null;
  if (status === "falhou") {
    return (
      <span
        title={erro || "Falha no envio"}
        className="inline-flex items-center text-danger cursor-help"
        aria-label="Falha no envio"
      >
        <AlertTriangle className="h-3 w-3" />
      </span>
    );
  }
  if (status === "lido") {
    return (
      <span title="Lido" className="inline-flex items-center text-info">
        <CheckCheck className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "entregue") {
    return (
      <span title="Entregue" className="inline-flex items-center text-muted-foreground">
        <CheckCheck className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span title="Enviado" className="inline-flex items-center text-muted-foreground">
      <Check className="h-3.5 w-3.5" />
    </span>
  );
}

export default function Atendimento() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [parametros, setParametros] = useSearchParams();
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<"whatsapp" | "site">("whatsapp");
  const [abaPagina, setAbaPagina] = useState<
    | "conversas"
    | "cobrancas"
    | "consulta"
    | "abandonadas"
    | "rapidas"
    | "aprendizado"
    | "oportunidades"
    | "provador"
    | "carrinhos"
    | "cancelados"
    | "kanban"
    | "cashback"
  >("conversas");
  const [abaKanban, setAbaKanban] = useState<"kanban" | "dashboard" | "followups" | "templates">("kanban");
  const [contagens, setContagens] = useState<Record<string, number>>({});
  const setContagem = (chave: string, n: number) =>
    setContagens((prev) => (prev[chave] === n ? prev : { ...prev, [chave]: n }));
  /** Lead do provador que recebeu mensagem pronta: registra o contato depois do envio. */
  const [leadProvador, setLeadProvador] = useState<{ leadId: string; conversaId: string } | null>(null);
  const [cobrancaAberta, setCobrancaAberta] = useState(false);
  const [abaCobranca, setAbaCobranca] = useState<"pix" | "links">("pix");
  const [linkPagamentoAberto, setLinkPagamentoAberto] = useState(false);
  const [excluirAberta, setExcluirAberta] = useState(false);
  const [motivoExclusao, setMotivoExclusao] = useState("");
  const [freteAberto, setFreteAberto] = useState(false);
  const [proporCarrinhoAberto, setProporCarrinhoAberto] = useState(false);
  const [templateAberto, setTemplateAberto] = useState(false);
  const [propostaId, setPropostaId] = useState<string | number | null>(null);
  const [novaConversaAberta, setNovaConversaAberta] = useState(false);
  const [telefoneNovaConversa, setTelefoneNovaConversa] = useState<string | null>(null);
  const [termoBusca, setTermoBusca] = useState("");



  const [grupoAba, setGrupoAba] = useState<"conversa" | "clique" | "so_envio">("conversa");
  const [filtroLeitura, setFiltroLeitura] = useState<"todas" | "nao_lidas" | "lidas">("todas");
  const [menuLeituraAberto, setMenuLeituraAberto] = useState<string | null>(null);
  const longPressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; disparado: boolean }>({ timer: null, disparado: false });
  /** Filtros especiais mutuamente exclusivos: atenção, automações e em atendimento. */
  const [filtroFila, setFiltroFila] = useState<"atencao" | "automacao" | "em_atendimento" | "falhas" | null>(null);
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);
  const [modoHistorico, setModoHistorico] = useState(false);
  const [soKora, setSoKora] = useState(false);
  const [erroJanela, setErroJanela] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [legenda, setLegenda] = useState("");
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textoRef = useRef<HTMLTextAreaElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  // Tecla "/" fora de um campo leva o cursor direto para a busca de conversas
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      const tag = (alvo?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || alvo?.isContentEditable) return;
      e.preventDefault();
      buscaRef.current?.focus();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);


  // painéis laterais estilo WhatsApp Web
  const [perfilAberto, setPerfilAberto] = useState(true);
  const [perfilSheet, setPerfilSheet] = useState(false);
  const [listaSheet, setListaSheet] = useState(false);

  // mensagens rápidas pelo atalho "/"
  const { data: respostasRapidas = [] } = useRespostasRapidas(false);
  const [indiceRapida, setIndiceRapida] = useState(0);
  const slashAtivo = texto.startsWith("/") && !texto.includes("\n");
  const rapidasFiltradas = useMemo(
    () => (slashAtivo ? filtrarRespostas(respostasRapidas, texto.slice(1)) : []),
    [slashAtivo, respostasRapidas, texto],
  );
  const listaRapidaAberta = slashAtivo && rapidasFiltradas.length > 0;
  useEffect(() => {
    setIndiceRapida(0);
  }, [texto]);

  useEffect(() => {
    const campo = textoRef.current;
    if (!campo) return;
    campo.style.height = "auto";
    campo.style.height = `${Math.min(campo.scrollHeight, 96)}px`;
  }, [texto]);

  const inserirResposta = (r: RespostaRapida) => {
    setTexto(r.texto);
    registrarUso(r.id);
    setTimeout(() => textoRef.current?.focus(), 0);
  };

  const autor = user?.email ?? "Atendente";

  const colunasAjustaveis = useTelaLarga();
  const grupoColunasRef = useRef<ImperativePanelGroupHandle>(null);
  const [largurasIniciais] = useState<[number, number, number]>(lerLargurasSalvas);
  const salvarLarguras = (layout: number[]) => {
    try {
      localStorage.setItem(CHAVE_LARGURAS, JSON.stringify(layout));
    } catch {
      /* armazenamento indisponível */
    }
  };
  const restaurarLarguras = () => {
    try {
      localStorage.removeItem(CHAVE_LARGURAS);
    } catch {
      /* armazenamento indisponível */
    }
    grupoColunasRef.current?.setLayout([...LARGURAS_PADRAO]);
  };

  /** Preenche o campo de resposta com um texto pronto, sem enviar. */
  const usarTextoPronto = (t: string) => {
    setTexto(t);
    setTimeout(() => textoRef.current?.focus(), 0);
  };

  const { data: conversasBrutas = [], isLoading: carregandoConversas } = useQuery({
    queryKey: ["whatsapp-conversas"],
    queryFn: async () => {
      // vw_conversas_painel_com_tags já vem ordenada por urgência: renderizar na ordem exata do banco
      const { data, error } = await supabase.from("vw_conversas_painel_com_tags" as any).select("*");
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => ({
        ...c,
        id: c.conversa_id ?? c.id,
        cliente_nome: c.cliente_nome ?? c.nome ?? null,
        ultima_mensagem: c.ultima_mensagem ?? c.ultima_mensagem_texto ?? null,
      })) as Conversa[];
    },
    // rede de segurança curta: o tempo real cuida do resto
    refetchInterval: 10000,
  });

  // Tipo de interação por conversa: conversa de verdade, só clique em botão ou só disparo nosso
  const { data: tiposInteracao = [] } = useQuery({
    queryKey: ["whatsapp-conversas-tipo"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_conversas_tipo" as any).select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const conversas = useMemo(() => {
    const mapa = new Map<string, any>();
    for (const t of tiposInteracao) mapa.set(String(t.conversa_id), t);
    return conversasBrutas.map((c) => {
      const t = mapa.get(String(c.id));
      return t
        ? {
            ...c,
            tipo_interacao: t.tipo_interacao ?? null,
            ultima_entrada_texto: t.ultima_entrada_texto ?? t.ultima_entrada ?? t.ultimo_clique ?? null,
            digitadas: t.digitadas ?? null,
            cliques: t.cliques ?? null,
          }
        : c;
    });
  }, [conversasBrutas, tiposInteracao]);

  const { mapaAtencao } = useConversasAtencao();

  // Busca por nome ou telefone com debounce de 300ms
  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const buscaAtiva = !modoHistorico && termoBusca.length >= 2;

  const { data: resultadoBusca } = useQuery({
    queryKey: ["whatsapp-busca", termoBusca],
    enabled: buscaAtiva,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_buscar" as any, { p_termo: termoBusca });
      if (error) throw error;
      const r = (data ?? {}) as any;
      return {
        conversas: (r.conversas ?? []) as BuscaConversa[],
        clientes: (r.clientes ?? []) as BuscaCliente[],
      };
    },
  });

  const {
    data: paginasHistorico,
    isLoading: carregandoHistorico,
    isFetchingNextPage: carregandoMaisHistorico,
    hasNextPage: temMaisHistorico,
    fetchNextPage: carregarMaisHistorico,
  } = useInfiniteQuery({
    queryKey: ["whatsapp-conversas-historico", termoBusca, soKora],
    enabled: modoHistorico,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await chamarRpc("whatsapp_conversas_historico" as any, {
        p_termo: termoBusca || null,
        p_so_kora: soKora,
        p_limite: 50,
        p_offset: pageParam,
      });
      if (error) throw error;
      return ((Array.isArray(data) ? data : []) as any[]).map((c) => ({
        ...c,
        id: c.conversa_id,
        cliente_nome: c.nome ?? null,
        ultima_mensagem: c.ultima_mensagem_texto ?? null,
        historico: true,
      })) as Conversa[];
    },
    getNextPageParam: (ultima, paginas) => ultima.length === 50 ? paginas.length * 50 : undefined,
  });

  const conversasHistorico = useMemo(
    () => paginasHistorico?.pages.flat() ?? [],
    [paginasHistorico],
  );

  // Conversa aberta que não está na lista carregada: busca os dados completos por id.
  const selecionadaNoHistorico = !!selecionada
    && conversasHistorico.some((c) => String(c.id) === selecionada);
  const foraDaLista = !!selecionada
    && (selecionadaNoHistorico || (
      !conversas.some((c) => String(c.id) === selecionada)
      && !conversasHistorico.some((c) => String(c.id) === selecionada)
    ));
  const { data: conversaAvulsa = null } = useQuery({
    queryKey: ["whatsapp-conversa", selecionada],
    enabled: foraDaLista,
    refetchInterval: foraDaLista ? 30000 : false,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_conversa_por_id" as any, {
        p_conversa_id: Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada),
      });
      if (error) throw error;
      const bruto = Array.isArray(data) ? data[0] : data;
      if (!bruto) return null;
      const c = bruto as any;
      return { ...c, id: c.id ?? c.conversa_id, cliente_nome: c.cliente_nome ?? c.nome ?? null } as Conversa;
    },
  });

  // Resolve a conversa aberta: primeiro na lista carregada; depois a consulta por id;
  // por último o item sintético da busca, para a tela abrir na hora.
  const conversaAtual = useMemo<Conversa | null>(() => {
    if (!selecionada) return null;
    const historica = conversasHistorico.find((c) => String(c.id) === selecionada);
    if (selecionadaNoHistorico && conversaAvulsa) return conversaAvulsa;
    if (historica) return historica;
    const carregada = conversas.find((c) => String(c.id) === selecionada);
    if (carregada) return carregada;
    if (conversaAvulsa) return conversaAvulsa;
    const achada = resultadoBusca?.conversas?.find((r) => String(r.conversa_id) === selecionada);
    if (!achada) return null;
    return {
      id: achada.conversa_id,
      telefone: achada.telefone ?? "",
      cliente_nome: achada.nome ?? null,
      status: achada.status ?? "",
      ultima_mensagem_em: achada.ultima_mensagem_em ?? null,
    } as Conversa;
  }, [conversas, conversasHistorico, conversaAvulsa, resultadoBusca, selecionada, selecionadaNoHistorico]);

  // Deep link: /atendimento?conversa=123 abre a conversa mesmo que ela não esteja
  // na lista carregada (a consulta por id acima resolve os dados).
  useEffect(() => {
    const alvo = parametros.get("conversa");
    if (!alvo) return;
    setSelecionada(String(alvo));
    setAbaPagina("conversas");
    setListaSheet(false);
    setPerfilSheet(false);
    const textoPronto = parametros.get("texto");
    if (textoPronto) {
      setTexto(textoPronto);
      setTimeout(() => textoRef.current?.focus(), 0);
    }
    const restantes = new URLSearchParams(parametros);
    restantes.delete("conversa");
    restantes.delete("texto");
    setParametros(restantes, { replace: true });
  }, [parametros, setParametros]);

  // Deep link: /atendimento?telefone=5511...
  useEffect(() => {
    const alvo = parametros.get("telefone");
    if (!alvo || selecionada || conversas.length === 0) return;
    const digitos = alvo.replace(/\D/g, "");
    const achou = conversas.find((c) => (c.telefone ?? "").replace(/\D/g, "").endsWith(digitos.slice(-8)));
    if (achou) {
      setSelecionada(String(achou.id));
      setAbaPagina("conversas");
      setListaSheet(false);
    }
  }, [conversas, selecionada, parametros]);

  const { data: mensagens = [], isLoading: carregandoMensagens } = useQuery({
    queryKey: ["whatsapp-mensagens", selecionada],
    enabled: !!selecionada,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_get_mensagens_conversa" as any, {
        p_conversa_id: Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada),
      });
      if (error) throw error;
      return (data ?? []) as Mensagem[];
    },
  });

  // Tempo real: mensagens novas, transcrição de áudio e mudanças de conversa
  const selecionadaRef = useRef<string | null>(null);
  selecionadaRef.current = selecionada;

  useEffect(() => {
    const invalidarLista = () =>
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversa"] });

    const mesmaConversa = (linha: any) =>
      selecionadaRef.current != null && String(linha?.conversa_id) === String(selecionadaRef.current);

    const canal = supabase
      .channel("atendimento-tempo-real")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "whatsapp", table: "mensagens" },
        ({ new: nova }: any) => {
          if (mesmaConversa(nova)) {
            queryClient.setQueryData<Mensagem[]>(
              ["whatsapp-mensagens", selecionadaRef.current],
              (atuais) => {
                const lista = atuais ?? [];
                if (nova?.id != null && lista.some((m) => String(m.id) === String(nova.id))) return lista;
                return [...lista, nova as Mensagem];
              },
            );
          }
          invalidarLista();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "whatsapp", table: "mensagens" },
        ({ new: atualizada }: any) => {
          if (!mesmaConversa(atualizada) || atualizada?.id == null) return;
          queryClient.setQueryData<Mensagem[]>(
            ["whatsapp-mensagens", selecionadaRef.current],
            (atuais) =>
              (atuais ?? []).map((m) =>
                String(m.id) === String(atualizada.id) ? { ...m, ...(atualizada as Mensagem) } : m,
              ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "whatsapp", table: "conversas" },
        () => invalidarLista(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [queryClient]);

  const { data: todasTags = [] } = useQuery({
    queryKey: ["whatsapp-tags"],
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_listar_tags" as any);
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
  });

  const { data: dentroJanela } = useQuery({
    queryKey: ["whatsapp-janela-24h", selecionada],
    enabled: !!selecionada && !ehSite(conversaAtual),
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_dentro_janela_24h" as any, {
        p_conversa_id: Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada),
      });
      if (error) throw error;
      return data as unknown as boolean;
    },
  });

  const abrirConversa = async (c: Conversa) => {
    setSelecionada(String(c.id));
    setListaSheet(false);
    setErroJanela(null);
    if (modoHistorico || c.historico || !c.nao_lida) return;
    const { error } = await chamarRpc("whatsapp_marcar_lida" as any, {
      p_conversa_id: Number.isNaN(Number(c.id)) ? c.id : Number(c.id),
    });
    if (!error) queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversa"] });
  };

  const marcarLeitura = async (id: string | number, naoLida: boolean): Promise<boolean> => {
    const idParam = Number.isNaN(Number(id)) ? id : Number(id);
    queryClient.setQueryData<Conversa[]>(["whatsapp-conversas"], (lista) =>
      (lista ?? []).map((cv) => (String(cv.id) === String(id) ? { ...cv, nao_lida: naoLida } : cv)),
    );
    const { error } = await chamarRpc((naoLida ? "whatsapp_marcar_nao_lida" : "whatsapp_marcar_lida") as any, {
      p_conversa_id: idParam,
    });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversa"] });
    if (error) {
      toast({ title: "Não foi possível atualizar", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  };

  const marcarNaoLidaEFechar = async () => {
    if (!selecionada) return;
    const ok = await marcarLeitura(selecionada, true);
    if (!ok) return;
    setSelecionada(null);
    setListaSheet(false);
    setPerfilSheet(false);
    toast({ title: "Marcada como não lida" });
  };


  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length, selecionada]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const invalidarThread = () => {
    queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens", selecionada] });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversa"] });
  };

  const extrairErroJanela = async (error: any): Promise<string | null> => {
    try {
      const resp = error?.context;
      if (resp && typeof resp.json === "function") {
        const corpo = await resp.clone().json();
        if (corpo?.error === "janela_24h_fechada") {
          return corpo.mensagem || "Fora da janela de 24h — use um template aprovado para reabrir o contato.";
        }
      }
    } catch {
      /* ignora */
    }
    if (typeof error?.message === "string" && error.message.includes("janela_24h_fechada")) {
      return "Fora da janela de 24h — use um template aprovado para reabrir o contato.";
    }
    return null;
  };

  /** Insere um balão temporário no cache da thread e devolve o id provisório. */
  const inserirMensagemOtimista = (dados: Partial<Mensagem>) => {
    const idTemp = -Date.now();
    const chave = ["whatsapp-mensagens", selecionada];
    queryClient.cancelQueries({ queryKey: chave });
    queryClient.setQueryData(chave, (antigas: Mensagem[] = []) => [
      ...(antigas ?? []),
      {
        id: idTemp,
        direcao: "saida",
        criada_em: new Date().toISOString(),
        enviando: true,
        ...dados,
      } as Mensagem,
    ]);
    return idTemp;
  };

  const removerMensagemOtimista = (idTemp: number) => {
    queryClient.setQueryData(["whatsapp-mensagens", selecionada], (antigas: Mensagem[] = []) =>
      (antigas ?? []).filter((m) => m.id !== idTemp),
    );
  };

  /** Transforma o balão otimista em balão de falha, com o motivo em português. */
  const marcarMensagemFalhou = (idTemp: number, motivo: string) => {
    queryClient.setQueryData(["whatsapp-mensagens", selecionada], (antigas: Mensagem[] = []) =>
      (antigas ?? []).map((m) =>
        m.id === idTemp
          ? { ...m, enviando: false, status_entrega: "falhou", erro_entrega: motivo, falha_local: true }
          : m,
      ),
    );
  };

  /** Reenvia o mesmo texto pelo fluxo normal de envio. */
  const reenviarMensagem = (m: Mensagem) => {
    const conteudo = (m.conteudo ?? "").trim();
    if (!conteudo) return;
    if (typeof m.id === "number" && m.id < 0) removerMensagemOtimista(m.id);
    enviar.mutate(conteudo);
  };

  const copiarTextoMensagem = async (conteudo: string) => {
    try {
      await navigator.clipboard.writeText(conteudo);
      toast({ title: "Texto copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };


  const enviar = useMutation({
    mutationFn: async (conteudo: string) => {
      if (!conversaAtual) throw new Error("Nenhuma conversa selecionada");
      if (ehSite(conversaAtual)) {
        const { data, error } = await chamarRpc("whatsapp_registrar_mensagem_humana" as any, {
          p_conversa_id: conversaAtual.id,
          p_conteudo: conteudo,
        });
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.functions.invoke("whatsapp-enviar-mensagem-humano", {
        body: {
          conversa_id: conversaAtual.id,
          telefone: conversaAtual.telefone,
          conteudo,
          autor: user?.email ?? null,
        },
      });
      if (error) throw error;
      return data;
    },
    onMutate: (conteudo: string) => {
      setTexto("");
      setErroJanela(null);
      return { idTemp: inserirMensagemOtimista({ conteudo, tipo: "texto" }), conteudo };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens", selecionada] });
      // Lead do provador aberto com mensagem pronta: registra o contato no funil
      if (leadProvador && leadProvador.conversaId === selecionada) {
        const { leadId, conversaId } = leadProvador;
        setLeadProvador(null);
        (supabase as any)
          .rpc("provador_registrar_contato", { p_id: leadId, p_conversa_id: conversaId ?? null })
          .then(() => queryClient.invalidateQueries({ queryKey: ["provador-leads"] }));
      }
    },
    onError: async (e: any, _conteudo, contexto: any) => {
      const janela = await extrairErroJanela(e);
      const motivo = janela ?? e?.message ?? "Não foi possível enviar a mensagem.";
      if (contexto?.idTemp) marcarMensagemFalhou(contexto.idTemp, motivo);
      if (contexto?.conteudo) setTexto((atual) => (atual.trim() ? atual : contexto.conteudo));
      if (janela) {
        setErroJanela(janela);
        queryClient.invalidateQueries({ queryKey: ["whatsapp-janela-24h", selecionada] });
      }
      toast({
        title: "Mensagem não enviada",
        description: motivo,
        variant: "destructive",
        duration: 10000,
      });
    },

  });

  const enviarImagem = async (mediaUrl: string, conteudo: string) => {
    if (!conversaAtual) throw new Error("Nenhuma conversa selecionada");
    const telefoneEnvio = conversaAtual.telefone_real || conversaAtual.telefone;
    const idTemp = inserirMensagemOtimista({
      conteudo,
      tipo: "imagem",
      media_url: mediaUrl,
    });
    try {
      const resposta = await fetch(
        "https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/whatsapp-enviar-imagem-humano",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telefone: telefoneEnvio,
            conversa_id: conversaAtual.id,
            imagem_url: mediaUrl,
            legenda: conteudo || "",
          }),
        },
      );
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok || corpo?.error) {
        throw new Error(corpo?.error || corpo?.mensagem || `Falha no envio (${resposta.status})`);
      }
    } catch (e) {
      removerMensagemOtimista(idTemp);
      throw e;
    }
    queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens", selecionada] });
  };

  const selecionarArquivo = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem", variant: "destructive" });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setArquivo(f);
    setPreviewUrl(URL.createObjectURL(f));
    setLegenda("");
  };

  const limparPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setArquivo(null);
    setPreviewUrl(null);
    setLegenda("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmarEnvioImagem = async () => {
    if (!arquivo) return;
    setEnviandoImagem(true);
    try {
      const nome = arquivo.name.replace(/[^\w.\-]/g, "_");
      const path = `enviadas/${Date.now()}-${nome}`;
      const { error: upErr } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, arquivo, { cacheControl: "31536000", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      await enviarImagem(pub.publicUrl, legenda.trim());
      limparPreview();
    } catch (e: any) {
      toast({ title: "Erro ao enviar imagem", description: e.message, variant: "destructive" });
    } finally {
      setEnviandoImagem(false);
    }
  };

  const enviarProduto = async (p: ProdutoCatalogo, escolha?: EscolhaProduto) => {
    try {
      await enviarImagem(escolha?.imagem || p.imagem || "", legendaProduto(p, escolha));
      setCatalogoAberto(false);
      toast({ title: "Produto enviado" });
    } catch (e: any) {
      toast({ title: "Erro ao enviar produto", description: e.message, variant: "destructive" });
    }
  };

  const assumir = useMutation({
    mutationFn: async () => {
      const { error } = await chamarRpc("whatsapp_assumir_conversa" as any, {
        p_conversa_id: Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Conversa assumida" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversa"] });
    },
    onError: (e: any) => toast({ title: "Erro ao assumir conversa", description: e.message, variant: "destructive" }),
  });

  const reativarBot = useMutation({
    mutationFn: async () => {
      const id = Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada);
      const { error } = await chamarRpc("whatsapp_reativar_bot" as any, { p_conversa_id: id });
      if (error) throw error;
      // tira a conversa da fila humana junto com o status
      try {
        await (supabase as any)
          .schema("whatsapp")
          .from("conversas")
          .update({ aguardando_desde: null, fila_posicao_avisada: null })
          .eq("id", id);
      } catch {
        /* a RPC pode já ter limpado; ignorar */
      }
    },
    onSuccess: () => {
      toast({ title: "Bot reativado" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversa"] });
    },
    onError: (e: any) => toast({ title: "Erro ao reativar bot", description: e.message, variant: "destructive" }),
  });

  const excluirConversa = useMutation({
    mutationFn: async () => {
      if (!conversaAtual) throw new Error("Nenhuma conversa aberta");
      const id = Number.isNaN(Number(conversaAtual.id)) ? conversaAtual.id : Number(conversaAtual.id);
      const { data, error } = await chamarRpc("whatsapp_excluir_conversa" as any, {
        p_conversa_id: id,
        p_motivo: motivoExclusao.trim() ? motivoExclusao.trim() : null,
      });
      if (error) throw new Error(error.message || "Erro ao excluir conversa");
      return data as any;
    },
    onSuccess: (data: any) => {
      if (data && data.ok === false) {
        toast({ title: "Não foi possível excluir", description: data.erro ?? "Erro desconhecido", variant: "destructive" });
        return;
      }
      toast({ title: "Conversa excluída" });
      setExcluirAberta(false);
      setMotivoExclusao("");
      setSelecionada(null);
      setListaSheet(false);
      setPerfilSheet(false);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas-tipo"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-em-atendimento"] });
    },
    onError: (e: any) => toast({ title: "Erro ao excluir conversa", description: e.message, variant: "destructive" }),
  });

  const resolver = useMutation({
    mutationFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_update_conversa_status" as any, {
        p_conversa_id: Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada),
        p_status: "resolvido",
        p_atendente: user?.email ?? null,
      });
      if (error) throw error;
      return data as { status?: string; csat?: { abriu?: boolean; csat_id?: number; motivo?: string } } | null;
    },
    onMutate: async () => {
      // Otimista: marca como resolvida na hora para a conversa descer ao fim da lista.
      await queryClient.cancelQueries({ queryKey: ["whatsapp-conversas"] });
      const anterior = queryClient.getQueryData<Conversa[]>(["whatsapp-conversas"]);
      queryClient.setQueryData<Conversa[]>(["whatsapp-conversas"], (lista) =>
        (lista ?? []).map((c) => (String(c.id) === String(selecionada) ? { ...c, status: "resolvido" } : c)),
      );
      return { anterior };
    },
    onSuccess: (data) => {
      toast(
        data?.csat?.abriu
          ? { title: "Conversa encerrada. Pesquisa de satisfação a caminho" }
          : { title: "Conversa marcada como resolvida" },
      );
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversa"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-tags-conversa", String(selecionada)] });
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.anterior) queryClient.setQueryData(["whatsapp-conversas"], ctx.anterior);
      toast({
        title: "Não foi possível resolver",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const daAba = (c: Conversa) => (ehSite(c) ? "site" : "whatsapp") === aba;

  const atencaoDe = (c: Conversa) => mapaAtencao.get(String(c.id));

  /** Alguém pedindo atendente entra em Conversas sempre, seja qual for o tipo */
  const grupoDe = (c: Conversa): "conversa" | "clique" | "so_envio" => {
    if (c.status === "escalado" || c.status === "em_atendimento") return "conversa";
    const t = (c.tipo_interacao ?? "conversa").toLowerCase();
    if (t === "clique") return "clique";
    if (t === "so_envio") return "so_envio";
    return "conversa";
  };

  /** Conversa encerrada: status resolvido ou desfecho preenchido. */
  const ehResolvida = (c: Conversa) => c.status === "resolvido" || !!c.desfecho;

  /** Cliente falou por último e ninguém respondeu (vw_conversas_atencao, com fallback na conversa). */
  const aguardandoResposta = (c: Conversa) => {
    const a = atencaoDe(c);
    if (a?.ultima_entrada) return !a.ultima_saida || a.ultima_entrada > a.ultima_saida;
    return !!c.aguardando_resposta;
  };

  const chaveData = (c: Conversa) => c.ultima_mensagem_em ?? c.atualizado_em ?? "";

  /**
   * Faixa colorida na borda esquerda do card:
   * cinza quando já foi resolvida, vermelha quando a cliente espera há mais de 30 minutos,
   * âmbar quando espera há menos de 30 minutos e verde quando já foi respondida.
   */
  const classeFaixa = (c: Conversa) => {
    if (c.falha_envio) return "border-l-danger";
    if (ehResolvida(c)) return "border-l-muted-foreground/30";
    if (!aguardandoResposta(c)) return "border-l-emerald-500/70";
    const a = atencaoDe(c);
    const desde = a?.ultima_entrada ?? c.ultima_mensagem_em ?? c.atualizado_em;
    const min = a?.min_desde_cliente ?? (desde ? (Date.now() - new Date(desde).getTime()) / 60000 : 0);
    return min > 30 ? "border-l-danger" : "border-l-warning";
  };

  /** Prioridade dentro do grupo: perdendo primeiro, depois falhas de envio, depois o resto. */
  const pesoConversa = (c: Conversa) => {
    if (urgenciaDeNivel(atencaoDe(c)?.nivel) === "perdendo") return 0;
    if (c.falha_envio) return 1;
    return 2;
  };

  /** Ordem: prioridade do grupo e, dentro dela, mensagem mais recente primeiro. */
  const compararConversas = (a: Conversa, b: Conversa) =>
    pesoConversa(a) - pesoConversa(b) || chaveData(b).localeCompare(chaveData(a));


  const contagemGrupos = useMemo(() => {
    const base = { conversa: 0, clique: 0, so_envio: 0 };
    for (const c of conversas) {
      if (!daAba(c)) continue;
      base[grupoDe(c)] += 1;
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas, aba]);


  /** Chip "Em atendimento" ativo: a lista passa a vir da RPC, já ordenada. */
  const modoFila = filtroFila === "em_atendimento";

  // Fila de trabalho: a RPC já devolve só as conversas assumidas, na ordem de espera
  const { data: emAtendimento = [] } = useQuery({
    queryKey: ["whatsapp-em-atendimento"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_conversas_em_atendimento" as any, { p_horas: 72 });
      if (error) throw error;
      return ((Array.isArray(data) ? data : []) as any[]).map((c) => ({
        ...c,
        id: c.conversa_id ?? c.id,
        cliente_nome: c.cliente_nome ?? c.nome ?? null,
        ultima_mensagem: c.ultima_mensagem ?? c.ultima_mensagem_texto ?? null,
      })) as Conversa[];
    },
  });
  const totalEmAtendimento = emAtendimento.length;

  const filtradas = useMemo(() => {
    let base: Conversa[];
    if (modoHistorico) return conversasHistorico;
    if (modoFila) {
      // Chip "Em atendimento": renderiza na ordem exata da RPC, sem reordenar no front.
      base = emAtendimento;
      if (buscaAtiva) {
        const ids = new Set((resultadoBusca?.conversas ?? []).map((r) => String(r.conversa_id)));
        base = base.filter((c) => ids.has(String(c.id)));
      }
      if (filtroLeitura === "nao_lidas") base = base.filter((c) => !!c.nao_lida);
      if (filtroLeitura === "lidas") base = base.filter((c) => !c.nao_lida);
      return base;
    }
    if (buscaAtiva) {
      const achadas = resultadoBusca?.conversas ?? [];
      base = achadas.map((r) => {
        const carregada = conversas.find((c) => String(c.id) === String(r.conversa_id));
        if (carregada) return carregada;
        return {
          id: r.conversa_id,
          telefone: r.telefone ?? "",
          cliente_nome: r.nome ?? null,
          status: r.status ?? "",
          ultima_mensagem_em: r.ultima_mensagem_em ?? null,
        } as Conversa;
      });
    } else {
      base = conversas.filter((c) => {
        if (!daAba(c)) return false;
        if (grupoDe(c) !== grupoAba) return false;
        if (filtroLeitura === "nao_lidas" && !c.nao_lida) return false;
        if (filtroLeitura === "lidas" && c.nao_lida) return false;
        if (filtroFila === "atencao" && !["quente", "atencao"].includes(urgenciaDeNivel(atencaoDe(c)?.nivel))) return false;
        if (filtroFila === "automacao" && atencaoDe(c)?.dono !== "automacao") return false;
        if (filtroFila === "falhas" && !c.falha_envio) return false;

        if (tagsFiltro.length > 0) {
          const ids = (c.tags ?? []).map((t) => String(t.id));
          if (!tagsFiltro.some((t) => ids.includes(t))) return false;
        }
        return true;
      });
    }
    return [...base].sort(compararConversas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas, conversasHistorico, emAtendimento, buscaAtiva, resultadoBusca, aba, grupoAba, filtroLeitura, filtroFila, tagsFiltro, mapaAtencao, modoFila, modoHistorico]);


  const clientesSemConversa = buscaAtiva && !modoHistorico ? (resultadoBusca?.clientes ?? []) : [];

  const abrirNovaConversa = (telefone?: string | null) => {
    setTelefoneNovaConversa(telefone ?? null);
    setNovaConversaAberta(true);
  };

  const naoLidasWhatsapp = conversas.filter((c) => c.nao_lida && !ehSite(c)).length;
  const naoLidasSite = conversas.filter((c) => c.nao_lida && ehSite(c)).length;
  const totalNaoLidas = aba === "site" ? naoLidasSite : naoLidasWhatsapp;
  // "Precisam de atenção" conta só a aba Conversas, apenas niveis quente/atencao (nunca automacao)
  const totalAtencao = conversas.filter(
    (c) => daAba(c) && grupoDe(c) === "conversa" && ["quente", "atencao"].includes(urgenciaDeNivel(atencaoDe(c)?.nivel)),
  ).length;
  // "Automações": conversas conduzidas por régua (avaliação/cashback) no grupo atual
  const totalAutomacoes = conversas.filter(
    (c) => daAba(c) && grupoDe(c) === grupoAba && atencaoDe(c)?.dono === "automacao",
  ).length;
  // "Não enviadas": última mensagem nossa falhou na entrega
  const totalFalhas = conversas.filter((c) => daAba(c) && grupoDe(c) === grupoAba && !!c.falha_envio).length;


  const telefoneIdentificado = conversaAtual
    ? (ehSite(conversaAtual) ? conversaAtual.telefone_real : conversaAtual.telefone) || null
    : null;


  const status = conversaAtual?.status ?? "";
  const conversaHistorica = conversaAtual?.historico === true;
  const podeResponder = conversaHistorica || status === "escalado" || status === "em_atendimento";
  const primeiroIndiceKora = mensagens.findIndex((m) => m.origem === "kora");
  const primeiroIndiceSistemaProprio = primeiroIndiceKora < 0
    ? -1
    : mensagens.findIndex((m, idx) => idx > primeiroIndiceKora && m.origem !== "kora");

  const abrirDoPainel = (id: string, textoPronto?: string, leadId?: string) => {
    setSelecionada(String(id));
    setAbaPagina("conversas");
    setListaSheet(false);
    setPerfilSheet(false);
    if (textoPronto) setTexto(textoPronto);
    setLeadProvador(leadId ? { leadId, conversaId: String(id) } : null);
    if (textoPronto) setTimeout(() => textoRef.current?.focus(), 0);
  };

  const rotuloComContagem = (label: string, n?: number) => (
    <>
      {label}
      {!!n && n > 0 && (
        <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
          {n}
        </span>
      )}
    </>
  );

  return (
    <div className="-m-6 flex h-[calc(100dvh-3.5rem)] w-[calc(100%+3rem)] max-w-[calc(100%+3rem)] min-w-0 flex-col overflow-x-hidden overflow-y-hidden">
      <Tabs
        value={abaPagina}
        onValueChange={(v) => setAbaPagina(v as typeof abaPagina)}
        className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex h-11 w-full min-w-0 shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-3">
          <TabsList className="h-8 w-max flex-nowrap bg-transparent p-0">
            <TabsTrigger value="conversas" className="h-8 shrink-0 text-sm">
              {rotuloComContagem("Conversas", contagemGrupos.conversa)}
            </TabsTrigger>
            <TabsTrigger value="oportunidades" className="h-8 shrink-0 text-sm">
              {rotuloComContagem("Oportunidades", contagens.oportunidades)}
            </TabsTrigger>
            <TabsTrigger value="provador" className="h-8 shrink-0 text-sm">
              {rotuloComContagem("Provador", contagens.provador)}
            </TabsTrigger>
            <TabsTrigger value="abandonadas" className="h-8 shrink-0 text-sm">Abandonadas</TabsTrigger>
            <TabsTrigger value="cobrancas" className="h-8 shrink-0 text-sm">Cobranças</TabsTrigger>
            <TabsTrigger value="consulta" className="h-8 shrink-0 text-sm">Consultar Transação</TabsTrigger>
            <TabsTrigger value="rapidas" className="h-8 shrink-0 text-sm">Mensagens rápidas</TabsTrigger>
            <TabsTrigger value="aprendizado" className="h-8 shrink-0 text-sm">Aprendizado da Anna</TabsTrigger>
            <TabsTrigger value="carrinhos" className="h-8 shrink-0 text-sm">
              {rotuloComContagem("Carrinhos abandonados", contagens.carrinhos)}
            </TabsTrigger>
            <TabsTrigger value="cancelados" className="h-8 shrink-0 text-sm">
              {rotuloComContagem("Pedidos cancelados", contagens.cancelados)}
            </TabsTrigger>
            <TabsTrigger value="kanban" className="h-8 shrink-0 text-sm">Kanban do funil</TabsTrigger>
            <TabsTrigger value="cashback" className="h-8 shrink-0 text-sm">Cashback</TabsTrigger>
          </TabsList>
          {abaPagina === "conversas" && colunasAjustaveis && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 shrink-0 text-xs text-muted-foreground"
              onClick={restaurarLarguras}
            >
              Restaurar larguras
            </Button>
          )}
        </div>

        <TabsContent value="oportunidades" className="m-0 min-h-0 w-full min-w-0 flex-1 overflow-auto p-4">
          <OportunidadesTab
            onAbrirConversa={(id) => abrirDoPainel(id)}
            onContagem={(n) => setContagem("oportunidades", n)}
          />
        </TabsContent>

        <TabsContent value="provador" className="m-0 min-h-0 w-full min-w-0 flex-1 overflow-auto p-4">
          <ProvadorVirtualConteudo
            semCabecalho
            onAbrirConversa={abrirDoPainel}
            onContagem={(n) => setContagem("provador", n)}
          />
        </TabsContent>

        <TabsContent value="carrinhos" className="m-0 min-h-0 w-full min-w-0 flex-1 overflow-auto p-4">
          <CarrinhoAbandonadoConteudo
            onAbrirConversa={(id) => abrirDoPainel(id)}
            onContagem={(n) => setContagem("carrinhos", n)}
          />
        </TabsContent>

        <TabsContent value="cancelados" className="m-0 min-h-0 w-full min-w-0 flex-1 overflow-auto p-4">
          <PedidosCanceladosConteudo
            onAbrirConversa={(id) => abrirDoPainel(id)}
            onContagem={(n) => setContagem("cancelados", n)}
          />
        </TabsContent>

        <TabsContent value="kanban" className="m-0 min-h-0 w-full min-w-0 flex-1 overflow-auto p-4">
          <Tabs value={abaKanban} onValueChange={(v) => setAbaKanban(v as typeof abaKanban)} className="space-y-4">
            <TabsList>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="followups">Follow-ups</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
            <TabsContent value="kanban" className="m-0">
              <FunilKanbanConteudo onAbrirConversa={(id) => abrirDoPainel(id)} />
            </TabsContent>
            <TabsContent value="dashboard" className="m-0">
              <DashboardFunil onAbrirConversa={(id) => abrirDoPainel(id)} />
            </TabsContent>
            <TabsContent value="followups" className="m-0">
              <FilaFollowups />
            </TabsContent>
            <TabsContent value="templates" className="m-0">
              <TemplatesFollowup />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="cashback" className="m-0 min-h-0 w-full min-w-0 flex-1 overflow-auto p-4">
          <CashbackConteudo />
        </TabsContent>

        <TabsContent value="abandonadas" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          <AbandonadasTab />
        </TabsContent>


        <TabsContent value="cobrancas" className="m-0 min-h-0 flex-1 space-y-4 overflow-auto p-4">
          <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1 w-fit">
            {([
              ["pix", "Pix (Inter)"],
              ["links", "Links (cartão)"],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setAbaCobranca(v)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
                  abaCobranca === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {abaCobranca === "pix" ? (
            <>
              <LinkPagamentoCard />
              <CobrancasTab />
            </>
          ) : (
            <LinksPagamentoTab
              onAbrirConversa={(id) => {
                setSelecionada(id);
                setAbaPagina("conversas");
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="consulta" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          <ConsultarTransacaoTab />
        </TabsContent>

        <TabsContent value="rapidas" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          <MensagensRapidasTab />
        </TabsContent>

        <TabsContent value="aprendizado" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          <AprendizadoAnnaTab />
        </TabsContent>


        <TabsContent value="conversas" className="m-0 min-h-0 w-full min-w-0 max-w-full flex-1 overflow-hidden data-[state=active]:flex">
      <Colunas
        ajustavel={colunasAjustaveis}
        grupoRef={grupoColunasRef}
        onLayout={salvarLarguras}
        className="relative flex min-h-0 w-full min-w-0 max-w-full flex-1 overflow-hidden"
      >

        {listaSheet && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setListaSheet(false)}
            aria-hidden
          />
        )}

        {/* Lista de conversas */}
        <Coluna ajustavel={colunasAjustaveis} id="lista" order={1} defaultSize={largurasIniciais[0]} minSize={15} maxSize={40}>
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex h-full min-h-0 w-[85vw] max-w-[360px] min-w-0 flex-col overflow-hidden border-r border-border bg-card transition-transform",
            "md:static md:z-auto md:w-[320px] md:max-w-none md:shrink-0 md:translate-x-0 lg:w-[340px]",
            colunasAjustaveis && "lg:w-full",
            listaSheet ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="shrink-0 border-b border-border p-3 space-y-2">
            <Button size="sm" className="w-full" onClick={() => abrirNovaConversa(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova conversa
            </Button>
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              {([
                { v: "whatsapp", label: "WhatsApp", icon: MessageCircle, nao: naoLidasWhatsapp },
                { v: "site", label: "Chat do Site", icon: Globe, nao: naoLidasSite },
              ] as const).map((t) => {
                const Icone = t.icon;
                return (
                  <button
                    key={t.v}
                    onClick={() => setAba(t.v)}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-sm font-medium transition-colors",
                      aba === t.v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icone className="h-3.5 w-3.5" />
                    {t.label}
                    {t.nao > 0 && (
                      <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {t.nao}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {!modoHistorico && <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
              {([
                { v: "conversa", label: "Conversas", n: contagemGrupos.conversa },
                { v: "clique", label: "Cliques", n: contagemGrupos.clique },
                { v: "so_envio", label: "Só envios", n: contagemGrupos.so_envio },
              ] as const).map((g) => (
                <button
                  key={g.v}
                  onClick={() => setGrupoAba(g.v)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1 rounded-sm px-1.5 py-1.5 text-xs font-medium transition-colors",
                    grupoAba === g.v
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {g.label}
                  <span className="text-[10px] opacity-70">{g.n}</span>
                </button>
              ))}
            </div>}
            <div className="relative">

              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={buscaRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou telefone (tecle /)"
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {!modoHistorico && ([
                { v: "todas", label: "Todas" },
                { v: "nao_lidas", label: `Não lidas${totalNaoLidas ? ` (${totalNaoLidas})` : ""}` },
                { v: "lidas", label: "Lidas" },
              ] as const).map((f) => (
                <Button
                  key={f.v}
                  size="sm"
                  variant={filtroLeitura === f.v && (f.v !== "todas" || !filtroFila) ? "default" : "outline"}
                   className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    setFiltroLeitura(f.v);
                    if (f.v === "todas") setFiltroFila(null);
                    else if (filtroFila !== "em_atendimento") setFiltroFila(null);
                  }}
                >
                  {f.label}
                </Button>
              ))}
              {!modoHistorico && (
                <Button
                  size="sm"
                  variant={filtroFila === "falhas" ? "default" : "outline"}
                  className={cn(
                    "h-7 px-2.5 text-xs gap-1",
                    filtroFila === "falhas"
                      ? "bg-danger text-white hover:bg-danger/90"
                      : "border-danger/40 text-danger hover:text-danger",
                  )}
                  onClick={() => {
                    if (filtroFila === "falhas") {
                      setFiltroFila(null);
                      return;
                    }
                    setFiltroFila("falhas");
                    setFiltroLeitura("todas");
                  }}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {`Não enviadas${totalFalhas ? ` (${totalFalhas})` : ""}`}
                </Button>
              )}
              {!modoHistorico && ([

                { v: "atencao", label: `Precisam de atenção${totalAtencao ? ` (${totalAtencao})` : ""}` },
                { v: "automacao", label: `Automações${totalAutomacoes ? ` (${totalAutomacoes})` : ""}` },
                { v: "em_atendimento", label: `Em atendimento${totalEmAtendimento ? ` (${totalEmAtendimento})` : ""}` },
              ] as const).map((f) => (
                <Button
                  key={f.v}
                  size="sm"
                  variant={filtroFila === f.v ? "default" : "outline"}
                   className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    if (filtroFila === f.v) {
                      setFiltroFila(null);
                      return;
                    }
                    setFiltroFila(f.v);
                    if (f.v !== "em_atendimento") setFiltroLeitura("todas");
                  }}
                >
                  {f.label}
                </Button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant={tagsFiltro.length ? "secondary" : "outline"}
                    className="h-7 px-2.5 text-xs"
                    disabled={modoHistorico}
                  >
                    Tags{tagsFiltro.length ? ` (${tagsFiltro.length})` : ""}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3 space-y-2" align="start">
                  {todasTags.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma tag cadastrada.</p>
                  )}
                  <div className="max-h-52 overflow-auto space-y-2">
                    {todasTags.map((t) => (
                      <label key={String(t.id)} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={tagsFiltro.includes(String(t.id))}
                          onCheckedChange={(v) =>
                            setTagsFiltro((prev) =>
                              v ? [...prev, String(t.id)] : prev.filter((x) => x !== String(t.id)),
                            )
                          }
                        />
                        <TagChip tag={t} />
                      </label>
                    ))}
                  </div>
                  {tagsFiltro.length > 0 && (
                    <Button size="sm" variant="ghost" className="w-full h-7 text-[11px]" onClick={() => setTagsFiltro([])}>
                      Limpar filtro
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
              <Button
                size="sm"
                variant={modoHistorico ? "default" : "outline"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setModoHistorico((ativo) => !ativo)}
              >
                Histórico
              </Button>
              {modoHistorico && (
                <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 text-xs">
                  <Checkbox checked={soKora} onCheckedChange={(v) => setSoKora(!!v)} />
                  Só Kora
                </label>
              )}
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            {(modoHistorico ? carregandoHistorico : carregandoConversas) && (
              <p className="p-4 text-sm text-muted-foreground">Carregando conversas…</p>
            )}
            {!(modoHistorico ? carregandoHistorico : carregandoConversas) && filtradas.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
            )}
            {(() => {
              let grupoAnterior: string | null = null;
              return filtradas.map((c) => {
              const nome = nomeConversa(c);
              const site = ehSite(c);
              const ativa = String(c.id) === selecionada;
              const prio = modoHistorico ? "" : (c.prioridade ?? "").toLowerCase();
              const naoLida = !modoHistorico && !!c.nao_lida;
              const atencao = modoHistorico ? undefined : atencaoDe(c);
              const urg = modoHistorico ? "normal" : urgenciaDeNivel(atencao?.nivel);
              const faixa = modoHistorico ? "border-l-muted-foreground/30" : classeFaixa(c);
              const grupo = modoFila || modoHistorico ? null : grupoDia(chaveData(c));
              let cabecalho: JSX.Element | null = null;
              if (grupo && grupo !== grupoAnterior) {
                grupoAnterior = grupo;
                cabecalho = (
                  <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {grupo}
                  </div>
                );
              }
              return (
                <div key={String(c.id)}>
                {cabecalho}
                <button
                  onClick={() => {
                    if (longPressRef.current.disparado) {
                      longPressRef.current.disparado = false;
                      return;
                    }
                    abrirConversa(c);
                  }}
                  onTouchStart={() => {
                    if (modoHistorico) return;
                    longPressRef.current.disparado = false;
                    longPressRef.current.timer = setTimeout(() => {
                      longPressRef.current.disparado = true;
                      setMenuLeituraAberto(String(c.id));
                    }, 500);
                  }}
                  onTouchEnd={() => {
                    if (longPressRef.current.timer) clearTimeout(longPressRef.current.timer);
                  }}
                  onTouchMove={() => {
                    if (longPressRef.current.timer) clearTimeout(longPressRef.current.timer);
                  }}
                  className={cn(
                    "group relative w-full text-left px-4 py-3 border-b border-border/60 border-l-[3px] transition-colors hover:bg-accent/60",
                    faixa,
                    ativa && "bg-accent",
                    naoLida && !ativa && "bg-primary/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-1.5">
                      {naoLida && <span className="h-2.5 w-2.5 rounded-full bg-success shrink-0" />}
                      {prio === "alta" && <span className="h-2 w-2 rounded-full bg-danger shrink-0" />}
                      {prio === "media" && <span className="h-2 w-2 rounded-full bg-warning shrink-0" />}
                      <div className="min-w-0">
                         <p className={cn("text-base truncate flex items-center gap-1.5", naoLida || urg === "quente" ? "font-bold" : "font-medium")}>
                          {site ? (
                            <Globe className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Chat do site" />
                          ) : (
                            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-success" aria-label="WhatsApp" />
                          )}
                          <span className="truncate">{nome}</span>
                          {nomeSoDoWhatsApp(c) && <BadgeViaWhatsApp />}
                          {!modoHistorico && c.falha_envio && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger whitespace-nowrap">
                              <AlertTriangle className="h-3 w-3" />
                              Não enviada
                            </span>
                          )}

                        </p>
                        <p className="text-xs text-muted-foreground">{identificadorConversa(c)}</p>
                        <BadgeSinal conversa={c} urg={urg} />
                        <ChipsMotivos motivos={atencao?.motivos} />
                        {site && c.telefone_real && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] text-success">
                            <Phone className="h-3 w-3" />
                            {formatarTelefone(c.telefone_real)}
                          </span>
                        )}
                      </div>
                    </div>

                     <span className="flex items-center gap-1 shrink-0">
                       {!modoHistorico && (
                         <DropdownMenu
                           open={menuLeituraAberto === String(c.id)}
                           onOpenChange={(aberto) => setMenuLeituraAberto(aberto ? String(c.id) : null)}
                         >
                           <DropdownMenuTrigger asChild>
                             <span
                               role="button"
                               aria-label={c.nao_lida ? "Marcar como lida" : "Marcar como não lida"}
                               onClick={(e) => e.stopPropagation()}
                               className={cn(
                                 "h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground",
                                 menuLeituraAberto === String(c.id)
                                   ? "inline-flex opacity-100"
                                   : "hidden opacity-0 group-hover:opacity-100 md:inline-flex",
                               )}
                             >
                               <Mail className="h-3.5 w-3.5" />
                             </span>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                             {c.nao_lida ? (
                               <DropdownMenuItem onSelect={() => marcarLeitura(c.id, false)}>
                                 <MailOpen className="mr-2 h-4 w-4" />
                                 Marcar como lida
                               </DropdownMenuItem>
                             ) : (
                               <DropdownMenuItem onSelect={() => marcarLeitura(c.id, true)}>
                                 <Mail className="mr-2 h-4 w-4" />
                                 Marcar como não lida
                               </DropdownMenuItem>
                             )}
                           </DropdownMenuContent>
                         </DropdownMenu>
                       )}
                       <span className="text-xs text-muted-foreground whitespace-nowrap">
                         {tempoRelativo(c.ultima_mensagem_em ?? c.atualizado_em)}
                       </span>
                     </span>
                  </div>
                   {!modoHistorico && c.falha_envio ? (
                    <p className="text-sm mt-1 line-clamp-1 font-medium text-danger">
                      {`⚠ Não enviada: ${c.falha_envio_motivo ?? "a última mensagem não foi entregue."}`}
                    </p>
                  ) : (
                    <p className={cn("text-sm mt-1 line-clamp-1", naoLida ? "text-foreground font-medium" : "text-muted-foreground")}>
                      {c.ultima_mensagem ?? ""}
                    </p>
                  )}

                   {!modoHistorico && grupoAba === "clique" && (
                    <p className="mt-1 text-[11px]">
                      <span className="text-muted-foreground">Botão tocado: </span>
                      <span className="font-medium">
                        {c.ultima_entrada_texto ?? c.ultima_mensagem ?? "sem registro"}
                      </span>
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                     {modoHistorico ? (
                       <>
                         <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                           Finalizada
                         </span>
                         {c.tem_kora && (
                           <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                             Kora
                           </span>
                         )}
                       </>
                     ) : (
                       <>
                         <StatusPill status={c.status} aguardandoDesde={c.aguardando_desde} />
                         {(c.tags ?? []).map((t) => (
                           <TagChip key={String(t.id)} tag={t} />
                         ))}
                       </>
                     )}
                  </div>
                </button>
                </div>
              );
              });
            })()}

            {modoHistorico && temMaisHistorico && (
              <div className="p-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={carregandoMaisHistorico}
                  onClick={() => carregarMaisHistorico()}
                >
                  {carregandoMaisHistorico ? "Carregando…" : "Carregar mais"}
                </Button>
              </div>
            )}

            {clientesSemConversa.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Sem conversa ainda
                </div>
                {clientesSemConversa.map((cl, i) => (
                  <div
                    key={String(cl.tray_customer_id ?? cl.telefone ?? i)}
                    className="px-4 py-3 border-b border-border/60 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{cl.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{formatarTelefone(cl.telefone)}</p>
                      {cl.email && (
                        <p className="text-[11px] text-muted-foreground truncate">{cl.email}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] shrink-0"
                      disabled={!soDigitos(cl.telefone)}
                      onClick={() => abrirNovaConversa(cl.telefone)}
                    >
                      Iniciar conversa
                    </Button>
                  </div>
                ))}
              </>
            )}
          </ScrollArea>
        </aside>
        </Coluna>
        {colunasAjustaveis && (
          <ResizableHandle
            withHandle
            className="cursor-col-resize transition-colors hover:bg-accent data-[resize-handle-state=drag]:bg-primary/50"
          />
        )}

        {/* Thread */}
        <Coluna ajustavel={colunasAjustaveis} id="thread" order={2} defaultSize={largurasIniciais[1]} minSize={30}>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!conversaAtual ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <MessageCircle className="h-10 w-10 opacity-40" />
              <p className="text-sm">Selecione uma conversa para começar.</p>
            </div>

          ) : (
            <>
              <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-3">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 md:hidden"
                  onClick={() => setListaSheet(true)}
                  title="Ver conversas"
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
                  {ehSite(conversaAtual) ? (
                    <Globe className="h-4 w-4 text-primary" aria-label="Chat do site" />
                  ) : (
                    <MessageCircle className="h-4 w-4 text-primary" aria-label="WhatsApp" />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <h2 className="truncate text-sm font-semibold">{nomeConversa(conversaAtual)}</h2>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {identificadorConversa(conversaAtual)}
                  </span>
                  {nomeSoDoWhatsApp(conversaAtual) && <BadgeViaWhatsApp />}
                  <StatusPill status={conversaAtual.status} aguardandoDesde={conversaAtual.aguardando_desde} />
                  {rotuloAutomacao(atencaoDe(conversaAtual)) && (
                    <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                      {rotuloAutomacao(atencaoDe(conversaAtual))}
                    </span>
                  )}
                  {conversaAtual.status === "escalado" && conversaAtual.aguardando_desde && (
                    <SeloFila conversaId={conversaAtual.id} />
                  )}
                  {ehSite(conversaAtual) && conversaAtual.telefone_real && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {formatarTelefone(conversaAtual.telefone_real)}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!conversaHistorica && (
                    <Button size="sm" onClick={() => assumir.mutate()} disabled={assumir.isPending}>
                      <UserCheck className="mr-2 h-4 w-4" />
                      Assumir conversa
                    </Button>
                  )}
                  {!conversaHistorica && (status === "escalado" || status === "em_atendimento") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="hidden xl:inline-flex"
                      onClick={() => resolver.mutate()}
                      disabled={resolver.isPending}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Marcar como resolvido
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-9 w-9" title="Mais ações">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onSelect={() => setCobrancaAberta(true)}>
                        <QrCode className="mr-2 h-4 w-4" />
                        Gerar cobrança Pix
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setLinkPagamentoAberto(true)}>
                        <Link2 className="mr-2 h-4 w-4" />
                        Gerar link de pagamento
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setProporCarrinhoAberto(true)}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Propor carrinho
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setFreteAberto(true)}>
                        <Truck className="mr-2 h-4 w-4" />
                        Calcular frete
                      </DropdownMenuItem>
                      {!conversaHistorica && (status === "escalado" || status === "em_atendimento") && (
                        <DropdownMenuItem
                          className="xl:hidden"
                          onSelect={() => resolver.mutate()}
                          disabled={resolver.isPending}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Marcar como resolvido
                        </DropdownMenuItem>
                      )}
                      {!conversaHistorica && status !== "bot_ativo" && (
                        <DropdownMenuItem onSelect={() => reativarBot.mutate()} disabled={reativarBot.isPending}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Reativar bot
                        </DropdownMenuItem>
                      )}
                      {!conversaHistorica && (
                        <DropdownMenuItem onSelect={() => marcarNaoLidaEFechar()}>
                          <MailOpen className="mr-2 h-4 w-4" />
                          Marcar como não lida
                        </DropdownMenuItem>
                      )}
                      {!conversaHistorica && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setExcluirAberta(true)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir conversa
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <AlertDialog open={excluirAberta} onOpenChange={setExcluirAberta}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir esta conversa?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Apaga a conversa e todas as mensagens do painel. Uma cópia fica guardada e pode ser
                          restaurada pelo suporte técnico. Se a cliente escrever de novo, uma conversa nova é criada.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <Input
                        placeholder="Motivo (opcional)"
                        value={motivoExclusao}
                        onChange={(e) => setMotivoExclusao(e.target.value)}
                      />
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setMotivoExclusao("")}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={(e) => {
                            e.preventDefault();
                            excluirConversa.mutate();
                          }}
                          disabled={excluirConversa.isPending}
                        >
                          {excluirConversa.isPending ? "Excluindo..." : "Excluir"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hidden h-9 w-9 lg:inline-flex"
                    onClick={() => setPerfilAberto((v) => !v)}
                    title={perfilAberto ? "Esconder perfil da cliente" : "Mostrar perfil da cliente"}
                  >
                    <PanelRight className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 lg:hidden"
                    onClick={() => setPerfilSheet(true)}
                    title="Perfil da cliente"
                  >
                    <PanelRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {!conversaHistorica && (
                <div className="shrink-0 border-b border-border px-3 py-1.5">
                  <TagsConversa conversaId={conversaAtual.id} aplicadas={conversaAtual.tags ?? []} />
                </div>
              )}

              {conversaHistorica && (
                <div className="shrink-0 border-b border-border bg-muted/60 px-3 py-1 text-center text-xs text-muted-foreground">
                  Conversa finalizada. Mostrando o histórico.
                </div>
              )}

              <PropostaDaConversa
                conversaId={conversaAtual.id}
                propostaId={propostaId}
                telefone={conversaAtual.telefone_real || conversaAtual.telefone}
              />
              <CobrancasDaConversa conversaId={conversaAtual.id} />
              <LinksDaConversa conversaId={conversaAtual.id} />

              <ScrollArea className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden p-4 [&_[data-radix-scroll-area-viewport]]:!overflow-x-hidden">
                {carregandoMensagens && <p className="text-sm text-muted-foreground">Carregando mensagens…</p>}
                <div className="min-w-0 max-w-full space-y-3 overflow-x-hidden">
                  {mensagens.map((m, idx) => {
                    const saida = m.direcao === "saida";
                    const bot = saida && m.origem === "bot";
                    const kora = m.origem === "kora";
                    const tipo = (m.tipo ?? "").toLowerCase();
                    const sticker = tipo === "sticker" && !!m.media_url;
                    const tipoMidia = ehTipoMidia(tipo);
                    const midia = tipoMidia || !!m.media_url;
                    const mostrarTexto = !!m.conteudo && !sticker && !tipoMidia;
                    return (
                      <div key={m.id != null ? String(m.id) : `${m.criada_em ?? m.criado_em ?? ""}-${idx}`}>
                        {idx === primeiroIndiceKora && (
                          <div className="flex items-center gap-3 py-1.5 text-[11px] text-muted-foreground">
                            <Separator className="flex-1" />
                            <span className="shrink-0">Histórico importado da Kora</span>
                            <Separator className="flex-1" />
                          </div>
                        )}
                        {idx === primeiroIndiceSistemaProprio && (
                          <div className="flex items-center gap-3 py-1.5 text-[11px] text-muted-foreground">
                            <Separator className="flex-1" />
                            <span className="shrink-0">Atendimento no sistema próprio</span>
                            <Separator className="flex-1" />
                          </div>
                        )}
                        <div className={cn("flex min-w-0 max-w-full overflow-hidden", saida ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "min-w-0 max-w-[75%] overflow-hidden text-base break-words [overflow-wrap:anywhere] [word-break:break-word]",
                              sticker
                                ? "bg-transparent border-0 p-0"
                                : cn(
                                    "rounded-lg px-3 py-2 border",
                                    !saida && "bg-muted text-foreground border-border",
                                    saida && bot && "bg-info/10 text-foreground border-info/30",
                                    saida && !bot && !kora && "bg-primary/10 text-foreground border-primary/30",
                                    saida && kora && "bg-muted text-foreground border-border",
                                  ),
                            )}
                          >
                            {saida && !sticker && (
                              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                {bot ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                {kora ? "Kora" : bot ? "Bot" : "Atendente"}
                              </div>
                            )}
                            {midia && <MensagemMidia tipo={m.tipo} mediaUrl={m.media_url} conteudo={m.conteudo} />}
                            {mostrarTexto && <p className="max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]">{m.conteudo}</p>}
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[10px] text-muted-foreground">
                                {horaCurta(m.criada_em ?? m.criado_em ?? m.enviado_em)}
                              </span>
                              {saida && m.enviando && (
                                <Clock className="h-3 w-3 text-muted-foreground" aria-label="Enviando" />
                              )}
                              {saida && !m.enviando && (
                                <StatusEntrega status={m.status_entrega} erro={m.erro_entrega} />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={fimRef} />
                </div>
              </ScrollArea>

              <Separator />

              {podeResponder && !ehSite(conversaAtual) && dentroJanela === false ? (
                <div className="p-4 flex items-start gap-3 border-t-2 border-warning bg-warning/10">
                  <Lock className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-foreground">
                      Fora da janela de 24h. Envie um template para retomar a conversa.
                    </p>
                    <Button size="sm" onClick={() => setTemplateAberto(true)}>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar template
                    </Button>
                  </div>
                </div>
              ) : podeResponder ? (
                 <div className="shrink-0 border-t border-border px-2 py-1.5 space-y-1.5">
                  {erroJanela && (
                    <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3">
                      <AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                      <p className="text-sm text-danger">{erroJanela}</p>
                    </div>
                  )}
                  {previewUrl && (
                    <div className="flex items-start gap-3 rounded-md border border-border p-2">
                      <img src={previewUrl} alt="Prévia" className="h-20 w-20 rounded object-cover" />
                      <div className="flex-1 space-y-2">
                        <Input
                          value={legenda}
                          onChange={(e) => setLegenda(e.target.value)}
                          placeholder="Legenda (opcional)"
                          className="h-8 text-xs"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={confirmarEnvioImagem} disabled={enviandoImagem}>
                            {enviandoImagem ? "Enviando…" : "Enviar imagem"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={limparPreview} disabled={enviandoImagem}>
                            <X className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="relative flex min-w-0 max-w-full items-end gap-1 overflow-visible">
                    {listaRapidaAberta && (
                      <div className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-md rounded-md border border-border bg-popover shadow-lg">
                        <p className="border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
                          Mensagens rápidas: setas para escolher, Enter para inserir, Esc para fechar
                        </p>
                        <ListaRespostas
                          itens={rapidasFiltradas}
                          indice={indiceRapida}
                          onIndice={setIndiceRapida}
                          onEscolher={inserirResposta}
                        />
                      </div>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => selecionarArquivo(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                       className="h-8 w-8 shrink-0"
                      onClick={() => fileRef.current?.click()}
                      title="Enviar imagem"
                    >
                      <ImagePlus className="h-4 w-4" />
                    </Button>
                    {!ehSite(conversaAtual) && (
                      <SeletorFigurinhas
                        telefone={telefoneIdentificado}
                        conversaId={conversaAtual.id}
                        onEnviada={invalidarThread}
                      />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                       className="h-8 w-8 shrink-0"
                      onClick={() => setCatalogoAberto(true)}
                      title="Catálogo"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setTemplateAberto(true)}
                      title="Enviar template"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <BotaoRespostasRapidas onEscolher={inserirResposta} />
                    <Textarea
                      ref={textoRef}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder="Escreva sua resposta ou digite / para as mensagens rápidas"
                      rows={1}
                       className="min-h-8 max-h-24 min-w-0 flex-1 resize-none overflow-y-auto py-1.5"
                      onKeyDown={(e) => {
                        if (listaRapidaAberta) {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setIndiceRapida((i) => (i + 1) % rapidasFiltradas.length);
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setIndiceRapida((i) => (i - 1 + rapidasFiltradas.length) % rapidasFiltradas.length);
                            return;
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setTexto("");
                            return;
                          }
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            const escolhida = rapidasFiltradas[indiceRapida];
                            if (escolhida) inserirResposta(escolhida);
                            return;
                          }
                        }
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (texto.trim()) enviar.mutate(texto.trim());
                        }
                      }}
                    />
                    <Button
                      size="icon"
                       className="h-8 w-8 shrink-0 rounded-full"
                      onClick={() => texto.trim() && enviar.mutate(texto.trim())}
                      disabled={!texto.trim()}
                      title="Enviar"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {status === "resolvido"
                    ? "Conversa resolvida."
                    : "O bot está respondendo esta conversa."}
                </div>
              )}
            </>
          )}
        </section>
        </Coluna>

        {/* Painel lateral direito */}
        {perfilAberto && conversaAtual && (
          <>
            {colunasAjustaveis && (
              <ResizableHandle
                withHandle
                className="cursor-col-resize transition-colors hover:bg-accent data-[resize-handle-state=drag]:bg-primary/50"
              />
            )}
            <Coluna ajustavel={colunasAjustaveis} id="painel" order={3} defaultSize={largurasIniciais[2]} minSize={18} maxSize={45}>
              <aside className="hidden h-full min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden border-l border-border p-3 pb-8 lg:flex">
                <Card className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
                  <PerfilCliente conversaId={conversaAtual.id} autor={autor} telefone={conversaAtual.telefone} />
                  {telefoneIdentificado && (
                    <ProvadorBloco telefone={telefoneIdentificado} onUsarTexto={usarTextoPronto} />
                  )}
                  {telefoneIdentificado && <AtividadesRecentes telefone={telefoneIdentificado} />}
                </Card>
              </aside>
            </Coluna>
          </>
        )}

        <Sheet open={perfilSheet} onOpenChange={setPerfilSheet}>
           <SheetContent side="right" className="flex w-[92vw] max-w-[380px] flex-col overflow-hidden p-3 pb-8">
             <SheetTitle className="sr-only">Perfil da cliente</SheetTitle>
            {conversaAtual ? (
               <Card className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
                <PerfilCliente conversaId={conversaAtual.id} autor={autor} telefone={conversaAtual.telefone} />
                {telefoneIdentificado && <AtividadesRecentes telefone={telefoneIdentificado} />}
               </Card>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma conversa selecionada</p>
            )}
          </SheetContent>
        </Sheet>

      </Colunas>
        </TabsContent>
      </Tabs>

      <CatalogoDialog open={catalogoAberto} onOpenChange={setCatalogoAberto} onSelecionar={enviarProduto} />
      <NovaConversaDialog
        open={novaConversaAberta}
        onOpenChange={setNovaConversaAberta}
        telefoneInicial={telefoneNovaConversa}
        onConversaPronta={(id) => {
          setBusca("");
          setTermoBusca("");
          setSelecionada(String(id));
          queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversa"] });
        }}
      />
      {conversaAtual && (
        <CobrancaPixDialog
          open={cobrancaAberta}
          onOpenChange={setCobrancaAberta}
          conversaId={conversaAtual.id}
          nomeCliente={nomeConversa(conversaAtual)}
        />
      )}
      {conversaAtual && (
        <LinkPagamentoDialog
          open={linkPagamentoAberto}
          onOpenChange={setLinkPagamentoAberto}
          conversaId={conversaAtual.id}
          emailCliente={(conversaAtual as any).email ?? (conversaAtual as any).email_cliente ?? null}
          nomeCliente={nomeConversa(conversaAtual)}
        />
      )}
      {conversaAtual && (
        <EnviarTemplateDialog
          open={templateAberto}
          onOpenChange={setTemplateAberto}
          telefone={telefoneIdentificado ?? conversaAtual.telefone}
          conversaId={conversaAtual.id}
          autor={autor}
          onEnviado={() => {
            invalidarThread();
            queryClient.invalidateQueries({ queryKey: ["whatsapp-janela-24h", selecionada] });
          }}
        />
      )}
      {conversaAtual && (
        <ProporCarrinhoDialog
          open={proporCarrinhoAberto}
          onOpenChange={setProporCarrinhoAberto}
          conversaId={conversaAtual.id}
          telefone={telefoneIdentificado}
          emailCliente={(conversaAtual as any).email ?? (conversaAtual as any).email_cliente ?? null}
          nomeCliente={nomeConversa(conversaAtual)}
          onEnviada={(id) => setPropostaId(id)}
        />
      )}
      {conversaAtual && (
        <CalcularFreteDialog
          open={freteAberto}
          onOpenChange={setFreteAberto}
          nomeCliente={nomeConversa(conversaAtual)}
        />
      )}

    </div>

  );
}
