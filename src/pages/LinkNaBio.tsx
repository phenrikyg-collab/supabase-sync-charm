import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BotoesTab } from "@/components/linkbio/BotoesTab";
import { ProdutosTab } from "@/components/linkbio/ProdutosTab";
import { LeadsTab } from "@/components/linkbio/LeadsTab";

export default function LinkNaBio() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-2xl md:text-3xl font-bold">Link na Bio</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie os botões, produtos em destaque e os leads capturados na página pública.
        </p>
      </header>

      <Tabs defaultValue="botoes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="botoes">Botões</TabsTrigger>
          <TabsTrigger value="produtos">Produtos em destaque</TabsTrigger>
          <TabsTrigger value="leads">Leads e métricas</TabsTrigger>
        </TabsList>
        <TabsContent value="botoes"><BotoesTab /></TabsContent>
        <TabsContent value="produtos"><ProdutosTab /></TabsContent>
        <TabsContent value="leads"><LeadsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
