import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Truck, ShoppingCart, Plus, MoreHorizontal, PanelRight, Trash2, FileText, Clock, Mail, MailOpen,
  Reply, Copy, Pencil, ArrowLeft, ChevronUp, SlidersHorizontal,
  Loader2,
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
import { CobrancaPixDialog, CobrancasTab } from "@/components/atendimento/CobrancaPix";
import { LinksPagamentoTab } from "@/components/atendimento/LinksPagamento";
import { CobrancasConversa } from "@/components/atendimento/CobrancasConversa";
import { LinkPagamentoCard, LinkPagamentoDialog } from "@/components/atendimento/LinkPagamento";
import { CalcularFreteDialog } from "@/components/atendimento/CalcularFrete";
import { ProporCarrinhoDialog, PropostaDaConversa } from "@/components/atendimento/ProporCarrinho";
import { EnviarTemplateDialog } from "@/components/atendimento/EnviarTemplate";
import { ConferirNumeroDialog } from "@/components/atendimento/ConferirNumero";
import { Composer, type ComposerHandle } from "@/components/atendimento/Composer";
import { AvisosFila } from "@/components/atendimento/AvisosFila";

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
import { useIsMobile } from "@/hooks/use-mobile";

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



type Citacao = {
  id: number | string;
  direcao: "entrada" | "saida";
  tipo?: string | null;
  texto?: string | null;
  media_url?: string | null;
};

type Mensagem = {
  id?: number | string;
  wamid?: string | null;
  citada_id?: number | string | null;
  citada_direcao?: "entrada" | "saida" | null;
  citada_tipo?: string | null;
  citada_texto?: string | null;
  citada_media_url?: string | null;
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
  /** Momento (timestamp) em que o envio adiado vai acontecer, enquanto dá para desfazer. */
  aguardando_ate?: number;
};

/** Arquivo escolhido para envio (imagem ou vídeo), ainda na pré-visualização. */
type ItemAnexo = { chave: string; file: File; url: string; video: boolean };

/** Contagem regressiva do envio adiado, com o botão de desfazer. */
function ContagemDesfazer({ ate, onDesfazer }: { ate: number; onDesfazer: () => void }) {
  const calcular = () => Math.max(0, Math.ceil((ate - Date.now()) / 1000));
  const [resta, setResta] = useState(calcular);
  useEffect(() => {
    const t = setInterval(() => setResta(Math.max(0, Math.ceil((ate - Date.now()) / 1000))), 250);
    return () => clearInterval(t);
  }, [ate]);
  return (
    <div className="mt-1.5 flex items-center justify-end gap-2">
      <span className="text-[11px] text-muted-foreground">Enviando em {resta}s</span>
      <Button size="sm" variant="outline" className="h-9 px-4 text-xs font-medium" onClick={onDesfazer}>
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        Desfazer
      </Button>
    </div>
  );
}

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


/** Normaliza texto para busca: minúsculas e sem acento. */
function textoBusca(s?: string | null): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
/** Só os dígitos, para comparar pedaço de telefone. */
function digitosBusca(s?: string | null): string {
  return (s ?? "").replace(/\D/g, "");
}

type ItemConversaProps = {
  c: Conversa;
  ativa: boolean;
  modoHistorico: boolean;
  mostrarClique: boolean;
  atencao: any;
  faixa: string;
  menuAberto: boolean;
  longPressRef: React.MutableRefObject<{ timer: ReturnType<typeof setTimeout> | null; disparado: boolean }>;
  onAbrir: (c: Conversa) => void;
  onMenuChange: (id: string | null) => void;
  onMarcarLeitura: (id: string | number, naoLida: boolean) => void;
  mobile?: boolean;
};

/** Uma linha da lista de conversas. Memoizada: só repinta quando os próprios dados mudam. */
const ItemConversa = memo(function ItemConversa({
  c, ativa, modoHistorico, mostrarClique, atencao, faixa, menuAberto, longPressRef,
  onAbrir, onMenuChange, onMarcarLeitura, mobile = false,
}: ItemConversaProps) {
  const nome = nomeConversa(c);
  const site = ehSite(c);
  const prio = modoHistorico ? "" : (c.prioridade ?? "").toLowerCase();
  const naoLida = !modoHistorico && !!c.nao_lida;
  const urg = modoHistorico ? "normal" : urgenciaDeNivel(atencao?.nivel);
  const aguardando = !modoHistorico && c.status === "escalado" && !!c.aguardando_desde;
  const espera = aguardando
    ? `esperando há ${formatDistanceToNow(new Date(c.aguardando_desde as string), { locale: ptBR })}`
    : null;
  if (mobile) {
    const selos = [
      urg === "quente" || urg === "atencao" ? (urg === "quente" ? "Urgente" : "Atenção") : null,
      site ? "Site" : "WhatsApp",
      modoHistorico ? "Finalizada" : (c.status || null),
    ].filter(Boolean).slice(0, 2) as string[];
    return (
      <button
        type="button"
        onClick={() => onAbrir(c)}
        className={cn(
          "relative flex min-h-16 w-full items-center gap-3 border-b border-border/60 border-l-[3px] px-4 py-3 text-left active:bg-accent",
          faixa,
          ativa && "bg-accent",
          naoLida && !ativa && "bg-primary/5",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className={cn("truncate text-sm", naoLida || aguardando ? "font-bold" : "font-semibold")}>{nome}</p>
            {selos.map((selo) => (
              <span key={selo} className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                {selo}
              </span>
            ))}
          </div>
          <p className={cn("mt-1 truncate text-xs", c.falha_envio ? "font-medium text-danger" : "text-muted-foreground") }>
            {c.falha_envio ? `Não enviada: ${c.falha_envio_motivo ?? "falha no envio"}` : c.ultima_mensagem ?? identificadorConversa(c)}
          </p>
          {espera && <p className="mt-1 text-[11px] font-semibold text-warning">{espera}</p>}
        </div>
        <div className="flex min-w-10 shrink-0 flex-col items-end gap-1.5">
          <span className="text-[11px] text-muted-foreground">{horaCurta(c.ultima_mensagem_em ?? c.atualizado_em)}</span>
          {naoLida && <span className="min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-bold text-primary-foreground">1</span>}
        </div>
      </button>
    );
  }
  return (
                  <button
                  onClick={() => {
                    if (longPressRef.current.disparado) {
                      longPressRef.current.disparado = false;
                      return;
                    }
                    onAbrir(c);
                  }}
                  onTouchStart={() => {
                    if (modoHistorico) return;
                    longPressRef.current.disparado = false;
                    longPressRef.current.timer = setTimeout(() => {
                      longPressRef.current.disparado = true;
                      onMenuChange(String(c.id));
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
                           open={menuAberto}
                           onOpenChange={(aberto) => onMenuChange(aberto ? String(c.id) : null)}
                         >
                           <DropdownMenuTrigger asChild>
                             <span
                               role="button"
                               aria-label={c.nao_lida ? "Marcar como lida" : "Marcar como não lida"}
                               onClick={(e) => e.stopPropagation()}
                               className={cn(
                                 "h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground",
                                 menuAberto
                                   ? "inline-flex opacity-100"
                                   : "hidden opacity-0 group-hover:opacity-100 md:inline-flex",
                               )}
                             >
                               <Mail className="h-3.5 w-3.5" />
                             </span>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                             {c.nao_lida ? (
                               <DropdownMenuItem onSelect={() => onMarcarLeitura(c.id, false)}>
                                 <MailOpen className="mr-2 h-4 w-4" />
                                 Marcar como lida
                               </DropdownMenuItem>
                             ) : (
                               <DropdownMenuItem onSelect={() => onMarcarLeitura(c.id, true)}>
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

                   {!modoHistorico && mostrarClique && (
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
  );
});


type BalaoMensagemProps = {
  m: Mensagem;
  divisorKora: boolean;
  divisorProprio: boolean;
  destacado: boolean;
  menuAberto: boolean;
  toqueRef: React.MutableRefObject<{ x: number; y: number; timer: ReturnType<typeof setTimeout> | null }>;
  onRegistrarRef: (chave: string, el: HTMLDivElement | null) => void;
  onResponder: (m: Mensagem) => void;
  onCopiar: (texto: string) => void;
  onAbrirMenu: (chave: string | null) => void;
  onIrParaMensagem: (id?: number | string | null) => void;
  onReenviar: (m: Mensagem) => void;
  onDescartar: (id: number) => void;
  onEnviarTemplate: () => void;
  onDesfazer: (id: number) => void;
  onExcluir: (m: Mensagem) => void;
};

/** Um balão da conversa. Memoizado: só repinta quando a própria mensagem muda. */
const BalaoMensagem = memo(function BalaoMensagem({
  m, divisorKora, divisorProprio, destacado, menuAberto, toqueRef, onRegistrarRef,
  onResponder, onCopiar, onAbrirMenu, onIrParaMensagem, onReenviar, onDescartar, onEnviarTemplate,
  onDesfazer, onExcluir,
}: BalaoMensagemProps) {
                    const saida = m.direcao === "saida";
                    const bot = saida && m.origem === "bot";
                    const kora = m.origem === "kora";
                    const tipo = (m.tipo ?? "").toLowerCase();
                    const sticker = tipo === "sticker" && !!m.media_url;
                    const tipoMidia = ehTipoMidia(tipo);
                    const midia = tipoMidia || !!m.media_url;
                    const mostrarTexto = !!m.conteudo && !sticker && !tipoMidia;
                    const falhou = saida && m.status_entrega === "falhou" && !kora;
                    const motivoFalha = m.erro_entrega ?? "Não foi possível entregar a mensagem.";
                    const pedeTemplate = falhou && ehMotivoJanela(motivoFalha);
                    const chaveBalao = m.id != null ? String(m.id) : "";
                    const otimista = typeof m.id === "number" && m.id < 0;
                    const podeCitar = !kora && !otimista && m.id != null;
                    const temCitada = m.citada_id != null || !!m.citada_texto;
                    const aguardando = typeof m.aguardando_ate === "number";
                    const podeExcluir = saida && !aguardando && !otimista && m.id != null;
                    
                    

                    return (
                      <div>
                        {divisorKora && (
                          <div className="flex items-center gap-3 py-1.5 text-[11px] text-muted-foreground">
                            <Separator className="flex-1" />
                            <span className="shrink-0">Histórico importado da Kora</span>
                            <Separator className="flex-1" />
                          </div>
                        )}
                        {divisorProprio && (
                          <div className="flex items-center gap-3 py-1.5 text-[11px] text-muted-foreground">
                            <Separator className="flex-1" />
                            <span className="shrink-0">Atendimento no sistema próprio</span>
                            <Separator className="flex-1" />
                          </div>
                        )}
                        <div className={cn("group relative flex min-w-0 max-w-full overflow-hidden", saida ? "justify-end" : "justify-start")}>
                          {podeCitar && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "absolute top-0 hidden h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 lg:flex",
                                saida ? "right-full mr-1" : "left-full ml-1",
                              )}
                              onClick={() => onResponder(m)}
                              title="Responder"
                            >
                              <Reply className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <div
                            ref={(el) => onRegistrarRef(chaveBalao, el)}
                            onTouchStart={(e) => {
                              if (!podeCitar) return;
                              const t = e.touches[0];
                              toqueRef.current.x = t.clientX;
                              toqueRef.current.y = t.clientY;
                              if (toqueRef.current.timer) clearTimeout(toqueRef.current.timer);
                              toqueRef.current.timer = setTimeout(() => onAbrirMenu(chaveBalao), 500);
                            }}
                            onTouchMove={(e) => {
                              if (!podeCitar) return;
                              const t = e.touches[0];
                              const dx = t.clientX - toqueRef.current.x;
                              const dy = Math.abs(t.clientY - toqueRef.current.y);
                              if (Math.abs(dx) > 10 || dy > 10) {
                                if (toqueRef.current.timer) clearTimeout(toqueRef.current.timer);
                                toqueRef.current.timer = null;
                              }
                              if (dx > 60 && dy < 40) {
                                toqueRef.current.x = t.clientX + 9999;
                                onResponder(m);
                              }
                            }}
                            onTouchEnd={() => {
                              if (toqueRef.current.timer) clearTimeout(toqueRef.current.timer);
                              toqueRef.current.timer = null;
                            }}
                            className={cn(
                              "min-w-0 max-w-[75%] overflow-hidden text-base break-words [overflow-wrap:anywhere] [word-break:break-word]",
                              destacado && "ring-2 ring-primary ring-offset-2 ring-offset-background transition-shadow",
                              sticker && !falhou
                                ? "bg-transparent border-0 p-0"
                                : cn(
                                    "rounded-lg px-3 py-2 border",
                                    !saida && "bg-muted text-foreground border-border",
                                    saida && bot && "bg-info/10 text-foreground border-info/30",
                                    saida && !bot && !kora && "bg-primary/10 text-foreground border-primary/30",
                                    saida && kora && "bg-muted text-foreground border-border",
                                    falhou && "bg-danger/10 text-foreground border-danger/50",
                                  ),
                            )}

                          >
                            {saida && !sticker && (
                              <div className={cn("flex items-center gap-1 text-[10px] uppercase tracking-wider mb-1", falhou ? "text-danger" : "text-muted-foreground")}>
                                {falhou ? <AlertTriangle className="h-3 w-3" /> : bot ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                {kora ? "Kora" : bot ? "Bot" : "Atendente"}
                              </div>
                            )}

                            {temCitada && (
                              <button
                                type="button"
                                onClick={() => onIrParaMensagem(m.citada_id)}
                                className="mb-1.5 flex w-full items-center gap-2 rounded-md bg-background/60 py-1 pl-0 pr-2 text-left"
                              >
                                <span className="h-8 w-1 shrink-0 rounded-full bg-primary" />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[11px] font-semibold text-primary">
                                    {m.citada_direcao === "entrada" ? "Cliente" : "Você"}
                                  </span>
                                  <span className="line-clamp-2 block text-xs text-muted-foreground">
                                    {m.citada_texto?.trim() || (m.citada_media_url ? "Imagem" : "Mensagem")}
                                  </span>
                                </span>
                                {m.citada_media_url && (
                                  <img src={m.citada_media_url} alt="Citada" className="h-9 w-9 shrink-0 rounded object-cover" />
                                )}
                              </button>
                            )}

                            {menuAberto && (
                              <div className="mb-1.5 flex gap-1.5">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onResponder(m)}>
                                  <Reply className="mr-1 h-3 w-3" />
                                  Responder
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    onCopiar(m.conteudo ?? "");
                                    onAbrirMenu(null);
                                  }}
                                >
                                  <Copy className="mr-1 h-3 w-3" />
                                  Copiar texto
                                </Button>
                                 {podeExcluir && (
                                   <Button
                                     size="sm"
                                     variant="ghost"
                                     className="h-7 px-2 text-xs text-danger hover:text-danger"
                                     onClick={() => {
                                       onAbrirMenu(null);
                                       onExcluir(m);
                                     }}
                                   >
                                     <Trash2 className="mr-1 h-3 w-3" />
                                     Excluir
                                   </Button>
                                 )}
                                 <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onAbrirMenu(null)} title="Fechar">
                                   <X className="h-3 w-3" />
                                 </Button>
                              </div>
                            )}


                            {midia && <MensagemMidia tipo={m.tipo} mediaUrl={m.media_url} conteudo={m.conteudo} />}
                            {mostrarTexto && <p className="max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]">{m.conteudo}</p>}
                            {falhou && (
                              <div className="mt-2 space-y-1.5">
                                <p className="text-xs font-semibold text-danger">Não enviada</p>
                                <p className="text-xs text-danger/90">{motivoFalha}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {pedeTemplate ? (
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onEnviarTemplate()}>
                                      Enviar template
                                    </Button>
                                  ) : (
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onReenviar(m)}>
                                      Tentar de novo
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onCopiar(m.conteudo ?? "")}>
                                    Copiar texto
                                  </Button>
                                   {m.falha_local ? (
                                     <Button
                                       size="sm"
                                       variant="ghost"
                                       className="h-7 px-2 text-xs"
                                       onClick={() => typeof m.id === "number" && onDescartar(m.id)}
                                     >
                                       Descartar
                                     </Button>
                                   ) : (
                                     <Button
                                       size="sm"
                                       variant="ghost"
                                       className="h-7 px-2 text-xs text-danger hover:text-danger"
                                       onClick={() => onExcluir(m)}
                                     >
                                       <Trash2 className="mr-1 h-3 w-3" />
                                       Excluir
                                     </Button>
                                   )}
                                 </div>
                               </div>
                             )}

                             {aguardando && (
                               <ContagemDesfazer
                                 ate={m.aguardando_ate as number}
                                 onDesfazer={() => typeof m.id === "number" && onDesfazer(m.id)}
                               />
                             )}

                             <div className="flex items-center justify-end gap-1 mt-1">
                               <span className="text-[10px] text-muted-foreground">
                                 {horaCurta(m.criada_em ?? m.criado_em ?? m.enviado_em)}
                               </span>
                               {saida && !aguardando && m.enviando && (
                                 <Clock className="h-3 w-3 text-muted-foreground" aria-label="Enviando" />
                               )}
                               {saida && !aguardando && !m.enviando && (
                                 <StatusEntrega status={m.status_entrega} erro={m.erro_entrega} />
                               )}
                             </div>
                          </div>
                        </div>
                      </div>
                    );
});

export default function Atendimento() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [parametros, setParametros] = useSearchParams();
  const isMobile = useIsMobile();
  const [selecionada, setSelecionada] = useState<string | null>(() => parametros.get("conversa"));
  const conversaDoAvisoRef = useRef(parametros.get("conversa"));
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
  const [conferirNumero, setConferirNumero] = useState(false);
  const [modoHistorico, setModoHistorico] = useState(false);
  const [soKora, setSoKora] = useState(false);
  const [erroJanela, setErroJanela] = useState<string | null>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const [digitando, setDigitando] = useState(false);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [imagens, setImagens] = useState<ItemAnexo[]>([]);
  const [progressoUpload, setProgressoUpload] = useState<{ feitos: number; total: number } | null>(null);
  const [mensagemExcluir, setMensagemExcluir] = useState<Mensagem | null>(null);
  const [legenda, setLegenda] = useState("");
  const [citacao, setCitacao] = useState<Citacao | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [menuBalao, setMenuBalao] = useState<string | null>(null);
  const [destacada, setDestacada] = useState<string | null>(null);
  const balaoRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /** Guarda a citação usada no envio em curso (o estado é limpo na hora). */
  const citacaoRef = useRef<Citacao | null>(null);
  /** Controle do toque nos balões: arrastar para a direita responde, segurar abre o menu. */
  const toqueRef = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> | null }>({ x: 0, y: 0, timer: null });
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const areaMensagensRef = useRef<HTMLDivElement>(null);
  const obterViewport = useCallback(
    () =>
      (areaMensagensRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null) ?? null,
    [],
  );
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
  const [maisAbasAberto, setMaisAbasAberto] = useState(false);
  const [filtrosMobileAberto, setFiltrosMobileAberto] = useState(false);
  const entradaChatMobileRef = useRef(false);

  const abrirCatalogo = useCallback(() => setCatalogoAberto(true), []);
  const abrirTemplate = useCallback(() => setTemplateAberto(true), []);

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
    composerRef.current?.definirTexto(t);
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
    // rede de segurança: o tempo real cuida do resto. Pausa enquanto a consultora digita,
    // porque recarregar a lista no meio da digitação faz a tela engasgar.
    refetchInterval: digitando ? false : 15000,
    refetchOnWindowFocus: true,
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

  // Busca por nome ou telefone: filtro local instantâneo + servidor com debounce de 350ms
  useEffect(() => {
    const termo = busca.trim();
    if (!termo) {
      setTermoBusca("");
      return;
    }
    const t = setTimeout(() => setTermoBusca(termo), 350);
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

  // Busca ampla no servidor: todas as conversas, por pedaço do nome ou do número
  // em qualquer posição (aceita máscara, ignora o chat do site).
  const buscaServidor = !modoHistorico && termoBusca.length >= 2;
  const { data: outrasBrutas, isFetching: buscandoOutras } = useQuery({
    queryKey: ["whatsapp-buscar-conversas", termoBusca],
    enabled: buscaServidor,
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_buscar_conversas" as any, {
        p_termo: termoBusca,
        p_limite: 30,
      });
      if (error) throw error;
      return ((Array.isArray(data) ? data : []) as any[]);
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
      composerRef.current?.definirTexto(textoPronto);
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

  const PAGINA_MENSAGENS = 80;

  const { data: mensagensRecentes = [], isLoading: carregandoMensagens } = useQuery({
    queryKey: ["whatsapp-mensagens", selecionada],
    enabled: !!selecionada,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_get_mensagens_conversa" as any, {
        p_conversa_id: Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada),
        p_limite: PAGINA_MENSAGENS,
      });
      if (error) throw error;
      return (data ?? []) as Mensagem[];
    },
  });

  // Páginas anteriores carregadas sob demanda (botão no topo da lista).
  const [mensagensAnteriores, setMensagensAnteriores] = useState<Mensagem[]>([]);
  const [carregandoAnteriores, setCarregandoAnteriores] = useState(false);
  const [temAnteriores, setTemAnteriores] = useState(false);
  const ajusteScrollRef = useRef<number | null>(null);

  useEffect(() => {
    setMensagensAnteriores([]);
    setCarregandoAnteriores(false);
  }, [selecionada]);

  useEffect(() => {
    setTemAnteriores(mensagensRecentes.length >= PAGINA_MENSAGENS);
  }, [mensagensRecentes.length]);

  // A lista exibida junta as páginas antigas com as mensagens recentes (que
  // incluem os balões otimistas gravados no cache), sem duplicar por id.
  const mensagens = useMemo<Mensagem[]>(() => {
    if (mensagensAnteriores.length === 0) return mensagensRecentes;
    const vistos = new Set(mensagensRecentes.map((m) => String(m.id)));
    return [...mensagensAnteriores.filter((m) => !vistos.has(String(m.id))), ...mensagensRecentes];
  }, [mensagensAnteriores, mensagensRecentes]);

  const carregarAnteriores = useCallback(async () => {
    if (carregandoAnteriores) return;
    const maisAntiga = mensagens[0];
    const antesDe = (maisAntiga?.criada_em ?? maisAntiga?.criado_em) as string | undefined;
    if (!antesDe || !selecionada) return;
    const viewport = obterViewport();
    ajusteScrollRef.current = viewport ? viewport.scrollHeight : null;
    setCarregandoAnteriores(true);
    try {
      const { data, error } = await chamarRpc("whatsapp_get_mensagens_conversa" as any, {
        p_conversa_id: Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada),
        p_limite: PAGINA_MENSAGENS,
        p_antes_de: antesDe,
      });
      if (error) throw error;
      const novas = (data ?? []) as Mensagem[];
      setTemAnteriores(novas.length >= PAGINA_MENSAGENS);
      setMensagensAnteriores((atuais) => {
        const vistos = new Set(atuais.map((m) => String(m.id)));
        return [...novas.filter((m) => !vistos.has(String(m.id))), ...atuais];
      });
    } catch {
      ajusteScrollRef.current = null;
      toast({ title: "Não foi possível carregar as mensagens anteriores", variant: "destructive" });
    } finally {
      setCarregandoAnteriores(false);
    }
  }, [carregandoAnteriores, mensagens, selecionada]);

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

  /** Quantas conversas carregadas têm cada tag. */
  const contagemTags = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const c of conversas) {
      for (const t of c.tags ?? []) {
        const chave = String(t.id);
        mapa[chave] = (mapa[chave] ?? 0) + 1;
      }
    }
    return mapa;
  }, [conversas]);

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

  const abrirConversa = useCallback(async (c: Conversa) => {
    if (isMobile && !selecionada) {
      window.history.pushState({ atendimentoChat: true }, "", window.location.href);
      entradaChatMobileRef.current = true;
    }
    setSelecionada(String(c.id));
    setListaSheet(false);
    setErroJanela(null);
    if (modoHistorico || c.historico || !c.nao_lida) return;
    const { error } = await chamarRpc("whatsapp_marcar_lida" as any, {
      p_conversa_id: Number.isNaN(Number(c.id)) ? c.id : Number(c.id),
    });
    if (!error) queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversa"] });
  }, [isMobile, modoHistorico, queryClient, selecionada]);

  useEffect(() => {
    if (!isMobile) {
      entradaChatMobileRef.current = false;
      return;
    }
    const aoVoltar = () => {
      if (!selecionadaRef.current) return;
      entradaChatMobileRef.current = false;
      setSelecionada(null);
      setPerfilSheet(false);
    };
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, [isMobile]);

  const fecharChatMobile = useCallback(() => {
    if (entradaChatMobileRef.current) {
      window.history.back();
      return;
    }
    setSelecionada(null);
    setPerfilSheet(false);
  }, []);

  useEffect(() => {
    const idAviso = conversaDoAvisoRef.current;
    if (!idAviso || !conversaAtual || String(conversaAtual.id) !== idAviso) return;
    conversaDoAvisoRef.current = null;
    void abrirConversa(conversaAtual);
    setParametros((atuais) => {
      const novos = new URLSearchParams(atuais);
      novos.delete("conversa");
      return novos;
    }, { replace: true });
  }, [abrirConversa, conversaAtual, setParametros]);

  const marcarLeitura = useCallback(async (id: string | number, naoLida: boolean): Promise<boolean> => {
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
  }, [queryClient]);

  const marcarNaoLidaEFechar = async () => {
    if (!selecionada) return;
    const ok = await marcarLeitura(selecionada, true);
    if (!ok) return;
    setSelecionada(null);
    setListaSheet(false);
    setPerfilSheet(false);
    toast({ title: "Marcada como não lida" });
  };


  // Âncora de scroll: fim ao abrir, fim se já estava no fim, posição
  // preservada ao carregar mensagens anteriores.
  const noFimRef = useRef(true);
  const primeiraRolagemRef = useRef(true);
  const [temNovasAbaixo, setTemNovasAbaixo] = useState(false);

  useEffect(() => {
    primeiraRolagemRef.current = true;
    noFimRef.current = true;
    setTemNovasAbaixo(false);
  }, [selecionada]);

  useEffect(() => {
    const viewport = obterViewport();
    if (!viewport) return;
    const aoRolar = () => {
      const perto = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 120;
      noFimRef.current = perto;
      if (perto) setTemNovasAbaixo(false);
    };
    viewport.addEventListener("scroll", aoRolar, { passive: true });
    return () => viewport.removeEventListener("scroll", aoRolar);
  }, [selecionada]);

  const irAoFim = useCallback((suave = true) => {
    fimRef.current?.scrollIntoView({ behavior: suave ? "smooth" : "auto" });
    noFimRef.current = true;
    setTemNovasAbaixo(false);
  }, []);

  useEffect(() => {
    if (mensagens.length === 0) return;
    const viewport = obterViewport();
    if (ajusteScrollRef.current != null && viewport) {
      const anterior = ajusteScrollRef.current;
      ajusteScrollRef.current = null;
      viewport.scrollTop += viewport.scrollHeight - anterior;
      return;
    }
    if (primeiraRolagemRef.current) {
      primeiraRolagemRef.current = false;
      fimRef.current?.scrollIntoView({ behavior: "auto" });
      noFimRef.current = true;
      return;
    }
    if (noFimRef.current) {
      fimRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setTemNovasAbaixo(true);
    }
  }, [mensagens.length, selecionada]);

  // Esc cancela a citação em andamento
  useEffect(() => {
    if (!citacao) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCitacao(null);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [citacao]);

  /** Rola até a mensagem original e dá um destaque rápido. */
  const registrarBalaoRef = useCallback((chave: string, el: HTMLDivElement | null) => {
    if (chave) balaoRefs.current[chave] = el;
  }, []);

  const irParaMensagem = useCallback((id?: number | string | null) => {
    if (id == null) return;
    const alvo = balaoRefs.current[String(id)];
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: "smooth", block: "center" });
    setDestacada(String(id));
    setTimeout(() => setDestacada((atual) => (atual === String(id) ? null : atual)), 1400);
  }, []);

  /** Prepara a barra de citação acima da caixa de texto. */
  const responderCitando = useCallback((m: Mensagem) => {
    if (m.id == null) return;
    setCitacao({
      id: m.id,
      direcao: m.direcao,
      tipo: m.tipo,
      texto: m.conteudo,
      media_url: m.media_url,
    });
    setMenuBalao(null);
    setTimeout(() => composerRef.current?.focar(), 0);
  }, []);

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

  const removerMensagemOtimista = useCallback((idTemp: number) => {
    queryClient.setQueryData(["whatsapp-mensagens", selecionada], (antigas: Mensagem[] = []) =>
      (antigas ?? []).filter((m) => m.id !== idTemp),
    );
  }, [queryClient, selecionada]);

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

  /**
   * Segura o envio por 5 segundos para dar chance de desfazer.
   * O WhatsApp oficial não apaga mensagem entregue, então este é o único
   * jeito real de a cliente não receber.
   */
  const SEGUNDOS_DESFAZER = 5;
  const pendentesRef = useRef<Map<number, { timer: ReturnType<typeof setTimeout>; disparar: () => void; cancelar: () => void }>>(new Map());

  const agendarComDesfazer = (
    dadosBalao: Partial<Mensagem>,
    executar: () => void,
    devolver: () => void,
  ) => {
    const chave = ["whatsapp-mensagens", selecionada];
    const idTemp = inserirMensagemOtimista({
      ...dadosBalao,
      enviando: false,
      aguardando_ate: Date.now() + SEGUNDOS_DESFAZER * 1000,
    });
    const tirarBalao = () =>
      queryClient.setQueryData(chave, (antigas: Mensagem[] = []) => (antigas ?? []).filter((m) => m.id !== idTemp));
    const disparar = () => {
      pendentesRef.current.delete(idTemp);
      tirarBalao();
      executar();
    };
    const cancelar = () => {
      pendentesRef.current.delete(idTemp);
      tirarBalao();
      devolver();
    };
    const timer = setTimeout(disparar, SEGUNDOS_DESFAZER * 1000);
    pendentesRef.current.set(idTemp, { timer, disparar, cancelar });
    return idTemp;
  };

  /** Desfaz um envio ainda na contagem: nada sai e o conteúdo volta para a caixa. */
  const desfazerEnvio = useCallback((idTemp: number) => {
    const pendente = pendentesRef.current.get(idTemp);
    if (!pendente) return;
    clearTimeout(pendente.timer);
    pendente.cancelar();
  }, []);

  /** Dispara na hora tudo o que está em contagem (troca de conversa, sair da tela). */
  const dispararPendentes = useCallback(() => {
    const lista = [...pendentesRef.current.values()];
    for (const p of lista) {
      clearTimeout(p.timer);
      p.disparar();
    }
  }, []);

  useEffect(() => () => dispararPendentes(), [selecionada, dispararPendentes]);

  useEffect(() => {
    const aoSair = () => dispararPendentes();
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [dispararPendentes]);

  /** Reenvia o mesmo texto pelo fluxo normal de envio. */
  const reenviarMensagem = useCallback((m: Mensagem) => {
    const conteudo = (m.conteudo ?? "").trim();
    if (!conteudo) return;
    if (typeof m.id === "number" && m.id < 0) removerMensagemOtimista(m.id);
    enviar.mutate(conteudo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removerMensagemOtimista]);

  const copiarTextoMensagem = useCallback(async (conteudo: string) => {
    try {
      await navigator.clipboard.writeText(conteudo);
      toast({ title: "Texto copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  }, []);


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
          responder_a_id: citacaoRef.current?.id ?? null,
        },
      });
      if (error) throw error;
      return data;
    },
    onMutate: (conteudo: string) => {
      setErroJanela(null);
      const citada = citacao;
      citacaoRef.current = citada;
      setCitacao(null);
      return {
        idTemp: inserirMensagemOtimista({
          conteudo,
          tipo: "texto",
          citada_id: citada?.id ?? null,
          citada_direcao: citada?.direcao ?? null,
          citada_tipo: citada?.tipo ?? null,
          citada_texto: citada?.texto ?? null,
          citada_media_url: citada?.media_url ?? null,
        }),
        conteudo,
      };
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
      if (contexto?.conteudo && !composerRef.current?.obterTexto().trim()) {
        composerRef.current?.definirTexto(contexto.conteudo);
      }
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

  const MAX_IMAGENS = 10;
  /** Limites do WhatsApp: 5 MB para imagem, 16 MB para vídeo. */
  const MAX_BYTES_IMAGEM = 5 * 1024 * 1024;
  const MAX_BYTES_VIDEO = 16 * 1024 * 1024;
  const emMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1).replace(".", ",");

  const enviarImagem = async (
    mediaUrl: string,
    conteudo: string,
    responderA?: number | string | null,
    tipo: "imagem" | "video" = "imagem",
  ) => {
    if (!conversaAtual) throw new Error("Nenhuma conversa selecionada");
    const telefoneEnvio = conversaAtual.telefone_real || conversaAtual.telefone;
    const idTemp = inserirMensagemOtimista({
      conteudo,
      tipo,
      media_url: mediaUrl,
      citada_id: responderA ?? null,
    });
    try {
      const { data: corpo, error } = await supabase.functions.invoke("whatsapp-enviar-imagem-humano", {
        body: {
          telefone: telefoneEnvio,
          conversa_id: conversaAtual.id,
          tipo: tipo === "video" ? "video" : "image",
          midia_url: mediaUrl,
          imagem_url: tipo === "video" ? undefined : mediaUrl,
          legenda: conteudo || "",
          autor: user?.email ?? null,
          responder_a_id: responderA ?? null,
        },
      });
      if (error) throw error;
      if ((corpo as any)?.error) throw new Error((corpo as any).error);
    } catch (e: any) {
      marcarMensagemFalhou(
        idTemp,
        e?.message ?? (tipo === "video" ? "Não foi possível enviar o vídeo." : "Não foi possível enviar a imagem."),
      );
      throw e;
    }
    queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens", selecionada] });
  };

  /** Envia texto com a janela de desfazer de 5 segundos. */
  const enviarTextoComDesfazer = (conteudo: string) => {
    agendarComDesfazer(
      {
        conteudo,
        tipo: "texto",
        citada_id: citacao?.id ?? null,
        citada_direcao: citacao?.direcao ?? null,
        citada_tipo: citacao?.tipo ?? null,
        citada_texto: citacao?.texto ?? null,
        citada_media_url: citacao?.media_url ?? null,
      },
      () => enviar.mutate(conteudo),
      () => composerRef.current?.definirTexto(conteudo),
    );
  };

  /** Tira a mensagem do painel. A cliente pode continuar vendo no WhatsApp dela. */
  const confirmarExclusaoMensagem = async () => {
    const alvo = mensagemExcluir;
    setMensagemExcluir(null);
    if (!alvo || alvo.id == null) return;
    const idAlvo = alvo.id;
    const { data, error } = await chamarRpc("whatsapp_mensagem_excluir" as any, {
      p_mensagem_id: typeof idAlvo === "string" && !Number.isNaN(Number(idAlvo)) ? Number(idAlvo) : idAlvo,
      p_por: user?.email ?? null,
    });
    const resposta = (Array.isArray(data) ? data[0] : data) as
      | { ok?: boolean; cliente_ainda_ve?: boolean; motivo?: string }
      | null;
    if (error || !resposta?.ok) {
      toast({
        title: "Não foi possível excluir",
        description: error?.message ?? resposta?.motivo ?? "-",
        variant: "destructive",
      });
      return;
    }
    queryClient.setQueryData(["whatsapp-mensagens", selecionada], (antigas: Mensagem[] = []) =>
      (antigas ?? []).filter((m) => String(m.id) !== String(idAlvo)),
    );
    toast({
      title: resposta.cliente_ainda_ve
        ? "Excluída do painel. A cliente ainda vê no WhatsApp."
        : "Mensagem excluída.",
    });
  };

  /** Acrescenta imagens e vídeos à faixa de pré-visualização, respeitando limites. */
  const adicionarImagens = (lista: File[]) => {
    const validas: ItemAnexo[] = [];
    for (const f of lista) {
      const video = f.type.startsWith("video/");
      if (!video && !f.type.startsWith("image/")) continue;
      if (video && f.size > MAX_BYTES_VIDEO) {
        toast({
          title: `O WhatsApp só aceita vídeo de até 16 MB. Esse tem ${emMb(f.size)} MB.`,
          variant: "destructive",
        });
        continue;
      }
      if (!video && f.size > MAX_BYTES_IMAGEM) {
        toast({
          title: `O WhatsApp só aceita imagem de até 5 MB. Essa tem ${emMb(f.size)} MB.`,
          variant: "destructive",
        });
        continue;
      }
      validas.push({
        chave: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file: f,
        url: URL.createObjectURL(f),
        video,
      });
    }
    if (validas.length === 0) return;
    setImagens((atuais) => {
      const total = [...atuais, ...validas];
      if (total.length > MAX_IMAGENS) {
        toast({ title: `Dá para enviar até ${MAX_IMAGENS} arquivos por vez`, variant: "destructive" });
        total.slice(MAX_IMAGENS).forEach((i) => URL.revokeObjectURL(i.url));
      }
      return total.slice(0, MAX_IMAGENS);
    });
    // O texto já digitado vira a legenda do primeiro anexo
    const doCampo = composerRef.current?.obterTexto().trim() ?? "";
    setLegenda((atual) => (atual.trim() ? atual : doCampo));
    if (doCampo) composerRef.current?.definirTexto("");
  };

  const removerImagem = (chave: string) => {
    setImagens((atuais) => {
      const alvo = atuais.find((i) => i.chave === chave);
      if (alvo) URL.revokeObjectURL(alvo.url);
      return atuais.filter((i) => i.chave !== chave);
    });
  };

  const limparPreview = () => {
    setImagens((atuais) => {
      atuais.forEach((i) => URL.revokeObjectURL(i.url));
      return [];
    });
    setLegenda("");

  };

  const confirmarEnvioImagem = async () => {
    if (imagens.length === 0) return;
    const fila = imagens;
    const legendaAtual = legenda.trim();
    const responderA = citacao?.id ?? null;
    setEnviandoImagem(true);
    setProgressoUpload({ feitos: 0, total: fila.length });
    const enviados: { item: ItemAnexo; url: string; legenda: string; responderA: number | string | null }[] = [];
    let falhas = 0;
    for (let i = 0; i < fila.length; i++) {
      const item = fila[i];
      try {
        const nome = item.file.name.replace(/[^\w.\-]/g, "_");
        const path = `envios/${Date.now()}-${i}-${nome}`;
        const { error: upErr } = await supabase.storage
          .from("whatsapp-media")
          .upload(path, item.file, { cacheControl: "31536000", upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
        enviados.push({
          item,
          url: pub.publicUrl,
          legenda: i === 0 ? legendaAtual : "",
          responderA: i === 0 ? responderA : null,
        });
      } catch {
        falhas += 1;
      }
      setProgressoUpload({ feitos: i + 1, total: fila.length });
    }
    setEnviandoImagem(false);
    setProgressoUpload(null);
    setCitacao(null);
    setImagens([]);
    setLegenda("");
    for (const env of enviados) {
      agendarComDesfazer(
        {
          conteudo: env.legenda,
          tipo: env.item.video ? "video" : "imagem",
          media_url: env.url,
          citada_id: env.responderA,
        },
        () => {
          void enviarImagem(env.url, env.legenda, env.responderA, env.item.video ? "video" : "imagem").catch(() => {
            /* a falha já aparece no balão */
          });
        },
        () => {
          setImagens((atuais) => [...atuais, env.item].slice(0, MAX_IMAGENS));
          if (env.legenda) setLegenda((atual) => atual || env.legenda);
        },
      );
    }
    if (falhas > 0) {
      toast({
        title: falhas === 1 ? "Um arquivo não foi enviado" : `${falhas} arquivos não foram enviados`,
        variant: "destructive",
        duration: 10000,
      });
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

  /** Prioridade dentro do grupo: quem está perdendo primeiro, depois o resto em ordem de data.
   *  Falha de envio NÃO altera a ordem: entra pela data como qualquer conversa. */
  const pesoConversa = (c: Conversa) =>
    urgenciaDeNivel(atencaoDe(c)?.nivel) === "perdendo" ? 0 : 1;

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

  // Filtro local instantâneo: filtra a lista carregada enquanto a pessoa digita.
  const termoLocal = textoBusca(busca.trim());
  const termoDigitos = digitosBusca(termoLocal);

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
    base = conversas.filter((c) => {
      if (termoLocal) {
        const tel = (c.telefone ?? "").toLowerCase();
        const telReal = (c.telefone_real ?? "").toLowerCase();
        const casa =
          textoBusca(c.cliente_nome).includes(termoLocal) ||
          tel.includes(termoLocal) ||
          telReal.includes(termoLocal) ||
          (termoDigitos.length > 0 &&
            (digitosBusca(c.telefone).includes(termoDigitos) ||
              digitosBusca(c.telefone_real).includes(termoDigitos)));
        if (!casa) return false;
      }
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
    return [...base].sort(compararConversas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas, conversasHistorico, emAtendimento, buscaAtiva, resultadoBusca, termoLocal, termoDigitos, aba, grupoAba, filtroLeitura, filtroFila, tagsFiltro, mapaAtencao, modoFila, modoHistorico]);

  const filtradasExibidas = useMemo(() => {
    if (!isMobile || modoFila || modoHistorico) return filtradas;
    return [...filtradas].sort((a, b) => {
      const filaA = a.status === "escalado" && a.aguardando_desde ? 0 : 1;
      const filaB = b.status === "escalado" && b.aguardando_desde ? 0 : 1;
      return filaA - filaB;
    });
  }, [filtradas, isMobile, modoFila, modoHistorico]);


  // Resultado do servidor que não está na lista carregada: seção "Outras conversas".
  const idsNaLista = useMemo(() => new Set(conversas.map((c) => String(c.id))), [conversas]);
  const outrasConversas = useMemo(() => {
    if (!buscaServidor) return [];
    return ((outrasBrutas ?? []) as any[])
      .filter((r) => !idsNaLista.has(String(r.conversa_id)))
      .map((r) => ({
        id: r.conversa_id,
        telefone: r.telefone ?? "",
        cliente_nome: r.nome ?? null,
        status: r.status ?? "",
        nao_lida: !!r.nao_lida,
        ultima_mensagem_em: r.ultima_mensagem_em ?? null,
        ultima_mensagem: r.ultima_mensagem_texto ?? null,
        canal: r.canal ?? null,
      }) as Conversa);
  }, [buscaServidor, outrasBrutas, idsNaLista]);

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

  const totalFiltrosAtivos =
    Number(aba !== "whatsapp") +
    Number(grupoAba !== "conversa") +
    Number(filtroLeitura !== "todas") +
    Number(filtroFila !== null) +
    Number(tagsFiltro.length > 0) +
    Number(modoHistorico);

  const limparFiltrosMobile = () => {
    setAba("whatsapp");
    setGrupoAba("conversa");
    setFiltroLeitura("todas");
    setFiltroFila(null);
    setTagsFiltro([]);
    setModoHistorico(false);
    setSoKora(false);
  };


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
    if (isMobile && !selecionada) {
      window.history.pushState({ atendimentoChat: true }, "", window.location.href);
      entradaChatMobileRef.current = true;
    }
    setSelecionada(String(id));
    setAbaPagina("conversas");
    setListaSheet(false);
    setPerfilSheet(false);
    if (textoPronto) composerRef.current?.definirTexto(textoPronto);
    setLeadProvador(leadId ? { leadId, conversaId: String(id) } : null);
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

  const abasSecundarias = [
    ["provador", "Provador", contagens.provador],
    ["abandonadas", "Abandonadas", undefined],
    ["cobrancas", "Cobranças", undefined],
    ["consulta", "Consultar Transação", undefined],
    ["rapidas", "Mensagens rápidas", undefined],
    ["aprendizado", "Aprendizado da Anna", undefined],
    ["carrinhos", "Carrinhos abandonados", contagens.carrinhos],
    ["cancelados", "Pedidos cancelados", contagens.cancelados],
    ["kanban", "Kanban do funil", undefined],
    ["cashback", "Cashback", undefined],
  ] as const;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-x-hidden overflow-y-hidden md:-m-6 md:h-[calc(100dvh-3.5rem)] md:w-[calc(100%+3rem)] md:max-w-[calc(100%+3rem)]">
      {!isMobile && <AvisosFila />}
      <Tabs
        value={abaPagina}
        onValueChange={(v) => setAbaPagina(v as typeof abaPagina)}
        className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div className={cn("flex h-11 w-full min-w-0 shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-3", isMobile && selecionada && abaPagina === "conversas" && "hidden")}>
          <TabsList className={cn("h-8 w-max flex-nowrap bg-transparent p-0", isMobile && "grid w-full grid-cols-[1fr_1fr_44px]")}>
            <TabsTrigger value="conversas" className="h-8 shrink-0 text-sm">
              {rotuloComContagem("Conversas", contagemGrupos.conversa)}
            </TabsTrigger>
            <TabsTrigger value="oportunidades" className="h-8 shrink-0 text-sm">
              {rotuloComContagem("Oportunidades", contagens.oportunidades)}
            </TabsTrigger>
            <TabsTrigger value="provador" className="hidden h-8 shrink-0 text-sm md:inline-flex">
              {rotuloComContagem("Provador", contagens.provador)}
            </TabsTrigger>
            <TabsTrigger value="abandonadas" className="hidden h-8 shrink-0 text-sm md:inline-flex">Abandonadas</TabsTrigger>
            <TabsTrigger value="cobrancas" className="hidden h-8 shrink-0 text-sm md:inline-flex">Cobranças</TabsTrigger>
            <TabsTrigger value="consulta" className="hidden h-8 shrink-0 text-sm md:inline-flex">Consultar Transação</TabsTrigger>
            <TabsTrigger value="rapidas" className="hidden h-8 shrink-0 text-sm md:inline-flex">Mensagens rápidas</TabsTrigger>
            <TabsTrigger value="aprendizado" className="hidden h-8 shrink-0 text-sm md:inline-flex">Aprendizado da Anna</TabsTrigger>
            <TabsTrigger value="carrinhos" className="hidden h-8 shrink-0 text-sm md:inline-flex">
              {rotuloComContagem("Carrinhos abandonados", contagens.carrinhos)}
            </TabsTrigger>
            <TabsTrigger value="cancelados" className="hidden h-8 shrink-0 text-sm md:inline-flex">
              {rotuloComContagem("Pedidos cancelados", contagens.cancelados)}
            </TabsTrigger>
            <TabsTrigger value="kanban" className="hidden h-8 shrink-0 text-sm md:inline-flex">Kanban do funil</TabsTrigger>
            <TabsTrigger value="cashback" className="hidden h-8 shrink-0 text-sm md:inline-flex">Cashback</TabsTrigger>
            {isMobile && (
              <Button type="button" variant="ghost" className="h-8 px-2 text-sm" onClick={() => setMaisAbasAberto(true)}>
                Mais
                <ChevronUp className="ml-1 h-4 w-4" />
              </Button>
            )}
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

        <Sheet open={maisAbasAberto} onOpenChange={setMaisAbasAberto}>
          <SheetContent side="bottom" className="max-h-[75dvh] rounded-t-lg px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5">
            <SheetTitle className="mb-3">Mais áreas</SheetTitle>
            <div className="grid gap-1 overflow-y-auto">
              {abasSecundarias.map(([valor, rotulo, total]) => (
                <Button
                  key={valor}
                  variant={abaPagina === valor ? "secondary" : "ghost"}
                  className="h-11 justify-between px-3"
                  onClick={() => { setAbaPagina(valor); setMaisAbasAberto(false); }}
                >
                  <span>{rotulo}</span>
                  {!!total && total > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{total}</span>}
                </Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={filtrosMobileAberto} onOpenChange={setFiltrosMobileAberto}>
          <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col rounded-t-lg px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5">
            <SheetTitle className="mb-3">Filtros</SheetTitle>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-3">
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Canal</p>
                <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                  {([{"v":"whatsapp","label":"WhatsApp"},{"v":"site","label":"Chat do Site"}] as const).map((item) => (
                    <Button key={item.v} type="button" variant={aba === item.v ? "secondary" : "ghost"} className="h-11 min-w-0 px-2" onClick={() => setAba(item.v)}>
                      <span className="truncate">{item.label}</span>
                    </Button>
                  ))}
                </div>
              </section>
              {!modoHistorico && (
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo</p>
                  <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                    {([{"v":"conversa","label":"Conversas","n":contagemGrupos.conversa},{"v":"clique","label":"Cliques","n":contagemGrupos.clique},{"v":"so_envio","label":"Só envios","n":contagemGrupos.so_envio}] as const).map((item) => (
                      <Button key={item.v} type="button" variant={grupoAba === item.v ? "secondary" : "ghost"} className="h-11 min-w-0 px-1.5" onClick={() => setGrupoAba(item.v)}>
                        <span className="min-w-0 truncate">{item.label}</span><span className="shrink-0 text-xs opacity-70">{item.n}</span>
                      </Button>
                    ))}
                  </div>
                </section>
              )}
              <section className="space-y-1">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mais filtros</p>
                <Button type="button" variant={filtroFila === "falhas" ? "secondary" : "ghost"} className="h-11 w-full min-w-0 justify-between px-3" onClick={() => { setFiltroFila(filtroFila === "falhas" ? null : "falhas"); setFiltroLeitura("todas"); }}>
                  <span className="truncate">Não enviadas</span><span className="shrink-0 text-xs text-muted-foreground">{totalFalhas}</span>
                </Button>
                <Button type="button" variant={filtroFila === "atencao" ? "secondary" : "ghost"} className="h-11 w-full min-w-0 justify-between px-3" onClick={() => { setFiltroFila(filtroFila === "atencao" ? null : "atencao"); setFiltroLeitura("todas"); }}>
                  <span className="truncate">Precisam de atenção</span><span className="shrink-0 text-xs text-muted-foreground">{totalAtencao}</span>
                </Button>
                <Button type="button" variant={filtroFila === "automacao" ? "secondary" : "ghost"} className="h-11 w-full min-w-0 justify-between px-3" onClick={() => { setFiltroFila(filtroFila === "automacao" ? null : "automacao"); setFiltroLeitura("todas"); }}>
                  <span className="truncate">Automações</span><span className="shrink-0 text-xs text-muted-foreground">{totalAutomacoes}</span>
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant={tagsFiltro.length ? "secondary" : "ghost"} className="h-11 w-full min-w-0 justify-between px-3" disabled={modoHistorico}>
                      <span className="truncate">Tags</span><span className="shrink-0 text-xs text-muted-foreground">{tagsFiltro.length}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[calc(100vw-2rem)] max-w-sm space-y-2 p-3" align="center">
                    {todasTags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag cadastrada.</p>}
                    <div className="max-h-52 space-y-2 overflow-auto">
                      {todasTags.map((tag) => (
                        <label key={String(tag.id)} className="flex min-w-0 cursor-pointer items-center gap-2">
                          <Checkbox checked={tagsFiltro.includes(String(tag.id))} onCheckedChange={(valor) => setTagsFiltro((atuais) => valor ? [...atuais, String(tag.id)] : atuais.filter((id) => id !== String(tag.id)))} />
                          <span className="min-w-0 flex-1 truncate"><TagChip tag={tag} /></span>
                          <span className="shrink-0 text-xs text-muted-foreground">{contagemTags[String(tag.id)] ?? 0}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant={modoHistorico ? "secondary" : "ghost"} className="h-11 w-full min-w-0 justify-between px-3" onClick={() => setModoHistorico((atual) => !atual)}>
                  <span className="truncate">Histórico</span><span className="shrink-0 text-xs text-muted-foreground">{conversasHistorico.length}</span>
                </Button>
                <Button type="button" variant={filtroLeitura === "lidas" ? "secondary" : "ghost"} className="h-11 w-full min-w-0 justify-between px-3" disabled={modoHistorico} onClick={() => { setFiltroLeitura(filtroLeitura === "lidas" ? "todas" : "lidas"); setFiltroFila(null); }}>
                  <span className="truncate">Lidas</span><span className="shrink-0 text-xs text-muted-foreground">{Math.max(0, conversas.length - totalNaoLidas)}</span>
                </Button>
              </section>
            </div>
            <Button type="button" variant="outline" className="h-11 w-full shrink-0" onClick={limparFiltrosMobile} disabled={totalFiltrosAtivos === 0}>Limpar filtros</Button>
          </SheetContent>
        </Sheet>

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

        {!isMobile && listaSheet && (
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
            isMobile ? (selecionada ? "hidden" : "relative static z-auto w-full max-w-none translate-x-0 border-r-0") : (listaSheet ? "translate-x-0" : "-translate-x-full"),
          )}
        >
          <div className="hidden shrink-0 flex-col gap-2 border-b border-border p-3 md:flex">
            <Button size="sm" className={cn("w-full", isMobile && "order-4 min-h-11")} onClick={() => abrirNovaConversa(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova conversa
            </Button>
            <div className={cn("grid grid-cols-2 gap-1 rounded-md bg-muted p-1", isMobile && "order-2")}>
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
            {!modoHistorico && <div className={cn("grid grid-cols-3 gap-1 rounded-md bg-muted p-1", isMobile && "order-3")}>
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
            <div className={cn("relative", isMobile && "order-1")}>

              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={buscaRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou telefone (tecle /)"
                className={cn("pl-8", isMobile && "h-11")}
              />
            </div>
            <div className={cn("flex items-center gap-1.5 flex-wrap", isMobile && "order-5 grid grid-cols-3 gap-1 rounded-md bg-muted p-1 [&>button]:h-10 [&>button]:border-0 [&>button]:px-1")}>
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
                        {contagemTags[String(t.id)] > 0 && (
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {contagemTags[String(t.id)]}
                          </span>
                        )}
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
          {isMobile && (
            <div className="flex shrink-0 flex-col gap-2 border-b border-border p-2">
              <div className="flex min-w-0 gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input ref={buscaRef} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou telefone" className="h-11 min-w-0 pl-8" />
                </div>
                <Button type="button" size="icon" variant="outline" className="relative h-11 w-11 shrink-0" onClick={() => setFiltrosMobileAberto(true)} aria-label="Abrir filtros">
                  <SlidersHorizontal className="h-4 w-4" />
                  {totalFiltrosAtivos > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{totalFiltrosAtivos}</span>}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                {([{"v":"todas","label":"Todas"},{"v":"nao_lidas","label":"Não lidas"},{"v":"em_atendimento","label":"Em atendimento"}] as const).map((item) => {
                  const ativo = item.v === "em_atendimento"
                    ? filtroFila === "em_atendimento"
                    : filtroLeitura === item.v && filtroFila === null;
                  return (
                    <Button key={item.v} type="button" variant={ativo ? "secondary" : "ghost"} className="h-11 min-w-0 px-1.5 text-xs" onClick={() => {
                      if (item.v === "em_atendimento") { setFiltroFila(filtroFila === "em_atendimento" ? null : "em_atendimento"); setFiltroLeitura("todas"); return; }
                      setFiltroLeitura(item.v); setFiltroFila(null);
                    }}>
                      <span className="truncate">{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
          <ScrollArea className="min-h-0 flex-1 overscroll-contain">
            {(modoHistorico ? carregandoHistorico : carregandoConversas) && (
              <p className="p-4 text-sm text-muted-foreground">Carregando conversas…</p>
            )}
            {!(modoHistorico ? carregandoHistorico : carregandoConversas) && filtradas.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
            )}
            {(() => {
              let grupoAnterior: string | null = null;
              return filtradasExibidas.map((c) => {
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
                  <ItemConversa
                    c={c}
                    ativa={ativa}
                    modoHistorico={modoHistorico}
                    mostrarClique={grupoAba === "clique"}
                    atencao={atencao}
                    faixa={faixa}
                    menuAberto={menuLeituraAberto === String(c.id)}
                    longPressRef={longPressRef}
                    onAbrir={abrirConversa}
                    onMenuChange={setMenuLeituraAberto}
                    onMarcarLeitura={marcarLeitura}
                    mobile={isMobile}
                  />
                </div>
              );
              });
            })()}

            {buscaServidor && !modoFila && (
              <>
                <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  Outras conversas
                  {buscandoOutras && <Loader2 className="h-3 w-3 animate-spin" />}
                </div>
                {outrasConversas.length === 0 && !buscandoOutras && (
                  <p className="px-4 pb-3 text-sm text-muted-foreground">Nenhuma outra conversa encontrada</p>
                )}
                {outrasConversas.map((c) => (
                  <ItemConversa
                    key={`outra-${String(c.id)}`}
                    c={c}
                    ativa={String(c.id) === selecionada}
                    modoHistorico={false}
                    mostrarClique={false}
                    atencao={undefined}
                    faixa="border-l-muted-foreground/30"
                    menuAberto={menuLeituraAberto === String(c.id)}
                    longPressRef={longPressRef}
                    onAbrir={abrirConversa}
                    onMenuChange={setMenuLeituraAberto}
                    onMarcarLeitura={marcarLeitura}
                    mobile={isMobile}
                  />
                ))}
              </>
            )}


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
          {isMobile && (
            <Button type="button" size="icon" className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-20 h-14 w-14 rounded-full shadow-lg" onClick={() => abrirNovaConversa(null)} aria-label="Nova conversa">
              <Plus className="h-6 w-6" />
            </Button>
          )}
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
        <section className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", isMobile && !selecionada && "hidden")}>
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
                  className="h-11 w-11 shrink-0 md:hidden"
                  onClick={fecharChatMobile}
                  title="Ver conversas"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent md:flex">
                  {ehSite(conversaAtual) ? (
                    <Globe className="h-4 w-4 text-primary" aria-label="Chat do site" />
                  ) : (
                    <MessageCircle className="h-4 w-4 text-primary" aria-label="WhatsApp" />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 md:flex-row md:items-center md:gap-2">
                  <h2 className="max-w-full truncate text-sm font-semibold">{nomeConversa(conversaAtual)}</h2>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {identificadorConversa(conversaAtual)}
                  </span>
                  {!ehSite(conversaAtual) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 text-muted-foreground"
                      title="Conferir número"
                      aria-label="Conferir número"
                      onClick={() => setConferirNumero(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {nomeSoDoWhatsApp(conversaAtual) && <BadgeViaWhatsApp />}
                  <div className="max-w-full truncate text-[11px] text-muted-foreground md:hidden">
                    {conversaAtual.status === "escalado" ? "Aguardando atendimento" : conversaAtual.status === "em_atendimento" ? "Em atendimento" : conversaAtual.status === "resolvido" ? "Resolvida" : "Atendimento automático"}
                  </div>
                  <span className="hidden md:inline-flex"><StatusPill status={conversaAtual.status} aguardandoDesde={conversaAtual.aguardando_desde} /></span>
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
                    <Button size="sm" className="hidden md:inline-flex" onClick={() => assumir.mutate()} disabled={assumir.isPending}>
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
                       <Button size="icon" variant="ghost" className="hidden h-9 w-9 md:inline-flex" title="Mais ações">
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
                    className="h-11 w-11 md:hidden"
                    onClick={() => setPerfilSheet(true)}
                    title="Ações e ferramentas"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hidden h-9 w-9 md:inline-flex lg:hidden"
                    onClick={() => setPerfilSheet(true)}
                    title="Perfil da cliente"
                  >
                    <PanelRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {!conversaHistorica && (
                <div className="hidden shrink-0 border-b border-border px-3 py-1.5 md:block">
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
              <CobrancasConversa conversaId={conversaAtual.id} />

              <ScrollArea
                ref={areaMensagensRef}
                className="relative min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden p-3 md:p-4 [&_[data-radix-scroll-area-viewport]]:!overflow-x-hidden"
                onDragOver={(e) => {
                  if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return;
                  e.preventDefault();
                  setArrastando(true);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setArrastando(false);
                }}
                onDrop={(e) => {
                   const arquivos = Array.from(e.dataTransfer?.files ?? []).filter(
                     (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
                   );
                  if (arquivos.length === 0) return;
                  e.preventDefault();
                  setArrastando(false);
                  adicionarImagens(arquivos);
                }}
              >
                {arrastando && (
                  <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/80 text-sm font-medium text-primary">
                    Solte para enviar
                  </div>
                )}
                {carregandoMensagens && <p className="text-sm text-muted-foreground">Carregando mensagens…</p>}
                {temNovasAbaixo && (
                  <button
                    type="button"
                    onClick={() => irAoFim(true)}
                    className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg"
                  >
                    Novas mensagens
                  </button>
                )}
                <div className="min-w-0 max-w-full space-y-3 overflow-x-hidden">
                  {temAnteriores && (
                    <div className="flex justify-center pb-1">
                      {carregandoAnteriores ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Button variant="outline" size="sm" onClick={carregarAnteriores}>
                          Carregar mensagens anteriores
                        </Button>
                      )}
                    </div>
                  )}
                  {mensagens.map((m, idx) => {
                    const chave = m.id != null ? String(m.id) : `${m.criada_em ?? m.criado_em ?? ""}-${idx}`;
                    return (
                      <BalaoMensagem
                        key={chave}
                        m={m}
                        divisorKora={idx === primeiroIndiceKora}
                        divisorProprio={idx === primeiroIndiceSistemaProprio}
                        destacado={destacada === (m.id != null ? String(m.id) : "")}
                        menuAberto={menuBalao === (m.id != null ? String(m.id) : "")}
                        toqueRef={toqueRef}
                        onRegistrarRef={registrarBalaoRef}
                        onResponder={responderCitando}
                        onCopiar={copiarTextoMensagem}
                        onAbrirMenu={setMenuBalao}
                        onIrParaMensagem={irParaMensagem}
                        onReenviar={reenviarMensagem}
                        onDescartar={removerMensagemOtimista}
                        onEnviarTemplate={abrirTemplate}
                        onDesfazer={desfazerEnvio}
                        onExcluir={setMensagemExcluir}
                      />
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
                 <div className={cn("shrink-0 border-t border-border px-2 py-1.5 space-y-1.5", isMobile && "sticky bottom-0 z-10 bg-background pb-[calc(0.375rem+env(safe-area-inset-bottom))]")}>
                  {isMobile && !conversaHistorica && status === "escalado" && (
                    <Button className="h-11 w-full" onClick={() => assumir.mutate()} disabled={assumir.isPending}>
                      <UserCheck className="mr-2 h-4 w-4" />
                      {assumir.isPending ? "Assumindo…" : "Assumir conversa"}
                    </Button>
                  )}
                  {!modoHistorico && conversaAtual?.falha_envio && (
                    <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                      <p className="flex-1 text-xs text-danger">
                        {`A última mensagem não foi entregue. ${conversaAtual.falha_envio_motivo ?? ""}`.trim()}
                      </p>
                      {ehMotivoJanela(conversaAtual.falha_envio_motivo) ? (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setTemplateAberto(true)}>
                          Enviar template
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            const ultima = [...(mensagens ?? [])]
                              .reverse()
                              .find((m: Mensagem) => m.direcao === "saida" && m.status_entrega === "falhou");
                            if (ultima) reenviarMensagem(ultima);
                          }}
                        >
                          Tentar de novo
                        </Button>
                      )}
                    </div>
                  )}

                  {erroJanela && (
                    <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3">
                      <AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                      <p className="text-sm text-danger">{erroJanela}</p>
                    </div>
                  )}
                  {citacao && (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 py-1.5 pl-0 pr-2">
                      <span className="h-8 w-1 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-primary">
                          {citacao.direcao === "entrada" ? "Cliente" : "Você"}
                        </p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {citacao.texto?.trim() || (citacao.media_url ? "Imagem" : "Mensagem")}
                        </p>
                      </div>
                      {citacao.media_url && (
                        <img src={citacao.media_url} alt="Citada" className="h-8 w-8 shrink-0 rounded object-cover" />
                      )}
                      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setCitacao(null)} title="Cancelar citação">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {imagens.length > 0 && (
                    <div className="space-y-2 rounded-md border border-border p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {imagens.map((img) => (
                          <div key={img.chave} className="relative">
                            {img.video ? (
                              <video src={img.url} muted playsInline preload="metadata" className="h-16 w-16 rounded bg-foreground object-cover" />
                            ) : (
                              <img src={img.url} alt="Prévia" className="h-16 w-16 rounded object-cover" />
                            )}
                            <button
                              type="button"
                              className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-background p-0.5 shadow"
                              onClick={() => removerImagem(img.chave)}
                              title="Remover arquivo"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {imagens.length < 10 && (
                          <button
                            type="button"
                            className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:bg-accent"
                            onClick={() => composerRef.current?.abrirArquivos()}
                            title="Adicionar mais arquivos"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                      <Input
                        value={legenda}
                        onChange={(e) => setLegenda(e.target.value)}
                        placeholder="Legenda (opcional, vai só no primeiro arquivo)"
                        className="h-8 text-xs"
                      />
                      {progressoUpload && (
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground">
                            Preparando {progressoUpload.feitos} de {progressoUpload.total}…
                          </p>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${Math.round((progressoUpload.feitos / progressoUpload.total) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={confirmarEnvioImagem} disabled={enviandoImagem}>
                          {enviandoImagem
                            ? "Enviando…"
                            : imagens.length > 1
                              ? `Enviar ${imagens.length} arquivos`
                              : imagens[0]?.video
                                ? "Enviar vídeo"
                                : "Enviar imagem"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={limparPreview} disabled={enviandoImagem}>
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                  <Composer
                    ref={composerRef}
                    onEnviar={enviarTextoComDesfazer}
                    onImagens={adicionarImagens}
                    onAbrirCatalogo={abrirCatalogo}
                    onAbrirTemplate={abrirTemplate}
                    onDigitandoMudou={setDigitando}
                    mobile={isMobile}
                    figurinhas={
                      !ehSite(conversaAtual) ? (
                        <SeletorFigurinhas
                          telefone={telefoneIdentificado}
                          conversaId={conversaAtual.id}
                          onEnviada={invalidarThread}
                        />
                      ) : null
                    }
                  />
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
           <SheetContent
             side={isMobile ? "bottom" : "right"}
             className={cn(
               "flex flex-col overflow-hidden p-3 pb-8",
               isMobile ? "h-[85dvh] w-full rounded-t-lg pb-[calc(1rem+env(safe-area-inset-bottom))]" : "w-[92vw] max-w-[380px]",
             )}
           >
             <SheetTitle>{isMobile ? "Ações e ferramentas" : "Perfil da cliente"}</SheetTitle>
            {conversaAtual ? (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain pt-2">
                {isMobile && (
                  <section className="space-y-2 rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversa</p>
                    {!conversaHistorica && (status === "escalado" || status === "em_atendimento") && (
                      <Button variant="outline" className="h-11 w-full justify-start" onClick={() => { setPerfilSheet(false); resolver.mutate(); }} disabled={resolver.isPending}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Resolver conversa
                      </Button>
                    )}
                    {!conversaHistorica && status !== "bot_ativo" && (
                      <Button variant="outline" className="h-11 w-full justify-start" onClick={() => { setPerfilSheet(false); reativarBot.mutate(); }} disabled={reativarBot.isPending}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Reativar bot
                      </Button>
                    )}
                    {!conversaHistorica && <TagsConversa conversaId={conversaAtual.id} aplicadas={conversaAtual.tags ?? []} />}
                  </section>
                )}
                {isMobile && (
                  <section className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                    <p className="col-span-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ferramentas</p>
                    {!ehSite(conversaAtual) && <Button variant="outline" className="h-11 justify-start" onClick={() => { setPerfilSheet(false); setConferirNumero(true); }}><Pencil className="mr-2 h-4 w-4" /> Conferir número</Button>}
                    <Button variant="outline" className="h-11 justify-start" onClick={() => { setPerfilSheet(false); setFreteAberto(true); }}><Truck className="mr-2 h-4 w-4" /> Frete</Button>
                    <Button variant="outline" className="h-11 justify-start" onClick={() => { setPerfilSheet(false); setCobrancaAberta(true); }}><QrCode className="mr-2 h-4 w-4" /> Cobrança Pix</Button>
                    <Button variant="outline" className="h-11 justify-start" onClick={() => { setPerfilSheet(false); abrirCatalogo(); }}><LayoutGrid className="mr-2 h-4 w-4" /> Catálogo</Button>
                    <Button variant="outline" className="h-11 justify-start" onClick={() => { setPerfilSheet(false); setProporCarrinhoAberto(true); }}><ShoppingCart className="mr-2 h-4 w-4" /> Carrinho</Button>
                    <Button variant="outline" className="h-11 justify-start" onClick={() => { setPerfilSheet(false); setLinkPagamentoAberto(true); }}><Link2 className="mr-2 h-4 w-4" /> Pagamento</Button>
                  </section>
                )}
                {isMobile && <AvisosFila />}
                <Card>
                  <PerfilCliente conversaId={conversaAtual.id} autor={autor} telefone={conversaAtual.telefone} />
                  {telefoneIdentificado && <ProvadorBloco telefone={telefoneIdentificado} onUsarTexto={usarTextoPronto} />}
                  {telefoneIdentificado && <AtividadesRecentes telefone={telefoneIdentificado} />}
                </Card>
              </div>
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
        <ConferirNumeroDialog
          open={conferirNumero}
          onOpenChange={setConferirNumero}
          conversaId={conversaAtual.id}
          autor={autor}
          onAbrirConversa={(id) => abrirDoPainel(String(id))}
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
