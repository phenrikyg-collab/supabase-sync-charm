import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertCircle, Zap, Target, ArrowUp, ArrowDown, Sparkles, RefreshCw, ChevronDown, Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { useToast } from '@/hooks/use-toast';

interface Post {
  id: string;
  media_id: string;
  media_type: string;
  caption: string;
  data_publicacao: string;
  reach: number;
  saved: number;
  shares: number;
  engagement: number;
  video_views: number;
  data_extracao?: string;
  permalink?: string;
  media_url?: string;
  thumbnail_url?: string;
}

const MEDIA_ICON: Record<string, string> = {
  REELS: '▶',
  CAROUSEL_ALBUM: '⊞',
  IMAGE: '🖼',
  VIDEO: '▶',
};

// ===== Paleta =====
const C = {
  bg: '#FAF8F3',
  card: '#FFFFFF',
  text: '#1D1D1B',
  textSec: '#6B6B69',
  gold: '#E8CD7E',
  bronze: '#8B6914',
  border: '#E8E6E0',
  green: '#2D7A4F',
  red: '#C0392B',
  blue: '#4A90D9',
  tabBg: '#F0EDE6',
};

const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;
const pctVar = (atual: number, anterior: number) => {
  if (!anterior) return 0;
  return ((atual - anterior) / anterior) * 100;
};

const PERIODOS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 60, label: '60 dias' },
  { value: 90, label: '90 dias' },
];

export default function MarketingAnalytics() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsAnteriores, setPostsAnteriores] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [error, setError] = useState('');
  const [periodoDias, setPeriodoDias] = useState(30);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState('');
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [enviados, setEnviados] = useState<Set<string>>(new Set());
  const [openCaption, setOpenCaption] = useState<Record<string, boolean>>({});
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const [posts60, setPosts60] = useState<any[]>([]);
  const [posts56, setPosts56] = useState<any[]>([]);
  const [analiseConteudo, setAnaliseConteudo] = useState<any>(null);
  const [loadingNovaAnalise, setLoadingNovaAnalise] = useState(false);

  useEffect(() => {
    fetchData();
  }, [periodoDias]);

  const fetchData = async () => {
    try {
      setError('');
      setLoading(true);

      const inicio = new Date();
      inicio.setDate(inicio.getDate() - periodoDias);
      const inicioStr = inicio.toISOString().split('T')[0];

      const anterior = new Date();
      anterior.setDate(anterior.getDate() - periodoDias * 2);
      const anteriorStr = anterior.toISOString().split('T')[0];

      const { data: postsData, error: postsError } = await supabase
        .from('instagram_posts')
        .select('*')
        .gte('data_publicacao', inicioStr)
        .order('reach', { ascending: false })
        .limit(200);

      if (postsError) throw postsError;

      const { data: postsAntData } = await supabase
        .from('instagram_posts')
        .select('*')
        .gte('data_publicacao', anteriorStr)
        .lt('data_publicacao', inicioStr)
        .limit(200);

      setPosts(postsData || []);
      setPostsAnteriores(postsAntData || []);
      if (postsData && postsData.length > 0) {
        setUltimaAtualizacao(postsData[0]?.data_extracao || '');
        generateInsights(postsData);
      }
    } catch (err: any) {
      setError('Erro ao carregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async (postsData: Post[]) => {
    try {
      const topPosts = [...postsData].sort((a, b) => (b.reach || 0) - (a.reach || 0)).slice(0, 5);
      const lowPosts = [...postsData].sort((a, b) => (a.reach || 0) - (b.reach || 0)).slice(0, 3);
      const reels = postsData.filter(p => p.media_type === 'REELS');
      const carrosseis = postsData.filter(p => p.media_type === 'CAROUSEL_ALBUM');
      const avgEngagement = postsData.reduce((s, p) => s + (p.engagement || 0), 0) / postsData.length;

      const prompt = `Você é especialista em marketing digital para marcas premium de moda.

CONTEXTO DA MARCA:
Mariana Cardoso é uma marca de moda premium brasileira.
Posicionamento: a cliente não pensa "vou comprar uma calça" — ela pensa "quero fazer parte do universo Mariana Cardoso".
Compete por ASPIRAÇÃO e PERTENCIMENTO, não por preço.

DADOS:
Total de posts: ${postsData.length}
Reels: ${reels.length} | Carrosséis: ${carrosseis.length}
Engajamento médio: ${avgEngagement.toFixed(0)}
Alcance médio Reels: ${Math.round(reels.reduce((s,p) => s+(p.reach||0),0)/Math.max(reels.length,1)).toLocaleString()}
Alcance médio Carrosséis: ${Math.round(carrosseis.reduce((s,p) => s+(p.reach||0),0)/Math.max(carrosseis.length,1)).toLocaleString()}

TOP 5 POSTS:
${topPosts.map((p,i) => `${i+1}. [${p.media_type}] Alcance: ${p.reach?.toLocaleString()} | "${p.caption?.substring(0,80)}"`).join('\n')}

MENOR PERFORMANCE:
${lowPosts.map((p,i) => `${i+1}. [${p.media_type}] Alcance: ${p.reach?.toLocaleString()} | "${p.caption?.substring(0,80)}"`).join('\n')}

Gere análise estratégica em 4 seções: O QUE ESTÁ FUNCIONANDO, O QUE NÃO ESTÁ PERFORMANDO, OPORTUNIDADES ESTRATÉGICAS, RECOMENDAÇÕES DE PARADA. Máximo 600 palavras.`;

      const data = await invokeEdgeFunction('marketing-insights', { prompt });
      setInsights(data.insights || 'Erro ao gerar insights.');
    } catch (err: any) {
      console.error('Erro insights:', err);
      setInsights('Erro ao conectar com IA. Tente recarregar a página.');
    }
  };

  const handleAtualizarAnalise = async () => {
    setLoadingAnalise(true);
    try {
      // Edge function `marketing-content-suggestions` ainda não existe — placeholder
      await new Promise(r => setTimeout(r, 800));
      toast({
        title: 'Função pendente',
        description: 'A edge function marketing-content-suggestions ainda não foi criada. UI pronta para integração.',
      });
    } finally {
      setLoadingAnalise(false);
    }
  };

  const handleEnviarMatriz = async (id: string) => {
    setEnviados(prev => new Set(prev).add(id));
    try {
      await (supabase as any).from('conteudos_gerados').update({ status: 'em_revisao' }).eq('id', id);
      toast({ title: '✓ Enviado para a Matriz Criativa!' });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message });
    }
  };

  const fetchSugestoes = async () => {
    const { data } = await (supabase as any)
      .from('conteudos_gerados')
      .select('id, canal, copy_principal, copy_legenda, copy_cta, metadados, status, created_at, origem')
      .eq('origem', 'analise_performance')
      .order('created_at', { ascending: false })
      .limit(6);
    if (data) setSugestoes(data);
  };

  useEffect(() => { fetchSugestoes(); }, []);


  // ===== Métricas =====
  const isEmpty = posts.length === 0;
  const reelsData = posts.filter(p => p.media_type === 'REELS');
  const carrosselData = posts.filter(p => p.media_type === 'CAROUSEL_ALBUM');
  const topPosts = posts.slice(0, 5);
  const lowPosts = posts.slice().sort((a, b) => (a.reach || 0) - (b.reach || 0)).slice(0, 3);

  const totalReach = posts.reduce((s, p) => s + (p.reach || 0), 0);
  const totalEngagement = posts.reduce((s, p) => s + (p.engagement || 0), 0);
  const totalSaved = posts.reduce((s, p) => s + (p.saved || 0), 0);
  const totalShares = posts.reduce((s, p) => s + (p.shares || 0), 0);

  const prevReach = postsAnteriores.reduce((s, p) => s + (p.reach || 0), 0);
  const prevEng = postsAnteriores.reduce((s, p) => s + (p.engagement || 0), 0);
  const prevSaved = postsAnteriores.reduce((s, p) => s + (p.saved || 0), 0);
  const prevShares = postsAnteriores.reduce((s, p) => s + (p.shares || 0), 0);

  const chartData = [
    {
      name: 'Reels',
      Alcance: Math.round(reelsData.reduce((s, p) => s + (p.reach || 0), 0) / Math.max(reelsData.length, 1)),
      Engajamento: Math.round(reelsData.reduce((s, p) => s + (p.engagement || 0), 0) / Math.max(reelsData.length, 1)),
    },
    {
      name: 'Carrosséis',
      Alcance: Math.round(carrosselData.reduce((s, p) => s + (p.reach || 0), 0) / Math.max(carrosselData.length, 1)),
      Engajamento: Math.round(carrosselData.reduce((s, p) => s + (p.engagement || 0), 0) / Math.max(carrosselData.length, 1)),
    },
  ];
  const pieData = [
    { name: 'Reels', value: reelsData.length },
    { name: 'Carrosséis', value: carrosselData.length },
  ];

  // ===== Mix placeholder (até backend popular) =====
  const mixAtual = { lifestyle: 0, educacional: 0, produto: 0 };
  const mixMeta = { lifestyle: 70, educacional: 20, produto: 10 };
  const diagnosticoMix = 'Conecte a edge function marketing-content-suggestions para receber o diagnóstico automático do mix de conteúdo.';
  const insightSemana = 'Aguardando análise da IA. A comparação semanal aparecerá aqui assim que o backend estiver populado.';

  // ===== Comparativo (real, baseado nos dois períodos) =====
  const comparativo = [
    { metrica: 'Posts publicados', ant: postsAnteriores.length, atual: posts.length },
    { metrica: 'Alcance total', ant: prevReach, atual: totalReach },
    { metrica: 'Engajamento', ant: Math.round(prevEng), atual: Math.round(totalEngagement) },
    { metrica: 'Salvamentos', ant: prevSaved, atual: totalSaved },
    { metrica: 'Compartilhamentos', ant: prevShares, atual: totalShares },
    {
      metrica: 'Taxa de engajamento',
      ant: prevReach ? (prevEng / prevReach) * 100 : 0,
      atual: totalReach ? (totalEngagement / totalReach) * 100 : 0,
      isPct: true,
    },
  ];

  // ===== Performance por formato (mesmos períodos) =====
  const FORMATO_META: Record<string, { label: string; icon: string; cor: string }> = {
    REELS: { label: 'Reels', icon: '▶', cor: '#7C3AED' },
    CAROUSEL_ALBUM: { label: 'Carrossel', icon: '⊞', cor: '#4A90D9' },
    IMAGE: { label: 'Post Fixo', icon: '🖼', cor: '#8B6914' },
  };
  const aggByFormato = (list: Post[], type: string) => {
    const arr = list.filter(p => p.media_type === type);
    return {
      alcance: arr.reduce((s, p) => s + (p.reach || 0), 0),
      engajamento: arr.reduce((s, p) => s + (p.engagement || 0), 0),
    };
  };
  const formatos = ['REELS', 'CAROUSEL_ALBUM', 'IMAGE'].map(t => ({
    type: t,
    ...FORMATO_META[t],
    ant: aggByFormato(postsAnteriores, t),
    atual: aggByFormato(posts, t),
  }));

  const tabs = [
    { id: 'overview', label: 'Visão Geral' },
    { id: 'performance', label: 'Performance' },
    { id: 'content-analysis', label: 'Análise de Conteúdo' },
    { id: 'insights', label: 'Insights IA' },
    { id: 'recommendations', label: 'Recomendações' },
  ];

  // ===== Fetch Análise de Conteúdo (60d) =====
  const fetchAnaliseConteudo = async () => {
    const d60 = new Date(); d60.setDate(d60.getDate() - 60);
    const d56 = new Date(); d56.setDate(d56.getDate() - 56);
    const [{ data: p60 }, { data: p56 }, { data: log }] = await Promise.all([
      supabase.from('instagram_posts').select('*').gte('data_publicacao', d60.toISOString().split('T')[0]),
      supabase.from('instagram_posts')
        .select('data_publicacao, reach, engagement, saves, shares, media_type')
        .gte('data_publicacao', d56.toISOString().split('T')[0])
        .order('data_publicacao', { ascending: true }),
      (supabase as any).from('instagram_sync_log')
        .select('detalhes, executado_em')
        .eq('status', 'analise_conteudo')
        .order('executado_em', { ascending: false })
        .limit(1),
    ]);
    setPosts60(p60 || []);
    setPosts56(p56 || []);
    setAnaliseConteudo(log?.[0]?.detalhes || null);
  };

  useEffect(() => { fetchAnaliseConteudo(); }, []);

  const handleGerarNovaAnalise = async () => {
    setLoadingNovaAnalise(true);
    try {
      const { error } = await supabase.functions.invoke('marketing-content-suggestions', {
        method: 'POST',
        body: {},
      });
      if (error) throw error;
      toast({ title: '✓ Análise gerada com sucesso!' });
      await Promise.all([fetchAnaliseConteudo(), fetchSugestoes()]);
    } catch (err: any) {
      toast({ title: 'Erro ao gerar análise', description: err.message });
    } finally {
      setLoadingNovaAnalise(false);
    }
  };



  // ===== Componentes auxiliares =====
  const KpiCard = ({ icon, label, value, change, accent }: any) => {
    const positive = change >= 0;
    return (
      <div
        className="rounded-lg p-5 transition hover:translate-y-[-2px]"
        style={{
          background: C.card,
          borderLeft: `3px solid ${accent}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div style={{ color: accent }}>{icon}</div>
          {change !== undefined && (
            <span
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: positive ? C.green : C.red }}
            >
              {positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>
        <p
          className="text-[11px] mb-1 uppercase tracking-wider"
          style={{ color: C.textSec, fontFamily: 'DM Sans, sans-serif' }}
        >
          {label}
        </p>
        <p
          className="text-3xl font-bold"
          style={{ color: C.text, fontFamily: 'DM Sans, sans-serif' }}
        >
          {value}
        </p>
      </div>
    );
  };

  const Card = ({ children, className = '' }: any) => (
    <div
      className={`rounded-lg p-5 md:p-6 ${className}`}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      {children}
    </div>
  );

  const SectionTitle = ({ children, subtitle }: any) => (
    <div className="mb-5">
      <h2
        className="text-xl md:text-2xl"
        style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}
      >
        {children}
      </h2>
      {subtitle && (
        <p className="text-sm mt-1" style={{ color: C.textSec }}>
          {subtitle}
        </p>
      )}
    </div>
  );

  const PostCard = ({ post, rank }: { post: Post; rank: number }) => (
    <div
      className="rounded-lg overflow-hidden transition hover:translate-y-[-2px]"
      style={{
        background: C.card,
        border: `1px solid ${rank === 1 ? C.gold : C.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <div className="relative aspect-square" style={{ background: C.tabBg }}>
        {(post.thumbnail_url || post.media_url) ? (
          <>
            <img
              src={post.thumbnail_url || post.media_url}
              alt={post.caption || 'Post Instagram'}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                img.style.display = 'none';
                const next = img.nextElementSibling as HTMLElement | null;
                if (next) next.classList.remove('hidden');
              }}
            />
            <div
              className="hidden w-full h-full absolute inset-0 flex flex-col items-center justify-center"
              style={{ background: 'linear-gradient(180deg, #F0EDE6 0%, #E8E6E0 100%)' }}
            >
              <span className="text-5xl" style={{ color: '#8B6914' }}>
                {MEDIA_ICON[post.media_type] || '📷'}
              </span>
              <span className="text-xs mt-2" style={{ color: '#6B6B69' }}>{post.media_type}</span>
            </div>
          </>
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center"
            style={{ background: 'linear-gradient(180deg, #F0EDE6 0%, #E8E6E0 100%)' }}
          >
            <span className="text-5xl" style={{ color: '#8B6914' }}>
              {MEDIA_ICON[post.media_type] || '📷'}
            </span>
            <span className="text-xs mt-2" style={{ color: '#6B6B69' }}>{post.media_type}</span>
          </div>
        )}
        <span
          className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded font-semibold"
          style={{
            background: post.media_type === 'REELS' ? C.bronze : C.blue,
            color: '#fff',
          }}
        >
          {post.media_type === 'REELS' ? '▶ Reel' : post.media_type === 'CAROUSEL_ALBUM' ? '⊞ Carrossel' : '🖼 Post'}
        </span>
        {rank === 1 && (
          <span
            className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded font-semibold"
            style={{ background: C.gold, color: C.text }}
          >
            🏆 #1
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-sm line-clamp-2 mb-3 min-h-[2.5rem]" style={{ color: C.text }}>
          {post.caption || 'Sem legenda'}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-bold text-sm" style={{ color: C.green }}>{post.reach?.toLocaleString() || 0}</p>
            <p className="text-xs" style={{ color: C.textSec }}>alcance</p>
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: C.blue }}>{Math.round(post.engagement || 0)}</p>
            <p className="text-xs" style={{ color: C.textSec }}>engaj.</p>
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: C.bronze }}>{post.saved || 0}</p>
            <p className="text-xs" style={{ color: C.textSec }}>salvos</p>
          </div>
        </div>
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block text-center text-xs transition"
            style={{ color: C.bronze }}
          >
            Ver no Instagram →
          </a>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: C.bg }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full mx-auto mb-4 animate-bounce" style={{ background: C.gold }} />
          <p style={{ color: C.textSec }}>Carregando análises...</p>
        </div>
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4" style={{ background: C.bg }}>
        <div className="text-center">
          <AlertCircle size={48} style={{ color: C.red }} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif' }}>
            Erro ao carregar
          </h1>
          <p className="mb-6" style={{ color: C.textSec }}>{error}</p>
          <button
            onClick={fetchData}
            className="px-6 py-2 rounded-lg transition"
            style={{ background: C.text, color: C.gold }}
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1
              className="text-2xl md:text-[28px]"
              style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}
            >
              Marketing Analytics
            </h1>
            <p className="text-sm mt-1" style={{ color: C.textSec, fontFamily: 'DM Sans, sans-serif' }}>
              Performance Instagram · {posts.length} posts analisados
            </p>
          </div>
          <div className="flex gap-2">
            {PERIODOS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodoDias(p.value)}
                className="px-4 py-2 text-sm rounded-full transition"
                style={{
                  background: periodoDias === p.value ? C.text : 'transparent',
                  color: periodoDias === p.value ? C.gold : C.textSec,
                  border: `1px solid ${periodoDias === p.value ? C.text : C.border}`,
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {isEmpty && (
          <div
            className="mb-6 p-5 rounded-lg text-center"
            style={{ background: '#FFF9E6', border: `1px solid ${C.gold}` }}
          >
            <AlertCircle size={28} style={{ color: C.bronze }} className="mx-auto mb-2" />
            <h2 className="font-semibold mb-1" style={{ color: C.text }}>Nenhum post encontrado</h2>
            <p className="text-sm" style={{ color: C.textSec }}>
              A tabela <code style={{ color: C.bronze }}>instagram_posts</code> está vazia neste período.
            </p>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            icon={<TrendingUp size={20} />}
            label="Alcance Total"
            value={(totalReach / 1000).toFixed(1) + 'K'}
            change={pctVar(totalReach, prevReach)}
            accent={C.bronze}
          />
          <KpiCard
            icon={<Zap size={20} />}
            label="Engajamento Total"
            value={Math.round(totalEngagement).toLocaleString()}
            change={pctVar(totalEngagement, prevEng)}
            accent={C.gold}
          />
          <KpiCard
            icon={<Target size={20} />}
            label="Salvamentos"
            value={totalSaved.toLocaleString()}
            change={pctVar(totalSaved, prevSaved)}
            accent={C.green}
          />
          <KpiCard
            icon={<ArrowUp size={20} />}
            label="Compartilhamentos"
            value={totalShares.toLocaleString()}
            change={pctVar(totalShares, prevShares)}
            accent={C.blue}
          />
        </div>

        {/* Tabs */}
        <div
          className="inline-flex gap-1 p-1 rounded-lg mb-6 overflow-x-auto"
          style={{ background: C.tabBg }}
        >
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className="px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition"
              style={{
                background: selectedTab === tab.id ? C.text : 'transparent',
                color: selectedTab === tab.id ? C.gold : C.textSec,
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Visão Geral */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            <Card>
              <SectionTitle>Top 5 Posts por Alcance</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topPosts.map((post, i) => (
                  <PostCard key={post.id} post={post} rank={i + 1} />
                ))}
              </div>
            </Card>

            <Card>
              <SectionTitle subtitle="Posts com menor performance — considerar pausa ou reformulação">
                ⚠️ Menor Performance
              </SectionTitle>
              <div className="space-y-3">
                {lowPosts.map((post, i) => (
                  <div
                    key={post.id}
                    className="flex items-start gap-4 pb-3"
                    style={{ borderBottom: i === lowPosts.length - 1 ? 'none' : `1px solid ${C.border}` }}
                  >
                    <div
                      className="font-bold text-sm w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
                      style={{ background: '#FBEAE5', color: C.red }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-2" style={{ color: C.text }}>
                        {post.caption || `Post ${post.media_id?.substring(0, 8)}`}
                      </p>
                      <p className="text-xs mt-1" style={{ color: C.red }}>
                        💡 Revisar abordagem — pode estar muito transacional
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="font-semibold text-sm" style={{ color: C.textSec }}>
                        {post.reach?.toLocaleString()} alcance
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Tab: Performance */}
        {selectedTab === 'performance' && (
          <div className="space-y-6">
            <Card>
              <SectionTitle>Reels vs Carrosséis — Médias</SectionTitle>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" stroke={C.textSec} />
                  <YAxis stroke={C.textSec} />
                  <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} />
                  <Legend />
                  <Bar dataKey="Alcance" fill={C.bronze} />
                  <Bar dataKey="Engajamento" fill={C.gold} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <SectionTitle>Mix de Conteúdo</SectionTitle>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? C.bronze : C.gold} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <SectionTitle>Alcance Médio por Tipo</SectionTitle>
                <div className="space-y-4">
                  {chartData.map(item => (
                    <div key={item.name}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold" style={{ color: C.text }}>{item.name}</span>
                        <span className="font-semibold" style={{ color: C.bronze }}>
                          {item.Alcance.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full rounded-full h-3" style={{ background: C.tabBg }}>
                        <div
                          className="h-3 rounded-full transition-all"
                          style={{
                            width: `${Math.min((item.Alcance / Math.max(...chartData.map(d => d.Alcance))) * 100, 100)}%`,
                            background: `linear-gradient(90deg, ${C.bronze}, ${C.gold})`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Tab: Análise de Conteúdo */}
        {selectedTab === 'content-analysis' && (() => {
          const total = posts60.length;
          const reels60 = posts60.filter(p => p.media_type === 'REELS');
          const carr60 = posts60.filter(p => p.media_type === 'CAROUSEL_ALBUM');
          const img60 = posts60.filter(p => p.media_type === 'IMAGE');
          const avgEngBy = (arr: any[]) => arr.length ? arr.reduce((s, p) => s + (p.engagement || 0), 0) / arr.length : 0;
          const formatList = [
            { type: 'REELS', label: 'Reels', icon: '▶', arr: reels60 },
            { type: 'CAROUSEL_ALBUM', label: 'Carrossel', icon: '⊞', arr: carr60 },
            { type: 'IMAGE', label: 'Post Fixo', icon: '🖼', arr: img60 },
          ];
          const melhor = formatList.reduce((m, f) => avgEngBy(f.arr) > avgEngBy(m.arr) ? f : m, formatList[0]);

          const mix = analiseConteudo?.analise_mix_conteudo || {};
          const comp = analiseConteudo?.comparativo_semanas || {};
          const mixBars = [
            { key: 'lifestyle', label: 'Lifestyle', cor: C.green, meta: 70, data: mix.lifestyle },
            { key: 'educacional', label: 'Educacional', cor: C.blue, meta: 20, data: mix.educacional },
            { key: 'produto', label: 'Produto', cor: C.bronze, meta: 10, data: mix.produto },
          ];
          const statusBadge = (s: string) => {
            if (s === 'na_meta') return { bg: '#E8F5EE', color: C.green, label: '✓ Na meta' };
            if (s === 'acima_meta') return { bg: '#FBEAE5', color: C.red, label: '✗ Acima da meta' };
            return { bg: '#FFF4D6', color: C.bronze, label: '⚠ Abaixo da meta' };
          };

          const compMetrics = [
            { key: 'posts_publicados', label: 'Posts publicados' },
            { key: 'alcance_total', label: 'Alcance total' },
            { key: 'engajamento_total', label: 'Engajamento total' },
            { key: 'salvamentos', label: 'Salvamentos' },
            { key: 'compartilhamentos', label: 'Compartilhamentos' },
            { key: 'taxa_engajamento', label: 'Taxa de engajamento', isPct: true },
          ];

          // ===== Evolução semanal (8 semanas) =====
          const semanasMap = posts56.reduce((acc: any, post: any) => {
            const data = new Date(post.data_publicacao);
            const dia = data.getDay();
            const diasAteSeg = dia === 0 ? 6 : dia - 1;
            const seg = new Date(data);
            seg.setDate(data.getDate() - diasAteSeg);
            const chave = seg.toISOString().split('T')[0];
            if (!acc[chave]) acc[chave] = { inicio: chave, posts: 0, alcance: 0, engagement: 0, saves: 0, shares: 0, formatos: {} as any };
            acc[chave].posts++;
            acc[chave].alcance += post.reach || 0;
            acc[chave].engagement += post.engagement || 0;
            acc[chave].saves += post.saves || 0;
            acc[chave].shares += post.shares || 0;
            acc[chave].formatos[post.media_type] = (acc[chave].formatos[post.media_type] || 0) + 1;
            return acc;
          }, {});
          const semanas = Object.values(semanasMap).sort((a: any, b: any) => a.inicio.localeCompare(b.inicio)) as any[];
          const hoje = new Date();
          const dSem = hoje.getDay() === 0 ? 6 : hoje.getDay() - 1;
          const segAtual = new Date(hoje); segAtual.setDate(hoje.getDate() - dSem);
          const chaveAtual = segAtual.toISOString().split('T')[0];

          const fmtDate = (s: string) => {
            const [y, m, d] = s.split('-');
            return `${d}/${m}`;
          };

          return (
            <div className="space-y-6">
              {/* Seção 1: Cards Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={<TrendingUp size={20} />} label="Total Posts (60d)" value={total} accent={C.text} />
                <div className="rounded-lg p-5" style={{ background: C.card, borderLeft: `3px solid #7C3AED`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider" style={{ background: '#7C3AED', color: '#fff' }}>Reels</span>
                  <p className="text-3xl font-bold mt-2" style={{ color: C.text, fontFamily: 'DM Sans, sans-serif' }}>{reels60.length}</p>
                  <p className="text-xs" style={{ color: C.textSec }}>{total ? ((reels60.length / total) * 100).toFixed(0) : 0}% do total</p>
                </div>
                <div className="rounded-lg p-5" style={{ background: C.card, borderLeft: `3px solid ${C.blue}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider" style={{ background: C.blue, color: '#fff' }}>Carrosséis</span>
                  <p className="text-3xl font-bold mt-2" style={{ color: C.text, fontFamily: 'DM Sans, sans-serif' }}>{carr60.length}</p>
                  <p className="text-xs" style={{ color: C.textSec }}>{total ? ((carr60.length / total) * 100).toFixed(0) : 0}% do total</p>
                </div>
                <div className="rounded-lg p-5" style={{ background: C.card, borderLeft: `3px solid ${C.gold}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider" style={{ background: C.gold, color: C.text }}>⭐ Melhor formato</span>
                  <p className="text-2xl font-bold mt-2" style={{ color: C.text, fontFamily: 'DM Sans, sans-serif' }}>{melhor.icon} {melhor.label}</p>
                  <p className="text-xs" style={{ color: C.textSec }}>Engaj. médio {Math.round(avgEngBy(melhor.arr)).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              {/* Seção 2: Performance por Formato */}
              <Card>
                <SectionTitle subtitle="Médias dos últimos 60 dias">Performance por Formato</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {formatList.map(f => {
                    const isBest = f.type === melhor.type;
                    const n = f.arr.length || 1;
                    const alc = f.arr.reduce((s, p) => s + (p.reach || 0), 0) / n;
                    const eng = f.arr.reduce((s, p) => s + (p.engagement || 0), 0) / n;
                    const sav = f.arr.reduce((s, p) => s + (p.saves || 0), 0) / n;
                    const sh = f.arr.reduce((s, p) => s + (p.shares || 0), 0) / n;
                    const taxa = alc ? (eng / alc) * 100 : 0;
                    return (
                      <div key={f.type} className="rounded-lg p-5" style={{ background: C.card, border: `${isBest ? 2 : 1}px solid ${isBest ? C.gold : C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold" style={{ color: C.text }}>{f.icon} {f.label}</h3>
                          {isBest && (<span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: C.gold, color: C.text }}>⭐ Melhor</span>)}
                        </div>
                        <div className="space-y-2 text-sm">
                          {[
                            ['Posts', f.arr.length.toLocaleString('pt-BR')],
                            ['Alcance médio', Math.round(alc).toLocaleString('pt-BR')],
                            ['Engaj. médio', Math.round(eng).toLocaleString('pt-BR')],
                            ['Taxa de engaj.', `${taxa.toFixed(2)}%`],
                            ['Salvamentos médios', sav.toFixed(1)],
                            ['Compart. médios', sh.toFixed(1)],
                          ].map(([k, v]) => (
                            <div key={k as string} className="flex justify-between" style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                              <span style={{ color: C.textSec }}>{k}</span>
                              <span className="font-semibold" style={{ color: C.text }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Seção 3: Mix de Conteúdo */}
              <Card>
                <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl md:text-2xl" style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
                      Mix de Conteúdo (70/20/10)
                    </h2>
                    <p className="text-sm mt-1" style={{ color: C.textSec }}>Meta: 70% lifestyle · 20% educacional · 10% produto</p>
                  </div>
                  <button onClick={handleGerarNovaAnalise} disabled={loadingNovaAnalise} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition disabled:opacity-50" style={{ background: C.text, color: C.gold, fontFamily: 'DM Sans, sans-serif' }}>
                    <RefreshCw size={14} className={loadingNovaAnalise ? 'animate-spin' : ''} />
                    Gerar Nova Análise
                  </button>
                </div>

                {!analiseConteudo ? (
                  <div className="text-center py-8 rounded-lg" style={{ background: C.tabBg, border: `1px dashed ${C.border}` }}>
                    <p className="text-sm" style={{ color: C.textSec }}>Nenhuma análise disponível. Clique em "Gerar Nova Análise".</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-5 mb-5">
                      {mixBars.map(b => {
                        const pct = b.data?.percentual ?? 0;
                        const badge = statusBadge(b.data?.status);
                        return (
                          <div key={b.key}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-semibold" style={{ color: C.text }}>{b.label}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs" style={{ color: C.textSec }}>{pct}% / {b.meta}%</span>
                                <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                              </div>
                            </div>
                            <div className="w-full rounded-full h-3" style={{ background: C.tabBg }}>
                              <div className="h-3 rounded-full transition-all" style={{ width: `${Math.min((pct / b.meta) * 100, 100)}%`, background: b.cor }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {mix.diagnostico && (
                      <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: C.tabBg }}>
                        <span>💡</span>
                        <p className="text-sm italic" style={{ color: C.textSec }}>{mix.diagnostico}</p>
                      </div>
                    )}
                  </>
                )}
              </Card>

              {/* Seção 4: Comparativo Semanal */}
              <Card>
                <SectionTitle subtitle={comp.semana_anterior && comp.semana_atual ? `${comp.semana_anterior.periodo || ''} vs ${comp.semana_atual.periodo || ''}` : 'Comparação entre semanas'}>
                  Comparativo Semanal Detalhado
                </SectionTitle>
                {!comp.semana_atual ? (
                  <div className="text-center py-8 rounded-lg" style={{ background: C.tabBg, border: `1px dashed ${C.border}` }}>
                    <p className="text-sm" style={{ color: C.textSec }}>Comparativo aparecerá após gerar análise.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                            <th className="text-left py-3 px-2 font-semibold" style={{ color: C.textSec }}>Métrica</th>
                            <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Semana Anterior</th>
                            <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Semana Atual</th>
                            <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Variação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compMetrics.map(m => {
                            const ant = comp.semana_anterior?.[m.key] ?? 0;
                            const atu = comp.semana_atual?.[m.key] ?? 0;
                            const v = pctVar(atu, ant);
                            const pos = v >= 0;
                            const fmt = (x: number) => m.isPct ? `${Number(x).toFixed(2)}%` : Math.round(x).toLocaleString('pt-BR');
                            return (
                              <tr key={m.key} style={{ borderBottom: `1px solid ${C.border}` }}>
                                <td className="py-3 px-2" style={{ color: C.text }}>{m.label}</td>
                                <td className="text-right py-3 px-2" style={{ color: C.textSec }}>{fmt(ant)}</td>
                                <td className="text-right py-3 px-2 font-semibold" style={{ color: C.text }}>{fmt(atu)}</td>
                                <td className="text-right py-3 px-2 font-semibold" style={{ color: pos ? C.green : C.red }}>
                                  {pos ? '↑' : '↓'} {Math.abs(v).toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {comp.insight_semana && (
                      <div className="flex items-start gap-3 p-4 rounded-lg mt-4" style={{ background: C.tabBg }}>
                        <span>📊</span>
                        <p className="text-sm italic" style={{ color: C.textSec }}>{comp.insight_semana}</p>
                      </div>
                    )}
                  </>
                )}
              </Card>

              {/* Seção 5: Evolução Semanal */}
              <Card>
                <SectionTitle subtitle="Últimas 8 semanas (segunda a domingo)">Evolução Semanal</SectionTitle>
                {semanas.length === 0 ? (
                  <div className="text-center py-8 rounded-lg" style={{ background: C.tabBg, border: `1px dashed ${C.border}` }}>
                    <p className="text-sm" style={{ color: C.textSec }}>Sem dados nas últimas 8 semanas.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          <th className="text-left py-3 px-2 font-semibold" style={{ color: C.textSec }}>Período</th>
                          <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Posts</th>
                          <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Alcance</th>
                          <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Engajamento</th>
                          <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Taxa eng.</th>
                          <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Melhor formato</th>
                        </tr>
                      </thead>
                      <tbody>
                        {semanas.slice(-8).map((s: any) => {
                          const isAtual = s.inicio === chaveAtual;
                          const taxa = s.alcance ? (s.engagement / s.alcance) * 100 : 0;
                          const fimDt = new Date(s.inicio); fimDt.setDate(fimDt.getDate() + 6);
                          const fim = fimDt.toISOString().split('T')[0];
                          const melhorFmt = Object.entries(s.formatos).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '—';
                          const labelFmt: any = { REELS: '▶ Reels', CAROUSEL_ALBUM: '⊞ Carrossel', IMAGE: '🖼 Post' };
                          return (
                            <tr key={s.inicio} style={{ borderBottom: `1px solid ${C.border}`, background: isAtual ? C.bg : 'transparent', borderLeft: isAtual ? `3px solid ${C.bronze}` : 'none' }}>
                              <td className="py-3 px-2" style={{ color: C.text }}>{fmtDate(s.inicio)} – {fmtDate(fim)}{isAtual && <span className="ml-2 text-[10px] px-2 py-0.5 rounded" style={{ background: C.gold, color: C.text }}>atual</span>}</td>
                              <td className="text-right py-3 px-2" style={{ color: C.text }}>{s.posts}</td>
                              <td className="text-right py-3 px-2" style={{ color: C.text }}>{s.alcance.toLocaleString('pt-BR')}</td>
                              <td className="text-right py-3 px-2" style={{ color: C.text }}>{Math.round(s.engagement).toLocaleString('pt-BR')}</td>
                              <td className="text-right py-3 px-2" style={{ color: C.text }}>{taxa.toFixed(2)}%</td>
                              <td className="text-right py-3 px-2" style={{ color: C.textSec }}>{labelFmt[melhorFmt] || melhorFmt}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          );
        })()}

        {/* Tab: Insights IA */}
        {selectedTab === 'insights' && (
          <Card>
            <SectionTitle>🤖 Insights Estratégicos — IA</SectionTitle>
            <div className="whitespace-pre-line leading-relaxed text-sm" style={{ color: C.text }}>
              {insights || 'Gerando insights...'}
            </div>
          </Card>
        )}

        {/* Tab: Recomendações */}
        {selectedTab === 'recommendations' && (
          <div className="space-y-6">
            {/* Seção 1 — Mix de Conteúdo */}
            <Card>
              <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h2
                    className="text-xl md:text-2xl"
                    style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}
                  >
                    Mix de Conteúdo
                  </h2>
                  <p className="text-sm mt-1" style={{ color: C.textSec }}>
                    Meta: 70% lifestyle · 20% educacional · 10% produto direto
                  </p>
                </div>
                <button
                  onClick={handleAtualizarAnalise}
                  disabled={loadingAnalise}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition disabled:opacity-50"
                  style={{ background: C.text, color: C.gold, fontFamily: 'DM Sans, sans-serif' }}
                >
                  <RefreshCw size={14} className={loadingAnalise ? 'animate-spin' : ''} />
                  Atualizar Análise
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                {[
                  { key: 'lifestyle', label: 'Lifestyle', color: C.green, atual: mixAtual.lifestyle, meta: mixMeta.lifestyle },
                  { key: 'educacional', label: 'Educacional', color: C.blue, atual: mixAtual.educacional, meta: mixMeta.educacional },
                  { key: 'produto', label: 'Produto', color: C.bronze, atual: mixAtual.produto, meta: mixMeta.produto },
                ].map(b => {
                  const naMeta = b.atual >= b.meta;
                  return (
                    <div key={b.key}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold" style={{ color: C.text }}>{b.label}</span>
                        <span className="text-xs" style={{ color: C.textSec }}>{b.atual}% / {b.meta}%</span>
                      </div>
                      <div className="w-full rounded-full h-3 mb-2" style={{ background: C.tabBg }}>
                        <div
                          className="h-3 rounded-full transition-all"
                          style={{ width: `${Math.min((b.atual / b.meta) * 100, 100)}%`, background: b.color }}
                        />
                      </div>
                      <span
                        className="inline-block text-[11px] px-2 py-0.5 rounded font-medium"
                        style={{
                          background: naMeta ? '#E8F5EE' : '#FFF4D6',
                          color: naMeta ? C.green : C.bronze,
                        }}
                      >
                        {naMeta ? '✓ Na meta' : '⚠ Abaixo da meta'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: C.tabBg }}>
                <span>💡</span>
                <p className="text-sm italic" style={{ color: C.textSec }}>{diagnosticoMix}</p>
              </div>
            </Card>

            {/* Seção 2 — Comparativo Semanal */}
            <Card>
              <SectionTitle subtitle={`Últimos ${periodoDias} dias vs ${periodoDias} dias anteriores`}>
                Comparativo Semanal
              </SectionTitle>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <th className="text-left py-3 px-2 font-semibold" style={{ color: C.textSec }}>Métrica</th>
                      <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Período Anterior</th>
                      <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Período Atual</th>
                      <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativo.map(row => {
                      const variacao = pctVar(row.atual, row.ant);
                      const positivo = variacao >= 0;
                      const fmt = (v: number) =>
                        row.isPct ? fmtPct(v) : Math.round(v).toLocaleString('pt-BR');
                      return (
                        <tr key={row.metrica} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td className="py-3 px-2" style={{ color: C.text }}>{row.metrica}</td>
                          <td className="text-right py-3 px-2" style={{ color: C.textSec }}>{fmt(row.ant)}</td>
                          <td className="text-right py-3 px-2 font-semibold" style={{ color: C.text }}>{fmt(row.atual)}</td>
                          <td
                            className="text-right py-3 px-2 font-semibold flex items-center justify-end gap-1"
                            style={{ color: positivo ? C.green : C.red }}
                          >
                            {positivo ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                            {Math.abs(variacao).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg mt-4" style={{ background: C.tabBg }}>
                <span>📊</span>
                <p className="text-sm italic" style={{ color: C.textSec }}>{insightSemana}</p>
              </div>

              {/* Performance por Formato */}
              <div className="mt-8">
                <h3
                  className="text-lg md:text-xl mb-4"
                  style={{ color: C.text, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}
                >
                  Performance por Formato
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        <th className="text-left py-3 px-2 font-semibold" style={{ color: C.textSec }}>Formato</th>
                        <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Período Anterior</th>
                        <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Período Atual</th>
                        <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Var. Alcance</th>
                        <th className="text-right py-3 px-2 font-semibold" style={{ color: C.textSec }}>Var. Eng.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formatos.map(f => {
                        const varAlc = pctVar(f.atual.alcance, f.ant.alcance);
                        const varEng = pctVar(f.atual.engajamento, f.ant.engajamento);
                        const Cell = ({ v }: { v: number }) => {
                          const pos = v >= 0;
                          return (
                            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: pos ? '#2D7A4F' : '#C0392B' }}>
                              {pos ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                              {Math.abs(v).toFixed(1)}%
                            </span>
                          );
                        };
                        return (
                          <tr key={f.type} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td className="py-3 px-2" style={{ color: C.text }}>
                              <span className="inline-flex items-center gap-2">
                                <span className="text-lg" style={{ color: f.cor }}>{f.icon}</span>
                                <span className="font-medium">{f.label}</span>
                              </span>
                            </td>
                            <td className="text-right py-3 px-2" style={{ color: C.textSec }}>
                              {f.ant.alcance.toLocaleString('pt-BR')} / {Math.round(f.ant.engajamento).toLocaleString('pt-BR')}
                            </td>
                            <td className="text-right py-3 px-2 font-semibold" style={{ color: C.text }}>
                              {f.atual.alcance.toLocaleString('pt-BR')} / {Math.round(f.atual.engajamento).toLocaleString('pt-BR')}
                            </td>
                            <td className="text-right py-3 px-2"><Cell v={varAlc} /></td>
                            <td className="text-right py-3 px-2"><Cell v={varEng} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>


            {/* Seção 3 — Sugestões com IA */}
            <Card>
              <SectionTitle subtitle="Baseadas nos seus posts de maior performance">
                Sugestões de Conteúdo com IA
              </SectionTitle>

              {sugestoes.length === 0 ? (
                <div
                  className="text-center py-12 rounded-lg"
                  style={{ background: C.tabBg, border: `1px dashed ${C.border}` }}
                >
                  <Sparkles size={32} className="mx-auto mb-3" style={{ color: C.bronze }} />
                  <p className="text-sm font-medium mb-1" style={{ color: C.text }}>
                    Nenhuma sugestão gerada ainda
                  </p>
                  <p className="text-xs" style={{ color: C.textSec }}>
                    Conecte a tabela <code style={{ color: C.bronze }}>conteudos_gerados</code> e a edge function{' '}
                    <code style={{ color: C.bronze }}>marketing-content-suggestions</code> para popular esta seção.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sugestoes.map((s: any) => {
                    const enviado = enviados.has(s.id);
                    const meta = (() => {
                      try { return typeof s.metadados === 'string' ? JSON.parse(s.metadados) : (s.metadados || {}); }
                      catch { return {}; }
                    })();
                    const cat = meta.categoria || s.categoria || 'lifestyle';
                    const corCat: any = { lifestyle: '#2D7A4F', educacional: '#4A90D9', produto: '#8B6914' };
                    const cor = corCat[cat] || C.bronze;
                    const canalColors: any = { instagram_reels: '#7C3AED', instagram_feed: C.gold };
                    const canalBg = canalColors[s.canal] || C.textSec;
                    return (
                      <div
                        key={s.id}
                        className="rounded-lg overflow-hidden"
                        style={{
                          background: C.card,
                          border: `1px solid ${C.border}`,
                          borderTop: `3px solid ${cor}`,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        }}
                      >
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-2 gap-2">
                            <h3 className="font-semibold text-base flex-1" style={{ color: C.text }}>
                              {s.copy_principal}
                            </h3>
                            <span
                              className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wide font-medium whitespace-nowrap"
                              style={{ background: canalBg, color: '#fff' }}
                            >
                              {s.canal === 'instagram_reels' ? 'Reels' : s.canal === 'instagram_feed' ? 'Feed' : s.canal}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-3">
                            <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: `${cor}22`, color: cor }}>
                              {cat}
                            </span>
                            {[meta.persona, meta.angulo, meta.etapa_funil].filter(Boolean).map((t: string, i: number) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded"
                                style={{ background: C.tabBg, color: C.textSec }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm mb-3" style={{ color: C.textSec }}>{s.copy_legenda}</p>
                          <button
                            onClick={() => setOpenCaption(p => ({ ...p, [s.id]: !p[s.id] }))}
                            className="flex items-center gap-1 text-xs mb-2"
                            style={{ color: C.bronze }}
                          >
                            Ver caption sugerida
                            <ChevronDown
                              size={12}
                              style={{
                                transform: openCaption[s.id] ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.2s',
                              }}
                            />
                          </button>
                          {openCaption[s.id] && (
                            <div className="p-3 rounded-lg text-sm mb-3" style={{ background: C.tabBg, color: C.text }}>
                              {s.copy_cta}
                            </div>
                          )}
                          {meta.motivo && (
                            <div className="flex items-start gap-2 mb-3 text-[13px] italic" style={{ color: C.textSec }}>
                              <span>💡</span>
                              <span>{meta.motivo}</span>
                            </div>
                          )}
                          <button
                            onClick={() => !enviado && handleEnviarMatriz(s.id)}
                            disabled={enviado}
                            className="w-full flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition disabled:opacity-60"
                            style={{
                              background: enviado ? C.green : C.text,
                              color: enviado ? '#fff' : C.gold,
                              fontFamily: 'DM Sans, sans-serif',
                            }}
                          >
                            {enviado ? (<><CheckCircle2 size={14} /> Enviado</>) : (<><Send size={14} /> Enviar para Matriz Criativa</>)}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-6 text-center" style={{ borderTop: `1px solid ${C.border}` }}>
          <p className="text-xs" style={{ color: C.textSec }}>
            {ultimaAtualizacao ? `Dados de ${new Date(ultimaAtualizacao).toLocaleDateString('pt-BR')}` : ''} · {posts.length} posts · Dashboard Mariana Cardoso
          </p>
        </div>
      </div>
    </div>
  );
}
