import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OrcamentoTabela from "@/components/OrcamentoTabela";
import OrcamentoComparativo from "@/components/OrcamentoComparativo";

export default function OrcamentoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Planejamento Orçamentário</h1>

      <Tabs defaultValue="orcamento">
        <TabsList>
          <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
        </TabsList>

        <TabsContent value="orcamento">
          <OrcamentoTabela />
        </TabsContent>

        <TabsContent value="comparativo">
          <OrcamentoComparativo />
        </TabsContent>
      </Tabs>
    </div>
  );
}
