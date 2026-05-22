import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callClaude } from "@/lib/claudeApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, Eye, Heart, Bookmark, Share2, Users, Sparkles,
  TrendingUp, TrendingDown, Film, Images, RefreshCw, Lightbulb, Play, Pause, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface IGPost {
  media_id: string;
  caption: string | null;
  media_type: string | null;
  reach: number | null;
  engagement: number | null;
  saved: number | null;
  shares: number | null;
  video_views: number | null;
  data_publicacao: string | null;
}

interface IGPerfil {
  data_extracao: string;
  followers_count: number;
}

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR").format(Number(n || 0));

const truncate = (s: string | null, n = 80) =>
  !s ? "—" : s.length > n ? s.slice(0, n) + "…" : s;

const isReel = (t: string | null) =>
  (t || "").toUpperCase().includes("REEL") || (t || "").toUpperCase() === "VIDEO";
const isCarousel = (t: string | null) =>
  (t || "").toUpperCase().includes("CAROUSEL");

function KpiCard({
  title, value, icon: Icon, subtitle,
}: { title: string; value: string; icon: any; subtitle?: string }) {
  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-slate-100 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{title}</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
              {value}
            </p>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
          <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-400">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketingAnalytics() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<IGPost[]>([]);
  const [perfil, setPerfil] = useState<IGPerfil[]>([]);
  const [insights, setInsights] = useState<string>("");
  const [recomendacoes, setRecomendacoes] = useState<string>("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingRec, setLoadingRec] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, pf] = await Promise.all([
        supabase
          .from("instagram_posts" as any)
          .select("media_id,caption,media_type,reach,engagement,saved,shares,video_views,data_publicacao")
          .order("data_publicacao", { ascending: false })
          .limit(500),
        supabase
          .from("instagram_perfil_semanal" as any)
          .select("data_extracao,followers_count")
          .order("data_extracao", { ascending: false })
          .limit(20),
      ]);
      if (p.error) throw p.error;
      if (pf.error) throw pf.error;
      setPosts((p.data as any) || []);
      setPerfil((pf.data as any) || []);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const kpis = useMemo(() => {
    const reach = posts.reduce((s, p) => s + (p.reach || 0), 0);
    const eng = posts.reduce((s, p) => s + (p.engagement || 0), 0);
    const saved = posts.reduce((s, p) => s + (p.saved || 0), 0);
    const shares = posts.reduce((s, p) => s + (p.shares || 0), 0);
    const engMedio = posts.length ? Math.round(eng / posts.length) : 0;
    return { reach, engMedio, saved, shares };
  }, [posts]);

  const followersAtual = perfil[0]?.followers_count || 0;
  const followersAnterior = perfil[1]?.followers_count || 0;
  const followersDelta = followersAtual - followersAnterior;

  const ranked = useMemo(() => {
    return [...posts].sort(
      (a, b) => (b.engagement || 0) + (b.reach || 0) - ((a.engagement || 0) + (a.reach || 0))
    );
  }, [posts]);
  const top5 = ranked.slice(0, 5);
  const bottom5 = ranked.slice(-5).reverse();

  const compareData = useMemo(() => {
    const reels = posts.filter((p) => isReel(p.media_type));
    const carros = posts.filter((p) => isCarousel(p.media_type));
    const avg = (arr: IGPost[], key: keyof IGPost) =>
      arr.length ? Math.round(arr.reduce((s, p) => s + (Number(p[key]) || 0), 0) / arr.length) : 0;
    return [
      { tipo: "Reels", Alcance: avg(reels, "reach"), Engajamento: avg(reels, "engagement"), Salvos: avg(reels, "saved"), Compart: avg(reels, "shares") },
      { tipo: "Carrosséis", Alcance: avg(carros, "reach"), Engajamento: avg(carros, "engagement"), Salvos: avg(carros, "saved"), Compart: avg(carros, "shares") },
    ];
  }, [posts]);

  const buildContext = () => {
    const t = top5.map((p, i) => `${i + 1}. [${p.media_type}] reach=${p.reach} eng=${p.engagement} saved=${p.saved} | ${truncate(p.caption, 120)}`).join("\n");
    const b = bottom5.map((p, i) => `${i + 1}. [${p.media_type}] reach=${p.reach} eng=${p.engagement} | ${truncate(p.caption, 120)}`).join("\n");
    return `KPIs: Alcance total ${kpis.reach}, Engajamento médio ${kpis.engMedio}, Salvos ${kpis.saved}, Shares ${kpis.shares}.
Seguidores atuais: ${followersAtual} (variação semana: ${followersDelta}).
Reels x Carrosséis (médias): ${JSON.stringify(compareData)}.

TOP 5 posts:
${t}

PIORES 5 posts:
${b}`;
  };

  const gerarInsights = async () => {
    setLoadingAI(true);
    try {
      const ctx = buildContext();
      const prompt = `Você é estrategista de marketing da Mariana Cardoso (moda feminina premium, alfaiataria e tecidos nobres). O posicionamento NÃO é vender "calças" — é fazer a cliente desejar fazer parte do universo Mariana Cardoso (storytelling, aspiração, comunidade, exclusividade, qualidade e técnica).

Analise os dados abaixo e gere um diagnóstico em markdown com seções:
## 🌟 O que está funcionando
## ⚠️ O que não está funcionando
## 🎯 Padrões identificados (formato, tema, gancho, CTA)
## 💡 Hipóteses estratégicas
Seja específico, cite números e exemplos de legendas. Evite genéricos.

DADOS:
${ctx}`;
      const r = await callClaude(prompt);
      setInsights(r);
    } catch (e: any) {
      setInsights(`Erro ao gerar insights: ${e?.message}`);
    } finally {
      setLoadingAI(false);
    }
  };

  const gerarRecomendacoes = async () => {
    setLoadingRec(true);
    try {
      const ctx = buildContext();
      const prompt = `Você é diretora de conteúdo da Mariana Cardoso (moda premium, alfaiataria). Posicionamento: universo aspiracional, NÃO descontos. Foque em storytelling, comunidade, exclusividade, qualidade de tecidos e técnica.

Com base nos dados, entregue um plano em markdown:
## ✅ Continuar (formatos/temas que performam)
## ⏸️ Pausar ou ajustar (o que não vale o esforço)
## 🚀 Próximas oportunidades (5 ideias concretas de pauta — com gancho, formato sugerido e CTA aspiracional)
## 📅 Cadência recomendada (semanal por formato)

Cada ideia precisa ter título, descrição em 1-2 linhas e por que se conecta ao universo da marca.

DADOS:
${ctx}`;
      const r = await callClaude(prompt);
      setRecomendacoes(r);
    } catch (e: any) {
      setRecomendacoes(`Erro: ${e?.message}`);
    } finally {
      setLoadingRec(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 -m-6 p-6 text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-transparent">
            Marketing Analytics · Instagram
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Performance do universo Mariana Cardoso em tempo real
          </p>
        </div>
        <Button onClick={loadData} variant="outline" className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 bg-slate-800" />)
        ) : (
          <>
            <KpiCard title="Alcance Total" value={fmt(kpis.reach)} icon={Eye} subtitle={`${posts.length} posts analisados`} />
            <KpiCard title="Engajamento Médio" value={fmt(kpis.engMedio)} icon={Heart} subtitle="por post" />
            <KpiCard title="Salvamentos" value={fmt(kpis.saved)} icon={Bookmark} subtitle="sinal de desejo" />
            <KpiCard title="Compartilhamentos" value={fmt(kpis.shares)} icon={Share2} subtitle="amplificação" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-lg bg-amber-500/10 p-3 text-amber-400"><Users className="h-6 w-6" /></div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Seguidores</p>
              <p className="text-2xl font-bold text-slate-100">{fmt(followersAtual)}</p>
              <p className={`text-xs flex items-center gap-1 ${followersDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {followersDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {followersDelta >= 0 ? "+" : ""}{fmt(followersDelta)} vs semana anterior
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-lg bg-amber-500/10 p-3 text-amber-400"><BarChart3 className="h-6 w-6" /></div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Taxa Engajamento</p>
              <p className="text-2xl font-bold text-slate-100">
                {followersAtual ? ((kpis.engMedio / followersAtual) * 100).toFixed(2) : "0"}%
              </p>
              <p className="text-xs text-slate-400">engajamento médio / seguidores</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="overview" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">Visão Geral</TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">Performance por Tipo</TabsTrigger>
          <TabsTrigger value="insights" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">Insights IA</TabsTrigger>
          <TabsTrigger value="recs" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">Recomendações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PostList title="Top 5 posts" icon={TrendingUp} posts={top5} accent="emerald" />
            <PostList title="Posts com baixo desempenho" icon={TrendingDown} posts={bottom5} accent="rose" />
          </div>
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <Film className="h-5 w-5 text-amber-400" /> Reels <span className="text-slate-500">vs</span> <Images className="h-5 w-5 text-amber-400" /> Carrosséis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="tipo" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="Alcance" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Engajamento" fill="#fb923c" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Salvos" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Compart" fill="#fdba74" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="mt-4">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" /> Análise estratégica com IA
              </CardTitle>
              <Button onClick={gerarInsights} disabled={loadingAI || loading} className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 hover:opacity-90">
                {loadingAI ? "Analisando..." : "Gerar análise"}
              </Button>
            </CardHeader>
            <CardContent>
              {insights ? (
                <article className="prose prose-invert prose-amber max-w-none whitespace-pre-wrap text-slate-200">
                  {insights}
                </article>
              ) : (
                <p className="text-slate-400 text-sm">Clique em "Gerar análise" para receber um diagnóstico estratégico baseado nos dados atuais.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recs" className="mt-4">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-400" /> O que continuar, pausar e próximas oportunidades
              </CardTitle>
              <Button onClick={gerarRecomendacoes} disabled={loadingRec || loading} className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 hover:opacity-90">
                {loadingRec ? "Gerando..." : "Gerar recomendações"}
              </Button>
            </CardHeader>
            <CardContent>
              {recomendacoes ? (
                <article className="prose prose-invert prose-amber max-w-none whitespace-pre-wrap text-slate-200">
                  {recomendacoes}
                </article>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300 text-sm">
                  <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/40">
                    <Play className="h-5 w-5 text-emerald-400 mb-2" />
                    <p className="font-semibold">Continuar</p>
                    <p className="text-slate-400 text-xs mt-1">Formatos e temas com melhor performance.</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/40">
                    <Pause className="h-5 w-5 text-amber-400 mb-2" />
                    <p className="font-semibold">Pausar</p>
                    <p className="text-slate-400 text-xs mt-1">O que não vale o esforço hoje.</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 p-4 bg-slate-900/40">
                    <Target className="h-5 w-5 text-orange-400 mb-2" />
                    <p className="font-semibold">Oportunidades</p>
                    <p className="text-slate-400 text-xs mt-1">Próximas pautas alinhadas ao universo MC.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PostList({
  title, icon: Icon, posts, accent,
}: { title: string; icon: any; posts: IGPost[]; accent: "emerald" | "rose" }) {
  const dot = accent === "emerald" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <Card className="bg-slate-900/60 border-slate-800">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2 text-base">
          <Icon className={`h-4 w-4 ${accent === "emerald" ? "text-emerald-400" : "text-rose-400"}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {posts.length === 0 && <p className="text-slate-500 text-sm">Sem dados.</p>}
        {posts.map((p, i) => (
          <div key={p.media_id || i} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 hover:border-amber-500/40 transition-colors">
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-2 w-2 rounded-full ${dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 uppercase tracking-wider">
                  {p.media_type || "POST"} {p.data_publicacao ? `· ${new Date(p.data_publicacao).toLocaleDateString("pt-BR")}` : ""}
                </p>
                <p className="text-sm text-slate-200 mt-1 line-clamp-2">{truncate(p.caption, 140)}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(p.reach)}</span>
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{fmt(p.engagement)}</span>
                  <span className="flex items-center gap-1"><Bookmark className="h-3 w-3" />{fmt(p.saved)}</span>
                  <span className="flex items-center gap-1"><Share2 className="h-3 w-3" />{fmt(p.shares)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
