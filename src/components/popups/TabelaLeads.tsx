import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Download } from "lucide-react";
import {
  popupsApi,
  ROTULO_RESULTADO,
  baixarCsv,
  dataHoraBR,
  moedaBR,
  telefoneBR,
} from "@/lib/popups";
import { BotaoConversa } from "@/components/recuperacao/BotaoConversa";

function corResultado(r: string) {
  if (r === "cupom_novo") return "bg-success/10 text-success border-success/20";
  if (r === "cupom_reenviado") return "bg-primary/10 text-primary border-primary/20";
  if (r === "erro" || r === "bloqueado") return "bg-danger/10 text-danger border-danger/20";
  return "bg-muted text-muted-foreground border-border";
}

export function TabelaLeads({
  popupId,
  limite = 500,
  incluirTeste = false,
}: {
  popupId: number | null;
  limite?: number;
  incluirTeste?: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["popups-conversoes", popupId, limite, incluirTeste],
    queryFn: () => popupsApi.conversoes(popupId, limite, incluirTeste),
  });

  const leads = data ?? [];

  function exportar() {
    baixarCsv(
      "leads-popups.csv",
      [
        ["Data", "Popup", "Nome", "E-mail", "WhatsApp", "Resultado", "Cupom", "Usou", "Dispositivo"],
        ...leads.map((l: any) => [
          dataHoraBR(l.criado_em ?? l.data),
          l.popup_nome ?? "",
          l.nome ?? "",
          l.email ?? "",
          telefoneBR(l.telefone ?? l.whatsapp),
          ROTULO_RESULTADO[l.resultado] ?? l.resultado ?? "",
          l.cupom ?? "",
          l.usou ? `sim (${l.pedido ?? ""})` : l.cupom_vencido ? "venceu" : "não",
          l.dispositivo ?? "",
        ]),
      ]
    );
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (!leads.length)
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhum lead capturado ainda. Assim que um popup ativo receber um e-mail ou WhatsApp, a pessoa aparece aqui.
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportar}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Popup</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Cupom</TableHead>
              <TableHead>Usou?</TableHead>
              <TableHead>Dispositivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((l: any, i: number) => {
              const tel = l.telefone ?? l.whatsapp;
              const resultado = l.resultado ?? "sem_oferta";
              return (
                <TableRow key={l.id ?? i}>
                  <TableCell className="whitespace-nowrap text-xs">{dataHoraBR(l.criado_em ?? l.data)}</TableCell>
                  <TableCell className="text-xs">{l.popup_nome ?? "sem dados"}</TableCell>
                  <TableCell className="text-xs">{l.nome ?? ""}</TableCell>
                  <TableCell className="text-xs">{l.email ?? ""}</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span>{tel ? telefoneBR(tel) : ""}</span>
                      <BotaoConversa telefone={tel} variant="ghost" className="h-7 px-2 text-xs" />
                    </div>
                  </TableCell>
                  <TableCell>
                    {resultado === "erro" && l.erro ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className={corResultado(resultado)}>
                            {ROTULO_RESULTADO[resultado] ?? resultado}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{l.erro}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Badge variant="outline" className={corResultado(resultado)}>
                        {ROTULO_RESULTADO[resultado] ?? resultado}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.cupom ?? ""}</TableCell>
                  <TableCell className="text-xs">
                    {l.usou
                      ? `sim ${l.pedido ? `· pedido ${l.pedido}` : ""} ${
                          l.valor_pedido ? `· ${moedaBR(l.valor_pedido)}` : ""
                        }`.trim()
                      : l.cupom_vencido
                        ? "venceu"
                        : "não"}
                  </TableCell>
                  <TableCell className="text-xs">{l.dispositivo ?? ""}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
