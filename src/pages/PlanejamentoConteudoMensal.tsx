import { useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LayoutGrid, CalendarDays, Printer, ExternalLink } from "lucide-react";

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

  const matrizRef = useRef<HTMLIFrameElement>(null);
  const calendarioRef = useRef<HTMLIFrameElement>(null);

  const imprimir = (ref: React.RefObject<HTMLIFrameElement>, src: string) => {
    const win = ref.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    } else {
      window.open(src, "_blank", "noopener");
    }
  };

  return (
    <div className="space-y-4 -mx-4 sm:mx-0">
      <div className="px-4 sm:px-0 flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-serif font-bold text-foreground">
            Planejamento de <span className="text-primary">Conteúdo Mensal</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Matriz de replicação e calendário de roteiros por mês
          </p>
        </div>
        <Select value={mesId} onValueChange={setMesId}>
          <SelectTrigger className="w-full sm:w-[200px]">
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
        <div className="px-4 sm:px-0 overflow-x-auto">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex h-auto">
            <TabsTrigger value="matriz" className="gap-2 text-xs sm:text-sm whitespace-normal py-2">
              <LayoutGrid className="h-4 w-4 shrink-0" /> Matriz de Replicação
            </TabsTrigger>
            <TabsTrigger value="calendario" className="gap-2 text-xs sm:text-sm whitespace-normal py-2">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Calendário &amp; Roteiros — {mes.label}</span>
              <span className="sm:hidden">Calendário &amp; Roteiros</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="matriz" className="mt-4 space-y-3">
          <div className="px-4 sm:px-0 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(mes.matriz, "_blank", "noopener")}>
              <ExternalLink className="h-4 w-4 mr-2" /> Abrir em nova aba
            </Button>
            <Button size="sm" onClick={() => imprimir(matrizRef, mes.matriz)}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir
            </Button>
          </div>
          <iframe
            ref={matrizRef}
            key={`matriz-${mes.id}`}
            src={mes.matriz}
            title={`Matriz de Replicação — ${mes.label}`}
            className="w-full h-[70vh] sm:h-[calc(100vh-190px)] min-h-[520px] border-0 bg-background"
          />
        </TabsContent>

        <TabsContent value="calendario" className="mt-4 space-y-3">
          <div className="px-4 sm:px-0 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(mes.calendario, "_blank", "noopener")}>
              <ExternalLink className="h-4 w-4 mr-2" /> Abrir em nova aba
            </Button>
            <Button size="sm" onClick={() => imprimir(calendarioRef, mes.calendario)}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir
            </Button>
          </div>
          <iframe
            ref={calendarioRef}
            key={`cal-${mes.id}`}
            src={mes.calendario}
            title={`Calendário e Roteiros — ${mes.label}`}
            className="w-full h-[70vh] sm:h-[calc(100vh-190px)] min-h-[520px] border-0 bg-background"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
