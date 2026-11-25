import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SeletorDias } from "@/components/financeiro/SeletorDias";
import { brl, pctBr, num, dataCurta } from "@/lib/financeiroFormat";
import { formatarData, formatarDataHora } from "@/lib/dataBr";
import { chamarRpc } from "@/lib/supabaseRpc";
import { EstornosPagarme } from "@/components/financeiro/EstornosPagarme";
import { ArrowDown, ArrowUp, CheckCircle2, Copy, ExternalLink, MessageCircle, RefreshCw } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
} from "recharts";

type Row = Record<string, any>;
const SEM = "sem dados";

const vazio = (v: unknown) => v == null || v === "";
const fBrl = (v: any) => (vazio(v) ? SEM : brl(Number(v)));
const fPct = (v: any, c = 2) => (vazio(v) ? SEM : pctBr(Number(v), c));
const fNum = (v: any, c = 0) => (vazio(v) ? SEM : num(Number(v), c));
const fTxt = (v: any) => (vazio(v) ? "-" : String(v));
const fData = (v: any) => (vazio(v) ? "-" : formatarData(v));
const fDataHora = (v: any) => (vazio(v) ? "-" : formatarDataHora(v));

async function rpc<T = any>(nome: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await chamarRpc<T>(nome, params);
  if (error) throw error;
  return data as T;
}

function Variacao({ atual, anterior, inverso }: { atual?: any; anterior?: any; inverso?: boolean }) {
  if (vazio(atual) || vazio(anterior) || Number(anterior) === 0) return null;
  const delta = ((Number(atual) - Number(anterior)) / Math.abs(Number(anterior))) * 100;
  if (!isFinite(delta)) return null;
  const subindo = delta >= 0;
  const bom = inverso ? !subindo : subindo;
  const Icon = subindo ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", bom ? "text-success" : "text-danger")}>
      <Icon className="h-3 w-3" />
      {pctBr(Math.abs(delta), 1)}
    </span>
  );
}

function Tile({ label, value, loading, atual, anterior, inverso, valueClass, sub }: {
  label: string; value: string; loading: boolean; atual?: any; anterior?: any; inverso?: boolean; valueClass?: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-24" /> : (
        <>
          <div className="mt-1 flex items-baseline gap-2">
            <p className={cn("text-2xl font-semibold tabular-nums text-card-foreground", value === SEM && "text-base text-muted-foreground", valueClass)}>{value}</p>
            <Variacao atual={atual} anterior={anterior} inverso={inverso} />
          </div>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </>
      )}
    </div>
  );
}

function Secao({ titulo, descricao, extra, children }: { titulo: string; descricao?: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-lg font-semibold text-card-foreground">{titulo}</h2>
          {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

type Col = { k: string; t: string; r?: boolean; f?: (v: any, row: Row) => React.ReactNode; cls?: (row: Row) => string };

function Tabela({ cols, rows, loading, vazioTxt = "Sem dados no período." }: { cols: Col[]; rows: Row[]; loading?: boolean; vazioTxt?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            {cols.map((c) => <th key={c.k} className={cn("py-2 pr-3", c.r && "text-right")}>{c.t}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {cols.map((c) => (
                <td key={c.k} className={cn("py-2 pr-3", c.r && "text-right tabular-nums", c.cls?.(row))}>
                  {c.f ? c.f(row[c.k], row) : fTxt(row[c.k])}
                </td>
              ))}
            </tr>
          ))}
          {loading && <tr><td colSpan={cols.length} className="py-4"><Skeleton className="h-6 w-full" /></td></tr>}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={cols.length} className="py-6 text-center text-muted-foreground">{vazioTxt}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Erro({ e }: { e: unknown }) {
  if (!e) return null;
  return <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">Erro ao carregar: {(e as any)?.message ?? String(e)}</p>;
}

const STATUS_LINK: Record<string, { rotulo: string; cls: string }> = {
  pendente: { rotulo: "Pendente", cls: "bg-warning/15 text-warning border-warning/30" },
  pago: { rotulo: "Pago", cls: "bg-success/15 text-success border-success/30" },
  cancelado: { rotulo: "Cancelado", cls: "bg-muted text-muted-foreground" },
  expirado: { rotulo: "Expirado", cls: "bg-muted text-muted-foreground" },
  erro: { rotulo: "Erro", cls: "bg-danger/15 text-danger border-danger/30" },
};

const ROTULO_GATEWAY: Record<string, string> = { vindi: "Vindi", pagarme: "Pagar.me" };
const ROTULO_ORIGEM: Record<string, string> = { site: "Site", whatsapp_link: "Link WhatsApp" };

function copiar(t: string) {
  navigator.clipboard?.writeText(t).then(() => toast.success("Link copiado"), () => toast.error("Não foi possível copiar"));
}

export default function Pagarme() {
  const [dias, setDias] = useState(30);
  const qc = useQueryClient();

  const kpis = useQuery({ queryKey: ["pagarme", "kpis", dias], queryFn: () => rpc<Row>("pagarme_kpis", { p_dias: dias }) });
  const conc = useQuery({ queryKey: ["pagarme", "conciliacao", dias], queryFn: () => rpc<Row>("pagarme_conciliacao", { p_dias: dias }) });
  const links = useQuery({ queryKey: ["pagarme", "links"], queryFn: () => rpc<Row[]>("pagarme_links_recentes", { p_limite: 50 }) });
  const vigia = useQuery({ queryKey: ["pagarme", "vigia"], queryFn: () => rpc<Row>("pagarme_vigia") });
  const config = useQuery({ queryKey: ["pagarme", "config"], queryFn: () => rpc<Row>("pagamentos_gateway_config") });

  const k = kpis.data ?? {};
  const atual = k.resumo?.atual ?? {};
  const ant = k.resumo?.anterior ?? {};
  const taxas = k.taxas ?? {};
  const rec = k.recebiveis ?? {};
  const cb = k.chargebacks ?? {};
  const lw = k.links_whatsapp ?? {};
  const L = kpis.isLoading;
  const serie = (k.serie ?? []).map((d: Row) => ({ dia: dataCurta(d.dia), volume: Number(d.volume ?? 0), recusas: Number(d.recusas ?? 0) }));
  const alertas: Row[] = vigia.data?.alertas ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Pagar.me</h1>
          <p className="text-sm text-muted-foreground">Vendas, taxas, recebíveis e links de cartão do WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <SeletorDias valor={dias} onChange={setDias} />
          <Button size="sm" variant="outline" className="h-9" onClick={() => qc.invalidateQueries({ queryKey: ["pagarme"] })}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="geral">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="taxas">Taxas</TabsTrigger>
          <TabsTrigger value="recebiveis">Recebíveis</TabsTrigger>
          <TabsTrigger value="recusas">Recusas</TabsTrigger>
          <TabsTrigger value="links">Links WhatsApp</TabsTrigger>
          <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
          <TabsTrigger value="estornos">Estornos</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6">
          <Erro e={kpis.error} />
          {vigia.isLoading ? <Skeleton className="h-10 w-full" /> : vigia.error ? <Erro e={vigia.error} /> : alertas.length === 0 ? (
            <Badge className="gap-1 border-success/30 bg-success/15 text-success" variant="outline"><CheckCircle2 className="h-3.5 w-3.5" /> Tudo certo</Badge>
          ) : (
            <div className="space-y-2">
              {alertas.map((a, i) => (
                <div key={i} className={cn("rounded-md border px-3 py-2 text-sm",
                  a.nivel === "alto" ? "border-danger/40 bg-danger/10 text-danger" : "border-warning/40 bg-warning/10 text-warning")}>
                  <span className="font-medium">{fTxt(a.tipo)}</span>
                  {a.msg ? `: ${a.msg}` : ""}
                  {!vazio(a.qtd) ? ` (${num(Number(a.qtd))})` : ""}
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Tile label="Volume pago" value={fBrl(atual.volume_pago)} loading={L} atual={atual.volume_pago} anterior={ant.volume_pago} />
            <Tile label="Pedidos pagos" value={fNum(atual.pedidos_pagos)} loading={L} atual={atual.pedidos_pagos} anterior={ant.pedidos_pagos} />
            <Tile label="Ticket médio" value={fBrl(atual.ticket_medio)} loading={L} atual={atual.ticket_medio} anterior={ant.ticket_medio} />
            <Tile label="Aprovação do cartão" value={fPct(atual.aprovacao_pct, 1)} loading={L} atual={atual.aprovacao_pct} anterior={ant.aprovacao_pct}
              sub={vazio(atual.tentativas_cartao) ? undefined : `${num(Number(atual.tentativas_aprovadas ?? 0))} de ${num(Number(atual.tentativas_cartao))} tentativas`} />
            <Tile label="Taxa real vs contrato" value={fPct(taxas.taxa_real_pct)} loading={L}
              valueClass={!vazio(taxas.taxa_real_pct) && !vazio(taxas.taxa_contrato_pct) && Number(taxas.taxa_real_pct) > Number(taxas.taxa_contrato_pct) ? "text-danger" : undefined}
              sub={`Contrato: ${fPct(taxas.taxa_contrato_pct)}`} />
            <Tile label="A receber" value={fBrl(rec.a_receber)} loading={L} />
            <Tile label="Chargebacks" value={fNum(cb.qtd)} loading={L} valueClass={Number(cb.qtd ?? 0) > 0 ? "text-danger" : undefined}
              sub={vazio(cb.valor) ? undefined : `${brl(Number(cb.valor))} (${fPct(cb.pct_volume)} do volume)`} />
          </div>

          <Secao titulo="Série diária" descricao="Volume pago e recusas por dia">
            {serie.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{L ? "Carregando..." : "Sem dados no período."}</p> : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dia" fontSize={11} />
                    <YAxis yAxisId="l" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <YAxis yAxisId="r" orientation="right" fontSize={11} allowDecimals={false} />
                    <RTooltip formatter={(v: any, n: any) => (n === "Volume" ? brl(Number(v)) : num(Number(v)))} />
                    <Legend />
                    <Line yAxisId="l" dataKey="volume" name="Volume" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line yAxisId="r" dataKey="recusas" name="Recusas" stroke="hsl(var(--danger))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Secao>

          <div className="grid gap-6 lg:grid-cols-2">
            <Secao titulo="Por origem">
              <Tabela loading={L} rows={k.por_origem ?? []} cols={[
                { k: "origem", t: "Origem", f: (v) => ROTULO_ORIGEM[v] ?? (vazio(v) ? "Não identificado" : String(v).replace(/_/g, " ")) },
                { k: "qtd", t: "Pedidos", r: true, f: (v) => fNum(v) },
                { k: "volume", t: "Volume", r: true, f: (v) => fBrl(v) },
              ]} />
            </Secao>
            <Secao titulo="Por bandeira">
              <Tabela loading={L} rows={k.por_bandeira ?? []} cols={[
                { k: "bandeira", t: "Bandeira" },
                { k: "qtd", t: "Pedidos", r: true, f: (v) => fNum(v) },
                { k: "volume", t: "Volume", r: true, f: (v) => fBrl(v) },
              ]} />
            </Secao>
          </div>
        </TabsContent>

        <TabsContent value="taxas" className="space-y-6">
          <Erro e={kpis.error} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Taxa real" value={fBrl(taxas.taxa_real)} loading={L} sub={fPct(taxas.taxa_real_pct)} />
            <Tile label="Taxa de contrato" value={fBrl(taxas.taxa_contrato)} loading={L} sub={fPct(taxas.taxa_contrato_pct)} />
            <Tile label="Comissão Tray estimada" value={fBrl(taxas.comissao_tray_estimada)} loading={L} />
            <Tile label="Prazo médio de recebimento" value={vazio(taxas.prazo_medio_dias) ? SEM : `${num(Number(taxas.prazo_medio_dias), 1)} dias`} loading={L}
              sub={vazio(taxas.cobrancas) ? undefined : `${num(Number(taxas.cobrancas_com_taxa_real ?? 0))} de ${num(Number(taxas.cobrancas))} cobranças com taxa real`} />
          </div>
          <Secao titulo="Taxa por parcela" descricao="Em vermelho quando a taxa real passa da taxa de contrato">
            <Tabela loading={L} rows={[...(k.por_parcela ?? [])].sort((a, b) => Number(a.parcelas ?? 0) - Number(b.parcelas ?? 0))} cols={[
              { k: "parcelas", t: "Parcelas", f: (v) => (vazio(v) ? "-" : `${v}x`) },
              { k: "qtd", t: "Cobranças", r: true, f: (v) => fNum(v) },
              { k: "volume", t: "Volume", r: true, f: (v) => fBrl(v) },
              { k: "taxa_real_pct", t: "Taxa real", r: true, f: (v) => fPct(v),
                cls: (r) => (!vazio(r.taxa_real_pct) && !vazio(r.taxa_contrato_pct) && Number(r.taxa_real_pct) > Number(r.taxa_contrato_pct) ? "font-medium text-danger" : "") },
              { k: "taxa_contrato_pct", t: "Contrato", r: true, f: (v) => fPct(v) },
            ]} />
          </Secao>
        </TabsContent>

        <TabsContent value="recebiveis" className="space-y-6">
          <Erro e={kpis.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Tile label="Total a receber" value={fBrl(rec.a_receber)} loading={L} />
            <Tile label="Transferido no período" value={fBrl(rec.transferido_periodo)} loading={L} />
          </div>
          <Secao titulo="Próximos recebimentos">
            {(rec.proximos_dias ?? []).length > 0 && (
              <div className="mb-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(rec.proximos_dias ?? []).map((d: Row) => ({ data: dataCurta(d.data), liquido: Number(d.liquido ?? 0) }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="data" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <RTooltip formatter={(v: any) => brl(Number(v))} />
                    <Bar dataKey="liquido" name="Líquido" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <Tabela loading={L} rows={rec.proximos_dias ?? []} vazioTxt="Nada a receber." cols={[
              { k: "data", t: "Data", f: fData },
              { k: "liquido", t: "Líquido", r: true, f: (v) => fBrl(v) },
            ]} />
          </Secao>
        </TabsContent>

        <TabsContent value="recusas" className="space-y-6">
          <Erro e={kpis.error} />
          <Secao titulo="Motivos de recusa">
            <Tabela loading={L} rows={[...(k.recusas ?? [])].sort((a, b) => Number(b.qtd ?? 0) - Number(a.qtd ?? 0))} vazioTxt="Nenhuma recusa no período." cols={[
              { k: "codigo", t: "Código" },
              { k: "mensagem", t: "Mensagem" },
              { k: "qtd", t: "Qtd", r: true, f: (v) => fNum(v) },
            ]} />
          </Secao>
        </TabsContent>

        <TabsContent value="links" className="space-y-6">
          <Erro e={kpis.error} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Tile label="Criados" value={fNum(lw.criados)} loading={L} />
            <Tile label="Pagos" value={fNum(lw.pagos)} loading={L} />
            <Tile label="Conversão" value={fPct(lw.conversao_pct, 1)} loading={L} />
            <Tile label="Valor pago" value={fBrl(lw.valor_pago)} loading={L} />
            <Tile label="Tempo até pagar" value={vazio(lw.horas_ate_pagar) ? SEM : `${num(Number(lw.horas_ate_pagar), 1)} h`} loading={L} />
            <Tile label="Pendentes" value={fNum(lw.pendentes)} loading={L} />
            <Tile label="Erros" value={fNum(lw.erros)} loading={L} valueClass={Number(lw.erros ?? 0) > 0 ? "text-danger" : undefined} />
          </div>
          <Secao titulo="Links recentes" descricao="Últimos 50 links de cartão">
            <Erro e={links.error} />
            <Tabela loading={links.isLoading} rows={Array.isArray(links.data) ? links.data : []} vazioTxt="Nenhum link criado ainda." cols={[
              { k: "criado_em", t: "Criado em", f: fDataHora },
              { k: "descricao", t: "Descrição" },
              { k: "valor", t: "Valor", r: true, f: (v) => fBrl(v) },
              { k: "status", t: "Status", f: (v) => {
                const s = STATUS_LINK[String(v ?? "").toLowerCase()];
                return <Badge variant="outline" className={s?.cls}>{s?.rotulo ?? fTxt(v)}</Badge>;
              } },
              { k: "pago_em", t: "Pago em", f: fDataHora },
              { k: "criado_por", t: "Criado por" },
              { k: "pedido_pagarme", t: "Pedido" },
              { k: "link", t: "Link", f: (v) => vazio(v) ? "-" : (
                <div className="flex items-center gap-1">
                  <a href={v} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                    Abrir <ExternalLink className="h-3 w-3" />
                  </a>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copiar(String(v))} aria-label="Copiar link"><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              ) },
              { k: "conversa_id", t: "Conversa", f: (v) => vazio(v) ? "-" : (
                <Link to={`/atendimento?conversa=${encodeURIComponent(String(v))}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <MessageCircle className="h-3.5 w-3.5" /> Abrir
                </Link>
              ) },
            ]} />
          </Secao>
        </TabsContent>

        <TabsContent value="conciliacao" className="space-y-6">
          <Erro e={conc.error} />
          <ListaConc titulo="Pagos sem pedido na Tray" rows={conc.data?.pagos_sem_pedido_tray} loading={conc.isLoading} cols={[
            { k: "order", t: "Pedido Pagar.me" }, { k: "code", t: "Código" }, { k: "valor", t: "Valor", r: true, f: fBrl },
            { k: "criado_em", t: "Criado em", f: fDataHora }, { k: "email", t: "E-mail" },
          ]} />
          <ListaConc titulo="Pagos sem recebíveis" rows={conc.data?.pagos_sem_recebiveis} loading={conc.isLoading} cols={[
            { k: "cobranca", t: "Cobrança" }, { k: "pedido", t: "Pedido" }, { k: "valor", t: "Valor", r: true, f: fBrl }, { k: "pago_em", t: "Pago em", f: fDataHora },
          ]} />
          <ListaConc titulo="Taxa fora do contrato" rows={conc.data?.taxa_fora_do_contrato} loading={conc.isLoading} cols={[
            { k: "cobranca", t: "Cobrança" }, { k: "pedido", t: "Pedido" }, { k: "tray_order_id", t: "Pedido Tray" }, { k: "bandeira", t: "Bandeira" },
            { k: "parcelas", t: "Parcelas", r: true, f: (v) => (vazio(v) ? "-" : `${v}x`) }, { k: "valor", t: "Valor", r: true, f: fBrl },
            { k: "taxa_real", t: "Taxa real", r: true, f: fBrl }, { k: "taxa_contrato", t: "Contrato", r: true, f: fBrl },
            { k: "diferenca", t: "Diferença", r: true, f: fBrl, cls: () => "text-danger font-medium" },
          ]} />
          <ListaConc titulo="Links pagos sem pedido na Tray" rows={conc.data?.links_pagos_sem_pedido_tray} loading={conc.isLoading} cols={[
            { k: "link_id", t: "Link" },
            { k: "conversa_id", t: "Conversa", f: (v) => vazio(v) ? "-" : <Link to={`/atendimento?conversa=${encodeURIComponent(String(v))}`} className="text-primary hover:underline">Abrir conversa</Link> },
            { k: "valor", t: "Valor", r: true, f: fBrl }, { k: "pago_em", t: "Pago em", f: fDataHora },
          ]} />
          <ListaConc titulo="Webhooks com erro" rows={conc.data?.webhooks_com_erro} loading={conc.isLoading} cols={[
            { k: "evento", t: "Evento" }, { k: "recurso", t: "Recurso" }, { k: "erro", t: "Erro", cls: () => "text-danger" }, { k: "em", t: "Em", f: fDataHora },
          ]} />
          <ListaConc titulo="Liquidações" rows={conc.data?.liquidacoes} loading={conc.isLoading} cols={[
            { k: "id", t: "ID" }, { k: "data", t: "Data", f: fData }, { k: "valor", t: "Valor", r: true, f: fBrl }, { k: "status", t: "Status" },
            { k: "conferido_safra", t: "Conferido no Safra", f: (v) => v === true ? <Badge variant="outline" className="border-success/30 bg-success/15 text-success">Sim</Badge> : v === false ? <Badge variant="outline" className="border-warning/30 bg-warning/15 text-warning">Não</Badge> : "-" },
          ]} />
        </TabsContent>

        <TabsContent value="estornos" className="space-y-6">
          <EstornosPagarme />
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <Configuracao config={config.data} loading={config.isLoading} erro={config.error} sync={k.sync} gatewayKpi={k.gateway_link_cartao} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListaConc({ titulo, rows, loading, cols }: { titulo: string; rows?: Row[] | null; loading: boolean; cols: Col[] }) {
  const lista = Array.isArray(rows) ? rows : [];
  return (
    <Secao titulo={titulo} extra={!loading && (
      <Badge variant="outline" className={lista.length ? "border-warning/30 bg-warning/15 text-warning" : "border-success/30 bg-success/15 text-success"}>{lista.length}</Badge>
    )}>
      <Tabela loading={loading} rows={lista} cols={cols} vazioTxt="nada pendente" />
    </Secao>
  );
}

function CampoConfig({ label, valorInicial, min, max, step, sufixo, onSalvar }: {
  label: string; valorInicial: string; min?: number; max?: number; step?: string; sufixo?: string; onSalvar: (v: number) => Promise<void>;
}) {
  const [v, setV] = useState(valorInicial);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => setV(valorInicial), [valorInicial]);
  const n = Number(String(v).replace(",", "."));
  const valido = v !== "" && isFinite(n) && (min == null || n >= min) && (max == null || n <= max);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" inputMode="decimal" value={v} min={min} max={max} step={step} onChange={(e) => setV(e.target.value)} className="max-w-[160px]" />
        {sufixo && <span className="text-sm text-muted-foreground">{sufixo}</span>}
        <Button size="sm" disabled={!valido || salvando || v === valorInicial} onClick={async () => {
          setSalvando(true);
          try { await onSalvar(n); } finally { setSalvando(false); }
        }}>{salvando ? "Salvando..." : "Salvar"}</Button>
      </div>
      {!valido && v !== "" && <p className="text-[11px] text-danger">Valor inválido{min != null && max != null ? ` (de ${min} a ${max})` : ""}</p>}
    </div>
  );
}

function Configuracao({ config, loading, erro, sync, gatewayKpi }: { config?: Row | null; loading: boolean; erro: unknown; sync?: Row | null; gatewayKpi?: string | null }) {
  const qc = useQueryClient();
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);
  const c = config ?? {};
  const gateway = String(c.link_cartao_gateway ?? gatewayKpi ?? "");

  async function definir(chave: string, valor: unknown) {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await chamarRpc("pagamentos_gateway_config_definir", { p_chave: chave, p_valor: valor, p_por: u.user?.email ?? null });
    if (error) { toast.error(error.message || "Erro ao salvar"); throw error; }
    if (data) qc.setQueryData(["pagarme", "config"], data);
    qc.invalidateQueries({ queryKey: ["pagarme"] });
    toast.success("Configuração salva");
  }
  const tentar = (chave: string, valor: unknown) => definir(chave, valor).catch(() => undefined);

  if (loading) return <Skeleton className="h-64 w-full" />;
  const minCent = c.link_parcela_minima_centavos;
  const valMin = c.link_validade_minutos;

  return (
    <>
      <Erro e={erro} />
      <Secao titulo="Gateway do link de cartão no WhatsApp" descricao={`Atual: ${ROTULO_GATEWAY[gateway] ?? (gateway || SEM)}`}>
        <div className="flex gap-2">
          {(["vindi", "pagarme"] as const).map((g) => (
            <Button key={g} variant={gateway === g ? "default" : "outline"} disabled={trocando} onClick={() => gateway !== g && setConfirmar(g)}>
              {ROTULO_GATEWAY[g]}
            </Button>
          ))}
        </div>
      </Secao>

      <Secao titulo="Regras do link de cartão">
        <div className="grid gap-5 sm:grid-cols-2">
          <CampoConfig label="Máximo de parcelas" valorInicial={vazio(c.link_max_parcelas) ? "" : String(c.link_max_parcelas)} min={1} max={18} step="1" sufixo="x"
            onSalvar={(n) => tentar("link_max_parcelas", Math.round(n))} />
          <CampoConfig label="Parcela mínima" valorInicial={vazio(minCent) ? "" : String(Number(minCent) / 100)} min={0} step="0.01" sufixo="reais"
            onSalvar={(n) => tentar("link_parcela_minima_centavos", Math.round(n * 100))} />
          <CampoConfig label="Validade do link" valorInicial={vazio(valMin) ? "" : String(Number(valMin) / 60)} min={0} step="0.5" sufixo="horas"
            onSalvar={(n) => tentar("link_validade_minutos", Math.round(n * 60))} />
          <CampoConfig label="Comissão da Tray" valorInicial={vazio(c.tray_comissao_pct) ? "" : String(c.tray_comissao_pct)} min={0} max={100} step="0.01" sufixo="%"
            onSalvar={(n) => tentar("tray_comissao_pct", n)} />
        </div>
      </Secao>

      <Secao titulo="Sincronização">
        <Tabela rows={Object.entries(sync ?? {}).map(([recurso, s]) => ({ recurso, ...(s as Row) }))} vazioTxt="Sem dados de sincronização." cols={[
          { k: "recurso", t: "Recurso" },
          { k: "ultimo_ok", t: "Último sucesso", f: fDataHora },
          { k: "erro", t: "Erro", f: (v) => vazio(v) ? <span className="text-success">Sem erro</span> : <span className="text-danger">{String(v)}</span> },
        ]} />
      </Secao>

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar gateway para {confirmar ? ROTULO_GATEWAY[confirmar] : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              A partir de agora os links de cartão enviados no WhatsApp (Anna e painel) serão gerados pela {confirmar ? ROTULO_GATEWAY[confirmar] : ""}. Links já enviados não mudam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const g = confirmar; setConfirmar(null); if (!g) return;
              setTrocando(true);
              try { await tentar("link_cartao_gateway", g); } finally { setTrocando(false); }
            }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
