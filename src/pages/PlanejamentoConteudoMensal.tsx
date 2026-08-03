import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutGrid, CalendarDays } from "lucide-react";

interface MesPlanejamento {
  id: string;
  label: string;
  matriz: string;
  calendario: string;
}

const MESES: MesPlanejamento[] = [
  {
    id: "2026-08",
    label: "Agosto / 2026",
    matriz: "/planejamento/matriz-replicacao.html",
    calendario: "/planejamento/calendario-agosto-2026.html",
  },
];

export default function PlanejamentoConteudoMensal() {
  const [mesId, setMesId] = useState(MESES[0].id);
  const mes = MESES.find((m) => m.id === mesId) ?? MESES[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
            Planejamento de <span className="text-primary">Conteúdo Mensal</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Matriz de replicação e calendário de roteiros por mês
          </p>
        </div>
        <Select value={mesId} onValueChange={setMesId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Selecione o mês" />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="matriz" className="w-full">
        <TabsList>
          <TabsTrigger value="matriz" className="gap-2">
            <LayoutGrid className="h-4 w-4" /> Matriz de Replicação
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Calendário &amp; Roteiros — {mes.label}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matriz" className="mt-4">
          <iframe
            key={`matriz-${mes.id}`}
            src={mes.matriz}
            title={`Matriz de Replicação — ${mes.label}`}
            className="w-full h-[calc(100vh-120px)] border-0"
          />
        </TabsContent>

        <TabsContent value="calendario" className="mt-4">
          <iframe
            key={`cal-${mes.id}`}
            src={mes.calendario}
            title={`Calendário e Roteiros — ${mes.label}`}
            className="w-full h-[calc(100vh-120px)] border-0"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
