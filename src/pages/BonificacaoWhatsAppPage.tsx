import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import DashboardTab from "@/components/bonificacao-whatsapp/DashboardTab";
import ApuracaoTab from "@/components/bonificacao-whatsapp/ApuracaoTab";
import HistoricoTab from "@/components/bonificacao-whatsapp/HistoricoTab";
import ConfigTab from "@/components/bonificacao-whatsapp/ConfigTab";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BonificacaoWhatsAppPage() {
  const [mes, setMes] = useState<string>(format(new Date(), "yyyy-MM"));

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl text-foreground">Bonificação WhatsApp</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Apuração mensal de bônus das consultoras de venda WhatsApp.
          </p>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mês de referência</Label>
          <Input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-44 mt-1"
          />
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="apuracao">Apuração</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab mes={mes} /></TabsContent>
        <TabsContent value="apuracao"><ApuracaoTab mes={mes} /></TabsContent>
        <TabsContent value="historico"><HistoricoTab /></TabsContent>
        <TabsContent value="config"><ConfigTab mes={mes} /></TabsContent>
      </Tabs>
    </div>
  );
}
