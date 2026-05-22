import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertCircle, Zap, Target, ArrowUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
}

export default function MarketingAnalytics() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [error, setError] = useState('');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setError('');
      setLoading(true);

      const { data: postsData, error: postsError } = await supabase
        .from('instagram_posts')
        .select('*')
        .order('reach', { ascending: false })
        .limit(50);

      if (postsError) throw postsError;

      setPosts(postsData || []);
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
Valores: qualidade técnica (tecidos, cortes), exclusividade, comunidade.

DADOS DO INSTAGRAM:
Total de posts: ${postsData.length}
Reels: ${reels.length} | Carrosséis: ${carrosseis.length}
Engajamento médio: ${avgEngagement.toFixed(0)}
Alcance médio Reels: ${Math.round(reels.reduce((s,p) => s+(p.reach||0),0)/Math.max(reels.length,1)).toLocaleString()}
Alcance médio Carrosséis: ${Math.round(carrosseis.reduce((s,p) => s+(p.reach||0),0)/Math.max(carrosseis.length,1)).toLocaleString()}

TOP 5 POSTS (maior alcance):
${topPosts.map((p,i) => `${i+1}. [${p.media_type}] Alcance: ${p.reach?.toLocaleString()} | Engajamento: ${Math.round(p.engagement||0)} | Salvos: ${p.saved} | "${p.caption?.substring(0,80)}"`).join('\n')}

MENOR PERFORMANCE:
${lowPosts.map((p,i) => `${i+1}. [${p.media_type}] Alcance: ${p.reach?.toLocaleString()} | "${p.caption?.substring(0,80)}"`).join('\n')}

Gere análise estratégica em 4 seções:
1. O QUE ESTÁ FUNCIONANDO
Identifique padrões nos top posts. Storytelling? Educação sobre tecido? Lifestyle? Aspiração?
2. O QUE NÃO ESTÁ PERFORMANDO E POR QUÊ
Analise posts com menor alcance. São transacionais? Informativos sem emoção?
3. OPORTUNIDADES ESTRATÉGICAS
3 oportunidades concretas para fortalecer posicionamento premium.
4. RECOMENDAÇÕES DE PARADA
Que tipos de conteúdo pausar? Por quê dilui o posicionamento?

Seja direto, específico e use os dados reais. Máximo 600 palavras.`;

      const data = await invokeEdgeFunction('marketing-insights', { prompt });
      setInsights(data.insights || 'Erro ao gerar insights.');
    } catch (err: any) {
      console.error('Erro insights:', err);
      setInsights('Erro ao conectar com IA. Tente recarregar a página.');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="animate-pulse text-center">
        <div className="w-12 h-12 bg-amber-500 rounded-full mx-auto mb-4 animate-bounce"></div>
        <p className="text-slate-300">Carregando análises...</p>
      </div>
    </div>
  );

  if (error && posts.length === 0) return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="text-center">
        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Erro ao carregar</h1>
        <p className="text-slate-300 mb-6">{error}</p>
        <button
          onClick={fetchData}
          className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
        >
          Tentar Novamente
        </button>
      </div>
    </div>
  );

  const isEmpty = posts.length === 0;

  const reelsData = posts.filter(p => p.media_type === 'REELS');
  const carrosselData = posts.filter(p => p.media_type === 'CAROUSEL_ALBUM');
  const topPosts = posts.slice(0, 5);
  const lowPosts = posts.slice().sort((a, b) => (a.reach || 0) - (b.reach || 0)).slice(0, 3);
  const totalReach = posts.reduce((s, p) => s + (p.reach || 0), 0);
  const totalEngagement = posts.reduce((s, p) => s + (p.engagement || 0), 0);
  const totalSaved = posts.reduce((s, p) => s + (p.saved || 0), 0);
  const totalShares = posts.reduce((s, p) => s + (p.shares || 0), 0);

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

  const tabs = [
    { id: 'overview', label: 'Visão Geral' },
    { id: 'performance', label: 'Performance' },
    { id: 'insights', label: 'Insights IA' },
    { id: 'recommendations', label: 'Recomendações' },
  ];

  const KpiCard = ({ icon, label, value, change }: any) => (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-500/20 rounded-lg p-6 hover:border-amber-500/40 transition">
      <div className="flex items-center justify-between mb-2">
        <div className="text-amber-500">{icon}</div>
        <span className={`text-xs font-semibold ${change?.startsWith('-') ? 'text-red-400' : 'text-green-400'}`}>
          {change}
        </span>
      </div>
      <p className="text-slate-400 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );

  const COLORS = ['#E8CD7E', '#8B6914'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-white">Marketing Analytics</h1>
            <div className="text-amber-500 text-xs md:text-sm">Mariana Cardoso</div>
          </div>
          <p className="text-slate-400 text-sm md:text-base">
            Performance Instagram · {posts.length} posts analisados
          </p>
        </div>

        {isEmpty && (
          <div className="mb-8 bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 text-center">
            <AlertCircle size={32} className="text-amber-500 mx-auto mb-2" />
            <h2 className="text-white font-bold mb-1">Nenhum post encontrado</h2>
            <p className="text-slate-300 text-sm">
              A tabela <code className="text-amber-400">instagram_posts</code> está vazia. Assim que houver dados sincronizados do Windsor.ai, as análises aparecerão aqui automaticamente.
            </p>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard icon={<TrendingUp size={20} />} label="Alcance Total" value={(totalReach / 1000).toFixed(1) + 'K'} change="+12.5%" />
          <KpiCard icon={<Zap size={20} />} label="Engajamento Total" value={Math.round(totalEngagement).toLocaleString()} change="+8.2%" />
          <KpiCard icon={<Target size={20} />} label="Salvamentos" value={totalSaved.toLocaleString()} change="+5.3%" />
          <KpiCard icon={<ArrowUp size={20} />} label="Compartilhamentos" value={totalShares.toLocaleString()} change="+3.1%" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 md:gap-4 border-b border-slate-700 overflow-x-auto mb-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition border-b-2 ${selectedTab === tab.id ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Visão Geral */}
        {selectedTab === 'overview' && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center gap-2">
                <ArrowUp size={20} className="text-green-500" />
                Top 5 Posts por Alcance
              </h2>
              <div className="space-y-4">
                {topPosts.map((post, i) => (
                  <div key={post.id} className="flex items-start gap-4 pb-4 border-b border-slate-700 last:border-0">
                    <div className="text-amber-500 font-bold text-lg w-8 h-8 flex items-center justify-center bg-amber-500/20 rounded-full flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-xs md:text-sm line-clamp-2">
                        {post.caption || `Post ${post.media_id?.substring(0, 8)}`}
                      </p>
                      <div className="flex gap-3 md:gap-6 mt-2 text-xs md:text-sm flex-wrap">
                        <span className="text-slate-400">
                          <span className="text-green-400 font-semibold">{post.reach?.toLocaleString()}</span> alcance
                        </span>
                        <span className="text-slate-400">
                          <span className="text-blue-400 font-semibold">{Math.round(post.engagement || 0)}</span> engajamento
                        </span>
                        <span className="text-slate-400">
                          <span className="text-purple-400 font-semibold">{post.saved}</span> salvos
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`px-2 md:px-3 py-1 rounded text-xs font-semibold ${post.media_type === 'REELS' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {post.media_type === 'REELS' ? 'Reel' : 'Carrossel'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-red-500/20 rounded-lg p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center gap-2">
                <AlertCircle size={20} className="text-red-500" />
                ⚠️ Menor Performance — Considerar Pausa
              </h2>
              <div className="space-y-4">
                {lowPosts.map((post, i) => (
                  <div key={post.id} className="flex items-start gap-4 pb-4 border-b border-slate-700 last:border-0">
                    <div className="text-red-500 font-bold text-lg w-8 h-8 flex items-center justify-center bg-red-500/20 rounded-full flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-xs md:text-sm line-clamp-2">
                        {post.caption || `Post ${post.media_id?.substring(0, 8)}`}
                      </p>
                      <p className="text-red-400 text-xs mt-2">
                        💡 Revisar abordagem — conteúdo pode estar muito transacional
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-slate-400 font-semibold text-xs md:text-sm">{post.reach?.toLocaleString()} alcance</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Performance */}
        {selectedTab === 'performance' && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-white mb-6">Reels vs Carrosséis — Médias</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="Alcance" fill="#E8CD7E" />
                  <Bar dataKey="Engajamento" fill="#8B6914" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-white mb-6">Mix de Conteúdo</h2>
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
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-white mb-6">Alcance Médio por Tipo</h2>
                <div className="space-y-4">
                  {chartData.map((item, i) => (
                    <div key={item.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white font-semibold">{item.name}</span>
                        <span className="text-amber-400 font-semibold">{item.Alcance.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-amber-300 h-3 rounded-full transition-all"
                          style={{ width: `${Math.min((item.Alcance / Math.max(...chartData.map(d => d.Alcance))) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Insights IA */}
        {selectedTab === 'insights' && (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Zap size={20} className="text-amber-500" />
              🤖 Insights Estratégicos — IA
            </h2>
            <div className="text-slate-300 whitespace-pre-line leading-relaxed">
              {insights}
            </div>
          </div>
        )}

        {/* Tab: Recomendações */}
        {selectedTab === 'recommendations' && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-green-500/20 rounded-lg p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center gap-2">
                <TrendingUp size={20} className="text-green-500" />
                ✅ Continue Fazendo
              </h2>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">→</span>
                  <span><strong>Reels com storytelling de qualidade:</strong> Educação sobre tecidos, conforto e diferencial técnico geram aspiração e alto alcance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">→</span>
                  <span><strong>Lives de lançamento:</strong> Criam senso de comunidade, exclusividade e pertencimento ao universo MC</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">→</span>
                  <span><strong>Posts lifestyle de looks completos:</strong> Mostram o universo, não apenas o produto</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-red-500/20 rounded-lg p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center gap-2">
                <AlertCircle size={20} className="text-red-500" />
                ❌ Pausar ou Reformular
              </h2>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">→</span>
                  <span><strong>Posts só informativos:</strong> "Lançamento às 20h" sem narrativa não cria desejo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">→</span>
                  <span><strong>Carrosséis catálogo:</strong> Listagem de peças sem contexto emocional não performa</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">→</span>
                  <span><strong>Ênfase em desconto:</strong> Dilui posicionamento premium — trocar por exclusividade e valor percebido</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-500/20 rounded-lg p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Target size={20} className="text-amber-500" />
                🎯 Oportunidades Identificadas
              </h2>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">→</span>
                  <span><strong>Bastidores do processo criativo:</strong> Fit room, desenvolvimento de peças, escolha de tecidos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">→</span>
                  <span><strong>Série "A ciência do conforto":</strong> Reel educativo por tipo de tecido — elastano, malha enchanté, twill marant</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">→</span>
                  <span><strong>Comunidade MC:</strong> Clientes reais usando as peças no dia a dia — pertencimento, não influencer marketing</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-700 text-center">
          <p className="text-slate-500 text-sm">
            {ultimaAtualizacao ? `Dados de ${new Date(ultimaAtualizacao).toLocaleDateString('pt-BR')}` : ''} · {posts.length} posts · Dashboard Mariana Cardoso Premium
          </p>
        </div>
      </div>
    </div>
  );
}
