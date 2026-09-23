import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Copy, ExternalLink } from "lucide-react";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Peca = {
  produto_id?: number | string | null;
  nome?: string | null;
  preco?: number | null;
  preco_minimo?: number | null;
  preco_minimo_seguro?: number | null;
  desconto_max_pct?: number | null;
  custo_unitario?: number | null;
  url?: string | null;
  imagem_url?: string | null;
  estoque?: number | null;
  vendidas_90d?: number | null;
  ultima_venda?: string | null;
  margem_pct?: number | null;
  valor_parado?: number | null;
  argumento?: string | null;
};

type Meta = {
  mensal?: number | null;
  realizado?: number | null;
  diaria?: number | null;
  dias_uteis_restantes?: number | null;
  hoje?: number | null;
  percentual?: number | null;
};

type AcaoDoDia = {
  ok?: boolean;
  tem_acao?: boolean;
  data?: string | null;
  peca?: Peca | null;
  meta?: Meta | null;
};

const CHAVE_ABERTO = "atendimento-acao-do-dia-aberto";

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function brl(v: unknown): string {
  const n = numero(v);
  if (n === null) return "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Card "Ação do dia": meta do mês e peça escolhida, atualizado a cada 5 minutos. */
export function AcaoDoDia() {
  const [aberto, setAberto] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_ABERTO) === "true";
    } catch {
      return false;
    }
  });

  const alterarAberto = (valor: boolean) => {
    setAberto(valor);
    try {
      localStorage.setItem(CHAVE_ABERTO, String(valor));
    } catch {
      /* armazenamento indisponível */
    }
  };

  // Atualiza a cada 5 minutos e quando a janela volta ao foco.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") {
        window.dispatchEvent(new CustomEvent("acao-do-dia-refresh"));
      }
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, []);

  const { data, error, refetch } = useQuery({
    queryKey: ["acao-do-dia"],
    queryFn: async () => {
      const { data: resultado } = await chamarRpc<AcaoDoDia>("acao_do_dia_atual", {});
      return (resultado ?? null) as AcaoDoDia | null;
    },
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Atualização extra ao voltar o foco da janela.
  useEffect(() => {
    const handler = () => void refetch();
    window.addEventListener("acao-do-dia-refresh", handler);
    return () => window.removeEventListener("acao-do-dia-refresh", handler);
  }, [refetch]);

  // Sem dados (erro, ok falso ou meta nula): o card não aparece.
  if (error || !data || data.ok === false || !data.meta) return null;

  const meta = data.meta;
  const peca = data.tem_acao ? data.peca ?? null : null;

  const realizado = numero(meta.realizado);
  const mensal = numero(meta.mensal);
  const percentual = numero(meta.percentual);
  const faltam = mensal !== null && realizado !== null ? Math.max(0, mensal - realizado) : null;
  const diasUteis = numero(meta.dias_uteis_restantes);
  const metaHoje = numero(meta.hoje) ?? numero(meta.diaria) ?? 0;

  const pluralDia = diasUteis === 1 ? "dia útil" : "dias úteis";

  const copiarLink = async () => {
    if (!peca?.url) return;
    try {
      await navigator.clipboard.writeText(peca.url);
      toast({ title: "Link copiado" });
    } catch {
      toast({ title: "Não foi possível copiar o link", variant: "destructive" });
    }
  };

  return (
    <Collapsible
      open={aberto}
      onOpenChange={alterarAberto}
      className="shrink-0 border-b border-border bg-card"
    >
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-left">
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
          🎯 Meta de hoje {brl(metaHoje)}
          {percentual !== null ? ` · ${Math.round(percentual)}% do mês` : ""}
          {peca?.nome ? ` · 👗 Peça do dia: ${peca.nome}` : ""}
        </span>
        {/* Barra fina do mês */}
        <span className="hidden h-1 w-24 shrink-0 overflow-hidden rounded-full bg-muted sm:block">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, Math.max(0, percentual ?? 0))}%` }}
          />
        </span>
        {aberto ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-3 px-3 pb-3">
          {/* Meta do mês */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm text-muted-foreground">
                Mês: {brl(realizado)} de {brl(mensal)}
                {percentual !== null ? ` (${Math.round(percentual)}%)` : ""}
              </p>
              {numero(meta.hoje) !== null && numero(meta.hoje)! > 0 ? (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  hoje: {brl(meta.hoje)}
                </span>
              ) : null}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, percentual ?? 0))}%` }}
              />
            </div>
            {faltam !== null && faltam > 0 ? (
              <p className="text-xs text-muted-foreground">
                faltam {brl(faltam)}
                {diasUteis !== null ? ` em ${Math.round(diasUteis)} ${pluralDia}` : ""}
              </p>
            ) : null}
            <p className="text-lg font-semibold leading-tight text-primary">
              Meta de hoje: {brl(metaHoje)}
            </p>
          </div>

          {/* Peça do dia */}
          {peca?.nome ? (
            <div className="flex items-start gap-3 rounded-md border border-border p-2">
              {peca.imagem_url ? (
                <img
                  src={peca.imagem_url}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{peca.nome}</p>
                <p className="text-sm font-semibold">{brl(peca.preco)}</p>
                {numero(peca.preco_minimo_seguro) !== null ? (
                  <p className="text-xs">
                    💵 pode negociar até{" "}
                    <span className="font-medium">{brl(peca.preco_minimo_seguro)}</span>
                  </p>
                ) : null}
                {numero(peca.preco_minimo) !== null ? (
                  <p className="text-xs text-muted-foreground">
                    mínimo {brl(peca.preco_minimo)} · abaixo disso dá prejuízo
                  </p>
                ) : null}
                {peca.argumento ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{peca.argumento}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {peca.url ? (
                    <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                      <a href={peca.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Abrir no site
                      </a>
                    </Button>
                  ) : null}
                  {peca.url ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => void copiarLink()}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copiar link
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default AcaoDoDia;
