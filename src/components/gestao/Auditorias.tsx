import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ddmmyyyy } from "@/lib/gestaoFormat";
import { cn } from "@/lib/utils";

const urgenciaCor: Record<string, string> = {
  alta: "bg-red-500/15 text-red-600 border-red-500/30",
  media: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  baixa: "bg-muted text-muted-foreground border-border",
};

const statusLabel: Record<string, string> = {
  aberta: "Aberta",
  em_validacao: "Em validação",
  concluida: "Concluída",
};

export default function Auditorias() {
  const { data: auditorias = [], isLoading } = useQuery({
    queryKey: ["gestao-auditorias"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gestao_auditorias_listar" as any);
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as any[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando auditorias…
      </div>
    );
  }

  if (!auditorias.length) {
    return <p className="text-sm text-muted-foreground py-8">Nenhuma auditoria registrada.</p>;
  }

  return (
    <div className="space-y-5">
      {auditorias.map((a: any, i: number) => {
        const acoes: any[] = Array.isArray(a.acoes) ? a.acoes : [];
        const abertas = acoes.filter((x) => x.status === "aberta").length;
        return (
          <Card key={a.id ?? i}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  <span className="text-muted-foreground font-normal mr-2 text-sm">
                    {ddmmyyyy(a.data ?? a.data_auditoria ?? a.created_at)}
                  </span>
                  {a.titulo ?? "Auditoria"}
                </CardTitle>
                <Badge variant="outline">{abertas} ações abertas de {acoes.length}</Badge>
              </div>
              {a.resumo && <p className="text-sm text-muted-foreground mt-2">{a.resumo}</p>}
            </CardHeader>
            {acoes.length > 0 && (
              <CardContent className="overflow-x-auto">
                <Table containerClassName="max-h-[70vh]">
                  <TableHeader className="sticky top-0 z-20 bg-card">
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Domínio</TableHead>
                      <TableHead>Urgência</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acoes.map((ac: any, j: number) => (
                      <TableRow key={j}>
                        <TableCell className="max-w-md">{ac.acao ?? "—"}</TableCell>
                        <TableCell>
                          {ac.dominio ? <Badge variant="secondary">{ac.dominio}</Badge> : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(urgenciaCor[ac.urgencia] ?? urgenciaCor.baixa)}>
                            {ac.urgencia ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{statusLabel[ac.status] ?? ac.status ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
