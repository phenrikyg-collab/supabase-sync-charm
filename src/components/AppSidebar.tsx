import {
  LayoutDashboard, Package, Plus, Palette, Scissors, Factory,
  Truck, DollarSign, Target, FileText, Building2, LogOut, Users, Home, BarChart3, Upload, Layers,
  ShoppingBag, Banknote, Wrench, CreditCard, PieChart, Monitor, Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserModules, AppModule } from "@/hooks/useUserModules";
import { useLocation } from "react-router-dom";
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
  key: AppModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
}

const moduleGroups: ModuleGroup[] = [
  {
    key: "comercial",
    label: "Comercial",
    icon: ShoppingBag,
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Meta Mensal", url: "/metas", icon: Target },
    ],
  },
  {
    key: "producao",
    label: "Produção",
    icon: Wrench,
    items: [
      { title: "Produtos", url: "/produtos", icon: Package },
      { title: "Cadastro Produto", url: "/produtos/novo", icon: Plus },
      { title: "Cores", url: "/cores", icon: Palette },
      { title: "Cadastro Tecidos", url: "/cadastro-tecidos", icon: Layers },
      { title: "Entrada NF", url: "/entrada-nf", icon: FileText },
      { title: "Estoque Tecidos", url: "/estoque", icon: Layers },
      { title: "Expedição", url: "/expedicao", icon: Truck },
      { title: "Nova Ordem Corte", url: "/ordens-corte/nova", icon: Scissors },
      { title: "Ordem de Corte", url: "/ordens-corte", icon: Scissors },
      { title: "Oficinas", url: "/oficinas", icon: Building2 },
      { title: "Oficina Interna", url: "/oficina-interna", icon: Home },
      { title: "Ordem Produção", url: "/ordens-producao", icon: Factory },
      { title: "Pgto Oficinas", url: "/pagamento-oficinas", icon: DollarSign },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    icon: Banknote,
    items: [
      { title: "Dashboard", url: "/dashboard-financeiro", icon: PieChart },
      { title: "Financeiro", url: "/financeiro", icon: DollarSign },
      { title: "Contas a Pagar", url: "/contas-pagar", icon: CreditCard },
      { title: "Contas a Receber", url: "/contas-receber", icon: DollarSign },
      { title: "DRE", url: "/dre", icon: BarChart3 },
      { title: "Importar Extrato", url: "/importar", icon: Upload },
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

  const visibleGroups = isAdmin
    ? moduleGroups
    : moduleGroups.filter((g) => modules.includes(g.key));

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
                <p className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60 mt-0.5">
                  Mariana Cardoso
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Module Groups */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {visibleGroups.map((group) => {
            const isGroupActive = group.items.some(
              (item) =>
                location.pathname === item.url ||
                (item.url !== "/" && location.pathname.startsWith(item.url))
            );

            return (
              <Collapsible key={group.key} defaultOpen={isGroupActive}>
                <SidebarGroup>
                  <CollapsibleTrigger className="w-full">
                    <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase tracking-widest text-[10px] cursor-pointer hover:text-sidebar-foreground/60 transition-colors flex items-center justify-between w-full">
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
                                className="transition-colors hover:bg-sidebar-accent"
                                activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                              >
                                <item.icon className="h-4 w-4 mr-2 shrink-0" />
                                {!collapsed && <span>{item.title}</span>}
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
                    to="/admin/usuarios"
                    className="transition-colors hover:bg-sidebar-accent"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <Users className="h-4 w-4 mr-2 shrink-0" />
                    {!collapsed && <span>Usuários</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
            <p className="text-[10px] text-sidebar-foreground/50 truncate px-2">{user.email}</p>
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
