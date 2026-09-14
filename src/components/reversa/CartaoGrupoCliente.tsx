import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { texto, traco, type GrupoCliente, type LinhaFila } from "@/lib/reversaPainel";

function numero(v: any) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function CartaoGrupoCliente({
  grupo,
  linhas,
  aoAbrir,
}: {
  grupo: GrupoCliente;
  linhas: LinhaFila[];
  aoAbrir: (linha: LinhaFila) => void;
}) {
  const totalPecas = linhas.reduce((soma, l) => soma + numero(l.pecas), 0);
  const codigos = Array.from(
    new Set(linhas.map((l) => l.codigo).filter((c) => c != null && c !== "")),
  ) as string[];
  const variosCodigos = numero(grupo.codigos_distintos) > 1;

  return (
    <Card className="overflow-hidden">
      <TooltipProvider>
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/50 px-4 py-3">
          <span className="font-medium">{texto(grupo.cliente)}</span>
          <Badge variant="secondary">{linhas.length} solicitações</Badge>
          <span className="text-xs text-muted-foreground">{totalPecas} peças no total</span>
          {codigos.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {variosCodigos ? "Códigos: " : "Código: "}
              {codigos.join(", ")}
            </span>
          )}
          {grupo.enderecos_diferentes && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="cursor-default">
                  Endereços diferentes
                </Badge>
              </TooltipTrigger>
              <TooltipContent>confira antes de juntar as peças no mesmo envio</TooltipContent>
            </Tooltip>
          )}
          {grupo.desde_br && (
            <span className="ml-auto text-xs text-muted-foreground">desde {grupo.desde_br}</span>
          )}
        </div>

        <table className="w-full text-sm">
          <tbody>
            {linhas.map((l, i) => (
              <tr
                key={String(l.protocolo ?? l.id ?? i)}
                onClick={() => aoAbrir(l)}
                className="cursor-pointer border-t border-border hover:bg-accent/40"
              >
                <td className="whitespace-nowrap px-4 py-2 font-medium">{texto(l.protocolo)}</td>
                <td className="whitespace-nowrap px-3 py-2">{texto(l.pedido)}</td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                  {numero(l.pecas)} {numero(l.pecas) === 1 ? "peça" : "peças"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{texto(l.preferencia)}</td>
                <td className="whitespace-nowrap px-3 py-2">{texto(l.valor_br)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <Badge variant="secondary">{texto(l.status_rotulo ?? l.status)}</Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {l.criada_br ?? traco}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {l.compartilha_postagem ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className="cursor-default border-warning/40 bg-warning/15 text-warning hover:bg-warning/15">
                          Mesma caixa
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>usa o código da outra solicitação</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-xs text-muted-foreground">{texto(l.codigo)}</span>
                  )}
                  {l.rastreio_evento && (
                    <div className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground/70">
                      {texto(l.rastreio_evento)}
                      {l.rastreio_local ? ` · ${texto(l.rastreio_local)}` : ""}
                      {l.rastreio_em_br ? ` · ${texto(l.rastreio_em_br)}` : ""}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TooltipProvider>
    </Card>
  );
}
