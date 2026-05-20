import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag } from "lucide-react";
import { AbaSugestoesAutomaticas } from "@/components/produtos-campanha/AbaSugestoesAutomaticas";
import { AbaEmCampanha } from "@/components/produtos-campanha/AbaEmCampanha";
import { AbaSugestoesVenda } from "@/components/produtos-campanha/AbaSugestoesVenda";
import { ConfigPrecificacao } from "@/components/produtos-campanha/ConfigPrecificacao";

export default function ProdutosCampanha() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-[1600px]">
      <div className="flex items-center gap-3">
        <Tag className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-serif text-foreground">Produtos & Campanha</h1>
          <p className="text-sm text-muted-foreground">
            Identifique produtos aptos, gerencie campanhas e consulte por tamanho
          </p>
        </div>
      </div>

      <Tabs defaultValue="sugestoes" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-4xl">
          <TabsTrigger value="sugestoes">Sugestões Automáticas</TabsTrigger>
          <TabsTrigger value="campanha">Em Campanha</TabsTrigger>
          <TabsTrigger value="venda">Sugestões de Venda</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>
        <TabsContent value="sugestoes" className="mt-6">
          <AbaSugestoesAutomaticas />
        </TabsContent>
        <TabsContent value="campanha" className="mt-6">
          <AbaEmCampanha />
        </TabsContent>
        <TabsContent value="venda" className="mt-6">
          <AbaSugestoesVenda />
        </TabsContent>
        <TabsContent value="config" className="mt-6">
          <ConfigPrecificacao />
        </TabsContent>
      </Tabs>
    </div>
  );
}
