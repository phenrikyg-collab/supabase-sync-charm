import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ExternalLink, FileText, Info, Instagram } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, int, n, pct, roasFmt } from "./metaCriativos";

// ===== Tipo unificado =====
export interface CriativoUnificado {
  criativo_id: string;
  titulo: string | null;
  produto_nome: string | null;
  formato: string | null;
  etapa_funil: string | null;
  status: string | null;
  pilar: string | null;
  angulo: string | null;
  tipo_gancho: string | null;
  estrutura_narrativa: string | null;
  eh_remarketing: boolean | null;
  bateria_numero: number | null;
  roteiro_hook: string | null;
  headline_principal: string | null;
  copy_anuncio: string | null;
  conceito_estrategico: string | null;
  objecao_resolvida: string | null;
  resultado_observado: string | null;
  feedback: string | null;
  html_briefing_url: string | null;
  created_at: string | null;
  imagem_criativo: string | null;
  ad_id: string | null;
  ad_name: string | null;
  thumbnail_url: string | null;
  instagram_permalink: string | null;
  quality_ranking: string | null;
  engagement_ranking: string | null;
  conversion_ranking: string | null;
  impressions: number | null;
  spend: number | null;
  roas: number | null;
  cpm: number | null;
  purchases: number | null;
  purchase_value: number | null;
  thumb_stop_rate: number | null;
  retencao_rate: number | null;
  ctr_link: number | null;
  cpa: number | null;
  frequency: number | null;
}

// ===== Rankings =====
export const RANKING_META: Record<string, { label: string; className: string }> = {
  ABOVE_AVERAGE: { label: "▲ Acima", className: "border-transparent bg-[#EAF4EE] text-[#2D6A4F]" },
  AVERAGE: { label: "— Médio", className: "border-transparent bg-[#F0EFED] text-[#5A5450]" },
  BELOW_AVERAGE_35: { label: "▼ −35%", className: "border-transparent bg-[#FEF3E2] text-[#B45309]" },
  BELOW_AVERAGE_20: { label: "▼ −20%", className: "border-transparent bg-[#FEE2E2] text-[#9B1C1C]" },
  BELOW_AVERAGE_10: { label: "▼ −10%", className: "border-transparent bg-[#FECACA] text-[#6B0A0A]" },
};
const rankingInfo = (v: string | null | undefined) =>
  (v && RANKING_META[v]) || { label: "—", className: "border-transparent bg-[#F0EFED] text-[#AAA59F]" };

const PESO: Record<string, number> = {
  ABOVE_AVERAGE: 3,
  AVERAGE: 2,
  BELOW_AVERAGE_35: 1,
  BELOW_AVERAGE_20: 0.5,
  BELOW_AVERAGE_10: 0,
};
const peso = (v: string | null | undefined) => (v && v in PESO ? PESO[v] : 1.5);

export function scoreUnificado(c: CriativoUnificado) {
  return ((peso(c.quality_ranking) * 0.35 + peso(c.engagement_ranking) * 0.25 + peso(c.conversion_ranking) * 0.4) / 3) * 10;
}

const corScore = (s: number) => (s >= 7 ? "text-[#2D6A4F]" : s >= 5 ? "text-[#B45309]" : "text-[#9B1C1C]");
const corRoas = (r: number) => (r >= 3 ? "text-[#2D6A4F]" : r >= 1.5 ? "text-[#B45309]" : "text-[#9B1C1C]");

const STATUS_BADGE: Record<string, string> = {
  rascunho: "bg-[#F0EFED] text-[#5A5450]",
  "em producao": "bg-blue-500/15 text-blue-700",
  "em produção": "bg-blue-500/15 text-blue-700",
  aprovado: "bg-[#FEF3E2] text-[#B45309]",
  "no ar": "bg-[#EAF4EE] text-[#2D6A4F] animate-pulse",
};
const statusClasse = (s: string | null) => STATUS_BADGE[(s || "").toLowerCase()] || "bg-[#F0EFED] text-[#5A5450]";

const ICONE_FORMATO: Record<string, string> = { video: "🎬", imagem: "🖼️", image: "🖼️", carrossel: "🖼️", catalogo: "📦" };
const iconeFormato = (f: string | null) => ICONE_FORMATO[(f || "").toLowerCase()] || "📄";

export function diagnosticoUnificado(c: CriativoUnificado) {
  const q = c.quality_ranking;
  const roas = n(c.roas);
  if (q === "BELOW_AVERAGE_20" || q === "BELOW_AVERAGE_10")
    return { texto: "🚨 Substituir criativo urgente", classe: "bg-[#FEE2E2] text-[#9B1C1C]" };
  if (q === "BELOW_AVERAGE_35" && roas > 3)
    return { texto: "⚠️ Quality baixo mas converte — monitorar", classe: "bg-[#FEF3E2] text-[#B45309]" };
  if (n(c.thumb_stop_rate) < 15 && (c.formato || "").toLowerCase() === "video")
    return { texto: "🎬 Hook fraco — testar novo início", classe: "bg-[#FEF3E2] text-[#B45309]" };
  if (roas === 0 && n(c.spend) > 200)
    return { texto: "💸 Sem retorno — revisar segmentação", classe: "bg-[#FEE2E2] text-[#9B1C1C]" };
  if (c.engagement_ranking === "ABOVE_AVERAGE" && c.conversion_ranking === "BELOW_AVERAGE_35")
    return { texto: "⚡ Engaja mas não vende — revisar oferta", classe: "bg-[#FEF3E2] text-[#B45309]" };
  if (roas >= 3) return { texto: "✅ Bom desempenho — escalar com cuidado", classe: "bg-[#EAF4EE] text-[#2D6A4F]" };
  return null;
}

// ===== Mock =====
const MOCK: CriativoUnificado[] = [
  {
    criativo_id: "97da1209-56ed-4f41-afda-57a1f0e9a913",
    titulo: "O segredo das brasileiras estilosas revelado",
    produto_nome: "Calça Anna", formato: "imagem", etapa_funil: "problema", status: "No ar",
    pilar: "angulo", angulo: null, tipo_gancho: "pergunta", estrutura_narrativa: null,
    eh_remarketing: false, bateria_numero: null,
    roteiro_hook: "Você sabia que existe uma calça que define, sustenta e não marca?",
    headline_principal: "O SEGREDO REVELADO",
    copy_anuncio: "A calça que as mulheres estilosas usam sem contar pra ninguém. Modeladora, confortável e sem transparência.",
    conceito_estrategico: null, objecao_resolvida: null, resultado_observado: "ROAS 4.65 em 30 dias",
    feedback: null, html_briefing_url: null, created_at: null, imagem_criativo: null,
    ad_id: "120247094276780218", ad_name: "IMGS - CALCA ANNA", thumbnail_url: null,
    instagram_permalink: "https://www.instagram.com/p/Da6CyAYsRDZ/",
    quality_ranking: "BELOW_AVERAGE_35", engagement_ranking: "AVERAGE", conversion_ranking: "AVERAGE",
    impressions: 190810, spend: 3800.88, roas: 4.65, cpm: 19.92, purchases: 43, purchase_value: 17685.89,
    thumb_stop_rate: 0, retencao_rate: 0, ctr_link: 1.23, cpa: 88.39, frequency: 1.9,
  },
  {
    criativo_id: "abc-video-fran",
    titulo: "VIDEO FRAN — estilo e conforto em 30s",
    produto_nome: "Calça Anna", formato: "video", etapa_funil: "solucao", status: "No ar",
    pilar: "UGC / Creator", angulo: null, tipo_gancho: "transformacao", estrutura_narrativa: null,
    eh_remarketing: true, bateria_numero: null,
    roteiro_hook: "Você vai preferir essa calça a qualquer outra que já usou.",
    headline_principal: null,
    copy_anuncio: "Conforto real do dia a dia ao happy hour. Sem apertar, sem transparência, sem perder a forma.",
    conceito_estrategico: null, objecao_resolvida: null, resultado_observado: null,
    feedback: null, html_briefing_url: null, created_at: null, imagem_criativo: null,
    ad_id: "120247484238620218", ad_name: "VIDEO FRAN — Cópia", thumbnail_url: null,
    instagram_permalink: "https://www.instagram.com/p/Da1ED5MMUix/",
    quality_ranking: "BELOW_AVERAGE_35", engagement_ranking: "ABOVE_AVERAGE", conversion_ranking: "BELOW_AVERAGE_35",
    impressions: 125725, spend: 2623.85, roas: 3.43, cpm: 20.87, purchases: 28, purchase_value: 9000.28,
    thumb_stop_rate: 36.01, retencao_rate: 13.16, ctr_link: 2.93, cpa: 93.71, frequency: 1.14,
  },
  {
    criativo_id: "xyz-sem-anuncio",
    titulo: "Quantas calças você já jogou fora esse ano?",
    produto_nome: null, formato: "carrossel", etapa_funil: "problema", status: "Rascunho",
    pilar: "Conceito", angulo: null, tipo_gancho: "pergunta", estrutura_narrativa: null,
    eh_remarketing: false, bateria_numero: null,
    roteiro_hook: "Quantas peças você comprou esse ano que já estragaram?",
    headline_principal: "DURABILIDADE REAL",
    copy_anuncio: "Quantas calças você já trocou esse ano por perderem a forma? Link na bio.",
    conceito_estrategico: null, objecao_resolvida: null, resultado_observado: null,
    feedback: null, html_briefing_url: null, created_at: null, imagem_criativo: null,
    ad_id: null, ad_name: null, thumbnail_url: null, instagram_permalink: null,
    quality_ranking: null, engagement_ranking: null, conversion_ranking: null,
    impressions: null, spend: null, roas: null, cpm: null, purchases: null, purchase_value: null,
    thumb_stop_rate: null, retencao_rate: null, ctr_link: null, cpa: null, frequency: null,
  },
];

// ===== Dados (join client-side) =====
function useCriativosUnificados() {
  const [dados, setDados] = useState<CriativoUnificado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [critRes, infoRes, kpisRes, adsRes] = await Promise.all([
        supabase.from("mc_criativos" as any).select("*").limit(1000),
        supabase.from("meta_ads_anuncios_info" as any).select("ad_id, ad_name, thumbnail_url, instagram_permalink").limit(3000),
        supabase.from("vw_meta_criativo_kpis" as any).select("*").limit(1000),
        supabase
          .from("meta_ads_anuncios" as any)
          .select("ad_id, engagement_ranking, conversion_ranking")
          .not("engagement_ranking", "is", null)
          .limit(5000),
      ]);
      if (!ativo) return;

      const criativos = ((critRes.data as any[]) || []).filter((c) => (c.status || "") !== "Arquivado");
      const infos = (infoRes.data as any[]) || [];
      const kpis = new Map<string, any>();
      ((kpisRes.data as any[]) || []).forEach((k) => kpis.set(String(k.ad_id), k));
      const rk = new Map<string, { e: string | null; c: string | null }>();
      ((adsRes.data as any[]) || []).forEach((a) => {
        const at = rk.get(String(a.ad_id)) || { e: null, c: null };
        if (!at.e || String(a.engagement_ranking) > String(at.e)) at.e = a.engagement_ranking;
        if (!at.c || String(a.conversion_ranking) > String(at.c)) at.c = a.conversion_ranking;
        rk.set(String(a.ad_id), at);
      });

      if (!criativos.length) {
        setDados(MOCK);
        setLoading(false);
        return;
      }

      const lista: CriativoUnificado[] = criativos.map((c) => {
        const primeira = String(c.titulo || "").split(" ")[0]?.toLowerCase() || "";
        const info =
          primeira.length >= 3
            ? infos.find((i) => String(i.ad_name || "").toLowerCase().includes(primeira))
            : undefined;
        const k = info ? kpis.get(String(info.ad_id)) : undefined;
        const r = info ? rk.get(String(info.ad_id)) : undefined;
        return {
          criativo_id: String(c.id),
          titulo: c.titulo ?? null,
          produto_nome: c.produto_nome ?? null,
          formato: c.formato ?? null,
          etapa_funil: c.etapa_funil ?? null,
          status: c.status ?? null,
          pilar: c.pilar ?? null,
          angulo: c.angulo ?? null,
          tipo_gancho: c.tipo_gancho ?? null,
          estrutura_narrativa: c.estrutura_narrativa ?? null,
          eh_remarketing: c.eh_remarketing ?? null,
          bateria_numero: c.bateria_numero ?? null,
          roteiro_hook: c.roteiro_hook ?? null,
          headline_principal: c.headline_principal ?? null,
          copy_anuncio: c.copy_anuncio ?? null,
          conceito_estrategico: c.conceito_estrategico ?? null,
          objecao_resolvida: c.objecao_resolvida ?? null,
          resultado_observado: c.resultado_observado ?? null,
          feedback: c.feedback ?? null,
          html_briefing_url: c.html_briefing_url ?? null,
          created_at: c.created_at ?? null,
          imagem_criativo:
            c.imagem_produto_url || c.imagem_gerada_url || c.imagem_lifestyle_url || c.imagem_estudio_url || c.imagem_texto_url || null,
          ad_id: info?.ad_id ? String(info.ad_id) : null,
          ad_name: info?.ad_name ?? null,
          thumbnail_url: info?.thumbnail_url ?? null,
          instagram_permalink: info?.instagram_permalink ?? null,
          quality_ranking: k?.quality_ranking ?? null,
          engagement_ranking: r?.e ?? null,
          conversion_ranking: r?.c ?? null,
          impressions: k?.impressions ?? null,
          spend: k?.spend ?? null,
          roas: k?.roas ?? null,
          cpm: k?.cpm ?? null,
          purchases: k?.purchases ?? null,
          purchase_value: k?.purchase_value ?? null,
          thumb_stop_rate: k?.thumb_stop_rate ?? null,
          retencao_rate: k?.retencao_rate ?? null,
          ctr_link: k?.ctr_link ?? null,
          cpa: k?.cpa ?? null,
          frequency: k?.frequency ?? null,
        };
      });

      lista.sort((a, b) => {
        const d = n(b.spend) - n(a.spend);
        if (d !== 0) return d;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
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
                <Badge key={k} className={cn("font-medium", v.className)}>{v.label} · {k}</Badge>
              ))}
              <Badge className="border-transparent bg-[#F0EFED] font-medium text-[#AAA59F]">— sem dado</Badge>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ===== Card unificado =====
function CardUnificado({ c }: { c: CriativoUnificado }) {
  const [face, setFace] = useState<"briefing" | "performance">("briefing");
  const [erro, setErro] = useState(false);
  const [hookAberto, setHookAberto] = useState(false);

  const imagem = (!erro && (c.thumbnail_url || c.imagem_criativo)) || null;
  const score = scoreUnificado(c);
  const diag = diagnosticoUnificado(c);

  const metricas: { label: string; valor: string; cor?: string }[] = [
    { label: "ROAS", valor: roasFmt(c.roas), cor: corRoas(n(c.roas)) },
    { label: "CPM", valor: brl(c.cpm), cor: n(c.cpm) > 28 ? "text-[#B45309]" : undefined },
    { label: "Gasto", valor: c.spend === null ? "—" : brl(Math.round(n(c.spend))) },
    { label: "Hook 3s", valor: pct(c.thumb_stop_rate), cor: n(c.thumb_stop_rate) >= 25 ? "text-[#2D6A4F]" : "text-[#B45309]" },
    { label: "Retenção", valor: pct(c.retencao_rate) },
    { label: "Compras", valor: int(c.purchases) },
  ];

  const tags = [
    c.etapa_funil,
    c.tipo_gancho,
    c.estrutura_narrativa,
    c.eh_remarketing ? "Remarketing" : "Aquisição",
  ].filter(Boolean) as string[];

  return (
    <div className="overflow-hidden rounded-lg border border-[#E8E4DC] bg-card shadow-sm">
      <div className="flex gap-1 border-b border-[#E8E4DC] p-2">
        {(["briefing", "performance"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={face === f ? "default" : "ghost"}
            className="h-7 flex-1 rounded-full text-[11px]"
            onClick={() => setFace(f)}
          >
            {f === "briefing" ? "📋 Briefing" : "📊 Performance"}
          </Button>
        ))}
      </div>

      <div className="relative h-[200px] w-full bg-muted">
        {imagem ? (
          <img
            src={imagem}
            alt={c.titulo || "Criativo"}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setErro(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">{iconeFormato(c.formato)}</div>
        )}
        <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold", statusClasse(c.status))}>
          {c.status || "Sem status"}
        </span>
        <span className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold capitalize backdrop-blur">
          {c.formato || "—"}
        </span>
        {c.instagram_permalink && (
          <a
            href={c.instagram_permalink}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-2 right-2 rounded-full bg-background/90 p-1.5 backdrop-blur"
            aria-label="Abrir no Instagram"
          >
            <Instagram className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {face === "briefing" ? (
        <div className="space-y-3 p-4">
          <div>
            <p className="line-clamp-2 text-sm font-semibold" title={c.titulo || ""}>{c.titulo || "Sem título"}</p>
            <p className="truncate text-xs text-[#7A7570]">
              {[c.produto_nome, c.pilar].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span key={t} className="rounded-full border border-[#E8E4DC] px-2 py-0.5 text-[10px] capitalize text-[#7A7570]">{t}</span>
              ))}
            </div>
          )}

          {c.roteiro_hook && (
            <div className="rounded-md bg-[#FAF8F0] p-2 text-xs text-[#1A1815]">
              {hookAberto || c.roteiro_hook.length <= 120 ? c.roteiro_hook : `${c.roteiro_hook.slice(0, 120)}…`}
              {c.roteiro_hook.length > 120 && (
                <button className="ml-1 font-semibold text-[#C9A84C]" onClick={() => setHookAberto((v) => !v)}>
                  {hookAberto ? "ver menos" : "ver mais"}
                </button>
              )}
            </div>
          )}

          {c.headline_principal && <p className="text-sm font-medium italic">“{c.headline_principal}”</p>}

          {c.copy_anuncio && (
            <p className="text-xs text-[#7A7570]">
              {c.copy_anuncio.length > 80 ? `${c.copy_anuncio.slice(0, 80)}…` : c.copy_anuncio}
            </p>
          )}

          {(c.conceito_estrategico || c.objecao_resolvida) && (
            <div className="space-y-1 border-t pt-2 text-[11px] text-[#7A7570]">
              {c.conceito_estrategico && <p><span className="font-semibold">Conceito:</span> {c.conceito_estrategico}</p>}
              {c.objecao_resolvida && <p><span className="font-semibold">Objeção:</span> {c.objecao_resolvida}</p>}
            </div>
          )}

          {(c.resultado_observado || c.feedback) && (
            <div className="rounded-md bg-[#EAF4EE] p-2 text-[11px] text-[#2D6A4F]">
              <p className="text-[10px] font-bold uppercase tracking-widest">Resultado</p>
              {c.resultado_observado && <p>{c.resultado_observado}</p>}
              {c.feedback && <p>{c.feedback}</p>}
            </div>
          )}

          {c.html_briefing_url && (
            <Button asChild size="sm" variant="outline" className="w-full">
              <a href={c.html_briefing_url} target="_blank" rel="noreferrer">
                <FileText className="mr-1 h-3.5 w-3.5" /> Ver briefing completo
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <p className="line-clamp-1 text-sm font-semibold">{c.ad_name || c.titulo || "Sem título"}</p>
          {!c.ad_id ? (
            <p className="rounded-md bg-[#F0EFED] p-3 text-xs text-[#7A7570]">
              Criativo ainda não está no ar como anúncio Meta. Quando for ativado, a performance aparecerá aqui.
            </p>
          ) : (
            <>
              <div className="text-center">
                <p className={cn("font-serif text-3xl font-semibold", corScore(score))}>{score.toFixed(1).replace(".", ",")}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Score Meta</p>
                <Progress value={score * 10} className="mt-2 h-1.5" />
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {([["Quality", c.quality_ranking], ["Engaj.", c.engagement_ranking], ["Conv.", c.conversion_ranking]] as const).map(
                  ([label, v]) => {
                    const info = rankingInfo(v);
                    return (
                      <div key={label} className="space-y-1 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-[#7A7570]">{label}</p>
                        <Badge className={cn("w-full justify-center text-[10px] font-medium", info.className)}>{info.label}</Badge>
                      </div>
                    );
                  }
                )}
              </div>

              <div className="grid grid-cols-3 gap-y-2 border-t pt-3">
                {metricas.map((m) => (
                  <div key={m.label}>
                    <p className="text-[10px] uppercase tracking-wide text-[#7A7570]">{m.label}</p>
                    <p className={cn("text-sm font-semibold", m.cor)}>{m.valor}</p>
                  </div>
                ))}
              </div>

              {diag && <p className={cn("rounded-md p-2 text-[10px] font-medium", diag.classe)}>{diag.texto}</p>}
            </>
          )}
        </div>
      )}
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

// ===== Sugestões de conteúdo =====
const SUGESTOES: { badge: string; badgeClasse: string; titulo: string; porque: string; gancho: string; base: string }[] = [
  {
    badge: "Reels · Aquisição",
    badgeClasse: "bg-blue-500/10 text-blue-700",
    titulo: "Mais produtos em 1 vídeo — ângulo comparativo",
    porque: "REELS - CALÇAS POR HORA tem ROAS 7.46x e hook rate 34.6% — maior ROAS de vídeo no período. O padrão \"várias peças em ritmo rápido\" é o que mais retém.",
    gancho: "Você não precisa escolher uma. Eu vou te mostrar as 3 que cabem no mesmo look.",
    base: "REELS - CALÇAS POR HORA + REELS - CALCA ANNA CORES",
  },
  {
    badge: "Imagem · Aquisição",
    badgeClasse: "bg-[#EAF4EE] text-[#2D6A4F]",
    titulo: "Imagem estática da Calça Anna Havenna — drop temático",
    porque: "Imagens estáticas têm ROAS médio de 4.53x com CPM de R$ 18 — o mais barato do mix. IMGS - CALCA ANNA gerou R$ 17.686 com R$ 3.800 investidos.",
    gancho: "Visual limpo, fundo neutro, calça Havenna em destaque. Texto: \"A cor mais pedida voltou.\"",
    base: "IMGS - CALCA ANNA (replicar o padrão para a cor Havenna do drop Encanto Tinto)",
  },
  {
    badge: "Carrossel · Remarketing",
    badgeClasse: "bg-purple-500/10 text-purple-700",
    titulo: "Carrossel de prova social — clientes reais usando",
    porque: "CARROSSEL - BLUSAS TRICOT tem ROAS 7.69x — melhor ROAS geral do período — com apenas R$ 199 de gasto. Carrosséis de remarketing com prova social convertem sem precisar de alto investimento.",
    gancho: "Slide 1: \"Elas já receberam.\" Slides 2-5: fotos de clientes usando + depoimento curto.",
    base: "CARROSSEL - BLUSAS TRICOT (replicar para a Calça Anna Havenna e T-shirt Básica)",
  },
  {
    badge: "Reels · Problema",
    badgeClasse: "bg-[#FEF3E2] text-[#B45309]",
    titulo: "Hook de pergunta direta — dor da calça que não serve",
    porque: "Criativos com ângulo de problema + estrutura DSB têm engajamento ABOVE_AVERAGE consistente. Hook rate de 30%+ indica que o início captura atenção acima da média.",
    gancho: "Quantas calças você já comprou que perderam a forma em 3 meses? [corte rápido para a calça Anna]",
    base: "Padrão identificado nos criativos aprovados com pilar DSB",
  },
  {
    badge: "Reels · Conversão direta",
    badgeClasse: "bg-[#2D6A4F]/15 text-[#2D6A4F]",
    titulo: "1 calça, 3 looks — vídeo de styling rápido",
    porque: "REELS - 1 CALÇA TRÊS BLUSAS tem ROAS 3.36x em remarketing com hook rate 22.8%. Formato \"versatilidade\" funciona para quem já conhece a marca.",
    gancho: "Uma calça. Manhã no trabalho, tarde casual, noite fashion. Eu vou te mostrar como.",
    base: "REELS - 1 CALÇA TRÊS BLUSAS (adaptar para Calça Anna Havenna + T-shirt Básica)",
  },
  {
    badge: "Catálogo · Aquisição",
    badgeClasse: "bg-[#F0EFED] text-[#5A5450]",
    titulo: "Catálogo dinâmico atualizado com drop Encanto Tinto",
    porque: "CATALOGO - NOVO tem ROAS 7.13x com CPM de R$ 27 — terceiro maior ROAS do período. Catálogos dinâmicos funcionam especialmente para audiências frias.",
    gancho: "Garantir que Calça Anna Havenna e T-shirt Básica estejam no feed do catálogo com imagens da variante correta.",
    base: "CATALOGO - NOVO (incluir novos produtos do drop)",
  },
];

const FALLBACK = {
  top_roas: [
    { nome: "CARROSSEL - BLUSAS TRICOT", roas: 7.69, formato: "carrossel", gasto: 199 },
    { nome: "REELS - CALÇAS POR HORA", roas: 7.46, formato: "video", gasto: 222 },
    { nome: "REELS - CALCA ANNA", roas: 7.15, formato: "video", gasto: 875 },
  ],
  sem_retorno: [
    { nome: "LIVE 11/08", spend: 215 },
    { nome: "VIDEO FRAN", spend: 1007 },
  ],
  escala: "REELS - CALÇAS POR HORA: ROAS 7.46x com apenas R$ 222 investidos — candidato prioritário para escalar",
  gap: "Fase Inconsciente: apenas 2 criativos ativos — topo de funil desabastecido",
};

function useInteligencia(dados: CriativoUnificado[]) {
  return useMemo(() => {
    const comAd = dados.filter((c) => c.ad_id);
    const grupos = new Map<string, { qtd: number; roas: number[]; cpm: number[]; hook: number[]; gasto: number }>();
    comAd.forEach((c) => {
      const f = norm(c.formato) || "outro";
      const g = grupos.get(f) || { qtd: 0, roas: [], cpm: [], hook: [], gasto: 0 };
      g.qtd += 1;
      if (c.roas !== null) g.roas.push(n(c.roas));
      if (c.cpm !== null) g.cpm.push(n(c.cpm));
      if (c.thumb_stop_rate !== null) g.hook.push(n(c.thumb_stop_rate));
      g.gasto += n(c.spend);
      grupos.set(f, g);
    });
    const media = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const porFormato = [...grupos.entries()].map(([formato, g]) => ({
      formato,
      qtd: g.qtd,
      roas: media(g.roas),
      cpm: media(g.cpm),
      hook: media(g.hook),
      gasto: g.gasto,
    }));
    const gastoTotal = porFormato.reduce((s, f) => s + f.gasto, 0);
    const melhorFormato = [...porFormato].sort((a, b) => b.roas - a.roas)[0];
    const video = porFormato.find((f) => f.formato === "video");
    const cpmMedio = media(comAd.filter((c) => n(c.impressions) > 1000).map((c) => n(c.cpm)));
    const semAbove = comAd.filter((c) => c.quality_ranking === "ABOVE_AVERAGE").length === 0;

    const topRoas = [...comAd].sort((a, b) => n(b.roas) - n(a.roas)).slice(0, 3)
      .filter((c) => n(c.roas) > 5)
      .map((c) => ({ nome: c.ad_name || c.titulo || "—", roas: n(c.roas), formato: c.formato || "—", gasto: n(c.spend) }));
    const criticos = comAd.filter((c) => c.quality_ranking === "BELOW_AVERAGE_20" || c.quality_ranking === "BELOW_AVERAGE_10");
    const semRetorno = comAd.filter((c) => n(c.roas) === 0 && n(c.spend) > 500);
    const escala = [...comAd].filter((c) => n(c.spend) < 500 && n(c.roas) >= 3).sort((a, b) => n(b.roas) - n(a.roas))[0];

    const porFunil = new Map<string, number>();
    dados.forEach((c) => {
      const k = c.etapa_funil || "Sem etapa";
      porFunil.set(k, (porFunil.get(k) || 0) + 1);
    });
    const gap = [...porFunil.entries()].sort((a, b) => a[1] - b[1])[0];

    const resumo = comAd.length
      ? `Você tem ${dados.length} criativos ativos, sendo ${
          porFormato.map((f) => `${f.qtd} ${f.formato}`).join(", ")
        }. ${semAbove ? "Nenhum criativo chegou ao ranking ABOVE_AVERAGE de qualidade — todos estão em AVERAGE ou abaixo — o que está" : "Parte dos criativos já atinge ABOVE_AVERAGE de qualidade, mas o mix ainda está"} custando CPM médio de ${brl(cpmMedio)} e limitando o alcance. O melhor ROAS está em ${melhorFormato?.formato || "—"} (${roasFmt(melhorFormato?.roas)} em média)${
          video ? `, enquanto vídeos ficam em ${roasFmt(video.roas)} apesar de representar ${gastoTotal ? Math.round((video.gasto / gastoTotal) * 100) : 0}% do gasto` : ""
        }. Hook rate médio dos vídeos é de ${pct(video?.hook)} — referência ideal acima de 25%.`
      : "Ainda não há anúncios Meta vinculados aos criativos. Assim que os anúncios entrarem no ar, o resumo de performance aparece aqui.";

    return {
      resumo,
      topRoas: topRoas.length ? topRoas : FALLBACK.top_roas,
      criticos,
      semRetorno: semRetorno.length ? semRetorno.map((c) => ({ nome: c.ad_name || c.titulo || "—", spend: n(c.spend) })) : FALLBACK.sem_retorno,
      escala: escala
        ? `${escala.ad_name || escala.titulo}: ROAS ${roasFmt(escala.roas)} com apenas ${brl(escala.spend)} investidos — candidato prioritário para escalar`
        : FALLBACK.escala,
      gap: gap ? `${gap[0]}: apenas ${gap[1]} criativo(s) ativo(s) — etapa de funil desabastecida` : FALLBACK.gap,
    };
  }, [dados]);
}

function BlocoInteligencia({ dados }: { dados: CriativoUnificado[] }) {
  const [aba, setAba] = useState<"acontecendo" | "sugestoes" | "diagnosticos">("acontecendo");
  const i = useInteligencia(dados);

  const abas: [typeof aba, string][] = [
    ["acontecendo", "🔍 O que está acontecendo"],
    ["sugestoes", "💡 Sugestões de conteúdo"],
    ["diagnosticos", "⚡ Diagnósticos rápidos"],
  ];

  const achado = (cor: string, icone: string, titulo: string, corpo: React.ReactNode) => (
    <div className="rounded-lg border border-[#E8E4DC] bg-white p-4" style={{ borderLeft: `3px solid ${cor}` }}>
      <p className="text-[13px] font-bold">{icone} {titulo}</p>
      <div className="mt-2 space-y-1 text-[11px] text-[#7A7570]">{corpo}</div>
    </div>
  );

  return (
    <div className="rounded-lg border border-[#E8E4DC] bg-[#FAFAF8] p-6">
      <div className="flex flex-wrap gap-2">
        {abas.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              aba === id ? "bg-[#1A1815] text-white" : "border border-[#E8E4DC] bg-white text-[#7A7570]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === "acontecendo" && (
        <div className="mt-5 space-y-4">
          <p className="text-sm leading-relaxed text-[#1A1815]">{i.resumo}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {achado("#2D6A4F", "✅", "O que está funcionando", (
              <>
                {i.topRoas.map((t) => (
                  <p key={t.nome}>• {t.nome} — {roasFmt(t.roas)} ({t.formato})</p>
                ))}
                <p className="pt-1 italic">Padrão: reels mostrando múltiplos produtos com alta hook rate (&gt;30%)</p>
              </>
            ))}
            {achado("#9B1C1C", "🚨", "O que está custando caro", (
              <>
                {i.criticos.slice(0, 3).map((c) => (
                  <p key={c.criativo_id}>• {c.ad_name || c.titulo} — quality {c.quality_ranking}</p>
                ))}
                {i.semRetorno.slice(0, 3).map((c) => (
                  <p key={c.nome}>• {c.nome} — {brl(c.spend)} sem retorno</p>
                ))}
                <p className="pt-1 italic">Padrão: lives sem remarketing imediato — gasto sem retorno direto</p>
              </>
            ))}
            {achado("#B45309", "⚠️", "Gap no funil", <p>{i.gap}</p>)}
            {achado("#C9A84C", "💰", "Oportunidade imediata", <p>{i.escala}</p>)}
          </div>
        </div>
      )}

      {aba === "sugestoes" && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SUGESTOES.map((s) => (
            <div key={s.titulo} className="space-y-2 rounded-lg border border-[#E8E4DC] bg-white p-4">
              <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold", s.badgeClasse)}>{s.badge}</span>
              <p className="font-serif text-base leading-snug">{s.titulo}</p>
              <p className="text-[11px] text-[#7A7570]">📊 {s.porque}</p>
              <p className="border-l-2 border-[#C9A84C] bg-[#FAF8F0] p-2 text-xs italic text-[#1A1815]">{s.gancho}</p>
              <p className="text-[10px] text-[#AAA59F]">Base: {s.base}</p>
            </div>
          ))}
        </div>
      )}

      {aba === "diagnosticos" && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {INSIGHTS.map(([icone, titulo, texto]) => (
            <div key={titulo} className="rounded-lg border border-[#E8E4DC] bg-white p-4">
              <p className="text-sm font-semibold">{icone} {titulo}</p>
              <p className="mt-1 text-xs text-[#7A7570]">{texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


const FILTROS_STATUS = [
  { id: "todos", label: "Todos" },
  { id: "com-meta", label: "Com performance Meta" },
  { id: "sem-anuncio", label: "Sem anúncio ainda" },
  { id: "rascunho", label: "Rascunho" },
  { id: "em producao", label: "Em produção" },
  { id: "aprovado", label: "Aprovado" },
  { id: "no ar", label: "No ar" },
];
const FILTROS_FORMATO = [
  { id: "todos", label: "Todos formatos" },
  { id: "video", label: "Vídeo" },
  { id: "imagem", label: "Imagem" },
  { id: "carrossel", label: "Carrossel" },
  { id: "catalogo", label: "Catálogo" },
];
const FILTROS_FUNIL = [
  { id: "todos", label: "Todos funis" },
  { id: "problema", label: "Problema" },
  { id: "solucao", label: "Solução" },
  { id: "produto", label: "Produto" },
  { id: "remarketing", label: "Remarketing" },
];

const norm = (v: string | null) =>
  (v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function CriativosPerformance() {
  const { dados, loading } = useCriativosUnificados();
  const [fStatus, setFStatus] = useState("todos");
  const [fFormato, setFFormato] = useState("todos");
  const [fFunil, setFFunil] = useState("todos");
  const [ordem, setOrdem] = useState("spend");

  const lista = useMemo(() => {
    const filtrados = dados.filter((c) => {
      if (fStatus === "com-meta" && !c.ad_id) return false;
      if (fStatus === "sem-anuncio" && c.ad_id) return false;
      if (!["todos", "com-meta", "sem-anuncio"].includes(fStatus) && norm(c.status) !== norm(fStatus)) return false;
      if (fFormato !== "todos") {
        const fmt = norm(c.formato);
        if (fFormato === "imagem" ? !(fmt === "imagem" || fmt === "image") : fmt !== fFormato) return false;
      }
      if (fFunil !== "todos") {
        if (fFunil === "remarketing") {
          if (!c.eh_remarketing && !norm(c.etapa_funil).includes("remarketing")) return false;
        } else if (!norm(c.etapa_funil).includes(fFunil)) return false;
      }
      return true;
    });

    const arr = [...filtrados];
    arr.sort((a, b) => {
      switch (ordem) {
        case "roas": return n(b.roas) - n(a.roas);
        case "score": return scoreUnificado(b) - scoreUnificado(a);
        case "recente": return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        case "status": return norm(a.status).localeCompare(norm(b.status));
        default: return n(b.spend) - n(a.spend);
      }
    });
    return arr;
  }, [dados, fStatus, fFormato, fFunil, ordem]);

  const comAnuncio = useMemo(() => dados.filter((c) => !!c.ad_id), [dados]);

  const kpis = useMemo(() => {
    const spend = comAnuncio.reduce((s, c) => s + n(c.spend), 0);
    const receita = comAnuncio.reduce((s, c) => s + n(c.purchase_value), 0);
    const cpms = comAnuncio.map((c) => c.cpm).filter((v) => v !== null && v !== undefined).map(Number);
    const scores = comAnuncio.map(scoreUnificado);
    return {
      roas: spend > 0 ? receita / spend : null,
      spend,
      cpm: cpms.length ? cpms.reduce((s, v) => s + v, 0) / cpms.length : null,
      score: scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null,
      criticos: comAnuncio.filter((c) => c.quality_ranking === "BELOW_AVERAGE_20" || c.quality_ranking === "BELOW_AVERAGE_10").length,
    };
  }, [comAnuncio]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[460px]" />)}</div>
      </div>
    );
  }

  const chips = (opcoes: { id: string; label: string }[], valor: string, set: (v: string) => void) =>
    opcoes.map((o) => (
      <Button
        key={o.id}
        size="sm"
        variant={valor === o.id ? "default" : "outline"}
        className="h-8 rounded-full"
        onClick={() => set(o.id)}
      >
        {o.label}
      </Button>
    ));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-[22px] font-normal">Criativos &amp; Performance</h2>
          <p className="text-xs text-[#7A7570]">Briefing · Produção · Rankings Meta</p>
        </div>
        <div className="flex gap-4 text-xs text-[#7A7570]">
          <span><b className="text-[#1A1815]">{dados.length}</b> criativos</span>
          <span><b className="text-[#2D6A4F]">{comAnuncio.length}</b> com anúncio ativo</span>
          <span><b className="text-[#1A1815]">{dados.length - comAnuncio.length}</b> sem anúncio</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-[#E8E4DC] bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">ROAS Médio</p>
          <p className={cn("mt-1 font-serif text-2xl", corRoas(n(kpis.roas)))}>{roasFmt(kpis.roas)}</p>
        </div>
        <div className="rounded-lg border border-[#E8E4DC] bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Total Investido</p>
          <p className="mt-1 font-serif text-2xl">{brl(kpis.spend)}</p>
        </div>
        <div className="rounded-lg border border-[#E8E4DC] bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">CPM Médio</p>
          <p className={cn("mt-1 font-serif text-2xl", n(kpis.cpm) > 25 && "text-[#B45309]")}>{brl(kpis.cpm)}</p>
        </div>
        <div className="rounded-lg border border-[#E8E4DC] bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Score Médio</p>
          <p className={cn("mt-1 font-serif text-2xl", corScore(n(kpis.score)))}>
            {kpis.score === null ? "—" : kpis.score.toFixed(1).replace(".", ",")}
          </p>
        </div>
        <div className="rounded-lg border border-[#E8E4DC] bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Criativos Críticos</p>
          <p className={cn("mt-1 font-serif text-2xl", kpis.criticos > 0 && "text-[#9B1C1C]")}>{kpis.criticos}</p>
        </div>
      </div>

      <BlocoInteligencia dados={dados} />

      <Legenda />


      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">Criativos ({lista.length})</CardTitle>
          <div className="flex flex-wrap gap-2">{chips(FILTROS_STATUS, fStatus, setFStatus)}</div>
          <div className="flex flex-wrap items-center gap-2">
            {chips(FILTROS_FORMATO, fFormato, setFFormato)}
            <span className="mx-1 h-5 w-px bg-border" />
            {chips(FILTROS_FUNIL, fFunil, setFFunil)}
            <Select value={ordem} onValueChange={setOrdem}>
              <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="spend">Maior gasto</SelectItem>
                <SelectItem value="roas">Melhor ROAS</SelectItem>
                <SelectItem value="score">Maior Score</SelectItem>
                <SelectItem value="recente">Mais recente</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {lista.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Nenhum criativo para estes filtros</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {lista.map((c) => <CardUnificado key={c.criativo_id} c={c} />)}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

