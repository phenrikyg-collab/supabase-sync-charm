import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { carregarExecucoes, ROTULO_ESTADO, type ExecucaoFluxo, type FluxoCompleto } from "@/lib/igDmFluxos";
import { dataHoraLonga } from "@/lib/kitsLive";

function Tile({ label, valor }: { label: string; valor: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">{valor}</p>
    </div>
  );
}

export function ResultadoFluxo({
  fluxoId,
  resumo,
}: {
  fluxoId: number;
  resumo: FluxoCompleto["resumo"];
}) {
  const [linhas, setLinhas] = useState<ExecucaoFluxo[] | null>(null);

  useEffect(() => {
    let vivo = true;
    carregarExecucoes(fluxoId)
      .then((l) => vivo && setLinhas(l))
      .catch((e: any) => {
        toast.error(e?.message ?? "Não foi possível carregar as conversas do fluxo.");
        if (vivo) setLinhas([]);
      });
    return () => {
      vivo = false;
    };
  }, [fluxoId]);

  return (
    <div className="space-y-4 overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Conversas" valor={resumo?.conversas ?? 0} />
        <Tile label="Em andamento" valor={resumo?.em_andamento ?? 0} />
        <Tile label="Passaram para a Anna" valor={resumo?.para_anna ?? 0} />
        <Tile label="E-mails captados" valor={resumo?.emails ?? 0} />
        <Tile label="Clientes identificadas" valor={resumo?.clientes_identificadas ?? 0} />
      </div>

      <Card>
        <CardContent className="p-0">
          {linhas === null ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : linhas.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma cliente passou por este fluxo ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">E-mail</th>
                    <th className="px-3 py-2">Passo atual</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Motivo</th>
                    <th className="px-3 py-2">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const v = (l.variaveis ?? {}) as Record<string, any>;
                    const erro = (l.estado ?? "") === "erro";
                    return (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{v.username ? `@${v.username}` : "-"}</td>
                        <td className="px-3 py-2">{v.email || "-"}</td>
                        <td className="px-3 py-2">{l.no_atual || "-"}</td>
                        <td className={`px-3 py-2 ${erro ? "font-semibold text-danger" : ""}`}>
                          {ROTULO_ESTADO[l.estado ?? ""] ?? l.estado ?? "-"}
                        </td>
                        <td className={`px-3 py-2 ${erro ? "text-danger" : "text-muted-foreground"}`}>
                          {l.motivo_saida || "-"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {dataHoraLonga(l.atualizado_em ?? l.criado_em)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
