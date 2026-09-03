import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Download, PackageX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";

const brl = (v: any) =>
  Number.isFinite(Number(v))
    ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString("pt-BR") : "0");
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const LIMITE = 200;

function csvEscape(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function baixarCsv(nome: string, cabecalho: string[], linhas: any[][]) {
  const conteudo = [cabecalho, ...linhas].map((l) => l.map(csvEscape).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = { inicio: string; fim: string };

export default function PecasEmRetorno({ inicio, fim }: Props) {
  const [estagio, setEstagio] = useState<string | null>(null);
  const [ordem, setOrdem] = useState("valor");
  const [seguirPeriodo, setSeguirPeriodo] = useState(false);
  const [soSemEstoque, setSoSemEstoque] = useState(false);
  const [visao, setVisao] = useState<"variacao" | "produto">("variacao");
  const [mesManual, setMesManual] = useState<{ inicio: string; fim: string } | null>(null);

  const periodoAtivo = mesManual ?? (seguirPeriodo ? { inicio, fim } : null);

  const q = useQuery({
    queryKey: ["trocas-produtos-retorno", estagio, ordem, periodoAtivo?.inicio, periodoAtivo?.fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_trocas_produtos_retorno" as any, {
        p_estagio: estagio,
        p_ordem: ordem,
        p_limit: LIMITE,
        p_inicio: periodoAtivo?.inicio ?? null,
        p_fim: periodoAtivo?.fim ?? null,
      });
      if (error) throw error;
      return (data ?? {}) as any;
    },
  });

  const d = q.data ?? {};
  const resumo = d.resumo ?? {};
  const porEstagio: any[] = Array.isArray(d.por_estagio) ? d.por_estagio : [];
  const porMes: any[] = Array.isArray(d.por_mes) ? d.por_mes : [];
  const filtrado = Boolean(d.periodo?.filtrado);

  const variacoes: any[] = useMemo(() => {
    const base = Array.isArray(d.variacoes) ? d.variacoes : Array.isArray(d.itens) ? d.itens : [];
    return soSemEstoque ? base.filter((v: any) => v.volta_para_estoque_zerado === true) : base;
  }, [d.variacoes, d.itens, soSemEstoque]);

  const produtos: any[] = useMemo(() => (Array.isArray(d.produtos) ? d.produtos : []), [d.produtos]);

  const exportar = () => {
    const hoje = new Date().toISOString().slice(0, 10);
    if (visao === "produto") {
      baixarCsv(
        `pecas-em-retorno-${hoje}.csv`,
        ["Peça", "Qtd", "Variações", "Tamanhos", "Na loja", "A caminho", "Motivo", "Valor"],
        produtos.map((p) => [p.produto, n(p.qtd), n(p.variacoes), p.tamanhos, n(p.ja_na_loja ?? p.na_loja), n(p.a_caminho), p.motivo_top, n(p.valor)]),
      );
      return;
    }
    baixarCsv(
      `pecas-em-retorno-${hoje}.csv`,
      ["Peça", "Cor", "Tamanho", "SKU", "Qtd", "Estoque", "Motivo", "Valor", "Parada há (dias)"],
      variacoes.map((v) => [v.produto, v.cor, v.tamanho, v.sku, n(v.qtd), n(v.estoque_atual), v.motivo_top, n(v.valor), n(v.dias_parada_max)]),
    );
  };

  const chips = (v: any) => {
    const itens = [
      ["aguardando aprovação", v.aguardando_aprovacao],
      ["aguardando postagem", v.aguardando_postagem],
      ["em trajeto", v.em_transito],
      ["na loja", v.recebida ?? v.na_loja],
    ] as [string, any][];
    const ativos = itens.filter(([, q2]) => n(q2) > 0);
    if (!ativos.length) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {ativos.map(([rot, q2]) => (
          <Badge key={rot} variant="outline" className="text-[10px]">{rot} {num(q2)}</Badge>
        ))}
      </div>
    );
  };

  return (
    <Card id="pecas-em-retorno">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Peças em retorno</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              <Button size="sm" variant={visao === "variacao" ? "secondary" : "ghost"} onClick={() => setVisao("variacao")}>Por variação</Button>
              <Button size="sm" variant={visao === "produto" ? "secondary" : "ghost"} onClick={() => setVisao("produto")}>Por produto</Button>
            </div>
            <Button size="sm" variant="outline" onClick={exportar}>
              <Download className="mr-1 h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </div>

        {/* resumo */}
        {q.isLoading ? (
          <div className="grid gap-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Peças voltando</p>
                <p className="text-2xl font-semibold">{num(resumo.itens)}</p>
                <p className="text-xs text-muted-foreground">{brl(resumo.valor)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Já na loja</p>
                <p className="text-2xl font-semibold">{num(resumo.ja_na_loja)}</p>
                <p className="text-xs text-muted-foreground">{brl(resumo.valor_na_loja)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">A caminho</p>
                <p className="text-2xl font-semibold">{num(resumo.a_caminho)}</p>
              </div>
              <UITooltip>
                <TooltipTrigger asChild>
                  <div className="rounded-lg border p-3 text-left">
                    <p className="text-xs text-muted-foreground">Na loja com estoque zerado</p>
                    <p className="text-2xl font-semibold text-destructive">{num(resumo.na_loja_sem_estoque)}</p>
                    <p className="text-xs text-muted-foreground">{brl(resumo.valor_na_loja_sem_estoque)} parados</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  A peça voltou e está no showroom, mas a Tray mostra estoque 0 para essa variação — não está disponível para venda.
                </TooltipContent>
              </UITooltip>
            </div>

            {n(resumo.reestocados) === 0 && (
              <div className="rounded-md border border-amber-500 bg-amber-500/10 p-3">
                <p className="text-sm font-semibold">Nenhuma peça devolvida voltou para o estoque</p>
                <p className="text-xs text-muted-foreground">
                  {num(resumo.ja_na_loja)} peças receberam entrada física e nenhuma voltou ao estoque da Tray. O reestoque da Troque &amp; Devolva nunca foi usado.
                </p>
              </div>
            )}
          </>
        )}

        {/* filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={estagio === null ? "secondary" : "outline"} onClick={() => setEstagio(null)}>Todas</Button>
          {porEstagio.map((e: any) => (
            <Button
              key={e.estagio}
              size="sm"
              variant={estagio === e.estagio ? "secondary" : "outline"}
              onClick={() => setEstagio(e.estagio)}
            >
              {e.estagio_rotulo ?? e.rotulo} ({num(e.qtd ?? e.itens)})
            </Button>
          ))}
          <Select value={ordem} onValueChange={setOrdem}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="valor">Maior valor</SelectItem>
              <SelectItem value="quantidade">Maior quantidade</SelectItem>
              <SelectItem value="produto">Nome do produto</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant={soSemEstoque ? "secondary" : "outline"} onClick={() => setSoSemEstoque((v) => !v)}>
            Só as que estão na loja com estoque zerado
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button
            size="sm"
            variant={!periodoAtivo ? "secondary" : "ghost"}
            onClick={() => { setSeguirPeriodo(false); setMesManual(null); }}
          >
            Toda a fila em aberto
          </Button>
          <Button
            size="sm"
            variant={periodoAtivo ? "secondary" : "ghost"}
            onClick={() => { setMesManual(null); setSeguirPeriodo(true); }}
          >
            Seguir o período selecionado
          </Button>
          {filtrado && <span className="text-xs text-amber-600">Mostrando apenas o período selecionado</span>}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* mini gráfico por mês */}
        {porMes.length > 0 && (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              data={porMes}
              onClick={(e: any) => {
                const p = e?.activePayload?.[0]?.payload;
                if (p?.inicio && p?.fim) { setSeguirPeriodo(false); setMesManual({ inicio: p.inicio, fim: p.fim }); }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={11} />
              <RTooltip />
              <Bar dataKey="itens" name="Peças" fill="hsl(var(--primary))" cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {q.isError ? (
          <p className="py-6 text-center text-sm text-destructive">
            {(q.error as any)?.message ?? "Erro ao carregar as peças em retorno."}
          </p>
        ) : (
          <div className="h-[520px] overflow-auto rounded-md border">
            {q.isLoading ? (
              <div className="space-y-2 p-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : visao === "variacao" ? (
              variacoes.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma peça em retorno neste filtro</p>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Peça</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Parada há</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variacoes.map((v: any, i: number) => {
                      const dias = n(v.dias_parada_max);
                      const zerado = v.volta_para_estoque_zerado === true;
                      return (
                        <TableRow
                          key={v.sku ?? i}
                          className={v.link ? "cursor-pointer" : ""}
                          onClick={() => v.link && window.open(v.link, "_blank", "noopener")}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {v.imagem && <img src={v.imagem} alt={v.produto ?? "peça"} loading="lazy" className="h-10 w-10 rounded object-cover" />}
                              <div>
                                <p className="text-sm">{v.produto ?? "—"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[v.cor, v.tamanho].filter(Boolean).join(" · ") || "—"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{v.sku ?? "—"}</TableCell>
                          <TableCell className="text-right">{num(v.qtd)}</TableCell>
                          <TableCell>{chips(v)}</TableCell>
                          <TableCell className="text-right">
                            {zerado ? (
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                                    <PackageX className="h-3.5 w-3.5" />0
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Peça na loja e sem estoque no site</TooltipContent>
                              </UITooltip>
                            ) : (
                              num(v.estoque_atual)
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{v.motivo_top ?? "—"}</TableCell>
                          <TableCell className="text-right text-sm">{brl(v.valor)}</TableCell>
                          <TableCell className={`text-right text-sm ${dias > 90 ? "font-semibold text-destructive" : dias >= 30 ? "text-amber-600" : ""}`}>
                            {num(dias)}d
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )
            ) : produtos.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma peça em retorno neste filtro</p>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Peça</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Variações</TableHead>
                    <TableHead>Tamanhos</TableHead>
                    <TableHead className="text-right">Na loja</TableHead>
                    <TableHead className="text-right">A caminho</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtos.map((p: any, i: number) => (
                    <TableRow
                      key={p.product_id ?? i}
                      className={p.link ? "cursor-pointer" : ""}
                      onClick={() => p.link && window.open(p.link, "_blank", "noopener")}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.imagem && <img src={p.imagem} alt={p.produto ?? "peça"} loading="lazy" className="h-10 w-10 rounded object-cover" />}
                          <span className="text-sm">{p.produto ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{num(p.qtd)}</TableCell>
                      <TableCell className="text-right">{num(p.variacoes)}</TableCell>
                      <TableCell className="text-xs">{Array.isArray(p.tamanhos) ? p.tamanhos.join(", ") : (p.tamanhos ?? "—")}</TableCell>
                      <TableCell className="text-right">{num(p.ja_na_loja ?? p.na_loja)}</TableCell>
                      <TableCell className="text-right">{num(p.a_caminho)}</TableCell>
                      <TableCell className="text-xs">{p.motivo_top ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm">{brl(p.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {n(resumo.na_loja_sem_estoque) > 0 && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            Peças no showroom sem estoque no site não estão disponíveis para venda.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
