import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CuradoriaTab } from "@/components/videos/CuradoriaTab";
import { VideosTab } from "@/components/videos/VideosTab";
import { OndeApareceTab } from "@/components/videos/OndeApareceTab";
import { MetricasVideosTab } from "@/components/videos/MetricasVideosTab";
import { BarChart3, Film, LayoutGrid, MapPin } from "lucide-react";

export default function VitrineVideos() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "curadoria";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-bold tracking-tight">Vitrine de Vídeos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha os reels que entram no site, suba vídeos próprios e defina onde cada um aparece.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="curadoria" className="gap-1.5">
            <Film className="h-4 w-4" /> Curadoria
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-1.5">
            <LayoutGrid className="h-4 w-4" /> Vídeos
          </TabsTrigger>
          <TabsTrigger value="metricas" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Métricas
          </TabsTrigger>
          <TabsTrigger value="onde" className="gap-1.5">
            <MapPin className="h-4 w-4" /> Onde aparece
          </TabsTrigger>
        </TabsList>

        <TabsContent value="curadoria" className="mt-4"><CuradoriaTab /></TabsContent>
        <TabsContent value="videos" className="mt-4"><VideosTab /></TabsContent>
        <TabsContent value="metricas" className="mt-4">
          <MetricasVideosTab onAbrirVideo={() => setParams({ tab: "videos" }, { replace: true })} />
        </TabsContent>
        <TabsContent value="onde" className="mt-4"><OndeApareceTab /></TabsContent>
      </Tabs>
    </div>
  );
}
