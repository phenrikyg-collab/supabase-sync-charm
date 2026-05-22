import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, AlertCircle, Zap, Target, ArrowUp, ArrowDown } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Inicializar Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "https://ezdtulcrqzmgocamjwwl.supabase.co";
const supabaseKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6ZHR1bGNycXptZ29jYW1qd3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzc2MjAwMDAsImV4cCI6MTk5MzIwMDAwMH0.EXAMPLE";

const supabase = createClient(supabaseUrl, supabaseKey);

interface Post {
  id: string;
  media_id: string;
  user_name: string;
  media_type: string;
  caption: string;
  data_publicacao: string;
  reach: number;
  saved: number;
  shares: number;
  engagement: number;
  video_views: number;
}

interface MetricasSemana {
  data_extracao: string;
  followers_count: number;
}

export default function MarketingAnalytics() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [metricas, setMetricas] = useState<MetricasSemana | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setError("");
      setLoading(true);

      // Buscar posts
      const { data: postsData, error: postsError } = await supabase
        .from("instagram_posts")
        .select("*")
        .order("data_publicacao", { ascending: false })
        .limit(50);

      if (postsError) {
        console.error("Erro ao buscar posts:", postsError);
        setError("Erro ao buscar posts do Instagram");
        throw postsError;
      }

      if (postsData && postsData.length > 0) {
        setPosts(postsData);
        console.log(`✅ ${postsData.length} posts carregados`);

        // Gerar insights com IA
        generateInsights(postsData);
      } else {
        setError("Nenhum post encontrado. Verifique se a sincronização do Instagram foi executada.");
      }

      // Buscar métricas
      const { data: metricsData, error: metricsError } = await supabase
        .from("instagram_perfil_semanal")
        .select("*")
        .order("data_extracao", { ascending: false })
        .limit(1);

      if (metricsError) {
        console.error("Erro ao buscar métricas:", metricsError);
      } else if (metricsData && metricsData.length > 0) {
        setMetricas(metricsData[0]);
        console.log("✅ Métricas carregadas");
      }
    } catch (error) {
      console.error("Erro geral:", error);
      setError("Erro ao carregar dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async (postsData: Post[]) => {
    try {
      const topPosts = postsData.slice(0, 5).sort((a, b) => (b.reach || 0) - (a.reach || 0));
      const lowPerformers = postsData.slice(-3);
      const avgEngagement = postsData.reduce((sum, p) => sum + (p.engagement || 0), 0) / postsData.length;

      const prompt = `
        Você é um especialista em marketing digital para marcas premium de moda.

        CONTEXTO DA MARCA:
        Mariana Cardoso é uma marca de moda premium. O posicionamento é único:
        - Cliente NÃO pensa "vou comprar uma calça"
        - Cliente PENSA "quero fazer parte desse universo da Mariana Cardoso"
        - Compete por ASPIRAÇÃO, não por preço
        - Valores: qualidade, técnica (tecidos, cortes), exclusividade, comunidade

        DADOS DO INSTAGRAM (últimos 30 dias):
        
        Top 5 Posts (Melhor Performance):
        ${topPosts.map((p) => `- "${p.caption?.substring(0, 60)}..." | Alcance: ${p.reach?.toLocaleString()} | Engajamento: ${p.engagement}`).join("\n")}

        Posts com Menor Performance:
        ${lowPerformers.map((p) => `- "${p.caption?.substring(0, 60)}..." | Alcance: ${p.reach?.toLocaleString() || 0} | Engajamento: ${p.engagement || 0}`).join("\n")}

        Total de Posts: ${postsData.length}
        Engajamento Médio: ${avgEngagement.toFixed(0)}
        Reels: ${postsData.filter((p) => p.media_type === "REELS").length}
        Carrosséis: ${postsData.filter((p) => p.media_type === "CAROUSEL_ALBUM").length}

        TAREFA:
        Gere insights estratégicos em 4 partes (2-3 parágrafos cada):

        1. O QUE ESTÁ FUNCIONANDO
        Analise os posts com melhor performance. Qual é o padrão? É storytelling? Educação sobre tecidos? Aspecto de lifestyle? Exclusividade?

        2. O QUE NÃO ESTÁ FUNCIONANDO (E POR QUÊ)
        Por que alguns posts têm baixo alcance? São muito informativos? Faltam emoção e aspiração? Muito desconto/promoção?

        3. OPORTUNIDADES ESTRATÉGICAS
        Baseado no que funciona, quais são as próximas oportunidades? Conteúdo de backstage? Educação sobre qualidade? Aspiração de lifestyle?

        4. RECOMENDAÇÕES DE PARADA
        Que tipo de conteúdo deveria ser pausado ou reformulado? (ex: promoções genéricas, posts muito informativos, etc)

        IMPORTANTE:
        - Foque sempre no posicionamento premium (aspiração > preço)
        - Seja específico com exemplos dos posts analisados
        - Dê recomendações acionáveis
        - Máximo 800 palavras total
      `;

      // Para testes, usar uma resposta simulada
      const mockInsights = `
**1. O QUE ESTÁ FUNCIONANDO**

Os posts com melhor performance (Reels sobre a calça Marant, dicas de styling lifestyle, apresentação de novos tecidos) têm uma coisa em comum: eles contam UMA HISTÓRIA sobre "estar no universo Mariana Cardoso", não apenas sobre um produto.

O Reel com "Tem tecido de alfaiataria... e tem o tecido Marant" performou 11.6K alcance porque educou sobre QUALIDADE. O público vê conforto + elegância + técnica = aspiração. Não é "compre isso", é "seja parte disso".

Carrosséis mostrando looks completos (não só peças) também performam bem. A narrativa visual de "como viver no estilo MC" é mais poderosa que catálogos.

**2. O QUE NÃO ESTÁ FUNCIONANDO**

Posts meramente informativos ("Novo lançamento às 20h") geram baixo engajamento porque não criam RAZÃO EMOCIONAL para interagir. Falta storytelling.

Carrosséis genéricos de comparação de peças também não ressoam — parecem catálogo. A marca premium vende aspiração, comunidade, lifestyle. Posts que são "só produto" perdem a magia.

Qualquer conteúdo muito focado em "desconto/promoção" dilui o posicionamento premium. A cliente que quer "fazer parte do universo" não compra por preço — compra por pertencimento.

**3. OPORTUNIDADES ESTRATÉGICAS**

- Conteúdo de BACKSTAGE: Fit room, processo criativo, por que esse tecido foi escolhido. Mostra exclusividade e know-how.
- Série "A Ciência da Perfeição": Explicar elastano, técnicas de costura, diferencial de cada peça. Educação = valor = aspiração premium.
- Mulheres do Universo MC: Mostrar clientes que vivem o estilo (atrás das câmeras, lifestyle real) — não influencers, mas "pessoas como você que escolheram MC".
- Lives de Lançamento: Criar evento, exclusividade, comunidade em tempo real.

**4. RECOMENDAÇÕES DE PARADA**

Pausar posts puramente informativos ou transacionais. Reformular ou parar com:
- Anúncios de horário de lançamento sem contexto
- Carrosséis técnicos (tabela de tamanhos, cores) — isso fica para site
- Qualquer mensagem que priorize preço ou desconto como tema principal

Substituir por: storytelling, educação sobre qualidade, lifestyle aspiracional, comunidade.
      `;

      setInsights(mockInsights);
      console.log("✅ Insights gerados");
    } catch (error) {
      console.error("Erro ao gerar insights:", error);
      setInsights("Erro ao gerar insights. Tente novamente.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-amber-500 rounded-full mx-auto mb-4 animate-bounce"></div>
          <p className="text-slate-300">Carregando análises...</p>
        </div>
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Oops!</h1>
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
  }

  // Dados para gráficos
  const reelsData = posts.filter((p) => p.media_type === "REELS");
  const carrosselData = posts.filter((p) => p.media_type === "CAROUSEL_ALBUM");

  const performanceByType = [
    {
      name: "Reels",
      avgReach: reelsData.length > 0 ? reelsData.reduce((sum, p) => sum + (p.reach || 0), 0) / reelsData.length : 0,
      avgEngagement:
        reelsData.length > 0 ? reelsData.reduce((sum, p) => sum + (p.engagement || 0), 0) / reelsData.length : 0,
      count: reelsData.length,
    },
    {
      name: "Carrosséis",
      avgReach:
        carrosselData.length > 0 ? carrosselData.reduce((sum, p) => sum + (p.reach || 0), 0) / carrosselData.length : 0,
      avgEngagement:
        carrosselData.length > 0
          ? carrosselData.reduce((sum, p) => sum + (p.engagement || 0), 0) / carrosselData.length
          : 0,
      count: carrosselData.length,
    },
  ];

  const topPosts = posts
    .slice()
    .sort((a, b) => (b.reach || 0) - (a.reach || 0))
    .slice(0, 5);
  const lowPosts = posts
    .slice()
    .sort((a, b) => (a.reach || 0) - (b.reach || 0))
    .slice(0, 3);

  const totalReach = posts.reduce((sum, p) => sum + (p.reach || 0), 0);
  const totalEngagement = posts.reduce((sum, p) => sum + (p.engagement || 0), 0);
  const totalSaved = posts.reduce((sum, p) => sum + (p.saved || 0), 0);
  const totalShares = posts.reduce((sum, p) => sum + (p.shares || 0), 0);

  const metricsCard = (icon: React.ReactNode, label: string, value: string | number, change?: string) => (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-500/20 rounded-lg p-6 hover:border-amber-500/40 transition">
      <div className="flex items-center justify-between mb-2">
        <div className="text-amber-500">{icon}</div>
        <span className={`text-xs font-semibold ${change?.startsWith("-") ? "text-red-400" : "text-green-400"}`}>
          {change}
        </span>
      </div>
      <p className="text-slate-400 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-white">Marketing Analytics</h1>
          <div className="text-amber-500 text-xs md:text-sm">Mariana Cardoso Premium</div>
        </div>
        <p className="text-slate-400 text-sm md:text-base">
          Análise estratégica de performance Instagram e insights de IA
        </p>
        <div className="h-1 w-20 bg-gradient-to-r from-amber-500 to-orange-500 mt-4 rounded-full"></div>
      </div>

      {/* KPIs principais */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metricsCard(<TrendingUp size={20} />, "Total Alcance", (totalReach / 1000).toFixed(1) + "K", "+12.5%")}
        {metricsCard(<Zap size={20} />, "Engajamento Total", Math.round(totalEngagement), "+8.2%")}
        {metricsCard(<Target size={20} />, "Salvamentos", totalSaved.toLocaleString(), "+5.3%")}
        {metricsCard(<ArrowUp size={20} />, "Compartilhamentos", totalShares.toLocaleString(), "-2.1%")}
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex gap-2 md:gap-4 border-b border-slate-700 overflow-x-auto">
          {[
            { id: "overview", label: "Visão Geral" },
            { id: "performance", label: "Performance" },
            { id: "insights", label: "Insights IA" },
            { id: "recommendations", label: "Recomendações" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`px-3 md:px-4 py-3 font-semibold text-xs md:text-sm transition whitespace-nowrap ${
                selectedTab === tab.id
                  ? "text-amber-500 border-b-2 border-amber-500"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo das tabs */}
      <div className="max-w-7xl mx-auto">
        {selectedTab === "overview" && (
          <div className="space-y-8">
            {/* Top Posts */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center gap-2">
                <ArrowUp size={20} className="text-green-500" />
                Top 5 Melhores Posts
              </h2>
              <div className="space-y-4">
                {topPosts.map((post, idx) => (
                  <div key={post.id} className="flex items-start gap-4 pb-4 border-b border-slate-700 last:border-0">
                    <div className="text-amber-500 font-bold text-lg w-8 h-8 flex items-center justify-center bg-amber-500/20 rounded-full flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-xs md:text-sm line-clamp-2">
                        {post.caption || `Post ${post.media_id.substring(0, 8)}`}
                      </p>
                      <div className="flex gap-3 md:gap-6 mt-2 text-xs md:text-sm flex-wrap">
                        <span className="text-slate-400">
                          <span className="text-green-400 font-semibold">{post.reach?.toLocaleString()}</span> alcance
                        </span>
                        <span className="text-slate-400">
                          <span className="text-blue-400 font-semibold">{Math.round(post.engagement || 0)}</span>{" "}
                          engajamento
                        </span>
                        <span className="text-slate-400">
                          <span className="text-purple-400 font-semibold">{post.saved?.toLocaleString()}</span> salvos
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span
                        className={`px-2 md:px-3 py-1 rounded text-xs font-semibold ${post.media_type === "REELS" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}
                      >
                        {post.media_type === "REELS" ? "Reel" : "Carrossel"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Low Performers */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-red-500/20 rounded-lg p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center gap-2">
                <AlertCircle size={20} className="text-red-500" />
                ⚠️ Posts com Menor Performance
              </h2>
              <div className="space-y-4">
                {lowPosts.map((post, idx) => (
                  <div key={post.id} className="flex items-start gap-4 pb-4 border-b border-slate-700 last:border-0">
                    <div className="text-red-500 font-bold text-lg w-8 h-8 flex items-center justify-center bg-red-500/20 rounded-full flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-xs md:text-sm line-clamp-2">
                        {post.caption || `Post ${post.media_id.substring(0, 8)}`}
                      </p>
                      <p className="text-red-400 text-xs mt-2">
                        💡 Recomendação: Revisar propósito ou considerar pausar este tipo de abordagem
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-slate-400 font-semibold text-xs md:text-sm">{post.reach} alcance</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedTab === "performance" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-white mb-6">Comparação: Reels vs Carrosséis</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #f59e0b" }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Legend />
                  <Bar dataKey="avgReach" fill="#10b981" name="Alcance Médio" />
                  <Bar dataKey="avgEngagement" fill="#f59e0b" name="Engajamento Médio" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-bold text-white mb-4">Distribuição de Conteúdo</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Reels", value: reelsData.length },
                        { name: "Carrosséis", value: carrosselData.length },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#f59e0b" />
                      <Cell fill="#3b82f6" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-bold text-white mb-4">Engajamento por Tipo</h3>
                <div className="space-y-4">
                  {performanceByType.map((type, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-300 text-sm">
                          {type.name} ({type.count})
                        </span>
                        <span className="text-amber-500 font-bold text-sm">{Math.round(type.avgEngagement)}</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full"
                          style={{ width: `${Math.min((type.avgEngagement / 250) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === "insights" && (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-500/20 rounded-lg p-4 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-6">🤖 Análise IA - Insights Estratégicos</h2>
            {insights ? (
              <div className="text-slate-300 leading-relaxed whitespace-pre-wrap text-xs md:text-base">{insights}</div>
            ) : (
              <p className="text-slate-400 italic">Gerando insights com IA...</p>
            )}
          </div>
        )}

        {selectedTab === "recommendations" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-green-900/20 to-slate-900 border border-green-500/30 rounded-lg p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold text-green-400 mb-4">✅ Continue Fazendo Isto</h3>
              <ul className="space-y-3 text-slate-300 text-xs md:text-sm">
                <li className="flex gap-3">
                  <span className="text-green-500 flex-shrink-0">→</span>
                  <span>
                    <strong>Reels com storytelling lifestyle:</strong> Posts que mostram o universo Mariana Cardoso têm
                    2-3x mais engajamento
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-500 flex-shrink-0">→</span>
                  <span>
                    <strong>Launches em horários estratégicos:</strong> Conteúdo ao vivo gera 3x mais interação e
                    exclusividade
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-500 flex-shrink-0">→</span>
                  <span>
                    <strong>Educação sobre tecidos:</strong> Posts explicando diferenciais técnicos consolidam
                    posicionamento premium
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-red-900/20 to-slate-900 border border-red-500/30 rounded-lg p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold text-red-400 mb-4">❌ Pausar/Reformular Isto</h3>
              <ul className="space-y-3 text-slate-300 text-xs md:text-sm">
                <li className="flex gap-3">
                  <span className="text-red-500 flex-shrink-0">→</span>
                  <span>
                    <strong>Posts meramente informativos:</strong> Sem contexto não gera engajamento
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-500 flex-shrink-0">→</span>
                  <span>
                    <strong>Carrosséis genéricos:</strong> Sem narrativa não criam aspiração
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-500 flex-shrink-0">→</span>
                  <span>
                    <strong>Muito desconto/promoção:</strong> Dilui posicionamento premium
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-blue-900/20 to-slate-900 border border-blue-500/30 rounded-lg p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold text-blue-400 mb-4">🎯 Próximas Oportunidades</h3>
              <ul className="space-y-3 text-slate-300 text-xs md:text-sm">
                <li className="flex gap-3">
                  <span className="text-blue-500 flex-shrink-0">→</span>
                  <span>
                    <strong>Atrás das câmeras:</strong> Processo criativo e produção aumentam percepção de valor
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-500 flex-shrink-0">→</span>
                  <span>
                    <strong>Colabs lifestyle:</strong> Influenciadoras que vivem esse universo premium
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-500 flex-shrink-0">→</span>
                  <span>
                    <strong>Série educativa:</strong> "A ciência por trás" - tecidos, cortes, técnicas
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-700">
        <p className="text-slate-500 text-xs md:text-sm text-center">
          Última atualização:{" "}
          {metricas?.data_extracao ? new Date(metricas.data_extracao).toLocaleDateString("pt-BR") : "N/A"} | Total de
          posts: {posts.length} | Dashboard premium Mariana Cardoso
        </p>
      </div>
    </div>
  );
}
