import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutGrid, CalendarDays, Sparkles } from "lucide-react";
import { RelatorioIframe } from "@/components/relatorios/RelatorioIframe";
import { UploadRelatorioDialog } from "@/components/relatorios/UploadRelatorioDialog";
import { listarRelatorios, type RelatorioArquivo } from "@/lib/relatoriosStorage";

const TRIMESTRAL = "/tendencias/tendencias-moda-ago-out-2026.html";
const MOODBOARD = "/tendencias/moodboard-prd-rosset.html";

export default function Tendencias() {
  const [enviados, setEnviados] = useState<RelatorioArquivo[]>([]);
  const [semanalId, setSemanalId] = useState("");

  const carregar = async () => {
    const lista = await listarRelatorios("tendencias");
    setEnviados(lista);
    setSemanalId((atual) => (atual && lista.some((r) => r.path === atual) ? atual : lista[0]?.path ?? ""));
  };

  useEffect(() => {
    void carregar();
  }, []);

  const semanal = enviados.find((r) => r.path === semanalId);

  return (
    <div className="space-y-4 -mx-4 sm:mx-0">
      <div className="px-4 sm:px-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-serif font-bold text-foreground">
            <span className="text-primary">Tendências</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Relatórios de tendência, moodboards de tecidos e monitoramento semanal
          </p>
        </div>
        <UploadRelatorioDialog
          pasta="tendencias"
          titulo="Enviar novo relatório de tendências"
          labelPlaceholder="Ex.: Monitoramento Semanal — 04/08/2026"
          onUploaded={carregar}
        />
      </div>

      <Tabs defaultValue="trimestral" className="w-full">
        <div className="px-4 sm:px-0 overflow-x-auto">
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex h-auto">
            <TabsTrigger value="trimestral" className="gap-2 text-xs sm:text-sm whitespace-normal py-2">
              <CalendarDays className="h-4 w-4 shrink-0" /> Relatório Trimestral
            </TabsTrigger>
            <TabsTrigger value="moodboard" className="gap-2 text-xs sm:text-sm whitespace-normal py-2">
              <LayoutGrid className="h-4 w-4 shrink-0" /> Moodboard de Tecidos
            </TabsTrigger>
            <TabsTrigger value="semanal" className="gap-2 text-xs sm:text-sm whitespace-normal py-2">
              <Sparkles className="h-4 w-4 shrink-0" /> Monitoramento Semanal
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="trimestral" className="mt-4">
          <RelatorioIframe
            src={TRIMESTRAL}
            title="Tendências de Moda — Ago/Out 2026"
            emptyMessage="O relatório trimestral ainda não foi publicado."
          />
        </TabsContent>

        <TabsContent value="moodboard" className="mt-4">
          <RelatorioIframe
            src={MOODBOARD}
            title="Moodboard de Tecidos — PRD Rosset"
            emptyMessage="O moodboard de tecidos ainda não foi publicado."
          />
        </TabsContent>

        <TabsContent value="semanal" className="mt-4 space-y-3">
          {enviados.length === 0 ? (
            <div className="mx-4 sm:mx-0 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 px-6 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground max-w-md">
                Nenhum relatório enviado ainda. Use o botão "Enviar HTML" acima para publicar um novo relatório.
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 sm:px-0 flex justify-end">
                <Select value={semanalId} onValueChange={setSemanalId}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Selecione o relatório" />
                  </SelectTrigger>
                  <SelectContent>
                    {enviados.map((r) => (
                      <SelectItem key={r.path} value={r.path}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {semanal && (
                <RelatorioIframe
                  src={semanal.url}
                  title={semanal.label}
                  emptyMessage="Este relatório ainda não está disponível."
                />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
