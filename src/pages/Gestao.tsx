import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChecklistDiario from "@/components/gestao/ChecklistDiario";
import MetaAdsDiario from "@/components/gestao/MetaAdsDiario";
import CanaisSessoes from "@/components/gestao/CanaisSessoes";
import Auditorias from "@/components/gestao/Auditorias";

export default function Gestao() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight">Gestão</h1>
        <p className="text-sm text-muted-foreground">
          Rotina diária de acompanhamento: operação, mídia, canais e auditorias.
        </p>
      </div>

      <Tabs defaultValue="checklist" className="space-y-5">
        <TabsList>
          <TabsTrigger value="checklist">Checklist Diário</TabsTrigger>
          <TabsTrigger value="meta">Meta Ads Diário</TabsTrigger>
          <TabsTrigger value="canais">Canais e Sessões</TabsTrigger>
          <TabsTrigger value="auditorias">Auditorias</TabsTrigger>
        </TabsList>
        <TabsContent value="checklist"><ChecklistDiario /></TabsContent>
        <TabsContent value="meta"><MetaAdsDiario /></TabsContent>
        <TabsContent value="canais"><CanaisSessoes /></TabsContent>
        <TabsContent value="auditorias"><Auditorias /></TabsContent>
      </Tabs>
    </div>
  );
}
