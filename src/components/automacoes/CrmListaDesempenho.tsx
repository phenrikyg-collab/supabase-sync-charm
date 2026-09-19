import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, HandCoins, Mail, MessageSquare, MousePointerClick, PackageCheck, Search, Send, ShoppingBag, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead, useOrdenado, useSortable } from "@/components/SortableHead";
import { cn } from "@/lib/utils";
import { CrmKpiCard, classeRoas } from "./CrmKpiCard";
import { brlCrm, dataHoraCrm, numeroCrm, percentualCrm, roasCrm, type ItemCrm, type MetricasCrm } from "./crmTipos";

type Campo = "nome" | "periodo" | "enviados" | "taxa_entrega" | "taxa_leitura" | "taxa_abertura" | "taxa_clique" | "taxa_interacao" | "pedidos" | "receita" | "custo" | "roas" | "conversao" | "custo_por_pedido" | "receita_por_mil";

const acessores: Record<Campo, (item: ItemCrm) => number | string | null | undefined> = {
  nome: (i) => i.nome,
  periodo: (i) => i.primeiro_envio,
  enviados: (i) => i.enviados,
  taxa_entrega: (i) => i.taxa_entrega,
  taxa_leitura: (i) => i.taxa_leitura,
  taxa_abertura: (i) => i.taxa_abertura,
  taxa_clique: (i) => i.taxa_clique,
  taxa_interacao: (i) => i.taxa_interacao,
  pedidos: (i) => i.pedidos,
  receita: (i) => i.receita,
  custo: (i) => i.custo,
  roas: (i) => i.roas,
  conversao: (i) => i.conversao,
  custo_por_pedido: (i) => i.custo_por_pedido,
  receita_por_mil: (i) => i.receita_por_mil,
};

function normalizar(valor: string) { return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

function DetalheItem({ item }: { item: ItemCrm }) {
  const kpis = [
    ["Enviados", numeroCrm(item.enviados)], ["WhatsApp", numeroCrm(item.enviados_whatsapp)], ["E-mails", numeroCrm(item.enviados_email)],
    ["Entregues", numeroCrm(item.entregues)], ["Lidos", numeroCrm(item.lidos)], ["Abertos", numeroCrm(item.abertos)], ["Cliques", numeroCrm(item.cliques)],
    ["Botões", numeroCrm(item.botoes)], ["Respostas", numeroCrm(item.respostas)], ["Pedidos", numeroCrm(item.pedidos)], ["Receita", brlCrm(item.receita)],
    ["Custo", brlCrm(item.custo)], ["ROAS", roasCrm(item.roas, item.custo)], ["Conversão", percentualCrm(item.conversao)], ["Ticket médio", brlCrm(item.ticket_medio)],
    ["Custo por pedido", item.custo_por_pedido == null ? "–" : brlCrm(item.custo_por_pedido)], ["Receita por mil", item.receita_por_mil == null ? "–" : brlCrm(item.receita_por_mil)],
  ];
  return <div className="mt-6 space-y-6">
    <div className="grid grid-cols-2 gap-3">{kpis.map(([r, v]) => <div key={r} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{r}</p><p className="mt-1 font-semibold">{v}</p></div>)}</div>
    <div><h3 className="mb-3 font-serif text-lg font-semibold">Taxas</h3><div className="grid grid-cols-2 gap-3">{[["Entrega", item.taxa_entrega], ["Leitura", item.taxa_leitura], ["Abertura", item.taxa_abertura], ["Clique", item.taxa_clique], ["Interação", item.taxa_interacao]].map(([r, v]) => <div key={String(r)} className="flex justify-between border-b py-2 text-sm"><span>{r}</span><strong>{percentualCrm(v)}</strong></div>)}</div></div>
    <div><h3 className="mb-3 font-serif text-lg font-semibold">Custo por categoria</h3><Table><TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead className="text-right">Envios</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader><TableBody>{Object.entries(item.por_categoria ?? {}).map(([categoria, valores]) => <TableRow key={categoria}><TableCell>{categoria}</TableCell><TableCell className="text-right">{numeroCrm(valores?.envios)}</TableCell><TableCell className="text-right">{brlCrm(valores?.custo)}</TableCell></TableRow>)}</TableBody></Table></div>
    {item.fluxo_id != null && <Button asChild className="w-full"><Link to={`/automacoes/${item.fluxo_id}`}>Abrir fluxo</Link></Button>}
  </div>;
}

export function CrmListaDesempenho({ dados }: { dados?: MetricasCrm }) {
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<ItemCrm | null>(null);
  const { sort, alternar } = useSortable<Campo>({ key: "receita" });
  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return (dados?.itens_lista ?? []).filter((item) => !termo || normalizar(item.nome).includes(termo));
  }, [busca, dados?.itens_lista]);
  const ordenados = useOrdenado(filtrados, sort, acessores);
  const interacoes = Number(dados?.botoes ?? 0) + Number(dados?.respostas ?? 0);
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      <CrmKpiCard titulo="Enviados" valor={numeroCrm(dados?.enviados)} icon={Send} /><CrmKpiCard titulo="Entregues" valor={numeroCrm(dados?.entregues)} icon={PackageCheck} />
      <CrmKpiCard titulo="Lidos" valor={numeroCrm(dados?.lidos)} icon={Eye} /><CrmKpiCard titulo="Interações" valor={numeroCrm(interacoes)} icon={MousePointerClick} />
      <CrmKpiCard titulo="Pedidos" valor={numeroCrm(dados?.pedidos)} icon={ShoppingBag} /><CrmKpiCard titulo="Receita" valor={brlCrm(dados?.receita)} icon={HandCoins} />
      <CrmKpiCard titulo="Custo" valor={brlCrm(dados?.custo)} icon={WalletCards} /><CrmKpiCard titulo="ROAS" valor={roasCrm(dados?.roas, dados?.custo)} className={classeRoas(dados?.roas, dados?.custo)} />
      <CrmKpiCard titulo="% faturamento" valor={percentualCrm(dados?.pct_faturamento)} />
    </div>

    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0"><CardTitle className="text-xl">Desempenho</CardTitle><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome" /></div></CardHeader>
      <CardContent className="p-0">
        <Table><TableHeader><TableRow>
          <SortableHead campo="nome" sort={sort} onSort={alternar}>Nome</SortableHead><SortableHead campo="periodo" sort={sort} onSort={alternar}>Período</SortableHead>
          <SortableHead campo="enviados" sort={sort} onSort={alternar} className="text-right">Enviados</SortableHead><SortableHead campo="taxa_entrega" sort={sort} onSort={alternar} className="text-right">Entrega %</SortableHead>
          <SortableHead campo="taxa_leitura" sort={sort} onSort={alternar} className="text-right">Leitura %</SortableHead><SortableHead campo="taxa_abertura" sort={sort} onSort={alternar} className="text-right">Abertura %</SortableHead>
          <SortableHead campo="taxa_clique" sort={sort} onSort={alternar} className="text-right">Clique %</SortableHead><SortableHead campo="taxa_interacao" sort={sort} onSort={alternar} className="text-right">Interação %</SortableHead>
          <SortableHead campo="pedidos" sort={sort} onSort={alternar} className="text-right">Pedidos</SortableHead><SortableHead campo="receita" sort={sort} onSort={alternar} className="text-right">Receita</SortableHead>
          <SortableHead campo="custo" sort={sort} onSort={alternar} className="text-right">Custo</SortableHead><SortableHead campo="roas" sort={sort} onSort={alternar} className="text-right">ROAS</SortableHead>
          <SortableHead campo="conversao" sort={sort} onSort={alternar} className="text-right">Conversão %</SortableHead><SortableHead campo="custo_por_pedido" sort={sort} onSort={alternar} className="text-right">Custo/pedido</SortableHead>
          <SortableHead campo="receita_por_mil" sort={sort} onSort={alternar} className="text-right">Receita/mil</SortableHead>
        </TableRow></TableHeader><TableBody>{ordenados.map((item) => <TableRow key={item.origem_id} className="cursor-pointer" onClick={() => setSelecionado(item)}>
          <TableCell className="min-w-64"><p className="font-medium">{item.nome}</p><div className="mt-1 flex flex-wrap gap-1">{(item.canais ?? []).map((canal) => <Badge key={canal} variant="outline" className="gap-1 text-[10px]">{canal.toLowerCase().includes("mail") ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}{canal}</Badge>)}{item.status && <Badge variant="secondary" className="text-[10px]">{item.status}</Badge>}</div></TableCell>
          <TableCell className="whitespace-nowrap text-xs">{dataHoraCrm(item.primeiro_envio)}<br /><span className="text-muted-foreground">até {dataHoraCrm(item.ultimo_envio)}</span></TableCell>
          <TableCell className="text-right">{numeroCrm(item.enviados)}</TableCell><TableCell className="text-right">{percentualCrm(item.taxa_entrega)}</TableCell><TableCell className="text-right">{percentualCrm(item.taxa_leitura)}</TableCell><TableCell className="text-right">{percentualCrm(item.taxa_abertura)}</TableCell><TableCell className="text-right">{percentualCrm(item.taxa_clique)}</TableCell><TableCell className="text-right">{percentualCrm(item.taxa_interacao)}</TableCell><TableCell className="text-right">{numeroCrm(item.pedidos)}</TableCell><TableCell className="whitespace-nowrap text-right">{brlCrm(item.receita)}</TableCell><TableCell className="whitespace-nowrap text-right">{brlCrm(item.custo)}</TableCell><TableCell className={cn("text-right font-medium", classeRoas(item.roas, item.custo))}>{roasCrm(item.roas, item.custo)}</TableCell><TableCell className="text-right">{percentualCrm(item.conversao)}</TableCell><TableCell className="whitespace-nowrap text-right">{item.custo_por_pedido == null ? "–" : brlCrm(item.custo_por_pedido)}</TableCell><TableCell className="whitespace-nowrap text-right">{item.receita_por_mil == null ? "–" : brlCrm(item.receita_por_mil)}</TableCell>
        </TableRow>)}</TableBody></Table>
        {ordenados.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Nenhum item encontrado.</p>}
      </CardContent>
    </Card>
    <Sheet open={!!selecionado} onOpenChange={(aberto) => !aberto && setSelecionado(null)}><SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader><SheetTitle className="font-serif text-2xl">{selecionado?.nome}</SheetTitle><SheetDescription>{dataHoraCrm(selecionado?.primeiro_envio)} até {dataHoraCrm(selecionado?.ultimo_envio)}</SheetDescription></SheetHeader>{selecionado && <DetalheItem item={selecionado} />}</SheetContent></Sheet>
  </div>;
}