import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIPOS_NO, type TipoNo } from "./tipos";

type Execucao = {
  id: number | string;
  cliente_nome?: string | null;
  cliente?: string | null;
  telefone?: string | null;
  status?: string | null;
  no_atual_tipo?: string | null;
  no_atual?: string | null;
  entrou_em?: string | null;
  criado_em?: string | null;
  proxima_acao_em?: string | null;
};

const STATUS: Record<string, string> = {
  ativa: "bg-info/10 text-info border-info/20",
  concluida: "bg-success/10 text-success border-success/20",
  concluída: "bg-success/10 text-success border-success/20",
  erro: "bg-danger/10 text-danger border-danger/20",
};

function dataHora(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ExecucoesTab({ fluxoId }: { fluxoId: string }) {
  const { data: execucoes = [], isLoading } = useQuery({
    queryKey: ["automacoes-execucoes", fluxoId],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("automacoes_listar_execucoes" as any, { p_fluxo_id: fluxoId });
      if (error) throw error;
      return (data ?? []) as Execucao[];
    },
  });

  return (
    <Card className="p-4">
      <h2 className="font-medium mb-3">Execuções</h2>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando execuções…</p>}
      {!isLoading && execucoes.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma execução registrada para este fluxo.</p>
      )}
      {execucoes.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Nó atual</TableHead>
              <TableHead>Entrou no fluxo</TableHead>
              <TableHead>Próxima ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {execucoes.map((e) => {
              const st = (e.status ?? "").toLowerCase();
              const tipo = (e.no_atual_tipo ?? e.no_atual ?? "") as TipoNo;
              return (
                <TableRow key={String(e.id)}>
                  <TableCell>
                    <p className="text-sm">{e.cliente_nome ?? e.cliente ?? "Desconhecido"}</p>
                    {e.telefone && <p className="text-xs text-muted-foreground">{e.telefone}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS[st] ?? "bg-muted text-muted-foreground border-border"}
                    >
                      {e.status ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{TIPOS_NO[tipo]?.label ?? e.no_atual_tipo ?? "—"}</TableCell>
                  <TableCell className="text-sm">{dataHora(e.entrou_em ?? e.criado_em)}</TableCell>
                  <TableCell className="text-sm">{dataHora(e.proxima_acao_em)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
