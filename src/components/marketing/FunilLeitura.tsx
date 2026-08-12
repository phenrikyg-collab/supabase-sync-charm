import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CriativoPeriodo,
  FunilPeriodo,
  MENOR_MELHOR,
  MetricaBench,
  NIVEL_BG,
  NIVEL_LABEL,
  Nivel,
  brl,
  delta,
  int,
  nivelDe,
  n,
  pct,
  roasFmt,
  useMetaFunil,
} from "./metaCriativos";

/** Delta em % com seta e cor (verde = melhora). */
export function Delta({ atual, anterior, menorMelhor, className }: {
  atual: number | null | undefined;
  anterior: number | null | undefined;
  menorMelhor?: boolean;
  className?: string;
}) {
  const d = delta(atual, anterior);
  if (d === null) return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  const sobe = d >= 0;
  const bom = menorMelhor ? !sobe : sobe;
  const cor = Math.abs(d) < 0.05 ? "text-muted-foreground" : bom ? "text-success" : "text-danger";
  const Icon = sobe ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", cor, className)}>
      <Icon className="h-3 w-3" />
      {Math.abs(d).toFixed(1).replace(".", ",")}%
    </span>
  );
}

export function NivelBadge({ nivel }: { nivel: Nivel }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", NIVEL_BG[nivel])}>
      {NIVEL_LABEL[nivel]}
    </span>
  );
}

function EtapaCard({ titulo, valor, atual, anterior, metrica, menorMelhor }: {
  titulo: string;
  valor: string;
  atual: number | null | undefined;
  anterior: number | null | undefined;
  metrica?: MetricaBench;
  menorMelhor?: boolean;
}) {
  const nivel: Nivel = metrica ? nivelDe(metrica, atual) : "neutro";
  return (
    <div className="rounded-lg border bg-card p-4 min-w-[140px] flex-1">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <p className="text-xl font-serif font-bold mt-1">{valor}</p>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <Delta atual={atual} anterior={anterior} menorMelhor={menorMelhor} />
        {metrica && <NivelBadge nivel={nivel} />}
      </div>
    </div>
  );
}

function diagnostico(atual: FunilPeriodo | undefined) {
  if (!atual) return null;
  const ruim = (m: MetricaBench, v: number | null | undefined) => nivelDe(m, v) === "ruim";
  if (ruim("thumb_stop", atual.thumb_stop_rate)) return "Thumb Stop baixo → Problema no gancho — reescrever os primeiros 3 segundos";
  if (ruim("ctr", atual.ctr_link)) return "CTR baixo → Problema na promessa/conteúdo — revisar ângulo";
  if (ruim("conversao", atual.conversao_rate)) return "Conversão baixa → Problema na página/oferta — auditar PDP, checkout, frete";
  if (n(atual.cpa) > 0 && nivelDe("roas", atual.roas) === "ruim") return "Funil OK e CPA alto → Ler o funil completo antes de pausar";
  return "Funil dentro dos parâmetros no período — manter cadência de testes de criativo.";
}

export function FunilLeitura({ dias }: { dias: number }) {
  const { data, loading } = useMetaFunil(dias);
  const atual = data.find((d) => d.periodo === "atual");
  const anterior = data.find((d) => d.periodo === "anterior");

  if (loading) return <Skeleton className="h-[240px]" />;
  if (!atual) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">Funil de Leitura</CardTitle></CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">Sem dados no período</CardContent>
      </Card>
    );
  }

  const etapas = [
    { titulo: "Impressões", valor: int(atual.impressions), atual: atual.impressions, anterior: anterior?.impressions },
    { titulo: "Thumb Stop (3s)", valor: pct(atual.thumb_stop_rate), atual: atual.thumb_stop_rate, anterior: anterior?.thumb_stop_rate, metrica: "thumb_stop" as MetricaBench },
    { titulo: "Retenção (ThruPlay)", valor: pct(atual.retencao_rate), atual: atual.retencao_rate, anterior: anterior?.retencao_rate, metrica: "retencao" as MetricaBench },
    { titulo: "CTR", valor: pct(atual.ctr_link, 2), atual: atual.ctr_link, anterior: anterior?.ctr_link, metrica: "ctr" as MetricaBench },
    { titulo: "Conversão", valor: pct(atual.conversao_rate, 2), atual: atual.conversao_rate, anterior: anterior?.conversao_rate, metrica: "conversao" as MetricaBench },
    { titulo: "CPA", valor: brl(atual.cpa), atual: atual.cpa, anterior: anterior?.cpa, menorMelhor: true },
    { titulo: "ROAS", valor: roasFmt(atual.roas), atual: atual.roas, anterior: anterior?.roas, metrica: "roas" as MetricaBench },
  ];

  const msg = diagnostico(atual);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Funil de Leitura — Tráfego Estratégico</CardTitle>
        <p className="text-sm text-muted-foreground">
          Últimos {dias} dias vs os {dias} dias anteriores
          {atual.data_inicio && atual.data_fim ? ` · ${atual.data_inicio} a ${atual.data_fim}` : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:flex lg:items-stretch gap-2">
          {etapas.map((e, i) => (
            <div key={e.titulo} className="flex items-center gap-2 flex-1">
              <EtapaCard {...e} />
              {i < etapas.length - 1 && <ChevronRight className="hidden lg:block h-4 w-4 shrink-0 text-muted-foreground" />}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Investimento</p>
            <p className="text-base font-semibold">{brl(atual.investimento)}</p>
            <Delta atual={atual.investimento} anterior={anterior?.investimento} />
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Receita</p>
            <p className="text-base font-semibold">{brl(atual.receita)}</p>
            <Delta atual={atual.receita} anterior={anterior?.receita} />
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">CPM</p>
            <p className="text-base font-semibold">{brl(atual.cpm)}</p>
            <div className="flex gap-2 items-center flex-wrap">
              <Delta atual={atual.cpm} anterior={anterior?.cpm} menorMelhor />
              <NivelBadge nivel={nivelDe("cpm", atual.cpm)} />
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">CPS (custo por clique no link)</p>
            <p className="text-base font-semibold">{brl(atual.cps)}</p>
            <div className="flex gap-2 items-center flex-wrap">
              <Delta atual={atual.cps} anterior={anterior?.cps} menorMelhor />
              <NivelBadge nivel={nivelDe("cps", atual.cps)} />
            </div>
          </div>
        </div>
        {msg && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
            <span className="font-semibold">Diagnóstico automático: </span>{msg}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Red Flags =====
type Flag = { cor: string; texto: string; detalhe: string };

export function RedFlags({ dias, criativos, loading }: { dias: number; criativos: CriativoPeriodo[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-[180px]" />;

  const flags: Flag[] = [];

  const freq = criativos.filter((c) => n(c.frequency) > 4);
  if (freq.length)
    flags.push({ cor: "danger", texto: "🔴 Audiência cansada — pausar criativo + expandir público", detalhe: `${freq.length} anúncio(s) com frequência acima de 4` });

  const hook = criativos.filter((c) => (c.formato || "").toLowerCase() === "video" && n(c.impressions) >= 5000 && c.thumb_stop_rate !== null && n(c.thumb_stop_rate) < 12);
  if (hook.length)
    flags.push({ cor: "danger", texto: "🔴 Hook ruim — refazer 3s iniciais", detalhe: `${hook.length} vídeo(s) com Thumb Stop abaixo de 12%` });

  const copy = criativos.filter((c) => n(c.impressions) >= 5000 && c.ctr_link !== null && n(c.ctr_link) < 0.3);
  if (copy.length)
    flags.push({ cor: "warning", texto: "🟠 Copy genérico — revisar headline", detalhe: `${copy.length} anúncio(s) com CTR abaixo de 0,3%` });

  const margem = criativos.filter((c) => n(c.spend) > 300 && n(c.roas) < 2);
  if (margem.length)
    flags.push({ cor: "warning", texto: "🟠 Queimando margem — pausar até reestruturar", detalhe: `${margem.length} anúncio(s) com ROAS abaixo de 2x e investimento acima de R$300` });

  const totSpend = criativos.reduce((s, c) => s + n(c.spend), 0);
  const totImp = criativos.reduce((s, c) => s + n(c.impressions), 0);
  const cpmAgg = totImp > 0 ? (totSpend / totImp) * 1000 : null;
  if (cpmAgg !== null && cpmAgg > 25)
    flags.push({ cor: "warning", texto: "🟡 Criativo de baixa relevância ou leilão caro", detalhe: `CPM agregado de ${brl(cpmAgg)}` });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Red Flags do período</CardTitle>
        <p className="text-sm text-muted-foreground">Alertas ativos nos últimos {dias} dias</p>
      </CardHeader>
      <CardContent>
        {flags.length === 0 ? (
          <p className="text-sm text-success">Nenhum alerta ativo no período.</p>
        ) : (
          <ul className="space-y-2">
            {flags.map((f) => (
              <li key={f.texto} className={cn("rounded-lg border p-3", f.cor === "danger" ? "border-danger/20 bg-danger/5" : "border-warning/20 bg-warning/5")}>
                <p className="text-sm font-medium">{f.texto}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.detalhe}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { MENOR_MELHOR };
