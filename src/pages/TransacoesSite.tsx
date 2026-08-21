import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatarData } from "@/utils/formatters";
import { statusPagamentoClasses, rotuloStatusPagamento } from "@/lib/statusPagamento";
import {
  FiltroPeriodo,
  periodoUltimosDias,
  limiteInicio,
  limiteFim,
  type Periodo,
} from "@/components/recuperacao/FiltroPeriodo";
import { Zap, CreditCard, ExternalLink, Inbox, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 25;

interface TransacaoSite {
  pedido_id: string | number;
  data_pedido: string | null;
  valor: number | null;
  status_pagamento: string | null;
  forma_pagamento: string | null;
  tipo_pagamento: string | null;
  customer_id: string | number | null;
  boleto_url: string | null;
  transaction_id: string | null;
  url_pagamento: string | null;
  desconto_pix_concedido: number | null;
}

interface KpisTransacoes {
  total_transacoes: number | null;
  volume_financeiro: number | null;
  taxa_confirmacao_pct: number | null;
  ticket_medio: number | null;
  pct_cartao_credito: number | null;
  pct_pix: number | null;
  media_parcelas_cartao: number | null;
  pct_cancelamento_cartao: number | null;
  pct_cancelamento_pix: number | null;
  desconto_pix_concedido_total: number | null;
  taxa_gateway_disponivel: boolean | null;
}

type Filtro = "todos" | "pix" | "credit_card";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pix", label: "Pix" },
  { key: "credit_card", label: "Cartão de Crédito" },
];

function formatCurrency(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
}

function pct(v: number | null | undefined, casas = 1) {
  return `${Number(v ?? 0).toFixed(casas)}%`;
}

function formatarDataHora(v: string | null) {
  if (!v) return "—";
  return formatarData(String(v).slice(0, 10));
}

function tipoDe(t: Pick<TransacaoSite, "tipo_pagamento">): Filtro {
  const tipo = (t.tipo_pagamento ?? "").toLowerCase();
  if (tipo.includes("pix")) return "pix";
  if (tipo.includes("credit") || tipo.includes("cart")) return "credit_card";
  return "todos";
}

function bandeira(forma: string | null) {
  if (!forma) return null;
  const limpo = forma.replace(/cart[ãa]o( de cr[ée]dito)?/i, "").replace(/[-–·]/g, "").trim();
  return limpo.length > 0 ? limpo : null;
}

function PagamentoIcone({ tipo }: { tipo: Filtro }) {
  const Icon = tipo === "pix" ? Zap : CreditCard;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
      <Icon className="h-4 w-4" />
    </div>
  );
}

function ResumoCard({
  label,
  value,
  loading,
  hint,
}: {
  label: string;
  value: string;
  loading: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/40 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function BarraMix({ cartao, pix, loading }: { cartao: number; pix: number; loading: boolean }) {
  return (
    <div className="rounded-xl bg-muted/40 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cartão vs Pix</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-full" />
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-xl font-semibold tabular-nums text-foreground">{pct(cartao)}</span>
            <span className="text-xs text-muted-foreground">cartão</span>
            <span className="text-xl font-semibold tabular-nums text-foreground">{pct(pix)}</span>
            <span className="text-xs text-muted-foreground">pix</span>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-border">
            <div className="bg-primary" style={{ width: `${Math.max(0, Math.min(100, cartao))}%` }} />
            <div className="bg-success" style={{ width: `${Math.max(0, Math.min(100, pix))}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

function CancelamentoCard({
  cartao,
  pix,
  loading,
}: {
  cartao: number;
  pix: number;
  loading: boolean;
}) {
  const destaquePix = pix > cartao;
  return (
    <div className="rounded-xl bg-muted/40 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Cancelamento por forma
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-full" />
      ) : (
        <div className="mt-1 flex items-end gap-6">
          <div>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{pct(cartao)}</p>
            <p className="text-xs text-muted-foreground">Cartão</p>
          </div>
          <div>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                destaquePix ? "text-danger" : "text-foreground"
              )}
            >
              {pct(pix)}
            </p>
            <p className="text-xs text-muted-foreground">Pix</p>
          </div>
          {destaquePix && cartao > 0 && (
            <p className="pb-1 text-xs text-danger">
              Pix cancela {(pix / cartao).toFixed(1)}x mais
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TransacoesSite() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [pagina, setPagina] = useState(0);
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoUltimosDias(30));

  const kpisQuery = useQuery({
    queryKey: ["kpis_transacoes_site", periodo.inicio, periodo.fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kpis_transacoes_site" as any, {
        p_data_inicio: periodo.inicio || null,
        p_data_fim: periodo.fim || null,
      });
      if (error) throw error;
      const linha = Array.isArray(data) ? data[0] : data;
      return (linha ?? null) as KpisTransacoes | null;
    },
  });

  const listaQuery = useQuery({
    queryKey: ["vw_transacoes_site", "lista", filtro, pagina, periodo.inicio, periodo.fim],
    queryFn: async () => {
      let q = supabase
        .from("vw_transacoes_site")
        .select("*", { count: "exact" })
        .order("data_pedido", { ascending: false })
        .range(pagina * PAGE_SIZE, pagina * PAGE_SIZE + PAGE_SIZE - 1);
      const de = limiteInicio(periodo.inicio);
      const ate = limiteFim(periodo.fim);
      if (de) q = q.gte("data_pedido", de);
      if (ate) q = q.lte("data_pedido", ate);
      if (filtro === "pix") q = q.eq("tipo_pagamento", "pix");
      else if (filtro === "credit_card") q = q.eq("tipo_pagamento", "credit_card");
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as TransacaoSite[], count: count ?? 0 };
    },
  });

  const kpis = kpisQuery.data;
  const carregandoKpis = kpisQuery.isLoading;
  const rows = listaQuery.data?.rows ?? [];
  const totalPaginas = Math.max(1, Math.ceil((listaQuery.data?.count ?? 0) / PAGE_SIZE));

  function trocarFiltro(f: Filtro) {
    setFiltro(f);
    setPagina(0);
  }

  function trocarPeriodo(p: Periodo) {
    setPeriodo(p);
    setPagina(0);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transações do Site</h1>
        <p className="text-sm text-muted-foreground">Pagamentos processados no checkout da loja (Vindi / Yapay)</p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          Pedidos do site são sempre pagos via Vindi (cartão de crédito ou Pix). Pedidos por WhatsApp são pagos por link
          de pagamento Vindi ou Pix do Banco Inter. Boleto não é uma modalidade utilizada.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/80">Sincroniza a cada poucos minutos a partir dos webhooks da loja.</p>
      </div>

      <FiltroPeriodo periodo={periodo} onChange={trocarPeriodo} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResumoCard
          label="Transações"
          value={Number(kpis?.total_transacoes ?? 0).toLocaleString("pt-BR")}
          loading={carregandoKpis}
        />
        <ResumoCard label="Volume financeiro" value={formatCurrency(kpis?.volume_financeiro)} loading={carregandoKpis} />
        <ResumoCard label="Taxa de confirmação" value={pct(kpis?.taxa_confirmacao_pct)} loading={carregandoKpis} />
        <ResumoCard label="Ticket médio" value={formatCurrency(kpis?.ticket_medio)} loading={carregandoKpis} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BarraMix
          cartao={Number(kpis?.pct_cartao_credito ?? 0)}
          pix={Number(kpis?.pct_pix ?? 0)}
          loading={carregandoKpis}
        />
        <ResumoCard
          label="Parcelamento médio"
          value={`${Number(kpis?.media_parcelas_cartao ?? 0).toFixed(1)}x`}
          loading={carregandoKpis}
          hint="Somente cartão de crédito"
        />
        <CancelamentoCard
          cartao={Number(kpis?.pct_cancelamento_cartao ?? 0)}
          pix={Number(kpis?.pct_cancelamento_pix ?? 0)}
          loading={carregandoKpis}
        />
        <ResumoCard
          label="Desconto Pix concedido"
          value={formatCurrency(kpis?.desconto_pix_concedido_total)}
          loading={carregandoKpis}
          hint="Desconto promocional de 5% — não é taxa de gateway"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((p) => {
          const ativo = filtro === p.key;
          return (
            <button
              key={p.key}
              onClick={() => trocarFiltro(p.key)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150",
                ativo
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {listaQuery.isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/30 py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma transação encontrada nesse período</p>
          </div>
        ) : (
          rows.map((t) => {
            const tipo = tipoDe(t);
            const marca = tipo === "credit_card" ? bandeira(t.forma_pagamento) : null;
            const link = t.url_pagamento;
            return (
              <div
                key={`${t.pedido_id}-${t.transaction_id ?? ""}`}
                className="flex animate-in fade-in items-center gap-4 rounded-xl border border-border/60 bg-card px-4 py-3 transition-all duration-150 hover:-translate-y-px hover:bg-accent/40 hover:shadow-sm"
              >
                <PagamentoIcone tipo={tipo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-card-foreground">Pedido #{t.pedido_id}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatarDataHora(t.data_pedido)} ·{" "}
                    {tipo === "pix" ? "Pix" : marca ? `Cartão · ${marca}` : t.forma_pagamento ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-card-foreground">{formatCurrency(t.valor)}</span>
                  <span
                    className={cn(
                      "hidden shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium sm:inline-flex",
                      statusPagamentoClasses(t.status_pagamento)
                    )}
                  >
                    {rotuloStatusPagamento(t.status_pagamento)}
                  </span>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground transition-colors hover:text-primary"
                      aria-label="Abrir link de pagamento"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Página {pagina + 1} de {totalPaginas.toLocaleString("pt-BR")} · {(listaQuery.data?.count ?? 0).toLocaleString("pt-BR")} transações
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina + 1 >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
