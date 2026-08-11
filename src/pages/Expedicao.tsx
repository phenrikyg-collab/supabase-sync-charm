import { useMemo, useState } from "react";
import { useExpedicao, useExpedicaoHigienizacao, useAlterarPrazoExpedicao } from "@/hooks/useSupabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SortableHead, useOrdenado, useSortable } from "@/components/SortableHead";
import { Truck, AlertTriangle, CheckCircle, Package, ExternalLink, CalendarClock, ChevronDown, Search } from "lucide-react";
import { formatarData } from "@/utils/formatters";
import { toast } from "@/hooks/use-toast";
import type { ExpedicaoStatus } from "@/types/database";
import { cn } from "@/lib/utils";

const RISCOS = ["No Prazo", "Alerta", "Crítico"] as const;
const ORDEM_RISCO: Record<string, number> = { "crítico": 0, "critico": 0, "alerta": 1, "em alerta": 1, "no prazo": 2 };

const normalizar = (v?: string | null) => (v ?? "").trim().toLowerCase();

function riscoClasses(risco?: string | null) {
  const r = normalizar(risco);
  if (r === "no prazo") return "bg-success/10 text-success border-success/20";
  if (r === "alerta" || r === "em alerta") return "bg-warning/10 text-warning border-warning/20";
  if (r === "crítico" || r === "critico") return "bg-danger/10 text-danger border-danger/20";
  return "bg-muted text-muted-foreground border-border";
}

function linhaClasses(risco?: string | null) {
  const r = normalizar(risco);
  if (r === "no prazo") return "bg-success/5";
  if (r === "alerta" || r === "em alerta") return "bg-warning/5";
  if (r === "crítico" || r === "critico") return "bg-danger/5";
  return "";
}

const brl = (v?: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ddMM = (d?: string | null) => {
  if (!d) return "—";
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : d;
};

const hojeISO = () => new Date().toISOString().slice(0, 10);

function RiscoBadge({ risco }: { risco?: string | null }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", riscoClasses(risco))}>
      {risco ?? "—"}
    </span>
  );
}

function MultiSelect({ label, opcoes, valor, onChange }: {
  label: string; opcoes: string[]; valor: string[]; onChange: (v: string[]) => void;
}) {
  const alternar = (op: string) =>
    onChange(valor.includes(op) ? valor.filter((v) => v !== op) : [...valor, op]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="justify-between gap-2 min-w-[160px]">
          <span className="truncate">{valor.length ? `${label} (${valor.length})` : label}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-auto bg-popover z-50">
        {opcoes.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">Sem opções</div>}
        {opcoes.map((op) => (
          <DropdownMenuCheckboxItem
            key={op}
            checked={valor.includes(op)}
            onCheckedChange={() => alternar(op)}
            onSelect={(e) => e.preventDefault()}
          >
            {op}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type CampoOrd = "pedido_id" | "cliente" | "data_pedido" | "dias_corridos" | "prazo_efetivo" | "etapa" | "nivel_risco" | "transportadora" | "valor_pedido";

export default function Expedicao() {
  const { data: pedidos, isLoading } = useExpedicao();
  const { data: higienizacao, isLoading: loadingHig } = useExpedicaoHigienizacao();
  const alterarPrazo = useAlterarPrazoExpedicao();

  const [busca, setBusca] = useState("");
  const [etapas, setEtapas] = useState<string[]>([]);
  const [riscos, setRiscos] = useState<string[]>([]);
  const [transportadoras, setTransportadoras] = useState<string[]>([]);
  const [somenteAlterado, setSomenteAlterado] = useState(false);
  const [editando, setEditando] = useState<ExpedicaoStatus | null>(null);
  const [novoPrazo, setNovoPrazo] = useState("");
  const [justificativa, setJustificativa] = useState("");

  const { sort, alternar } = useSortable<CampoOrd>();

  const lista = pedidos ?? [];

  const contagem = useMemo(() => ({
    total: lista.length,
    noPrazo: lista.filter((p) => normalizar(p.nivel_risco) === "no prazo").length,
    alerta: lista.filter((p) => ["alerta", "em alerta"].includes(normalizar(p.nivel_risco))).length,
    critico: lista.filter((p) => ["crítico", "critico"].includes(normalizar(p.nivel_risco))).length,
  }), [lista]);

  const opcoesEtapa = useMemo(
    () => Array.from(new Set(lista.map((p) => p.etapa).filter(Boolean) as string[])).sort(),
    [lista]
  );
  const opcoesTransportadora = useMemo(
    () => Array.from(new Set(lista.map((p) => p.transportadora).filter(Boolean) as string[])).sort(),
    [lista]
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lista.filter((p) => {
      if (termo && !(`${p.pedido_id ?? ""}`.toLowerCase().includes(termo) || normalizar(p.cliente).includes(termo))) return false;
      if (etapas.length && !etapas.includes(p.etapa ?? "")) return false;
      if (riscos.length && !riscos.some((r) => normalizar(r) === normalizar(p.nivel_risco))) return false;
      if (transportadoras.length && !transportadoras.includes(p.transportadora ?? "")) return false;
      if (somenteAlterado && !p.prazo_alterado) return false;
      return true;
    });
  }, [lista, busca, etapas, riscos, transportadoras, somenteAlterado]);

  const padraoOrdenado = useMemo(() => {
    return [...filtrados].sort((a, b) => {
      const ra = ORDEM_RISCO[normalizar(a.nivel_risco)] ?? 9;
      const rb = ORDEM_RISCO[normalizar(b.nivel_risco)] ?? 9;
      if (ra !== rb) return ra - rb;
      return (b.dias_corridos ?? 0) - (a.dias_corridos ?? 0);
    });
  }, [filtrados]);

  const linhas = useOrdenado<ExpedicaoStatus, CampoOrd>(padraoOrdenado, sort, {
    pedido_id: (l) => l.pedido_id,
    cliente: (l) => l.cliente,
    data_pedido: (l) => l.data_pedido,
    dias_corridos: (l) => l.dias_corridos,
    prazo_efetivo: (l) => l.prazo_efetivo,
    etapa: (l) => l.etapa,
    nivel_risco: (l) => ORDEM_RISCO[normalizar(l.nivel_risco)] ?? 9,
    transportadora: (l) => l.transportadora,
    valor_pedido: (l) => l.valor_pedido,
  });

  const higOrdenada = useMemo(
    () => [...(higienizacao ?? [])].sort((a, b) => (b.dias_parado ?? 0) - (a.dias_parado ?? 0)),
    [higienizacao]
  );

  const filtrarPorRisco = (risco: string | null) => {
    if (!risco) { setRiscos([]); return; }
    setRiscos(riscos.length === 1 && normalizar(riscos[0]) === normalizar(risco) ? [] : [risco]);
  };

  const abrirEdicao = (p: ExpedicaoStatus) => {
    setEditando(p);
    setNovoPrazo(p.prazo_efetivo ?? hojeISO());
    setJustificativa("");
  };

  const salvarPrazo = async () => {
    if (!editando) return;
    if (justificativa.trim().length < 10) {
      toast({ title: "Justificativa muito curta", description: "Informe ao menos 10 caracteres.", variant: "destructive" });
      return;
    }
    if (!novoPrazo) {
      toast({ title: "Informe o novo prazo", variant: "destructive" });
      return;
    }
    try {
      await alterarPrazo.mutateAsync({
        pedido_id: String(editando.pedido_id),
        prazo_anterior: editando.prazo_efetivo,
        prazo_novo: novoPrazo,
        justificativa: justificativa.trim(),
      });
      toast({ title: "Prazo alterado", description: `Pedido ${editando.pedido_id} atualizado.` });
      setEditando(null);
    } catch (e: unknown) {
      toast({ title: "Erro ao alterar prazo", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
    }
  };

  const PrazoCell = ({ p }: { p: ExpedicaoStatus }) => (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {ddMM(p.prazo_efetivo)}
      {p.prazo_alterado && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] font-normal cursor-help">estendido</Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {p.prazo_justificativa || "Prazo estendido manualmente"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </span>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Expedição</h1>
        <p className="text-sm text-muted-foreground mt-1">Pedidos Tray — fila de expedição</p>
      </div>

      <Tabs defaultValue="fila">
        <TabsList>
          <TabsTrigger value="fila">Fila de expedição</TabsTrigger>
          <TabsTrigger value="higienizacao">Higienização</TabsTrigger>
        </TabsList>

        <TabsContent value="fila" className="space-y-5 mt-4">
          {/* Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-lg" />)
              : ([
                  { titulo: "Total na fila", valor: contagem.total, icone: Package, risco: null as string | null, cor: "text-foreground", ring: "" },
                  { titulo: "No Prazo", valor: contagem.noPrazo, icone: CheckCircle, risco: "No Prazo", cor: "text-success", ring: "border-success/30" },
                  { titulo: "Alerta", valor: contagem.alerta, icone: AlertTriangle, risco: "Alerta", cor: "text-warning", ring: "border-warning/30" },
                  { titulo: "Crítico", valor: contagem.critico, icone: Truck, risco: "Crítico", cor: "text-danger", ring: "border-danger/30" },
                ]).map((c) => {
                  const ativo = c.risco ? riscos.length === 1 && normalizar(riscos[0]) === normalizar(c.risco) : riscos.length === 0;
                  const Icone = c.icone;
                  return (
                    <button key={c.titulo} type="button" onClick={() => filtrarPorRisco(c.risco)} className="text-left">
                      <Card className={cn("transition-shadow hover:shadow-md", c.ring, ativo && "ring-2 ring-primary/40")}>
                        <CardContent className="p-5 flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.titulo}</p>
                            <p className={cn("text-2xl font-serif font-bold", c.cor)}>{c.valor}</p>
                            {c.risco === "Alerta" && <p className="text-xs text-muted-foreground">Vence hoje</p>}
                            {c.risco === "Crítico" && <p className="text-xs text-muted-foreground">Prazo estourado</p>}
                          </div>
                          <Icone className={cn("h-5 w-5", c.cor)} />
                        </CardContent>
                      </Card>
                    </button>
                  );
                })}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por pedido ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <MultiSelect label="Etapa" opcoes={opcoesEtapa} valor={etapas} onChange={setEtapas} />
            <MultiSelect label="Risco" opcoes={[...RISCOS]} valor={riscos} onChange={setRiscos} />
            <MultiSelect label="Transportadora" opcoes={opcoesTransportadora} valor={transportadoras} onChange={setTransportadoras} />
            <div className="flex items-center gap-2 rounded-md border px-3 h-10">
              <Switch id="prazo-alterado" checked={somenteAlterado} onCheckedChange={setSomenteAlterado} />
              <Label htmlFor="prazo-alterado" className="text-sm whitespace-nowrap">Somente prazo alterado</Label>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
                </div>
              ) : linhas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum pedido pendente de expedição</div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableHead campo="pedido_id" sort={sort} onSort={alternar}>Pedido</SortableHead>
                          <SortableHead campo="cliente" sort={sort} onSort={alternar}>Cliente</SortableHead>
                          <SortableHead campo="data_pedido" sort={sort} onSort={alternar}>Data</SortableHead>
                          <SortableHead campo="dias_corridos" sort={sort} onSort={alternar} className="text-right">Dias</SortableHead>
                          <SortableHead campo="prazo_efetivo" sort={sort} onSort={alternar}>Prazo</SortableHead>
                          <SortableHead campo="etapa" sort={sort} onSort={alternar}>Etapa</SortableHead>
                          <SortableHead campo="nivel_risco" sort={sort} onSort={alternar}>Risco</SortableHead>
                          <SortableHead campo="transportadora" sort={sort} onSort={alternar}>Transportadora</SortableHead>
                          <SortableHead campo="valor_pedido" sort={sort} onSort={alternar} className="text-right">Valor</SortableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linhas.map((p) => (
                          <TableRow key={p.pedido_id} className={linhaClasses(p.nivel_risco)}>
                            <TableCell className="font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                {p.pedido_id}
                                {p.codigo_rastreio && p.tracking_url && (
                                  <a href={p.tracking_url} target="_blank" rel="noopener noreferrer" title={p.codigo_rastreio}>
                                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                  </a>
                                )}
                              </span>
                            </TableCell>
                            <TableCell>{p.cliente ?? "—"}</TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">{formatarData(p.data_pedido)}</TableCell>
                            <TableCell className="text-right">{p.dias_corridos ?? 0}</TableCell>
                            <TableCell><PrazoCell p={p} /></TableCell>
                            <TableCell><Badge variant="outline" className="font-normal">{p.etapa ?? "—"}</Badge></TableCell>
                            <TableCell><RiscoBadge risco={p.nivel_risco} /></TableCell>
                            <TableCell className="text-muted-foreground">{p.transportadora ?? "—"}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{brl(p.valor_pedido)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => abrirEdicao(p)}>
                                <CalendarClock className="h-4 w-4" /> Alterar prazo
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden space-y-3">
                    {linhas.map((p) => (
                      <div key={p.pedido_id} className={cn("rounded-lg border p-4 space-y-2", linhaClasses(p.nivel_risco))}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium inline-flex items-center gap-1.5">
                            #{p.pedido_id}
                            {p.codigo_rastreio && p.tracking_url && (
                              <a href={p.tracking_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 text-primary" />
                              </a>
                            )}
                          </span>
                          <RiscoBadge risco={p.nivel_risco} />
                        </div>
                        <p className="text-sm text-foreground">{p.cliente ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">Prazo: <PrazoCell p={p} /></p>
                        <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => abrirEdicao(p)}>
                          <CalendarClock className="h-4 w-4" /> Alterar prazo
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="higienizacao" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Pedidos em aberto há mais de 60 dias. Verifique na Tray se o status ficou desatualizado antes de tratar como pendência real.
          </p>
          <Card>
            <CardContent className="pt-6">
              {loadingHig ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
              ) : higOrdenada.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum pedido para higienização</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Dias parado</TableHead>
                        <TableHead>Status Tray</TableHead>
                        <TableHead>Transportadora</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {higOrdenada.map((h) => (
                        <TableRow key={h.pedido_id}>
                          <TableCell className="font-medium">{h.pedido_id}</TableCell>
                          <TableCell>{h.cliente ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">{formatarData(h.data_pedido)}</TableCell>
                          <TableCell className="text-right font-semibold">{h.dias_parado ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{h.status_tray ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{h.transportadora ?? "—"}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{brl(h.valor_pedido)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar prazo — Pedido {editando?.pedido_id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Prazo atual</Label>
              <Input readOnly value={editando?.prazo_efetivo ? formatarData(editando.prazo_efetivo) : "—"} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="novo-prazo">Novo prazo</Label>
              <Input id="novo-prazo" type="date" min={hojeISO()} value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="justificativa">Justificativa</Label>
              <Textarea
                id="justificativa"
                rows={3}
                placeholder="Descreva o motivo da extensão (mín. 10 caracteres)"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{justificativa.trim().length}/10</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvarPrazo} disabled={alterarPrazo.isPending || justificativa.trim().length < 10 || !novoPrazo}>
              {alterarPrazo.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
