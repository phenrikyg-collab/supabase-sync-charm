import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * SEO & Blog — leitura pura de `fn_seo_blog_painel`.
 * Os números já vêm calculados do banco: aqui só formatamos.
 */

type Resumo = {
  impressoes?: number; cliques?: number; ctr?: number;
  impressoes_marca?: number; impressoes_sem_marca?: number;
  cliques_sem_marca?: number; peso_da_marca_pct?: number;
};
type Post = {
  slug?: string; titulo?: string; url?: string; categoria?: string; palavras?: number;
  produtos_linkados?: number; perguntas_faq?: number; publicado_em?: string;
  impressoes?: number; cliques?: number; posicao?: number;
  indexacao?: string; indexacao_em?: string;
};
type Pauta = {
  titulo?: string; keyword?: string; intencao?: string; score?: number;
  categoria?: string; dado_proprietario?: string; status?: string;
};
type Indexacao = {
  indexnow_ativo?: boolean; ultimo_envio_indexnow?: string; ultima_inspecao?: string;
  gsc_ultimo_sync?: string; gsc_ultimo_erro?: string | null;
};
type ProblemaProduto = { problema?: string; produtos?: number; ativos?: number; impressoes?: number };
type PrioridadeProduto = {
  produto_id?: string | number; nome?: string; url?: string; estoque?: number;
  impressoes?: number; problemas?: string[];
};
type AlteracaoProduto = { produto_id?: string | number; campo?: string; origem?: string; aplicado_em?: string };
type Query = { query?: string; impressoes?: number; cliques?: number; posicao?: number; marca?: boolean };
type Oportunidade = { query?: string; caminho?: string; impressoes?: number; cliques?: number; posicao?: number };

type Painel = {
  gerado_em?: string;
  janela_dias?: number;
  resumo?: Resumo;
  blog?: { posts_publicados?: number; posts?: Post[]; pautas_na_fila?: Pauta[] };
  indexacao?: Indexacao;
  produtos?: {
    ativos?: number; sem_defeito?: number; auditado_em?: string;
    problemas?: ProblemaProduto[]; prioridades?: PrioridadeProduto[];
    alteracoes_recentes?: AlteracaoProduto[];
  };
  buscas?: { top_queries?: Query[]; oportunidades?: Oportunidade[] };
};

const int = (v?: number | null) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR").format(Number(v));

const dec = (v?: number | null, casas = 1) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(Number(v));

const pct = (v?: number | null, casas = 2) => (v == null ? "—" : `${dec(v, casas)}%`);

function dataBR(v?: string | null, comHora = true) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    ...(comHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

const ROTULO_PROBLEMA: Record<string, string> = {
  title_longo: "Título acima de 60 caracteres",
  sem_title: "Sem título SEO",
  meta_description_longa: "Meta description acima de 160",
  meta_description_curta: "Meta description abaixo de 70",
  sem_meta_description: "Sem meta description",
  sem_keywords: "Sem palavras-chave",
  sem_h2: "Sem subtítulo H2 na descrição",
  h1_duplicado: "H1 duplicado",
  descricao_curta: "Descrição curta",
  img_sem_alt: "Imagem sem texto alternativo",
  title_curto: "Título curto",
  meta_description_automatica: "Meta description automática",
};
const rotuloProblema = (p?: string) => (p ? ROTULO_PROBLEMA[p] ?? p : "—");

/** Cor do badge de indexação vem do próprio texto devolvido pelo banco. */
function corIndexacao(txt?: string) {
  const t = (txt ?? "").toLowerCase();
  if (t.includes("indexada")) return "bg-success/10 text-success border-success/20";
  if (t.includes("detectada")) return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{texto}</p>;
}

export default function SeoBlog() {
  const [dias, setDias] = useState("30");
  const [esconderMarca, setEsconderMarca] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["seo-blog-painel", dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_seo_blog_painel" as any, { dias: Number(dias) });
      if (error) throw error;
      return (data ?? {}) as Painel;
    },
  });

  const resumo = data?.resumo ?? {};
  const posts = data?.blog?.posts ?? [];
  const pautas = useMemo(
    () => [...(data?.blog?.pautas_na_fila ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [data],
  );
  const idx = data?.indexacao ?? {};
  const prod = data?.produtos ?? {};
  const problemas = useMemo(
    () => [...(prod.problemas ?? [])].sort((a, b) => (b.impressoes ?? 0) - (a.impressoes ?? 0)),
    [prod.problemas],
  );
  const queries = data?.buscas?.top_queries ?? [];
  const queriesVisiveis = esconderMarca ? queries.filter((q) => !q.marca) : queries;
  const oportunidades = data?.buscas?.oportunidades ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-tight">SEO &amp; Blog</h1>
          <p className="text-sm text-muted-foreground">
            Busca orgânica, blog, saúde de SEO dos produtos e o que as pessoas pesquisam.
            {data?.gerado_em && ` Atualizado em ${dataBR(data.gerado_em)}.`}
          </p>
        </div>
        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="border-danger/30">
          <CardContent className="p-4 flex items-start gap-2 text-sm text-danger">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Falha ao carregar o painel de SEO: {(error as any)?.message ?? "erro desconhecido"}</span>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <Tabs defaultValue="visao">
          <TabsList>
            <TabsTrigger value="visao">Visão geral</TabsTrigger>
            <TabsTrigger value="blog">Blog</TabsTrigger>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="buscas">Buscas</TabsTrigger>
          </TabsList>

          {/* ===== Visão geral ===== */}
          <TabsContent value="visao" className="space-y-6 mt-6">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Impressões" value={int(resumo.impressoes)} />
              <StatCard title="Cliques" value={int(resumo.cliques)} />
              <StatCard title="CTR" value={pct(resumo.ctr)} />
              <StatCard
                title="Impressões sem marca"
                value={int(resumo.impressoes_sem_marca)}
                subtitle={`${int(resumo.cliques_sem_marca)} cliques · busca de quem ainda não conhece a marca`}
                variant="primary"
              />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Peso da marca</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{pct(resumo.peso_da_marca_pct, 1)} das impressões são busca de marca</span>
                  <span className="text-muted-foreground">
                    {int(resumo.impressoes_marca)} de marca · {int(resumo.impressoes_sem_marca)} sem marca
                  </span>
                </div>
                <Progress value={Math.min(100, Math.max(0, Number(resumo.peso_da_marca_pct ?? 0)))} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Automação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">IndexNow:</span>
                  <Badge
                    variant="outline"
                    className={idx.indexnow_ativo
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-muted text-muted-foreground border-border"}
                  >
                    {idx.indexnow_ativo ? "ativo" : "desligado"}
                  </Badge>
                  <span className="text-muted-foreground">
                    último envio em {dataBR(idx.ultimo_envio_indexnow)}
                  </span>
                </div>
                <p>
                  <span className="text-muted-foreground">Última inspeção no Google: </span>
                  {dataBR(idx.ultima_inspecao)}
                </p>
                <p>
                  <span className="text-muted-foreground">Último sync do Search Console: </span>
                  {dataBR(idx.gsc_ultimo_sync)}
                </p>
                {idx.gsc_ultimo_erro && (
                  <p className="text-danger font-medium flex items-start gap-1.5">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    {idx.gsc_ultimo_erro}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Blog ===== */}
          <TabsContent value="blog" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Posts publicados ({int(data?.blog?.posts_publicados)})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {posts.length === 0 ? (
                  <Vazio texto="Nenhum post publicado ainda." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Publicado em</TableHead>
                        <TableHead className="text-right">Palavras</TableHead>
                        <TableHead className="text-right">Produtos</TableHead>
                        <TableHead className="text-right">FAQ</TableHead>
                        <TableHead className="text-right">Impressões</TableHead>
                        <TableHead className="text-right">Cliques</TableHead>
                        <TableHead className="text-right">Posição</TableHead>
                        <TableHead>Indexação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {posts.map((p) => (
                        <TableRow key={p.slug ?? p.titulo}>
                          <TableCell className="max-w-[280px]">
                            {p.url ? (
                              <a href={p.url} target="_blank" rel="noreferrer" className="underline text-primary">
                                {p.titulo ?? p.slug}
                              </a>
                            ) : (
                              p.titulo ?? p.slug
                            )}
                            {p.categoria && (
                              <span className="block text-[11px] text-muted-foreground">{p.categoria}</span>
                            )}
                          </TableCell>
                          <TableCell>{dataBR(p.publicado_em, false)}</TableCell>
                          <TableCell className="text-right">{int(p.palavras)}</TableCell>
                          <TableCell className="text-right">{int(p.produtos_linkados)}</TableCell>
                          <TableCell className="text-right">{int(p.perguntas_faq)}</TableCell>
                          <TableCell className="text-right">{int(p.impressoes)}</TableCell>
                          <TableCell className="text-right">{int(p.cliques)}</TableCell>
                          <TableCell className="text-right">{dec(p.posicao)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={corIndexacao(p.indexacao)}>
                              {p.indexacao ?? "—"}
                            </Badge>
                            {p.indexacao_em && (
                              <span className="block text-[10px] text-muted-foreground mt-0.5">
                                {dataBR(p.indexacao_em, false)}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pautas na fila</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {pautas.length === 0 ? (
                  <Vazio texto="Nenhuma pauta na fila." />
                ) : (
                  <TooltipProvider>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Palavra-chave</TableHead>
                          <TableHead>Intenção</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pautas.map((p, i) => (
                          <TableRow key={`${p.titulo}-${i}`}>
                            <TableCell className="max-w-[300px]">
                              {p.dado_proprietario ? (
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <span className="underline decoration-dotted cursor-help">{p.titulo}</span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[320px]">{p.dado_proprietario}</TooltipContent>
                                </UITooltip>
                              ) : (
                                p.titulo
                              )}
                            </TableCell>
                            <TableCell>{p.keyword ?? "—"}</TableCell>
                            <TableCell>
                              {p.intencao ? <Badge variant="secondary">{p.intencao}</Badge> : "—"}
                            </TableCell>
                            <TableCell>{p.categoria ?? "—"}</TableCell>
                            <TableCell>{p.status ?? "—"}</TableCell>
                            <TableCell className="text-right font-medium">{dec(p.score, 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TooltipProvider>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Produtos ===== */}
          <TabsContent value="produtos" className="space-y-6 mt-6">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard title="Produtos ativos" value={int(prod.ativos)} />
              <StatCard
                title="Sem nenhum defeito"
                value={int(prod.sem_defeito)}
                subtitle={prod.auditado_em ? `auditado em ${dataBR(prod.auditado_em)}` : undefined}
                variant="success"
              />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Problemas encontrados</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {problemas.length === 0 ? (
                  <Vazio texto="Nenhum problema de SEO nos produtos." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Problema</TableHead>
                        <TableHead className="text-right">Produtos</TableHead>
                        <TableHead className="text-right">Ativos</TableHead>
                        <TableHead className="text-right">Impressões</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {problemas.map((p, i) => (
                        <TableRow key={`${p.problema}-${i}`}>
                          <TableCell>{rotuloProblema(p.problema)}</TableCell>
                          <TableCell className="text-right">{int(p.produtos)}</TableCell>
                          <TableCell className="text-right">{int(p.ativos)}</TableCell>
                          <TableCell className="text-right">{int(p.impressoes)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Prioridades</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Produtos ativos com defeito que mais recebem impressão — arrumar aqui vale mais.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {(prod.prioridades ?? []).length === 0 ? (
                  <Vazio texto="Nenhum produto prioritário." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Estoque</TableHead>
                        <TableHead className="text-right">Impressões</TableHead>
                        <TableHead>Problemas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(prod.prioridades ?? []).map((p, i) => (
                        <TableRow key={`${p.produto_id ?? p.nome}-${i}`}>
                          <TableCell className="max-w-[280px]">
                            {p.url ? (
                              <a href={p.url} target="_blank" rel="noreferrer" className="underline text-primary">
                                {p.nome}
                              </a>
                            ) : (
                              p.nome ?? "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">{int(p.estoque)}</TableCell>
                          <TableCell className="text-right">{int(p.impressoes)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(p.problemas ?? []).map((pr) => (
                                <Badge key={pr} variant="outline" className="text-[10px]">
                                  {rotuloProblema(pr)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Alterações recentes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(prod.alteracoes_recentes ?? []).length === 0 ? (
                  <Vazio texto="Nenhuma alteração recente." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Campo</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Quando</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(prod.alteracoes_recentes ?? []).map((a, i) => (
                        <TableRow key={`${a.produto_id}-${a.campo}-${i}`}>
                          <TableCell>{a.produto_id ?? "—"}</TableCell>
                          <TableCell>{a.campo ?? "—"}</TableCell>
                          <TableCell>{a.origem ?? "—"}</TableCell>
                          <TableCell>{dataBR(a.aplicado_em)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Buscas ===== */}
          <TabsContent value="buscas" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="text-base">Top buscas</CardTitle>
                <div className="flex items-center gap-2">
                  <Switch id="sem-marca" checked={esconderMarca} onCheckedChange={setEsconderMarca} />
                  <Label htmlFor="sem-marca" className="text-xs">Esconder buscas de marca</Label>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {queriesVisiveis.length === 0 ? (
                  <Vazio texto="Nenhuma busca no período." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Busca</TableHead>
                        <TableHead className="text-right">Impressões</TableHead>
                        <TableHead className="text-right">Cliques</TableHead>
                        <TableHead className="text-right">Posição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queriesVisiveis.map((q, i) => (
                        <TableRow key={`${q.query}-${i}`}>
                          <TableCell>
                            {q.query}
                            {q.marca && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">marca</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{int(q.impressoes)}</TableCell>
                          <TableCell className="text-right">{int(q.cliques)}</TableCell>
                          <TableCell className="text-right">{dec(q.posicao)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Oportunidades</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Já aparecemos, mas ninguém clica. Geralmente é título ou descrição que não conversa com o
                  que a pessoa buscou.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {oportunidades.length === 0 ? (
                  <Vazio texto="Nenhuma oportunidade no período." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Busca</TableHead>
                        <TableHead>Página</TableHead>
                        <TableHead className="text-right">Impressões</TableHead>
                        <TableHead className="text-right">Posição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {oportunidades.map((o, i) => (
                        <TableRow key={`${o.query}-${i}`}>
                          <TableCell>{o.query}</TableCell>
                          <TableCell className="max-w-[280px] truncate" title={o.caminho ?? ""}>
                            {o.caminho ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">{int(o.impressoes)}</TableCell>
                          <TableCell className="text-right">{dec(o.posicao)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
