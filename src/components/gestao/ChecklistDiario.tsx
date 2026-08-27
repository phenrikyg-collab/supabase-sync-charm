import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowDown, ArrowUp, Copy, Loader2, Minus, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { brl, dec, ddmm, ddmmyyyy, int, num, pct, varPct } from "@/lib/gestaoFormat";
import { cn } from "@/lib/utils";

const CPA_PISO = 131.46;

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        value === 0 ? "text-muted-foreground" : good ? "text-emerald-600" : "text-red-600",
      )}
    >
      <Icon className="h-3 w-3" />
      {dec(Math.abs(value), 1)}%
    </span>
  );
}

function semaforoVar(v: number | null) {
  if (v === null) return "";
  if (v < -30) return "text-red-600";
  if (v < -15) return "text-amber-600";
  return "text-emerald-600";
}

export default function ChecklistDiario() {
  const [gravando, setGravando] = useState(false);
  const [pixAberto, setPixAberto] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["gestao-checklist-diario"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gestao_checklist_diario" as any);
      if (error) throw error;
      return (data ?? {}) as any;
    },
  });

  const { data: metaSerie = [] } = useQuery({
    queryKey: ["gestao-meta-diario-8"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("meta_acompanhamento_diario" as any, { p_dias: 8 });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as any[];
    },
  });

  const { data: snapshots = [], refetch: refetchSnapshots } = useQuery({
    queryKey: ["gestao-checklist-snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gestao_checklist_snapshots_listar" as any, { p_dias: 30 });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as any[];
    },
  });

  const vendas = data?.vendas ?? {};
  const sessoes = data?.sessoes ?? {};
  const pix = data?.pix_pendente ?? {};
  const estoque = data?.estoque_risco ?? {};
  const producao = data?.producao ?? {};
  const metaOntem = data?.meta_ontem ?? {};
  const funil = data?.funil_7d ?? {};
  const midia = data?.midia ?? {};

  const pixLista: any[] = Array.isArray(pix.lista) ? pix.lista : Array.isArray(pix.itens) ? pix.itens : [];
  const estoqueLista: any[] = Array.isArray(estoque.lista) ? estoque.lista : Array.isArray(estoque.itens) ? estoque.itens : [];
  const producaoLista: any[] = useMemo(() => {
    const l = Array.isArray(producao.lista) ? producao.lista : Array.isArray(producao.itens) ? producao.itens : [];
    return [...l].sort((a, b) => num(b.dias_atraso) - num(a.dias_atraso));
  }, [producao]);

  const alertas = useMemo(() => {
    const out: string[] = [];
    if (num(estoque.criticos) > 0) out.push(`${int(estoque.criticos)} SKUs críticos de estoque`);
    if (num(producao.ordens_vencidas) > 0) out.push(`${int(producao.ordens_vencidas)} ordens de produção vencidas`);
    if (num(pix.qtd) > 0) out.push(`${int(pix.qtd)} Pix pendentes somando ${brl(pix.valor_total)}`);
    const vs = varPct(num(vendas.receita_ontem), num(vendas.media_7d ?? vendas.receita_media_7d));
    if (vs !== null && vs < -30) out.push(`receita ontem ${dec(vs, 1)}% vs média 7d`);
    if (num(metaOntem.cpa) > CPA_PISO) out.push(`CPA de ${brl(metaOntem.cpa)} acima do piso`);
    const googleSemaforo = midia.google?.semaforo;
    if (googleSemaforo === "vermelho" || googleSemaforo === "erro_tecnico") {
      out.push("Google Ads parado ou com erro de integração");
    }
    return out;
  }, [estoque, producao, pix, vendas, metaOntem, midia]);

  // diagnóstico CPS × CVR contra a média dos 7 dias anteriores
  const diagnostico = useMemo(() => {
    const linhas = [...metaSerie].sort((a, b) => String(b.data).localeCompare(String(a.data)));
    if (linhas.length < 3) return null;
    const [hojeRef, ...anteriores] = linhas;
    const base = anteriores.slice(0, 7);
    if (!base.length) return null;
    const avg = (k: string) => base.reduce((s, r) => s + num(r[k]), 0) / base.length;
    const cvrOf = (r: any) => (num(r.sessoes_anuncio) > 0 ? (num(r.compras) / num(r.sessoes_anuncio)) * 100 : 0);
    const cpsAtual = num(hojeRef.cps);
    const cpsBase = avg("cps");
    const cvrAtual = cvrOf(hojeRef);
    const cvrBase = base.reduce((s, r) => s + cvrOf(r), 0) / base.length;
    const cpsSubiu = cpsBase > 0 && cpsAtual > cpsBase * 1.1;
    const cvrCaiu = cvrBase > 0 && cvrAtual < cvrBase * 0.9;
    let texto = "Mídia estável frente à média dos 7 dias anteriores.";
    let tone = "neutro";
    if (cpsSubiu && cvrCaiu) { texto = "Fadiga generalizada: pausar e reconstruir"; tone = "ruim"; }
    else if (cpsSubiu) { texto = "Mídia encareceu: olhar criativo/público"; tone = "alerta"; }
    else if (cvrCaiu) { texto = "Problema depois do clique: página, oferta, estoque"; tone = "alerta"; }
    return { texto, tone, cpsAtual, cpsBase, cvrAtual, cvrBase };
  }, [metaSerie]);

  const cvrMidia = num(metaOntem.sessoes_anuncio) > 0
    ? (num(metaOntem.compras) / num(metaOntem.sessoes_anuncio)) * 100
    : 0;

  const cpaCor = (v: number) => (v <= 0 ? "" : v < 90 ? "text-emerald-600" : v <= CPA_PISO ? "text-amber-600" : "text-red-600");

  const gravarSnapshot = async () => {
    setGravando(true);
    try {
      const { error } = await supabase.rpc("gestao_checklist_snapshot_gravar" as any);
      if (error) throw error;
      toast.success("Snapshot do dia gravado");
      refetchSnapshots();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gravar o snapshot");
    } finally {
      setGravando(false);
    }
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`Pedido ${texto} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando checklist…
      </div>
    );
  }
  if (error) {
    return (
      <Card><CardContent className="py-8 text-sm text-red-600">
        Erro ao carregar o checklist: {(error as any)?.message}
      </CardContent></Card>
    );
  }

  const serie7d: any[] = Array.isArray(sessoes.serie_7d) ? sessoes.serie_7d : [];
  const sparkData = serie7d.map((p: any, i: number) => ({
    x: i,
    v: typeof p === "number" ? p : num(p.sessoes ?? p.valor ?? p.total),
    label: typeof p === "number" ? "" : ddmm(p.data),
  }));

  const varSessoes = sessoes.variacao_pct !== undefined && sessoes.variacao_pct !== null
    ? num(sessoes.variacao_pct)
    : varPct(num(sessoes.ontem), num(sessoes.anteontem));
  const varReceita = varPct(num(vendas.receita_ontem), num(vendas.receita_anteontem));
  const varReceita7 = varPct(num(vendas.receita_ontem), num(vendas.media_7d ?? vendas.receita_media_7d));
  const varPedidos = varPct(num(vendas.pedidos_ontem), num(vendas.pedidos_anteontem));
  const varTicket = varPct(num(vendas.ticket_ontem), num(vendas.ticket_media_7d ?? vendas.ticket_7d));

  return (
    <div className="space-y-5">
      {/* Resumo + snapshot */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex items-start gap-2">
          <AlertTriangle className={cn("h-5 w-5 mt-0.5", alertas.length ? "text-red-600" : "text-emerald-600")} />
          <p className="text-sm font-medium">
            {alertas.length
              ? `${alertas.length} alerta${alertas.length > 1 ? "s" : ""}: ${alertas.join(", ")}.`
              : "Nenhum alerta vermelho hoje."}
            {data?.gerado_em && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                gerado em {new Date(data.gerado_em).toLocaleString("pt-BR")}
              </span>
            )}
          </p>
        </div>
        <Button onClick={gravarSnapshot} disabled={gravando} className="shrink-0">
          {gravando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Gravar snapshot do dia
        </Button>
      </div>

      {/* PIX PENDENTE */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            Pix pendente
            <span className="text-sm font-normal text-muted-foreground">
              {int(pix.qtd)} pedidos · {brl(pix.valor_total)}
            </span>
            {num(pix.acima_2h_qtd) > 0 && (
              <Badge variant="destructive">{int(pix.acima_2h_qtd)} acima de 2h</Badge>
            )}
          </CardTitle>
          {pixLista.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setPixAberto((v) => !v)}>
              {pixAberto ? "Ocultar" : "Ver lista"}
            </Button>
          )}
        </CardHeader>
        {pixAberto && pixLista.length > 0 && (
          <CardContent>
            <Table containerClassName="max-h-[70vh]">
              <TableHeader className="sticky top-0 z-20 bg-card">
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Dias em aberto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pixLista.map((p: any, i: number) => (
                  <TableRow key={`${p.tray_order_id}-${i}`}>
                    <TableCell className="font-mono text-xs">{p.tray_order_id ?? "—"}</TableCell>
                    <TableCell className="text-right">{brl(p.total_amount)}</TableCell>
                    <TableCell className="text-right">{dec(p.dias_aberto, 1)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" title="Copiar nº do pedido"
                        onClick={() => copiar(String(p.tray_order_id ?? ""))}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {/* ESTOQUE EM RISCO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Estoque em risco
            <span className="text-sm font-normal text-muted-foreground">
              {int(estoque.qtd_skus)} SKUs
            </span>
            {num(estoque.criticos) > 0 && <Badge variant="destructive">{int(estoque.criticos)} críticos</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {estoqueLista.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum SKU em risco.</p>
          ) : (
            <Table containerClassName="max-h-[70vh]">
              <TableHeader className="sticky top-0 z-20 bg-card">
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Venda/dia</TableHead>
                  <TableHead className="text-right">Cobertura (dias)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estoqueLista.map((r: any, i: number) => {
                  const cob = num(r.cobertura_dias);
                  return (
                    <TableRow key={i} className={cn(cob < 15 ? "bg-red-500/10" : cob <= 30 ? "bg-amber-500/10" : "")}>
                      <TableCell>{r.produto ?? r.nome_produto ?? "—"}</TableCell>
                      <TableCell className="text-right">{int(r.estoque)}</TableCell>
                      <TableCell className="text-right">{dec(r.venda_dia, 2)}</TableCell>
                      <TableCell className={cn("text-right font-medium", cob < 15 ? "text-red-600" : cob <= 30 ? "text-amber-600" : "")}>
                        {dec(cob, 1)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* PRODUÇÃO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Produção
            <span className="text-sm font-normal text-muted-foreground">
              {int(producao.pecas_em_aberto)} peças · {int(producao.ordens_em_aberto)} ordens
            </span>
            {num(producao.ordens_vencidas) > 0 && (
              <Badge variant="destructive">{int(producao.ordens_vencidas)} vencidas</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {producaoLista.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ordem em aberto.</p>
          ) : (
            <Table containerClassName="max-h-[70vh]">
              <TableHeader className="sticky top-0 z-20 bg-card">
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Peças</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Previsão</TableHead>
                  <TableHead className="text-right">Atraso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {producaoLista.map((r: any, i: number) => {
                  const atraso = num(r.dias_atraso);
                  return (
                    <TableRow key={i}>
                      <TableCell>{r.nome_produto ?? "—"}</TableCell>
                      <TableCell className="text-right">{int(r.pecas)}</TableCell>
                      <TableCell className="text-xs">{r.status_ordem ?? "—"}</TableCell>
                      <TableCell>{ddmmyyyy(r.data_previsao_termino)}</TableCell>
                      <TableCell className={cn("text-right font-medium", atraso > 0 && "text-red-600")}>
                        {atraso > 0 ? `${int(atraso)} d` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* PULSO DE VENDAS */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Pulso de vendas</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Receita ontem</p>
            <p className="text-xl font-semibold">{brl(vendas.receita_ontem)}</p>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-muted-foreground">vs anteontem <Delta value={varReceita} /></span>
              <span className={cn("text-xs text-muted-foreground", semaforoVar(varReceita7))}>
                vs média 7d <Delta value={varReceita7} />
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pedidos ontem</p>
            <p className="text-xl font-semibold">{int(vendas.pedidos_ontem)}</p>
            <span className="text-xs text-muted-foreground">vs anteontem <Delta value={varPedidos} /></span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ticket ontem</p>
            <p className="text-xl font-semibold">{brl(vendas.ticket_ontem)}</p>
            <span className="text-xs text-muted-foreground">vs média 7d <Delta value={varTicket} /></span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sessões ontem</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-semibold">{int(sessoes.ontem)}</p>
              <span className={cn("text-sm font-semibold", semaforoVar(varSessoes))}>
                <Delta value={varSessoes} />
              </span>
            </div>
            <p className="text-xs text-muted-foreground">anteontem {int(sessoes.anteontem)}</p>
            {sparkData.length > 1 && (
              <div className="h-10 mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData}>
                    <Tooltip
                      formatter={(v: any) => [int(v), "sessões"]}
                      labelFormatter={(_, p: any) => p?.[0]?.payload?.label ?? ""}
                    />
                    <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="md:col-span-4 border-t pt-3 text-sm text-muted-foreground">
            Mês até agora:{" "}
            <span className="font-medium text-foreground">{brl(vendas.mes_ate_agora?.receita ?? vendas.mes_ate_agora_receita)}</span>{" "}
            em{" "}
            <span className="font-medium text-foreground">{int(vendas.mes_ate_agora?.pedidos ?? vendas.mes_ate_agora_pedidos)}</span>{" "}
            pedidos
          </div>
        </CardContent>
      </Card>

      {/* META ONTEM */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Meta ontem</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            {[
              { l: "Investido", v: brl(metaOntem.valor_usado) },
              { l: "Compras", v: int(metaOntem.compras) },
              { l: "CPA", v: brl(metaOntem.cpa), c: cpaCor(num(metaOntem.cpa)) },
              { l: "ROAS", v: dec(metaOntem.roas, 2) },
              { l: "Lucro", v: brl(metaOntem.lucro), c: num(metaOntem.lucro) >= 0 ? "text-emerald-600" : "text-red-600" },
              { l: "CPS", v: brl(metaOntem.cps) },
              {
                l: "Connect rate",
                v: pct(metaOntem.connect_rate),
                c: num(metaOntem.connect_rate) < 30 ? "text-red-600" : "",
              },
            ].map((k) => (
              <div key={k.l}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.l}</p>
                <p className={cn("text-lg font-semibold", k.c)}>{k.v}</p>
              </div>
            ))}
          </div>
          <div className="text-sm">
            CVR mídia: <span className="font-semibold">{pct(cvrMidia, 2)}</span>
            <span className="text-xs text-muted-foreground ml-2">(compras ÷ sessões de anúncio)</span>
          </div>
          {diagnostico && (
            <div
              className={cn(
                "rounded-md border p-3 text-sm",
                diagnostico.tone === "ruim"
                  ? "border-red-500/40 bg-red-500/10 text-red-700"
                  : diagnostico.tone === "alerta"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                    : "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              <p className="font-medium">{diagnostico.texto}</p>
              <p className="text-xs mt-1">
                CPS {brl(diagnostico.cpsAtual)} vs {brl(diagnostico.cpsBase)} (média 7d) · CVR{" "}
                {pct(diagnostico.cvrAtual, 2)} vs {pct(diagnostico.cvrBase, 2)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FUNIL 7D */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Funil 7 dias</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sessões</p>
              <p className="text-lg font-semibold">{int(funil.sessoes)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">CVR</p>
              <p className="text-lg font-semibold">{pct(funil.cvr_pct, 2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">View → ATC</p>
              <p className="text-lg font-semibold">{pct(funil.view_to_atc_pct, 2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">ATC → Compra</p>
              <p className="text-lg font-semibold">{pct(funil.atc_to_compra_pct, 2)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Rastreio de carrinho corrigido em 18/08 — comparações com dados anteriores a essa data são inválidas.
          </p>
        </CardContent>
      </Card>

      {/* HISTÓRICO */}
      <Accordion type="single" collapsible>
        <AccordionItem value="hist">
          <AccordionTrigger className="text-sm">Histórico (últimos 30 dias)</AccordionTrigger>
          <AccordionContent>
            {snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum snapshot gravado.</p>
            ) : (
              <Table containerClassName="max-h-[70vh]">
                <TableHeader className="sticky top-0 z-20 bg-card">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Receita ontem</TableHead>
                    <TableHead className="text-right">CPA</TableHead>
                    <TableHead className="text-right">Sessões</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((s: any, i: number) => {
                    const p = s.payload ?? s.dados ?? s;
                    return (
                      <TableRow key={i}>
                        <TableCell>{ddmmyyyy(s.data ?? s.data_ref ?? s.created_at)}</TableCell>
                        <TableCell className="text-right">
                          {brl(s.receita_ontem ?? p?.vendas?.receita_ontem)}
                        </TableCell>
                        <TableCell className="text-right">{brl(s.cpa ?? p?.meta_ontem?.cpa)}</TableCell>
                        <TableCell className="text-right">{int(s.sessoes ?? p?.sessoes?.ontem)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
