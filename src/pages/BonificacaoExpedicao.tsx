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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Trash2, Plus, CheckCircle2, AlertTriangle, Clock, Truck, Factory } from "lucide-react";
import {
  useApurarExpedicao,
  useHistoricoExpedicao,
  useFecharApuracao,
  useFaixas,
  useSalvarFaixa,
  useExcluirFaixa,
  type FaixaBonificacao,
} from "@/hooks/useBonificacaoExpedicao";
import { useCreateOrdemProducao, useOficinas, useProdutos } from "@/hooks/useSupabase";

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

type TrayOpen = {
  id: string | number;
  date: string | null;
  estimated_delivery_date: string | null;
  shipment_date: string | null;
  orderstatus_type: string | null;
  orderstatus_status: string | null;
};

const EXCLUIR_STATUS = new Set([
  "sent", "shipped", "enviado",
  "completed", "finished", "finalizado", "concluido", "concluído",
  "canceled", "cancelled", "cancelado",
  "refunded", "estornado",
  "waiting_payment", "aguardando_pagamento", "aguardando pagamento",
  "pending_payment",
]);

async function fetchTodosAbertos(): Promise<TrayOpen[]> {
  const acc: TrayOpen[] = [];
  let from = 0;
  const size = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("tray_orders" as any)
      .select("id,date,estimated_delivery_date,shipment_date,orderstatus_type,orderstatus_status")
      .is("shipment_date", null)
      .range(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as TrayOpen[];
    acc.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return acc.filter((p) => {
    const s = (p.orderstatus_status ?? "").toLowerCase().trim();
    const t = (p.orderstatus_type ?? "").toLowerCase().trim();
    return !EXCLUIR_STATUS.has(s) && !EXCLUIR_STATUS.has(t);
  });
}

type ItemPedido = { nome: string; cor: string; tamanho: string; qtd: number; variant_id: string | null };

function decodePy(s: string): string {
  try { return decodeURIComponent(escape(s)); } catch { return s; }
}
function extrairCorTraySku(sku: string | null): string | null {
  if (!sku) return null;
  const m = sku.match(/'type':\s*u?'Cor'[^}]*'value':\s*u?'([^']+)'/i);
  return m ? decodePy(m[1]).trim() : null;
}
function extrairTamanhoTraySku(sku: string | null): string | null {
  if (!sku) return null;
  const m = sku.match(/'type':\s*u?'Tamanho'[^}]*'value':\s*u?'([^']+)'/i);
  return m ? decodePy(m[1]).trim() : null;
}

function DashboardTab({ mes }: { mes: string }) {
  const ap = useApurarExpedicao(mes);
  const fechar = useFecharApuracao();
  const qc = useQueryClient();
  const [itensPorPedido, setItensPorPedido] = useState<Record<string, ItemPedido[]>>({});
  const [prazoEdit, setPrazoEdit] = useState<Record<string, string>>({});
  const [savingPrazo, setSavingPrazo] = useState<Record<string, boolean>>({});
  const [opDialogPedido, setOpDialogPedido] = useState<TrayOpen | null>(null);
  const [justifDialog, setJustifDialog] = useState<{ pid: string; prazoAnterior: string; prazoNovo: string } | null>(null);
  const [justifText, setJustifText] = useState("");

  const abertosQ = useQuery({
    queryKey: ["tray-abertos-all"],
    queryFn: fetchTodosAbertos,
  });
  const abertosAll = abertosQ.data ?? [];

  // Mapa variant_id -> { cor, tamanho } para todas as variantes Tray
  const variantsQ = useQuery({
    queryKey: ["tray-variants-cor-tamanho"],
    queryFn: async () => {
      const map: Record<string, { cor: string | null; tamanho: string | null }> = {};
      let from = 0;
      const size = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("tray_products_variants" as any)
          .select("variant_id, variant_sku")
          .range(from, from + size - 1);
        if (error) break;
        const rows = (data ?? []) as any[];
        for (const v of rows) {
          map[String(v.variant_id)] = {
            cor: extrairCorTraySku(v.variant_sku),
            tamanho: extrairTamanhoTraySku(v.variant_sku),
          };
        }
        if (rows.length < size) break;
        from += size;
      }
      return map;
    },
  });
  const variantsMap = variantsQ.data ?? {};

  useEffect(() => {
    const ids = abertosAll.map((p) => String(p.id));
    if (ids.length === 0) {
      setItensPorPedido({});
      return;
    }
    let cancelled = false;
    (async () => {
      const map: Record<string, ItemPedido[]> = {};
      const chunkSize = 200;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("tray_productssold")
          .select("order_id, name, model, reference, quantity, variant_id")
          .in("order_id", chunk);
        if (error || !data) continue;
        for (const row of data as any[]) {
          const oid = String(row.order_id);
          const nome = (row.model || (row.name ? String(row.name).split("<br>")[0] : null) || row.reference || "Produto").trim();
          const qtd = Number(row.quantity ?? 1);
          const vid = row.variant_id != null ? String(row.variant_id) : null;
          const v = vid ? variantsMap[vid] : null;
          const cor = v?.cor ?? extrairCorTraySku(row.reference) ?? "—";
          const tamanho = v?.tamanho ?? extrairTamanhoTraySku(row.reference) ?? "—";
          if (!map[oid]) map[oid] = [];
          map[oid].push({ nome, cor, tamanho, qtd, variant_id: vid });
        }
      }
      if (!cancelled) setItensPorPedido(map);
    })();
    return () => { cancelled = true; };
  }, [abertosAll.length, variantsQ.data]);

  // Lista para exibir badges com nome (compat com lógica anterior)
  const produtosPorPedido: Record<string, string[]> = {};
  for (const [oid, itens] of Object.entries(itensPorPedido)) {
    produtosPorPedido[oid] = itens.map((it) => {
      const base = it.nome;
      const extra: string[] = [];
      if (it.cor !== "—") extra.push(it.cor);
      if (it.tamanho !== "—") extra.push(it.tamanho);
      const suf = extra.length ? ` [${extra.join(" / ")}]` : "";
      return it.qtd > 1 ? `${base}${suf} (${it.qtd})` : `${base}${suf}`;
    });
  }

  // OPs ativas: soma de peças em produção por (nome_produto + cor + tamanho).
  // ordens_producao não tem tamanho; usamos ordens_corte_grade para abrir por tamanho
  // e distribuímos proporcionalmente caso a soma da grade difira da qtd da OP.
  const opsAtivasQ = useQuery({
    queryKey: ["ops-ativas-producao-grade"],
    queryFn: async () => {
      const [ops, cores] = await Promise.all([
        supabase
          .from("ordens_producao" as any)
          .select("produto_id, nome_produto, cor_id, ordem_corte_id, quantidade, quantidade_pecas_ordem, status_ordem"),
        supabase.from("cores" as any).select("id, nome_cor"),
      ]);
      const coresMap: Record<string, string> = {};
      for (const c of (cores.data ?? []) as any[]) coresMap[String(c.id)] = (c.nome_cor ?? "").trim();
      const ATIVOS = new Set(["corte", "costura", "revisao", "revisão", "em conserto"]);
      const activeOps = ((ops.data ?? []) as any[]).filter((o) =>
        ATIVOS.has((o.status_ordem ?? "").toLowerCase().trim())
      );

      const nomePorProduto: Record<string, string> = {};
      for (const o of activeOps) {
        if (o.produto_id) nomePorProduto[String(o.produto_id)] = (o.nome_produto ?? "").trim().toLowerCase();
      }

      const opQtdPorChave: Record<string, number> = {};
      const ocIds = new Set<string>();
      for (const o of activeOps) {
        const qtd = Number(o.quantidade_pecas_ordem ?? o.quantidade ?? 0);
        if (o.ordem_corte_id && o.produto_id) {
          const k = `${o.ordem_corte_id}|${o.produto_id}|${o.cor_id ?? ""}`;
          opQtdPorChave[k] = (opQtdPorChave[k] ?? 0) + qtd;
          ocIds.add(String(o.ordem_corte_id));
        }
      }

      const map: Record<string, number> = {};
      const fallback: Record<string, number> = {};

      if (ocIds.size > 0) {
        const ocList = Array.from(ocIds);
        const grades: any[] = [];
        const CHUNK = 100;
        for (let i = 0; i < ocList.length; i += CHUNK) {
          const slice = ocList.slice(i, i + CHUNK);
          const { data } = await supabase
            .from("ordens_corte_grade" as any)
            .select("ordem_corte_id, produto_id, cor_id, tamanho, quantidade")
            .in("ordem_corte_id", slice);
          if (data) grades.push(...(data as any[]));
        }

        const totalGradePorChave: Record<string, number> = {};
        for (const g of grades) {
          const k = `${g.ordem_corte_id}|${g.produto_id}|${g.cor_id ?? ""}`;
          totalGradePorChave[k] = (totalGradePorChave[k] ?? 0) + Number(g.quantidade ?? 0);
        }

        for (const g of grades) {
          const k = `${g.ordem_corte_id}|${g.produto_id}|${g.cor_id ?? ""}`;
          const qtdOp = opQtdPorChave[k];
          if (qtdOp == null) continue;
          const totalGrade = totalGradePorChave[k] || 0;
          const qtdGrade = Number(g.quantidade ?? 0);
          const qtdEfetiva =
            totalGrade > 0 ? Math.round((qtdGrade * qtdOp) / totalGrade) : qtdGrade;
          const nome = nomePorProduto[String(g.produto_id)] ?? "";
          const cor = (coresMap[String(g.cor_id)] ?? "").trim().toLowerCase();
          const tam = (g.tamanho ?? "").toString().trim().toLowerCase();
          if (!nome) continue;
          map[`${nome}||${cor}||${tam}`] = (map[`${nome}||${cor}||${tam}`] ?? 0) + qtdEfetiva;
          const fkey = `${nome}||${cor}`;
          fallback[fkey] = (fallback[fkey] ?? 0) + qtdEfetiva;
        }
      }

      for (const o of activeOps) {
        if (o.ordem_corte_id) continue;
        const qtd = Number(o.quantidade_pecas_ordem ?? o.quantidade ?? 0);
        const nome = (o.nome_produto ?? "").trim().toLowerCase();
        const cor = (coresMap[String(o.cor_id)] ?? "").trim().toLowerCase();
        if (!nome) continue;
        fallback[`${nome}||${cor}`] = (fallback[`${nome}||${cor}`] ?? 0) + qtd;
      }

      return { map, fallback };
    },
  });
  const opsData = opsAtivasQ.data ?? { map: {} as Record<string, number>, fallback: {} as Record<string, number> };

  const norm = (s: string) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  // Índices normalizados (acentos, pontuação, case) sobre os dados de OPs
  const opsNorm = (() => {
    const exact: Record<string, number> = {};
    const porNomeCor: Record<string, number> = {};
    const porNome: Record<string, number> = {};
    for (const [k, v] of Object.entries(opsData.map)) {
      const [n, c, t] = k.split("||");
      const nn = norm(n), nc = norm(c), nt = norm(t);
      exact[`${nn}||${nc}||${nt}`] = (exact[`${nn}||${nc}||${nt}`] ?? 0) + v;
      porNomeCor[`${nn}||${nc}`] = (porNomeCor[`${nn}||${nc}`] ?? 0) + v;
      porNome[nn] = (porNome[nn] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(opsData.fallback)) {
      const [n, c] = k.split("||");
      const nn = norm(n), nc = norm(c);
      if (porNomeCor[`${nn}||${nc}`] == null) porNomeCor[`${nn}||${nc}`] = v;
      porNome[nn] = (porNome[nn] ?? 0);
    }
    return { exact, porNomeCor, porNome, nomes: Object.keys(porNome).filter(Boolean) };
  })();

  const emProducaoPara = (nome: string, cor: string, tamanho: string) => {
    const n = norm(nome);
    const c = cor === "—" ? "" : norm(cor);
    const t = tamanho === "—" ? "" : norm(tamanho);
    if (n && c && t && opsNorm.exact[`${n}||${c}||${t}`] != null) return opsNorm.exact[`${n}||${c}||${t}`];
    if (n && c && opsNorm.porNomeCor[`${n}||${c}`] != null) return opsNorm.porNomeCor[`${n}||${c}`];
    if (n && opsNorm.porNome[n]) return opsNorm.porNome[n];
    // fallback contains: nome do pedido contém OP ou vice-versa
    if (!n) return 0;
    let total = 0;
    for (const opNome of opsNorm.nomes) {
      if (opNome === n) continue;
      if (n.includes(opNome) || opNome.includes(n)) {
        if (c && opsNorm.porNomeCor[`${opNome}||${c}`] != null) {
          total += opsNorm.porNomeCor[`${opNome}||${c}`];
        } else {
          total += opsNorm.porNome[opNome] ?? 0;
        }
      }
    }
    return total;
  };

  // Agregação por produto + cor + tamanho
  const agregado = (() => {
    const acc = new Map<string, { nome: string; cor: string; tamanho: string; qtd: number; pedidos: Set<string> }>();
    for (const [oid, itens] of Object.entries(itensPorPedido)) {
      for (const it of itens) {
        const key = `${it.nome}||${it.cor}||${it.tamanho}`;
        const cur = acc.get(key);
        if (cur) {
          cur.qtd += it.qtd;
          cur.pedidos.add(oid);
        } else {
          acc.set(key, { nome: it.nome, cor: it.cor, tamanho: it.tamanho, qtd: it.qtd, pedidos: new Set([oid]) });
        }
      }
    }
    return Array.from(acc.values()).sort((a, b) => b.qtd - a.qtd);
  })();

  const requestEditPrazo = (pid: string, prazoAnterior: string, prazoNovo: string) => {
    if (!prazoNovo || prazoNovo === prazoAnterior) return;
    setJustifText("");
    setJustifDialog({ pid, prazoAnterior, prazoNovo });
  };

  const savePrazo = async (pedidoId: string, novoPrazo: string, prazoAnterior: string, justificativa: string) => {
    setSavingPrazo((s) => ({ ...s, [pedidoId]: true }));
    try {
      const { error } = await supabase
        .from("tray_orders" as any)
        .update({ estimated_delivery_date: novoPrazo })
        .eq("id", pedidoId);
      if (error) throw error;

      // Registra a alteração (best-effort; ignora se tabela não existir)
      const { data: userData } = await supabase.auth.getUser();
      const { error: errLog } = await supabase
        .from("expedicao_alteracoes_prazo" as any)
        .insert({
          pedido_id: pedidoId,
          prazo_anterior: prazoAnterior || null,
          prazo_novo: novoPrazo,
          justificativa,
          alterado_por: userData?.user?.id ?? null,
        } as any);
      if (errLog) {
        console.warn("Falha ao registrar justificativa:", errLog.message);
      }

      toast.success("Prazo atualizado.");
      qc.invalidateQueries({ queryKey: ["tray-abertos-all"] });
      qc.invalidateQueries({ queryKey: ["pedidos-expedicao"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar prazo.");
    } finally {
      setSavingPrazo((s) => ({ ...s, [pedidoId]: false }));
    }
  };

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

  const HOJE = format(new Date(), "yyyy-MM-dd");
  const D2 = format(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
  const abertosOrdenados = [...abertosAll].sort((a, b) => {
    const da = a.estimated_delivery_date ?? "9999-12-31";
    const db_ = b.estimated_delivery_date ?? "9999-12-31";
    return da.localeCompare(db_);
  });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI icon={<Truck className="w-4 h-4" />} label="Total de pedidos" value={String(ap.kpis.total_pedidos)} hint={fmtMesLabel(mes)} />
        <KPI icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} label="No prazo" value={String(ap.kpis.pedidos_no_prazo)} tone="emerald" />
        <KPI icon={<AlertTriangle className="w-4 h-4 text-rose-600" />} label="Atrasados" value={String(ap.kpis.pedidos_atrasados)} tone="rose" />
        <KPI icon={<Clock className="w-4 h-4 text-amber-600" />} label="Pendentes (sem envio)" value={String(ap.kpis.pedidos_pendentes)} tone="amber" />
        <KPI label="% no prazo (s/ pendentes)" value={fmtPct(ap.kpis.percentual_prazo)} tone="primary" />
      </div>

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
          <Button onClick={onFechar} disabled={fechar.isPending}>
            {fechar.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar / Fechar mês
          </Button>
        </div>
      </Card>

      {/* Lista pedidos em aberto (todos, independente do mês) */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-serif text-lg">
            Pedidos em aberto a expedir ({abertosOrdenados.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Todos os pedidos pendentes de envio, independente do mês de referência. Ordenados do mais crítico (prazo mais antigo) para o mais recente. O prazo de postagem pode ser editado diretamente na lista.
          </p>
        </div>
        <div className="max-h-[620px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm [&_th]:bg-background">
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Prazo de envio</TableHead>
                <TableHead>Produtos</TableHead>
                <TableHead>Status interno</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {abertosQ.isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin inline text-primary" />
                  </TableCell>
                </TableRow>
              )}
              {!abertosQ.isLoading && abertosOrdenados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Nenhum pedido em aberto.
                  </TableCell>
                </TableRow>
              )}
              {abertosOrdenados.map((p) => {
                const pid = String(p.id);
                const prazo = p.estimated_delivery_date ?? "";
                const atrasado = prazo && prazo < HOJE;
                const hoje = prazo === HOJE;
                const venceEm2 = prazo && prazo > HOJE && prazo <= D2;
                const editValue = prazoEdit[pid] ?? (prazo ? prazo.slice(0, 10) : "");
                const rowTone = atrasado
                  ? "bg-rose-50/70 hover:bg-rose-100/70"
                  : hoje
                  ? "bg-amber-50/70 hover:bg-amber-100/70"
                  : venceEm2
                  ? "bg-orange-50/60 hover:bg-orange-100/60"
                  : "";
                return (
                  <TableRow key={pid} className={rowTone}>
                    <TableCell className="font-mono text-xs">{pid}</TableCell>
                    <TableCell>{fmtData(p.date)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          type="date"
                          value={editValue}
                          disabled={!!savingPrazo[pid]}
                          onChange={(e) => setPrazoEdit((s) => ({ ...s, [pid]: e.target.value }))}
                          onBlur={(e) => {
                            const v = e.target.value;
                            const anterior = prazo ? prazo.slice(0, 10) : "";
                            if (v && v !== anterior) requestEditPrazo(pid, anterior, v);
                          }}
                          className={`h-8 w-[140px] text-xs ${atrasado ? "text-rose-700 font-medium" : ""}`}
                        />
                        {savingPrazo[pid] && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <div className="flex flex-wrap gap-1">
                        {(produtosPorPedido[pid] ?? []).slice(0, 6).map((nome, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] font-normal max-w-[200px] truncate" title={nome}>
                            {nome}
                          </Badge>
                        ))}
                        {(produtosPorPedido[pid]?.length ?? 0) > 6 && (
                          <Badge variant="outline" className="text-[10px]">+{(produtosPorPedido[pid]!.length - 6)}</Badge>
                        )}
                        {!produtosPorPedido[pid] && (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.orderstatus_status ?? "—"}
                    </TableCell>
                    <TableCell>
                      {atrasado ? (
                        <Badge className="bg-rose-100 text-rose-800 border border-rose-200">Atrasado</Badge>
                      ) : hoje ? (
                        <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Vence hoje</Badge>
                      ) : venceEm2 ? (
                        <Badge className="bg-orange-100 text-orange-800 border border-orange-200">Vence em 2 dias</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">No prazo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setOpDialogPedido(p)}>
                        <Factory className="w-3.5 h-3.5 mr-1" />
                        Gerar OP
                      </Button>
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
              Soma de peças por produto, cor e tamanho considerando todos os pedidos pendentes de envio acima.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {agregado.reduce((s, r) => s + r.qtd, 0)} peças · {agregado.length} variações
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
                <TableHead className="text-right">Pedidos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agregado.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Nenhum produto para somar.
                  </TableCell>
                </TableRow>
              )}
              {agregado.map((r, i) => {
                const emProd = emProducaoPara(r.nome, r.cor, r.tamanho);
                const saldo = emProd - r.qtd;
                const critico = saldo < 0;
                const ok = saldo >= 0 && emProd > 0;
                const semProd = emProd === 0;
                const rowTone = critico
                  ? "bg-rose-50/70 hover:bg-rose-100/70"
                  : semProd
                  ? "bg-amber-50/60 hover:bg-amber-100/60"
                  : ok
                  ? "bg-emerald-50/50 hover:bg-emerald-100/50"
                  : "";
                return (
                  <TableRow key={i} className={rowTone}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>{r.cor}</TableCell>
                    <TableCell>{r.tamanho}</TableCell>
                    <TableCell className="text-right font-semibold">{r.qtd}</TableCell>
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
                    <TableCell className="text-right text-muted-foreground">{r.pedidos.size}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <GerarOPDialog
        pedido={opDialogPedido}
        produtosSugeridos={opDialogPedido ? (produtosPorPedido[String(opDialogPedido.id)] ?? []) : []}
        onClose={() => setOpDialogPedido(null)}
      />

      {/* Dialog justificativa alteração de prazo */}
      <Dialog
        open={!!justifDialog}
        onOpenChange={(o) => {
          if (!o) {
            // cancelar: reverter input para o valor original
            if (justifDialog) {
              setPrazoEdit((s) => ({ ...s, [justifDialog.pid]: justifDialog.prazoAnterior }));
            }
            setJustifDialog(null);
            setJustifText("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Justificar alteração do prazo</DialogTitle>
          </DialogHeader>
          {justifDialog && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Pedido <span className="font-mono">{justifDialog.pid}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">De </span>
                <span className="font-medium">{fmtData(justifDialog.prazoAnterior || null)}</span>
                <span className="text-muted-foreground"> para </span>
                <span className="font-medium">{fmtData(justifDialog.prazoNovo)}</span>
              </div>
              <div>
                <Label>Motivo da alteração <span className="text-rose-600">*</span></Label>
                <textarea
                  value={justifText}
                  onChange={(e) => setJustifText(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Descreva o motivo da alteração do prazo..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (justifDialog) {
                  setPrazoEdit((s) => ({ ...s, [justifDialog.pid]: justifDialog.prazoAnterior }));
                }
                setJustifDialog(null);
                setJustifText("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!justifDialog) return;
                if (justifText.trim().length < 5) {
                  toast.error("Informe uma justificativa (mín. 5 caracteres).");
                  return;
                }
                const { pid, prazoAnterior, prazoNovo } = justifDialog;
                setJustifDialog(null);
                await savePrazo(pid, prazoNovo, prazoAnterior, justifText.trim());
                setJustifText("");
              }}
            >
              Confirmar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GerarOPDialog({
  pedido,
  produtosSugeridos,
  onClose,
}: {
  pedido: TrayOpen | null;
  produtosSugeridos: string[];
  onClose: () => void;
}) {
  const { data: produtos = [] } = useProdutos();
  const { data: oficinas = [] } = useOficinas();
  const createOP = useCreateOrdemProducao();

  const [nomeProduto, setNomeProduto] = useState("");
  const [produtoId, setProdutoId] = useState<string>("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [oficinaId, setOficinaId] = useState<string>("");
  const [previsao, setPrevisao] = useState<string>("");

  useEffect(() => {
    if (pedido) {
      const sug = produtosSugeridos[0] ?? "";
      const semQtd = sug.replace(/\s*\(\d+\)\s*$/, "").trim();
      setNomeProduto(semQtd);
      setProdutoId("");
      setQuantidade(1);
      setOficinaId("");
      setPrevisao(pedido.estimated_delivery_date ? pedido.estimated_delivery_date.slice(0, 10) : "");
    }
  }, [pedido]);

  const open = !!pedido;

  const onSubmit = async () => {
    if (!nomeProduto.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    if (!quantidade || quantidade < 1) {
      toast.error("Quantidade inválida.");
      return;
    }
    try {
      await createOP.mutateAsync({
        nome_produto: nomeProduto.trim(),
        quantidade_pecas_ordem: quantidade,
        quantidade,
        produto_id: produtoId || null,
        oficina_id: oficinaId || null,
        status_ordem: "Corte",
        data_previsao_termino: previsao || null,
      } as any);
      toast.success("Ordem de produção criada e enviada ao Kanban.");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar ordem.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar Ordem de Produção</DialogTitle>
        </DialogHeader>
        {pedido && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Pedido <span className="font-mono">{String(pedido.id)}</span> · prazo {fmtData(pedido.estimated_delivery_date)}
            </div>

            {produtosSugeridos.length > 0 && (
              <div className="rounded-md border bg-muted/40 p-2 space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Produtos do pedido</div>
                <div className="flex flex-wrap gap-1">
                  {produtosSugeridos.map((n, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setNomeProduto(n.replace(/\s*\(\d+\)\s*$/, "").trim())}
                      className="text-[11px] px-2 py-0.5 rounded border bg-background hover:bg-accent"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Nome do produto</Label>
              <Input value={nomeProduto} onChange={(e) => setNomeProduto(e.target.value)} />
            </div>

            <div>
              <Label>Produto cadastrado (opcional)</Label>
              <Select value={produtoId} onValueChange={(v) => {
                setProdutoId(v);
                const p = produtos.find((x: any) => x.id === v);
                if (p?.nome_do_produto) setNomeProduto(p.nome_do_produto);
              }}>
                <SelectTrigger><SelectValue placeholder="Vincular a produto..." /></SelectTrigger>
                <SelectContent>
                  {produtos.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome_do_produto}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />
              </div>
              <div>
                <Label>Previsão de término</Label>
                <Input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Oficina (opcional)</Label>
              <Select value={oficinaId} onValueChange={setOficinaId}>
                <SelectTrigger><SelectValue placeholder="Selecionar oficina..." /></SelectTrigger>
                <SelectContent>
                  {oficinas.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.nome_oficina}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={createOP.isPending}>
            {createOP.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Factory className="w-4 h-4 mr-2" />}
            Criar OP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
