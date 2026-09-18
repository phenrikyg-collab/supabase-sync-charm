import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  pushApi, dataHoraBR, nBR, pctBR, resumoPublico,
  ROTULO_ORIGEM, ROTULO_STATUS, type OrigemEnvio, type StatusEnvio,
} from "./api";

function corStatus(s: StatusEnvio): string {
  if (s === "enviado") return "bg-success/10 text-success border-success/20";
  if (s === "enviando") return "bg-primary/10 text-primary border-primary/20";
  if (s === "erro") return "bg-danger/10 text-danger border-danger/20";
  if (s === "agendado") return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground";
}

export function AbaHistorico() {
  const qc = useQueryClient();
  const [origem, setOrigem] = useState<"todas" | OrigemEnvio>("todas");

  const { data: envios = [], isLoading } = useQuery({
    queryKey: ["app-push-envios"],
    queryFn: () => pushApi.listarEnvios(200),
    refetchInterval: (q) => {
      const lista = q.state.data as { status: StatusEnvio }[] | undefined;
      return lista?.some((e) => e.status === "enviando") ? 15_000 : false;
    },
  });

  const cancelar = useMutation({
    mutationFn: (id: number) => pushApi.cancelar(id),
    onSuccess: () => {
      toast.success("Envio cancelado");
      qc.invalidateQueries({ queryKey: ["app-push-envios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = useMemo(
    () => (origem === "todas" ? envios : envios.filter((e) => e.origem === origem)),
    [envios, origem],
  );

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <Select value={origem} onValueChange={(v) => setOrigem(v as typeof origem)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="logistica">Automático</SelectItem>
            <SelectItem value="teste">Teste</SelectItem>
          </SelectContent>
        </Select>

        {lista.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum aviso enviado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Público</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Enviadas</TableHead>
                  <TableHead className="text-right">Falhas</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {dataHoraBR(e.agendado_para ?? e.iniciado_em ?? e.criado_em)}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{e.titulo}</TableCell>
                    <TableCell><Badge variant="outline">{ROTULO_ORIGEM[e.origem] ?? e.origem}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {resumoPublico(e.publico)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={corStatus(e.status)}>
                        {ROTULO_STATUS[e.status] ?? e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{nBR(e.enviados)}</TableCell>
                    <TableCell className="text-right">{nBR(e.falhas)}</TableCell>
                    <TableCell className="text-right">{nBR(e.cliques)}</TableCell>
                    <TableCell className="text-right">{pctBR(e.cliques, e.enviados)}</TableCell>
                    <TableCell className="text-right">
                      {(e.status === "agendado" || e.status === "rascunho") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelar.mutate(e.id)}
                          disabled={cancelar.isPending}
                        >
                          Cancelar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
