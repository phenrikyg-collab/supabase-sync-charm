import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CircleAlert, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrmCustosDialog } from "@/components/automacoes/CrmCustosDialog";
import { CrmDashboard } from "@/components/automacoes/CrmDashboard";
import { CrmListaDesempenho } from "@/components/automacoes/CrmListaDesempenho";
import { NovoFluxoDialog } from "@/components/automacoes/NovoFluxoDialog";
import { AlertasAutomacoes, useAlertasAutomacoes } from "@/components/automacoes/AlertasAutomacoes";
import { rpcFluxos, type FluxoLista } from "@/components/automacoes/api";
import { type AbaCrm, type CanalCrm, type PainelCrm } from "@/components/automacoes/crmTipos";

const ABAS: AbaCrm[] = ["dashboard", "campanhas", "automacoes", "alertas"];
const CANAIS: CanalCrm[] = ["todos", "whatsapp", "email"];

function hojeIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}
function diasAtrasIso(dias: number) { const d = new Date(); d.setDate(d.getDate() - dias + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

function CarregandoPainel() { return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-80" /><Skeleton className="h-64" /></div>; }

export default function Automacoes() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const abaParam = params.get("aba") as AbaCrm | null;
  const aba: AbaCrm = abaParam && ABAS.includes(abaParam) ? abaParam : "dashboard";
  const temPersonalizado = !!params.get("de") && !!params.get("ate");
  const dias = [7, 30, 90].includes(Number(params.get("dias"))) ? Number(params.get("dias")) : 30;
  const de = params.get("de") ?? diasAtrasIso(30);
  const ate = params.get("ate") ?? hojeIso();
  const canalParam = params.get("canal") as CanalCrm | null;
  const canal: CanalCrm = canalParam && CANAIS.includes(canalParam) ? canalParam : "todos";
  const [novoAberto, setNovoAberto] = useState(false);
  const [custosAberto, setCustosAberto] = useState(false);

  const atualizarParams = (mudancas: Record<string, string | null>) => setParams((atuais) => { const novos = new URLSearchParams(atuais); Object.entries(mudancas).forEach(([chave, valor]) => valor == null ? novos.delete(chave) : novos.set(chave, valor)); return novos; });
  const mudarAba = (nova: AbaCrm) => atualizarParams({ aba: nova === "dashboard" ? null : nova });
  const escolherDias = (valor: number) => atualizarParams({ dias: String(valor), de: null, ate: null });
  const escolherPersonalizado = () => atualizarParams({ dias: null, de, ate });
  const escolherCanal = (valor: CanalCrm) => atualizarParams({ canal: valor === "todos" ? null : valor });

  const parametrosPeriodo = { p_dias: temPersonalizado ? null : dias, p_de: temPersonalizado ? de : null, p_ate: temPersonalizado ? ate : null };
  const painelGeral = useQuery({
    queryKey: ["crm-painel", "geral", temPersonalizado ? "personalizado" : dias, de, ate],
    enabled: aba === "dashboard",
    queryFn: () => rpcFluxos<PainelCrm>("crm_painel", parametrosPeriodo),
  });
  const painelWhatsapp = useQuery({
    queryKey: ["crm-painel", "fluxos-whatsapp", temPersonalizado ? "personalizado" : dias, de, ate],
    enabled: aba === "campanhas" || aba === "automacoes",
    queryFn: async () => {
      const resposta = await rpcFluxos<PainelCrm>("crm_painel", { ...parametrosPeriodo, p_apenas_fluxos: true, p_canal: "whatsapp" });
      if (resposta?.periodo?.apenas_fluxos !== true || String(resposta?.periodo?.canal ?? "").toLowerCase() !== "whatsapp") {
        throw new Error("O painel não confirmou o filtro de fluxos do WhatsApp.");
      }
      return resposta;
    },
  });
  const fluxos = useQuery({ queryKey: ["fluxos-listar"], queryFn: async () => (await rpcFluxos<FluxoLista[]>("fluxos_listar", { p_dias: temPersonalizado ? 30 : dias })) ?? [] });
  const alertasAbertos = useAlertasAutomacoes(false);
  const recarregarTudo = () => { queryClient.invalidateQueries({ queryKey: ["crm-painel"] }); queryClient.invalidateQueries({ queryKey: ["crm-custos"] }); };
  const consultaAtiva = aba === "dashboard" ? painelGeral : painelWhatsapp;
  const dadosGerais = painelGeral.data ?? {};
  const dadosWhatsapp = painelWhatsapp.data ?? {};
  const listaAlertas = alertasAbertos.data ?? [];
  const totalAlertas = listaAlertas.length;
  const temGrave = listaAlertas.some((a) => a.gravidade === "grave");

  return <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-serif text-4xl text-foreground">CRM</h1><p className="mt-1 text-sm text-muted-foreground">Visão geral do CRM e desempenho dos fluxos de WhatsApp.</p></div><Button variant="outline" onClick={() => setCustosAberto(true)}><Settings className="mr-2 h-4 w-4" />Custos e atribuição</Button></div>
    {totalAlertas > 0 && (
      <button
        type="button"
        onClick={() => mudarAba("alertas")}
        className={`flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
          temGrave
            ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
            : "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15"
        }`}
      >
        {temGrave ? <CircleAlert className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
        {totalAlertas} {totalAlertas === 1 ? "automação com alerta" : "automações com alerta"}
      </button>
    )}
    <div className="flex flex-wrap items-center gap-2 border-b pb-4"><span className="mr-1 text-sm font-medium">Período:</span>{[7, 30, 90].map((valor) => <Button key={valor} size="sm" variant={!temPersonalizado && dias === valor ? "default" : "outline"} onClick={() => escolherDias(valor)}>{valor} dias</Button>)}<Button size="sm" variant={temPersonalizado ? "default" : "outline"} onClick={escolherPersonalizado}>Personalizado</Button>{temPersonalizado && <div className="flex flex-wrap items-center gap-2"><Input aria-label="Data inicial" type="date" className="h-9 w-40" value={de} onChange={(e) => atualizarParams({ de: e.target.value })} /><span className="text-sm text-muted-foreground">até</span><Input aria-label="Data final" type="date" className="h-9 w-40" value={ate} onChange={(e) => atualizarParams({ ate: e.target.value })} /></div>}</div>

    <Tabs value={aba} onValueChange={(v) => mudarAba(v as AbaCrm)}><TabsList className="grid w-full grid-cols-4 sm:w-[640px]"><TabsTrigger value="dashboard">Dashboard</TabsTrigger><TabsTrigger value="campanhas">Campanhas</TabsTrigger><TabsTrigger value="automacoes">Automações</TabsTrigger><TabsTrigger value="alertas">Alertas{totalAlertas > 0 ? ` (${totalAlertas})` : ""}</TabsTrigger></TabsList>
      {aba === "alertas" ? (
        <TabsContent value="alertas" className="mt-6"><AlertasAutomacoes /></TabsContent>
      ) : consultaAtiva.isLoading ? <div className="mt-6"><CarregandoPainel /></div> : consultaAtiva.isError ? <Card className="mt-6 p-10 text-center"><p className="text-sm text-danger">Não foi possível carregar o painel.</p><p className="mt-1 text-xs text-muted-foreground">{consultaAtiva.error instanceof Error ? consultaAtiva.error.message : "Tente novamente."}</p><Button className="mt-4" variant="outline" onClick={() => consultaAtiva.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar de novo</Button></Card> : <>
        <TabsContent value="dashboard" className="mt-6"><CrmDashboard dados={dadosGerais} onAba={mudarAba} /></TabsContent>
        {(["campanhas", "automacoes"] as const).map((tipo) => <TabsContent key={tipo} value={tipo} className="mt-6"><CrmListaDesempenho tipo={tipo} dados={tipo === "campanhas" ? dadosWhatsapp.campanhas : dadosWhatsapp.automacoes} fluxos={fluxos.data ?? []} carregandoFluxos={fluxos.isLoading} onNovo={() => setNovoAberto(true)} /></TabsContent>)}
      </>}
    </Tabs>
    <NovoFluxoDialog open={novoAberto} onOpenChange={setNovoAberto} gatilhoInicial={aba === "campanhas" ? "manual" : undefined} />
    <CrmCustosDialog open={custosAberto} onOpenChange={setCustosAberto} onSalvo={recarregarTudo} />
  </div>;
}