import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, CalendarDays } from "lucide-react";

export default function PlanejamentoConteudoMensal() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
          Planejamento de <span className="text-primary">Conteúdo Mensal</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Matriz de replicação e calendário de roteiros
        </p>
      </div>

      <Tabs defaultValue="matriz" className="w-full">
        <TabsList>
          <TabsTrigger value="matriz" className="gap-2">
            <LayoutGrid className="h-4 w-4" /> Matriz de Replicação
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Calendário &amp; Roteiros — Agosto/26
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matriz" className="mt-4">
          <iframe
            src="/planejamento/matriz-replicacao.html"
            title="Matriz de Replicação"
            className="w-full h-[calc(100vh-120px)] border-0"
          />
        </TabsContent>

        <TabsContent value="calendario" className="mt-4">
          <iframe
            src="/planejamento/calendario-agosto-2026.html"
            title="Calendário e Roteiros — Agosto 2026"
            className="w-full h-[calc(100vh-120px)] border-0"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
