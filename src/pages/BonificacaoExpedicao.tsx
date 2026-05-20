import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, Save, Trash2, Plus, CheckCircle2, AlertTriangle, Clock, Truck } from "lucide-react";
import {
  useApurarExpedicao,
  useHistoricoExpedicao,
  useFecharApuracao,
  useFaixas,
  useSalvarFaixa,
  useExcluirFaixa,
  type FaixaBonificacao,
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
  const [produtosPorPedido, setProdutosPorPedido] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const ids = (ap.pedidos ?? [])
      .filter((p: any) => !p.shipment_date)
      .map((p: any) => String(p.id))
      .slice(0, 500);
    if (ids.length === 0) {
      setProdutosPorPedido({});
      return;
    }
    let cancelled = false;
    (async () => {
      const map: Record<string, string[]> = {};
      const chunkSize = 200;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("tray_productssold")
          .select("order_id, name, model, reference, quantity")
          .in("order_id", chunk);
        if (error || !data) continue;
        for (const row of data as any[]) {
          const oid = String(row.order_id);
          const nome = (row.model || (row.name ? String(row.name).split("<br>")[0] : null) || row.reference || "Produto").trim();
          const qtd = Number(row.quantity ?? 1);
          const label = qtd > 1 ? `${nome} (${qtd})` : nome;
          if (!map[oid]) map[oid] = [];
          map[oid].push(label);
        }
      }
      if (!cancelled) setProdutosPorPedido(map);
    })();
    return () => { cancelled = true; };
  }, [ap.pedidos]);


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

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI
          icon={<Truck className="w-4 h-4" />}
          label="Total de pedidos"
          value={String(ap.kpis.total_pedidos)}
          hint={fmtMesLabel(mes)}
        />
        <KPI
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          label="No prazo"
          value={String(ap.kpis.pedidos_no_prazo)}
          tone="emerald"
        />
        <KPI
          icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
          label="Atrasados"
          value={String(ap.kpis.pedidos_atrasados)}
          tone="rose"
        />
        <KPI
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          label="Pendentes (sem envio)"
          value={String(ap.kpis.pedidos_pendentes)}
          tone="amber"
        />
        <KPI
          label="% no prazo (s/ pendentes)"
          value={fmtPct(ap.kpis.percentual_prazo)}
          tone="primary"
        />
      </div>

      {/* Faixa + bônus */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Faixa atingida
            </div>
            <div className="font-serif text-2xl text-foreground mt-1">
              {ap.faixa_atingida ?? "Nenhuma faixa cadastrada para este percentual"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Bônus do mês
            </div>
            <div className="font-serif text-3xl text-primary mt-1">
              {fmtBRL(ap.valor_bonus)}
            </div>
          </div>
          <Button onClick={onFechar} disabled={fechar.isPending}>
            {fechar.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar / Fechar mês
          </Button>
        </div>
      </Card>

      {/* Lista pedidos em aberto (a expedir) */}
      {(() => {
        const HOJE = format(new Date(), "yyyy-MM-dd");
        const EXCLUIR = new Set([
          "sent", "shipped", "enviado",
          "completed", "finished", "finalizado", "concluido", "concluído",
          "canceled", "cancelled", "cancelado",
          "refunded", "estornado",
          "waiting_payment", "aguardando_pagamento", "aguardando pagamento",
          "pending_payment",
        ]);
        const abertos = ap.pedidos
          .filter((p) => !p.shipment_date)
          .filter((p) => {
            const s = (p.orderstatus_status ?? "").toLowerCase().trim();
            const t = (p.orderstatus_type ?? "").toLowerCase().trim();
            return !EXCLUIR.has(s) && !EXCLUIR.has(t);
          })
          .sort((a, b) => {
            // mais crítico primeiro: prazo mais antigo no topo
            const da = a.estimated_delivery_date ?? "9999-12-31";
            const db_ = b.estimated_delivery_date ?? "9999-12-31";
            return da.localeCompare(db_);
          });

        return (
          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="font-serif text-lg">
                Pedidos em aberto a expedir ({abertos.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Apenas pedidos pendentes de envio. Ordenados do mais crítico (prazo mais antigo) para o mais recente.
              </p>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm [&_th]:bg-background">
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Prazo de envio</TableHead>
                    <TableHead>Produtos</TableHead>
                    <TableHead>Status interno</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abertos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        Nenhum pedido em aberto neste mês.
                      </TableCell>
                    </TableRow>
                  )}
                  {(() => {
                    const D2 = format(
                      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                      "yyyy-MM-dd"
                    );
                    return abertos.slice(0, 500).map((p) => {
                      const prazo = p.estimated_delivery_date ?? "";
                      const atrasado = prazo && prazo < HOJE;
                      const hoje = prazo === HOJE;
                      const venceEm2 = prazo && prazo > HOJE && prazo <= D2;
                      return (
                        <TableRow key={String(p.id)}>
                          <TableCell className="font-mono text-xs">{String(p.id)}</TableCell>
                          <TableCell>{fmtData(p.date)}</TableCell>
                          <TableCell className={atrasado ? "text-rose-700 font-medium" : ""}>
                            {fmtData(p.estimated_delivery_date)}
                          </TableCell>
                          <TableCell className="max-w-[320px]">
                            <div className="flex flex-wrap gap-1">
                              {(produtosPorPedido[String(p.id)] ?? []).slice(0, 6).map((nome, idx) => (
                                <Badge key={idx} variant="outline" className="text-[10px] font-normal max-w-[200px] truncate" title={nome}>
                                  {nome}
                                </Badge>
                              ))}
                              {(produtosPorPedido[String(p.id)]?.length ?? 0) > 6 && (
                                <Badge variant="outline" className="text-[10px]">+{(produtosPorPedido[String(p.id)]!.length - 6)}</Badge>
                              )}
                              {!produtosPorPedido[String(p.id)] && (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {p.orderstatus_status ?? "—"}
                          </TableCell>
                          <TableCell>
                            {atrasado ? (
                              <Badge className="bg-rose-100 text-rose-800 border border-rose-200">
                                Atrasado
                              </Badge>
                            ) : hoje ? (
                              <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
                                Vence hoje
                              </Badge>
                            ) : venceEm2 ? (
                              <Badge className="bg-orange-100 text-orange-800 border border-orange-200">
                                Vence em 2 dias
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">
                                No prazo
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
              {abertos.length > 500 && (
                <div className="px-6 py-3 text-xs text-muted-foreground">
                  Mostrando os 500 primeiros. Total em aberto: {abertos.length}.
                </div>
              )}
            </div>
          </Card>
        );
      })()}
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
      <Table>
        <TableHeader>
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
        <Table>
          <TableHeader>
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
