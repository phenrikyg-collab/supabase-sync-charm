import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Instagram } from "lucide-react";
import { cn } from "@/lib/utils";

// ===== Tipo =====
export interface CriativoUnificado {
  ad_id: string;
  ad_name: string | null;
  imagem: string | null;
  instagram_permalink: string | null;
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
  purchases: number | null;
  purchase_value: number | null;
  thumb_stop_rate: number | null;
  retencao_rate: number | null;
  cpa: number | null;
  frequency: number | null;
}

// ===== Rankings =====
export const RANKING_META: Record<string, { label: string; className: string }> = {
  ABOVE_AVERAGE: { label: "▲ Acima", className: "bg-[#EAF4EE] text-[#2D6A4F]" },
  AVERAGE: { label: "— Médio", className: "bg-[#F0EFED] text-[#5A5450]" },
  BELOW_AVERAGE_35: { label: "▼ −35%", className: "bg-[#FEF3E2] text-[#B45309]" },
  BELOW_AVERAGE_20: { label: "▼ −20%", className: "bg-[#FEE2E2] text-[#9B1C1C]" },
  BELOW_AVERAGE_10: { label: "▼ −10%", className: "bg-[#FECACA] text-[#6B0A0A]" },
};
const rankingInfo = (v: string | null | undefined) =>
  (v && RANKING_META[v]) || { label: "—", className: "bg-[#F0EFED] text-[#AAA59F]" };

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
const corScore = (s: number) => (s >= 7 ? "#2D6A4F" : s >= 5 ? "#B45309" : "#9B1C1C");
const bgScore = (s: number) => (s >= 7 ? "#EAF4EE" : s >= 5 ? "#FEF3E2" : "#FEE2E2");

// ===== Formatação =====
const num = (v: unknown) => (v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v));
const brl0 = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const brl2 = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dec = (v: number, c = 1) => v.toFixed(c).replace(".", ",");

const ICONE_FORMATO: Record<string, string> = { video: "🎬", imagem: "🖼️", carrossel: "🖼️", catalogo: "📦" };
const iconeFormato = (f: string | null) => ICONE_FORMATO[(f || "").toLowerCase()] || "📦";
const LABEL_FORMATO: Record<string, string> = { video: "Vídeo", imagem: "Imagem", carrossel: "Carrossel", catalogo: "Catálogo" };

const CRITICO = ["BELOW_AVERAGE_20", "BELOW_AVERAGE_10"];

// ===== Diagnóstico =====
function diagnostico(c: CriativoUnificado) {
  const roas = num(c.roas);
  const spend = num(c.spend);
  const q = c.quality_ranking;
  if (q && CRITICO.includes(q)) return { bg: "#FEE2E2", cor: "#9B1C1C", texto: "🚨 Substituir — qualidade crítica" };
  if (roas === 0 && spend > 200) return { bg: "#FEE2E2", cor: "#9B1C1C", texto: "💸 Sem retorno — revisar segmentação ou pausar" };
  if (q === "BELOW_AVERAGE_35" && roas > 5) return { bg: "#FEF3E2", cor: "#B45309", texto: "⚠️ Quality baixo mas converte — monitorar" };
  if (c.engagement_ranking === "ABOVE_AVERAGE" && c.conversion_ranking === "BELOW_AVERAGE_35")
    return { bg: "#FEF3E2", cor: "#B45309", texto: "⚡ Engaja mas não vende — revisar oferta" };
  if ((c.formato || "").toLowerCase() === "video" && num(c.thumb_stop_rate) < 15)
    return { bg: "#FEF3E2", cor: "#B45309", texto: "🎬 Hook fraco — testar novo início" };
  if (roas >= 5 && spend < 500) return { bg: "#EAF4EE", cor: "#2D6A4F", texto: "💰 Alto ROAS com baixo gasto — candidato a escalar" };
  if (roas >= 3) return { bg: "#EAF4EE", cor: "#2D6A4F", texto: "✅ Bom desempenho — escalar com cuidado" };
  return { bg: "#F0EFED", cor: "#7A7570", texto: "🔍 Dados insuficientes — aguardar mais veiculação" };
}

// ===== Sugestões fixas =====
const SUGESTOES = [
  {
    badge: "Reels · Aquisição",
    badgeClass: "bg-blue-100 text-blue-700",
    titulo: "Mais produtos em 1 vídeo",
    porque: "REELS - CALÇAS POR HORA tem ROAS 7.46x e hook 34.6% — maior ROAS de vídeo ativo.",
    gancho: "“Você não precisa escolher uma. Eu vou te mostrar as 3 que cabem no mesmo look.”",
  },
  {
    badge: "Imagem · Aquisição",
    badgeClass: "bg-green-100 text-green-700",
    titulo: "Imagem estática produto em destaque",
    porque: "Imagens têm ROAS médio 4.53x com CPM R$ 18 — mais barato do mix. IMGS CALCA ANNA gerou R$ 17.686.",
    gancho: "Visual limpo, fundo neutro, produto centralizado. Sem texto excessivo.",
  },
  {
    badge: "Carrossel · Remarketing",
    badgeClass: "bg-purple-100 text-purple-700",
    titulo: "Prova social: clientes reais usando",
    porque: "CARROSSEL - BLUSAS TRICOT tem ROAS 7.69x — melhor ROAS geral — com apenas R$ 199 investidos.",
    gancho: "Slide 1: “Elas já receberam.” Slides 2-5: fotos de clientes + depoimento curto.",
  },
  {
    badge: "Reels · Problema",
    badgeClass: "bg-orange-100 text-orange-700",
    titulo: "Hook de pergunta direta",
    porque: "Ângulo de problema com estrutura DSB tem engagement ABOVE_AVERAGE consistente e hook >30%.",
    gancho: "“Quantas calças você já comprou que perderam a forma em 3 meses?”",
  },
  {
    badge: "Reels · Conversão",
    badgeClass: "bg-emerald-200 text-emerald-900",
    titulo: "1 peça, 3 looks",
    porque: "REELS - 1 CALÇA TRÊS BLUSAS tem ROAS 3.36x em remarketing. Versatilidade converte base quente.",
    gancho: "“Uma calça. Manhã no trabalho, tarde casual, noite fashion.”",
  },
  {
    badge: "Catálogo · Aquisição",
    badgeClass: "bg-gray-200 text-gray-700",
    titulo: "Atualizar catálogo com novos produtos",
    porque: "CATALOGO - NOVO tem ROAS 7.13x. Catálogos dinâmicos funcionam para audiências frias.",
    gancho: "Garantir novos produtos do drop atual no feed do catálogo com imagens corretas.",
  },
];

const DIAGNOSTICOS = [
  { t: "📉 Quality baixo = CPM alto", d: "Criativos BELOW_AVERAGE pagam CPM até 40% maior." },
  { t: "⚡ Engaja mas não converte", d: "Engagement ABOVE + Conversion BELOW = problema na oferta ou landing." },
  { t: "🎬 Hook Rate ideal >25%", d: "Abaixo disso o início do vídeo não está funcionando." },
  { t: "🔁 Lives sem remarketing = gasto perdido", d: "Criar sequência nas 24h seguintes." },
  { t: "📊 Diversidade reduz CPM", d: "4+ criativos distintos por conjunto evita fadiga de público." },
  { t: "🏆 Escalar antes de criar", d: "Identificar o ROAS 7x+ com baixo spend e aumentar orçamento primeiro." },
];

// ===== Data hook =====
function useCriativosAtivos() {
  const [dados, setDados] = useState<CriativoUnificado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      try {
        const [infoRes, kpisRes, ranksRes] = await Promise.all([
          supabase
            .from("meta_ads_anuncios_info" as any)
            .select("ad_id, ad_name, thumbnail_url, image_url, instagram_permalink, status")
            .eq("status", "ACTIVE"),
          supabase.from("vw_meta_criativo_kpis" as any).select("*"),
          supabase
            .from("meta_ads_anuncios" as any)
            .select("ad_id, engagement_ranking, conversion_ranking")
            .not("engagement_ranking", "is", null),
        ]);

        if (!ativo) return;

        const info = (infoRes.data as any[]) || [];
        const kpis = (kpisRes.data as any[]) || [];
        const ranks = (ranksRes.data as any[]) || [];

        const mapaKpis = new Map<string, any>();
        kpis.forEach((k) => mapaKpis.set(String(k.ad_id), k));
        const mapaRanks = new Map<string, any>();
        ranks.forEach((r) => {
          const atual = mapaRanks.get(String(r.ad_id));
          if (!atual) mapaRanks.set(String(r.ad_id), r);
        });

        const linhas: CriativoUnificado[] = info
          .map((i) => {
            const k = mapaKpis.get(String(i.ad_id));
            if (!k) return null;
            if (num(k.impressions) <= 1000) return null;
            const r = mapaRanks.get(String(i.ad_id)) || {};
            return {
              ad_id: String(i.ad_id),
              ad_name: i.ad_name ?? null,
              imagem: i.thumbnail_url || i.image_url || null,
              instagram_permalink: i.instagram_permalink ?? null,
              formato: k.formato ?? null,
              tipo_funil: k.tipo_funil ?? null,
              conjunto: k.conjunto ?? null,
              quality_ranking: k.quality_ranking ?? null,
              engagement_ranking: r.engagement_ranking ?? null,
              conversion_ranking: r.conversion_ranking ?? null,
              impressions: k.impressions ?? null,
              spend: k.spend ?? null,
              roas: k.roas ?? null,
              cpm: k.cpm ?? null,
              ctr_link: k.ctr_link ?? null,
              purchases: k.purchases ?? null,
              purchase_value: k.purchase_value ?? null,
              thumb_stop_rate: k.thumb_stop_rate ?? null,
              retencao_rate: k.retencao_rate ?? null,
              cpa: k.cpa ?? null,
              frequency: k.frequency ?? null,
            } as CriativoUnificado;
          })
          .filter(Boolean) as CriativoUnificado[];

        linhas.sort((a, b) => num(b.spend) - num(a.spend));
        setDados(linhas);
      } catch {
        if (ativo) setDados([]);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  return { dados, loading };
}

// ===== Componentes auxiliares =====
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">{children}</p>;
}

function RankingBadge({ titulo, valor }: { titulo: string; valor: string | null }) {
  const info = rankingInfo(valor);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold", info.className)}>
      <span className="opacity-70">{titulo}:</span> {info.label}
    </span>
  );
}

function Metrica({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-[#7A7570]">{rotulo}</p>
      <p className="text-sm font-semibold" style={{ color: cor || "#1A1815" }}>
        {valor}
      </p>
    </div>
  );
}

// ===== Página =====
export function CriativosPerformance() {
  const { dados, loading } = useCriativosAtivos();
  const [aba, setAba] = useState<"acontecendo" | "sugestoes" | "diagnosticos">("acontecendo");
  const [filtro, setFiltro] = useState("todos");
  const [ordem, setOrdem] = useState("gasto");

  const kpis = useMemo(() => {
    const gasto = dados.reduce((s, c) => s + num(c.spend), 0);
    const receita = dados.reduce((s, c) => s + num(c.purchase_value), 0);
    const cpm = dados.length ? dados.reduce((s, c) => s + num(c.cpm), 0) / dados.length : 0;
    const score = dados.length ? dados.reduce((s, c) => s + scoreUnificado(c), 0) / dados.length : 0;
    const criticos = dados.filter((c) => c.quality_ranking && CRITICO.includes(c.quality_ranking)).length;
    return { gasto, receita, roas: gasto ? receita / gasto : 0, cpm, score, criticos };
  }, [dados]);

  const resumo = useMemo(() => {
    const porFormato = new Map<string, { spend: number; receita: number }>();
    dados.forEach((c) => {
      const f = (c.formato || "outro").toLowerCase();
      const a = porFormato.get(f) || { spend: 0, receita: 0 };
      a.spend += num(c.spend);
      a.receita += num(c.purchase_value);
      porFormato.set(f, a);
    });
    let formatoTop = "—";
    let roasTop = 0;
    porFormato.forEach((v, f) => {
      const r = v.spend ? v.receita / v.spend : 0;
      if (r > roasTop) {
        roasTop = r;
        formatoTop = LABEL_FORMATO[f] || f;
      }
    });
    const videos = dados.filter((c) => (c.formato || "").toLowerCase() === "video");
    const hookMedio = videos.length ? videos.reduce((s, c) => s + num(c.thumb_stop_rate), 0) / videos.length : 0;
    const semRetorno = dados.filter((c) => num(c.roas) === 0 && num(c.spend) > 200);
    const temAcima = dados.some((c) => c.quality_ranking === "ABOVE_AVERAGE");
    const topRoas = [...dados].sort((a, b) => num(b.roas) - num(a.roas)).slice(0, 3);
    const criticos = dados.filter((c) => c.quality_ranking && CRITICO.includes(c.quality_ranking));
    const escalar = [...dados]
      .filter((c) => num(c.spend) < 500 && num(c.roas) > 0)
      .sort((a, b) => num(b.roas) - num(a.roas))[0];
    const engajaNaoVende = dados.filter(
      (c) => c.engagement_ranking === "ABOVE_AVERAGE" && c.conversion_ranking === "BELOW_AVERAGE_35"
    );
    return { formatoTop, roasTop, hookMedio, semRetorno, temAcima, topRoas, criticos, escalar, engajaNaoVende };
  }, [dados]);

  const lista = useMemo(() => {
    let l = [...dados];
    const f = filtro;
    if (f !== "todos") {
      if (["video", "imagem", "carrossel", "catalogo"].includes(f)) {
        l = l.filter((c) => (c.formato || "").toLowerCase() === f);
      } else if (f === "remarketing") {
        l = l.filter((c) => (c.tipo_funil || "").toLowerCase().includes("remarket"));
      } else if (f === "aquisicao") {
        l = l.filter((c) => (c.tipo_funil || "").toLowerCase().startsWith("aquisi"));
      }
    }
    const cmp: Record<string, (a: CriativoUnificado, b: CriativoUnificado) => number> = {
      gasto: (a, b) => num(b.spend) - num(a.spend),
      roas: (a, b) => num(b.roas) - num(a.roas),
      score: (a, b) => scoreUnificado(b) - scoreUnificado(a),
      hook: (a, b) => num(b.thumb_stop_rate) - num(a.thumb_stop_rate),
      impressoes: (a, b) => num(b.impressions) - num(a.impressions),
    };
    return l.sort(cmp[ordem] || cmp.gasto);
  }, [dados, filtro, ordem]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-xl bg-[#F7F5F2] p-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-[22px] font-normal text-[#1A1815]">Criativos &amp; Performance</h2>
          <p className="text-xs text-[#7A7570]">Anúncios ativos · Meta Ads · Atualizado via Supabase</p>
        </div>
        <div className="text-right">
          <Label>Anúncios ativos</Label>
          <p className="font-serif text-2xl text-[#1A1815]">{dados.length}</p>
        </div>
      </div>

      {/* Bloco de inteligência */}
      <div className="rounded-xl border border-[#E8E4DC] bg-[#FAFAF8] p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {([
            ["acontecendo", "🔍 O que está acontecendo"],
            ["sugestoes", "💡 Sugestões"],
            ["diagnosticos", "⚡ Diagnósticos"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                aba === id
                  ? "border-[#C9A84C] bg-[#C9A84C] text-white"
                  : "border-[#E8E4DC] bg-white text-[#7A7570] hover:text-[#1A1815]"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {aba === "acontecendo" && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[#1A1815]">
              {dados.length} anúncios ativos. Melhor formato por ROAS: {resumo.formatoTop} ({dec(resumo.roasTop, 2)}x).{" "}
              {resumo.temAcima
                ? "Há criativos no ranking ABOVE_AVERAGE de qualidade"
                : "Nenhum criativo chegou ao ranking ABOVE_AVERAGE de qualidade"}{" "}
              — CPM médio de {brl2(kpis.cpm)}. Hook rate médio dos vídeos: {dec(resumo.hookMedio)}%.{" "}
              {resumo.semRetorno.length} anúncios com gasto acima de R$ 200 e ROAS zero.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border-l-4 border-l-[#2D6A4F] border border-[#E8E4DC] bg-white p-4">
                <p className="mb-2 text-xs font-bold text-[#2D6A4F]">✅ O que está convertendo</p>
                <ul className="space-y-1 text-xs text-[#1A1815]">
                  {resumo.topRoas.map((c) => (
                    <li key={c.ad_id} className="flex justify-between gap-2">
                      <span className="truncate">{c.ad_name}</span>
                      <span className="whitespace-nowrap text-[#7A7570]">
                        {dec(num(c.roas), 2)}x · {LABEL_FORMATO[(c.formato || "").toLowerCase()] || c.formato}
                      </span>
                    </li>
                  ))}
                  {!resumo.topRoas.length && <li className="text-[#7A7570]">Sem dados.</li>}
                </ul>
                <p className="mt-2 text-[11px] text-[#7A7570]">
                  Padrão: reels com múltiplos produtos e hook rate acima de 30%.
                </p>
              </div>

              <div className="rounded-lg border-l-4 border-l-[#9B1C1C] border border-[#E8E4DC] bg-white p-4">
                <p className="mb-2 text-xs font-bold text-[#9B1C1C]">🚨 Atenção imediata</p>
                <ul className="space-y-1 text-xs text-[#1A1815]">
                  {resumo.criticos.map((c) => (
                    <li key={c.ad_id} className="flex justify-between gap-2">
                      <span className="truncate">{c.ad_name}</span>
                      <span className="whitespace-nowrap text-[#9B1C1C]">{rankingInfo(c.quality_ranking).label} qualidade</span>
                    </li>
                  ))}
                  {resumo.semRetorno.map((c) => (
                    <li key={`sr-${c.ad_id}`} className="flex justify-between gap-2">
                      <span className="truncate">{c.ad_name}</span>
                      <span className="whitespace-nowrap text-[#9B1C1C]">{brl0(num(c.spend))} · ROAS 0</span>
                    </li>
                  ))}
                  {!resumo.criticos.length && !resumo.semRetorno.length && (
                    <li className="text-[#7A7570]">Nenhum alerta crítico.</li>
                  )}
                </ul>
              </div>

              <div className="rounded-lg border-l-4 border-l-[#C9A84C] border border-[#E8E4DC] bg-white p-4">
                <p className="mb-2 text-xs font-bold text-[#C9A84C]">💰 Candidato a escalar</p>
                {resumo.escalar ? (
                  <div className="text-xs text-[#1A1815]">
                    <p className="font-semibold">{resumo.escalar.ad_name}</p>
                    <p className="text-[#7A7570]">
                      ROAS {dec(num(resumo.escalar.roas), 2)}x · gasto {brl0(num(resumo.escalar.spend))}
                    </p>
                    <p className="mt-1 text-[11px] text-[#7A7570]">
                      Alto retorno com investimento baixo — candidato prioritário para escalar orçamento.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[#7A7570]">Nenhum candidato no momento.</p>
                )}
              </div>

              <div className="rounded-lg border-l-4 border-l-[#B45309] border border-[#E8E4DC] bg-white p-4">
                <p className="mb-2 text-xs font-bold text-[#B45309]">⚠️ Engaja mas não vende</p>
                <ul className="space-y-1 text-xs text-[#1A1815]">
                  {resumo.engajaNaoVende.map((c) => (
                    <li key={c.ad_id} className="truncate">
                      {c.ad_name} <span className="text-[#7A7570]">· ROAS {dec(num(c.roas), 2)}x</span>
                    </li>
                  ))}
                  {!resumo.engajaNaoVende.length && <li className="text-[#7A7570]">Nenhum caso identificado.</li>}
                </ul>
                <p className="mt-2 text-[11px] text-[#7A7570]">
                  Ação: revisar oferta, preço e página de destino — o criativo já prende atenção.
                </p>
              </div>
            </div>
          </div>
        )}

        {aba === "sugestoes" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SUGESTOES.map((s) => (
              <div key={s.titulo} className="rounded-lg border border-[#E8E4DC] bg-white p-4">
                <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold", s.badgeClass)}>
                  {s.badge}
                </span>
                <p className="mt-2 text-sm font-semibold text-[#1A1815]">{s.titulo}</p>
                <p className="mt-2 text-[11px] text-[#7A7570]">
                  <span className="font-semibold text-[#1A1815]">Por que funciona:</span> {s.porque}
                </p>
                <p className="mt-2 text-[11px] text-[#7A7570]">
                  <span className="font-semibold text-[#1A1815]">Gancho:</span> {s.gancho}
                </p>
              </div>
            ))}
          </div>
        )}

        {aba === "diagnosticos" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DIAGNOSTICOS.map((d) => (
              <div key={d.t} className="rounded-lg border border-[#E8E4DC] bg-white p-4">
                <p className="text-sm font-semibold text-[#1A1815]">{d.t}</p>
                <p className="mt-1 text-[11px] text-[#7A7570]">{d.d}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            t: "ROAS Médio Ponderado",
            v: `${dec(kpis.roas, 2)}x`,
            c: kpis.roas >= 3 ? "#2D6A4F" : kpis.roas >= 1.5 ? "#B45309" : "#9B1C1C",
          },
          { t: "Total Investido", v: brl0(kpis.gasto), c: "#1A1815" },
          { t: "CPM Médio", v: brl2(kpis.cpm), c: kpis.cpm > 25 ? "#B45309" : "#1A1815" },
          { t: "Score Médio", v: dec(kpis.score), c: corScore(kpis.score) },
          { t: "Anúncios Críticos", v: String(kpis.criticos), c: kpis.criticos > 0 ? "#9B1C1C" : "#1A1815" },
        ].map((k) => (
          <div key={k.t} className="rounded-lg border border-[#E8E4DC] bg-white p-4">
            <Label>{k.t}</Label>
            <p className="mt-1 font-serif text-xl" style={{ color: k.c }}>
              {k.v}
            </p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {([
            ["todos", "Todos"],
            ["video", "Vídeo"],
            ["imagem", "Imagem"],
            ["carrossel", "Carrossel"],
            ["catalogo", "Catálogo"],
            ["remarketing", "Remarketing"],
            ["aquisicao", "Aquisição"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFiltro(id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                filtro === id
                  ? "border-[#1A1815] bg-[#1A1815] text-white"
                  : "border-[#E8E4DC] bg-white text-[#7A7570] hover:text-[#1A1815]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Select value={ordem} onValueChange={setOrdem}>
          <SelectTrigger className="w-52 bg-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gasto">Maior gasto</SelectItem>
            <SelectItem value="roas">Melhor ROAS</SelectItem>
            <SelectItem value="score">Maior Score</SelectItem>
            <SelectItem value="hook">Maior Hook Rate</SelectItem>
            <SelectItem value="impressoes">Mais impressões</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid de cards */}
      {!lista.length ? (
        <div className="rounded-lg border border-[#E8E4DC] bg-white p-10 text-center text-sm text-[#7A7570]">
          Nenhum anúncio ativo encontrado com os filtros selecionados.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lista.map((c) => {
            const s = scoreUnificado(c);
            const diag = diagnostico(c);
            const roas = num(c.roas);
            const video = (c.formato || "").toLowerCase() === "video";
            return (
              <div key={c.ad_id} className="overflow-hidden rounded-xl border border-[#E8E4DC] bg-white">
                {/* Imagem */}
                <div className="relative h-[200px] w-full bg-[#F0EFED]">
                  {c.imagem ? (
                    <img src={c.imagem} alt={c.ad_name || "Criativo"} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">{iconeFormato(c.formato)}</div>
                  )}
                  <div
                    className="absolute right-2 top-2 rounded-lg px-2 py-1 text-base font-bold"
                    style={{ background: bgScore(s), color: corScore(s) }}
                  >
                    {dec(s)}
                  </div>
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                    {LABEL_FORMATO[(c.formato || "").toLowerCase()] || c.formato || "—"}
                  </span>
                  {c.instagram_permalink && (
                    <a
                      href={c.instagram_permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute bottom-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                    >
                      <Instagram className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <p className="truncate text-sm font-bold text-[#1A1815]">{c.ad_name || "Sem nome"}</p>
                    <p className="text-[10px] text-[#7A7570]">
                      {c.conjunto || "—"} · {c.tipo_funil || "—"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <RankingBadge titulo="Quality" valor={c.quality_ranking} />
                    <RankingBadge titulo="Engagement" valor={c.engagement_ranking} />
                    <RankingBadge titulo="Conversion" valor={c.conversion_ranking} />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: corScore(s) }}>
                      {dec(s)}
                    </span>
                    <div className="h-1.5 flex-1 rounded-full bg-[#F0EFED]">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, (s / 10) * 100)}%`, background: corScore(s) }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-y-3">
                    <Metrica
                      rotulo="ROAS"
                      valor={roas === 0 ? "—" : `${dec(roas, 2)}x`}
                      cor={roas === 0 ? "#9B1C1C" : roas >= 3 ? "#2D6A4F" : roas >= 1.5 ? "#B45309" : "#9B1C1C"}
                    />
                    <Metrica rotulo="CPM" valor={brl2(num(c.cpm))} cor={num(c.cpm) > 28 ? "#B45309" : undefined} />
                    <Metrica rotulo="Gasto" valor={brl0(num(c.spend))} />
                    <Metrica
                      rotulo="Hook 3s"
                      valor={`${dec(num(c.thumb_stop_rate))}%`}
                      cor={num(c.thumb_stop_rate) === 0 ? "#7A7570" : num(c.thumb_stop_rate) >= 25 ? "#2D6A4F" : undefined}
                    />
                    <Metrica
                      rotulo="Retenção"
                      valor={`${dec(num(c.retencao_rate))}%`}
                      cor={num(c.retencao_rate) === 0 ? "#7A7570" : undefined}
                    />
                    <Metrica
                      rotulo="Compras"
                      valor={String(Math.round(num(c.purchases)))}
                      cor={num(c.purchases) === 0 ? "#7A7570" : undefined}
                    />
                  </div>
                  {!video && null}
                </div>

                <div className="px-4 py-2 text-[10px] font-medium" style={{ background: diag.bg, color: diag.cor }}>
                  {diag.texto}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CriativosPerformance;
