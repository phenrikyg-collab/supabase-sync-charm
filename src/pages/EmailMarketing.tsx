import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListasTab } from "@/components/email-marketing/ListasTab";
import { TemplatesTab } from "@/components/email-marketing/TemplatesTab";
import { CampanhasTab } from "@/components/email-marketing/CampanhasTab";

export default function EmailMarketing() {
  const [aba, setAba] = useState("listas");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-serif text-3xl">E-mail Marketing</h1>
        <p className="text-sm text-muted-foreground">
          Listas de contatos, templates visuais e campanhas de envio.
        </p>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="listas">Listas</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
        </TabsList>
        <TabsContent value="listas" className="mt-6"><ListasTab /></TabsContent>
        <TabsContent value="templates" className="mt-6"><TemplatesTab /></TabsContent>
        <TabsContent value="campanhas" className="mt-6"><CampanhasTab /></TabsContent>
      </Tabs>
    </div>
  );
}
