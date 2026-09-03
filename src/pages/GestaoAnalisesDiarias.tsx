import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Gestao from "./Gestao";
import JornadaCompra from "./JornadaCompra";
import KpisConversao from "./KpisConversao";
import PadroesPedidos from "./PadroesPedidos";

export default function GestaoAnalisesDiarias() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight">Análises Diárias</h1>
        <p className="text-sm text-muted-foreground">
          Rotina de acompanhamento: checklist, auditorias, jornada, conversão e padrões.
        </p>
      </div>

      <Tabs defaultValue="checklist" className="space-y-5">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="checklist">Checklist e Auditorias</TabsTrigger>
          <TabsTrigger value="jornada">Jornada de Compra</TabsTrigger>
          <TabsTrigger value="kpis">KPIs de Conversão</TabsTrigger>
          <TabsTrigger value="padroes">Padrões de Pedidos</TabsTrigger>
        </TabsList>
        <TabsContent value="checklist"><div className="-m-6"><Gestao /></div></TabsContent>
        <TabsContent value="jornada"><div className="-m-6"><JornadaCompra /></div></TabsContent>
        <TabsContent value="kpis"><div className="-m-6"><KpisConversao /></div></TabsContent>
        <TabsContent value="padroes"><div className="-m-6"><PadroesPedidos /></div></TabsContent>
      </Tabs>
    </div>
  );
}
