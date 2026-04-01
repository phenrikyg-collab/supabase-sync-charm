import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import TabFichasTecnicas from "@/components/bonificacao/TabFichasTecnicas";
import CostureirasSection from "@/components/bonificacao/CostureirasSection";
import { LancamentoDiario, AcompanhamentoOrdem } from "@/components/bonificacao/ProducaoSections";
import TabRevisao from "@/components/bonificacao/TabRevisao";

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
          </div>
        </TabsContent>

        <TabsContent value="revisao">
          <TabRevisao />
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader><CardTitle className="text-lg text-primary">Configurações</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Em breve.</p></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
