import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { brl, num } from "@/lib/financeiroFormat";
import { dataBr } from "@/lib/financeiroFormat";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, ShoppingCart, PackageX, Target, Zap, CalendarDays,
  TrendingUp, ArrowRight, Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============ Tipos (payload da RPC whatsapp_dashboard_vendas_ao_vivo) ============

type VendasHoje = { pedidos: number; receita: number; ticket_medio: number };

type MetaMensal = {
  mes_referencia: string;
  meta_total: number | null;
  ticket_medio_meta: number | null;
  realizado: number;
  pedidos_realizados: number;
  restante: number;
  percentual_atingido: number;
  dias_uteis_restantes: number;
  pedidos_necessarios_meta: number;
  ticket_medio_necessario: number;
  media_diaria_necessaria: number;
  media_diaria_realizada: number;
  nivel_risco: string | null;
} | null;

type AcaoSemana = {
  numero: number;
  nome_comercial: string;
  subtitulo: string | null;
  tipo: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  meta_receita: number;
  pedidos_esperados: number;
  receita_realizada: number;
  pedidos_realizados: number;
  percentual_atingido: number;
} | null;

type ProximaAcao = {
  numero: number;
  nome_comercial: string;
  subtitulo: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  meta_receita: number;
} | null;

type CarrinhosAbandonados = {
  quantidade: number;
  valor_total: number;
  quantidade_com_telefone: number;
  valor_com_telefone: number;
};

type PedidosCanceladosPendentes = {
  periodo_dias: number;
  quantidade: number;
  valor_total: number;
};

type RecuperacaoItem = {
  quantidade: number;
  valor_total: number;
  quantidade_recuperada: number;
  valor_recuperado: number;
  percentual_recuperado: number;
};

type RecuperacaoOntem = {
  label: string;
  periodo_inicio: string;
  periodo_fim: string;
  carrinhos_abandonados: RecuperacaoItem;
  pedidos_cancelados: RecuperacaoItem;
} | null;

type Dashboard = {
  data_hoje: string;
  vendas_hoje: VendasHoje;
  meta_mensal: MetaMensal;
  acao_semana: AcaoSemana;
  proxima_acao: ProximaAcao;
  carrinhos_abandonados: CarrinhosAbandonados;
  pedidos_cancelados_pendentes: PedidosCanceladosPendentes;
  recuperacao_ontem: RecuperacaoOntem;
};

// ============ Helpers ============

const nf = (v: number | null | undefined) => num(v ?? 0, 0);
const money = (v: number | null | undefined) => brl(v ?? 0);

/** "2026-08-23" → "Domingo, 23 de agosto" */
function dataPorExtenso(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  if (isNaN(d.getTime())) return s;
  const txt = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

const RISCO_STYLES: Record<string, string> = {
  "META BATIDA": "bg-success text-success-foreground",
  "RISCO BAIXO": "bg-success/20 text-success border border-success/40",
  "RISCO MODERADO": "bg-warning/20 text-warning border border-warning/40",
  "RISCO ALTO": "bg-danger/20 text-danger border border-danger/40",
};

const TIPO_ACAO_STYLES: Record<string, string> = {
  tatica: "bg-primary/10 text-primary border border-primary/30",
  tática: "bg-primary/10 text-primary border border-primary/30",
  estrutural: "bg-accent text-accent-foreground border border-border",
  sazonal: "bg-warning/15 text-warning border border-warning/30",
};

// ============ Blocos ============

function BlocoVendasHoje({ data }: { data: Dashboard }) {
  const v = data.vendas_hoje ?? { pedidos: 0, receita: 0, ticket_medio: 0 };
  const itens = [
    { rotulo: "Pedidos hoje", valor: nf(v.pedidos) },
    { rotulo: "Receita hoje", valor: money(v.receita) },
    { rotulo: "Ticket médio hoje", valor: money(v.ticket_medio) },
  ];
  return (
    <section>
      <p className="text-sm text-muted-foreground mb-2">{dataPorExtenso(data.data_hoje)}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {itens.map((it) => (
          <Card key={it.rotulo} className="border-primary/20">
            <CardContent className="p-6 text-center">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{it.rotulo}</p>
              {/* pedidos = 0 é dia normal (pode estar cedo) — não tratar como erro */}
              <p className="font-serif text-5xl font-bold mt-2 text-card-foreground">{it.valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function BlocoMetaMensal({ meta }: { meta: MetaMensal }) {
  if (!meta || meta.meta_total == null) {
    return (
      <section>
        <Card>
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <Target className="h-8 w-8 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <h2 className="font-serif text-xl font-bold">Meta do Mês — WhatsApp</h2>
              <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada para este mês.</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/bonificacao-whatsapp">Cadastrar meta mensal</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const pct = Math.max(0, Math.min(100, meta.percentual_atingido ?? 0));
  const risco = (meta.nivel_risco ?? "").toUpperCase();

  return (
    <section>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-bold">Meta do Mês — WhatsApp</h2>
              <p className="text-sm text-muted-foreground">
                {money(meta.realizado)} de {money(meta.meta_total)}
              </p>
            </div>
            {risco && (
              <Badge className={cn("text-sm px-3 py-1", RISCO_STYLES[risco] ?? "bg-muted text-muted-foreground")}>
                {meta.nivel_risco}
              </Badge>
            )}
          </div>

          <div className="relative">
            <Progress value={pct} className="h-4" />
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-primary-foreground mix-blend-difference">
              {nf(meta.percentual_atingido)}%
            </span>
          </div>

          {/* Duas formas de olhar a mesma lacuna */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Pedidos que faltam</p>
              <p className="font-serif text-3xl font-bold mt-1">{nf(meta.pedidos_necessarios_meta)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                no ticket médio de {money(meta.ticket_medio_meta)}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Ticket médio necessário</p>
              <p className="font-serif text-3xl font-bold mt-1">{money(meta.ticket_medio_necessario)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                nos pedidos que ainda faltam, no ritmo atual de vendas
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Faltam {money(meta.restante)} em {nf(meta.dias_uteis_restantes)} dias úteis — média necessária{" "}
            {money(meta.media_diaria_necessaria)}/dia (hoje a média real é {money(meta.media_diaria_realizada)}/dia)
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function BlocoAcaoSemana({ acao, proxima }: { acao: AcaoSemana; proxima: ProximaAcao }) {
  if (!acao) {
    return (
      <section>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <Zap className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <h2 className="font-serif text-xl font-bold">Ação da Semana</h2>
              <p className="text-sm text-muted-foreground">Nenhuma ação comercial cadastrada para esta semana.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const pct = Math.max(0, Math.min(100, acao.percentual_atingido ?? 0));
  const tipo = (acao.tipo ?? "").toLowerCase();

  return (
    <section className="space-y-3">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Ação da Semana</p>
              <h2 className="font-serif text-2xl font-bold mt-1">{acao.nome_comercial}</h2>
              {acao.subtitulo && <p className="text-sm text-muted-foreground">{acao.subtitulo}</p>}
            </div>
            <div className="flex items-center gap-2">
              {acao.tipo && (
                <Badge className={cn("capitalize", TIPO_ACAO_STYLES[tipo] ?? "bg-muted text-muted-foreground")}>
                  {acao.tipo}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1">
                <CalendarDays className="h-3 w-3" />
                {dataBr(acao.periodo_inicio)} – {dataBr(acao.periodo_fim)}
              </Badge>
            </div>
          </div>

          <div className="relative">
            <Progress value={pct} className="h-3.5" />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary-foreground mix-blend-difference">
              {nf(acao.percentual_atingido)}%
            </span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm">
              <span className="font-serif text-xl font-bold">{money(acao.receita_realizada)}</span>
              <span className="text-muted-foreground"> de {money(acao.meta_receita)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {nf(acao.pedidos_realizados)} de {nf(acao.pedidos_esperados)} pedidos esperados
            </p>
          </div>
        </CardContent>
      </Card>

      {proxima && (
        <Card className="border-dashed">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Próxima ação (a partir de {dataBr(proxima.periodo_inicio)})
                </p>
                <p className="font-serif font-bold">{proxima.nome_comercial}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">meta {money(proxima.meta_receita)}</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function BlocoRecuperacaoPendente({ data }: { data: Dashboard }) {
  const c = data.carrinhos_abandonados ?? { quantidade: 0, valor_total: 0, quantidade_com_telefone: 0, valor_com_telefone: 0 };
  const p = data.pedidos_cancelados_pendentes ?? { periodo_dias: 0, quantidade: 0, valor_total: 0 };

  return (
    <section>
      <h2 className="font-serif text-xl font-bold mb-3">Recuperação Pendente</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Âmbar = oportunidade em aberto (não é erro nem sucesso) */}
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-warning" />
                <h3 className="font-serif text-lg font-bold">Carrinhos Abandonados</h3>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/carrinho-abandonado">Abrir tela</Link>
              </Button>
            </div>
            <p className="font-serif text-4xl font-bold text-warning">{money(c.valor_com_telefone)}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {nf(c.quantidade_com_telefone)} carrinhos com telefone identificado
            </p>
            <p className="text-xs text-muted-foreground">
              valor_total geral: {money(c.valor_total)} em {nf(c.quantidade)} carrinhos
            </p>
          </CardContent>
        </Card>

        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageX className="h-5 w-5 text-warning" />
                <h3 className="font-serif text-lg font-bold">Pedidos Cancelados Pendentes</h3>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/pedidos-cancelados">Abrir tela</Link>
              </Button>
            </div>
            <p className="font-serif text-4xl font-bold text-warning">{money(p.valor_total)}</p>
            <p className="text-sm text-muted-foreground">
              {nf(p.quantidade)} pedidos cancelados nos últimos {nf(p.periodo_dias)} dias sem recompra posterior
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

/**
 * Bloco de acompanhamento da recuperação do período anterior.
 * Cor neutra: números baixos/zerados cedo são normais (recuperação em andamento).
 * NOTA: este bloco é a base para uma futura meta diária/de período de recuperação —
 * quando a meta existir, o percentual passa a comparar contra ela.
 */
function BlocoRecuperacaoAnterior({ rec }: { rec: RecuperacaoOntem }) {
  if (!rec) return null;

  const card = (titulo: string, item: RecuperacaoItem) => {
    const pct = Math.max(0, Math.min(100, item?.percentual_recuperado ?? 0));
    return (
      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-serif font-bold">{titulo}</h3>
          <p className="font-serif text-3xl font-bold">
            {nf(item?.quantidade)} <span className="text-base font-normal text-muted-foreground">· {money(item?.valor_total)}</span>
          </p>
          <div className="relative">
            <Progress value={pct} className="h-2.5" />
          </div>
          <p className="text-xs text-muted-foreground">
            {nf(item?.quantidade_recuperada)} de {nf(item?.quantidade)} recuperados ({money(item?.valor_recuperado)} de{" "}
            {money(item?.valor_total)}) — {nf(item?.percentual_recuperado)}%
          </p>
        </CardContent>
      </Card>
    );
  };

  return (
    <section>
      <h2 className="font-serif text-xl font-bold mb-1 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
        {rec.label ?? "Período anterior"}
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        {dataBr(rec.periodo_inicio)}
        {rec.periodo_fim && rec.periodo_fim !== rec.periodo_inicio ? ` – ${dataBr(rec.periodo_fim)}` : ""}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {card(`${rec.label ?? "Período"} — Carrinhos`, rec.carrinhos_abandonados)}
        {card(`${rec.label ?? "Período"} — Cancelados`, rec.pedidos_cancelados)}
      </div>
    </section>
  );
}

// ============ Página ============

const REFRESH_MS = 60_000; // tela "ao vivo" para telão/TV do time comercial

export default function VendasAoVivo() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const { data: rpcData, error } = await (supabase as any).rpc("whatsapp_dashboard_vendas_ao_vivo");
      if (error) throw error;
      setData(rpcData as Dashboard);
      setErro(null);
      setAtualizadoEm(new Date());
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const t = window.setInterval(() => carregar(true), REFRESH_MS);
    return () => window.clearInterval(t);
  }, [carregar]);

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">Vendas ao Vivo — WhatsApp</h1>
          {atualizadoEm && (
            <p className="text-xs text-muted-foreground mt-1">
              Atualizado às {atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · atualiza a cada 60s
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => carregar()} disabled={loading} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar agora
        </Button>
      </div>

      {erro && !data && (
        <Card className="border-danger/40">
          <CardContent className="p-6 text-sm text-danger">{erro}</CardContent>
        </Card>
      )}

      {loading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
          </div>
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      ) : data ? (
        <>
          <BlocoVendasHoje data={data} />
          <BlocoMetaMensal meta={data.meta_mensal} />
          <BlocoAcaoSemana acao={data.acao_semana} proxima={data.proxima_acao} />
          <BlocoRecuperacaoPendente data={data} />
          <BlocoRecuperacaoAnterior rec={data.recuperacao_ontem} />
        </>
      ) : null}
    </div>
  );
}
