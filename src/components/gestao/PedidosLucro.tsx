import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ExternalLink, Info, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SortableHead, useSortable } from "@/components/SortableHead";
import { brl, ddmm, int, num, pct } from "@/lib/gestaoFormat";
import { cn } from "@/lib/utils";

const PERIODOS = [7, 30, 90];

function corMargem(p: number) {
  if (p < 40) return "text-red-600";
  if (p <= 55) return "text-amber-600";
  return "text-emerald-600";
}

function Dica({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <UiTooltip>
      <TooltipTrigger asChild><span className="cursor-help">{children}</span></TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{texto}</TooltipContent>
    </UiTooltip>
  );
}

const FRETE_SELO: Record<string, { label: string; className: string; dica?: string }> = {
  retirada: { label: "retirada", className: "bg-muted text-muted-foreground border-border" },
  motoboy_fixo: { label: "fixo", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  correios_sp_capital_fixo: { label: "fixo", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  media_estado: {
    label: "estimado", className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    dica: "Sem dado real desse pedido — usando média de frete da região do cliente",
  },
  media_nacional: {
    label: "estimado", className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    dica: "Sem dado real desse pedido — usando média de frete da região do cliente",
  },
};

function CelulaFrete({ p }: { p: any }) {
  const selo = FRETE_SELO[String(p.frete_tipo ?? "")];
  const valor = brl(p.frete_usado ?? p.custo_frete_real);
  if (!selo) return <>{valor}</>;
  const badge = <Badge variant="outline" className={cn("ml-1 text-[10px]", selo.className)}>{selo.label}</Badge>;
  return (
    <span className="inline-flex items-center">
      {valor}
      {selo.dica ? <Dica texto={selo.dica}>{badge}</Dica> : badge}
    </span>
  );
}

function temCredito(p: any) {
  return Boolean(p.credito_troca ?? p.tem_credito_troca ?? p.credito_troca_aplicado);
}


function Tile({
  titulo, valor, tom = "default", dica, pequeno,
}: { titulo: string; valor: string; tom?: "default" | "red" | "green" | "muted"; dica?: string; pequeno?: boolean }) {
  const cor = tom === "red" ? "text-red-600" : tom === "green" ? "text-emerald-600" : tom === "muted" ? "text-muted-foreground" : "text-foreground";
  const conteudo = (
    <Card>
      <CardContent className="p-4 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          {titulo}
          {dica && <Info className="h-3 w-3 opacity-60" />}
        </p>
        <p className={cn(pequeno ? "text-lg" : "text-2xl", "font-serif font-bold", cor)}>{valor}</p>
      </CardContent>
    </Card>
  );
  return dica ? <Dica texto={dica}>{conteudo}</Dica> : conteudo;
}

type SortCampo = "data" | "margem_pct";

export default function PedidosLucro() {
  const [dias, setDias] = useState(30);
  const [canal, setCanal] = useState<string>("todos");
  const { sort, alternar } = useSortable<SortCampo>({ key: "data", dir: "desc" });

  const { data, isLoading } = useQuery({
    queryKey: ["pedidos-lucro", dias, canal],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pedidos_lucro" as any, {
        p_dias: dias,
        p_canal: canal === "todos" ? null : canal,
      });
      if (error) throw error;
      return (data ?? {}) as any;
    },
  });

  const resumo = data?.resumo ?? {};
  const porCanal = useMemo(
    () => [...(data?.por_canal ?? [])].sort((a: any, b: any) => num(b.receita_liquida) - num(a.receita_liquida)),
    [data],
  );
  const pedidos = useMemo(() => {
    const lista = [...(data?.pedidos ?? [])];
    const fator = sort.dir === "asc" ? 1 : -1;
    lista.sort((a: any, b: any) => {
      if (sort.key === "margem_pct") return (num(a.margem_pct) - num(b.margem_pct)) * fator;
      return String(a.data ?? "").localeCompare(String(b.data ?? "")) * fator;
    });
    return lista;
  }, [data, sort]);

  const pedidosBaixos = useMemo(() => pedidos.filter((p: any) => num(p.margem_pct) < 40), [pedidos]);
  const qtdBaixa = num(resumo.pedidos_margem_baixa) || pedidosBaixos.length;

  const maxReceita = Math.max(1, ...porCanal.map((c: any) => num(c.receita_liquida)));
  const lacunas = num(resumo.pedidos_com_lacuna_custo);
  const margemMedia = num(resumo.margem_media_pct);


  const opcoesCanal = useMemo(
    () => (data?.por_canal ?? []).map((c: any) => String(c.canal ?? "—")),
    [data],
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Pedidos × Lucro</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5">
              {PERIODOS.map((d) => (
                <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} className="h-9" onClick={() => setDias(d)}>
                  {d} dias
                </Button>
              ))}
            </div>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os canais</SelectItem>
                {opcoesCanal.map((c: string) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}

        {/* BLOCO A */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile titulo="Pedidos" valor={int(resumo.pedidos)} />
          <Tile titulo="Receita líquida" valor={brl(resumo.receita_liquida)} />
          <Tile titulo="CMV" valor={brl(resumo.cmv_total)} tom="red" />
          <Tile titulo="Margem de contribuição" valor={brl(resumo.margem_total)} tom="green" />
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Margem média</p>
              <p className={cn("text-2xl font-serif font-bold", corMargem(margemMedia))}>{pct(margemMedia, 1)}</p>
            </CardContent>
          </Card>
          <Tile
            titulo="Lucro líquido"
            valor={brl(resumo.lucro_liquido_total)}
            tom="green"
            dica="Margem de contribuição menos frete real (quando disponível) e CAC do cliente novo."
          />
          <Tile
            titulo="CAC médio"
            valor={brl(resumo.cac_global_periodo)}
            pequeno
            tom="muted"
            dica="Gasto Meta Ads ÷ clientes novos no período. Aplicado só no pedido da 1ª compra do cliente."
          />
          <Card>
            <CardContent className="p-4 space-y-2">
              <Dica texto="Parte do custo desses pedidos veio do cadastro atual do produto, não do valor exato da venda — pode ter pequena diferença.">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    Pedidos com custo estimado <Info className="h-3 w-3 opacity-60" />
                  </p>
                  <p className="text-lg font-serif font-bold text-muted-foreground">
                    {int(resumo.pedidos_com_cmv_estimado)}
                  </p>
                </div>
              </Dica>
              {lacunas > 0 && (
                <Badge variant="destructive" className="text-[10px] leading-tight whitespace-normal text-left">
                  {int(lacunas)} pedidos sem custo cadastrado — margem desses está inflada, cadastre o custo do produto.
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* BLOCO B */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Margem por canal</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">CMV</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead className="text-right">Lucro líq.</TableHead>
                    <TableHead className="text-right">Margem %</TableHead>
                    <TableHead className="text-right">Ticket médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porCanal.map((c: any) => (
                    <TableRow key={c.canal}>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-medium">{c.canal ?? "—"}</span>
                        {num(c.pedidos_cliente_novo) > 0 && (
                          <Badge variant="secondary" className="ml-1.5 text-[10px]">{int(c.pedidos_cliente_novo)} novos</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{int(c.pedidos)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span>{brl(c.receita_liquida)}</span>
                          <span className="h-1 rounded bg-primary/60" style={{ width: `${(num(c.receita_liquida) / maxReceita) * 100}%`, minWidth: 4 }} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-red-600">{brl(c.cmv_total)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{brl(c.margem_total)}</TableCell>
                      <TableCell className="text-right">{brl(c.lucro_liquido_total)}</TableCell>
                      <TableCell className={cn("text-right font-medium", corMargem(num(c.margem_media_pct ?? c.margem_pct)))}>
                        {pct(num(c.margem_media_pct ?? c.margem_pct), 1)}
                      </TableCell>
                      <TableCell className="text-right">{brl(c.ticket_medio)}</TableCell>
                    </TableRow>
                  ))}
                  {!porCanal.length && !isLoading && (
                    <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Sem dados no período.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Margem de contribuição por canal</CardTitle></CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porCanal.map((c: any) => ({ canal: c.canal ?? "—", margem: num(c.margem_total) }))} layout="vertical" margin={{ left: 24, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => brl(v, 0)} fontSize={11} />
                  <YAxis type="category" dataKey="canal" width={100} fontSize={11} />
                  <Tooltip formatter={(v: any) => brl(v)} />
                  <Bar dataKey="margem" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* BLOCO C */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pedidos ({int(pedidos.length)})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <CabecalhoPedidos sort={sort} alternar={alternar} />
              <TableBody>
                {pedidos.map((p: any, i: number) => <LinhaPedido key={p.tray_order_id ?? `${p.data}-${i}`} p={p} />)}
                {!pedidos.length && !isLoading && (
                  <TableRow><TableCell colSpan={15} className="text-center text-sm text-muted-foreground">Sem pedidos no período.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* BLOCO D */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Pedidos com margem baixa</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent className="p-4 space-y-1">
                  <p className={cn("text-2xl font-serif font-bold", qtdBaixa > 0 ? "text-red-600" : "text-foreground")}>
                    {int(qtdBaixa)} pedidos com margem &lt; 40%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {int(resumo.pedidos_margem_baixa_com_credito)} desses têm crédito de troca aplicado (não é prejuízo real)
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <CabecalhoPedidos sort={sort} alternar={alternar} />
                <TableBody>
                  {pedidosBaixos.map((p: any, i: number) => <LinhaPedido key={p.tray_order_id ?? `baixo-${i}`} p={p} />)}
                  {!pedidosBaixos.length && !isLoading && (
                    <TableRow><TableCell colSpan={15} className="text-center text-sm text-muted-foreground">Nenhum pedido com margem abaixo de 40%.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Concentração alta em WhatsApp/atendimento manual indica desconto negociado na venda — revisar com o time
              se os valores dados batem com o autorizado.
            </p>
          </CardContent>
        </Card>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Margem de contribuição = receita líquida − custo do produto − taxa de gateway − DAS. Não desconta frete
          (o que foi cobrado do cliente já está na receita, o custo de envio não é rastreado por pedido) nem custo de
          mídia/CAC. Fonte de custo: cost_price do item no momento da venda; quando ausente, usa o custo cadastrado
          hoje no produto (sinalizado na tela). Lucro líquido = margem de contribuição − frete (real via Melhor Envio
          quando disponível; senão R$0 retirada na loja, R$14,90 motoboy, R$10,90 Correios SP Capital, ou média de
          frete por estado) − CAC (só na 1ª compra do cliente, via gasto Meta Ads ÷ clientes novos no período).
        </p>

      </div>
    </TooltipProvider>
  );
}

function CabecalhoPedidos({ sort, alternar }: { sort: any; alternar: (c: SortCampo) => void }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Pedido</TableHead>
        <SortableHead campo="data" sort={sort} onSort={alternar}>Data</SortableHead>
        <TableHead>Canal</TableHead>
        <TableHead>Pagamento</TableHead>
        <TableHead>Cliente novo</TableHead>
        <TableHead className="text-right">Receita líq.</TableHead>
        <TableHead className="text-right">CMV</TableHead>
        <TableHead className="text-right">Taxa gateway</TableHead>
        <TableHead className="text-right">DAS</TableHead>
        <TableHead className="text-right">CAC</TableHead>
        <TableHead className="text-right">Frete</TableHead>
        <TableHead className="text-right">Margem</TableHead>
        <SortableHead campo="margem_pct" sort={sort} onSort={alternar} className="text-right">Margem %</SortableHead>
        <TableHead className="text-right">Lucro líq.</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function LinhaPedido({ p }: { p: any }) {
  const mp = num(p.margem_pct);
  return (
    <TableRow className={cn(mp < 20 && "bg-red-500/5")}>
      <TableCell className="whitespace-nowrap font-medium">
        {p.url_tray ? (
          <a href={p.url_tray} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            {p.tray_order_id} <ExternalLink className="h-3 w-3" />
          </a>
        ) : p.tray_order_id}
        {mp < 0 && <Badge variant="destructive" className="ml-1.5 text-[10px]">PREJUÍZO</Badge>}
        {temCredito(p) && (
          <Badge variant="outline" className="ml-1.5 text-[10px] bg-muted text-muted-foreground border-border">crédito/troca</Badge>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">{ddmm(p.data)}</TableCell>
      <TableCell className="whitespace-nowrap">{p.canal ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap text-xs">{p.forma_pagamento ?? "—"}</TableCell>
      <TableCell>
        {p.cliente_novo
          ? <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]" variant="outline">Novo</Badge>
          : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right">{brl(p.receita_liquida)}</TableCell>
      <TableCell className={cn("text-right", p.cmv_com_lacuna && "text-red-600 font-medium")}>
        <span className="inline-flex items-center gap-1">
          {p.cmv_com_lacuna ? (
            <Dica texto="Produto sem custo cadastrado — margem deste pedido não é confiável">
              <span className="inline-flex items-center gap-1">{brl(p.cmv)} <AlertTriangle className="h-3 w-3" /></span>
            </Dica>
          ) : p.cmv_com_estimativa ? (
            <Dica texto="Custo estimado a partir do cadastro do produto">
              <span className="inline-flex items-center gap-1">{brl(p.cmv)} <Info className="h-3 w-3 opacity-60" /></span>
            </Dica>
          ) : brl(p.cmv)}
        </span>
      </TableCell>
      <TableCell className="text-right">{brl(p.taxa_gateway)}</TableCell>
      <TableCell className="text-right">{brl(p.imposto_das ?? p.das)}</TableCell>
      <TableCell className="text-right">{num(p.cac_aplicado) > 0 ? brl(p.cac_aplicado) : "—"}</TableCell>
      <TableCell className="text-right whitespace-nowrap"><CelulaFrete p={p} /></TableCell>
      <TableCell className="text-right text-emerald-600">{brl(p.margem)}</TableCell>
      <TableCell className={cn("text-right font-medium", corMargem(mp))}>{pct(mp, 1)}</TableCell>
      <TableCell className="text-right">{brl(p.lucro_liquido)}</TableCell>
    </TableRow>
  );
}

