import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  AlertTriangle, Bot, Check, CheckCheck, CheckCircle2, ImagePlus, LayoutGrid, Lock, MessageCircle,
  RotateCcw, Search, Send, User, X, UserCheck,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { TagsConversa, TagChip, type Tag } from "@/components/atendimento/TagsConversa";
import { CatalogoDialog, formatarPreco, legendaProduto, type ProdutoCatalogo } from "@/components/atendimento/CatalogoDialog";
import { PerfilCliente } from "@/components/atendimento/PerfilCliente";

type Conversa = {
  id: number | string;
  conversa_id?: number | string;
  cliente_nome?: string | null;
  nome_cliente?: string | null;
  telefone: string;
  ultima_mensagem?: string | null;
  ultima_mensagem_em?: string | null;
  atualizado_em?: string | null;
  status: string;
  prioridade?: string | null;
  tags?: Tag[] | null;
  nao_lida?: boolean | null;
};

type Mensagem = {
  id: number | string;
  conteudo: string;
  direcao: "entrada" | "saida";
  origem?: string | null;
  tipo?: string | null;
  media_url?: string | null;
  criado_em?: string | null;
  enviado_em?: string | null;
  status_entrega?: "enviado" | "entregue" | "lido" | "falhou" | string | null;
  erro_entrega?: string | null;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  escalado: { label: "Aguardando atendimento", className: "bg-danger/10 text-danger border-danger/20" },
  em_atendimento: { label: "Em atendimento", className: "bg-warning/10 text-warning border-warning/20" },
  bot_ativo: { label: "Bot ativo", className: "bg-muted text-muted-foreground border-border" },
  resolvido: { label: "Resolvido", className: "bg-success/10 text-success border-success/20" },
};

function StatusPill({ status, className }: { status: string; className?: string }) {
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
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroLeitura, setFiltroLeitura] = useState<"todas" | "nao_lidas" | "lidas">("todas");
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);
  const [erroJanela, setErroJanela] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [legenda, setLegenda] = useState("");
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const autor = user?.email ?? "Atendente";

  const { data: conversas = [], isLoading: carregandoConversas } = useQuery({
    queryKey: ["whatsapp-conversas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_listar_conversas" as any);
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => ({
        ...c,
        id: c.id ?? c.conversa_id,
      })) as Conversa[];
    },
    refetchInterval: 15000,
  });

  const conversaAtual = conversas.find((c) => String(c.id) === selecionada) ?? null;

  // Deep link: /atendimento?telefone=5511...
  useEffect(() => {
    const alvo = new URLSearchParams(window.location.search).get("telefone");
    if (!alvo || selecionada || conversas.length === 0) return;
    const digitos = alvo.replace(/\D/g, "");
    const achou = conversas.find((c) => (c.telefone ?? "").replace(/\D/g, "").endsWith(digitos.slice(-8)));
    if (achou) setSelecionada(String(achou.id));
  }, [conversas, selecionada]);

  const { data: mensagens = [], isLoading: carregandoMensagens } = useQuery({
    queryKey: ["whatsapp-mensagens", selecionada],
    enabled: !!selecionada,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_get_mensagens_conversa" as any, {
        p_conversa_id: Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada),
      });
      if (error) throw error;
      return (data ?? []) as Mensagem[];
    },
  });

  const { data: todasTags = [] } = useQuery({
    queryKey: ["whatsapp-tags"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_listar_tags" as any);
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
  });

  const { data: dentroJanela } = useQuery({
    queryKey: ["whatsapp-janela-24h", selecionada],
    enabled: !!selecionada,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_dentro_janela_24h" as any, {
        p_conversa_id: Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada),
      });
      if (error) throw error;
      return data as unknown as boolean;
    },
  });

  const abrirConversa = async (c: Conversa) => {
    setSelecionada(String(c.id));
    setErroJanela(null);
    if (!c.nao_lida) return;
    const { error } = await supabase.rpc("whatsapp_marcar_lida" as any, {
      p_conversa_id: Number.isNaN(Number(c.id)) ? c.id : Number(c.id),
    });
    if (!error) queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
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

  const enviar = useMutation({
    mutationFn: async (conteudo: string) => {
      if (!conversaAtual) throw new Error("Nenhuma conversa selecionada");
      const { data, error } = await supabase.functions.invoke("whatsapp-enviar-mensagem-humano", {
        body: {
          conversa_id: conversaAtual.id,
          telefone: conversaAtual.telefone,
          conteudo,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setTexto("");
      setErroJanela(null);
      invalidarThread();
    },
    onError: async (e: any) => {
      const janela = await extrairErroJanela(e);
      if (janela) {
        setErroJanela(janela);
        queryClient.invalidateQueries({ queryKey: ["whatsapp-janela-24h", selecionada] });
        return;
      }
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    },
  });

  const enviarImagem = async (mediaUrl: string, conteudo: string) => {
    if (!conversaAtual) throw new Error("Nenhuma conversa selecionada");
    const { error } = await supabase.functions.invoke("whatsapp-enviar-mensagem-humano", {
      body: {
        conversa_id: conversaAtual.id,
        telefone: conversaAtual.telefone,
        conteudo,
        tipo: "imagem",
        media_url: mediaUrl,
      },
    });
    if (error) throw error;
    invalidarThread();
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

  const enviarProduto = async (p: ProdutoCatalogo) => {
    try {
      await enviarImagem(p.imagem ?? "", legendaProduto(p));
      setCatalogoAberto(false);
      toast({ title: "Produto enviado" });
    } catch (e: any) {
      toast({ title: "Erro ao enviar produto", description: e.message, variant: "destructive" });
    }
  };

  const assumir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("whatsapp_assumir_conversa" as any, {
        p_conversa_id: Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Conversa assumida" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    },
    onError: (e: any) => toast({ title: "Erro ao assumir conversa", description: e.message, variant: "destructive" }),
  });

  const reativarBot = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("whatsapp_reativar_bot" as any, {
        p_conversa_id: Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Bot reativado" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    },
    onError: (e: any) => toast({ title: "Erro ao reativar bot", description: e.message, variant: "destructive" }),
  });

  const resolver = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("whatsapp_marcar_resolvido" as any, {
        p_conversa_id: Number.isNaN(Number(selecionada)) ? selecionada : Number(selecionada),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Conversa marcada como resolvida" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    },
    onError: (e: any) =>
      toast({
        title: "Não foi possível resolver",
        description: e.message?.includes("does not exist")
          ? "A função whatsapp_marcar_resolvido ainda não existe no banco."
          : e.message,
        variant: "destructive",
      }),
  });

  const filtradas = conversas.filter((c) => {
    if (filtroLeitura === "nao_lidas" && !c.nao_lida) return false;
    if (filtroLeitura === "lidas" && c.nao_lida) return false;
    if (tagsFiltro.length > 0) {
      const ids = (c.tags ?? []).map((t) => String(t.id));
      if (!tagsFiltro.some((t) => ids.includes(t))) return false;
    }
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    const nome = (c.cliente_nome ?? c.nome_cliente ?? "").toLowerCase();
    return nome.includes(t) || (c.telefone ?? "").toLowerCase().includes(t);
  });

  const totalNaoLidas = conversas.filter((c) => c.nao_lida).length;

  const status = conversaAtual?.status ?? "";
  const podeResponder = status === "escalado" || status === "em_atendimento";

  return (
    <div className="p-6 max-w-[1700px] mx-auto space-y-4">
      <div>
        <h1 className="font-serif text-4xl text-foreground">Atendimento</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conversas de WhatsApp — assuma o atendimento quando o bot escalar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] xl:grid-cols-[340px_1fr_340px] gap-4 h-[calc(100vh-220px)] min-h-[520px]">
        {/* Lista de conversas */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou telefone"
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { v: "todas", label: "Todas" },
                { v: "nao_lidas", label: `Não lidas${totalNaoLidas ? ` (${totalNaoLidas})` : ""}` },
                { v: "lidas", label: "Lidas" },
              ] as const).map((f) => (
                <Button
                  key={f.v}
                  size="sm"
                  variant={filtroLeitura === f.v ? "default" : "outline"}
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => setFiltroLeitura(f.v)}
                >
                  {f.label}
                </Button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant={tagsFiltro.length ? "secondary" : "outline"}
                    className="h-7 px-2.5 text-[11px]"
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
            </div>
          </div>
          <ScrollArea className="flex-1">
            {carregandoConversas && (
              <p className="p-4 text-sm text-muted-foreground">Carregando conversas…</p>
            )}
            {!carregandoConversas && filtradas.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
            )}
            {filtradas.map((c) => {
              const nome = c.cliente_nome ?? c.nome_cliente ?? "Desconhecido";
              const ativa = String(c.id) === selecionada;
              const prio = (c.prioridade ?? "").toLowerCase();
              const naoLida = !!c.nao_lida;
              return (
                <button
                  key={String(c.id)}
                  onClick={() => abrirConversa(c)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border/60 border-l-4 transition-colors hover:bg-accent/60",
                    prio === "alta" ? "border-l-danger" : prio === "media" ? "border-l-warning" : "border-l-transparent",
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
                        <p className={cn("text-sm truncate", naoLida ? "font-bold" : "font-medium")}>{nome}</p>
                        <p className="text-xs text-muted-foreground">{c.telefone}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {tempoRelativo(c.ultima_mensagem_em ?? c.atualizado_em)}
                    </span>
                  </div>
                  <p className={cn("text-xs mt-1 line-clamp-1", naoLida ? "text-foreground font-medium" : "text-muted-foreground")}>
                    {c.ultima_mensagem ?? "—"}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <StatusPill status={c.status} />
                    {(c.tags ?? []).map((t) => (
                      <TagChip key={String(t.id)} tag={t} />
                    ))}
                  </div>
                </button>
              );
            })}
          </ScrollArea>
        </Card>

        {/* Thread */}
        <Card className="flex flex-col overflow-hidden">
          {!conversaAtual ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <MessageCircle className="h-10 w-10 opacity-40" />
              <p className="text-sm">Selecione uma conversa para começar.</p>
            </div>

          ) : (
            <>
              <div className="p-4 flex items-start justify-between gap-4 border-b border-border">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-medium truncate">
                      {conversaAtual.cliente_nome ?? conversaAtual.nome_cliente ?? "Desconhecido"}
                    </h2>
                    <StatusPill status={conversaAtual.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{conversaAtual.telefone}</p>
                  <TagsConversa conversaId={conversaAtual.id} aplicadas={conversaAtual.tags ?? []} />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="default" onClick={() => assumir.mutate()} disabled={assumir.isPending}>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Assumir conversa
                  </Button>
                  {(status === "escalado" || status === "em_atendimento") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolver.mutate()}
                      disabled={resolver.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Marcar como resolvido
                    </Button>
                  )}
                  {status !== "bot_ativo" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => reativarBot.mutate()}
                      disabled={reativarBot.isPending}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reativar bot
                    </Button>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                {carregandoMensagens && <p className="text-sm text-muted-foreground">Carregando mensagens…</p>}
                <div className="space-y-3">
                  {mensagens.map((m) => {
                    const saida = m.direcao === "saida";
                    const bot = saida && m.origem === "bot";
                    const imagem = m.tipo === "imagem" && !!m.media_url;
                    return (
                      <div key={String(m.id)} className={cn("flex", saida ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-3 py-2 text-sm border",
                            !saida && "bg-muted text-foreground border-border",
                            saida && bot && "bg-info/10 text-foreground border-info/30",
                            saida && !bot && "bg-primary/10 text-foreground border-primary/30",
                          )}
                        >
                          {saida && (
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                              {bot ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                              {bot ? "Bot" : "Atendente"}
                            </div>
                          )}
                          {imagem && (
                            <a href={m.media_url!} target="_blank" rel="noreferrer">
                              <img
                                src={m.media_url!}
                                alt={m.conteudo || "Imagem"}
                                className="rounded-md max-h-64 w-auto object-cover mb-1"
                                loading="lazy"
                              />
                            </a>
                          )}
                          {!!m.conteudo && <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>}
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {horaCurta(m.criado_em ?? m.enviado_em)}
                            </span>
                            {saida && <StatusEntrega status={m.status_entrega} erro={m.erro_entrega} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={fimRef} />
                </div>
              </ScrollArea>

              <Separator />

              {podeResponder && dentroJanela === false ? (
                <div className="p-4 flex items-start gap-3 border-t-2 border-warning bg-warning/10">
                  <Lock className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground">
                    Fora da janela de 24h — use um template aprovado (tela de Campanhas) pra reabrir contato.
                  </p>
                </div>
              ) : podeResponder ? (
                <div className="p-3 space-y-2">
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
                  <div className="flex items-end gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => selecionarArquivo(e.target.files?.[0] ?? null)}
                    />
                    <Button size="icon" variant="outline" onClick={() => fileRef.current?.click()} title="Enviar imagem">
                      <ImagePlus className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCatalogoAberto(true)}>
                      <LayoutGrid className="h-4 w-4 mr-2" />
                      Catálogo
                    </Button>
                    <Textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder="Escreva sua resposta…"
                      rows={2}
                      className="resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (texto.trim()) enviar.mutate(texto.trim());
                        }
                      }}
                    />
                    <Button
                      onClick={() => texto.trim() && enviar.mutate(texto.trim())}
                      disabled={!texto.trim() || enviar.isPending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Enviar
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
        </Card>

        {/* Painel lateral direito */}
        <div className="hidden xl:flex flex-col overflow-hidden">
          {conversaAtual ? (
            <PerfilCliente conversaId={conversaAtual.id} autor={autor} telefone={conversaAtual.telefone} />
          ) : (
            <Card className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Nenhuma conversa selecionada
            </Card>
          )}
        </div>
      </div>

      <CatalogoDialog open={catalogoAberto} onOpenChange={setCatalogoAberto} onSelecionar={enviarProduto} />
    </div>
  );
}
