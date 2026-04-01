import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy } from "lucide-react";
import TabFichasTecnicas from "@/components/bonificacao/TabFichasTecnicas";
import CostureirasSection from "@/components/bonificacao/CostureirasSection";
import { LancamentoDiario, AcompanhamentoOrdem } from "@/components/bonificacao/ProducaoSections";
import CalculadoraBonusCostureiras from "@/components/bonificacao/CalculadoraBonusCostureiras";
import TabRevisao from "@/components/bonificacao/TabRevisao";
import TabConfiguracoes from "@/components/bonificacao/TabConfiguracoes";

export default function Bonificacao() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-primary">Bonificação</h1>
      </div>

      <Tabs defaultValue="fichas" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fichas">Fichas Técnicas</TabsTrigger>
          <TabsTrigger value="producao">Produção</TabsTrigger>
          <TabsTrigger value="revisao">Revisão</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="fichas">
          <TabFichasTecnicas />
        </TabsContent>

        <TabsContent value="producao">
          <div className="space-y-6">
            <CostureirasSection />
            <LancamentoDiario />
            <AcompanhamentoOrdem />
            <CalculadoraBonusCostureiras />
          </div>
        </TabsContent>

        <TabsContent value="revisao">
          <TabRevisao />
        </TabsContent>

        <TabsContent value="config">
          <TabConfiguracoes />
        </TabsContent>
      </Tabs>
    </div>
  );
}
