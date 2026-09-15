import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Minus } from "lucide-react";
import {
  dataCurta,
  dataHora,
  dec,
  insightsCaimento,
  insightsEvolucao,
  insightsProdutoDetalhe,
  insightsProdutos,
  insightsResumo,
  insightsTemas,
  num,
  pct,
  ROTULO_TEMA,
  type ProdutoInsight,
} from "@/lib/avaliacoesInsights";

const PERIODOS = [30, 90, 180, 365];

function Vazio({ texto }: { texto: string }) {
  return <p className="py-6 text-sm text-muted-foreground">{texto}</p>;
}

function Carregando({ altura = "h-40" }: { altura?: string }) {
  return <Skeleton className={`w-full ${altura}`} />;
}

function Variacao({ valor }: { valor: number | null | undefined }) {
  const n = Number(valor);
  if (valor === null || valor === undefined || !Number.isFinite(n)) {
    return <span className="text-xs text-muted-foreground">sem dados</span>;
  }
  if (Math.abs(n) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> estável
      </span>
    );
  }
  const sobe = n > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        sobe ? "text-emerald-600" : "text-destructive"
      }`}
    >
      {sobe ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {dec(Math.abs(n), 2)}
    </span>
  );
}

function CardKpi({
  rotulo,
  valor,
  extra,
}: {
  rotulo: string;
  valor: string;
  extra?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <p className="mt-1 font-serif text-2xl tabular-nums">{valor}</p>
      {extra ? <div className="mt-1">{extra}</div> : null}
    </Card>
  );
}

/* ---------------- Bloco 1 ---------------- */

function BlocoVisaoGeral({ dias }: { dias: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["aval-insights-resumo", dias],
    queryFn: () => insightsResumo(dias),
  });

  if (isLoading) return <Carregando altura="h-44" />;
  if (isError || !data) return <Vazio texto="Não foi possível carregar a visão geral." />;

  const p = data.produto ?? {};
  const l = data.loja ?? {};
  const r = data.regua ?? {};
  const dist = p.distribuicao ?? {};
  const totalDist = [5, 4, 3, 2, 1].reduce((s, n) => s + Number(dist[String(n)] ?? 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:col-span-2">
        <CardKpi
          rotulo="Nota média do produto"
          valor={dec(p.media, 2)}
          extra={
            <Variacao
              valor={
                p.media !== null && p.media !== undefined && p.media_anterior !== null && p.media_anterior !== undefined
                  ? Number(p.media) - Number(p.media_anterior)
                  : null
              }
            />
          }
        />
        <CardKpi rotulo="Avaliações" valor={num(p.total)} />
        <CardKpi rotulo="5 estrelas" valor={pct(p.pct_5)} />
        <CardKpi rotulo="Até 3 estrelas" valor={pct(p.pct_ate_3)} />
        <CardKpi rotulo="Nota média da loja" valor={dec(l.media, 2)} />
        <CardKpi rotulo="NPS da loja" valor={num(l.nps)} />
        <CardKpi rotulo="Taxa de resposta da régua" valor={pct(r.taxa_resposta_pct)} />
        <CardKpi rotulo="Leitura no WhatsApp" valor={pct(r.taxa_leitura_pct)} />
      </div>

      <Card className="p-4">
        <h3 className="font-serif text-lg">Distribuição de estrelas</h3>
        {!totalDist ? (
          <Vazio texto="Ainda não há avaliações suficientes no período." />
        ) : (
          <div className="mt-4 space-y-2">
            {[5, 4, 3, 2, 1].map((n) => {
              const v = Number(dist[String(n)] ?? 0);
              const largura = totalDist ? (v / totalDist) * 100 : 0;
              return (
                <div key={n} className="flex items-center gap-2 text-sm">
                  <span className="w-8 tabular-nums text-muted-foreground">{n}★</span>
                  <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${largura}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{num(v)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Bloco 2 ---------------- */

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function periodoCurto(v: any, gran: "mes" | "semana"): string {
  const s = String(v ?? "");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  if (gran === "mes") {
    return `${MESES_CURTOS[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
  }
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function BlocoEvolucao({ dias }: { dias: number }) {
  const [gran, setGran] = useState<"mes" | "semana">("mes");
  const { data, isLoading } = useQuery({
    queryKey: ["aval-insights-evolucao", dias, gran],
    queryFn: () => insightsEvolucao(dias, gran),
  });

  const serie = data?.serie ?? [];

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg">Evolução</h3>
          <p className="text-sm text-muted-foreground">
            Nota média, volume e quantas avaliações vieram do fluxo próprio.
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={gran === "mes" ? "default" : "outline"}
            onClick={() => setGran("mes")}
          >
            Mês
          </Button>
          <Button
            size="sm"
            variant={gran === "semana" ? "default" : "outline"}
            onClick={() => setGran("semana")}
          >
            Semana
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4">
          <Carregando altura="h-64" />
        </div>
      ) : !serie.length ? (
        <Vazio texto="Ainda não há avaliações suficientes no período para montar a evolução." />
      ) : (
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="esq" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="dir" orientation="right" domain={[0, 5]} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v: any, nome: any) =>
                  nome === "Nota média" ? dec(v, 2) : num(v)
                }
              />
              <Legend />
              <Bar yAxisId="esq" dataKey="produto_total" name="Avaliações" fill="hsl(var(--muted-foreground))" />
              <Bar yAxisId="esq" dataKey="produto_proprias" name="Fluxo próprio" fill="hsl(var(--primary))" />
              <Line
                yAxisId="dir"
                type="monotone"
                dataKey="produto_media"
                name="Nota média"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Bloco 3 ---------------- */

const ORDENS = [
  { valor: "piores", rotulo: "Piores" },
  { valor: "melhores", rotulo: "Melhores" },
  { valor: "volume", rotulo: "Maior volume" },
  { valor: "queda", rotulo: "Maior queda" },
];

function PainelProduto({
  chave,
  dias,
  aberto,
  aoFechar,
}: {
  chave: string | null;
  dias: number;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["aval-insights-detalhe", chave, dias],
    queryFn: () => insightsProdutoDetalhe(chave as string, dias),
    enabled: !!chave && aberto,
  });

  const textos = useMemo(() => {
    const lista = data?.textos ? [...data.textos] : [];
    return lista.sort((a, b) => {
      const pa = (a.ressalva ? 2 : 0) + (Number(a.nota) <= 3 ? 1 : 0);
      const pb = (b.ressalva ? 2 : 0) + (Number(b.nota) <= 3 ? 1 : 0);
      return pb - pa;
    });
  }, [data]);

  const dist = data?.distribuicao ?? {};
  const totalDist = [5, 4, 3, 2, 1].reduce((s, n) => s + Number(dist[String(n)] ?? 0), 0);
  const temas = Object.entries(data?.temas ?? {}).sort((a, b) => Number(b[1]) - Number(a[1]));

  return (
    <Sheet open={aberto} onOpenChange={(v) => (!v ? aoFechar() : null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-serif">{data?.rotulo ?? "Produto"}</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-4 space-y-3">
            <Carregando altura="h-24" />
            <Carregando altura="h-40" />
          </div>
        ) : !data || !data.total ? (
          <Vazio texto="Este produto ainda não tem avaliações no período." />
        ) : (
          <div className="mt-4 space-y-5 text-sm">
            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Avaliações</p>
                <p className="font-serif text-xl tabular-nums">{num(data.total)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Nota média</p>
                <p className="font-serif text-xl tabular-nums">{dec(data.media, 2)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Variantes</p>
                <p className="font-serif text-xl tabular-nums">{num(data.variantes?.length ?? 0)}</p>
              </div>
            </div>

            <div>
              <h4 className="mb-2 font-medium">Distribuição</h4>
              {!totalDist ? (
                <Vazio texto="Sem notas no período." />
              ) : (
                <div className="space-y-1.5">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const v = Number(dist[String(n)] ?? 0);
                    return (
                      <div key={n} className="flex items-center gap-2">
                        <span className="w-8 text-muted-foreground">{n}★</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded bg-muted">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${totalDist ? (v / totalDist) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="w-8 text-right tabular-nums">{num(v)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 font-medium">Caimento</h4>
              {!data.caimento?.respostas ? (
                <Vazio texto="Ninguém respondeu sobre o caimento ainda." />
              ) : (
                <BarraCaimento
                  pequeno={data.caimento.pequeno}
                  perfeito={data.caimento.perfeito}
                  grande={data.caimento.grande}
                />
              )}
            </div>

            {data.por_tamanho?.length ? (
              <div>
                <h4 className="mb-2 font-medium">Por tamanho</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tamanho</TableHead>
                      <TableHead className="text-right">Avaliações</TableHead>
                      <TableHead className="text-right">Nota</TableHead>
                      <TableHead className="text-right">Pequeno</TableHead>
                      <TableHead className="text-right">Grande</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.por_tamanho.map((t) => (
                      <TableRow key={t.tamanho}>
                        <TableCell>{t.tamanho}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(t.total)}</TableCell>
                        <TableCell className="text-right tabular-nums">{dec(t.media, 2)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(t.pequeno)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(t.grande)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {data.por_cor?.length ? (
              <div>
                <h4 className="mb-2 font-medium">Por cor</h4>
                <div className="flex flex-wrap gap-2">
                  {data.por_cor.map((c) => (
                    <Badge key={c.cor} variant="outline" className="font-normal">
                      {c.cor}: {dec(c.media, 2)} ({num(c.total)})
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {temas.length ? (
              <div>
                <h4 className="mb-2 font-medium">Temas</h4>
                <div className="flex flex-wrap gap-2">
                  {temas.map(([t, c]) => (
                    <Badge key={t} variant="secondary" className="font-normal">
                      {ROTULO_TEMA[t] ?? t}: {num(c)}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <h4 className="mb-2 font-medium">Comentários</h4>
              {!textos.length ? (
                <Vazio texto="Nenhum comentário escrito no período." />
              ) : (
                <div className="space-y-3">
                  {textos.map((t, i) => (
                    <div key={i} className="rounded-md border p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">{num(t.nota)}★</span>
                        {t.cor ? <span>{t.cor}</span> : null}
                        {t.tamanho ? <span>tam. {t.tamanho}</span> : null}
                        {t.caimento ? <span>caimento: {t.caimento}</span> : null}
                        <span>{dataCurta(t.em)}</span>
                        {t.ressalva ? (
                          <Badge variant="outline" className="border-amber-400 text-amber-700">
                            ressalva
                          </Badge>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{t.texto}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function BlocoProdutos({ dias }: { dias: number }) {
  const [ordem, setOrdem] = useState("piores");
  const [minimo, setMinimo] = useState(3);
  const [chave, setChave] = useState<string | null>(null);
  const [verSem, setVerSem] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["aval-insights-produtos", dias, minimo, ordem],
    queryFn: () => insightsProdutos(dias, minimo, ordem),
  });

  const produtos: ProdutoInsight[] = data?.produtos ?? [];
  const semAvaliacao = data?.sem_avaliacao ?? [];

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg">Produtos</h3>
          <p className="text-sm text-muted-foreground">
            Cada linha é uma família de cores. Clique para ver o detalhe.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Ordem</Label>
            <Select value={ordem} onValueChange={setOrdem}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDENS.map((o) => (
                  <SelectItem key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Mínimo de avaliações</Label>
            <Input
              type="number"
              min={1}
              value={minimo}
              className="h-9 w-28"
              onChange={(e) => setMinimo(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4">
          <Carregando altura="h-64" />
        </div>
      ) : !produtos.length ? (
        <Vazio texto="Ainda não há produtos com avaliações suficientes no período." />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Avaliações</TableHead>
                <TableHead className="text-right">Nota média</TableHead>
                <TableHead className="text-right">Variação</TableHead>
                <TableHead className="text-right">5 estrelas</TableHead>
                <TableHead className="text-right">Até 3 estrelas</TableHead>
                <TableHead className="text-right">Com texto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((p) => (
                <TableRow
                  key={p.chave}
                  className="cursor-pointer"
                  onClick={() => setChave(p.chave)}
                >
                  <TableCell className="font-medium">{p.rotulo}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(p.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{dec(p.media, 2)}</TableCell>
                  <TableCell className="text-right">
                    <Variacao valor={p.variacao} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{pct(p.pct_5)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(p.pct_ate_3)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(p.com_texto)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-4 border-t pt-3">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setVerSem((v) => !v)}
        >
          {verSem ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Produtos ativos sem nenhuma avaliação ({num(data?.sem_avaliacao_total ?? 0)})
        </button>
        {verSem ? (
          !semAvaliacao.length ? (
            <Vazio texto="Todos os produtos ativos já receberam alguma avaliação." />
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {semAvaliacao.map((s) => (
                <Badge key={s.chave} variant="outline" className="font-normal">
                  {s.rotulo} ({num(s.variantes)})
                </Badge>
              ))}
            </div>
          )
        ) : null}
      </div>

      <PainelProduto chave={chave} dias={dias} aberto={!!chave} aoFechar={() => setChave(null)} />
    </Card>
  );
}

/* ---------------- Bloco 4 ---------------- */

function BarraCaimento({
  pequeno,
  perfeito,
  grande,
}: {
  pequeno: number;
  perfeito: number;
  grande: number;
}) {
  const total = Number(pequeno) + Number(perfeito) + Number(grande);
  if (!total) return <Vazio texto="Sem respostas de caimento." />;
  const parte = (v: number) => `${(Number(v) / total) * 100}%`;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded bg-muted">
        <div className="bg-amber-500" style={{ width: parte(pequeno) }} />
        <div className="bg-emerald-600" style={{ width: parte(perfeito) }} />
        <div className="bg-sky-600" style={{ width: parte(grande) }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>Veste pequeno: {num(pequeno)}</span>
        <span>Perfeito: {num(perfeito)}</span>
        <span>Veste grande: {num(grande)}</span>
      </div>
    </div>
  );
}

function BlocoCaimento({ dias }: { dias: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["aval-insights-caimento", dias],
    queryFn: () => insightsCaimento(dias),
  });

  const porTamanho = data?.por_tamanho ?? [];
  const produtos = (data?.produtos ?? []).slice().sort((a, b) => {
    const peso = (x: string) => (x === "veste pequeno" || x === "veste grande" ? 0 : x === "ok" ? 1 : 2);
    return peso(a.alerta) - peso(b.alerta) || b.respostas - a.respostas;
  });

  return (
    <Card className="p-4">
      <h3 className="font-serif text-lg">Caimento e tamanho</h3>
      <p className="text-sm text-muted-foreground">
        Métrica interna do painel. Ela não aparece no site.
      </p>

      {isLoading ? (
        <div className="mt-4">
          <Carregando altura="h-64" />
        </div>
      ) : !data?.respostas_total ? (
        <Vazio texto="Ainda não há respostas de caimento suficientes no período." />
      ) : (
        <div className="mt-4 space-y-6">
          <BarraCaimento
            pequeno={data.geral?.pequeno ?? 0}
            perfeito={data.geral?.perfeito ?? 0}
            grande={data.geral?.grande ?? 0}
          />

          <div>
            <h4 className="mb-2 font-medium">Por tamanho</h4>
            {!porTamanho.length ? (
              <Vazio texto="Sem respostas por tamanho no período." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tamanho</TableHead>
                      <TableHead className="text-right">Respostas</TableHead>
                      <TableHead className="text-right">Veste pequeno</TableHead>
                      <TableHead className="text-right">Perfeito</TableHead>
                      <TableHead className="text-right">Veste grande</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {porTamanho.map((t) => (
                      <TableRow key={t.tamanho}>
                        <TableCell>{t.tamanho}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(t.respostas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(t.pequeno)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(t.perfeito)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(t.grande)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 font-medium">Produtos com alerta</h4>
            {!produtos.length ? (
              <Vazio texto="Nenhum produto com alerta de caimento no período." />
            ) : (
              <div className="space-y-2">
                {produtos.map((p) => (
                  <div
                    key={p.chave}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.rotulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {num(p.respostas)} respostas · pequeno {pct(p.pct_pequeno)} · perfeito{" "}
                        {pct(p.pct_perfeito)} · grande {pct(p.pct_grande)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.alerta === "veste pequeno" || p.alerta === "veste grande" ? (
                        <Badge variant="outline" className="border-amber-400 text-amber-700">
                          {p.alerta}
                        </Badge>
                      ) : p.alerta === "ok" ? (
                        <Badge variant="outline">ok</Badge>
                      ) : null}
                      {!p.amostra_ok ? <Badge variant="secondary">amostra pequena</Badge> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Bloco 5 ---------------- */

function BlocoTemas({ dias }: { dias: number }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["aval-insights-temas", dias],
    queryFn: () => insightsTemas(dias),
  });

  const temas = (data?.temas ?? []).slice().sort((a, b) => b.mencoes - a.mencoes);

  return (
    <Card className="p-4">
      <h3 className="font-serif text-lg">Temas dos comentários</h3>
      <p className="text-sm text-muted-foreground">
        Ressalva é quando o texto traz uma queixa mesmo com nota alta.
      </p>

      {isLoading ? (
        <div className="mt-4">
          <Carregando altura="h-48" />
        </div>
      ) : !temas.length ? (
        <Vazio texto="Ainda não há comentários suficientes no período." />
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {temas.map((t) => {
            const expandido = aberto === t.tema;
            return (
              <button
                key={t.tema}
                type="button"
                onClick={() => setAberto(expandido ? null : t.tema)}
                className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{ROTULO_TEMA[t.tema] ?? t.tema}</p>
                  {expandido ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <p className="mt-1 font-serif text-2xl tabular-nums">{num(t.mencoes)}</p>
                <p className="text-xs text-muted-foreground">
                  {pct(t.pct)} dos textos · nota média {dec(t.media, 2)}
                </p>
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Ressalva: </span>
                  <span className="font-medium text-amber-700">{pct(t.pct_ressalva)}</span>
                </p>

                {expandido ? (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {!t.exemplos?.length ? (
                      <p className="text-xs text-muted-foreground">Sem exemplos neste tema.</p>
                    ) : (
                      t.exemplos.map((e, i) => (
                        <div key={i} className="rounded-md bg-muted/50 p-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="tabular-nums">{num(e.nota)}★</span>
                            {e.produto ? <span className="truncate">{e.produto}</span> : null}
                            <span>{dataCurta(e.em)}</span>
                            {e.ressalva ? (
                              <Badge variant="outline" className="border-amber-400 text-amber-700">
                                ressalva
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm">{e.texto}</p>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ---------------- Aba ---------------- */

export function InsightsTab() {
  const [dias, setDias] = useState(90);
  const { data: resumo } = useQuery({
    queryKey: ["aval-insights-resumo", dias],
    queryFn: () => insightsResumo(dias),
  });

  return (
    <div className="space-y-5 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {PERIODOS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={dias === d ? "default" : "outline"}
              onClick={() => setDias(d)}
            >
              {d} dias
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Atualizado em {dataHora(resumo?.gerado_em)}
        </p>
      </div>

      <BlocoVisaoGeral dias={dias} />
      <BlocoEvolucao dias={dias} />
      <BlocoProdutos dias={dias} />
      <BlocoCaimento dias={dias} />
      <BlocoTemas dias={dias} />
    </div>
  );
}
