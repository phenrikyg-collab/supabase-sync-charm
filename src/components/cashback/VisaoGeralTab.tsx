import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  listaDe, objetoDe, brl, inteiro, pct1, dataBr, corStatus, ROTULO_STATUS, numero, type Linha,
} from "@/lib/cashback";
import { EstadoVazio } from "./Estados";

type Props = {
  resumo: Record<string, any>;
  onAbrirCliente: (customer: string) => void;
};

function CardResumo({
  titulo, valor, subtitulo, ajuda,
}: { titulo: string; valor: string; subtitulo?: string; ajuda?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{titulo}</p>
          {ajuda && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[260px]">{ajuda}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="mt-1 font-serif text-2xl">{valor}</p>
        {subtitulo && <p className="mt-0.5 text-xs text-muted-foreground">{subtitulo}</p>}
      </CardContent>
    </Card>
  );
}

export function VisaoGeralTab({ resumo, onAbrirCliente }: Props) {
  const cupons = objetoDe(resumo.cupons);
  const filas = objetoDe(resumo.filas);
  const ultimos = listaDe(resumo.ultimos_cupons);

  const avisosFalhados = numero(filas.avisos_falhados);
  const aGerar = numero(filas.a_gerar);

  const itensFila: { rotulo: string; valor: any }[] = [
    { rotulo: "A gerar", valor: filas.a_gerar },
    { rotulo: "A baixar", valor: filas.a_baixar },
    { rotulo: "A cancelar", valor: filas.a_cancelar },
    { rotulo: "A devolver", valor: filas.a_devolver },
    { rotulo: "Avisos pendentes", valor: filas.avisos_pendentes },
  ];

  const corFila = (v: any) => {
    if (avisosFalhados > 0) return "text-danger";
    return numero(v) === 0 ? "text-success" : "text-muted-foreground";
  };

  return (
    <div className="space-y-6 pt-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CardResumo
          titulo="Cupons ativos"
          valor={inteiro(cupons.ativos)}
          subtitulo={`${brl(cupons.valor_em_aberto)} em aberto`}
          ajuda="É o passivo do programa: o que a loja deve em desconto futuro."
        />
        <CardResumo titulo="Gerados no período" valor={inteiro(cupons.gerados)} subtitulo={brl(cupons.valor_gerado)} />
        <CardResumo titulo="Usados no período" valor={inteiro(cupons.usados)} subtitulo={brl(cupons.valor_usado)} />
        <CardResumo
          titulo="Taxa de resgate"
          valor={pct1(cupons.taxa_resgate_pct)}
          subtitulo={cupons.taxa_resgate_pct == null ? "ainda sem base de cálculo" : undefined}
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Filas do motor</h3>
            <p className="text-xs text-muted-foreground">
              A geração roda a cada 10 minutos, a conciliação a cada 15 e os avisos a cada 15.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {itensFila.map((f) => (
              <div key={f.rotulo} className="flex items-baseline gap-2">
                <span className={`font-serif text-xl ${corFila(f.valor)}`}>{inteiro(f.valor)}</span>
                <span className="text-xs text-muted-foreground">{f.rotulo}</span>
              </div>
            ))}
            {avisosFalhados > 0 && (
              <Badge variant="outline" className="border-danger/30 bg-danger/15 text-danger">
                {inteiro(avisosFalhados)} avisos falharam
              </Badge>
            )}
          </div>

          {aGerar > 50 && (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Muitos pedidos esperando geração. Confira se o cron está ligado.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <h3 className="border-b p-4 text-sm font-medium">Últimos cupons</h3>
          {ultimos.length === 0 ? (
            <EstadoVazio titulo="Nenhum cupom gerado até agora." descricao="Assim que a geração rodar, os cupons aparecem aqui." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Mínimo</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pedido de origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimos.map((c: Linha, i) => (
                  <TableRow
                    key={c.id ?? i}
                    className="cursor-pointer"
                    onClick={() => onAbrirCliente(String(c.customer ?? c.customer_id ?? c.cliente_id ?? ""))}
                  >
                    <TableCell className="font-medium">{c.cliente ?? c.nome ?? ""}</TableCell>
                    <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                    <TableCell>{brl(c.valor)}</TableCell>
                    <TableCell>{brl(c.valor_minimo ?? c.minimo)}</TableCell>
                    <TableCell>{dataBr(c.validade ?? c.expira_em)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={corStatus(c.status)}>
                        {ROTULO_STATUS[String(c.status).toLowerCase()] ?? c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.pedido_origem ?? c.pedido ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
