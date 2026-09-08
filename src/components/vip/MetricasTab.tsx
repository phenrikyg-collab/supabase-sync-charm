import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { brl, dataCurta, num, pctBr } from "@/lib/financeiroFormat";
import { CORES_INTENCAO, copiar, vipEnqueteResultado, vipMetricasGrupos, vipMetricasPeriodo } from "@/lib/vip";

type Preset = "7" | "30" | "90" | "mes" | "custom";

const CHAVE = "vip_metricas_periodo";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function faixaDoPreset(preset: Preset, ini: string, fim: string) {
  const hoje = new Date();
  if (preset === "custom") return { inicio: ini, fim };
  if (preset === "mes") {
    const p = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { inicio: iso(p), fim: iso(hoje) };
  }
  const dias = Number(preset);
  const p = new Date(hoje);
  p.setDate(p.getDate() - (dias - 1));
  return { inicio: iso(p), fim: iso(hoje) };
}

const PRESETS: Array<[Preset, string]> = [
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["90", "90 dias"],
  ["mes", "Mês atual"],
  ["custom", "Personalizado"],
];

export function MetricasTab() {
  const salvo = (() => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    } catch {
      return null;
    }
  })();

  const [preset, setPreset] = useState<Preset>(salvo?.preset ?? "30");
  const [ini, setIni] = useState<string>(salvo?.inicio ?? iso(new Date()));
  const [fim, setFim] = useState<string>(salvo?.fim ?? iso(new Date()));
  const [dados, setDados] = useState<any>(null);
  const [grupos, setGrupos] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [enquetes, setEnquetes] = useState<Record<string, any>>({});

  const faixa = useMemo(() => faixaDoPreset(preset, ini, fim), [preset, ini, fim]);

  useEffect(() => {
    localStorage.setItem(CHAVE, JSON.stringify({ preset, inicio: ini, fim }));
  }, [preset, ini, fim]);

  useEffect(() => {
    if (!faixa.inicio || !faixa.fim) return;
    setCarregando(true);
    vipMetricasPeriodo(faixa.inicio, faixa.fim)
      .then((d) => setDados(d))
      .catch((e) => toast.error(e.message))
      .finally(() => setCarregando(false));
    vipMetricasGrupos(faixa.inicio, faixa.fim)
      .then((g) => setGrupos(g))
      .catch(() => setGrupos(null));
  }, [faixa.inicio, faixa.fim]);


  const linhas: any[] = useMemo(
    () => (Array.isArray(dados) ? dados : (dados?.mensagens ?? dados?.linhas ?? [])),
    [dados],
  );
  const resumo = Array.isArray(dados) ? null : (dados?.resumo ?? null);
  const avisos: string[] = Array.isArray(resumo?.avisos) ? resumo.avisos : [];

  const distribuicao: Array<[string, number]> = useMemo(() => {
    const d = resumo?.distribuicao_intencao ?? resumo?.distribuicao ?? null;
    if (!d) return [];
    return Object.entries(d).map(([k, v]) => [k, Number(v ?? 0)] as [string, number]).sort((a, b) => b[1] - a[1]);
  }, [resumo]);

  const pctOferta = Number(resumo?.pct_oferta ?? 0);
  const pctSemIntencao = Number(resumo?.pct_sem_intencao ?? 0);

  const abrir = useCallback(
    async (l: any) => {
      const key = l.mensagem_id ?? l.id;
      setExpandida(expandida === key ? null : key);
      if (l.enquete && !enquetes[key]) {
        try {
          const r = await vipEnqueteResultado(key);
          setEnquetes((e) => ({ ...e, [key]: r }));
        } catch {
          /* ignora */
        }
      }
    },
    [expandida, enquetes],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(([p, rotulo]) => (
          <Button key={p} size="sm" variant={preset === p ? "default" : "outline"} onClick={() => setPreset(p)}>
            {rotulo}
          </Button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="w-40" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-40" />
          </div>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {dataCurta(faixa.inicio)} – {dataCurta(faixa.fim)}
        </span>
      </div>

      {carregando && <Skeleton className="h-40" />}

      {resumo && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <Metrica titulo="Pessoas" valor={num(resumo.pessoas_unicas ?? 0)} />
            <Metrica
              titulo="Impressões"
              valor={num(resumo.impressoes ?? 0)}
              rodape={`${num(resumo.frequencia ?? 0, 1)} mensagens por pessoa`}
            />
            <Metrica titulo="Cliques" valor={num(resumo.cliques ?? 0)} />
            <Metrica
              titulo="Pessoas que clicaram"
              valor={num(resumo.visitantes ?? 0)}
              rodape={`${num(resumo.cobertura_cookie_pct ?? 0, 0)}% por cookie, o resto estimado`}
            />
            <Metrica titulo="CTR" valor={pctBr(resumo.ctr_pct ?? 0, 2)} />
            <Metrica titulo="Pedidos" valor={num(resumo.pedidos ?? 0)} />
            <Metrica
              titulo="Receita influenciada pelo VIP"
              valor={brl(resumo.receita ?? 0)}
              rodape={`piso: só quem clicou no link e comprou no mesmo navegador${
                resumo.receita_originada != null || resumo.vip_aquisicao != null
                  ? ` · receita originada (primeiro toque): ${brl(resumo.receita_originada ?? resumo.vip_aquisicao ?? 0)}`
                  : ""
              }`}
            />
            <Metrica titulo="Conversão por visitante" valor={pctBr(resumo.conv_por_visitante_pct ?? 0, 2)} />

          </div>

          {avisos.length > 0 && (
            <div className="rounded-lg border border-muted bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> Avisos
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {avisos.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {distribuicao.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribuição de conteúdo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <span className={pctOferta > 25 ? "font-semibold text-destructive" : "font-semibold"}>
                      {pctBr(pctOferta, 0)} de oferta
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">limite saudável 25%</span>
                  </div>
                  <div>
                    <span className="font-semibold text-amber-600">{pctBr(pctSemIntencao, 0)} sem classificação</span>
                    <span className="ml-2 text-xs text-muted-foreground">mensagens avulsas sem intenção</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {distribuicao.map(([k, v]) => {
                    const max = Math.max(...distribuicao.map((x) => x[1]), 1);
                    return (
                      <div key={k}>
                        <div className="flex justify-between text-xs">
                          <span>{k}</span>
                          <span className="tabular-nums">{num(v)}</span>
                        </div>
                        <Progress value={(v / max) * 100} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <TabelaGrupos dados={grupos} />



      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Data</TableHead>
                <TableHead>Calendário</TableHead>
                <TableHead>Intenção</TableHead>
                <TableHead>Headline</TableHead>
                <TableHead className="text-right">Impressões</TableHead>
                <TableHead className="text-right">Cliques / Votantes</TableHead>
                <TableHead className="text-right">CTR / Resposta</TableHead>
                <TableHead className="text-right">Sessões</TableHead>
                <TableHead className="text-right">Add to cart</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Conversão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => {
                const key = l.mensagem_id ?? l.id;
                const ehEnquete = !!l.enquete;
                const res = enquetes[key];
                const cliquesGrupo: any[] = l.cliques_por_grupo ?? [];
                return (
                  <>
                    <TableRow key={key} className="cursor-pointer" onClick={() => abrir(l)}>
                      <TableCell>
                        {expandida === key ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{dataCurta(l.data_envio)}</TableCell>
                      <TableCell className="max-w-[10rem] truncate text-xs text-muted-foreground">
                        {l.calendario_titulo ?? l.calendario ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={CORES_INTENCAO[l.intencao ?? ""] ?? ""}>
                          {l.intencao ?? "sem intenção"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{l.headline}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(l.impressoes ?? l.alcance ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ehEnquete ? num(l.votantes ?? 0) : num(l.cliques ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ehEnquete ? pctBr(l.taxa_resposta_pct ?? 0, 2) : pctBr(l.ctr_pct ?? 0, 2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{num(l.sessoes ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(l.add_to_cart ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(l.pedidos ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(l.receita ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pctBr(l.conv_por_visitante_pct ?? l.conversao_pct ?? 0, 2)}
                      </TableCell>
                    </TableRow>
                    {expandida === key && (
                      <TableRow key={`${key}-exp`}>
                        <TableCell colSpan={13} className="bg-muted/30">
                          <div className="grid gap-6 p-2 md:grid-cols-2">
                            <div>
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide">Cliques por grupo</div>
                              {cliquesGrupo.length === 0 && (
                                <p className="text-xs text-muted-foreground">Sem cliques registrados.</p>
                              )}
                              {cliquesGrupo.map((g: any, i: number) => {
                                const max = Math.max(...cliquesGrupo.map((x: any) => Number(x.cliques ?? 0)), 1);
                                return (
                                  <div key={i} className="mb-2">
                                    <div className="flex justify-between text-xs">
                                      <span>{g.grupo_nome ?? g.nome}</span>
                                      <span className="tabular-nums">{num(g.cliques ?? 0)}</span>
                                    </div>
                                    <Progress value={(Number(g.cliques ?? 0) / max) * 100} className="h-1.5" />
                                  </div>
                                );
                              })}
                            </div>
                            {ehEnquete && (
                              <div>
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-xs font-semibold uppercase tracking-wide">Resultado da enquete</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const txt = [
                                        res?.pergunta ?? "",
                                        ...(res?.votos ?? []).map((v: any) => `${v.opcao}: ${v.votos} voto(s)`),
                                      ].join("\n");
                                      copiar(txt).then(() => toast.success("Resultado copiado"));
                                    }}
                                  >
                                    <Copy className="mr-1 h-3.5 w-3.5" /> Copiar resultado
                                  </Button>
                                </div>
                                <p className="mb-2 text-sm">{res?.pergunta}</p>
                                <p className="mb-2 text-xs text-muted-foreground">{num(res?.votantes ?? 0)} votantes</p>
                                {(res?.votos ?? []).map((v: any, i: number) => {
                                  const total = Math.max(
                                    (res?.votos ?? []).reduce((s: number, x: any) => s + Number(x.votos ?? 0), 0),
                                    1,
                                  );
                                  return (
                                    <div key={i} className="mb-2">
                                      <div className="flex justify-between text-xs">
                                        <span>{v.opcao}</span>
                                        <span className="tabular-nums">{num(v.votos ?? 0)}</span>
                                      </div>
                                      <Progress value={(Number(v.votos ?? 0) / total) * 100} className="h-1.5" />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Um mesmo pedido aparece em todas as mensagens que participaram da venda, então a soma das colunas Pedidos e
        Receita é maior que o total do período. Os cards acima contam cada pedido uma única vez.
      </p>
    </div>
  );
}

function Metrica({ titulo, valor, rodape }: { titulo: string; valor: string; rodape?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{valor}</div>
        {rodape && <p className="mt-1 text-[11px] text-muted-foreground">{rodape}</p>}
      </CardContent>
    </Card>
  );
}

function TabelaGrupos({ dados }: { dados: any }) {
  const linhas: any[] = Array.isArray(dados?.grupos) ? dados.grupos : Array.isArray(dados) ? dados : [];
  if (linhas.length === 0) return null;

  const rpm = (g: any) =>
    Number(g.receita_por_membro ?? (Number(g.membros ?? 0) > 0 ? Number(g.receita ?? 0) / Number(g.membros) : 0));
  const ordenadas = [...linhas].sort((a, b) => rpm(b) - rpm(a));
  const ultimo = ordenadas.length - 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Por grupo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-0 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead className="text-right">Membros</TableHead>
              <TableHead className="text-right">Mensagens</TableHead>
              <TableHead className="text-right">Cliques</TableHead>
              <TableHead className="text-right">Pessoas</TableHead>
              <TableHead className="text-right">% que clicou</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Receita por membro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenadas.map((g, i) => {
              const semReceita = Number(g.receita ?? 0) === 0;
              const destaque =
                i === 0 ? "bg-primary/10 font-medium" : i === ultimo && ordenadas.length > 1 ? "bg-muted/50" : "";
              return (
                <TableRow key={g.grupo_id ?? g.id ?? g.nome ?? i} className={destaque}>
                  <TableCell className={semReceita ? "text-muted-foreground" : ""}>
                    {g.nome ?? g.grupo_nome ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(g.membros ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(g.mensagens ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(g.cliques ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(g.pessoas ?? g.visitantes ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {pctBr(g.pct_clicou ?? g.pct_que_clicou ?? g.ctr_pct ?? 0, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(g.pedidos ?? 0)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${semReceita ? "text-muted-foreground" : ""}`}>
                    {brl(g.receita ?? 0)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${semReceita ? "text-muted-foreground" : ""}`}>
                    {brl(rpm(g))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="space-y-1 px-6 text-xs text-muted-foreground">
          <p>
            {dados?.nota_soma ??
              "A soma das linhas é maior que o total do canal: quem clicou no link de dois grupos aparece nos dois."}{" "}
            No período o canal fez {num(dados?.pedidos_no_canal ?? 0)} pedidos e {brl(dados?.receita_no_canal ?? 0)},
            contando cada pedido uma única vez.
          </p>
          {dados?.nota_atribuicao && <p>{dados.nota_atribuicao}</p>}
          <p>
            Estes valores são um piso: só enxergamos quem clicou no link e comprou no mesmo navegador. Quem lê no
            celular e compra no computador não entra na conta.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
