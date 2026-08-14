import { useState } from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Trash2, Plus, CheckCircle2, AlertTriangle, Clock, Truck, Factory, RefreshCw } from "lucide-react";
import {
  useApurarExpedicao,
  useHistoricoExpedicao,
  useFecharApuracao,
  useFaixas,
  useSalvarFaixa,
  useExcluirFaixa,
  useTopAtrasados,
  useRecalcularExpedicao,
  useResumoAbertos,
  useProdutosParados,
  usePedidosAbertos,
  type ProdutoParado,
  type PedidoAbertoExpedicao,
  type FaixaBonificacao,
  type PedidoAtrasado,
} from "@/hooks/useBonificacaoExpedicao";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;
const fmtData = (s: string | null) => {
  if (!s) return "—";
  try {
    const d = parse(s.slice(0, 10), "yyyy-MM-dd", new Date());
    return format(d, "dd/MM/yyyy");
  } catch {
    return s;
  }
};
const fmtMesLabel = (mesYYYYMM: string) => {
  try {
    const d = parse(mesYYYYMM + "-01", "yyyy-MM-dd", new Date());
    return format(d, "MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return mesYYYYMM;
  }
};

export default function BonificacaoExpedicao() {
  const [mes, setMes] = useState<string>(format(new Date(), "yyyy-MM"));

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl text-foreground">Acompanhamento de envios</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Apuração mensal do bônus pelo cumprimento de prazo de envio dos pedidos.
          </p>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Mês de referência
          </Label>
          <Input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-44 mt-1"
          />
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab mes={mes} />
        </TabsContent>
        <TabsContent value="historico">
          <HistoricoTab />
        </TabsContent>
        <TabsContent value="config">
          <ConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ───────────── Dashboard ───────────── */


function DashboardTab({ mes }: { mes: string }) {
  const ap = useApurarExpedicao(mes);
  const fechar = useFecharApuracao();
  const recalcular = useRecalcularExpedicao();
  const atrasadosQ = useTopAtrasados(15);
  const resumoQ = useResumoAbertos();
  const paradosQ = useProdutosParados(200);
  const pedidosAbertosQ = usePedidosAbertos();

  if (ap.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const onFechar = async () => {
    try {
      await fechar.mutateAsync({
        mes: `${mes}-01`,
        total_pedidos: ap.kpis.total_pedidos,
        pedidos_no_prazo: ap.kpis.pedidos_no_prazo,
        pedidos_atrasados: ap.kpis.pedidos_atrasados,
        pedidos_pendentes: ap.kpis.pedidos_pendentes,
        percentual_prazo: Number(ap.kpis.percentual_prazo.toFixed(2)),
        valor_bonus: ap.valor_bonus,
        faixa_atingida: ap.faixa_atingida,
        observacao: null,
        status: "calculado",
      });
      toast.success("Apuração salva no histórico.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar apuração.");
    }
  };

  const abaixoMeta = ap.kpis.percentual_prazo < 80;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI icon={<Truck className="w-4 h-4" />} label="Total de pedidos" value={String(ap.kpis.total_pedidos)} hint={fmtMesLabel(mes)} />
        <KPI icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} label="No prazo" value={String(ap.kpis.pedidos_no_prazo)} tone="emerald" />
        <KPI icon={<AlertTriangle className="w-4 h-4 text-rose-600" />} label="Atrasados" value={String(ap.kpis.pedidos_atrasados)} tone="rose" />
        <KPI icon={<Clock className="w-4 h-4 text-amber-600" />} label="Pendentes (sem envio)" value={String(ap.kpis.pedidos_pendentes)} tone="amber" />
        <KPI label="% no prazo (s/ pendentes)" value={fmtPct(ap.kpis.percentual_prazo)} tone={abaixoMeta ? "rose" : "primary"} />
      </div>

      {abaixoMeta && (
        <Card className="p-4 border-rose-300 bg-rose-50/70 dark:bg-rose-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5" />
            <div>
              <p className="font-medium text-rose-800 dark:text-rose-200">
                Abaixo da meta mínima de 80%
              </p>
              <p className="text-sm text-rose-700 dark:text-rose-300">
                O percentual de pedidos no prazo ({fmtPct(ap.kpis.percentual_prazo)}) está abaixo do limite operacional. Revisar processo de expedição.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Faixa + bônus */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Faixa atingida</div>
            <div className="font-serif text-2xl text-foreground mt-1">
              {ap.faixa_atingida ?? "Nenhuma faixa cadastrada para este percentual"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Bônus do mês</div>
            <div className="font-serif text-3xl text-primary mt-1">{fmtBRL(ap.valor_bonus)}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => recalcular.mutate(`${mes}-01`)}
              disabled={recalcular.isPending}
            >
              {recalcular.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Recalcular agora
            </Button>
            <Button onClick={onFechar} disabled={fechar.isPending}>
              {fechar.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar / Fechar mês
            </Button>
          </div>
        </div>
      </Card>

      {/* Pedidos críticos — atraso no envio */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-serif text-lg">Pedidos Críticos — Atraso no Envio</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Pedidos com maior atraso no envio, ordenados do mais crítico ao menos crítico.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {(atrasadosQ.data ?? []).length} pedidos
          </Badge>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm [&_th]:bg-background">
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data do pedido</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Transportadora</TableHead>
                <TableHead className="text-right">Dias de atraso</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {atrasadosQ.isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin inline text-primary" />
                  </TableCell>
                </TableRow>
              )}
              {!atrasadosQ.isLoading && (atrasadosQ.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Nenhum pedido crítico no momento.
                  </TableCell>
                </TableRow>
              )}
              {(atrasadosQ.data ?? []).map((p: PedidoAtrasado) => {
                const dias = Number(p.dias_atraso ?? 0);
                const badgeTone =
                  dias >= 30 ? "bg-rose-100 text-rose-800 border-rose-200" :
                  dias >= 14 ? "bg-orange-100 text-orange-800 border-orange-200" :
                  "bg-amber-100 text-amber-800 border-amber-200";
                return (
                  <TableRow key={String(p.pedido_id)} className={dias >= 30 ? "bg-rose-50/50 hover:bg-rose-100/50" : ""}>
                    <TableCell className="font-mono text-xs">#{p.pedido_id}</TableCell>
                    <TableCell className="font-medium">{p.cliente ?? "—"}</TableCell>
                    <TableCell>{fmtData(p.data_pedido)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.etapa ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.transportadora ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={badgeTone}>{dias} dias</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(Number(p.valor_pedido ?? 0))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Resumo dos pedidos em aberto */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI icon={<Truck className="w-4 h-4" />} label="Total em aberto" value={String(resumoQ.data?.total_pedidos_abertos ?? 0)} />
        <KPI icon={<AlertTriangle className="w-4 h-4 text-rose-600" />} label="Críticos (atrasados)" value={String(resumoQ.data?.total_criticos ?? 0)} tone="rose" />
        <KPI icon={<Clock className="w-4 h-4 text-amber-600" />} label="Em alerta (vence hoje)" value={String(resumoQ.data?.total_alerta ?? 0)} tone="amber" />
        <KPI icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} label="No prazo" value={String(resumoQ.data?.total_no_prazo ?? 0)} tone="emerald" />
        <KPI label="Valor total parado" value={fmtBRL(Number(resumoQ.data?.valor_total_parado ?? 0))} tone="primary" />
      </div>

      {/* Lista pedidos em aberto (fonte vw_expedicao_status) */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-serif text-lg">
            Pedidos em aberto a expedir ({resumoQ.data?.total_pedidos_abertos ?? (pedidosAbertosQ.data ?? []).length})
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Todos os pedidos pendentes de envio, ordenados do mais crítico (maior tempo em aberto) para o mais recente.
          </p>
        </div>
        <div className="max-h-[620px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm [&_th]:bg-background">
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Dias em aberto</TableHead>
                <TableHead>Etapa atual</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Risco</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidosAbertosQ.isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin inline text-primary" />
                  </TableCell>
                </TableRow>
              )}
              {!pedidosAbertosQ.isLoading && (pedidosAbertosQ.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Nenhum pedido em aberto.
                  </TableCell>
                </TableRow>
              )}
              {(pedidosAbertosQ.data ?? []).map((p: PedidoAbertoExpedicao) => {
                const risco = (p.nivel_risco ?? "No Prazo").trim();
                const riscoTone =
                  risco === "Crítico"
                    ? "bg-rose-100 text-rose-800 border-rose-200"
                    : risco === "Alerta"
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-emerald-100 text-emerald-800 border-emerald-200";
                const rowTone =
                  risco === "Crítico"
                    ? "bg-rose-50/70 hover:bg-rose-100/70"
                    : risco === "Alerta"
                    ? "bg-amber-50/60 hover:bg-amber-100/60"
                    : "";
                return (
                  <TableRow key={String(p.pedido_id)} className={rowTone}>
                    <TableCell className="font-mono text-xs">
                      {p.tracking_url ? (
                        <a href={p.tracking_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                          #{p.pedido_id}
                        </a>
                      ) : (
                        `#${p.pedido_id}`
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{p.cliente ?? "—"}</TableCell>
                    <TableCell className="text-right">{Number(p.dias_corridos ?? 0)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.etapa ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(Number(p.valor_pedido ?? 0))}</TableCell>
                    <TableCell>
                      <Badge className={riscoTone}>{risco}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Produtos parados — somatório por produto + cor + tamanho */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-serif text-lg">Produtos parados em pedidos em aberto</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Soma de peças por produto, cor e tamanho considerando todos os pedidos pendentes de envio.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {(paradosQ.data ?? []).reduce((s, r) => s + Number(r.vendido ?? 0), 0)} peças · {(paradosQ.data ?? []).length} variações
          </Badge>
        </div>
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm [&_th]:bg-background">
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead className="text-right">Vendido</TableHead>
                <TableHead className="text-right">Em produção</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Pedidos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paradosQ.isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin inline text-primary" />
                  </TableCell>
                </TableRow>
              )}
              {!paradosQ.isLoading && (paradosQ.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Nenhum produto parado.
                  </TableCell>
                </TableRow>
              )}
              {(paradosQ.data ?? []).map((r: ProdutoParado, i: number) => {
                const vendido = Number(r.vendido ?? 0);
                const emProd = Number(r.em_producao ?? 0);
                const saldo = Number(r.saldo ?? emProd - vendido);
                const critico = saldo < 0;
                const pedidos = (r.pedidos ?? []).map(String);
                return (
                  <TableRow key={`${r.produto_id}-${r.cor ?? ""}-${r.tamanho ?? ""}-${i}`} className={critico ? "bg-rose-50/70 hover:bg-rose-100/70" : emProd > 0 ? "bg-emerald-50/50 hover:bg-emerald-100/50" : ""}>
                    <TableCell className="font-medium">{r.nome ?? "—"}</TableCell>
                    <TableCell>{r.cor ?? "—"}</TableCell>
                    <TableCell>{r.tamanho ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{vendido}</TableCell>
                    <TableCell className="text-right">
                      {emProd > 0 ? (
                        <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
                          <Factory className="w-3 h-3 mr-1" />{emProd}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">0</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {critico ? (
                        <Badge className="bg-rose-100 text-rose-800 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 mr-1" />{saldo}
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">+{saldo}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <span className="text-xs text-muted-foreground font-mono" title={pedidos.join(", ")}>
                        {pedidos.slice(0, 5).join(", ")}
                        {pedidos.length > 5 ? ` +${pedidos.length - 5}` : ""}
                        {pedidos.length === 0 ? "—" : ""}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}



function KPI({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "emerald" | "rose" | "amber" | "primary";
}) {
  const valueClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : tone === "amber"
      ? "text-amber-700"
      : tone === "primary"
      ? "text-primary"
      : "text-foreground";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`font-serif text-3xl mt-2 ${valueClass}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

/* ───────────── Histórico ───────────── */

function HistoricoTab() {
  const { data = [], isLoading } = useHistoricoExpedicao();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <Card className="p-0 overflow-hidden">
      <div className="max-h-[620px] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm [&_th]:bg-background">
          <TableRow>
            <TableHead>Mês</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">No prazo</TableHead>
            <TableHead className="text-right">Atrasados</TableHead>
            <TableHead className="text-right">Pendentes</TableHead>
            <TableHead className="text-right">% Prazo</TableHead>
            <TableHead>Faixa</TableHead>
            <TableHead className="text-right">Bônus</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                Nenhuma apuração salva ainda.
              </TableCell>
            </TableRow>
          )}
          {data.map((r) => (
            <TableRow key={r.id ?? r.mes}>
              <TableCell className="font-medium">
                {fmtMesLabel((r.mes ?? "").slice(0, 7))}
              </TableCell>
              <TableCell className="text-right">{r.total_pedidos}</TableCell>
              <TableCell className="text-right text-emerald-700">{r.pedidos_no_prazo}</TableCell>
              <TableCell className="text-right text-rose-700">{r.pedidos_atrasados}</TableCell>
              <TableCell className="text-right text-amber-700">{r.pedidos_pendentes}</TableCell>
              <TableCell className="text-right">{fmtPct(Number(r.percentual_prazo ?? 0))}</TableCell>
              <TableCell>{r.faixa_atingida ?? "—"}</TableCell>
              <TableCell className="text-right font-medium">
                {fmtBRL(Number(r.valor_bonus ?? 0))}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{r.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </Card>
  );
}

/* ───────────── Configurações (faixas) ───────────── */

function ConfigTab() {
  const { data: faixas = [], isLoading } = useFaixas();
  const salvar = useSalvarFaixa();
  const excluir = useExcluirFaixa();

  const [novo, setNovo] = useState<Partial<FaixaBonificacao>>({
    percentual_minimo: 0,
    percentual_maximo: 100,
    valor_bonus: 0,
    descricao: "",
    ativo: true,
  });

  const onAdd = async () => {
    try {
      await salvar.mutateAsync(novo);
      toast.success("Faixa adicionada.");
      setNovo({
        percentual_minimo: 0,
        percentual_maximo: 100,
        valor_bonus: 0,
        descricao: "",
        ativo: true,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar faixa.");
    }
  };

  const onSave = async (f: FaixaBonificacao) => {
    try {
      await salvar.mutateAsync(f);
      toast.success("Faixa atualizada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar.");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta faixa?")) return;
    try {
      await excluir.mutateAsync(id);
      toast.success("Faixa excluída.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <h3 className="font-serif text-lg">Nova faixa</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label>% mínimo</Label>
            <Input
              type="number"
              step="0.01"
              value={novo.percentual_minimo ?? 0}
              onChange={(e) =>
                setNovo((s) => ({ ...s, percentual_minimo: Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <Label>% máximo</Label>
            <Input
              type="number"
              step="0.01"
              value={novo.percentual_maximo ?? 0}
              onChange={(e) =>
                setNovo((s) => ({ ...s, percentual_maximo: Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <Label>Valor bônus (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={novo.valor_bonus ?? 0}
              onChange={(e) =>
                setNovo((s) => ({ ...s, valor_bonus: Number(e.target.value) }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <Input
              value={novo.descricao ?? ""}
              onChange={(e) => setNovo((s) => ({ ...s, descricao: e.target.value }))}
              placeholder="Ex: Excelência ≥ 95%"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={onAdd} disabled={salvar.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar faixa
          </Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="max-h-[620px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm [&_th]:bg-background">
            <TableRow>
              <TableHead>% mínimo</TableHead>
              <TableHead>% máximo</TableHead>
              <TableHead>Valor bônus</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-32">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {faixas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  Nenhuma faixa cadastrada.
                </TableCell>
              </TableRow>
            )}
            {faixas.map((f) => (
              <FaixaRow key={f.id} faixa={f} onSave={onSave} onDelete={onDelete} />
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  );
}

function FaixaRow({
  faixa,
  onSave,
  onDelete,
}: {
  faixa: FaixaBonificacao;
  onSave: (f: FaixaBonificacao) => void;
  onDelete: (id: string) => void;
}) {
  const [edit, setEdit] = useState<FaixaBonificacao>(faixa);
  return (
    <TableRow>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={edit.percentual_minimo}
          onChange={(e) => setEdit({ ...edit, percentual_minimo: Number(e.target.value) })}
          className="w-24"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={edit.percentual_maximo}
          onChange={(e) => setEdit({ ...edit, percentual_maximo: Number(e.target.value) })}
          className="w-24"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={edit.valor_bonus}
          onChange={(e) => setEdit({ ...edit, valor_bonus: Number(e.target.value) })}
          className="w-32"
        />
      </TableCell>
      <TableCell>
        <Input
          value={edit.descricao ?? ""}
          onChange={(e) => setEdit({ ...edit, descricao: e.target.value })}
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button size="icon" variant="outline" onClick={() => onSave(edit)} title="Salvar">
            <Save className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => onDelete(faixa.id)}
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
