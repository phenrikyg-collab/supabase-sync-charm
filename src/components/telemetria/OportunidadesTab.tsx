import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, BellRing } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AVISO_OPORTUNIDADES, fetchInsight, fetchInsightsAcoes, fetchInsightsDestaques,
  fmtBRL, fmtInt, fmtPct, num,
} from "@/lib/telemetria";

/* ----------------------------- utilidades ---------------------------- */

const CORES_AREA: Record<string, string> = {
  estoque: "bg-amber-100 text-amber-900 border-amber-300",
  produto: "bg-blue-100 text-blue-900 border-blue-300",
  carrinho: "bg-purple-100 text-purple-900 border-purple-300",
  site: "bg-red-100 text-red-900 border-red-300",
  midia: "bg-slate-200 text-slate-800 border-slate-400",
  destaque: "bg-green-100 text-green-900 border-green-300",
};

const corArea = (area: string) => {
  const k = (area || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return CORES_AREA[k] ?? "bg-muted text-muted-foreground border-border";
};

/** "onde" indica a aba onde investigar. */
const linkDoOnde = (onde: string): string | null => {
  const k = (onde || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!k) return null;
  if (k.includes("avise")) return "/avise-me";
  if (k.includes("carrinho abandonado")) return "/carrinho-abandonado";
  if (k.includes("canal") || k.includes("sess")) return "/telemetria?tab=canais";
  if (k.includes("pagina")) return "/telemetria?tab=paginas";
  if (k.includes("produto")) return "/telemetria?tab=produtos";
  if (k.includes("midia") || k.includes("ads")) return "/marketing?tab=meta-ads";
  if (k.includes("estoque") || k.includes("ruptura")) return "/telemetria?tab=oportunidades";
  return "/telemetria?tab=oportunidades";
};

const vazio = (colSpan: number) => (
  <TableRow>
    <TableCell colSpan={colSpan} className="text-center text-muted-foreground">Sem dados no período</TableCell>
  </TableRow>
);

function useInsight(nome: string, dias: number) {
  const { data, isLoading } = useQuery({
    queryKey: [nome, dias],
    queryFn: () => fetchInsight(nome, dias),
    staleTime: 5 * 60_000,
  });
  return { linhas: (data ?? []) as Record<string, any>[], carregando: isLoading };
}

/* ------------------------------- blocos ------------------------------ */

function AcoesPorImpacto({ dias }: { dias: number }) {
  const { data } = useQuery({
    queryKey: ["insights-acoes", dias],
    queryFn: () => fetchInsightsAcoes(dias, 25),
    staleTime: 5 * 60_000,
  });
  const acoes = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.prioridade - b.prioridade),
    [data],
  );
  const total = acoes.reduce((s, a) => s + a.impacto_reais, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ações por impacto</CardTitle>
        <p className="text-sm text-muted-foreground">
          {fmtBRL(total)} em jogo nas próximas {fmtInt(acoes.length)} ações
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {acoes.map((a, i) => {
          const href = linkDoOnde(a.onde);
          return (
            <div
              key={`${a.prioridade}-${i}`}
              className="flex flex-col gap-2 rounded-lg border border-border p-4 md:flex-row md:items-start md:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${corArea(a.area)}`}>
                  {a.area}
                </span>
                <div className="font-medium">{a.titulo}</div>
                <div className="text-sm text-muted-foreground">{a.detalhe}</div>
                {a.evidencia && <div className="text-xs text-muted-foreground/80">{a.evidencia}</div>}
                {a.onde && (
                  href ? (
                    <Link to={href} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      {a.onde} <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <div className="text-xs text-muted-foreground">{a.onde}</div>
                  )
                )}
              </div>
              <div className="shrink-0 text-right text-lg font-semibold">{fmtBRL(a.impacto_reais)}</div>
            </div>
          );
        })}
        {!acoes.length && <p className="py-6 text-center text-muted-foreground">Sem ações no período</p>}
      </CardContent>
    </Card>
  );
}

function ProdutoMatriz({ dias }: { dias: number }) {
  const { linhas } = useInsight("insights_produto_matriz", dias);
  const corQuad: Record<string, string> = {
    Escalar: "text-success", Oportunidade: "text-primary", Corrigir: "text-destructive", Monitorar: "text-muted-foreground",
  };
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead className="text-right">Sessões que viram</TableHead>
          <TableHead className="text-right">Add. Carrinho</TableHead>
          <TableHead className="text-right">Compras</TableHead>
          <TableHead className="text-right">Receita</TableHead>
          <TableHead className="text-right">Vis.→Carrinho</TableHead>
          <TableHead className="text-right">Conv. Final</TableHead>
          <TableHead>Quadrante</TableHead>
          <TableHead className="text-right">Receita potencial</TableHead>
          <TableHead>Ação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((r, i) => (
          <TableRow key={String(r.produto_id ?? i)}>
            <TableCell className="max-w-[240px] truncate font-medium">{r.nome}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.sessoes_que_viram))}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.add_carrinho))}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.compras))}</TableCell>
            <TableCell className="text-right">{fmtBRL(num(r.receita))}</TableCell>
            <TableCell className="text-right">{fmtPct(num(r.vis_carrinho_pct))}</TableCell>
            <TableCell className="text-right">{fmtPct(num(r.conv_final_pct))}</TableCell>
            <TableCell className={`font-medium ${corQuad[String(r.quadrante)] ?? ""}`}>{r.quadrante ?? "-"}</TableCell>
            <TableCell className="text-right">{fmtBRL(num(r.receita_potencial))}</TableCell>
            <TableCell className="max-w-[240px] text-sm text-muted-foreground">{r.acao ?? "-"}</TableCell>
          </TableRow>
        ))}
        {!linhas.length && vazio(10)}
      </TableBody>
    </Table>
  );
}

function RupturaIminente({ dias }: { dias: number }) {
  const { linhas } = useInsight("insights_ruptura_iminente", dias);
  const ordenadas = useMemo(
    () => [...linhas].sort((a, b) => num(b.receita_em_risco) - num(a.receita_em_risco)),
    [linhas],
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Tamanho</TableHead>
          <TableHead className="text-right">Estoque visto</TableHead>
          <TableHead className="text-right">Sessões interessadas</TableHead>
          <TableHead className="text-right">Procura por dia</TableHead>
          <TableHead className="text-right">Dias até acabar</TableHead>
          <TableHead className="text-right">Preço médio</TableHead>
          <TableHead className="text-right">Receita em risco</TableHead>
          <TableHead>Urgência</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ordenadas.map((r, i) => {
          const critico = num(r.dias_ate_acabar) < 3;
          return (
            <TableRow key={`${r.produto_id}-${r.tamanho}-${i}`} className={critico ? "bg-destructive/5" : ""}>
              <TableCell className="max-w-[240px] truncate font-medium">{r.nome}</TableCell>
              <TableCell>{r.tamanho ?? "-"}</TableCell>
              <TableCell className="text-right">{fmtInt(num(r.estoque_visto))}</TableCell>
              <TableCell className="text-right">{fmtInt(num(r.sessoes_interessadas))}</TableCell>
              <TableCell className="text-right">{num(r.procura_por_dia).toFixed(1)}</TableCell>
              <TableCell className={`text-right ${critico ? "font-semibold text-destructive" : ""}`}>
                {num(r.dias_ate_acabar).toFixed(1)}
              </TableCell>
              <TableCell className="text-right">{fmtBRL(num(r.preco_medio))}</TableCell>
              <TableCell className="text-right font-medium">{fmtBRL(num(r.receita_em_risco))}</TableCell>
              <TableCell>{r.urgencia ?? "-"}</TableCell>
            </TableRow>
          );
        })}
        {!ordenadas.length && vazio(9)}
      </TableBody>
    </Table>
  );
}

function TamanhoEsgotado({ dias }: { dias: number }) {
  const { linhas } = useInsight("insights_tamanho_esgotado", dias);
  const dm = (v: any) => {
    const d = v ? new Date(String(v)) : null;
    return d && !isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR") : "-";
  };
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Cor</TableHead>
          <TableHead>Tamanho</TableHead>
          <TableHead className="text-right">Esperando</TableHead>
          <TableHead className="text-right">E-mail</TableHead>
          <TableHead className="text-right">WhatsApp</TableHead>
          <TableHead className="text-right">Estoque hoje</TableHead>
          <TableHead>Primeiro pedido</TableHead>
          <TableHead>Último pedido</TableHead>
          <TableHead className="text-right">Receita represada</TableHead>
          <TableHead>Ação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((r, i) => (
          <TableRow key={`${r.produto_id}-${r.cor}-${r.tamanho}-${i}`}>
            <TableCell className="max-w-[220px] truncate font-medium">{r.nome}</TableCell>
            <TableCell>{r.cor ?? "-"}</TableCell>
            <TableCell>{r.tamanho ?? "-"}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.esperando))}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.esperando_email))}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.esperando_whatsapp))}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.estoque_hoje))}</TableCell>
            <TableCell>{dm(r.primeiro_pedido)}</TableCell>
            <TableCell>{dm(r.ultimo_pedido)}</TableCell>
            <TableCell className="text-right font-medium">{fmtBRL(num(r.receita_represada))}</TableCell>
            <TableCell className="space-y-1">
              <div className="text-sm text-muted-foreground">{r.acao ?? "-"}</div>
              {num(r.estoque_hoje) > 0 && (
                <Button asChild size="sm" variant="outline" className="h-7">
                  <Link to="/avise-me"><BellRing className="mr-1 h-3 w-3" /> Disparar aviso</Link>
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
        {!linhas.length && vazio(11)}
      </TableBody>
    </Table>
  );
}

function CarrinhoParado({ dias }: { dias: number }) {
  const { linhas } = useInsight("insights_carrinho_parado", dias);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Cor</TableHead>
          <TableHead>Tamanho</TableHead>
          <TableHead className="text-right">Carrinhos</TableHead>
          <TableHead className="text-right">Peças</TableHead>
          <TableHead className="text-right">Valor parado</TableHead>
          <TableHead className="text-right">Convertidos</TableHead>
          <TableHead className="text-right">Taxa de resgate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((r, i) => (
          <TableRow key={`${r.produto_id}-${r.cor}-${r.tamanho}-${i}`}>
            <TableCell className="max-w-[240px] truncate font-medium">{r.nome}</TableCell>
            <TableCell>{r.cor ?? "-"}</TableCell>
            <TableCell>{r.tamanho ?? "-"}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.carrinhos))}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.pecas))}</TableCell>
            <TableCell className="text-right font-medium">{fmtBRL(num(r.valor_parado))}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.carrinhos_convertidos))}</TableCell>
            <TableCell className="text-right">{fmtPct(num(r.taxa_resgate_pct))}</TableCell>
          </TableRow>
        ))}
        {!linhas.length && vazio(8)}
      </TableBody>
    </Table>
  );
}

function ErroQueCusta({ dias }: { dias: number }) {
  const { linhas } = useInsight("insights_erro_que_custa", dias);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Página</TableHead>
          <TableHead className="text-right">Sessões com erro</TableHead>
          <TableHead className="text-right">Conv. com erro</TableHead>
          <TableHead className="text-right">Conv. sem erro</TableHead>
          <TableHead className="text-right">Perda (p.p.)</TableHead>
          <TableHead className="text-right">Ocorrências</TableHead>
          <TableHead className="text-right">Receita perdida</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((r, i) => (
          <TableRow key={`${r.pagina}-${i}`}>
            <TableCell className="max-w-[320px] truncate font-mono text-xs">{r.pagina}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.sessoes_com_erro))}</TableCell>
            <TableCell className="text-right">{fmtPct(num(r.conv_com_erro_pct))}</TableCell>
            <TableCell className="text-right">{fmtPct(num(r.conv_sem_erro_pct))}</TableCell>
            <TableCell className="text-right font-medium text-destructive">{num(r.perda_pp).toFixed(1)}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.ocorrencias))}</TableCell>
            <TableCell className="text-right font-medium">{fmtBRL(num(r.receita_estimada_perdida))}</TableCell>
          </TableRow>
        ))}
        {!linhas.length && vazio(7)}
      </TableBody>
    </Table>
  );
}

function PaginaAtrito({ dias }: { dias: number }) {
  const { linhas } = useInsight("insights_pagina_atrito", dias);
  const corLcp = (ms: number) => (ms <= 2500 ? "text-success" : ms <= 4000 ? "text-amber-600" : "text-destructive");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Página</TableHead>
          <TableHead>Título</TableHead>
          <TableHead className="text-right">Sessões</TableHead>
          <TableHead className="text-right">Saídas</TableHead>
          <TableHead className="text-right">Taxa de saída</TableHead>
          <TableHead className="text-right">LCP</TableHead>
          <TableHead className="text-right">CLS</TableHead>
          <TableHead className="text-right">INP</TableHead>
          <TableHead className="text-right">Tempo médio</TableHead>
          <TableHead className="text-right">Rolagem</TableHead>
          <TableHead className="text-right">Erros JS</TableHead>
          <TableHead>Veredito</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((r, i) => (
          <TableRow key={`${r.pagina}-${i}`}>
            <TableCell className="max-w-[260px] truncate font-mono text-xs">{r.pagina}</TableCell>
            <TableCell className="max-w-[200px] truncate">{r.titulo || "-"}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.sessoes))}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.saidas))}</TableCell>
            <TableCell className={`text-right ${num(r.taxa_saida_pct) > 60 ? "font-medium text-destructive" : ""}`}>
              {fmtPct(num(r.taxa_saida_pct))}
            </TableCell>
            <TableCell className={`text-right font-medium ${corLcp(num(r.lcp_ms))}`}>{fmtInt(num(r.lcp_ms))} ms</TableCell>
            <TableCell className="text-right">{num(r.cls).toFixed(3)}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.inp_ms))} ms</TableCell>
            <TableCell className="text-right">{num(r.segundos_medios).toFixed(0)} s</TableCell>
            <TableCell className="text-right">{fmtPct(num(r.rolagem_media_pct))}</TableCell>
            <TableCell className="text-right">{fmtInt(num(r.erros_js))}</TableCell>
            <TableCell className="max-w-[220px] text-sm text-muted-foreground">{r.veredito ?? "-"}</TableCell>
          </TableRow>
        ))}
        {!linhas.length && vazio(12)}
      </TableBody>
    </Table>
  );
}

function EfeitoRecursos({ dias }: { dias: number }) {
  const { linhas } = useInsight("insights_efeito_recursos", dias);
  if (!linhas.length) return <p className="py-6 text-center text-muted-foreground">Sem dados no período</p>;
  return (
    <div className="space-y-3">
      {linhas.map((r, i) => {
        const dif = num(r.diferenca_pp);
        return (
          <div key={`${r.recurso}-${i}`} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">{r.recurso}</div>
              <div className={`text-lg font-semibold ${dif >= 0 ? "text-success" : "text-destructive"}`}>
                {dif >= 0 ? "+" : ""}{dif.toFixed(1)} p.p.
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Com o recurso</div>
                <div>{fmtInt(num(r.sessoes_com))} sessões · conversão {fmtPct(num(r.conv_com_pct))}</div>
                <div>Receita por sessão {fmtBRL(num(r.receita_por_sessao_com))}</div>
              </div>
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Sem o recurso</div>
                <div>{fmtInt(num(r.sessoes_sem))} sessões · conversão {fmtPct(num(r.conv_sem_pct))}</div>
                <div>Receita por sessão {fmtBRL(num(r.receita_por_sessao_sem))}</div>
              </div>
            </div>
            {r.leitura && <div className="mt-2 text-sm text-muted-foreground">{r.leitura}</div>}
          </div>
        );
      })}
    </div>
  );
}

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function QuandoVende({ dias }: { dias: number }) {
  const { linhas } = useInsight("insights_quando_vende", dias);

  const mapa = useMemo(() => {
    const m = new Map<string, Record<string, any>>();
    for (const r of linhas) {
      const d = typeof r.dia_semana === "number" ? r.dia_semana : DIAS_SEMANA.findIndex((n) => n.toLowerCase() === String(r.dia_semana).toLowerCase());
      m.set(`${d}-${num(r.hora)}`, r);
    }
    return m;
  }, [linhas]);

  const cor = (indice: number) => {
    if (!indice) return "hsl(var(--muted))";
    const t = Math.max(0, Math.min(2, indice)) / 2; // 0..1, 0,5 = média
    return `hsla(142, 70%, 40%, ${0.08 + t * 0.85})`;
  };

  if (!linhas.length) return <p className="py-6 text-center text-muted-foreground">Sem dados no período</p>;

  return (
    <div className="space-y-3 overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="flex gap-[2px] pl-20 text-[10px] text-muted-foreground">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="w-6 text-center">{h}</div>
          ))}
        </div>
        {DIAS_SEMANA.map((nome, d) => (
          <div key={nome} className="flex items-center gap-[2px]">
            <div className="w-20 shrink-0 text-xs text-muted-foreground">{nome}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const r = mapa.get(`${d}-${h}`);
              const indice = num(r?.indice_vs_media);
              return (
                <div
                  key={h}
                  className="h-6 w-6 rounded-sm border border-border/40"
                  style={{ background: cor(indice) }}
                  title={
                    r
                      ? `${nome} ${h}h · ${fmtInt(num(r.sessoes))} sessões · ${fmtInt(num(r.compras))} compras · ${fmtPct(num(r.conv_pct))} · ${fmtBRL(num(r.receita))} · índice ${indice.toFixed(2)}`
                      : `${nome} ${h}h · sem dados`
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Índice 1,0 é a média da loja. Verde mais forte vende acima da média.</p>
    </div>
  );
}

/* -------------------------------- aba -------------------------------- */

const SUBABAS = [
  { value: "produtos", label: "Produtos", render: (d: number) => <ProdutoMatriz dias={d} /> },
  { value: "ruptura", label: "Ruptura", render: (d: number) => <RupturaIminente dias={d} /> },
  { value: "fila", label: "Fila de espera", render: (d: number) => <TamanhoEsgotado dias={d} /> },
  { value: "carrinho", label: "Carrinho", render: (d: number) => <CarrinhoParado dias={d} /> },
  { value: "erros", label: "Erros", render: (d: number) => <ErroQueCusta dias={d} /> },
  { value: "paginas", label: "Páginas", render: (d: number) => <PaginaAtrito dias={d} /> },
  { value: "recursos", label: "Recursos", render: (d: number) => <EfeitoRecursos dias={d} /> },
  { value: "horarios", label: "Horários", render: (d: number) => <QuandoVende dias={d} /> },
];

export function OportunidadesTab() {
  const [dias, setDias] = useState(30);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-muted-foreground">Período de análise:</span>
        <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[7, 14, 30, 60].map((d) => (
              <SelectItem key={d} value={String(d)}>Últimos {d} dias</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AcoesPorImpacto dias={dias} />

      <Card>
        <CardHeader><CardTitle className="text-lg">Análises detalhadas</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="produtos">
            <TabsList className="h-auto flex-wrap">
              {SUBABAS.map((s) => (
                <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
              ))}
            </TabsList>
            {SUBABAS.map((s) => (
              <TabsContent key={s.value} value={s.value} className="overflow-x-auto pt-4">
                {s.render(dias)}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">{AVISO_OPORTUNIDADES}</p>
    </div>
  );
}
