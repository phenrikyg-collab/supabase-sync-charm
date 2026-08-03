import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutGrid, CalendarDays, FileUp } from "lucide-react";
import { RelatorioIframe } from "@/components/relatorios/RelatorioIframe";
import { UploadRelatorioDialog } from "@/components/relatorios/UploadRelatorioDialog";
import { listarRelatorios, type RelatorioArquivo } from "@/lib/relatoriosStorage";

interface MesPlanejamento {
  id: string;
  label: string;
  matriz: string;
  calendario: string;
}

const MESES: MesPlanejamento[] = [
  {
    id: "2026-08",
    label: "Agosto / 2026",
    matriz: "/planejamento/matriz-replicacao.html",
    calendario: "/planejamento/calendario-agosto-2026.html",
  },
];

export default function PlanejamentoConteudoMensal() {
  const [mesId, setMesId] = useState(MESES[0].id);
  const mes = MESES.find((m) => m.id === mesId) ?? MESES[0];

  const [enviados, setEnviados] = useState<RelatorioArquivo[]>([]);
  const [enviadoId, setEnviadoId] = useState("");

  const carregar = async () => {
    const lista = await listarRelatorios("planejamento");
    setEnviados(lista);
    setEnviadoId((atual) => (atual && lista.some((r) => r.path === atual) ? atual : lista[0]?.path ?? ""));
  };

  useEffect(() => {
    void carregar();
  }, []);

  const enviado = enviados.find((r) => r.path === enviadoId);

  return (
    <div className="space-y-4 -mx-4 sm:mx-0">
      <div className="px-4 sm:px-0 flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-serif font-bold text-foreground">
            Planejamento de <span className="text-primary">Conteúdo Mensal</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Matriz de replicação e calendário de roteiros por mês
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={mesId} onValueChange={setMesId}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <UploadRelatorioDialog
            pasta="planejamento"
            titulo="Enviar novo HTML de planejamento"
            labelPlaceholder="Ex.: Matriz de Replicação — Setembro/2026"
            onUploaded={carregar}
          />
        </div>
      </div>

      <Tabs defaultValue="matriz" className="w-full">
        <div className="px-4 sm:px-0 overflow-x-auto">
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex h-auto">
            <TabsTrigger value="matriz" className="gap-2 text-xs sm:text-sm whitespace-normal py-2">
              <LayoutGrid className="h-4 w-4 shrink-0" /> Matriz de Replicação
            </TabsTrigger>
            <TabsTrigger value="calendario" className="gap-2 text-xs sm:text-sm whitespace-normal py-2">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Calendário &amp; Roteiros — {mes.label}</span>
              <span className="sm:hidden">Calendário &amp; Roteiros</span>
            </TabsTrigger>
            <TabsTrigger value="enviados" className="gap-2 text-xs sm:text-sm whitespace-normal py-2">
              <FileUp className="h-4 w-4 shrink-0" /> Enviados
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="matriz" className="mt-4">
          <RelatorioIframe
            src={mes.matriz}
            title={`Matriz de Replicação — ${mes.label}`}
            emptyMessage="A matriz de replicação deste mês ainda não foi publicada."
          />
        </TabsContent>

        <TabsContent value="calendario" className="mt-4">
          <RelatorioIframe
            src={mes.calendario}
            title={`Calendário e Roteiros — ${mes.label}`}
            emptyMessage="O calendário deste mês ainda não foi publicado."
          />
        </TabsContent>

        <TabsContent value="enviados" className="mt-4 space-y-3">
          {enviados.length === 0 ? (
            <div className="mx-4 sm:mx-0 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 px-6 text-center">
              <FileUp className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground max-w-md">
                Nenhum HTML enviado ainda. Use o botão "Enviar HTML" acima para publicar novas matrizes ou calendários.
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 sm:px-0 flex justify-end">
                <Select value={enviadoId} onValueChange={setEnviadoId}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Selecione o arquivo" />
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
              {enviado && (
                <RelatorioIframe
                  src={enviado.url}
                  title={enviado.label}
                  emptyMessage="Este arquivo ainda não está disponível."
                />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
