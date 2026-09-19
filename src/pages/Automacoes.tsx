import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Mail, MessageSquare, MoreHorizontal, Pause, Play, Plus, RefreshCw, Settings, Trash2, Workflow } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrmCustosDialog } from "@/components/automacoes/CrmCustosDialog";
import { CrmDashboard } from "@/components/automacoes/CrmDashboard";
import { CrmListaDesempenho } from "@/components/automacoes/CrmListaDesempenho";
import { NovoFluxoDialog } from "@/components/automacoes/NovoFluxoDialog";
import { rpcFluxos, tempoRelativo, type FluxoLista } from "@/components/automacoes/api";
import { type AbaCrm, type ItemCrm, type PainelCrm } from "@/components/automacoes/crmTipos";
import { ROTULO_STATUS_FLUXO } from "@/components/automacoes/tipos";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const FILTROS: [string, string][] = [["todos", "Todos"], ["ativo", "No ar"], ["pausado", "Pausados"], ["rascunho", "Rascunhos"], ["arquivado", "Arquivados"]];
const ABAS: AbaCrm[] = ["dashboard", "campanhas", "automacoes"];

function hojeIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}
function diasAtrasIso(dias: number) { const d = new Date(); d.setDate(d.getDate() - dias + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

function BadgeStatus({ status }: { status: string }) {
  const classe = status === "ativo" ? "border-success/40 bg-success/10 text-success" : status === "pausado" ? "border-warning/40 bg-warning/10 text-warning" : status === "arquivado" ? "text-muted-foreground line-through" : "text-muted-foreground";
  return <Badge variant="outline" className={cn("text-[11px]", classe)}>{ROTULO_STATUS_FLUXO[status] ?? status}</Badge>;
}
function Numero({ rotulo, valor }: { rotulo: string; valor: unknown }) { return <div><p className="text-sm font-semibold">{Number(valor ?? 0).toLocaleString("pt-BR")}</p><p className="text-[10px] text-muted-foreground">{rotulo}</p></div>; }

function CarregandoPainel() { return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-80" /><Skeleton className="h-64" /></div>; }

type GestaoProps = {
  tipo: "campanhas" | "automacoes";
  fluxos: FluxoLista[];
  metricas: ItemCrm[];
  carregando: boolean;
  onNovo: () => void;
};

function GestaoFluxos({ tipo, fluxos, metricas, carregando, onNovo }: GestaoProps) {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState("todos");
  const [paraExcluir, setParaExcluir] = useState<FluxoLista | null>(null);
  const mapaMetricas = useMemo(() => new Map(metricas.map((item) => [item.origem_id, item])), [metricas]);
  const doTipo = fluxos.filter((f) => tipo === "campanhas" ? ["manual", "agendado"].includes(String(f.gatilho_tipo)) : !["manual", "agendado"].includes(String(f.gatilho_tipo)));
  const lista = doTipo.filter((f) => filtro === "todos" || f.status === filtro);
  const recarregar = () => queryClient.invalidateQueries({ queryKey: ["fluxos-listar"] });
  const mudarStatus = useMutation({ mutationFn: ({ id, status }: { id: FluxoLista["id"]; status: string }) => rpcFluxos<any>("fluxo_definir_status", { p_fluxo_id: id, p_status: status }), onSuccess: (d) => { if (d?.ok === false) { toast({ title: d?.motivo || "Corrija antes de ativar", description: (d?.validacao?.erros ?? []).join(" "), variant: "destructive" }); return; } toast({ title: "Status alterado" }); recarregar(); }, onError: (e: Error) => toast({ title: "Não deu para alterar", description: e.message, variant: "destructive" }) });
  const duplicar = useMutation({ mutationFn: (id: FluxoLista["id"]) => rpcFluxos("fluxo_duplicar", { p_fluxo_id: id }), onSuccess: () => { toast({ title: "Fluxo duplicado" }); recarregar(); }, onError: (e: Error) => toast({ title: "Não deu para duplicar", description: e.message, variant: "destructive" }) });
  const excluir = useMutation({ mutationFn: (id: FluxoLista["id"]) => rpcFluxos<any>("fluxo_excluir", { p_fluxo_id: id }), onSuccess: (d) => { toast({ title: d?.arquivado ? "Fluxo arquivado" : d?.excluido ? "Fluxo excluído" : "Pedido processado", description: d?.motivo ?? undefined }); setParaExcluir(null); recarregar(); }, onError: (e: Error) => toast({ title: "Não deu para excluir", description: e.message, variant: "destructive" }) });
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-2xl">Gestão de fluxos</h2><p className="text-sm text-muted-foreground">Crie e controle os fluxos desta área.</p></div><Button onClick={onNovo}><Plus className="mr-2 h-4 w-4" />Novo</Button></div>
    <div className="flex flex-wrap gap-2">{FILTROS.map(([v, r]) => <Badge key={v} variant={filtro === v ? "default" : "outline"} className="cursor-pointer" onClick={() => setFiltro(v)}>{r}</Badge>)}</div>
    {carregando && <Skeleton className="h-48" />}
    {!carregando && lista.length === 0 && <Card className="p-8 text-center text-muted-foreground"><Workflow className="mx-auto mb-3 h-9 w-9 opacity-40" /><p className="text-sm">Nenhum fluxo neste filtro.</p></Card>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{lista.map((f) => {
      const canais = f.canais ?? []; const erro = f.ultimo_resultado?.erro; const metrica = mapaMetricas.get(`fluxo:${f.id}`);
      return <Card key={String(f.id)} className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2"><Link to={`/automacoes/${f.id}`} className="min-w-0 hover:underline"><h3 className="truncate font-medium">{f.nome}</h3><p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{f.descricao || "Sem descrição"}</p></Link><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link to={`/automacoes/${f.id}`}>Abrir</Link></DropdownMenuItem><DropdownMenuItem onClick={() => duplicar.mutate(f.id)}><Copy className="mr-2 h-4 w-4" />Duplicar</DropdownMenuItem>{f.status === "ativo" ? <DropdownMenuItem onClick={() => mudarStatus.mutate({ id: f.id, status: "pausado" })}><Pause className="mr-2 h-4 w-4" />Pausar</DropdownMenuItem> : <DropdownMenuItem onClick={() => mudarStatus.mutate({ id: f.id, status: "ativo" })}><Play className="mr-2 h-4 w-4" />Ativar</DropdownMenuItem>}<DropdownMenuItem className="text-danger" onClick={() => setParaExcluir(f)}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
        <div className="flex flex-wrap items-center gap-1.5"><BadgeStatus status={f.status} />{f.gatilho_rotulo && <Badge variant="secondary" className="text-[11px]">{f.gatilho_rotulo}</Badge>}{canais.includes("email") && <Mail className="h-3.5 w-3.5 text-primary" />}{canais.includes("whatsapp") && <MessageSquare className="h-3.5 w-3.5 text-success" />}</div>
        <div className="grid grid-cols-5 gap-1 border-t pt-2"><Numero rotulo="Entraram" valor={f.entraram} /><Numero rotulo="No fluxo" valor={f.ativos} /><Numero rotulo="Pedidos" valor={metrica?.pedidos ?? f.sairam_comprando} /><Numero rotulo="E-mails" valor={f.emails_enviados} /><Numero rotulo="WhatsApp" valor={f.whatsapp_enviados} /></div>
        <div className="mt-auto space-y-1 pt-1"><p className="text-[11px] text-muted-foreground">Última rodada: {tempoRelativo(f.ultima_execucao_em)}</p>{erro && <p className="text-[11px] text-danger">{String(erro)}</p>}<Button asChild size="sm" variant="outline" className="w-full"><Link to={`/automacoes/${f.id}`}>Abrir</Link></Button></div>
      </Card>;
    })}</div>
    <AlertDialog open={!!paraExcluir} onOpenChange={(v) => !v && setParaExcluir(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir fluxo?</AlertDialogTitle><AlertDialogDescription>O fluxo "{paraExcluir?.nome}" sai da lista. Se já tiver histórico, ele é arquivado no lugar de apagado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => paraExcluir && excluir.mutate(paraExcluir.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

export default function Automacoes() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const abaParam = params.get("aba") as AbaCrm | null;
  const aba: AbaCrm = abaParam && ABAS.includes(abaParam) ? abaParam : "dashboard";
  const temPersonalizado = !!params.get("de") && !!params.get("ate");
  const dias = [7, 30, 90].includes(Number(params.get("dias"))) ? Number(params.get("dias")) : 30;
  const de = params.get("de") ?? diasAtrasIso(30);
  const ate = params.get("ate") ?? hojeIso();
  const [novoAberto, setNovoAberto] = useState(false);
  const [custosAberto, setCustosAberto] = useState(false);

  const atualizarParams = (mudancas: Record<string, string | null>) => setParams((atuais) => { const novos = new URLSearchParams(atuais); Object.entries(mudancas).forEach(([chave, valor]) => valor == null ? novos.delete(chave) : novos.set(chave, valor)); return novos; });
  const mudarAba = (nova: AbaCrm) => atualizarParams({ aba: nova === "dashboard" ? null : nova });
  const escolherDias = (valor: number) => atualizarParams({ dias: String(valor), de: null, ate: null });
  const escolherPersonalizado = () => atualizarParams({ dias: null, de, ate });

  const painel = useQuery({ queryKey: ["crm-painel", temPersonalizado ? "personalizado" : dias, de, ate], queryFn: () => rpcFluxos<PainelCrm>("crm_painel", { p_dias: temPersonalizado ? null : dias, p_de: temPersonalizado ? de : null, p_ate: temPersonalizado ? ate : null }) });
  const fluxos = useQuery({ queryKey: ["fluxos-listar"], queryFn: async () => (await rpcFluxos<FluxoLista[]>("fluxos_listar", { p_dias: temPersonalizado ? 30 : dias })) ?? [] });
  const recarregarTudo = () => { queryClient.invalidateQueries({ queryKey: ["crm-painel"] }); queryClient.invalidateQueries({ queryKey: ["crm-custos"] }); };
  const dados = painel.data ?? {};
  const metricasAtuais = aba === "campanhas" ? dados.campanhas : dados.automacoes;

  return <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-serif text-4xl text-foreground">CRM</h1><p className="mt-1 text-sm text-muted-foreground">Receita, custos e desempenho de campanhas e automações.</p></div><Button variant="outline" onClick={() => setCustosAberto(true)}><Settings className="mr-2 h-4 w-4" />Custos e atribuição</Button></div>
    <div className="flex flex-wrap items-center gap-2 border-b pb-4"><span className="mr-1 text-sm font-medium">Período:</span>{[7, 30, 90].map((valor) => <Button key={valor} size="sm" variant={!temPersonalizado && dias === valor ? "default" : "outline"} onClick={() => escolherDias(valor)}>{valor} dias</Button>)}<Button size="sm" variant={temPersonalizado ? "default" : "outline"} onClick={escolherPersonalizado}>Personalizado</Button>{temPersonalizado && <div className="flex flex-wrap items-center gap-2"><Input aria-label="Data inicial" type="date" className="h-9 w-40" value={de} onChange={(e) => atualizarParams({ de: e.target.value })} /><span className="text-sm text-muted-foreground">até</span><Input aria-label="Data final" type="date" className="h-9 w-40" value={ate} onChange={(e) => atualizarParams({ ate: e.target.value })} /></div>}</div>

    <Tabs value={aba} onValueChange={(v) => mudarAba(v as AbaCrm)}><TabsList className="grid w-full grid-cols-3 sm:w-[480px]"><TabsTrigger value="dashboard">Dashboard</TabsTrigger><TabsTrigger value="campanhas">Campanhas</TabsTrigger><TabsTrigger value="automacoes">Automações</TabsTrigger></TabsList>
      {painel.isLoading ? <div className="mt-6"><CarregandoPainel /></div> : painel.isError ? <Card className="mt-6 p-10 text-center"><p className="text-sm text-danger">Não foi possível carregar o painel.</p><p className="mt-1 text-xs text-muted-foreground">{painel.error instanceof Error ? painel.error.message : "Tente novamente."}</p><Button className="mt-4" variant="outline" onClick={() => painel.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar de novo</Button></Card> : <>
        <TabsContent value="dashboard" className="mt-6"><CrmDashboard dados={dados} onAba={mudarAba} /></TabsContent>
        {(["campanhas", "automacoes"] as const).map((tipo) => <TabsContent key={tipo} value={tipo} className="mt-6 space-y-8"><GestaoFluxos tipo={tipo} fluxos={fluxos.data ?? []} metricas={tipo === "campanhas" ? dados.campanhas?.itens_lista ?? [] : dados.automacoes?.itens_lista ?? []} carregando={fluxos.isLoading} onNovo={() => setNovoAberto(true)} /><CrmListaDesempenho dados={tipo === aba ? metricasAtuais : tipo === "campanhas" ? dados.campanhas : dados.automacoes} /></TabsContent>)}
      </>}
    </Tabs>
    <NovoFluxoDialog open={novoAberto} onOpenChange={setNovoAberto} gatilhoInicial={aba === "campanhas" ? "manual" : undefined} />
    <CrmCustosDialog open={custosAberto} onOpenChange={setCustosAberto} onSalvo={recarregarTudo} />
  </div>;
}