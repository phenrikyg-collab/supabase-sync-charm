import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Factory, ClipboardList } from "lucide-react";
import { AbaCalendario } from "@/components/conteudo/AbaCalendario";
import { AbaOrdensProducao } from "@/components/conteudo/AbaOrdensProducao";
import { AbaChecklistLancamento } from "@/components/conteudo/AbaChecklistLancamento";

export default function ContentCalendar() {
  const [tab, setTab] = useState("calendario");

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
          Conteúdo & <span className="text-primary">CRM</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Planejamento de conteúdo, produção e lançamentos
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="calendario" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Calendário & Conteúdo
          </TabsTrigger>
          <TabsTrigger value="ordens" className="gap-2">
            <Factory className="h-4 w-4" /> Ordens de Produção
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-2">
            <ClipboardList className="h-4 w-4" /> Checklist de Lançamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendario" className="mt-6">
          <AbaCalendario />
        </TabsContent>
        <TabsContent value="ordens" className="mt-6">
          <AbaOrdensProducao />
        </TabsContent>
        <TabsContent value="checklist" className="mt-6">
          <AbaChecklistLancamento />
        </TabsContent>
      </Tabs>
    </div>
  );
}
