import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GerarPlanoProducao from "@/components/plano-producao/GerarPlanoProducao";
import ListaPlanos from "@/components/plano-producao/ListaPlanos";

export default function PlanoProducao() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plano de Produção</h1>

      <Tabs defaultValue="gerar">
        <TabsList>
          <TabsTrigger value="gerar">Gerar Plano</TabsTrigger>
          <TabsTrigger value="planos">Planos Salvos</TabsTrigger>
        </TabsList>

        <TabsContent value="gerar" className="mt-4">
          <GerarPlanoProducao onSaved={() => setRefreshKey((k) => k + 1)} />
        </TabsContent>

        <TabsContent value="planos" className="mt-4">
          <ListaPlanos refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
