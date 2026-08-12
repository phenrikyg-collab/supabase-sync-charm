import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatarData } from "@/utils/formatters";
import { Zap, CreditCard, Barcode, ExternalLink, Inbox, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 25;

interface TransacaoSite {
  pedido_id: string | number;
  data_pedido: string | null;
  valor: number | null;
  status_pedido: string | null;
  forma_pagamento: string | null;
  tipo_pagamento: string | null;
  tem_pagamento_confirmado: boolean | null;
  customer_id: string | number | null;
  boleto_url: string | null;
  transaction_id: string | null;
  url_pagamento: string | null;
}

type Filtro = "todos" | "pix" | "credit_card" | "boleto";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pix", label: "Pix" },
  { key: "credit_card", label: "Cartão de Crédito" },
  { key: "boleto", label: "Boleto" },
];

function formatCurrency(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}

function formatarDataHora(v: string | null) {
  if (!v) return "—";
  return formatarData(v.slice(0, 10));
}

function tipoDe(t: TransacaoSite): Filtro {
  const tipo = (t.tipo_pagamento ?? "").toLowerCase();
  if (tipo.includes("pix")) return "pix";
  if (tipo.includes("credit") || tipo.includes("cart")) return "credit_card";
  if (tipo.includes("boleto") || tipo.includes("bank_slip")) return "boleto";
  if (t.boleto_url) return "boleto";
  return "todos";
}

function bandeira(forma: string | null) {
  if (!forma) return null;
  const limpo = forma.replace(/cart[ãa]o( de cr[ée]dito)?/i, "").replace(/[-–·]/g, "").trim();
  return limpo.length > 0 ? limpo : null;
}

function PagamentoIcone({ tipo }: { tipo: Filtro }) {
  const Icon = tipo === "pix" ? Zap : tipo === "boleto" ? Barcode : CreditCard;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
      <Icon className="h-4 w-4" />
    </div>
  );
}

function statusClasses(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (/cancel|recusad|estorn|reprovad|expirad/.test(s)) return "bg-danger/10 text-danger border-danger/20";
  if (/final|envi|entreg|aprovad|pago|conclu|faturad/.test(s)) return "bg-success/10 text-success border-success/20";
  if (/process|aguard|pendent|analis|abert/.test(s)) return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
}

function ResumoCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="rounded-xl bg-muted/40 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      )}
    </div>
  );
}

export default function TransacoesSite() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [pagina, setPagina] = useState(0);

  // Resumo: agrega em blocos de 1000 (limite do PostgREST)
  const resumoQuery = useQuery({
    queryKey: ["vw_transacoes_site", "resumo"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      let from = 0;
      const rows: Pick<TransacaoSite, "valor" | "tem_pagamento_confirmado" | "tipo_pagamento" | "boleto_url">[] = [];
      // limite de segurança: 40k registros
      while (from < 40000) {
        const { data, error } = await supabase
          .from("vw_transacoes_site")
          .select("valor, tem_pagamento_confirmado, tipo_pagamento, boleto_url")
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...((data ?? []) as any[]));
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      const total = rows.length;
      const volume = rows.reduce((s, r) => s + Number(r.valor ?? 0), 0);
      const confirmados = rows.filter((r) => r.tem_pagamento_confirmado).length;
      const contagens: Record<Filtro, number> = { todos: total, pix: 0, credit_card: 0, boleto: 0 };
      for (const r of rows) {
        const t = tipoDe(r as TransacaoSite);
        if (t !== "todos") contagens[t] += 1;
      }
      return {
        total,
        volume,
        taxa: total > 0 ? (confirmados / total) * 100 : 0,
        ticket: total > 0 ? volume / total : 0,
        contagens,
      };
    },
  });

  const listaQuery = useQuery({
    queryKey: ["vw_transacoes_site", "lista", filtro, pagina],
    queryFn: async () => {
      let q = supabase
        .from("vw_transacoes_site")
        .select("*", { count: "exact" })
        .order("data_pedido", { ascending: false })
        .range(pagina * PAGE_SIZE, pagina * PAGE_SIZE + PAGE_SIZE - 1);
      if (filtro === "pix") q = q.eq("tipo_pagamento", "pix");
      else if (filtro === "credit_card") q = q.eq("tipo_pagamento", "credit_card");
      else if (filtro === "boleto") q = q.not("boleto_url", "is", null);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as TransacaoSite[], count: count ?? 0 };
    },
  });

  const resumo = resumoQuery.data;
  const rows = listaQuery.data?.rows ?? [];
  const totalPaginas = Math.max(1, Math.ceil((listaQuery.data?.count ?? 0) / PAGE_SIZE));

  const pills = useMemo(
    () =>
      FILTROS.map((f) => ({
        ...f,
        count: resumo?.contagens[f.key],
      })),
    [resumo]
  );

  function trocarFiltro(f: Filtro) {
    setFiltro(f);
    setPagina(0);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transações do Site</h1>
        <p className="text-sm text-muted-foreground">Pagamentos processados no checkout da loja (Vindi / Yapay)</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResumoCard label="Transações" value={(resumo?.total ?? 0).toLocaleString("pt-BR")} loading={resumoQuery.isLoading} />
        <ResumoCard label="Volume financeiro" value={formatCurrency(resumo?.volume)} loading={resumoQuery.isLoading} />
        <ResumoCard label="Taxa de confirmação" value={`${(resumo?.taxa ?? 0).toFixed(1)}%`} loading={resumoQuery.isLoading} />
        <ResumoCard label="Ticket médio" value={formatCurrency(resumo?.ticket)} loading={resumoQuery.isLoading} />
      </div>

      <div className="flex flex-wrap gap-2">
        {pills.map((p) => {
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
              {p.count != null && <span className="ml-1.5 opacity-70">({p.count.toLocaleString("pt-BR")})</span>}
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
            <p className="text-sm text-muted-foreground">Nenhuma transação encontrada com esse filtro</p>
          </div>
        ) : (
          rows.map((t) => {
            const tipo = tipoDe(t);
            const marca = tipo === "credit_card" ? bandeira(t.forma_pagamento) : null;
            const link = t.boleto_url || t.url_pagamento;
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
                    {tipo === "pix" ? "Pix" : tipo === "boleto" ? "Boleto" : marca ? `Cartão · ${marca}` : t.forma_pagamento ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-card-foreground">{formatCurrency(t.valor)}</span>
                  <span
                    className={cn(
                      "hidden shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium sm:inline-flex",
                      statusClasses(t.status_pedido)
                    )}
                  >
                    {t.status_pedido ?? "—"}
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
