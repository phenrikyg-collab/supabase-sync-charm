import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Produtos from "./pages/Produtos";
import ProdutoForm from "./pages/ProdutoForm";
import Cores from "./pages/Cores";
import EstoqueTecidos from "./pages/EstoqueTecidos";
import OrdensCorte from "./pages/OrdensCorte";
import NovaOrdemCorte from "./pages/NovaOrdemCorte";
import OrdensProducao from "./pages/OrdensProducao";
import Producao from "./pages/Producao";
import Expedicao from "./pages/Expedicao";
import Financeiro from "./pages/Financeiro";
import Metas from "./pages/Metas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/produtos/novo" element={<ProdutoForm />} />
            <Route path="/produtos/:id" element={<ProdutoForm />} />
            <Route path="/produtos/:id/editar" element={<ProdutoForm />} />
            <Route path="/cores" element={<Cores />} />
            <Route path="/estoque" element={<EstoqueTecidos />} />
            <Route path="/ordens-corte" element={<OrdensCorte />} />
            <Route path="/ordens-corte/nova" element={<NovaOrdemCorte />} />
            <Route path="/ordens-producao" element={<OrdensProducao />} />
            <Route path="/producao" element={<Producao />} />
            <Route path="/expedicao" element={<Expedicao />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/metas" element={<Metas />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
