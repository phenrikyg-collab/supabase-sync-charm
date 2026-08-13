import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";
import {
  Loader2, Flame, MessageCircle, Mail, Phone, History, ShoppingBag,
  Users, Target, DollarSign, Send, Shirt, TicketPercent, ShoppingCart,
  CreditCard, Megaphone,
} from "lucide-react";

type Oportunidade = {
  id?: string | null;
  tipo?: string | null;
  prioridade?: number | null;
  quente?: boolean | null;
  titulo?: string | null;
  detalhe?: string | null;
  acao_sugerida?: string | null;
  canal_sugerido?: string | null;
  segmento_rfm?: string | null;
  valor?: number | null;
  telefone?: string | null;
  email?: string | null;
  carrinho_id?: string | null;
  tray_customer_id?: string | number | null;
  visitante_id?: string | null;
};

type Resumo = {
  total?: number | null;
  quentes?: number | null;
  contactaveis?: number | null;
  valor_em_jogo?: number | null;
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

type ResumoVisitante = {
  produtos_vistos?: string[] | null;
  total_produtos_vistos?: number | null;
  cupom_codigo?: string | null;
  adicionou_carrinho?: boolean | null;
  iniciou_checkout?: boolean | null;
  veio_de_anuncio?: boolean | null;
  total_eventos?: number | null;
};

const brl = (v?: number | null) =>
  typeof v === "number" && isFinite(v)
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

const PERIODOS = [
  { horas: 1, label: "1h" },
  { horas: 24, label: "24h" },
  { horas: 72, label: "72h" },
];

function bordaPrioridade(p?: number | null) {
  if (p === 1) return "border-l-4 border-l-danger";
  if (p === 2) return "border-l-4 border-l-warning";
  return "border-l-4 border-l-border";
}

function IconeCanal({ canal }: { canal?: string | null }) {
  const c = (canal || "").toLowerCase();
  const cls = "h-4 w-4 shrink-0";
  if (c.includes("whats")) return <MessageCircle className={cls} aria-hidden />;
  if (c.includes("mail")) return <Mail className={cls} aria-hidden />;
  if (c.includes("lig") || c.includes("tel") || c.includes("call"))
    return <Phone className={cls} aria-hidden />;
  return <Send className={cls} aria-hidden />;
}

function horaCurta(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

const quandoEvento = (e: EventoTimeline) => e.criada_em ?? e.criado_em ?? e.created_at ?? null;
const descricaoEvento = (e: EventoTimeline) =>
  e.produto_nome || e.titulo_pagina || e.url || e.pagina || "—";

function BlocoResumo({
  icone: Icone,
  texto,
  urgente = false,
}: {
  icone: React.ElementType;
  texto: React.ReactNode;
  urgente?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          urgente ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
        )}
      >
        <Icone className="h-3.5 w-3.5" />
      </div>
      <span className={cn("pt-0.5 leading-relaxed", urgente && "font-medium text-warning")}>
        {texto}
      </span>
    </div>
  );
}

function ResumoVisitanteCard({
  resumo,
  telefone,
  onVerHistorico,
}: {
  resumo: ResumoVisitante | null;
  telefone?: string | null;
  onVerHistorico: () => void;
}) {
  const [cupomHistorico, setCupomHistorico] = useState<string | null>(null);
  const [carregandoCupom, setCarregandoCupom] = useState(false);

  useEffect(() => {
    if (resumo?.cupom_codigo || !telefone) return;
    let cancelado = false;
    setCarregandoCupom(true);
    supabase
      .rpc("whatsapp_get_historico_cliente" as any, { p_telefone: telefone })
      .then(
        ({ data, error }) => {
          if (cancelado || error) return;
          const row: any = Array.isArray(data) ? data[0] : data;
          const cupons = (row?.cupons ?? []) as { codigo?: string | null; foi_usado?: boolean | null; expirou_sem_uso?: boolean | null }[];
          const valido = cupons.find((c) => c.codigo && !c.foi_usado && !c.expirou_sem_uso);
          if (valido?.codigo) setCupomHistorico(valido.codigo);
        },
        () => {}
      )
      .then(() => setCarregandoCupom(false));
    return () => {
      cancelado = true;
    };
  }, [resumo?.cupom_codigo, telefone]);

  if (!resumo) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando resumo…
      </div>
    );
  }

  const produtos = resumo.produtos_vistos ?? [];
  const total = typeof resumo.total_produtos_vistos === "number" ? resumo.total_produtos_vistos : produtos.length;
  const visiveis = produtos.slice(0, 5);
  const restantes = Math.max(0, total - visiveis.length);

  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-muted/30 p-3">
      {total > 0 && (
        <BlocoResumo
          icone={Shirt}
          texto={
            <span>
              Viu <strong>{total}</strong> produto{total === 1 ? "" : "s"}
              {visiveis.length > 0 && ", incluindo:"}
              {visiveis.length > 0 && (
                <span className="mt-1 block pl-0">
                  {visiveis.map((nome, idx) => (
                    <span key={idx} className="block truncate">
                      {idx === 0 ? "• " : "• "}
                      {nome}
                    </span>
                  ))}
                  {restantes > 0 && (
                    <span className="block text-muted-foreground">+ {restantes} outro{restantes === 1 ? "" : "s"}</span>
                  )}
                </span>
              )}
            </span>
          }
        />
      )}

      {(resumo.cupom_codigo || cupomHistorico || carregandoCupom) && (
        <BlocoResumo
          icone={TicketPercent}
          texto={
            resumo.cupom_codigo ? (
              <span>
                Cupom aplicado: <strong>{resumo.cupom_codigo}</strong>
              </span>
            ) : cupomHistorico ? (
              <span>
                Tem cupom disponível: <strong>{cupomHistorico}</strong>
              </span>
            ) : (
              <span className="text-muted-foreground">Verificando cupons…</span>
            )
          }
        />
      )}

      {resumo.iniciou_checkout ? (
        <BlocoResumo
          icone={CreditCard}
          urgente
          texto={<span>Chegou a iniciar o checkout (não finalizou)</span>}
        />
      ) : resumo.adicionou_carrinho ? (
        <BlocoResumo
          icone={ShoppingCart}
          texto={<span>Adicionou item(ns) ao carrinho</span>}
        />
      ) : null}

      {resumo.veio_de_anuncio && (
        <BlocoResumo
          icone={Megaphone}
          texto={<span>Veio de um anúncio</span>}
        />
      )}

      <button
        type="button"
        onClick={onVerHistorico}
        className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
      >
        <History className="h-3 w-3" />
        Ver histórico completo
      </button>
    </div>
  );
}

export default function Oportunidades() {
  const [horas, setHoras] = useState(24);
  const [tiposSelecionados, setTiposSelecionados] = useState<string[]>([]);
  const [soContactaveis, setSoContactaveis] = useState(false);
  const [itens, setItens] = useState<Oportunidade[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [resumosVisitante, setResumosVisitante] = useState<Record<string, ResumoVisitante | null>>({});
  const [timeline, setTimeline] = useState<EventoTimeline[] | null>(null);
  const [carregandoTimeline, setCarregandoTimeline] = useState(false);
  const [tituloTimeline, setTituloTimeline] = useState("");
  const [carrinho, setCarrinho] = useState<Oportunidade | null>(null);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCarregando(true);
      const [feed, res] = await Promise.all([
        supabase.rpc("rastreamento_oportunidades" as any, { p_horas: horas, p_limite: 60 }),
        supabase.rpc("rastreamento_oportunidades_resumo" as any, { p_horas: horas }),
      ]);
      if (!feed.error && Array.isArray(feed.data)) setItens(feed.data as Oportunidade[]);
      if (!res.error && res.data) {
        const r = Array.isArray(res.data) ? (res.data[0] as Resumo) : (res.data as Resumo);
        setResumo(r ?? null);
      }
      setCarregando(false);
    },
    [horas],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const id = setInterval(() => carregar(true), 60000);
    return () => clearInterval(id);
  }, [carregar]);

  const tipos = useMemo(
    () => Array.from(new Set(itens.map((i) => i.tipo).filter(Boolean) as string[])),
    [itens],
  );

  const visiveis = useMemo(
    () =>
      itens.filter((i) => {
        if (tiposSelecionados.length && !tiposSelecionados.includes(i.tipo || "")) return false;
        if (soContactaveis && !i.telefone && !i.email) return false;
        return true;
      }),
    [itens, tiposSelecionados, soContactaveis],
  );

  useEffect(() => {
    const visitantes = visiveis
      .filter((o) => o.visitante_id && !resumosVisitante[o.visitante_id as string])
      .map((o) => o.visitante_id as string);
    if (visitantes.length === 0) return;

    let cancelado = false;
    Promise.all(
      visitantes.map(async (id) => {
        const { data, error } = await supabase.rpc("rastreamento_resumo_visitante" as any, {
          p_visitante_id: id,
        });
        if (error || !data) return { id, resumo: null };
        const row: any = Array.isArray(data) ? data[0] : data;
        return { id, resumo: row as ResumoVisitante | null };
      })
    ).then((resultados) => {
      if (cancelado) return;
      setResumosVisitante((prev) => {
        const novo = { ...prev };
        resultados.forEach(({ id, resumo }) => {
          novo[id] = resumo;
        });
        return novo;
      });
    });
    return () => {
      cancelado = true;
    };
  }, [visiveis, resumosVisitante]);

  const abrirTimeline = useCallback(async (o: Oportunidade) => {
    setTituloTimeline(o.titulo || "Histórico");
    setCarregandoTimeline(true);
    setTimeline([]);
    const { data } = o.tray_customer_id
      ? await supabase.rpc("rastreamento_timeline_cliente" as any, {
          p_tray_customer_id: o.tray_customer_id,
        })
      : await supabase.rpc("rastreamento_timeline_visitante" as any, {
          p_visitante_id: o.visitante_id,
        });
    setTimeline(Array.isArray(data) ? (data as EventoTimeline[]) : []);
    setCarregandoTimeline(false);
  }, []);

  const alternarTipo = (t: string) =>
    setTiposSelecionados((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Oportunidades" value={resumo?.total ?? 0} icon={Target} variant="primary" />
        <StatCard title="Quentes" value={resumo?.quentes ?? 0} icon={Flame} variant="danger" />
        <StatCard title="Contactáveis" value={resumo?.contactaveis ?? 0} icon={Users} variant="warning" />
        <StatCard title="Valor em jogo" value={brl(resumo?.valor_em_jogo)} icon={DollarSign} variant="success" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map((p) => (
          <Button
            key={p.horas}
            size="sm"
            variant={horas === p.horas ? "default" : "outline"}
            onClick={() => setHoras(p.horas)}
          >
            {p.label}
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {tipos.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tiposSelecionados.includes(t) ? "default" : "outline"}
            onClick={() => alternarTipo(t)}
          >
            {t}
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Button
          size="sm"
          variant={soContactaveis ? "default" : "outline"}
          onClick={() => setSoContactaveis((s) => !s)}
        >
          Só contactáveis
        </Button>
      </div>

      {carregando ? (
        <Card className="flex h-40 items-center justify-center rounded-xl">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </Card>
      ) : visiveis.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 rounded-xl py-16 text-center">
          <Target className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma oportunidade nas últimas {horas}h
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((o, i) => (
            <li key={o.id ?? `${o.tipo}-${i}`}>
              <Card className={cn("rounded-xl p-4", bordaPrioridade(o.prioridade))}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {o.quente && (
                        <Badge variant="outline" className="bg-danger/10 text-danger border-danger/30 text-[10px]">
                          🔥 AGORA
                        </Badge>
                      )}
                      <p className="text-sm font-medium">{o.titulo || "—"}</p>
                      {o.segmento_rfm && (
                        <Badge variant="outline" className="text-[10px]">{o.segmento_rfm}</Badge>
                      )}
                      {o.tipo && (
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {o.tipo}
                        </span>
                      )}
                    </div>
                    {o.visitante_id ? (
                      <div className="mt-3">
                        <ResumoVisitanteCard
                          resumo={resumosVisitante[o.visitante_id] ?? null}
                          telefone={o.telefone}
                          onVerHistorico={() => abrirTimeline(o)}
                        />
                      </div>
                    ) : (
                      <>
                        {o.detalhe && (
                          <p className="mt-1 text-xs text-muted-foreground">{o.detalhe}</p>
                        )}
                        {o.acao_sugerida && (
                          <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                            <IconeCanal canal={o.canal_sugerido} />
                            <span>{o.acao_sugerida}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {o.valor != null && (
                    <p className="shrink-0 font-serif text-lg font-bold">{brl(o.valor)}</p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {o.telefone && (
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={`https://wa.me/55${String(o.telefone).replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle className="mr-2 h-3.5 w-3.5" />
                        Abrir no WhatsApp
                      </a>
                    </Button>
                  )}
                  {!o.visitante_id && (
                    <Button size="sm" variant="outline" onClick={() => abrirTimeline(o)}>
                      <History className="mr-2 h-3.5 w-3.5" />
                      Ver histórico
                    </Button>
                  )}
                  {o.carrinho_id && (
                    <Button size="sm" variant="outline" onClick={() => setCarrinho(o)}>
                      <ShoppingBag className="mr-2 h-3.5 w-3.5" />
                      Ver carrinho
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={timeline !== null} onOpenChange={(o) => !o && setTimeline(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-base">{tituloTimeline}</SheetTitle>
          </SheetHeader>
          {carregandoTimeline ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (timeline?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem eventos recentes.</p>
          ) : (
            <ScrollArea className="mt-4 h-[75vh] pr-3">
              <ol className="space-y-4">
                {timeline!.map((e, i) => (
                  <li key={e.id ?? i} className="border-b border-border pb-3 last:border-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">{e.tipo ?? e.tipo_evento ?? "Evento"}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {horaCurta(quandoEvento(e))}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{descricaoEvento(e)}</p>
                  </li>
                ))}
              </ol>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!carrinho} onOpenChange={(o) => !o && setCarrinho(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-base">Carrinho</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
            <p className="font-medium">{carrinho?.titulo}</p>
            {carrinho?.detalhe && (
              <p className="text-xs text-muted-foreground">{carrinho.detalhe}</p>
            )}
            {carrinho?.valor != null && (
              <p className="font-serif text-xl font-bold">{brl(carrinho.valor)}</p>
            )}
            <p className="text-xs text-muted-foreground">ID: {carrinho?.carrinho_id}</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
