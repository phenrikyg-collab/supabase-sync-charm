import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { brl, dataCurta, num, pctBr } from "@/lib/financeiroFormat";
import {
  CORES_INTENCAO,
  copiar,
  vipCalendariosListar,
  vipEnqueteResultado,
  vipMetricas,
  type VipCalendarioResumo,
} from "@/lib/vip";

export function MetricasTab() {
  const [lista, setLista] = useState<VipCalendarioResumo[]>([]);
  const [id, setId] = useState("");
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [enquetes, setEnquetes] = useState<Record<string, any>>({});

  useEffect(() => {
    vipCalendariosListar()
      .then((l) => {
        setLista(l ?? []);
        if (l?.length) setId(l[0].id);
      })
      .catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    if (!id) return;
    setCarregando(true);
    vipMetricas(id)
      .then(setDados)
      .catch((e) => toast.error(e.message))
      .finally(() => setCarregando(false));
  }, [id]);

  const linhas: any[] = useMemo(
    () => (Array.isArray(dados) ? dados : (dados?.mensagens ?? dados?.linhas ?? [])),
    [dados],
  );
  const resumo = Array.isArray(dados) ? null : (dados?.resumo ?? null);

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
      <Select value={id} onValueChange={setId}>
        <SelectTrigger className="w-80">
          <SelectValue placeholder="Escolha um calendário" />
        </SelectTrigger>
        <SelectContent>
          {lista.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.titulo ?? "Sem título"} · {dataCurta(c.periodo_inicio)}–{dataCurta(c.periodo_fim)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {carregando && <Skeleton className="h-40" />}

      {resumo && (
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ["Alcance", num(resumo.alcance ?? 0)],
            ["Cliques", num(resumo.cliques ?? 0)],
            ["CTR", pctBr(resumo.ctr_pct ?? 0, 2)],
            ["Pedidos", num(resumo.pedidos ?? 0)],
            ["Receita", brl(resumo.receita ?? 0)],
            ["Conversão", pctBr(resumo.conversao_pct ?? 0, 2)],
          ].map(([t, v]) => (
            <Card key={t as string}>
              <CardHeader className="pb-1">
                <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">{t}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{v}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Data</TableHead>
                <TableHead>Intenção</TableHead>
                <TableHead>Headline</TableHead>
                <TableHead className="text-right">Alcance</TableHead>
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
                      <TableCell>
                        <Badge variant="outline" className={CORES_INTENCAO[l.intencao ?? ""] ?? ""}>{l.intencao}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{l.headline}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(l.alcance ?? 0)}</TableCell>
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
                      <TableCell className="text-right tabular-nums">{pctBr(l.conversao_pct ?? 0, 2)}</TableCell>
                    </TableRow>
                    {expandida === key && (
                      <TableRow key={`${key}-exp`}>
                        <TableCell colSpan={12} className="bg-muted/30">
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
                                        ...(res?.votos ?? []).map(
                                          (v: any) => `${v.opcao}: ${v.votos} voto(s)`,
                                        ),
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
    </div>
  );
}
