import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { brl, num, pct, varPct } from "@/lib/gestaoFormat";
import { cn } from "@/lib/utils";

/** Classificação vem pronta do banco — nunca recalcular thresholds no front. */
export type Classificacao = "critico" | "atencao" | "saudavel" | string | null | undefined;

const CLASSE_TEXTO: Record<string, string> = {
  critico: "text-red-600",
  atencao: "text-amber-600",
  saudavel: "text-emerald-600",
};

const CLASSE_BADGE: Record<string, { label: string; className: string }> = {
  critico: { label: "Crítico", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  atencao: { label: "Atenção", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  saudavel: { label: "Saudável", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
};

export function corClassificacao(c: Classificacao) {
  return CLASSE_TEXTO[String(c ?? "")] ?? "text-foreground";
}

export function fundoClassificacao(c: Classificacao) {
  const k = String(c ?? "");
  if (k === "critico") return "bg-red-500/5";
  if (k === "atencao") return "bg-amber-500/5";
  return undefined;
}

export function BadgeClassificacao({ classificacao, className }: { classificacao: Classificacao; className?: string }) {
  const cfg = CLASSE_BADGE[String(classificacao ?? "")];
  if (!cfg) return null;
  return (
    <Badge variant="outline" className={cn("text-[10px]", cfg.className, className)}>
      {cfg.label}
    </Badge>
  );
}

/** Célula de margem de contribuição colorida pela classificação do próprio registro. */
export function CelulaMargemContrib({ item }: { item: any }) {
  return (
    <span className={cn("font-medium", corClassificacao(item?.margem_contribuicao_classificacao))}>
      {pct(item?.margem_contribuicao_pct, 1)}
    </span>
  );
}

type VariacaoProps = {
  atual: any;
  anterior: any;
  /** true quando cair é melhor (CMV, CAC). */
  inverso?: boolean;
  /** diferença em pontos percentuais em vez de variação relativa */
  pp?: boolean;
};

export function Variacao({ atual, anterior, inverso, pp }: VariacaoProps) {
  if (anterior === null || anterior === undefined) return null;
  const a = num(atual);
  const b = num(anterior);
  const valor = pp ? a - b : varPct(a, b);
  if (valor === null || !Number.isFinite(valor)) return null;

  const sobe = valor >= 0;
  const bom = inverso ? !sobe : sobe;
  const cor = valor === 0 ? "text-muted-foreground" : bom ? "text-emerald-600" : "text-red-600";
  return (
    <p className={cn("text-[11px] font-semibold", cor)}>
      {sobe ? "▲" : "▼"} {Math.abs(valor).toFixed(pp ? 1 : 1)}
      {pp ? " p.p." : "%"} <span className="font-normal text-muted-foreground">vs. período anterior</span>
    </p>
  );
}

export function CardMargemContribuicao({
  valorPct, total, classificacao, regua, comparativoPct,
}: {
  valorPct: any;
  total?: any;
  classificacao: Classificacao;
  regua?: { critico_abaixo_de?: number; atencao_ate?: number; saudavel_acima_de?: number } | null;
  comparativoPct?: any;
}) {
  return (
    <Card className="sm:col-span-2 lg:col-span-2">
      <CardContent className="p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-[140px]">
          <p className={cn("text-4xl font-serif font-bold leading-none", corClassificacao(classificacao))}>
            {pct(valorPct, 0)}
          </p>
          {total !== undefined && (
            <p className="mt-1 text-xs text-muted-foreground">{brl(total)} no período</p>
          )}
          <div className="mt-1">
            <Variacao atual={valorPct} anterior={comparativoPct} pp />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Margem de contribuição</p>
            <BadgeClassificacao classificacao={classificacao} />
          </div>
          <p className="text-xs text-muted-foreground">
            O que sobra do pedido depois de produto, frete, taxa e desconto
          </p>
          {regua && (
            <p className="text-[11px] text-muted-foreground">
              abaixo de {num(regua.critico_abaixo_de)}% crítico · {num(regua.critico_abaixo_de)}% a{" "}
              {num(regua.atencao_ate)}% atenção · acima de {num(regua.saudavel_acima_de)}% saudável
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
