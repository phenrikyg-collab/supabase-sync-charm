import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Eye, Shirt, ShoppingBag, AlertTriangle, Sparkles, Activity, MousePointerClick,
} from "lucide-react";

import { chamarRpc } from "@/lib/supabaseRpc";

export type EventoTimeline = {
  id?: string | number;
  tipo?: string | null;
  categoria?: string | null;
  peso?: number | null;
  descricao?: string | null;
  titulo_pagina?: string | null;
  url?: string | null;
  criada_em?: string | null;
  produto_id?: string | number | null;
  produto_nome?: string | null;
};

type CupomCliente = {
  origem?: string | null;
  codigo?: string | null;
  criado_em?: string | null;
  cupom_expira_em?: string | null;
  foi_usado?: boolean | null;
  expirou_sem_uso?: boolean | null;
  valor_convertido_em_vendas?: number | null;
};


type Categoria = "carrinho" | "provador" | "produto" | "atrito" | "navegacao";

const CATEGORIA_META: Record<Categoria, { label: string; icon: typeof Eye; className: string }> = {
  carrinho: { label: "Carrinho e checkout", icon: ShoppingBag, className: "text-warning" },
  provador: { label: "Provador", icon: Sparkles, className: "text-primary" },
  produto: { label: "Produtos", icon: Shirt, className: "text-primary" },
  atrito: { label: "Atrito", icon: AlertTriangle, className: "text-danger" },
  navegacao: { label: "Navegação", icon: Eye, className: "text-muted-foreground" },
};

const ORDEM: Categoria[] = ["carrinho", "provador", "produto", "atrito", "navegacao"];

function categoriaDe(e: EventoTimeline): Categoria {
  const c = (e.categoria || "").toLowerCase() as Categoria;
  return CATEGORIA_META[c] ? c : "navegacao";
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


export function AtividadesRecentes({ telefone }: { telefone: string }) {
  const [filtro, setFiltro] = useState<Categoria | "todas">("todas");

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-historico-cliente", telefone],
    enabled: !!telefone,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_get_historico_cliente" as any, {
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

  const eventos = useMemo(() => {
    const lista = [...(data?.eventos ?? [])];
    lista.sort((a, b) => new Date(b.criada_em ?? 0).getTime() - new Date(a.criada_em ?? 0).getTime());
    return lista;
  }, [data]);

  const cupons = data?.cupons ?? [];

  const contagens = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of eventos) {
      const k = categoriaDe(e);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [eventos]);

  const filtrados = useMemo(
    () => (filtro === "todas" ? eventos : eventos.filter((e) => categoriaDe(e) === filtro)),
    [eventos, filtro],
  );

  const abas: { v: Categoria | "todas"; label: string; n: number }[] = [
    { v: "todas", label: "Todas", n: eventos.length },
    ...ORDEM.map((c) => ({ v: c, label: CATEGORIA_META[c].label, n: contagens[c] ?? 0 })),
  ];

  return (
    <section className="border-t border-border">
      <div className="flex items-center gap-1.5 border-b border-border p-3">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-sm font-semibold">Atividades recentes</h3>
      </div>

      <div className="flex flex-wrap gap-1.5 p-3 pb-2">
        {abas.map((f) => (
          <Button
            key={f.v}
            size="sm"
            variant={filtro === f.v ? "default" : "outline"}
            className="h-7 px-2.5 text-xs"
            onClick={() => setFiltro(f.v)}
          >
            {f.label}
            <span className="ml-1 opacity-70">{f.n}</span>
          </Button>
        ))}
      </div>

      <div className="px-3 pb-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Navegação no site
        </p>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando atividades…</p>}
        {!isLoading && filtrados.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">
            {eventos.length === 0 ? "Nenhuma navegação registrada" : "Nenhuma atividade nesse filtro."}
          </p>
        )}
        {filtrados.length > 0 && (
          <ol className="relative space-y-3 pl-6">
            <span className="absolute left-[9px] bottom-2 top-2 w-px bg-border" aria-hidden />
            {filtrados.map((e, i) => {
              const cat = categoriaDe(e);
              const meta = CATEGORIA_META[cat];
              const Icone = meta.icon ?? MousePointerClick;
              const decisivo = (e.peso ?? 0) >= 3;
              return (
                <li key={String(e.id ?? i)} className="relative">
                  <span className="absolute -left-6 top-0.5 flex h-[19px] w-[19px] items-center justify-center rounded-full border border-border bg-card">
                    <Icone className={cn("h-3 w-3", meta.className)} />
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {decisivo && (
                        <span
                          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cat === "atrito" ? "bg-danger" : "bg-primary")}
                          aria-hidden
                        />
                      )}
                      {e.descricao || meta.label}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">{tempoRelativo(e.criada_em)}</span>
                  </div>
                  {(e.produto_nome || e.titulo_pagina || e.url) && (
                    <p className="truncate text-sm text-muted-foreground">
                      {e.produto_nome || e.titulo_pagina || e.url}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

    </section>
  );
}

