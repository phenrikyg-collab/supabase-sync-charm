import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisaoGeralTab } from "@/components/avaliacoes/VisaoGeralTab";
import { ModeracaoTab } from "@/components/avaliacoes/ModeracaoTab";
import { TodasTab } from "@/components/avaliacoes/TodasTab";
import { ConfigReguaTab } from "@/components/avaliacoes/ConfigReguaTab";

export default function Avaliacoes() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-2xl">Avaliações</h1>
        <p className="text-sm text-muted-foreground">
          Régua de pedido de avaliação, moderação e respostas da loja.
        </p>
      </header>

      <Tabs defaultValue="moderacao">
        <TabsList>
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="moderacao">Moderação</TabsTrigger>
          <TabsTrigger value="todas">Todas as avaliações</TabsTrigger>
          <TabsTrigger value="config">Configuração da régua</TabsTrigger>
        </TabsList>

        <TabsContent value="visao">
          <VisaoGeralTab />
        </TabsContent>
        <TabsContent value="moderacao">
          <ModeracaoTab />
        </TabsContent>
        <TabsContent value="todas">
          <TodasTab />
        </TabsContent>
        <TabsContent value="config">
          <ConfigReguaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
