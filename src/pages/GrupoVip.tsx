import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart3, CalendarDays, Eye, Heart, LineChart, PenLine, Users } from "lucide-react";
import { PainelTab } from "@/components/vip/PainelTab";
import { CalendarioTab } from "@/components/vip/CalendarioTab";
import { MetricasTab } from "@/components/vip/MetricasTab";
import { GruposTab } from "@/components/vip/GruposTab";
import { ContextoTab } from "@/components/vip/ContextoTab";
import { NovaMensagemTab } from "@/components/vip/NovaMensagemTab";
import { ProvaSocialTab } from "@/components/vip/ProvaSocialTab";

const ABAS = [
  { valor: "painel", label: "Painel", icone: BarChart3 },
  { valor: "calendario", label: "Calendário", icone: CalendarDays },
  { valor: "nova-mensagem", label: "Nova mensagem", icone: PenLine },
  { valor: "prova-social", label: "Prova social", icone: Heart },
  { valor: "metricas", label: "Métricas", icone: LineChart },
  { valor: "grupos", label: "Grupos e captação", icone: Users },
  { valor: "contexto", label: "O que a IA vê", icone: Eye },
];

export default function GrupoVip() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "painel";

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">Grupo VIP</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Os grupos de WhatsApp geridos como canal de receita: KPIs do canal, calendário de mensagens com IA e
            captação de novos membros. Grupo que só vende, desgasta.
          </p>
        </div>
        <Button onClick={() => setParams({ tab: "nova-mensagem" }, { replace: true })}>
          <PenLine className="mr-1 h-4 w-4" /> Escrever mensagem
        </Button>
      </header>


      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="flex-wrap">
          {ABAS.map((a) => (
            <TabsTrigger key={a.valor} value={a.valor} className="gap-1.5">
              <a.icone className="h-4 w-4" />
              <span className="hidden sm:inline">{a.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="painel" className="mt-4">
          <PainelTab />
        </TabsContent>
        <TabsContent value="calendario" className="mt-4">
          <CalendarioTab />
        </TabsContent>
        <TabsContent value="nova-mensagem" className="mt-4">
          <NovaMensagemTab />
        </TabsContent>
        <TabsContent value="prova-social" className="mt-4">
          <ProvaSocialTab />
        </TabsContent>
        <TabsContent value="metricas" className="mt-4">
          <MetricasTab />
        </TabsContent>
        <TabsContent value="grupos" className="mt-4">
          <GruposTab />
        </TabsContent>
        <TabsContent value="contexto" className="mt-4">
          <ContextoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
