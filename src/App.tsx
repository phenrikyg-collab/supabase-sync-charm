import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
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
import Expedicao from "./pages/Expedicao";
import Financeiro from "./pages/Financeiro";
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
import NotFound from "./pages/NotFound";
import TVInterna from "./pages/TVInterna";
import AdminTVInterna from "./pages/AdminTVInterna";
import Bonificacao from "./pages/Bonificacao";
import ContentCalendar from "./pages/ContentCalendar";
import OrcamentoPage from "./pages/OrcamentoPage";
import { Loader2 } from "lucide-react";

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

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/tv-interna" element={<TVInterna />} />
      <Route path="/conteudo" element={<ProtectedRoute><ContentCalendar /></ProtectedRoute>} />
      <Route path="*" element={
        <ProtectedRoute>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
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
              <Route path="/ordens-producao" element={<OrdensProducao />} />
              <Route path="/pagamento-oficinas" element={<PagamentoOficinas />} />
              <Route path="/expedicao" element={<Expedicao />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/dashboard-financeiro" element={<DashboardFinanceiro />} />
              <Route path="/contas-pagar" element={<ContasPagar />} />
              <Route path="/contas-receber" element={<ContasReceber />} />
              <Route path="/dre" element={<DRE />} />
              <Route path="/importar-extrato" element={<ImportarExtrato />} />
              <Route path="/faturas" element={<Faturas />} />
              <Route path="/fluxo-caixa" element={<FluxoCaixa />} />
              <Route path="/importar" element={<ImportarPage />} />
              <Route path="/metas" element={<Metas />} />
              <Route path="/admin/usuarios" element={<AdminUsuarios />} />
              <Route path="/orcamento" element={<OrcamentoPage />} />
              <Route path="/admin/tv-interna" element={<AdminTVInterna />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
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
