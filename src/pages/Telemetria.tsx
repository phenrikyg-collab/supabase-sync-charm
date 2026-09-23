import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Radar } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResumoTelemetria } from "@/components/telemetria/ResumoTelemetria";
import { CanaisTelemetria } from "@/components/telemetria/CanaisTelemetria";
import { PaginasTelemetria } from "@/components/telemetria/PaginasTelemetria";
import { ProdutosTelemetria } from "@/components/telemetria/ProdutosTelemetria";
import { OportunidadesTab } from "@/components/telemetria/OportunidadesTab";
import { PERIODOS_TELEMETRIA, faixaTelemetria } from "@/lib/telemetria";

export default function Telemetria() {
  const location = useLocation();
  const [aba, setAba] = useState(() => new URLSearchParams(location.search).get("tab") || "canais");
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tab");
    if (t) setAba(t);
  }, [location.search]);

  const [periodo, setPeriodo] = useState("30dias");
  const { de, ate } = faixaTelemetria(periodo);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Radar className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-serif text-3xl font-bold">Telemetria</h1>
            <p className="text-xs text-muted-foreground">
              Telemetria própria do site, atualizada de 15 em 15 minutos. GA4 fica só como controle.
            </p>
          </div>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODOS_TELEMETRIA.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ResumoTelemetria de={de} ate={ate} />

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="canais">Sessões por Canal</TabsTrigger>
          <TabsTrigger value="paginas">Páginas</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
        </TabsList>

        <TabsContent value="canais" className="space-y-6">
          <CanaisTelemetria de={de} ate={ate} />
        </TabsContent>
        <TabsContent value="paginas" className="space-y-6">
          <PaginasTelemetria de={de} ate={ate} />
        </TabsContent>
        <TabsContent value="produtos" className="space-y-6">
          <ProdutosTelemetria de={de} ate={ate} />
        </TabsContent>
        <TabsContent value="oportunidades" className="space-y-6">
          <OportunidadesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
