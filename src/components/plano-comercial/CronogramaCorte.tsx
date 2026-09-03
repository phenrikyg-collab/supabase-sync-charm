import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { num, pct, pick } from "@/lib/coortes";

const TAMANHOS = ["P", "M", "G", "GG", "EG"];

const n = (v: unknown) => Number(v ?? 0);

/** lê um valor por tamanho aceitando mapa {P:4} ou lista [{tamanho,quantidade}] */
const porTamanho = (fonte: any, tamanho: string): number => {
  if (!fonte) return 0;
  if (Array.isArray(fonte)) {
    const l = fonte.find(
      (x) => String(pick(x, "tamanho", "size") ?? "").toUpperCase() === tamanho,
    );
    return n(pick(l, "quantidade", "qtd", "valor", "total", "pecas"));
  }
  return n(fonte?.[tamanho] ?? fonte?.[tamanho.toLowerCase()]);
};

const tamanhosPresentes = (...fontes: any[]) => {
  const extra: string[] = [];
  fontes.forEach((f) => {
    if (!f) return;
    const chaves = Array.isArray(f)
      ? f.map((x) => String(pick(x, "tamanho", "size") ?? ""))
      : Object.keys(f);
    chaves.forEach((k) => {
      const up = String(k).toUpperCase();
      if (up && !TAMANHOS.includes(up) && !extra.includes(up)) extra.push(up);
    });
  });
  return [...TAMANHOS, ...extra];
};

const Chips = ({ titulo, fonte }: { titulo: string; fonte: any }) => {
  const tams = tamanhosPresentes(fonte).filter((t) => porTamanho(fonte, t) > 0);
  if (!tams.length) return null;
  return (
    <span className="text-xs text-muted-foreground">
      {titulo}:{" "}
      {tams.map((t, i) => (
        <span key={t}>
          {i > 0 && " · "}
          <span className="font-medium text-foreground">
            {t} {num(porTamanho(fonte, t))}
          </span>
        </span>
      ))}
    </span>
  );
};

export default function CronogramaCorte({ ano, mes }: { ano: number; mes: number }) {
  const [apenasContinua, setApenasContinua] = useState(true);
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase.rpc("plano_corte_producao", {
      p_ano: ano,
      p_mes: mes,
      p_top_produtos: 12,
      p_base: "falta",
      p_max_pecas_risco: 6,
      p_max_riscos: 3,
      p_apenas_continua: apenasContinua,
    } as any);
    if (error) {
      setErro(error.message || "Falha ao carregar o cronograma de corte");
      setDados(null);
    } else {
      setDados(data ?? null);
    }
    setLoading(false);
  }, [ano, mes, apenasContinua]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const resumo = dados?.resumo ?? null;
  const escopoTxt = typeof dados?.escopo === "string" ? dados.escopo : pick(dados?.escopo, "texto", "descricao");
  const necessidade = dados?.necessidade_do_mes ?? null;
  const linhasTamanho: any[] = Array.isArray(necessidade?.por_tamanho)
    ? necessidade.por_tamanho
    : necessidade?.por_tamanho
      ? Object.entries(necessidade.por_tamanho).map(([tamanho, v]: any) =>
          typeof v === "object" ? { tamanho, ...v } : { tamanho, demanda_mes: v },
        )
      : [];

  const corte = dados?.corte ?? {};
  const modelos: any[] = Array.isArray(corte?.modelos)
    ? corte.modelos
    : Array.isArray(corte?.produtos)
      ? corte.produtos
      : Array.isArray(corte)
        ? corte
        : [];
  const semCorte: any[] = Array.isArray(corte?.linha_continua_sem_corte)
    ? corte.linha_continua_sem_corte
    : Array.isArray(dados?.linha_continua_sem_corte)
      ? dados.linha_continua_sem_corte
      : [];

  const cabecalho = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Switch
          id="apenas-continua"
          checked={apenasContinua}
          onCheckedChange={setApenasContinua}
        />
        <Label htmlFor="apenas-continua" className="text-sm">
          Somente linha contínua
        </Label>
      </div>
      {escopoTxt && (
        <span className="text-xs text-muted-foreground">{escopoTxt}</span>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {cabecalho}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando cronograma...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cabecalho}

      {erro && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {resumo && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Modelos no escopo
              </p>
              <p className="mt-1 text-xl font-semibold">
                {num(pick(resumo, "modelos_no_escopo"))}
              </p>
            </CardContent>
          </Card>
          {[
            { t: "Peças a cortar", k: ["pecas_a_cortar", "total_a_cortar"] },
            { t: "Riscos planejados", k: ["riscos", "total_riscos", "qtd_riscos"] },
            { t: "Modelos com corte", k: ["modelos_com_corte"] },
          ].map((c) => {
            const v = pick(resumo, ...(c.k as [string, ...string[]]));
            if (v == null) return null;
            return (
              <Card key={c.t}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {c.t}
                  </p>
                  <p className="mt-1 text-xl font-semibold">{num(v)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* B2 — necessidade do mês por tamanho */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Necessidade do mês por tamanho</CardTitle>
          <p className="text-xs text-muted-foreground">
            Quantas peças de cada tamanho o mês precisa para bater a meta.
          </p>
        </CardHeader>
        <CardContent>
          {!linhasTamanho.length && (
            <p className="text-sm text-muted-foreground">
              Sem necessidade calculada para o mês.
            </p>
          )}
          {!!linhasTamanho.length && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tamanho</TableHead>
                  <TableHead className="text-right">Demanda do mês</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Cobertura %</TableHead>
                  <TableHead className="text-right">A cortar</TableHead>
                  <TableHead className="text-right">A produzir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasTamanho.map((l, i) => {
                  const cob = pick(l, "cobertura_pct", "cobertura");
                  const baixa = cob != null && n(cob) < 100;
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {String(pick(l, "tamanho", "size") ?? "—")}
                      </TableCell>
                      <TableCell className="text-right">
                        {num(pick(l, "demanda_mes", "demanda"))}
                      </TableCell>
                      <TableCell className="text-right">{num(pick(l, "estoque"))}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          baixa && "font-semibold text-destructive",
                        )}
                      >
                        {cob != null ? pct(cob) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {num(pick(l, "a_cortar"))}
                      </TableCell>
                      <TableCell className="text-right">
                        {num(pick(l, "a_produzir"))}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    {num(pick(necessidade, "total_demanda_mes"))}
                  </TableCell>
                  <TableCell className="text-right">
                    {num(pick(necessidade, "total_estoque"))}
                  </TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">
                    {num(pick(necessidade, "total_a_cortar"))}
                  </TableCell>
                  <TableCell className="text-right">—</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
          {pick(necessidade, "nota") && (
            <p className="mt-3 text-xs text-muted-foreground">
              {String(pick(necessidade, "nota"))}
            </p>
          )}
        </CardContent>
      </Card>

      {/* modelos e riscos */}
      {!modelos.length && !erro && (
        <p className="text-sm text-muted-foreground">Nenhum modelo no escopo atual.</p>
      )}

      {modelos.map((m, i) => {
        const riscos: any[] = Array.isArray(pick(m, "riscos")) ? (pick(m, "riscos") as any[]) : [];
        return (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <span>
                  {String(
                    pick(m, "modelo", "produto", "nome", "nome_produto") ?? "Sem nome",
                  )}
                </span>
                {pick(m, "linha_continua") === true && (
                  <Badge variant="outline" className="text-xs">
                    linha contínua
                  </Badge>
                )}
              </CardTitle>
              <Chips titulo="Meta do mês" fonte={pick(m, "demanda_por_tamanho")} />
            </CardHeader>
            <CardContent className="space-y-4">
              {!riscos.length && (
                <p className="text-sm text-muted-foreground">Sem corte planejado.</p>
              )}
              {riscos.map((r, j) => {
                const dem = pick(r, "demanda_mes");
                const nec = pick(r, "necessidade");
                const prod = pick(r, "producao");
                const tams = tamanhosPresentes(dem, nec, prod).filter(
                  (t) =>
                    porTamanho(dem, t) > 0 ||
                    porTamanho(nec, t) > 0 ||
                    porTamanho(prod, t) > 0,
                );
                return (
                  <div key={j} className="rounded-md border p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span>Risco {num(pick(r, "risco", "numero", "ordem") ?? j + 1)}</span>
                      {pick(r, "total_pecas", "pecas") != null && (
                        <Badge variant="outline" className="text-xs">
                          {num(pick(r, "total_pecas", "pecas"))} peças
                        </Badge>
                      )}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tamanho</TableHead>
                          <TableHead className="text-right">Meta do mês</TableHead>
                          <TableHead className="text-right">Falta</TableHead>
                          <TableHead className="text-right">Produção</TableHead>
                          <TableHead className="text-right">Sobra</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tams.map((t) => {
                          const p = porTamanho(prod, t);
                          const f = porTamanho(nec, t);
                          return (
                            <TableRow key={t}>
                              <TableCell className="font-medium">{t}</TableCell>
                              <TableCell className="text-right">
                                {num(porTamanho(dem, t))}
                              </TableCell>
                              <TableCell className="text-right">{num(f)}</TableCell>
                              <TableCell className="text-right">{num(p)}</TableCell>
                              <TableCell className="text-right">{num(p - f)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Meta do mês é o total que a venda exige. Falta é o que sobrou
                      depois do estoque. São números diferentes de propósito.
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* B5 — linha contínua sem corte */}
      {!!semCorte.length && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Linha contínua sem corte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {semCorte.map((m, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0 last:pb-0"
              >
                <span className="font-medium">
                  {String(pick(m, "modelo", "produto", "nome", "nome_produto") ?? "—")}
                </span>
                <Chips titulo="Meta do mês" fonte={pick(m, "demanda_por_tamanho")} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
