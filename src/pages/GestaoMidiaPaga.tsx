import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Marketing from "./Marketing";
import GoogleAds from "./GoogleAds";

export default function GestaoMidiaPaga() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight">Mídia Paga</h1>
        <p className="text-sm text-muted-foreground">
          Desempenho das campanhas de Meta Ads e Google Ads.
        </p>
      </div>

      <Tabs defaultValue="meta" className="space-y-5">
        <TabsList>
          <TabsTrigger value="meta">Meta Ads</TabsTrigger>
          <TabsTrigger value="google">Google Ads</TabsTrigger>
        </TabsList>
        <TabsContent value="meta">
          <div className="-m-6"><Marketing abaInicial="meta-ads" ocultarChrome /></div>
        </TabsContent>
        <TabsContent value="google">
          <div className="-m-6"><GoogleAds /></div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
