import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import DashboardComercialPage from "./pages/DashboardComercialPage";
import Produtos from "./pages/Produtos";
import ProdutoForm from "./pages/ProdutoForm";
import Cores from "./pages/Cores";
import EntradaNF from "./pages/EntradaNF";
import EstoqueTecidos from "./pages/EstoqueTecidos";
import CadastroTecidos from "./pages/CadastroTecidos";
import OrdensCorte from "./pages/OrdensCorte";
import NovaOrdemCorte from "./pages/NovaOrdemCorte";
import Oficinas from "./pages/Oficinas";
import OficinaInterna from "./pages/OficinaInterna";
import OrdensProducao from "./pages/OrdensProducao";
import Producao from "./pages/Producao";

import Financeiro from "./pages/Financeiro";
import TransacoesSite from "./pages/TransacoesSite";
import VindiYapay from "./pages/VindiYapay";
import BancoInter from "./pages/BancoInter";
import ConciliacaoPixWhatsApp from "./pages/ConciliacaoPixWhatsApp";
import ProvaSocial from "./pages/ProvaSocial";
import SocialCommerce from "./pages/SocialCommerce";
import GrupoVip from "./pages/GrupoVip";
import ContasPagar from "./pages/ContasPagar";
import ContasReceber from "./pages/ContasReceber";
import DRE from "./pages/DRE";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import ImportarExtrato from "./pages/ImportarExtrato";
import Faturas from "./pages/Faturas";
import FluxoCaixa from "./pages/FluxoCaixa";
import ImportarPage from "./pages/ImportarPage";
import Metas from "./pages/Metas";
import PagamentoOficinas from "./pages/PagamentoOficinas";
import AdminUsuarios from "./pages/AdminUsuarios";
import Login from "./pages/Login";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Ciencia from "./pages/Ciencia";
import TVInterna from "./pages/TVInterna";
import AdminTVInterna from "./pages/AdminTVInterna";
import Bonificacao from "./pages/Bonificacao";
import BonificacaoWhatsAppPage from "./pages/BonificacaoWhatsAppPage";
import BonificacaoExpedicao from "./pages/BonificacaoExpedicao";
import ContentCalendar from "./pages/ContentCalendar";
import OrcamentoPage from "./pages/OrcamentoPage";
import CustosFixos from "./pages/CustosFixos";
import PlanoProducao from "./pages/PlanoProducao";
import Marketing from "./pages/Marketing";
import PadroesPedidos from "./pages/PadroesPedidos";
import ProdutosCampanha from "./pages/ProdutosCampanha";
import PlanoComercial from "./pages/PlanoComercial";
import Lancamentos from "./pages/Lancamentos";
import MarketingAnalyticsPerfil from "./pages/marketing-analytics/Perfil";
import MAReels from "./pages/marketing-analytics/Reels";
import MACarrossel from "./pages/marketing-analytics/Carrossel";
import MAStories from "./pages/marketing-analytics/Stories";
import MAInsights from "./pages/marketing-analytics/Insights";
import MARelatorios from "./pages/marketing-analytics/Relatorios";
import MARecomendacoes from "./pages/marketing-analytics/Recomendacoes";
import Embaixadoras from "./pages/Embaixadoras";
import EmbaixadoraNova from "./pages/EmbaixadoraNova";
import EmbaixadoraPerfil from "./pages/EmbaixadoraPerfil";
import PlanejamentoAnual from "./pages/PlanejamentoAnual";
import PlanejamentoMensal from "./pages/PlanejamentoMensal";
import PlanejamentoSimulador from "./pages/PlanejamentoSimulador";
import MatrizCriativa from "./pages/MatrizCriativa";
import Aviamentos from "./pages/Aviamentos";
import Gestao from "./pages/Gestao";
import GestaoPlanejamento from "./pages/GestaoPlanejamento";
import GestaoMidiaPaga from "./pages/GestaoMidiaPaga";
import GestaoAnalisesDiarias from "./pages/GestaoAnalisesDiarias";
import JornadaCompra from "./pages/JornadaCompra";
import GoogleAds from "./pages/GoogleAds";
import SeoBlog from "./pages/SeoBlog";
import DashboardRFM from "./pages/DashboardRFM";
import DashboardProdutos from "./pages/DashboardProdutos";
import PlanejamentoConteudoMensal from "./pages/PlanejamentoConteudoMensal";
import Tendencias from "./pages/Tendencias";
import LinkNaBio from "./pages/LinkNaBio";
import Atendimento from "./pages/Atendimento";
import Audiencia from "./pages/Audiencia";
import CarrinhoAbandonado from "./pages/CarrinhoAbandonado";
import PedidosCancelados from "./pages/PedidosCancelados";
import Rastreamento from "./pages/Rastreamento";
import KpisConversao from "./pages/KpisConversao";
import FunilWhatsApp from "./pages/FunilWhatsApp";
import ProvadorVirtual from "./pages/ProvadorVirtual";
import Cupons from "./pages/Cupons";
import ProporCarrinhoPage from "./pages/ProporCarrinhoPage";
import VendasAoVivo from "./pages/VendasAoVivo";

import Funcionarios from "./pages/Funcionarios";
import Automacoes from "./pages/Automacoes";
import AutomacaoFluxo from "./pages/AutomacaoFluxo";
import EmailMarketing from "./pages/EmailMarketing";
import MarketingWhatsApp from "./pages/MarketingWhatsApp";
import EmailTemplateEditor from "./pages/EmailTemplateEditor";
import { Loader2 } from "lucide-react";
import { useUserModules, type AppModule } from "@/hooks/useUserModules";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { canAccess, requirementForPath, MODULE_HOME } from "@/lib/accessControl";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 5 * 60 * 1000, // 5 minutes auto-refresh
      staleTime: 2 * 60 * 1000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { modules, isLoading } = useUserModules();
  const { isAdmin, isLoading: rolesLoading } = useUserRole();
  if (isLoading || rolesLoading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (isAdmin) return <Navigate to="/dashboard-comercial" replace />;
  // Ordem de prioridade: primeiro módulo que o usuário tiver define a home dele.
  const order: AppModule[] = [
    "gestao",
    "comercial",
    "marketing",
    "crm",
    "atendimento",
    "producao",
    "logistica",
    "financeiro",
    "rh",
    "cadastros",
  ];
  const first = order.find((m) => modules.includes(m));
  if (!first) return <Navigate to="/tv-interna" replace />;
  return <Navigate to={MODULE_HOME[first]} replace />;
}

/** Bloqueia rotas sem permissão: redireciona para a home com toast. */
function ModuleGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { modules, isLoading } = useUserModules();
  const { isAdmin, isLoading: rolesLoading } = useUserRole();
  const { toast } = useToast();
  const loading = isLoading || rolesLoading;
  const allowed = canAccess(requirementForPath(location.pathname), isAdmin, modules);

  useEffect(() => {
    if (!loading && !allowed) {
      toast({
        title: "Acesso negado",
        description: "Você não tem acesso a este módulo",
        variant: "destructive",
      });
    }
  }, [loading, allowed, location.pathname]);

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (window.location.pathname === "/ciencia") return <Ciencia />;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/ciencia" element={<Ciencia />} />
      <Route path="/login" element={user ? <HomeRedirect /> : <Login />} />
      <Route path="/tv-interna" element={<ProtectedRoute><TVInterna /></ProtectedRoute>} />
      <Route path="/conteudo" element={<ProtectedRoute><ModuleGuard><ContentCalendar /></ModuleGuard></ProtectedRoute>} />
      <Route path="*" element={
        <ProtectedRoute>
          <AppLayout>
            <ModuleGuard>
            <Routes>
              <Route path="/dashboard-comercial" element={<DashboardComercialPage />} />
              <Route path="/dashboard-antigo" element={<Dashboard />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/produtos/novo" element={<ProdutoForm />} />
              <Route path="/produtos/:id" element={<ProdutoForm />} />
              <Route path="/produtos/:id/editar" element={<ProdutoForm />} />
              <Route path="/cores" element={<Cores />} />
              <Route path="/entrada-nf" element={<EntradaNF />} />
              <Route path="/estoque" element={<EstoqueTecidos />} />
              <Route path="/cadastro-tecidos" element={<CadastroTecidos />} />
              <Route path="/ordens-corte" element={<OrdensCorte />} />
              <Route path="/ordens-corte/nova" element={<NovaOrdemCorte />} />
              <Route path="/oficinas" element={<Oficinas />} />
              <Route path="/oficina-interna" element={<OficinaInterna />} />
              <Route path="/bonificacao" element={<Bonificacao />} />
              <Route path="/bonificacao-whatsapp" element={<BonificacaoWhatsAppPage />} />
              <Route path="/ordens-producao" element={<OrdensProducao />} />
              <Route path="/plano-producao" element={<PlanoProducao />} />
              <Route path="/pagamento-oficinas" element={<PagamentoOficinas />} />
              <Route path="/bonificacao-expedicao" element={<BonificacaoExpedicao />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/dashboard-financeiro" element={<DashboardFinanceiro />} />
              <Route path="/contas-pagar" element={<ContasPagar />} />
              <Route path="/contas-receber" element={<ContasReceber />} />
              <Route path="/dre" element={<DRE />} />
              <Route path="/importar-extrato" element={<ImportarExtrato />} />
              <Route path="/faturas" element={<Faturas />} />
              <Route path="/transacoes-site" element={<TransacoesSite />} />
              <Route path="/vindi-yapay" element={<VindiYapay />} />
              <Route path="/banco-inter" element={<BancoInter />} />
              <Route path="/conciliacao-pix-whatsapp" element={<ConciliacaoPixWhatsApp />} />
              <Route path="/prova-social" element={<ProvaSocial />} />
              <Route path="/social-commerce" element={<SocialCommerce />} />
              <Route path="/grupo-vip" element={<GrupoVip />} />
              <Route path="/fluxo-caixa" element={<FluxoCaixa />} />
              <Route path="/importar" element={<ImportarPage />} />
              <Route path="/metas" element={<Metas />} />
              <Route path="/admin/usuarios" element={<AdminUsuarios />} />
              <Route path="/orcamento" element={<OrcamentoPage />} />
              <Route path="/custos-fixos" element={<CustosFixos />} />
              <Route path="/admin/tv-interna" element={<AdminTVInterna />} />
              <Route path="/marketing" element={<Marketing />} />
              <Route path="/padroes-pedidos" element={<PadroesPedidos />} />
              <Route path="/produtos-campanha" element={<ProdutosCampanha />} />
              <Route path="/plano-comercial" element={<PlanoComercial />} />
              <Route path="/lancamentos" element={<Lancamentos />} />
              <Route path="/marketing-analytics" element={<MarketingAnalyticsPerfil />} />
              <Route path="/seo-blog" element={<SeoBlog />} />
              <Route path="/marketing-analytics/reels" element={<MAReels />} />
              <Route path="/marketing-analytics/carrossel" element={<MACarrossel />} />
              <Route path="/marketing-analytics/stories" element={<MAStories />} />
              <Route path="/marketing-analytics/insights" element={<MAInsights />} />
              <Route path="/marketing-analytics/relatorios" element={<MARelatorios />} />
              <Route path="/marketing-analytics/recomendacoes" element={<MARecomendacoes />} />
              <Route path="/embaixadoras" element={<Embaixadoras />} />
              <Route path="/embaixadoras/nova" element={<EmbaixadoraNova />} />
              <Route path="/embaixadoras/:id" element={<EmbaixadoraPerfil />} />
              <Route path="/planejamento/anual" element={<PlanejamentoAnual />} />
              <Route path="/planejamento/mensal" element={<PlanejamentoMensal />} />
              <Route path="/planejamento/simulador" element={<PlanejamentoSimulador />} />
              <Route path="/marketing/matriz-criativa" element={<MatrizCriativa />} />
              <Route path="/aviamentos" element={<Aviamentos />} />
              <Route path="/gestao" element={<Gestao />} />
              <Route path="/gestao/planejamento" element={<GestaoPlanejamento />} />
              <Route path="/gestao/midia-paga" element={<GestaoMidiaPaga />} />
              <Route path="/gestao/analises" element={<GestaoAnalisesDiarias />} />
              <Route path="/jornada-compra" element={<JornadaCompra />} />
              <Route path="/google-ads" element={<GoogleAds />} />
              <Route path="/dashboard-rfm" element={<DashboardRFM />} />
              <Route path="/dashboard-produtos" element={<DashboardProdutos />} />
              <Route path="/planejamento-conteudo-mensal" element={<PlanejamentoConteudoMensal />} />
              <Route path="/planejamento" element={<Navigate to="/planejamento-conteudo-mensal" replace />} />
              <Route path="/tendencias" element={<Tendencias />} />
              <Route path="/link-na-bio" element={<LinkNaBio />} />
              <Route path="/atendimento" element={<Atendimento />} />
              <Route path="/audiencia" element={<Audiencia />} />
              <Route path="/carrinho-abandonado" element={<CarrinhoAbandonado />} />
              <Route path="/pedidos-cancelados" element={<PedidosCancelados />} />
              <Route path="/rastreamento" element={<Rastreamento />} />
              <Route path="/funil-whatsapp" element={<FunilWhatsApp />} />
              <Route path="/kpis-conversao" element={<KpisConversao />} />
              <Route path="/provador-virtual" element={<ProvadorVirtual />} />
              <Route path="/cupons" element={<Cupons />} />
              <Route path="/propor-carrinho" element={<ProporCarrinhoPage />} />
              <Route path="/vendas-ao-vivo" element={<VendasAoVivo />} />



              <Route path="/funcionarios" element={<Funcionarios />} />
              <Route path="/automacoes" element={<Automacoes />} />
              <Route path="/email-marketing" element={<EmailMarketing />} />
              <Route path="/email-marketing/templates/:id" element={<EmailTemplateEditor />} />
              <Route path="/marketing-whatsapp" element={<MarketingWhatsApp />} />
              <Route path="/automacoes/:id" element={<AutomacaoFluxo />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </ModuleGuard>
          </AppLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
