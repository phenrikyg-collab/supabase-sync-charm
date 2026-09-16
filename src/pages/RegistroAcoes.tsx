import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  acoesAtualizarAgora, acoesOpcoes, rotuloSemana, semanaAtualISO,
} from "@/lib/registroAcoes";
import SemanaTab from "@/components/registro-acoes/SemanaTab";
import HistoricoTab from "@/components/registro-acoes/HistoricoTab";
import AprendizadosTab from "@/components/registro-acoes/AprendizadosTab";
import EvolucaoTab from "@/components/registro-acoes/EvolucaoTab";
import ComercialTab from "@/components/registro-acoes/ComercialTab";
import AcaoPainel from "@/components/registro-acoes/AcaoPainel";
import AcaoFormDialog from "@/components/registro-acoes/AcaoFormDialog";

export default function RegistroAcoes() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [semana, setSemana] = useState<string>(semanaAtualISO());
  const [painel, setPainel] = useState<any | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [acaoEditando, setAcaoEditando] = useState<any | null>(null);
  const [dadosSemana, setDadosSemana] = useState<any | null>(null);

  const { data: opcoes, isLoading } = useQuery({
    queryKey: ["acoes", "opcoes"],
    queryFn: acoesOpcoes,
    staleTime: 60 * 60 * 1000,
  });

  const semanas: string[] = useMemo(() => {
    const lista = (dadosSemana?.semanas_disponiveis ?? []).map((s: any) =>
      String(typeof s === "string" ? s : s?.semana ?? s?.inicio ?? "").slice(0, 10),
    ).filter(Boolean);
    return lista.includes(semana) ? lista : [semana, ...lista];
  }, [dadosSemana, semana]);

  const anterior = dadosSemana?.semana_anterior ?? dadosSemana?.semana?.semana_anterior;
  const seguinte = dadosSemana?.semana_seguinte ?? dadosSemana?.semana?.semana_seguinte;

  const atualizar = useMutation({
    mutationFn: acoesAtualizarAgora,
    onSuccess: (r: any) => {
      const raiz = Array.isArray(r) ? r[0] ?? {} : r ?? {};
      const qtd = raiz?.semanas_recalculadas ?? raiz?.semanas ?? r;
      toast({
        title: "Dados atualizados",
        description: `Semanas recalculadas: ${typeof qtd === "number" ? qtd : String(qtd ?? "")}`,
      });
      qc.invalidateQueries({ queryKey: ["acoes"] });
    },
    onError: (e: any) =>
      toast({ title: "Não deu para atualizar", description: e.message, variant: "destructive" }),
  });

  const abrirNova = () => { setAcaoEditando(null); setFormAberto(true); };
  const editar = (a: any) => { setPainel(null); setAcaoEditando(a); setFormAberto(true); };

  if (isLoading || !opcoes) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-tight">Registro de Ações</h1>
          <p className="text-sm text-muted-foreground">
            O que foi feito em cada semana e como os drivers reagiram.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline" size="icon"
            disabled={!anterior}
            onClick={() => anterior && setSemana(String(anterior).slice(0, 10))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={semana} onValueChange={setSemana}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {semanas.map((s) => (
                <SelectItem key={s} value={s}>{rotuloSemana(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline" size="icon"
            disabled={!seguinte}
            onClick={() => seguinte && setSemana(String(seguinte).slice(0, 10))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={abrirNova} className="gap-2">
            <Plus className="h-4 w-4" /> Nova ação
          </Button>
          <Button
            variant="ghost" size="sm" className="gap-2 text-muted-foreground"
            disabled={atualizar.isPending}
            onClick={() => atualizar.mutate()}
          >
            <RefreshCw className={`h-4 w-4 ${atualizar.isPending ? "animate-spin" : ""}`} />
            Atualizar agora
          </Button>
        </div>
      </div>

      <Tabs defaultValue="comercial" className="space-y-5">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="comercial">Comercial &amp; Lançamentos</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="funciona">O que funciona</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>

        <TabsContent value="comercial">
          <ComercialTab opcoes={opcoes} onAbrirAcao={setPainel} onNovaAcao={abrirNova} />
        </TabsContent>
        <TabsContent value="semana">
          <SemanaTab
            semana={semana}
            opcoes={opcoes}
            onAbrirAcao={setPainel}
            onNovaAcao={abrirNova}
            onDados={setDadosSemana}
          />
        </TabsContent>
        <TabsContent value="historico">
          <HistoricoTab opcoes={opcoes} onAbrirAcao={setPainel} />
        </TabsContent>
        <TabsContent value="funciona">
          <AprendizadosTab opcoes={opcoes} />
        </TabsContent>
        <TabsContent value="evolucao">
          <EvolucaoTab opcoes={opcoes} onAbrirAcao={setPainel} />
        </TabsContent>
      </Tabs>

      <AcaoPainel
        acao={painel}
        onOpenChange={(v) => !v && setPainel(null)}
        opcoes={opcoes}
        onEditar={editar}
      />

      <AcaoFormDialog
        aberto={formAberto}
        onOpenChange={setFormAberto}
        opcoes={opcoes}
        acao={acaoEditando}
      />
    </div>
  );
}
