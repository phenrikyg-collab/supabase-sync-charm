import {
  LayoutDashboard, Package, Plus, Palette, Layers, Scissors, Factory,
  Truck, DollarSign, Target, FileText, Building2, LogOut, Users,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Cadastro Produto", url: "/produtos/novo", icon: Plus },
  { title: "Cores", url: "/cores", icon: Palette },
  { title: "Entrada NF", url: "/entrada-nf", icon: FileText },
  { title: "Estoque Tecidos", url: "/estoque", icon: Layers },
  { title: "Nova Ordem Corte", url: "/ordens-corte/nova", icon: Scissors },
  { title: "Ordem de Corte", url: "/ordens-corte", icon: Scissors },
  { title: "Oficinas", url: "/oficinas", icon: Building2 },
  { title: "Ordem Produção", url: "/ordens-producao", icon: Factory },
  { title: "Pgto Oficinas", url: "/pagamento-oficinas", icon: DollarSign },
  { title: "Expedição", url: "/expedicao", icon: Truck },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Meta Mensal", url: "/metas", icon: Target },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
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

        <SidebarGroup className="flex-1">
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase tracking-widest text-[10px]">
            Módulos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
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
        </SidebarGroup>

        <div className="px-3 pb-4 space-y-1">
          <Separator className="mb-2 bg-sidebar-border" />
          {isAdmin && (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/admin/usuarios" className="transition-colors hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                    <Users className="h-4 w-4 mr-2 shrink-0" />
                    {!collapsed && <span>Usuários</span>}
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
