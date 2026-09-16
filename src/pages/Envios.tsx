import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AcompanhamentoTab } from "@/components/envios/AcompanhamentoTab";
import { DesempenhoTab } from "@/components/envios/DesempenhoTab";
import { ConfiguracoesTab } from "@/components/envios/ConfiguracoesTab";

export default function Envios() {
  const [aba, setAba] = useState("acompanhamento");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-2xl">Rastreio de Envios</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe cada pedido a caminho, resolva o que travou e veja o desempenho das transportadoras.
        </p>
      </header>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
          <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="acompanhamento" className="mt-4">
          <AcompanhamentoTab />
        </TabsContent>
        <TabsContent value="desempenho" className="mt-4">
          <DesempenhoTab />
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          <ConfiguracoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
