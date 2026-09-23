import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Copy, ExternalLink } from "lucide-react";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";

type TamanhoPeca = {
  tamanho: string;
  estoque: number;
  cores: string;
};

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
  meta_unidades?: number | null;
  vendidas_hoje?: number | null;
  tamanhos?: TamanhoPeca[] | null;
};

type AcaoDoDia = {
  ok?: boolean;
  tem_acao?: boolean;
  data?: string | null;
  peca?: Peca | null;
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

/** Card "Ação do dia": peça escolhida com meta de vendas própria, atualizado a cada 5 minutos. */
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

  // Sem dados, com ok falso ou sem peça: o card não aparece.
  if (error || !data || data.ok === false || !data.peca) return null;

  const peca = data.peca;
  const metaUnidades = numero(peca.meta_unidades);
  const vendidasHoje = numero(peca.vendidas_hoje) ?? 0;
  const tamanhos = (peca.tamanhos ?? []).filter((t) => t?.tamanho);
  const atingiu = metaUnidades !== null && vendidasHoje >= metaUnidades;
  const percentualMeta =
    metaUnidades !== null && metaUnidades > 0
      ? Math.min(100, Math.max(0, (vendidasHoje / metaUnidades) * 100))
      : 0;

  const copiarLink = async () => {
    if (!peca.url) return;
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
          👗 Peça do dia: {peca.nome}
          {metaUnidades !== null
            ? ` · ${vendidasHoje} de ${metaUnidades} vendidas hoje`
            : ""}
        </span>
        {aberto ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-3 px-3 pb-3">
          {/* Peça do dia */}
          {peca.nome ? (
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

          {/* Meta de vendas da peça */}
          {metaUnidades !== null ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Meta: {metaUnidades} peças</span>
                {atingiu ? (
                  <span className="font-medium text-primary">meta batida 💛</span>
                ) : (
                  <span className="text-muted-foreground">{vendidasHoje} vendidas</span>
                )}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${atingiu ? 100 : percentualMeta}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Tamanhos disponíveis */}
          {tamanhos.length ? (
            <div className="flex flex-wrap gap-1.5">
              {tamanhos.map((t) => (
                <span
                  key={t.tamanho}
                  title={t.cores || undefined}
                  className="rounded-md border border-border px-2 py-0.5 text-xs"
                >
                  <span className="font-medium">{t.tamanho}</span>
                  <span className="ml-1 text-muted-foreground">· {t.estoque}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">sem tamanho em estoque</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default AcaoDoDia;
