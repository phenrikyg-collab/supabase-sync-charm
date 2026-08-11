import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Eye, Shirt, ShoppingBag, CreditCard, CheckCircle2, MousePointerClick, Ticket, Activity,
} from "lucide-react";

export type EventoTimeline = {
  id?: string | number;
  tipo?: string | null;
  titulo_pagina?: string | null;
  url?: string | null;
  criada_em?: string | null;
  produto_id?: string | number | null;
  produto_nome?: string | null;
};

export type CupomCliente = {
  origem?: string | null;
  codigo?: string | null;
  criado_em?: string | null;
  cupom_expira_em?: string | null;
  foi_usado?: boolean | null;
  expirou_sem_uso?: boolean | null;
  valor_convertido_em_vendas?: number | null;
};

type Categoria = "todas" | "site" | "produtos" | "carrinho";

const FILTROS: { v: Categoria; label: string }[] = [
  { v: "todas", label: "Todas" },
  { v: "site", label: "Site e busca" },
  { v: "produtos", label: "Produtos" },
  { v: "carrinho", label: "Carrinho e checkout" },
];

const EVENTO_META: Record<
  string,
  { icon: typeof Eye; label: string; className: string; categoria: Exclude<Categoria, "todas"> }
> = {
  page_view: { icon: Eye, label: "Visualizou página", className: "text-muted-foreground", categoria: "site" },
  search: { icon: Eye, label: "Buscou no site", className: "text-muted-foreground", categoria: "site" },
  product_view: { icon: Shirt, label: "Viu produto", className: "text-primary", categoria: "produtos" },
  cart_view: { icon: ShoppingBag, label: "Viu o carrinho", className: "text-warning", categoria: "carrinho" },
  add_to_cart: { icon: ShoppingBag, label: "Adicionou ao carrinho", className: "text-warning", categoria: "carrinho" },
  checkout_start: { icon: CreditCard, label: "Iniciou checkout", className: "text-warning", categoria: "carrinho" },
  purchase: { icon: CheckCircle2, label: "Comprou", className: "text-success", categoria: "carrinho" },
};

function metaEvento(tipo?: string | null) {
  return (
    EVENTO_META[(tipo || "").toLowerCase()] ?? {
      icon: MousePointerClick,
      label: tipo || "Evento",
      className: "text-muted-foreground",
      categoria: "site" as const,
    }
  );
}

function tempoRelativo(iso?: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function moeda(v?: number | null) {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

function StatusCupom({ c }: { c: CupomCliente }) {
  const cfg = c.foi_usado
    ? { label: "usado", cls: "bg-success/10 text-success border-success/20" }
    : c.expirou_sem_uso
      ? { label: "expirado", cls: "bg-danger/10 text-danger border-danger/20" }
      : { label: "válido", cls: "bg-warning/10 text-warning border-warning/20" };
  return (
    <span className={cn("inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

export function AtividadesRecentes({ telefone }: { telefone: string }) {
  const [filtro, setFiltro] = useState<Categoria>("todas");

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-historico-cliente", telefone],
    enabled: !!telefone,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_get_historico_cliente" as any, {
        p_telefone: telefone,
      });
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      return {
        eventos: (row?.timeline_site ?? []) as EventoTimeline[],
        cupons: (row?.cupons ?? []) as CupomCliente[],
      };
    },
  });

  const eventos = data?.eventos ?? [];
  const cupons = data?.cupons ?? [];

  const filtrados = useMemo(
    () => (filtro === "todas" ? eventos : eventos.filter((e) => metaEvento(e.tipo).categoria === filtro)),
    [eventos, filtro],
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-border p-3">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-sm font-semibold">Atividades recentes</h3>
      </div>

      <div className="flex flex-wrap gap-1.5 p-3 pb-2">
        {FILTROS.map((f) => (
          <Button
            key={f.v}
            size="sm"
            variant={filtro === f.v ? "default" : "outline"}
            className="h-7 px-2.5 text-[11px]"
            onClick={() => setFiltro(f.v)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="px-3 pb-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Navegação no site
        </p>
        {isLoading && <p className="text-xs text-muted-foreground">Carregando atividades…</p>}
        {!isLoading && filtrados.length === 0 && (
          <p className="py-2 text-xs text-muted-foreground">
            {eventos.length === 0 ? "Nenhuma navegação registrada" : "Nenhuma atividade nesse filtro."}
          </p>
        )}
        {filtrados.length > 0 && (
          <ol className="relative space-y-3 pl-6">
            <span className="absolute left-[9px] bottom-2 top-2 w-px bg-border" aria-hidden />
            {filtrados.map((e, i) => {
              const meta = metaEvento(e.tipo);
              const Icone = meta.icon;
              return (
                <li key={String(e.id ?? i)} className="relative">
                  <span className="absolute -left-6 top-0.5 flex h-[19px] w-[19px] items-center justify-center rounded-full border border-border bg-card">
                    <Icone className={cn("h-3 w-3", meta.className)} />
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-medium">{meta.label}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{tempoRelativo(e.criada_em)}</span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {e.produto_nome || e.titulo_pagina || e.url || "—"}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="space-y-2 border-t border-border p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Ticket className="h-3.5 w-3.5" />
          Cupons
        </p>
        {cupons.length === 0 && !isLoading && (
          <p className="text-xs text-muted-foreground">Nenhum cupom emitido</p>
        )}
        {cupons.map((c, i) => (

            <div key={`${c.codigo ?? i}`} className="rounded-md border border-border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold">{c.codigo ?? "—"}</span>
                <StatusCupom c={c} />
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {c.origem ?? "—"}
                {c.criado_em ? ` · ${dataCurta(c.criado_em)}` : ""}
                {!c.foi_usado && c.cupom_expira_em ? ` · expira ${dataCurta(c.cupom_expira_em)}` : ""}
              </p>
              {c.foi_usado && c.valor_convertido_em_vendas != null && (
                <p className="text-[11px] font-semibold text-success">
                  Venda: {moeda(c.valor_convertido_em_vendas)}
                </p>
              )}
            </div>
        ))}
      </div>

    </Card>
  );
}
