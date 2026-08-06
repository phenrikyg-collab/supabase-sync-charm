import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { TemplatesWppTab } from "@/components/whatsapp-marketing/TemplatesWppTab";
import { SegmentosTab } from "@/components/whatsapp-marketing/SegmentosTab";
import { CampanhasWppTab } from "@/components/whatsapp-marketing/CampanhasWppTab";

export default function MarketingWhatsApp() {
  const [aba, setAba] = useState("templates");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Marketing WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Templates aprovados pela Meta, segmentos de clientes e campanhas em massa.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Campanhas em massa exigem template aprovado pela Meta — mensagens de texto livre só
          funcionam com quem já conversou nas últimas 24h.
        </AlertDescription>
      </Alert>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="segmentos">Segmentos</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="mt-6"><TemplatesWppTab /></TabsContent>
        <TabsContent value="segmentos" className="mt-6"><SegmentosTab /></TabsContent>
        <TabsContent value="campanhas" className="mt-6"><CampanhasWppTab /></TabsContent>
      </Tabs>
    </div>
  );
}
