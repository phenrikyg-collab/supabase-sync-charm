import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, int, n, pct, roasFmt } from "./metaCriativos";

// ===== Tipos =====
export interface RankingCriativo {
  ad_id: string;
  ad_name: string | null;
  formato: string | null;
  tipo_funil: string | null;
  conjunto: string | null;
  quality_ranking: string | null;
  engagement_ranking: string | null;
  conversion_ranking: string | null;
  impressions: number | null;
  spend: number | null;
  roas: number | null;
  cpm: number | null;
  ctr_link: number | null;
  cpa: number | null;
  frequency: number | null;
  purchases: number | null;
  purchase_value: number | null;
  thumb_stop_rate: number | null;
  retencao_rate: number | null;
  thumbnail_url: string | null;
}

// ===== Rankings =====
const RANKING_META: Record<string, { label: string; className: string }> = {
  ABOVE_AVERAGE: { label: "▲ Acima", className: "border-transparent bg-[#EAF4EE] text-[#2D6A4F]" },
  AVERAGE: { label: "— Médio", className: "border-transparent bg-[#F0EFED] text-[#5A5450]" },
  BELOW_AVERAGE_35: { label: "▼ −35%", className: "border-transparent bg-[#FEF3E2] text-[#B45309]" },
  BELOW_AVERAGE_20: { label: "▼ −20%", className: "border-transparent bg-[#FEE2E2] text-[#9B1C1C]" },
  BELOW_AVERAGE_10: { label: "▼ −10%", className: "border-transparent bg-[#FECACA] text-[#6B0A0A]" },
};

const rankingInfo = (v: string | null | undefined) =>
  (v && RANKING_META[v]) || { label: "—", className: "border-transparent bg-muted text-muted-foreground" };

const PESO: Record<string, number> = {
  ABOVE_AVERAGE: 3,
  AVERAGE: 2,
  BELOW_AVERAGE_35: 1,
  BELOW_AVERAGE_20: 0.5,
  BELOW_AVERAGE_10: 0,
};
const peso = (v: string | null | undefined) => (v && v in PESO ? PESO[v] : 1.5);

export function scoreMeta(c: RankingCriativo) {
  return ((peso(c.quality_ranking) * 0.35 + peso(c.engagement_ranking) * 0.25 + peso(c.conversion_ranking) * 0.4) / 3) * 10;
}

const corScore = (s: number) => (s >= 7 ? "text-[#2D6A4F]" : s >= 5 ? "text-[#B45309]" : "text-[#9B1C1C]");
const bgScore = (s: number) => (s >= 7 ? "bg-[#EAF4EE] text-[#2D6A4F]" : s >= 5 ? "bg-[#FEF3E2] text-[#B45309]" : "bg-[#FEE2E2] text-[#9B1C1C]");
const corRoas = (r: number) => (r >= 3 ? "text-[#2D6A4F]" : r >= 1.5 ? "text-[#B45309]" : "text-[#9B1C1C]");

function diagnostico(c: RankingCriativo) {
  const q = c.quality_ranking;
  const roas = n(c.roas);
  if (q === "BELOW_AVERAGE_20" || q === "BELOW_AVERAGE_10") return "🚨 Substituir criativo";
  if (q === "BELOW_AVERAGE_35" && roas > 3) return "⚠️ Quality baixo mas converte — monitorar";
  if (n(c.thumb_stop_rate) < 15 && (c.formato || "").toLowerCase() === "video") return "🎬 Hook fraco — testar novo início";
  if (roas === 0 && n(c.spend) > 200) return "💸 Sem retorno — revisar segmentação";
  if (c.engagement_ranking === "ABOVE_AVERAGE" && c.conversion_ranking === "BELOW_AVERAGE_35")
    return "⚡ Engaja mas não vende — revisar oferta";
  if (roas >= 3) return "✅ Bom desempenho — escalar com cuidado";
  return "";
}

const ICONE_FORMATO: Record<string, string> = { video: "🎬", imagem: "🖼️", catalogo: "📦", carrossel: "🖼️" };

// ===== Mock inicial =====
const MOCK: RankingCriativo[] = [
  { ad_id: "120247094276780218", ad_name: "IMGS - CALCA ANNA", formato: "imagem", tipo_funil: "Indefinido", conjunto: "Outro", quality_ranking: "BELOW_AVERAGE_35", engagement_ranking: "AVERAGE", conversion_ranking: "AVERAGE", impressions: 190810, spend: 3800.88, roas: 4.65, cpm: 19.92, thumb_stop_rate: 0, retencao_rate: 0, purchases: 43, purchase_value: 17685.89, ctr_link: 1.23, cpa: 88.39, frequency: 1.9, thumbnail_url: null },
  { ad_id: "120247484238620218", ad_name: "VIDEO FRAN — Cópia", formato: "video", tipo_funil: "Remarketing", conjunto: "Outro", quality_ranking: "BELOW_AVERAGE_35", engagement_ranking: "ABOVE_AVERAGE", conversion_ranking: "BELOW_AVERAGE_35", impressions: 125725, spend: 2623.85, roas: 3.43, cpm: 20.87, thumb_stop_rate: 36.01, retencao_rate: 13.16, purchases: 28, purchase_value: 9000.28, ctr_link: 2.93, cpa: 93.71, frequency: 1.14, thumbnail_url: null },
  { ad_id: "120242898038960218", ad_name: "REELS - CALCA ANNA CORES + ATHENA — Cópia", formato: "video", tipo_funil: "Remarketing", conjunto: "Outro", quality_ranking: "BELOW_AVERAGE_35", engagement_ranking: "ABOVE_AVERAGE", conversion_ranking: "AVERAGE", impressions: 47634, spend: 1453.1, roas: 3.11, cpm: 30.51, thumb_stop_rate: 30.15, retencao_rate: 8.16, purchases: 16, purchase_value: 4521.7, ctr_link: 3.09, cpa: 90.82, frequency: 1.56, thumbnail_url: null },
  { ad_id: "120245412595520218", ad_name: "REPOSICAO CALCA ANNA", formato: "video", tipo_funil: "Remarketing", conjunto: "Outro", quality_ranking: "BELOW_AVERAGE_35", engagement_ranking: null, conversion_ranking: null, impressions: 39767, spend: 1148.96, roas: 2.87, cpm: 28.89, thumb_stop_rate: 19.65, retencao_rate: 6.6, purchases: 16, purchase_value: 3292.2, ctr_link: 2.02, cpa: 71.81, frequency: 1.34, thumbnail_url: null },
  { ad_id: "120247155309780218", ad_name: "VIDEO FRAN", formato: "video", tipo_funil: "Remarketing", conjunto: "Outro", quality_ranking: "BELOW_AVERAGE_35", engagement_ranking: null, conversion_ranking: null, impressions: 219784, spend: 1007.06, roas: 0, cpm: 4.58, thumb_stop_rate: 51, retencao_rate: 22.18, purchases: 0, purchase_value: 0, ctr_link: 9.97, cpa: null, frequency: 1.1, thumbnail_url: null },
];

// ===== Dados =====
function useRankings() {
  const [dados, setDados] = useState<RankingCriativo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [kpisRes, adsRes, infoRes] = await Promise.all([
        supabase.from("vw_meta_criativo_kpis" as any).select("*").limit(500),
        supabase.from("meta_ads_anuncios" as any).select("ad_id, engagement_ranking, conversion_ranking").not("engagement_ranking", "is", null).limit(5000),
        supabase.from("meta_ads_anuncios_info" as any).select("ad_id, thumbnail_url").limit(2000),
      ]);
      if (!ativo) return;

      const kpis = (kpisRes.data as any[]) || [];
      if (!kpis.length) {
        setDados(MOCK);
        setLoading(false);
        return;
      }
      const porAd = new Map<string, { e: string | null; c: string | null }>();
      ((adsRes.data as any[]) || []).forEach((a) => {
        const at = porAd.get(a.ad_id) || { e: null, c: null };
        if (!at.e || String(a.engagement_ranking) > String(at.e)) at.e = a.engagement_ranking;
        if (!at.c || String(a.conversion_ranking) > String(at.c)) at.c = a.conversion_ranking;
        porAd.set(a.ad_id, at);
      });
      const thumbs = new Map<string, string | null>();
      ((infoRes.data as any[]) || []).forEach((i) => thumbs.set(i.ad_id, i.thumbnail_url));

      const lista: RankingCriativo[] = kpis.map((k) => ({
        ...(k as any),
        engagement_ranking: porAd.get(k.ad_id)?.e ?? null,
        conversion_ranking: porAd.get(k.ad_id)?.c ?? null,
        thumbnail_url: thumbs.get(k.ad_id) ?? (k as any).thumbnail_url ?? null,
      }));
      lista.sort((a, b) => n(b.spend) - n(a.spend));
      setDados(lista);
      setLoading(false);
    })().catch(() => {
      if (!ativo) return;
      setDados(MOCK);
      setLoading(false);
    });
    return () => {
      ativo = false;
    };
  }, []);

  return { dados, loading };
}

// ===== Legenda =====
function Legenda() {
  const [aberto, setAberto] = useState(false);
  const itens: [string, string][] = [
    ["Quality Ranking", "Qualidade percebida vs concorrentes no mesmo público. Quanto menor, mais caro fica exibir (CPM sobe)."],
    ["Engagement Ranking", "Taxa esperada de curtidas, comentários e cliques. Alto + conversion baixo = engaja mas não vende."],
    ["Conversion Ranking", "Taxa esperada de conversão. Baixo indica problema na landing page, oferta ou segmentação."],
  ];
  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between p-4 text-left">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-muted-foreground" /> Como ler os rankings do Meta
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 md:grid-cols-3">
              {itens.map(([t, d]) => (
                <div key={t} className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">{t}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(RANKING_META).map(([k, v]) => (
                <Badge key={k} className={cn("font-medium", v.className)}>
                  {v.label} · {k}
                </Badge>
              ))}
              <Badge className="border-transparent bg-muted font-medium text-muted-foreground">— sem dado</Badge>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ===== Card de criativo =====
function CardRanking({ c }: { c: RankingCriativo }) {
  const [erro, setErro] = useState(false);
  const score = scoreMeta(c);
  const diag = diagnostico(c);
  const icone = ICONE_FORMATO[(c.formato || "").toLowerCase()] || "🖼️";
  const metricas: { label: string; valor: string; cor?: string }[] = [
    { label: "ROAS", valor: roasFmt(c.roas), cor: corRoas(n(c.roas)) },
    { label: "CPM", valor: brl(c.cpm), cor: n(c.cpm) > 28 ? "text-[#B45309]" : undefined },
    { label: "Gasto", valor: brl(c.spend) },
    { label: "Hook 3s", valor: pct(c.thumb_stop_rate), cor: n(c.thumb_stop_rate) >= 25 ? "text-[#2D6A4F]" : "text-[#B45309]" },
    { label: "Retenção", valor: pct(c.retencao_rate) },
    { label: "Compras", valor: int(c.purchases) },
  ];

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="relative h-[180px] w-full bg-muted">
        {c.thumbnail_url && !erro ? (
          <img
            src={c.thumbnail_url}
            alt={c.ad_name || "Criativo"}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setErro(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">{icone}</div>
        )}
        <span className={cn("absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold", bgScore(score))}>
          {score.toFixed(1).replace(".", ",")}
        </span>
        <span className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold capitalize backdrop-blur">
          {c.formato || "—"}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <p className="truncate text-sm font-semibold" title={c.ad_name || ""}>{c.ad_name || "Sem nome"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {c.conjunto || "—"} · {c.tipo_funil || "—"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {([["Quality", c.quality_ranking], ["Engaj.", c.engagement_ranking], ["Conv.", c.conversion_ranking]] as const).map(
            ([label, v]) => {
              const info = rankingInfo(v);
              return (
                <div key={label} className="space-y-1 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                  <Badge className={cn("w-full justify-center text-[10px] font-medium", info.className)}>{info.label}</Badge>
                </div>
              );
            }
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Score Meta</span>
            <span className={cn("font-semibold", corScore(score))}>{score.toFixed(1).replace(".", ",")}/10</span>
          </div>
          <Progress value={score * 10} className="h-1.5" />
        </div>

        <div className="grid grid-cols-3 gap-y-2 border-t pt-3">
          {metricas.map((m) => (
            <div key={m.label}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className={cn("text-sm font-semibold", m.cor)}>{m.valor}</p>
            </div>
          ))}
        </div>

        {diag && <p className="border-t pt-2 text-xs text-muted-foreground">{diag}</p>}
      </div>
    </div>
  );
}

const INSIGHTS: [string, string, string][] = [
  ["📉", "Quality baixo = CPM alto", "Criativos com Quality BELOW_AVERAGE_35 pagam CPM até 40% maior. Substituir ou otimizar antes de aumentar verba."],
  ["⚡", "Engaja mas não converte", "Padrão Engagement ABOVE + Conversion BELOW indica desalinhamento entre criativo e oferta. Revisar landing ou CTA."],
  ["🎬", "Thumb Stop Rate ideal: >25%", "Taxa de parada nos primeiros 3s. Abaixo disso o hook não está funcionando."],
  ["🔁", "Lives: remarketing imediato", "Lives têm Conversion baixo consistente. Montar sequência de remarketing nas 24h seguintes."],
  ["📊", "Diversidade de criativos", "Ter 4+ criativos distintos por conjunto reduz fadiga, melhora rankings e diminui CPM."],
  ["🏆", "Replicar o que funciona", "Identificar padrão do criativo com maior Score e ROAS e produzir variações."],
];

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "video", label: "Vídeo" },
  { id: "imagem", label: "Imagem" },
  { id: "catalogo", label: "Catálogo" },
  { id: "remarketing", label: "Remarketing" },
  { id: "aquisicao", label: "Aquisição" },
];

export function RankingsMetaTab() {
  const { dados, loading } = useRankings();
  const [filtro, setFiltro] = useState("todos");
  const [ordem, setOrdem] = useState("score");

  const lista = useMemo(() => {
    const f = dados.filter((c) => {
      const fmt = (c.formato || "").toLowerCase();
      const funil = (c.tipo_funil || "").toLowerCase();
      switch (filtro) {
        case "video": return fmt === "video";
        case "imagem": return fmt === "imagem" || fmt === "image";
        case "catalogo": return fmt === "catalogo";
        case "remarketing": return funil.includes("remarketing");
        case "aquisicao": return funil.includes("aquisi");
        default: return true;
      }
    });
    const chave = (c: RankingCriativo) => {
      switch (ordem) {
        case "roas": return n(c.roas);
        case "spend": return n(c.spend);
        case "impressions": return n(c.impressions);
        default: return scoreMeta(c);
      }
    };
    return [...f].sort((a, b) => chave(b) - chave(a));
  }, [dados, filtro, ordem]);

  const kpis = useMemo(() => {
    const spend = lista.reduce((s, c) => s + n(c.spend), 0);
    const receita = lista.reduce((s, c) => s + n(c.purchase_value), 0);
    const cpms = lista.map((c) => c.cpm).filter((v) => v !== null && v !== undefined).map(Number);
    return {
      spend,
      roas: spend > 0 ? receita / spend : null,
      cpm: cpms.length ? cpms.reduce((s, v) => s + v, 0) / cpms.length : null,
      alta: lista.filter((c) => c.quality_ranking === "ABOVE_AVERAGE").length,
      criticos: lista.filter((c) => c.quality_ranking === "BELOW_AVERAGE_20" || c.quality_ranking === "BELOW_AVERAGE_10").length,
    };
  }, [lista]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[420px]" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">ROAS Geral</p>
          <p className={cn("mt-1 font-serif text-2xl font-bold", corRoas(n(kpis.roas)))}>{roasFmt(kpis.roas)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Gasto</p>
          <p className="mt-1 font-serif text-2xl font-bold">{brl(kpis.spend)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">CPM Médio</p>
          <p className={cn("mt-1 font-serif text-2xl font-bold", n(kpis.cpm) > 25 && "text-[#B45309]")}>{brl(kpis.cpm)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Quality Alta</p>
          <p className="mt-1 font-serif text-2xl font-bold">{kpis.alta}</p>
          {kpis.criticos > 0 && (
            <p className="text-xs font-medium text-[#9B1C1C]">🚨 {kpis.criticos} criativo(s) com quality crítico</p>
          )}
        </div>
      </div>

      <Legenda />

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-lg">Rankings Meta ({lista.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {FILTROS.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={filtro === f.id ? "default" : "outline"}
                className="h-8 rounded-full"
                onClick={() => setFiltro(f.id)}
              >
                {f.label}
              </Button>
            ))}
            <Select value={ordem} onValueChange={setOrdem}>
              <SelectTrigger className="h-8 w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Ordenar: Score Meta</SelectItem>
                <SelectItem value="roas">Ordenar: ROAS</SelectItem>
                <SelectItem value="spend">Ordenar: Gasto</SelectItem>
                <SelectItem value="impressions">Ordenar: Impressões</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {lista.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Nenhum criativo para este filtro</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {lista.map((c) => <CardRanking key={c.ad_id} c={c} />)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Insights estratégicos</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {INSIGHTS.map(([icone, titulo, texto]) => (
            <div key={titulo} className="rounded-lg border p-4">
              <p className="text-sm font-semibold">{icone} {titulo}</p>
              <p className="mt-1 text-xs text-muted-foreground">{texto}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
