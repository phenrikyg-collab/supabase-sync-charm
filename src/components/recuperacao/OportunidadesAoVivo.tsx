import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/financeiroFormat";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, MessageCircle, Mail, Megaphone, MessagesSquare, Bot, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { BadgesContato, useContatoPorTelefones } from "@/components/atendimento/contatoTelefones";
import { BotaoConversa } from "@/components/recuperacao/BotaoConversa";

type Resumo = {
  total: number;
  quentes: number;
  contactaveis: number;
  valor_em_jogo: number;
  por_tipo?: Record<string, number> | null;
} | null;

type Oportunidade = {
  conversa_id?: string | number | null;
  tipo: string | null;
  prioridade: number | null;
  titulo: string | null;
  detalhe: string | null;
  acao_sugerida: string | null;
  canal_sugerido: string | null;
  valor: number | null;
  quente: boolean | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  segmento_rfm: string | null;
  ocorrido_em: string | null;
  tray_customer_id?: string | number | null;
  visitante_id?: string | number | null;
  ja_contatada?: boolean | null;
  contato_em?: string | null;
  contato_tipo?: string | null;
  minutos_desde_contato?: number | null;
};

const CANAL_STYLES: Record<string, string> = {
  whatsapp: "bg-green-100 text-green-800 border-green-300",
  "chat do site": "bg-blue-100 text-blue-800 border-blue-300",
  "e-mail": "bg-violet-100 text-violet-800 border-violet-300",
  email: "bg-violet-100 text-violet-800 border-violet-300",
  "anúncios": "bg-amber-100 text-amber-900 border-amber-300",
  anuncios: "bg-amber-100 text-amber-900 border-amber-300",
};

const TIPOS: { valor: string; rotulo: string }[] = [
  { valor: "carrinho_ativo_agora", rotulo: "Carrinho ativo agora" },
  { valor: "checkout_abandonado", rotulo: "Checkout abandonado" },
  { valor: "carrinho_cliente_conhecida", rotulo: "Carrinho de cliente conhecida" },
  { valor: "hesitacao_produto", rotulo: "Hesitação em produto" },
  { valor: "vip_navegando", rotulo: "Cliente VIP navegando" },
];

const STATUS: { valor: string; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "nao_contatadas", rotulo: "Não contatadas" },
  { valor: "contatadas", rotulo: "Já contatadas" },
  { valor: "automacao", rotulo: "Só automação respondeu" },
];

const PERIODOS: { horas: number; rotulo: string }[] = [
  { horas: 6, rotulo: "6h" },
  { horas: 24, rotulo: "24h" },
  { horas: 48, rotulo: "48h" },
  { horas: 168, rotulo: "7 dias" },
];

const CHAVE_FILTROS = "oportunidades-filtros";

type Filtros = { status: string; tipo: string; soQuentes: boolean; horas: number };

const FILTROS_PADRAO: Filtros = { status: "nao_contatadas", tipo: "todos", soQuentes: false, horas: 24 };

function lerFiltros(): Filtros {
  try {
    const bruto = localStorage.getItem(CHAVE_FILTROS);
    if (!bruto) return FILTROS_PADRAO;
    const salvo = JSON.parse(bruto);
    return {
      status: typeof salvo?.status === "string" ? salvo.status : FILTROS_PADRAO.status,
      tipo: typeof salvo?.tipo === "string" ? salvo.tipo : FILTROS_PADRAO.tipo,
      soQuentes: salvo?.soQuentes === true,
      horas: PERIODOS.some((p) => p.horas === salvo?.horas) ? salvo.horas : FILTROS_PADRAO.horas,
    };
  } catch {
    return FILTROS_PADRAO;
  }
}

function salvarFiltros(f: Filtros) {
  try {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify(f));
  } catch {
    /* espaço indisponível, segue sem salvar */
  }
}

function tempoRelativo(minutos: number | null | undefined) {
  const m = Number(minutos ?? 0);
  if (!Number.isFinite(m) || m < 1) return "agora";
  if (m < 60) return `${Math.round(m)} min`;
  const horas = m / 60;
  if (horas < 24) return `${Math.round(horas)}h`;
  return `${Math.round(horas / 24)} dias`;
}

function chaveDa(o: Oportunidade) {
  return `${o.tipo ?? ""}|${o.tray_customer_id ?? o.visitante_id ?? ""}`;
}

function IconeCanal({ canal }: { canal: string }) {
  const c = canal.toLowerCase();
  if (c.includes("whats")) return <MessageCircle className="h-3.5 w-3.5" />;
  if (c.includes("mail")) return <Mail className="h-3.5 w-3.5" />;
  if (c.includes("an")) return <Megaphone className="h-3.5 w-3.5" />;
  return <MessagesSquare className="h-3.5 w-3.5" />;
}

export function OportunidadesAoVivo({
  refreshKey,
  intervaloMs,
  onAbrirConversa,
  onContagem,
}: {
  refreshKey?: number;
  /** Quando informado, o bloco se atualiza sozinho nesse intervalo. */
  intervaloMs?: number;
  /** Quando a oportunidade já tem conversa, abrir dentro do próprio painel. */
  onAbrirConversa?: (conversaId: string) => void;
  /** Informa quantas oportunidades estão na lista, para a contagem da aba. */
  onContagem?: (n: number) => void;
}) {
  const [resumo, setResumo] = useState<Resumo>(null);
  const [lista, setLista] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<Filtros>(() => lerFiltros());
  const [tratadas, setTratadas] = useState<Set<string>>(new Set());
  const [saindo, setSaindo] = useState<Set<string>>(new Set());

  const atualizarFiltros = useCallback((parcial: Partial<Filtros>) => {
    setFiltros((atual) => {
      const novo = { ...atual, ...parcial };
      salvarFiltros(novo);
      return novo;
    });
  }, []);

  const carregar = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        (supabase as any).rpc("rastreamento_oportunidades_resumo", { p_horas: filtros.horas }),
        (supabase as any).rpc("rastreamento_oportunidades_status", { p_horas: filtros.horas, p_limite: 60 }),
      ]);
      if (!r1.error) setResumo((r1.data ?? null) as Resumo);
      if (!r2.error) setLista((Array.isArray(r2.data) ? r2.data : []) as Oportunidade[]);
    } finally {
      setLoading(false);
    }
  }, [filtros.horas]);

  useEffect(() => { carregar(); }, [carregar, refreshKey]);

  useEffect(() => {
    if (!intervaloMs) return;
    const t = window.setInterval(() => carregar(), intervaloMs);
    return () => window.clearInterval(t);
  }, [carregar, intervaloMs]);

  const marcarTratada = useCallback((chave: string) => {
    setSaindo((atual) => new Set(atual).add(chave));
    window.setTimeout(() => {
      setTratadas((atual) => new Set(atual).add(chave));
      setSaindo((atual) => {
        const novo = new Set(atual);
        novo.delete(chave);
        return novo;
      });
      carregar();
    }, 320);
  }, [carregar]);

  const porStatus = useCallback((o: Oportunidade) => {
    const contatada = o.ja_contatada === true;
    if (filtros.status === "nao_contatadas") return !contatada;
    if (filtros.status === "contatadas") return contatada;
    if (filtros.status === "automacao") return contatada && o.contato_tipo === "automacao";
    return true;
  }, [filtros.status]);

  const visiveis = useMemo(() => {
    return lista.filter((o) => {
      const chave = chaveDa(o);
      if (tratadas.has(chave)) return false;
      if (!porStatus(o)) return false;
      if (filtros.tipo !== "todos" && o.tipo !== filtros.tipo) return false;
      if (filtros.soQuentes && o.quente !== true) return false;
      return true;
    });
  }, [lista, tratadas, porStatus, filtros.tipo, filtros.soQuentes]);

  useEffect(() => { onContagem?.(visiveis.length); }, [visiveis.length, onContagem]);

  const contagemTipo = useMemo(() => {
    const base = lista.filter((o) => {
      if (tratadas.has(chaveDa(o))) return false;
      if (!porStatus(o)) return false;
      if (filtros.soQuentes && o.quente !== true) return false;
      return true;
    });
    const mapa: Record<string, number> = { todos: base.length };
    for (const t of TIPOS) mapa[t.valor] = base.filter((o) => o.tipo === t.valor).length;
    return mapa;
  }, [lista, tratadas, porStatus, filtros.soQuentes]);

  const telefones = useMemo(() => visiveis.map((o) => o.telefone), [visiveis]);
  const { contatoDe } = useContatoPorTelefones(telefones);

  const partes: string[] = [];
  if ((resumo?.quentes ?? 0) > 0) partes.push(`${resumo!.quentes} quentes agora`);
  if ((resumo?.contactaveis ?? 0) > 0) partes.push(`${resumo!.contactaveis} com contato`);
  if ((resumo?.valor_em_jogo ?? 0) > 0) partes.push(`${brl(resumo!.valor_em_jogo)} em carrinho neste momento`);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="font-serif text-xl font-bold">Oportunidades ao Vivo</h2>
        {partes.length > 0 && (
          <p className="text-sm text-muted-foreground">{partes.join(" · ")}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1">
          {STATUS.map((s) => (
            <Button
              key={s.valor}
              size="sm"
              variant={filtros.status === s.valor ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => atualizarFiltros({ status: s.valor })}
            >
              {s.rotulo}
            </Button>
          ))}
        </div>

        <span className="h-4 w-px bg-border" />

        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant={filtros.tipo === "todos" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => atualizarFiltros({ tipo: "todos" })}
          >
            Todos ({contagemTipo.todos ?? 0})
          </Button>
          {TIPOS.map((t) => (
            <Button
              key={t.valor}
              size="sm"
              variant={filtros.tipo === t.valor ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => atualizarFiltros({ tipo: t.valor })}
            >
              {t.rotulo} ({contagemTipo[t.valor] ?? 0})
            </Button>
          ))}
        </div>

        <span className="h-4 w-px bg-border" />

        <Button
          size="sm"
          variant={filtros.soQuentes ? "default" : "outline"}
          className="h-7 gap-1 text-xs"
          onClick={() => atualizarFiltros({ soQuentes: !filtros.soQuentes })}
        >
          <Flame className="h-3 w-3" /> Só quentes
        </Button>

        <span className="h-4 w-px bg-border" />

        <div className="flex items-center gap-1">
          {PERIODOS.map((p) => (
            <Button
              key={p.horas}
              size="sm"
              variant={filtros.horas === p.horas ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => atualizarFiltros({ horas: p.horas })}
            >
              {p.rotulo}
            </Button>
          ))}
        </div>

        {tratadas.size > 0 && (
          <span className="text-xs text-muted-foreground">
            {tratadas.size} tratadas agora
            <button
              type="button"
              className="ml-1 underline hover:text-foreground"
              onClick={() => setTratadas(new Set())}
            >
              mostrar
            </button>
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : visiveis.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground text-center">
            Nenhuma oportunidade com esses filtros
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visiveis.map((o, i) => {
            const quente = o.quente === true;
            const canal = (o.canal_sugerido ?? "").trim();
            const canalKey = canal.toLowerCase();
            const contato = contatoDe(o.telefone);
            const idConversa = o.conversa_id ?? contato?.conversa_id ?? null;
            const chave = chaveDa(o);
            const contatada = o.ja_contatada === true;
            const porHumano = o.contato_tipo === "humano";
            return (
              <Card
                key={`${chave}-${i}`}
                className={cn(
                  "transition-opacity duration-300",
                  quente && "border-orange-400 bg-orange-50 dark:bg-orange-950/20",
                  contatada && "opacity-60",
                  saindo.has(chave) && "opacity-0",
                )}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug">{o.titulo ?? "Oportunidade"}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {o.valor != null && (
                        <span className="font-serif font-bold text-sm">{brl(o.valor)}</span>
                      )}
                      {quente && (
                        <Badge className="bg-orange-500 text-white gap-1">
                          <Flame className="h-3 w-3" /> Agora
                        </Badge>
                      )}
                      {contatada && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1 text-[10px]",
                            porHumano
                              ? "bg-green-100 text-green-800 border-green-300"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {porHumano ? <UserCheck className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                          {porHumano
                            ? `falaram há ${tempoRelativo(o.minutos_desde_contato)}`
                            : `automação respondeu há ${tempoRelativo(o.minutos_desde_contato)}`}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {o.detalhe && <p className="text-sm text-muted-foreground">{o.detalhe}</p>}

                  <div className="flex flex-wrap items-center gap-2">
                    {o.nome && <span className="text-xs font-medium">{o.nome}</span>}
                    {o.segmento_rfm && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{o.segmento_rfm}</Badge>
                    )}
                    <BadgesContato contato={contato} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                    {canal && (
                      <Badge
                        variant="outline"
                        className={cn("gap-1 text-[11px]", CANAL_STYLES[canalKey] ?? "bg-muted text-muted-foreground")}
                      >
                        <IconeCanal canal={canal} /> {canal}
                      </Badge>
                    )}
                    {o.acao_sugerida && (
                      <span className="text-xs text-foreground/80 flex-1 min-w-[8rem]">{o.acao_sugerida}</span>
                    )}
                    {(idConversa || o.telefone) && (
                      <BotaoConversa
                        conversaId={idConversa}
                        telefone={o.telefone}
                        onAbrirConversa={onAbrirConversa}
                        onAberta={() => marcarTratada(chave)}
                        className="h-7 text-xs"
                      />
                    )}
                    {o.telefone && (
                      <span className="text-xs text-muted-foreground">{o.telefone}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
