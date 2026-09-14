import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { VisaoGeralTab } from "@/components/emails/VisaoGeralTab";
import { AutomacoesTab } from "@/components/emails/AutomacoesTab";
import { CampanhasTab } from "@/components/emails/CampanhasTab";
import { TemplatesTab } from "@/components/emails/TemplatesTab";
import { BaseSaudeTab } from "@/components/emails/BaseSaudeTab";

const PERIODOS = [7, 30, 90];

export default function EmailMarketing() {
  const [aba, setAba] = useState("visao-geral");
  const [dias, setDias] = useState(30);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">E-mail</h1>
          <p className="text-sm text-muted-foreground">
            Resultado do canal, automações, campanhas, templates e saúde da base.
          </p>
        </div>
        <div className="flex gap-1">
          {PERIODOS.map((d) => (
            <Button key={d} size="sm" variant={dias === d ? "secondary" : "outline"} onClick={() => setDias(d)}>
              {d} dias
            </Button>
          ))}
        </div>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="base">Base e Saúde</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="mt-6">
          <VisaoGeralTab dias={dias} onAbrirCampanha={() => setAba("campanhas")} />
        </TabsContent>
        <TabsContent value="automacoes" className="mt-6"><AutomacoesTab /></TabsContent>
        <TabsContent value="campanhas" className="mt-6"><CampanhasTab dias={dias} /></TabsContent>
        <TabsContent value="templates" className="mt-6"><TemplatesTab /></TabsContent>
        <TabsContent value="base" className="mt-6"><BaseSaudeTab dias={dias} /></TabsContent>
      </Tabs>
    </div>
  );
}
