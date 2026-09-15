import * as React from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

function formatDate() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [open, setOpen] = React.useState(true);
  const estadoAnterior = React.useRef(true);

  // Atendimento precisa de largura para as três colunas: entra com o
  // sidebar recolhido e, ao sair, restaura o estado anterior. O efeito
  // só roda na troca de rota, então o botão manual continua valendo
  // enquanto a pessoa estiver na tela.
  React.useEffect(() => {
    if (pathname.startsWith("/atendimento")) {
      estadoAnterior.current = open;
      setOpen(false);
    } else {
      setOpen(estadoAnterior.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30 px-4">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground font-medium capitalize">{formatDate()}</span>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
