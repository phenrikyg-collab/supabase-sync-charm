import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { dataBR, num, pct, pick } from "@/lib/coortes";

const PERIODOS = [7, 14, 30];

const n = (v: unknown) => Number(v ?? 0);

const csvEscape = (v: unknown) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const badgeSituacao = (situacao: string) => {
  const s = situacao.toLowerCase();
  if (s.includes("sem estoque"))
    return "border-destructive/40 bg-destructive/10 text-destructive";
  if (s.includes("quase")) return "border-orange-300 bg-orange-50 text-orange-700";
  if (s.includes("parcial")) return "border-amber-300 bg-amber-50 text-amber-700";
  return "";
};

export default function OportunidadesSeo() {
  const [dias, setDias] = useState(30);
  const [minImpressoes, setMinImpressoes] = useState(20);
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase.rpc("oportunidades_seo_sem_estoque", {
      p_dias: dias,
      p_classes_abc: ["A"],
      p_min_impressoes: minImpressoes,
    } as any);
    if (error) {
      setErro(error.message || "Falha ao carregar as oportunidades de SEO");
      setDados(null);
    } else {
      setDados(data ?? null);
    }
    setLoading(false);
  }, [dias, minImpressoes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const resumo = dados?.resumo ?? null;
  const cobertura = dados?.cobertura_gsc ?? null;
  const linhas: any[] = Array.isArray(dados?.produtos)
    ? dados.produtos
    : Array.isArray(dados?.linhas)
      ? dados.linhas
      : [];

  const ctrAgregado = useMemo(() => {
    const imp = n(pick(resumo, "impressoes_perdidas", "impressoes"));
    const cli = n(pick(resumo, "cliques_no_periodo", "cliques"));
    return imp > 0 ? (cli / imp) * 100 : 0;
  }, [resumo]);

  const coberturaInsuficiente = useMemo(() => {
    const primeiro = pick<string>(cobertura, "primeiro_dia");
    if (!primeiro) return false;
    const inicio = new Date(String(primeiro).slice(0, 10));
    const diasCobertos = Math.floor(
      (Date.now() - inicio.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diasCobertos < dias;
  }, [cobertura, dias]);

  const exportarCsv = () => {
    const cab = [
      "produto",
      "produto_id",
      "slug",
      "situacao",
      "impressoes",
      "posicao_media",
      "ctr",
      "estoque",
      "tamanhos_zerados",
      "tamanhos_na_grade",
      "dias_sem_venda",
      "score",
    ];
    const csv = [
      cab.join(";"),
      ...linhas.map((l) =>
        [
          pick(l, "produto", "nome"),
          pick(l, "produto_id", "id"),
          pick(l, "slug"),
          pick(l, "situacao", "situacao_rotulo"),
          pick(l, "impressoes"),
          pick(l, "posicao_media"),
          pick(l, "ctr"),
          pick(l, "estoque"),
          pick(l, "tamanhos_zerados"),
          pick(l, "tamanhos_na_grade"),
          pick(l, "dias_sem_venda"),
          pick(l, "score"),
        ]
          .map(csvEscape)
          .join(";"),
      ),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `oportunidades-seo-${dias}d.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Páginas com procura e sem estoque</CardTitle>
        {pick(dados, "nota") && (
          <p className="text-xs text-muted-foreground">{String(pick(dados, "nota"))}</p>
        )}
        {cobertura && (
          <p className="text-xs text-muted-foreground">
            Search Console disponível de {dataBR(pick(cobertura, "primeiro_dia"))} a{" "}
            {dataBR(pick(cobertura, "ultimo_dia"))}
          </p>
        )}
        <div className="flex flex-wrap items-end gap-4 pt-2">
          <div className="flex items-center gap-2">
            {PERIODOS.map((d) => (
              <Button
                key={d}
                size="sm"
                variant={d === dias ? "default" : "outline"}
                className="h-7 px-3 text-xs"
                onClick={() => setDias(d)}
              >
                {d} dias
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="min-impressoes" className="text-xs">
              Mínimo de impressões
            </Label>
            <Input
              id="min-impressoes"
              type="number"
              min={5}
              max={200}
              step={5}
              className="h-7 w-20"
              value={minImpressoes}
              onChange={(e) =>
                setMinImpressoes(
                  Math.min(200, Math.max(5, Math.round(Number(e.target.value) || 5))),
                )
              }
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-2 text-xs"
            onClick={exportarCsv}
            disabled={!linhas.length}
          >
            <Download className="h-3 w-3" /> Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {coberturaInsuficiente && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              O período pedido é maior que a cobertura do Search Console. O dado não
              existe para toda a janela selecionada.
            </span>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        )}

        {erro && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {!loading && !erro && (
          <>
            {resumo && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Produtos
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {num(pick(resumo, "produtos"))}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Sem estoque
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {num(pick(resumo, "sem_estoque_total"))}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Impressões perdidas
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {num(pick(resumo, "impressoes_perdidas"))}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Cliques no período
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {num(pick(resumo, "cliques_no_periodo"))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CTR agregado {pct(ctrAgregado, 2)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Página que ranqueia e não tem estoque perde posição com o tempo.
                  </p>
                </div>
              </div>
            )}

            {!linhas.length && (
              <p className="text-sm text-muted-foreground">
                Nenhuma página com procura e sem estoque no período.
              </p>
            )}

            {!!linhas.length && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Produto</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Impressões</TableHead>
                    <TableHead className="text-right">Posição média</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Grade zerada</TableHead>
                    <TableHead className="text-right">Sem venda há</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l, i) => {
                    const situacao = String(
                      pick(l, "situacao_rotulo", "situacao") ?? "—",
                    );
                    const pos = n(pick(l, "posicao_media"));
                    const semVenda = n(pick(l, "dias_sem_venda"));
                    const grade: any[] = Array.isArray(pick(l, "grade_lista"))
                      ? (pick(l, "grade_lista") as any[])
                      : [];
                    const expandida = aberta === i;
                    return (
                      <>
                        <TableRow
                          key={i}
                          className="cursor-pointer"
                          onClick={() => setAberta(expandida ? null : i)}
                        >
                          <TableCell>
                            {expandida ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {String(pick(l, "produto", "nome") ?? "—")}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge
                                variant="outline"
                                className={cn("text-xs", badgeSituacao(situacao))}
                              >
                                {situacao}
                              </Badge>
                              {semVenda > 180 && (
                                <Badge variant="secondary" className="text-xs">
                                  produto parado
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {num(pick(l, "impressoes"))}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center justify-end gap-1">
                              {pos > 0 && pos < 5 && (
                                <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                              )}
                              {num(pos, 1)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {pct(pick(l, "ctr"), 2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {num(pick(l, "estoque"))}
                          </TableCell>
                          <TableCell className="text-right">
                            {num(pick(l, "tamanhos_zerados"))}/
                            {num(pick(l, "tamanhos_na_grade"))}
                          </TableCell>
                          <TableCell className="text-right">
                            {semVenda ? `${num(semVenda)} dias` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {num(pick(l, "score"), 1)}
                          </TableCell>
                        </TableRow>
                        {expandida && (
                          <TableRow key={`${i}-detalhe`} className="bg-muted/40">
                            <TableCell colSpan={10}>
                              <div className="space-y-2 p-1">
                                <div className="flex flex-wrap gap-2">
                                  {grade.map((g, j) => (
                                    <span
                                      key={j}
                                      className={cn(
                                        "rounded-md border px-2 py-1 text-xs",
                                        n(pick(g, "estoque")) <= 0 &&
                                          "border-destructive/40 text-destructive",
                                      )}
                                    >
                                      {String(pick(g, "tamanho") ?? "—")}{" "}
                                      <span className="font-medium">
                                        {num(pick(g, "estoque"))}
                                      </span>
                                    </span>
                                  ))}
                                  {!grade.length && (
                                    <span className="text-xs text-muted-foreground">
                                      Sem grade detalhada.
                                    </span>
                                  )}
                                </div>
                                {pick(l, "sugestao") && (
                                  <p className="text-xs text-muted-foreground">
                                    {String(pick(l, "sugestao"))}
                                  </p>
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
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
