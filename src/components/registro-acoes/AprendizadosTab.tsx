import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  acoesAprendizados, brl, dec, ddmmyyyy, inteiro, isNil, n, rotuloDe, type AcoesOpcoes,
} from "@/lib/registroAcoes";

export default function AprendizadosTab({ opcoes }: { opcoes: AcoesOpcoes }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["acoes", "aprendizados"],
    queryFn: async () => {
      const d = await acoesAprendizados();
      return Array.isArray(d) ? d[0] ?? {} : d ?? {};
    },
  });

  const linhas = useMemo(() => {
    const l: any[] = data?.por_tipo_driver ?? [];
    return [...l].sort((a, b) => n(b.taxa_melhora_pct) - n(a.taxa_melhora_pct));
  }, [data]);

  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (error) return <Card className="p-6 text-sm text-destructive">Não deu para carregar: {(error as Error).message}</Card>;

  const destaques: any[] = data?.destaques ?? [];
  const registrados: any[] = data?.aprendizados_registrados ?? [];

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Conta semanas, não linhas. Semana isolada é a que não teve outro tipo de ação no mesmo driver nem mudança de medição.
      </p>

      {linhas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
          Ainda não há semanas suficientes para comparar tipos de ação.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">Ações</TableHead>
                <TableHead className="text-right">Semanas</TableHead>
                <TableHead className="text-right">Avaliáveis</TableHead>
                <TableHead className="text-right">Melhora</TableHead>
                <TableHead className="text-right">Piora</TableHead>
                <TableHead className="text-right">Taxa de melhora</TableHead>
                <TableHead className="text-right">Taxa nas semanas isoladas</TableHead>
                <TableHead className="text-right">Delta médio</TableHead>
                <TableHead className="text-right">Receita direta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{rotuloDe(opcoes.tipos, l.tipo, "")}</TableCell>
                  <TableCell className="text-xs">{rotuloDe(opcoes.drivers, l.driver, "Sem driver")}</TableCell>
                  <TableCell className="text-right text-xs">{inteiro(l.acoes)}</TableCell>
                  <TableCell className="text-right text-xs">{inteiro(l.semanas)}</TableCell>
                  <TableCell className="text-right text-xs">{inteiro(l.semanas_avaliaveis)}</TableCell>
                  <TableCell className="text-right text-xs">{inteiro(l.semanas_melhora)}</TableCell>
                  <TableCell className="text-right text-xs">{inteiro(l.semanas_piora)}</TableCell>
                  <TableCell className="text-right text-xs">
                    <div className="flex items-center justify-end gap-1.5">
                      {isNil(l.taxa_melhora_pct)
                        ? <span className="text-muted-foreground">sem base</span>
                        : <span>{dec(l.taxa_melhora_pct, 1)}%</span>}
                      {n(l.semanas_avaliaveis) < 4 && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">amostra pequena</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {isNil(l.taxa_melhora_isoladas_pct)
                      ? <span className="text-muted-foreground">sem base</span>
                      : `${dec(l.taxa_melhora_isoladas_pct, 1)}%`}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {isNil(l.delta_medio_pct)
                      ? <span className="text-muted-foreground">sem base</span>
                      : `${dec(l.delta_medio_pct, 2)}%`}
                  </TableCell>
                  <TableCell className="text-right text-xs">{brl(l.receita_direta_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="font-serif text-lg">Destaques</div>
          {destaques.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum destaque no período.</p>
          )}
          <div className="grid gap-2">
            {destaques.map((d, i) => (
              <div key={i} className="rounded-md border p-3 space-y-1">
                <div className="text-sm font-medium">{d.titulo}</div>
                <div className="text-xs text-muted-foreground">{d.driver_nome}</div>
                <div className="text-xs">
                  {isNil(d.valor_semana) ? "sem dados" : dec(d.valor_semana, 2)}
                  {" x "}
                  {isNil(d.base_4s) ? "sem base" : dec(d.base_4s, 2)}
                  {!isNil(d.z_semana) && (
                    <span className="text-muted-foreground"> (z {dec(d.z_semana, 2)})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="font-serif text-lg">Aprendizados registrados</div>
          {registrados.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum aprendizado registrado ainda.</p>
          )}
          <div className="space-y-3">
            {registrados.map((a, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{ddmmyyyy(a.data ?? a.data_inicio)}</span>
                  {a.leitura && <Badge variant="outline" className="text-[10px]">{rotuloDe(opcoes.leituras, a.leitura)}</Badge>}
                </div>
                <div className="text-sm font-medium">{a.titulo}</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.aprendizado}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
