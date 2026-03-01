import {
  LayoutDashboard, Package, Plus, Palette, Layers, Scissors, Factory,
  Kanban, Truck, DollarSign, Target, FileText, Building2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

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
  { title: "Produção", url: "/producao", icon: Kanban },
  { title: "Expedição", url: "/expedicao", icon: Truck },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Meta Mensal", url: "/metas", icon: Target },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`px-4 py-5 ${collapsed ? "text-center" : ""}`}>
          {collapsed ? (
            <span className="text-sidebar-primary font-serif text-lg font-bold">M</span>
          ) : (
            <div>
              <h1 className="text-sidebar-primary-foreground font-serif text-xl font-bold tracking-tight">
                Moda Gestão
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60 mt-0.5">
                Sistema de Confecção
              </p>
            </div>
          )}
        </div>

        <SidebarGroup>
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
      </SidebarContent>
    </Sidebar>
  );
}
