import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, HandCoins, Info, Mail, MessageSquare, MoreHorizontal, MousePointerClick, PackageCheck, Pause, Play, Plus, Search, Send, ShoppingBag, Trash2, UserRound, WalletCards } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SortableHead, useOrdenado, useSortable } from "@/components/SortableHead";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { rpcFluxos, type FluxoLista } from "./api";
import { CrmKpiCard, classeRoas } from "./CrmKpiCard";
import { brlCrm, dataHoraCrm, numeroCrm, percentualCrm, roasCrm, type CanalCrm, type ItemCrm, type MetricasCrm } from "./crmTipos";
import { ROTULO_STATUS_FLUXO } from "./tipos";

type Campo = "nome" | "periodo" | "pessoas" | "enviados" | "taxa_entrega" | "taxa_leitura" | "taxa_interacao" | "pedidos" | "receita" | "custo" | "custo_mensagens" | "custo_ia" | "roas" | "conversao" | "custo_por_pedido" | "receita_por_mil";
type TipoLista = "campanhas" | "automacoes";

const FILTROS: [string, string][] = [["todos", "Todos"], ["ativo", "No ar"], ["pausado", "Pausados"], ["rascunho", "Rascunhos"], ["arquivado", "Arquivados"]];
const FILTROS_CANAL: [CanalCrm, string][] = [["todos", "Todos os canais"], ["whatsapp", "WhatsApp"], ["email", "E-mail"]];
const CAMPANHA_GATILHOS = ["manual", "agendado"];
const acessores: Record<Campo, (item: ItemCrm) => number | string | null | undefined> = {
  nome: (i) => i.nome,
  periodo: (i) => i.primeiro_envio,
  pessoas: (i) => i.pessoas,
  enviados: (i) => i.enviados,
  taxa_entrega: (i) => i.taxa_entrega,
  taxa_leitura: (i) => i.taxa_leitura,
  taxa_interacao: (i) => i.taxa_interacao,
  pedidos: (i) => i.pedidos,
  receita: (i) => i.receita,
  custo: (i) => i.custo,
  custo_mensagens: (i) => i.custo_mensagens,
  custo_ia: (i) => i.custo_ia,
  roas: (i) => i.roas,
  conversao: (i) => i.conversao,
  custo_por_pedido: (i) => i.custo_por_pedido,
  receita_por_mil: (i) => i.receita_por_mil,
};

function normalizar(valor: string) { return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

function juntarFluxos(tipo: TipoLista, canal: CanalCrm, fluxos: FluxoLista[], itens: ItemCrm[]) {
  const doTipo = fluxos.filter((fluxo) => {
    const canais = fluxo.canais ?? [];
    // Fluxo recém-criado ainda não tem canais: continua na lista para poder ser aberto e terminado.
    const canalOk = canal === "todos" || canais.length === 0 || canais.some((c) => c.toLowerCase().includes(canal));
    const tipoCorreto = tipo === "campanhas" ? CAMPANHA_GATILHOS.includes(String(fluxo.gatilho_tipo)) : !CAMPANHA_GATILHOS.includes(String(fluxo.gatilho_tipo));
    return canalOk && tipoCorreto;
  });
  const metricas = new Map(itens.map((item) => [item.origem_id, item]));
  const idsFluxosDoCanal = new Set(doTipo.map((fluxo) => `fluxo:${fluxo.id}`));
  const idsUsados = new Set<string>();
  const unidos = doTipo.map((fluxo): ItemCrm => {
    const origemId = `fluxo:${fluxo.id}`;
    const metrica = metricas.get(origemId);
    idsUsados.add(origemId);
    const zerado: ItemCrm = {
      origem_id: origemId,
      nome: fluxo.nome,
      pessoas: 0,
      enviados: 0,
      enviados_whatsapp: 0,
      enviados_email: 0,
      entregues: 0,
      lidos: 0,
      abertos: 0,
      cliques: 0,
      botoes: 0,
      respostas: 0,
      pedidos: 0,
      receita: 0,
      custo: 0,
      custo_mensagens: 0,
      custo_ia: 0,
      chamadas_ia: 0,
    };
    return {
      ...zerado,
      ...metrica,
      nome: fluxo.nome,
      descricao: fluxo.descricao,
      canais: metrica?.canais ?? fluxo.canais ?? [],
      status: fluxo.status,
      gatilho_tipo: fluxo.gatilho_tipo,
      fluxo_id: fluxo.id,
    };
  });
  return [...unidos, ...itens.filter((item) => !idsUsados.has(item.origem_id) && idsFluxosWhatsapp.has(item.origem_id))];
}

function BadgeStatus({ status }: { status: string }) {
  const classe = status === "ativo" ? "border-success/40 bg-success/10 text-success" : status === "pausado" ? "border-warning/40 bg-warning/10 text-warning" : status === "arquivado" ? "text-muted-foreground line-through" : "text-muted-foreground";
  return <Badge variant="outline" className={cn("text-[10px]", classe)}>{ROTULO_STATUS_FLUXO[status] ?? status}</Badge>;
}

function DetalheItem({ item }: { item: ItemCrm }) {
  const kpis = [
    ["Pessoas", numeroCrm(item.pessoas)], ["Enviados", numeroCrm(item.enviados)], ["WhatsApp", numeroCrm(item.enviados_whatsapp)],
    ["Entregues", numeroCrm(item.entregues)], ["Lidos", numeroCrm(item.lidos)],
    ["Botões", numeroCrm(item.botoes)], ["Respostas", numeroCrm(item.respostas)], ["Pedidos", numeroCrm(item.pedidos)], ["Receita", brlCrm(item.receita)],
    ["Custo", brlCrm(item.custo)], ["ROAS", roasCrm(item.roas, item.custo)], ["Conversão", percentualCrm(item.conversao)], ["Ticket médio", brlCrm(item.ticket_medio)],
    ["Custo por pedido", item.custo_por_pedido == null ? "–" : brlCrm(item.custo_por_pedido)], ["Receita por mil", item.receita_por_mil == null ? "–" : brlCrm(item.receita_por_mil)],
  ];
  return <div className="mt-6 space-y-6">
    <p className="text-sm text-muted-foreground">{numeroCrm(item.pessoas)} pessoas · {numeroCrm(item.enviados)} mensagens enviadas</p>
    <p className="text-sm text-muted-foreground">Custo: {brlCrm(item.custo)} (mensagens {brlCrm(item.custo_mensagens)} em {numeroCrm(item.enviados)} envios · IA {brlCrm(item.custo_ia)} em {numeroCrm(item.chamadas_ia)} chamadas)</p>
    <div className="grid grid-cols-2 gap-3">{kpis.map(([rotulo, valor]) => <div key={rotulo} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{rotulo}</p><p className="mt-1 font-semibold">{valor}</p></div>)}</div>
    <div><h3 className="mb-3 font-serif text-lg font-semibold">Taxas</h3><div className="grid grid-cols-2 gap-3">{[["Entrega", item.taxa_entrega], ["Leitura", item.taxa_leitura], ["Interação", item.taxa_interacao]].map(([rotulo, valor]) => <div key={String(rotulo)} className="flex justify-between border-b py-2 text-sm"><span>{rotulo}</span><strong>{percentualCrm(valor)}</strong></div>)}</div></div>
    <div><h3 className="mb-3 font-serif text-lg font-semibold">Custo por categoria</h3><Table><TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead className="text-right">Envios</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader><TableBody>{Object.entries(item.por_categoria ?? {}).map(([categoria, valores]) => <TableRow key={categoria}><TableCell>{categoria}</TableCell><TableCell className="text-right">{numeroCrm(valores?.envios)}</TableCell><TableCell className="text-right">{brlCrm(valores?.custo)}</TableCell></TableRow>)}</TableBody></Table></div>
    {item.fluxo_id != null && <Button asChild className="w-full"><Link to={`/automacoes/${item.fluxo_id}`}>Abrir fluxo</Link></Button>}
  </div>;
}

type Props = { tipo: TipoLista; dados?: MetricasCrm; fluxos: FluxoLista[]; carregandoFluxos: boolean; onNovo: () => void };

export function CrmListaDesempenho({ tipo, dados, fluxos, carregandoFluxos, onNovo }: Props) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [selecionado, setSelecionado] = useState<ItemCrm | null>(null);
  const [paraExcluir, setParaExcluir] = useState<FluxoLista | null>(null);
  const [detalheCusto, setDetalheCusto] = useState(false);
  const { sort, alternar } = useSortable<Campo>({ key: "receita" });
  const itens = useMemo(() => juntarFluxos(tipo, fluxos, dados?.itens_lista ?? []), [tipo, fluxos, dados?.itens_lista]);
  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return itens.filter((item) => (!termo || normalizar(`${item.nome} ${item.descricao ?? ""}`).includes(termo)) && (filtro === "todos" || item.status === filtro));
  }, [busca, filtro, itens]);
  const ordenados = useOrdenado(filtrados, sort, acessores);
  const interacoes = Number(dados?.botoes ?? 0) + Number(dados?.respostas ?? 0);
  const recarregar = () => { queryClient.invalidateQueries({ queryKey: ["fluxos-listar"] }); queryClient.invalidateQueries({ queryKey: ["crm-painel"] }); };
  const mudarStatus = useMutation({ mutationFn: ({ id, status }: { id: FluxoLista["id"]; status: string }) => rpcFluxos<any>("fluxo_definir_status", { p_fluxo_id: id, p_status: status }), onSuccess: (resultado) => { if (resultado?.ok === false) { toast({ title: resultado?.motivo || "Corrija antes de ativar", description: (resultado?.validacao?.erros ?? []).join(" "), variant: "destructive" }); return; } toast({ title: "Status alterado" }); recarregar(); }, onError: (erro: Error) => toast({ title: "Não deu para alterar", description: erro.message, variant: "destructive" }) });
  const duplicar = useMutation({ mutationFn: (id: FluxoLista["id"]) => rpcFluxos("fluxo_duplicar", { p_fluxo_id: id }), onSuccess: () => { toast({ title: "Fluxo duplicado" }); recarregar(); }, onError: (erro: Error) => toast({ title: "Não deu para duplicar", description: erro.message, variant: "destructive" }) });
  const excluir = useMutation({ mutationFn: (id: FluxoLista["id"]) => rpcFluxos<any>("fluxo_excluir", { p_fluxo_id: id }), onSuccess: (resultado) => { toast({ title: resultado?.arquivado ? "Fluxo arquivado" : resultado?.excluido ? "Fluxo excluído" : "Pedido processado", description: resultado?.motivo ?? undefined }); setParaExcluir(null); recarregar(); }, onError: (erro: Error) => toast({ title: "Não deu para excluir", description: erro.message, variant: "destructive" }) });
  const fluxoPorId = (id: ItemCrm["fluxo_id"]) => fluxos.find((fluxo) => String(fluxo.id) === String(id));

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      <CrmKpiCard titulo="Pessoas" valor={numeroCrm(dados?.pessoas)} icon={UserRound} /><CrmKpiCard titulo="Enviados" valor={numeroCrm(dados?.enviados)} icon={Send} />
      <CrmKpiCard titulo="Entregues" valor={numeroCrm(dados?.entregues)} icon={PackageCheck} /><CrmKpiCard titulo="Lidos" valor={numeroCrm(dados?.lidos)} icon={Eye} />
      <CrmKpiCard titulo="Interações" valor={numeroCrm(interacoes)} icon={MousePointerClick} /><CrmKpiCard titulo="Pedidos" valor={numeroCrm(dados?.pedidos)} icon={ShoppingBag} />
      <CrmKpiCard titulo="Receita" valor={brlCrm(dados?.receita)} icon={HandCoins} /><CrmKpiCard titulo="Custo" valor={brlCrm(dados?.custo)} detalhe={`mensagens ${brlCrm(dados?.custo_mensagens)} · IA ${brlCrm(dados?.custo_ia)}`} icon={WalletCards} />
      <CrmKpiCard titulo="ROAS" valor={roasCrm(dados?.roas, dados?.custo)} className={classeRoas(dados?.roas, dados?.custo)} /><CrmKpiCard titulo="% faturamento" valor={percentualCrm(dados?.pct_faturamento)} />
    </div>

    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-xl">Desempenho</CardTitle><div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"><div className="relative min-w-56 flex-1 sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar por nome" /></div><Button onClick={onNovo}><Plus className="mr-2 h-4 w-4" />Novo</Button></div></div>
        <div className="flex flex-wrap items-center gap-2">{FILTROS.map(([valor, rotulo]) => <Badge key={valor} variant={filtro === valor ? "default" : "outline"} className="cursor-pointer" onClick={() => setFiltro(valor)}>{rotulo}</Badge>)}<Badge variant={detalheCusto ? "default" : "outline"} className="cursor-pointer" onClick={() => setDetalheCusto((valor) => !valor)}>Detalhar custo</Badge></div>
      </CardHeader>
      <CardContent className="p-0">
        {carregandoFluxos ? <div className="p-4"><Skeleton className="h-48" /></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow>
          <SortableHead campo="nome" sort={sort} onSort={alternar}>Nome</SortableHead><SortableHead campo="periodo" sort={sort} onSort={alternar}>Período</SortableHead>
          <SortableHead campo="pessoas" sort={sort} onSort={alternar} className="text-right">Pessoas</SortableHead><SortableHead campo="enviados" sort={sort} onSort={alternar} className="text-right">Enviados</SortableHead>
          <SortableHead campo="taxa_entrega" sort={sort} onSort={alternar} className="text-right">Entrega %</SortableHead><SortableHead campo="taxa_leitura" sort={sort} onSort={alternar} className="text-right">Leitura %</SortableHead>
          <SortableHead campo="taxa_interacao" sort={sort} onSort={alternar} className="text-right">Interação %</SortableHead><SortableHead campo="pedidos" sort={sort} onSort={alternar} className="text-right">Pedidos</SortableHead>
          <SortableHead campo="receita" sort={sort} onSort={alternar} className="text-right">Receita</SortableHead><SortableHead campo="custo" sort={sort} onSort={alternar} className="text-right">Custo</SortableHead>
          {detalheCusto && <SortableHead campo="custo_mensagens" sort={sort} onSort={alternar} className="text-right">Custo msg</SortableHead>}{detalheCusto && <SortableHead campo="custo_ia" sort={sort} onSort={alternar} className="text-right">Custo IA</SortableHead>}
          <SortableHead campo="roas" sort={sort} onSort={alternar} className="text-right">ROAS</SortableHead>
          <SortableHead campo="conversao" sort={sort} onSort={alternar} className="text-right"><span className="inline-flex items-center gap-1">Conversão %<TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground" onClick={(evento) => evento.stopPropagation()} /></TooltipTrigger><TooltipContent className="max-w-60 text-xs">pedidos dividido por pessoas alcançadas</TooltipContent></Tooltip></TooltipProvider></span></SortableHead>
          <SortableHead campo="custo_por_pedido" sort={sort} onSort={alternar} className="text-right">Custo/pedido</SortableHead><SortableHead campo="receita_por_mil" sort={sort} onSort={alternar} className="text-right">Receita/mil</SortableHead><TableHead className="sticky right-0 z-10 w-12 bg-card text-right">Ações</TableHead>
        </TableRow></TableHeader><TableBody>{ordenados.map((item) => {
          const fluxo = fluxoPorId(item.fluxo_id);
          return <TableRow key={item.origem_id} className="cursor-pointer" onClick={() => setSelecionado(item)}>
            <TableCell className="min-w-64"><p className="font-medium">{item.nome}</p>{item.descricao && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.descricao}</p>}<div className="mt-1 flex flex-wrap gap-1">{(item.canais ?? []).filter((canal) => canal.toLowerCase().includes("whatsapp")).map((canal) => <Badge key={canal} variant="outline" className="gap-1 text-[10px]"><MessageSquare className="h-3 w-3" />{canal}</Badge>)}{item.status && <BadgeStatus status={item.status} />}</div></TableCell>
            <TableCell className="whitespace-nowrap text-xs">{item.primeiro_envio ? <>{dataHoraCrm(item.primeiro_envio)}<br /><span className="text-muted-foreground">até {dataHoraCrm(item.ultimo_envio)}</span></> : <span className="text-muted-foreground">ainda não rodou</span>}</TableCell>
            <TableCell className="text-right">{numeroCrm(item.pessoas)}</TableCell><TableCell className="text-right">{numeroCrm(item.enviados)}</TableCell><TableCell className="text-right">{percentualCrm(item.taxa_entrega)}</TableCell><TableCell className="text-right">{percentualCrm(item.taxa_leitura)}</TableCell><TableCell className="text-right">{percentualCrm(item.taxa_interacao)}</TableCell><TableCell className="text-right">{numeroCrm(item.pedidos)}</TableCell><TableCell className="whitespace-nowrap text-right">{brlCrm(item.receita)}</TableCell><TableCell className="whitespace-nowrap text-right">{brlCrm(item.custo)}</TableCell>{detalheCusto && <TableCell className="whitespace-nowrap text-right">{brlCrm(item.custo_mensagens)}</TableCell>}{detalheCusto && <TableCell className="whitespace-nowrap text-right">{brlCrm(item.custo_ia)}</TableCell>}<TableCell className={cn("text-right font-medium", classeRoas(item.roas, item.custo))}>{roasCrm(item.roas, item.custo)}</TableCell><TableCell className="text-right">{percentualCrm(item.conversao)}</TableCell><TableCell className="whitespace-nowrap text-right">{item.custo_por_pedido == null ? "–" : brlCrm(item.custo_por_pedido)}</TableCell><TableCell className="whitespace-nowrap text-right">{item.receita_por_mil == null ? "–" : brlCrm(item.receita_por_mil)}</TableCell>
            <TableCell className="sticky right-0 z-10 bg-card text-right" onClick={(evento) => evento.stopPropagation()}>{fluxo ? <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Ações de ${item.nome}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link to={`/automacoes/${fluxo.id}`}>Abrir</Link></DropdownMenuItem>{fluxo.status === "ativo" ? <DropdownMenuItem onClick={() => mudarStatus.mutate({ id: fluxo.id, status: "pausado" })}><Pause className="mr-2 h-4 w-4" />Pausar</DropdownMenuItem> : <DropdownMenuItem onClick={() => mudarStatus.mutate({ id: fluxo.id, status: "ativo" })}><Play className="mr-2 h-4 w-4" />Ativar</DropdownMenuItem>}<DropdownMenuItem onClick={() => duplicar.mutate(fluxo.id)}><Copy className="mr-2 h-4 w-4" />Duplicar</DropdownMenuItem><DropdownMenuItem className="text-danger" onClick={() => setParaExcluir(fluxo)}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : <span className="text-muted-foreground">–</span>}</TableCell>
          </TableRow>;
        })}</TableBody></Table></div>}
        {!carregandoFluxos && ordenados.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Nenhum item encontrado.</p>}
      </CardContent>
    </Card>
    <Sheet open={!!selecionado} onOpenChange={(aberto) => !aberto && setSelecionado(null)}><SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader><SheetTitle className="font-serif text-2xl">{selecionado?.nome}</SheetTitle><SheetDescription>{selecionado?.primeiro_envio ? `${dataHoraCrm(selecionado.primeiro_envio)} até ${dataHoraCrm(selecionado.ultimo_envio)}` : "ainda não rodou"}</SheetDescription></SheetHeader>{selecionado && <DetalheItem item={selecionado} />}</SheetContent></Sheet>
    <AlertDialog open={!!paraExcluir} onOpenChange={(aberto) => !aberto && setParaExcluir(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir fluxo?</AlertDialogTitle><AlertDialogDescription>O fluxo "{paraExcluir?.nome}" sai da lista. Se já tiver histórico, ele é arquivado no lugar de apagado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => paraExcluir && excluir.mutate(paraExcluir.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}