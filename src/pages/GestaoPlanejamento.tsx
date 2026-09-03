import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlanejamentoMensal from "./PlanejamentoMensal";
import PlanoComercial from "./PlanoComercial";
import PlanejamentoAnual from "./PlanejamentoAnual";
import PlanejamentoSimulador from "./PlanejamentoSimulador";

export default function GestaoPlanejamento() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight">Planejamento</h1>
        <p className="text-sm text-muted-foreground">
          Metas, plano comercial, visão anual e simulações de crescimento.
        </p>
      </div>

      <Tabs defaultValue="mensal" className="space-y-5">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="mensal">Planejamento Mensal</TabsTrigger>
          <TabsTrigger value="comercial">Plano Comercial</TabsTrigger>
          <TabsTrigger value="anual">Visão Anual</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
        </TabsList>
        <TabsContent value="mensal"><div className="-m-6"><PlanejamentoMensal /></div></TabsContent>
        <TabsContent value="comercial"><div className="-m-6"><PlanoComercial /></div></TabsContent>
        <TabsContent value="anual"><div className="-m-6"><PlanejamentoAnual /></div></TabsContent>
        <TabsContent value="simulador"><div className="-m-6"><PlanejamentoSimulador /></div></TabsContent>
      </Tabs>
    </div>
  );
}
