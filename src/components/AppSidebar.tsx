import {
  LayoutDashboard, Package, Plus, Palette, Scissors, Factory,
  Truck, DollarSign, Target, FileText, Building2, LogOut, Users, Home, BarChart3, Upload, Layers,
  ShoppingBag, Banknote, Wrench, CreditCard, PieChart, Monitor, Settings, Trophy, CalendarDays, TrendingUp, ClipboardList, Megaphone, Tag, Sparkles, Heart, LayoutGrid,
  Compass, Boxes, UserSquare2, Link as LinkIcon, MessageCircle, Workflow, Mail, ShoppingCart, PackageX, Radar, Ticket,
  BellRing, Instagram,
  BadgeDollarSign,
  Filter,
  CheckCircle2,
  Zap,
  Repeat,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserModules, AppModule } from "@/hooks/useUserModules";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ModuleGroup {
  key?: AppModule;
  adminOnly?: boolean;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
}

const moduleGroups: ModuleGroup[] = [
  {
    key: "gestao",
    label: "Gestão & Estratégia",
    icon: Compass,
    items: [
      { title: "Checklist e Auditorias", url: "/gestao", icon: ClipboardList },
      { title: "Dashboard Comercial", url: "/dashboard-comercial", icon: LayoutDashboard },
      { title: "Meta Ads", url: "/marketing?tab=meta-ads", icon: Megaphone },
      { title: "Google Ads", url: "/google-ads", icon: Megaphone },
      { title: "Dashboard GA4", url: "/marketing", icon: BarChart3 },
      { title: "Dashboard RFM", url: "/dashboard-rfm", icon: UserSquare2 },
      { title: "Jornada de Compra", url: "/jornada-compra", icon: Repeat },
      { title: "KPIs de Conversão", url: "/kpis-conversao", icon: TrendingUp },
      { title: "Padrões de Pedidos", url: "/padroes-pedidos", icon: BarChart3 },
      { title: "Meta Mensal", url: "/metas", icon: Target },
      { title: "Planejamento Mensal", url: "/planejamento/mensal", icon: CalendarDays },
      { title: "Plano Comercial", url: "/plano-comercial", icon: Target },
      { title: "Visão Anual", url: "/planejamento/anual", icon: BarChart3 },
      { title: "Simulador", url: "/planejamento/simulador", icon: Target },
    ],
  },
  {
    key: "comercial",
    label: "Comercial",
    icon: ShoppingBag,
    items: [
      { title: "Produtos & Campanha", url: "/produtos-campanha", icon: Tag },
      { title: "Lançamentos & Reposições", url: "/lancamentos", icon: Sparkles },
      { title: "Dashboard de Produtos", url: "/dashboard-produtos", icon: Boxes },
      { title: "Ordens de Produção", url: "/ordens-producao", icon: LayoutGrid },
      { title: "Bonificação WhatsApp", url: "/bonificacao-whatsapp", icon: Trophy },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    icon: Megaphone,
    items: [
      { title: "Criativos", url: "/marketing?tab=criativos", icon: Sparkles },
      { title: "Analytics Instagram", url: "/marketing-analytics", icon: Sparkles },
      { title: "Social Commerce", url: "/social-commerce", icon: Instagram },
      { title: "Grupo VIP", url: "/grupo-vip", icon: Users },
      { title: "Matriz Criativa", url: "/marketing/matriz-criativa", icon: Sparkles },
      { title: "Planejamento de Conteúdo", url: "/planejamento-conteudo-mensal", icon: CalendarDays },
      { title: "Tendências", url: "/tendencias", icon: TrendingUp },
      { title: "Embaixadoras", url: "/embaixadoras", icon: Heart },
      { title: "Link na Bio", url: "/link-na-bio", icon: LinkIcon },
      { title: "Prova Social", url: "/prova-social", icon: BellRing },
      { title: "WhatsApp: Templates, Segmentos e Campanhas", url: "/marketing-whatsapp", icon: MessageCircle },
    ],
  },
  {
    key: "crm",
    label: "CRM & Relacionamento",
    icon: Mail,
    items: [
      { title: "E-mail: Listas, Templates e Campanhas", url: "/email-marketing", icon: Mail },
      { title: "Cupons", url: "/cupons", icon: Ticket },
      { title: "Conteúdo & CRM", url: "/conteudo", icon: CalendarDays },
      { title: "Fluxos", url: "/automacoes", icon: Workflow },
    ],
  },
  {
    key: "atendimento",
    label: "Atendimento & Venda Direta",
    icon: MessageCircle,
    items: [
      { title: "WhatsApp", url: "/atendimento", icon: MessageCircle },
      { title: "Vendas ao Vivo", url: "/vendas-ao-vivo", icon: Zap },
      { title: "Funil WhatsApp", url: "/funil-whatsapp", icon: Filter },
      { title: "Propor Carrinho", url: "/propor-carrinho", icon: ShoppingCart },
      { title: "Carrinho Abandonado", url: "/carrinho-abandonado", icon: ShoppingCart },
      { title: "Pedidos Cancelados", url: "/pedidos-cancelados", icon: PackageX },
      { title: "Visitantes ao Vivo", url: "/rastreamento", icon: Radar },
      { title: "Audiência", url: "/audiencia", icon: UserSquare2 },
      { title: "Provador Virtual", url: "/provador-virtual", icon: Sparkles },
    ],
  },
  {
    key: "producao",
    label: "Produção & Estoque",
    icon: Wrench,
    items: [
      { title: "Plano de Produção", url: "/plano-producao", icon: ClipboardList },
      { title: "Ordem de Produção", url: "/ordens-producao", icon: Factory },
      { title: "Nova Ordem de Corte", url: "/ordens-corte/nova", icon: Scissors },
      { title: "Ordem de Corte", url: "/ordens-corte", icon: Scissors },
      { title: "Oficinas", url: "/oficinas", icon: Building2 },
      { title: "Oficina Interna", url: "/oficina-interna", icon: Home },
      { title: "Estoque Tecidos", url: "/estoque", icon: Layers },
      { title: "Entrada NF", url: "/entrada-nf", icon: FileText },
      { title: "Aviamentos", url: "/aviamentos", icon: Scissors },
      { title: "Bonificação Produção", url: "/bonificacao", icon: Trophy },
    ],
  },
  {
    key: "logistica",
    label: "Logística",
    icon: Truck,
    items: [
      { title: "Bonificação Expedição", url: "/bonificacao-expedicao", icon: Trophy },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    icon: Banknote,
    items: [
      { title: "Dashboard", url: "/dashboard-financeiro", icon: PieChart },
      { title: "Fluxo de Caixa", url: "/fluxo-caixa", icon: TrendingUp },
      { title: "Transações", url: "/financeiro", icon: DollarSign },
      { title: "Contas a Pagar", url: "/contas-pagar", icon: CreditCard },
      { title: "Contas a Receber", url: "/contas-receber", icon: DollarSign },
      { title: "DRE", url: "/dre", icon: BarChart3 },
      { title: "Importar Extrato", url: "/importar-extrato", icon: Upload },
      { title: "Faturas Cartão", url: "/faturas", icon: CreditCard },
      { title: "Transações do Site", url: "/transacoes-site", icon: ShoppingCart },
      { title: "Vindi / Yapay", url: "/vindi-yapay", icon: CreditCard },
      { title: "Banco Inter", url: "/banco-inter", icon: Banknote },
      { title: "Conciliação Pix WhatsApp", url: "/conciliacao-pix-whatsapp", icon: CheckCircle2 },
      { title: "Orçamento", url: "/orcamento", icon: Target },
      { title: "Custos Fixos", url: "/custos-fixos", icon: TrendingUp },
      { title: "Pgto Oficinas", url: "/pagamento-oficinas", icon: DollarSign },
    ],
  },
  {
    key: "rh",
    label: "Recursos Humanos",
    icon: Users,
    items: [
      { title: "Funcionários", url: "/funcionarios?tab=funcionarios", icon: Users },
      { title: "Folha do Mês", url: "/funcionarios?tab=folha", icon: Banknote },
      { title: "Lote PIX · Inter", url: "/funcionarios?tab=lote", icon: CreditCard },
      { title: "Holerites", url: "/funcionarios?tab=holerites", icon: FileText },
      { title: "Histórico", url: "/funcionarios?tab=historico", icon: ClipboardList },
    ],
  },
  {
    key: "cadastros",
    label: "Cadastros",
    icon: Settings,
    items: [
      { title: "Cadastro de Produto", url: "/produtos/novo", icon: Plus },
      { title: "Produtos", url: "/produtos", icon: Package },
      { title: "Cores", url: "/cores", icon: Palette },
      { title: "Cadastro de Tecidos", url: "/cadastro-tecidos", icon: Layers },
    ],
  },
  {
    adminOnly: true,
    label: "Acessos",
    icon: Users,
    items: [
      { title: "Acessos & Usuários", url: "/admin/usuarios", icon: Users },
    ],
  },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const { modules, isLoading: modulesLoading } = useUserModules();
  const location = useLocation();

  // Badge de conversas não lidas do Instagram (DM) — mesma regra da lista:
  // nao_lidas > 0 ou revisao_pendente. Atualiza em tempo real.
  const [igNaoLidas, setIgNaoLidas] = useState(0);
  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const { count, error } = await (supabase as any)
          .from("instagram_conversas")
          .select("id", { count: "exact", head: true })
          .or("nao_lidas.gt.0,revisao_pendente.eq.true");
        if (!error && ativo) setIgNaoLidas(count ?? 0);
      } catch {
        /* tabela/colunas indisponíveis — sem badge */
      }
    };
    carregar();
    const ch = supabase
      .channel("ig-badge-menu")
      .on("postgres_changes", { event: "*", schema: "public", table: "instagram_conversas" }, carregar)
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const visibleGroups = isAdmin
    ? moduleGroups
    : moduleGroups.filter((g) => !g.adminOnly && !!g.key && modules.includes(g.key));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        {/* Logo */}
        <div className={`px-4 py-5 ${collapsed ? "text-center" : ""}`}>
          {collapsed ? (
            <img src="/images/logo.png" alt="MC" className="w-8 h-8 mx-auto rounded" />
          ) : (
            <div className="flex items-center gap-3">
              <img src="/images/logo.png" alt="Mariana Cardoso" className="w-10 h-10 rounded" />
              <div>
                <h1 className="text-sidebar-primary-foreground font-serif text-xl font-bold tracking-tight">
                  Gestão
                </h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/80 mt-0.5">
                  Mariana Cardoso
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Module Groups */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {/* Module groups (Marketing inclui Dashboard GA4 + Conteúdo & CRM) */}
          {visibleGroups.map((group) => {
            const isGroupActive = group.items.some(
              (item) =>
                location.pathname === item.url ||
                (item.url !== "/" && location.pathname.startsWith(item.url))
            );

            return (
              <Collapsible key={group.label} defaultOpen={false}>
                <SidebarGroup>
                  <CollapsibleTrigger className="w-full">
                    <SidebarGroupLabel className="text-sidebar-foreground/80 uppercase tracking-widest text-[10px] cursor-pointer hover:text-sidebar-foreground transition-colors flex items-center justify-between w-full">
                      <span className="flex items-center gap-2">
                        <group.icon className="h-3.5 w-3.5" />
                        {!collapsed && group.label}
                      </span>
                      {!collapsed && (
                        <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                      )}
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items.map((item) => (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={item.url}
                                end={item.url === "/" || item.url === "/ordens-corte"}
                                className="relative transition-colors hover:bg-sidebar-accent text-sidebar-foreground/90"
                                activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                              >
                                <item.icon className="h-4 w-4 mr-2 shrink-0" />
                                {!collapsed && <span>{item.title}</span>}
                                {item.url === "/social-commerce" && igNaoLidas > 0 && (
                                  collapsed ? (
                                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />
                                  ) : (
                                    <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-danger-foreground">
                                      {igNaoLidas}
                                    </span>
                                  )
                                )}
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-3 pb-4 space-y-1">
          <Separator className="mb-2 bg-sidebar-border" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/tv-interna"
                  className="transition-colors hover:bg-sidebar-accent"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                >
                  <Monitor className="h-4 w-4 mr-2 shrink-0" />
                  {!collapsed && <span>TV Interna</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          {isAdmin && (
            <SidebarMenu>
              <SidebarMenuItem>

                <SidebarMenuButton asChild>
                  <NavLink
                    to="/admin/tv-interna"
                    className="transition-colors hover:bg-sidebar-accent"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <Settings className="h-4 w-4 mr-2 shrink-0" />
                    {!collapsed && <span>Gestão TV</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          )}
          {!collapsed && user && (
            <p className="text-[10px] text-sidebar-foreground/70 truncate px-2">{user.email}</p>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4 mr-2 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
