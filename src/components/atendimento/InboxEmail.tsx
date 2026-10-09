import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Archive, ArrowLeft, CornerUpLeft, Inbox, Loader2, MailOpen, Paperclip, RotateCcw, Search, Send, Clock, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { chamarRpc } from "@/lib/supabaseRpc";
import { formatarDataHora } from "@/lib/dataBr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export type CaixaEmail = { id: number; endereco: string; rotulo: string; abertas: number; nao_lidas: number; nao_lidas_outros?: number };
type CategoriaEmail = "cliente" | "contato" | "sistema" | "promocional" | "spam";
export type ConversaEmail = {
  id: number; caixa_id: number; caixa: string; caixa_endereco: string; assunto: string | null;
  cliente_email: string | null; cliente_nome: string | null; status: string; nao_lida: boolean;
  responsavel: string | null; ultima_mensagem_em: string; qtd_mensagens: number; previa: string | null;
  ultima_direcao: "entrada" | "saida" | null;
  categoria: CategoriaEmail | null; categoria_motivo: string | null; e_cliente: boolean;
};
type Anexo = { id: number; nome: string; mime: string | null; tamanho: number | null; storage_path: string };
type MensagemEmail = {
  id: number; direcao: "entrada" | "saida"; de: string | null; para: string | null; cc: string | null;
  assunto: string | null; corpo_texto: string | null; corpo_html: string | null; data_email: string | null;
  enviado_por: string | null; status_envio: string | null; erro_envio: string | null; anexos: Anexo[] | null;
  corpo_texto_limpo: string | null; corpo_html_limpo: string | null;
};
type DetalheEmail = { thread: ConversaEmail; mensagens: MensagemEmail[] };

const LIMITE = 50;
const CATEGORIAS_OUTROS = [
  { v: "sistema", label: "Sistemas" },
  { v: "promocional", label: "Promoções" },
  { v: "spam", label: "Spam" },
] as const;
const ROTULO_CATEGORIA: Record<CategoriaEmail, string> = {
  cliente: "Cliente", contato: "Contato", sistema: "Sistema", promocional: "Promoção", spam: "Spam",
};
function categoriaOutros(categoria: CategoriaEmail | null) {
  return categoria === "sistema" || categoria === "promocional" || categoria === "spam";
}
const STATUS = [
  { v: "aberta", label: "Abertas" },
  { v: "aguardando_cliente", label: "Aguardando cliente" },
  { v: "respondida", label: "Respondidas" },
  { v: "arquivada", label: "Arquivadas" },
] as const;
const ROTULO_STATUS: Record<string, string> = {
  aberta: "Aberta", aguardando_cliente: "Aguardando cliente", respondida: "Respondida", arquivada: "Arquivada",
};

async function rpc<T>(nome: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await chamarRpc<T>(nome, params);
  if (error) throw new Error(error.message || "Erro ao consultar e-mails");
  return data as T;
}

function lista<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") { try { return lista<T>(JSON.parse(v)); } catch { return []; } }
  return [];
}

export function useCaixasEmail() {
  return useQuery({
    queryKey: ["inbox-email-caixas"],
    queryFn: async () => lista<CaixaEmail>(await rpc("inbox_email_caixas")),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 15000,
  });
}

export function totalNaoLidasEmail(caixas?: CaixaEmail[]) {
  return (caixas ?? []).reduce((s, c) => s + (Number(c.nao_lidas) || 0), 0);
}

function relativo(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

function tamanho(b?: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1).replace(".", ",")} MB`;
}

async function abrirAnexo(a: Anexo) {
  const { data, error } = await supabase.storage.from("email-anexos").createSignedUrl(a.storage_path, 300);
  if (error || !data?.signedUrl) { toast.error(error?.message || "Não foi possível abrir o anexo"); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

function CorpoMensagem({ m }: { m: MensagemEmail }) {
  const [historico, setHistorico] = useState(false);
  const temLimpo = m.corpo_html_limpo != null || m.corpo_texto_limpo != null;
  const usarLimpo = temLimpo && !historico;
  const corpoHtml = usarLimpo ? m.corpo_html_limpo : m.corpo_html;
  const corpoTexto = usarLimpo ? m.corpo_texto_limpo : m.corpo_texto;
  const html = useMemo(
    () => (corpoHtml ? DOMPurify.sanitize(corpoHtml, { FORBID_TAGS: ["style", "script", "form", "input"], ADD_ATTR: ["target"] }) : ""),
    [corpoHtml],
  );
  return <>
    {html.trim()
      ? <div className="prose prose-sm max-w-none break-words text-sm [&_a]:text-primary [&_a]:underline [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: html }} />
      : <p className="whitespace-pre-wrap break-words text-sm">{corpoTexto || "(sem conteúdo)"}</p>}
    {temLimpo && <Button variant="link" className="mt-1 h-auto p-0 text-xs text-muted-foreground" aria-expanded={historico} onClick={() => setHistorico((v) => !v)}>
      {historico ? "Ocultar histórico" : "Mostrar histórico"}
    </Button>}
  </>;
}

export function InboxEmail() {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const [caixa, setCaixa] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>("aberta");
  const [grupoCategoria, setGrupoCategoria] = useState("importantes");
  const [subCategoria, setSubCategoria] = useState<CategoriaEmail | null>(null);
  const categoria = grupoCategoria === "importantes" ? "importantes" : subCategoria ?? "outros";
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);
  const [telaMobile, setTelaMobile] = useState<"filtros" | "lista" | "conversa">("lista");

  useEffect(() => {
    const t = setTimeout(() => setBusca(buscaDigitada.trim()), 400);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  const { data: caixas = [] } = useCaixasEmail();

  const listaQ = useInfiniteQuery({
    queryKey: ["inbox-email-lista", caixa, status, busca, categoria],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      lista<ConversaEmail>(await rpc("inbox_email_listar", {
        p_caixa_id: caixa, p_status: status, p_busca: busca || null, p_limite: LIMITE, p_antes: pageParam,
        p_categoria: categoria,
      })),
    getNextPageParam: (ultima) => (ultima.length >= LIMITE ? ultima[ultima.length - 1]?.ultima_mensagem_em ?? null : null),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 15000,
  });
  const conversas = useMemo(() => {
    const vistos = new Set<number>();
    return (listaQ.data?.pages ?? []).flat().filter((c) => (vistos.has(c.id) ? false : (vistos.add(c.id), true)));
  }, [listaQ.data]);

  const recarregarTudo = () => {
    qc.invalidateQueries({ queryKey: ["inbox-email-lista"] });
    qc.invalidateQueries({ queryKey: ["inbox-email-caixas"] });
  };

  const abrir = (id: number) => {
    setAberta(id);
    if (isMobile) setTelaMobile("conversa");
  };

  const filtros = (
    <div className="space-y-4 p-3">
      <section className="space-y-1">
        <Tabs value={grupoCategoria} onValueChange={(v) => { setGrupoCategoria(v); setSubCategoria(null); }}>
          <TabsList className="h-auto w-full">
            <TabsTrigger value="importantes" className="flex-1 px-2">Importantes</TabsTrigger>
            <TabsTrigger value="outros" className="flex-1 gap-1 px-2">Outros
              {caixas.some((c) => Number(c.nao_lidas_outros) > 0) && <span className="text-xs text-muted-foreground">{caixas.reduce((s, c) => s + (Number(c.nao_lidas_outros) || 0), 0)}</span>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {grupoCategoria === "outros" && CATEGORIAS_OUTROS.map((c) => <Button key={c.v} variant={subCategoria === c.v ? "secondary" : "ghost"} className="h-8 w-full justify-start px-2" onClick={() => setSubCategoria(subCategoria === c.v ? null : c.v)}>{c.label}</Button>)}
      </section>
      <section className="space-y-1">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caixas</p>
        {[{ id: null as number | null, rotulo: "Todas", nao: totalNaoLidasEmail(caixas), endereco: "" }, ...caixas.map((c) => ({ id: c.id, rotulo: c.rotulo, nao: Number(c.nao_lidas) || 0, endereco: c.endereco }))].map((c) => (
          <Button
            key={String(c.id)}
            variant={caixa === c.id ? "secondary" : "ghost"}
            className="h-auto w-full justify-between px-2 py-1.5"
            title={c.endereco}
            onClick={() => { setCaixa(c.id); if (isMobile) setTelaMobile("lista"); }}
          >
            <span className="flex min-w-0 items-center gap-2"><Inbox className="h-4 w-4 shrink-0" /><span className="truncate">{c.rotulo}</span></span>
            {c.nao > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{c.nao}</span>}
          </Button>
        ))}
      </section>
      <section className="space-y-1">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
        {STATUS.map((s) => (
          <Button
            key={s.v}
            variant={status === s.v ? "secondary" : "ghost"}
            className="h-8 w-full justify-start px-2"
            onClick={() => { setStatus(status === s.v ? null : s.v); if (isMobile) setTelaMobile("lista"); }}
          >
            {s.label}
          </Button>
        ))}
        <Button variant={status === null ? "secondary" : "ghost"} className="h-8 w-full justify-start px-2 text-muted-foreground" onClick={() => setStatus(null)}>
          Todas menos arquivadas
        </Button>
      </section>
    </div>
  );

  const buscaCampo = (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={buscaDigitada} onChange={(e) => setBuscaDigitada(e.target.value)} placeholder="Buscar nome, e-mail ou assunto" className="h-9 pl-8" />
    </div>
  );

  const listaEl = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-border p-3">
        {isMobile && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setTelaMobile("filtros")}>
            {grupoCategoria === "importantes" ? "Importantes" : "Outros"} · Caixa: {caixa == null ? "Todas" : caixas.find((c) => c.id === caixa)?.rotulo ?? "-"} · {status ? ROTULO_STATUS[status] : "Todas"}
          </Button>
        )}
        {buscaCampo}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {listaQ.isLoading ? (
          <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : listaQ.isError ? (
          <div className="space-y-2 p-4 text-sm text-danger">
            <p>{(listaQ.error as Error).message}</p>
            <Button size="sm" variant="outline" onClick={() => listaQ.refetch()}>Tentar de novo</Button>
          </div>
        ) : conversas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum e-mail encontrado</p>
        ) : (
          <ul className="divide-y divide-border">
            {conversas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => abrir(c.id)}
                  className={cn("w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/60", aberta === c.id && "bg-muted")}
                >
                  <div className="flex items-center gap-2">
                    {c.ultima_direcao === "saida"
                      ? <CornerUpLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Última mensagem foi nossa" />
                      : <MailOpen className={cn("h-3.5 w-3.5 shrink-0", c.nao_lida ? "text-primary" : "text-muted-foreground")} aria-label="Última mensagem foi da cliente" />}
                    <span className={cn("min-w-0 flex-1 truncate text-sm", c.nao_lida ? "font-bold" : "font-medium")}>
                      {c.cliente_nome || c.cliente_email || "-"}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{relativo(c.ultima_mensagem_em)}</span>
                  </div>
                  <p className={cn("mt-0.5 truncate text-sm", c.nao_lida ? "font-semibold" : "")}>{c.assunto || "(sem assunto)"}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{c.previa || ""}</p>
                    {c.e_cliente && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Cliente</span>}
                    {categoriaOutros(c.categoria) && c.categoria && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{ROTULO_CATEGORIA[c.categoria]}</span>}
                    <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{c.caixa}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {listaQ.hasNextPage && (
          <div className="p-3">
            <Button variant="outline" size="sm" className="w-full" disabled={listaQ.isFetchingNextPage} onClick={() => listaQ.fetchNextPage()}>
              {listaQ.isFetchingNextPage && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Carregar mais
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const conversaEl = aberta == null ? (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">Selecione um e-mail para ler</div>
  ) : (
    <ConversaEmailAberta
      key={aberta}
      threadId={aberta}
      onVoltar={isMobile ? () => setTelaMobile("lista") : undefined}
      onMudou={recarregarTudo}
    />
  );

  if (isMobile) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card">
        {telaMobile === "filtros" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-border p-2">
              <Button variant="ghost" size="icon" onClick={() => setTelaMobile("lista")} aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-semibold">Filtros</span>
            </div>
            <ScrollArea className="min-h-0 flex-1">{filtros}</ScrollArea>
          </div>
        )}
        {telaMobile === "lista" && listaEl}
        {telaMobile === "conversa" && conversaEl}
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-[220px_minmax(300px,380px)_minmax(0,1fr)] overflow-hidden">
      <aside className="min-h-0 overflow-y-auto border-r border-border bg-card">{filtros}</aside>
      <section className="min-h-0 min-w-0 border-r border-border bg-card">{listaEl}</section>
      <section className="min-h-0 min-w-0">{conversaEl}</section>
    </div>
  );
}

function ConversaEmailAberta({ threadId, onVoltar, onMudou }: { threadId: number; onVoltar?: () => void; onMudou: () => void }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [responsavel, setResponsavel] = useState("");
  const [marcouNaoLida, setMarcouNaoLida] = useState(false);

  const q = useQuery({
    queryKey: ["inbox-email-thread", threadId],
    queryFn: async () => {
      const r = await rpc<DetalheEmail | string>("inbox_email_abrir", { p_thread_id: threadId, p_marcar_lida: true });
      const d = (typeof r === "string" ? JSON.parse(r) : r) as DetalheEmail;
      return { thread: d?.thread, mensagens: lista<MensagemEmail>(d?.mensagens) };
    },
    staleTime: 10000,
  });

  useEffect(() => {
    if (q.data?.thread) {
      setResponsavel(q.data.thread.responsavel ?? "");
      if (!marcouNaoLida) onMudou();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.thread?.id]);

  const atualizar = async (args: { p_status?: string | null; p_nao_lida?: boolean | null; p_responsavel?: string | null; p_categoria?: CategoriaEmail | null }, ok: string) => {
    setSalvando(true);
    try {
      await rpc("inbox_email_atualizar", { p_thread_id: threadId, p_status: null, p_nao_lida: null, p_responsavel: null, p_categoria: null, ...args });
      toast.success(ok);
      onMudou();
      if (args.p_nao_lida !== true) await qc.invalidateQueries({ queryKey: ["inbox-email-thread", threadId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const enviar = async () => {
    const corpo = texto.trim();
    if (!corpo) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-enviar", { body: { thread_id: threadId, texto: corpo } });
      let msg = error?.message;
      if (error && "context" in error && (error as { context?: unknown }).context instanceof Response) {
        try { const j = await ((error as { context: Response }).context.clone().json()); msg = j?.erro || j?.error || msg; } catch { /* mantém */ }
      }
      if (error || !data?.ok) throw new Error(data?.erro || msg || "Não foi possível enviar");
      toast.success("E-mail enviado");
      setTexto("");
      await qc.invalidateQueries({ queryKey: ["inbox-email-thread", threadId] });
      onMudou();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (q.isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (q.isError || !q.data?.thread) {
    return (
      <div className="space-y-2 p-6 text-sm text-danger">
        {onVoltar && <Button variant="ghost" size="sm" onClick={onVoltar}><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Button>}
        <p>{(q.error as Error)?.message || "Conversa não encontrada"}</p>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}>Tentar de novo</Button>
      </div>
    );
  }
  const t = q.data.thread;
  const msgs = q.data.mensagens;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="space-y-2 border-b border-border bg-card p-3">
        <div className="flex items-start gap-2">
          {onVoltar && <Button variant="ghost" size="icon" className="shrink-0" onClick={onVoltar} aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Button>}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{t.assunto || "(sem assunto)"}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {t.cliente_nome ? `${t.cliente_nome} <${t.cliente_email ?? ""}>` : t.cliente_email || "-"} · {t.caixa} · {ROTULO_STATUS[t.status] ?? t.status}
            </p>
            {t.categoria && <Tooltip>
              <TooltipTrigger asChild><span tabIndex={0} className="mt-1 inline-block rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{ROTULO_CATEGORIA[t.categoria]}</span></TooltipTrigger>
              <TooltipContent className="max-w-xs break-words">{t.categoria_motivo || "Sem motivo informado"}</TooltipContent>
            </Tooltip>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {categoriaOutros(t.categoria) ? <Button size="sm" variant="outline" className="h-7" disabled={salvando} onClick={() => atualizar({ p_categoria: "contato" }, "Conversa movida para Importantes")}>Mover para Importantes</Button> : <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-7" disabled={salvando}>Mover para...</Button></DropdownMenuTrigger>
            <DropdownMenuContent>{(["promocional", "sistema", "spam"] as const).map((c) => <DropdownMenuItem key={c} onSelect={() => { void atualizar({ p_categoria: c }, `Conversa movida para ${ROTULO_CATEGORIA[c]}`); }}>{ROTULO_CATEGORIA[c]}</DropdownMenuItem>)}</DropdownMenuContent>
          </DropdownMenu>}
          {t.status === "arquivada" || t.status === "respondida" || t.status === "aguardando_cliente" ? (
            <Button size="sm" variant="outline" className="h-7" disabled={salvando} onClick={() => atualizar({ p_status: "aberta" }, "Conversa reaberta")}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />Reabrir
            </Button>
          ) : null}
          {t.status !== "arquivada" && (
            <Button size="sm" variant="outline" className="h-7" disabled={salvando} onClick={() => atualizar({ p_status: "arquivada" }, "Conversa arquivada")}>
              <Archive className="mr-1 h-3.5 w-3.5" />Arquivar
            </Button>
          )}
          {t.status !== "aguardando_cliente" && (
            <Button size="sm" variant="outline" className="h-7" disabled={salvando} onClick={() => atualizar({ p_status: "aguardando_cliente" }, "Marcada como aguardando cliente")}>
              <Clock className="mr-1 h-3.5 w-3.5" />Aguardando cliente
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7" disabled={salvando} onClick={() => { setMarcouNaoLida(true); atualizar({ p_nao_lida: true }, "Marcada como não lida"); }}>
            <MailOpen className="mr-1 h-3.5 w-3.5" />Marcar como não lida
          </Button>
          <form
            className="ml-auto flex items-center gap-1"
            onSubmit={(e) => { e.preventDefault(); atualizar({ p_responsavel: responsavel.trim() }, "Responsável atualizado"); }}
          >
            <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Responsável" className="h-7 w-36 text-xs" />
            <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={salvando || responsavel.trim() === (t.responsavel ?? "")}>Salvar</Button>
          </form>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {msgs.length === 0 && <p className="text-center text-sm text-muted-foreground">Sem mensagens</p>}
          {msgs.map((m) => {
            const nossa = m.direcao === "saida";
            const falhou = nossa && m.status_envio === "falhou";
            return (
              <div key={m.id} className={cn("flex", nossa ? "justify-end" : "justify-start")}>
                <article className={cn(
                  "w-full max-w-[85%] rounded-lg border p-3 shadow-sm",
                  falhou ? "border-danger/40 bg-danger/10" : nossa ? "border-primary/20 bg-primary/10" : "border-border bg-card",
                )}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {nossa ? <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold text-foreground">Use Mariana Cardoso</span><span className="break-all text-muted-foreground">{t.caixa_endereco}</span></div>
                      {m.enviado_por && <p className="text-[11px] text-muted-foreground">enviado por {m.enviado_por}</p>}
                    </div> : <span className="min-w-0 truncate font-medium text-foreground">{m.de}</span>}
                    <span className="shrink-0">{formatarDataHora(m.data_email)}</span>
                  </div>
                  {m.para && <p className="mb-1 truncate text-[11px] text-muted-foreground">Para: {m.para}{m.cc ? ` · Cc: ${m.cc}` : ""}</p>}
                  <CorpoMensagem m={m} />
                  {nossa && <p className="mt-2 text-[11px] text-muted-foreground">+ assinatura da marca</p>}
                  {(m.anexos ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(m.anexos ?? []).map((a) => (
                        <button key={a.id} type="button" onClick={() => abrirAnexo(a)} className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted">
                          <Paperclip className="h-3 w-3 shrink-0" /><span className="truncate">{a.nome}</span>
                          {a.tamanho ? <span className="shrink-0 text-muted-foreground">{tamanho(a.tamanho)}</span> : null}
                        </button>
                      ))}
                    </div>
                  )}
                  {falhou && (
                    <p className="mt-2 flex items-start gap-1 text-xs font-medium text-danger">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Falha no envio: {m.erro_envio || "erro desconhecido"}
                    </p>
                  )}
                </article>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <footer className="space-y-2 border-t border-border bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <p className="truncate text-xs text-muted-foreground">Respondendo como: <span className="font-medium text-foreground">{t.caixa_endereco}</span></p>
        <div className="flex items-end gap-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva a resposta"
            className="min-h-[80px] flex-1 resize-y"
            disabled={enviando}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void enviar(); } }}
          />
          <Button onClick={enviar} disabled={enviando || !texto.trim()}>
            {enviando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}Enviar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">A assinatura da marca é adicionada automaticamente. Use **texto** para negrito e deixe uma linha em branco para separar parágrafos.</p>
      </footer>
    </div>
  );
}
