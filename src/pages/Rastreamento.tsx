import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Eye, Shirt, ShoppingBag, CreditCard, CheckCircle2, Globe, Instagram,
  Search, Radar, MousePointerClick, Loader2, Send,
} from "lucide-react";

type Visitante = {
  visitante_id: string;
  nome_cliente?: string | null;
  ultima_pagina?: string | null;
  ultimo_evento?: string | null;
  tipo_evento?: string | null;
  origem?: string | null;
  ultima_atividade: string;
  segmento_rfm?: string | null;
};

type EventoTimeline = {
  id?: string;
  tipo?: string | null;
  tipo_evento?: string | null;
  url?: string | null;
  pagina?: string | null;
  titulo_pagina?: string | null;
  produto_nome?: string | null;
  criada_em?: string | null;
  criado_em?: string | null;
  created_at?: string | null;
};

const JANELA_MS = 5 * 60 * 1000;

const tipoEvento = (e: EventoTimeline) => e.tipo ?? e.tipo_evento ?? null;
const quandoEvento = (e: EventoTimeline) => e.criada_em ?? e.criado_em ?? e.created_at ?? null;
const descricaoEvento = (e: EventoTimeline) =>
  e.produto_nome || e.titulo_pagina || e.url || e.pagina || "—";

function tempoRelativo(iso?: string | null) {
  if (!iso) return "—";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  return `há ${h}h`;
}

function horaCurta(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const EVENTO_META: Record<string, { icon: typeof Eye; label: string; className: string }> = {
  page_view: { icon: Eye, label: "Visualizou página", className: "text-muted-foreground" },
  product_view: { icon: Shirt, label: "Viu produto", className: "text-primary" },
  cart_view: { icon: ShoppingBag, label: "Viu o carrinho", className: "text-warning" },
  add_to_cart: { icon: ShoppingBag, label: "Adicionou ao carrinho", className: "text-warning" },
  checkout_start: { icon: CreditCard, label: "Iniciou checkout", className: "text-warning" },
  purchase: { icon: CheckCircle2, label: "Comprou", className: "text-success" },
};

function metaEvento(tipo?: string | null) {
  return EVENTO_META[(tipo || "").toLowerCase()] ?? {
    icon: MousePointerClick,
    label: tipo || "Evento",
    className: "text-muted-foreground",
  };
}

/** Etapas do funil, da menos avançada pra mais avançada. */
const ETAPAS_FUNIL: { tipos: string[]; label: string; className: string }[] = [
  { tipos: ["page_view", "session_start"], label: "👀 Navegando", className: "bg-muted text-muted-foreground border-border" },
  { tipos: ["product_view", "view_item"], label: "🛍️ Vendo produto", className: "bg-primary/10 text-primary border-primary/20" },
  { tipos: ["cart_view", "add_to_cart"], label: "🛒 No carrinho", className: "bg-warning/10 text-warning border-warning/20" },
  { tipos: ["checkout_start", "begin_checkout"], label: "💳 No checkout", className: "bg-warning/10 text-warning border-warning/30" },
  { tipos: ["purchase"], label: "✅ Comprou", className: "bg-success/10 text-success border-success/20" },
];

function indiceEtapa(tipo?: string | null) {
  const t = (tipo || "").toLowerCase();
  for (let i = ETAPAS_FUNIL.length - 1; i >= 0; i--) {
    if (ETAPAS_FUNIL[i].tipos.includes(t)) return i;
  }
  return -1;
}

function IconeOrigem({ origem }: { origem?: string | null }) {
  const o = (origem || "").toLowerCase();
  const cls = "h-3.5 w-3.5 shrink-0";
  if (o.includes("insta")) return <Instagram className={cls} aria-hidden />;
  if (o.includes("google") || o.includes("search")) return <Search className={cls} aria-hidden />;
  return <Globe className={cls} aria-hidden />;
}

function corSegmento(seg?: string | null) {
  const s = (seg || "").toLowerCase();
  if (["campeões", "campeoes", "clientes fiéis", "clientes fieis"].some((x) => s.includes(x)))
    return "bg-success/10 text-success border-success/20";
  if (["risco", "atenção", "atencao", "hibernando", "não pode perder", "nao pode perder"].some((x) => s.includes(x)))
    return "bg-warning/10 text-warning border-warning/20";
  if (s.includes("perdido")) return "bg-danger/10 text-danger border-danger/20";
  return "bg-muted text-muted-foreground border-border";
}

export default function Rastreamento() {
  const [visitantes, setVisitantes] = useState<Visitante[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState<Visitante | null>(null);
  const [timeline, setTimeline] = useState<EventoTimeline[]>([]);
  const [carregandoTimeline, setCarregandoTimeline] = useState(false);
  const [etapas, setEtapas] = useState<Record<string, number>>({});
  const [alvoMensagem, setAlvoMensagem] = useState<Visitante | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [, forceTick] = useState(0);
  const novosRef = useRef<Set<string>>(new Set());
  const conhecidosRef = useRef<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc("rastreamento_visitantes_ativos_agora");
    if (!error && Array.isArray(data)) {
      const lista = (data as Visitante[]).filter(
        (v) => Date.now() - new Date(v.ultima_atividade).getTime() < JANELA_MS,
      );
      lista.forEach((v) => {
        if (!conhecidosRef.current.has(v.visitante_id)) {
          conhecidosRef.current.add(v.visitante_id);
          novosRef.current.add(v.visitante_id);
          setTimeout(() => {
            novosRef.current.delete(v.visitante_id);
            forceTick((t) => t + 1);
          }, 3000);
        }
      });
      setVisitantes(lista);

      // Etapa mais avançada alcançada na sessão atual (via timeline)
      const resultados = await Promise.all(
        lista.slice(0, 25).map(async (v) => {
          const { data: eventos } = await supabase.rpc("rastreamento_timeline_visitante", {
            p_visitante_id: v.visitante_id,
          });
          const lista2 = Array.isArray(eventos) ? (eventos as EventoTimeline[]) : [];
          const max = lista2.reduce((acc, e) => Math.max(acc, indiceEtapa(tipoEvento(e))), -1);
          return [v.visitante_id, Math.max(max, indiceEtapa(v.tipo_evento || v.ultimo_evento))] as const;
        }),
      );
      setEtapas(Object.fromEntries(resultados));
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
    const canal = supabase
      .channel("visitantes-ao-vivo")
      .on("postgres_changes", { event: "*", schema: "rastreamento", table: "eventos" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "rastreamento", table: "visitantes" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  // Expiração local (silêncio > 5min) + atualização dos contadores "há Xs"
  useEffect(() => {
    const id = setInterval(() => {
      setVisitantes((prev) =>
        prev.filter((v) => Date.now() - new Date(v.ultima_atividade).getTime() < JANELA_MS),
      );
      forceTick((t) => t + 1);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const abrirTimeline = useCallback(async (v: Visitante) => {
    setSelecionado(v);
    setCarregandoTimeline(true);
    const { data } = await supabase.rpc("rastreamento_timeline_visitante", {
      p_visitante_id: v.visitante_id,
    });
    setTimeline(Array.isArray(data) ? (data as EventoTimeline[]) : []);
    setCarregandoTimeline(false);
  }, []);

  useEffect(() => {
    if (!selecionado) return;
    const id = setInterval(() => abrirTimeline(selecionado), 15000);
    return () => clearInterval(id);
  }, [selecionado, abrirTimeline]);

  const enviarMensagem = useCallback(async () => {
    if (!alvoMensagem || !texto.trim()) return;
    setEnviando(true);
    try {
      const { data: conversa, error } = await supabase.rpc("chat_site_get_or_create_conversa" as any, {
        p_visitante_id: alvoMensagem.visitante_id,
      });
      if (error) throw error;
      const conversaId = Array.isArray(conversa) ? (conversa[0] as any)?.id : (conversa as any)?.id ?? conversa;
      const { error: erroMsg } = await supabase.rpc("whatsapp_registrar_mensagem_humana" as any, {
        p_conversa_id: conversaId,
        p_conteudo: texto.trim(),
      });
      if (erroMsg) throw erroMsg;
      toast.success("Mensagem enviada para a visitante");
      setAlvoMensagem(null);
      setTexto("");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar a mensagem");
    } finally {
      setEnviando(false);
    }
  }, [alvoMensagem, texto]);

  const ordenados = useMemo(
    () =>
      [...visitantes].sort(
        (a, b) => new Date(b.ultima_atividade).getTime() - new Date(a.ultima_atividade).getTime(),
      ),
    [visitantes],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Radar className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Visitantes ao Vivo</h1>
          <p className="text-sm text-muted-foreground">
            {ordenados.length} {ordenados.length === 1 ? "visitante ativa" : "visitantes ativas"} agora
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Lista */}
        <div className="lg:col-span-3">
          <Card className="rounded-xl p-4">
            {carregando ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : ordenados.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Radar className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Nenhuma visitante no site agora 👀</p>
              </div>
            ) : (
              <ul aria-live="polite" className="space-y-3">
                {ordenados.map((v) => {
                  const meta = metaEvento(v.tipo_evento || v.ultimo_evento);
                  const Icone = meta.icon;
                  const novo = novosRef.current.has(v.visitante_id);
                  const ativo = selecionado?.visitante_id === v.visitante_id;
                  const idxEtapa = etapas[v.visitante_id] ?? indiceEtapa(v.tipo_evento || v.ultimo_evento);
                  const etapa = idxEtapa >= 0 ? ETAPAS_FUNIL[idxEtapa] : null;
                  return (
                    <li key={v.visitante_id}>
                      <div
                        className={cn(
                          "w-full rounded-xl border bg-card p-4 transition-all duration-300 hover:border-primary/50",
                          "animate-in fade-in slide-in-from-left-4",
                          novo ? "border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]" : "border-border",
                          ativo && "border-primary bg-primary/5",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => abrirTimeline(v)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  aria-label="ao vivo"
                                  role="img"
                                  className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-success"
                                />
                                <span
                                  className={cn(
                                    "truncate font-medium",
                                    v.nome_cliente ? "text-foreground" : "text-muted-foreground",
                                  )}
                                >
                                  {v.nome_cliente || "Visitante anônimo"}
                                </span>
                                {etapa && (
                                  <Badge variant="outline" className={etapa.className}>
                                    {etapa.label}
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 truncate text-sm text-muted-foreground">
                                {v.ultima_pagina || "—"}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span className={cn("inline-flex items-center gap-1", meta.className)}>
                                  <Icone className="h-3.5 w-3.5" />
                                  {meta.label}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <IconeOrigem origem={v.origem} />
                                  {v.origem || "direto"}
                                </span>
                              </div>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {tempoRelativo(v.ultima_atividade)}
                            </span>
                          </div>
                        </button>
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAlvoMensagem(v);
                              setTexto("");
                            }}
                          >
                            <Send className="mr-2 h-3.5 w-3.5" />
                            Enviar mensagem
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2">
          <Card className="rounded-xl p-4">
            {!selecionado ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Selecione uma visitante para ver a jornada.
              </p>
            ) : (
              <>
                <div className="mb-4 border-b border-border pb-4">
                  <div className="flex items-center gap-2">
                    <span
                      aria-label="ao vivo"
                      role="img"
                      className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-success"
                    />
                    <h2 className="font-semibold">
                      {selecionado.nome_cliente || "Visitante anônimo"}
                    </h2>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {selecionado.segmento_rfm && (
                      <Badge variant="outline" className={corSegmento(selecionado.segmento_rfm)}>
                        {selecionado.segmento_rfm}
                      </Badge>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <IconeOrigem origem={selecionado.origem} />
                      {selecionado.origem || "direto"}
                    </span>
                  </div>
                </div>

                {carregandoTimeline ? (
                  <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : timeline.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sem eventos recentes.</p>
                ) : (
                  <ScrollArea className="h-[520px] pr-3">
                    <ol className="relative space-y-4 pl-6">
                      <span className="absolute left-[9px] top-2 bottom-2 w-px bg-border" aria-hidden />
                      {timeline.map((e, i) => {
                        const meta = metaEvento(tipoEvento(e));
                        const Icone = meta.icon;
                        return (
                          <li key={e.id ?? i} className="relative">
                            <span className="absolute -left-6 top-1 flex h-[19px] w-[19px] items-center justify-center rounded-full border border-border bg-card">
                              <Icone className={cn("h-3 w-3", meta.className)} />
                            </span>
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-sm font-medium">{meta.label}</p>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {horaCurta(quandoEvento(e))}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{descricaoEvento(e)}</p>
                          </li>
                        );
                      })}
                    </ol>
                  </ScrollArea>
                )}
              </>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={!!alvoMensagem} onOpenChange={(o) => !o && setAlvoMensagem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mensagem para {alvoMensagem?.nome_cliente || "visitante anônimo"}
            </DialogTitle>
            <DialogDescription>
              A mensagem aparece no chat do site automaticamente, mesmo que ela esteja com o chat fechado.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            placeholder="Oi! Vi que você está olhando o carrinho — posso te ajudar com algo?"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlvoMensagem(null)}>
              Cancelar
            </Button>
            <Button onClick={enviarMensagem} disabled={enviando || !texto.trim()}>
              {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
