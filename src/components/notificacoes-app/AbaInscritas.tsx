import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { pushApi, dataHoraBR, ROTULO_PLATAFORMA } from "./api";

export function AbaInscritas() {
  const [busca, setBusca] = useState("");
  const [buscaAdiada, setBuscaAdiada] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setBuscaAdiada(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data: inscritas = [], isLoading } = useQuery({
    queryKey: ["app-push-inscricoes", buscaAdiada],
    queryFn: () => pushApi.listarInscricoes(buscaAdiada, 200),
    placeholderData: (anterior) => anterior,
  });

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CPF"
            className="pl-8"
          />
        </div>

        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : inscritas.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma inscrita encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Aparelho</TableHead>
                  <TableHead>Instalado</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Último aviso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inscritas.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.nome || "Sem nome"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{i.cpf || "-"}</TableCell>
                    <TableCell>{i.plataforma ? ROTULO_PLATAFORMA[i.plataforma] ?? i.plataforma : "-"}</TableCell>
                    <TableCell>{i.instalado === null ? "-" : i.instalado ? "Sim" : "Não"}</TableCell>
                    <TableCell>
                      {i.ativa ? (
                        <Badge variant="outline" className="border-success/20 bg-success/10 text-success">Ativa</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Desativada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{i.motivo || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{dataHoraBR(i.desde)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{dataHoraBR(i.ultimo_aviso)}</TableCell>
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
