import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Eye, Shirt, ShoppingBag, CreditCard, CheckCircle2, Globe, Instagram,
  Search, Radar, MousePointerClick, Loader2,
} from "lucide-react";

type Visitante = {
  visitante_id: string;
  nome_cliente?: string | null;
  ultima_pagina?: string | null;
  ultimo_evento?: string | null;
  tipo_evento?: string | null;
  tipo_ultimo_evento?: string | null;
  origem?: string | null;
  ultima_atividade: string;
  segmento_rfm?: string | null;
};

type EventoTimeline = {
  id?: string;
  tipo_evento?: string | null;
  pagina?: string | null;
  produto_nome?: string | null;
  criado_em?: string | null;
  created_at?: string | null;
};

const JANELA_MS = 5 * 60 * 1000;

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

  const ordenados = useMemo(
    () =>
      [...visitantes].sort(
        (a, b) => new Date(b.ultima_atividade).getTime() - new Date(a.ultima_atividade).getTime(),
      ),
    [visitantes],
  );

  const etapas = useMemo(() => {
    const def = [
      { chave: "page_view", titulo: "Navegando", icon: Eye, cor: "text-muted-foreground", borda: "border-border" },
      { chave: "product_view", titulo: "Viu produto", icon: Shirt, cor: "text-primary", borda: "border-primary/40" },
      { chave: "add_to_cart", titulo: "Carrinho", icon: ShoppingBag, cor: "text-warning", borda: "border-warning/40" },
      { chave: "checkout", titulo: "Checkout", icon: CreditCard, cor: "text-success", borda: "border-success/40" },
    ] as const;

    const etapaDe = (v: Visitante) => {
      const t = (v.tipo_evento || v.ultimo_evento || "").toLowerCase();
      if (t.includes("purchase") || t.includes("checkout")) return "checkout";
      if (t.includes("cart")) return "add_to_cart";
      if (t.includes("product")) return "product_view";
      return "page_view";
    };

    return def.map((e) => ({
      ...e,
      visitantes: ordenados.filter((v) => etapaDe(v) === e.chave),
    }));
  }, [ordenados]);

  const CardVisitante = ({ v }: { v: Visitante }) => {
    const meta = metaEvento(v.tipo_evento || v.ultimo_evento);
    const Icone = meta.icon;
    const novo = novosRef.current.has(v.visitante_id);
    const ativo = selecionado?.visitante_id === v.visitante_id;
    return (
      <li>
        <button
          type="button"
          onClick={() => abrirTimeline(v)}
          className={cn(
            "w-full rounded-lg border bg-card p-3 text-left transition-all duration-300 hover:border-primary/50",
            "animate-in fade-in slide-in-from-left-4",
            novo ? "border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]" : "border-border",
            ativo && "border-primary bg-primary/5",
          )}
        >
          <div className="flex items-center gap-2">
            <span
              aria-label="ao vivo"
              role="img"
              className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-success"
            />
            <span
              className={cn(
                "truncate text-sm font-medium",
                v.nome_cliente ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {v.nome_cliente || "Visitante anônimo"}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{v.ultima_pagina || "—"}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className={cn("inline-flex items-center gap-1", meta.className)}>
              <Icone className="h-3 w-3" />
              {meta.label}
            </span>
            <span className="inline-flex items-center gap-1">
              <IconeOrigem origem={v.origem} />
              {v.origem || "direto"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{tempoRelativo(v.ultima_atividade)}</p>
        </button>
      </li>
    );
  };

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

      {carregando ? (
        <Card className="flex h-40 items-center justify-center rounded-xl">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {etapas.map((e) => {
            const IconeEtapa = e.icon;
            return (
              <Card key={e.chave} className={cn("rounded-xl border-t-4 p-4", e.borda)}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className={cn("inline-flex items-center gap-2 text-sm font-medium", e.cor)}>
                    <IconeEtapa className="h-4 w-4" />
                    {e.titulo}
                  </span>
                  <Badge variant="outline">{e.visitantes.length}</Badge>
                </div>
                {e.visitantes.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">Ninguém nesta etapa</p>
                ) : (
                  <ScrollArea className="h-[420px] pr-2">
                    <ul aria-live="polite" className="space-y-2">
                      {e.visitantes.map((v) => (
                        <CardVisitante key={v.visitante_id} v={v} />
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-6">
        {/* Timeline */}
        <div>

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
                        const meta = metaEvento(e.tipo_evento);
                        const Icone = meta.icon;
                        const quando = e.criado_em || e.created_at;
                        return (
                          <li key={e.id ?? i} className="relative">
                            <span className="absolute -left-6 top-1 flex h-[19px] w-[19px] items-center justify-center rounded-full border border-border bg-card">
                              <Icone className={cn("h-3 w-3", meta.className)} />
                            </span>
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-sm font-medium">{meta.label}</p>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {horaCurta(quando)}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {e.produto_nome || e.pagina || "—"}
                            </p>
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
    </div>
  );
}
