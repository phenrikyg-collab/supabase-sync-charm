import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { competenciaLabel } from "@/lib/rh";
import { telefoneBonito } from "@/lib/rhWhatsapp";

type Envio = {
  nome: string | null;
  tipo: string | null;
  documento_tipo: string | null;
  status: string | null;
  destino: string | null;
  nome_arquivo: string | null;
  erro: string | null;
  enviado_por: string | null;
  criado_em: string | null;
  enviado_em: string | null;
};

const dataHora = (v: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const STATUS_CLASS: Record<string, string> = {
  enviado: "bg-green-100 text-green-700",
  ok: "bg-green-100 text-green-700",
  erro: "bg-red-100 text-red-700",
  falha: "bg-red-100 text-red-700",
  pendente: "bg-muted text-muted-foreground",
  teste: "bg-blue-100 text-blue-700",
};

export function EnviosWhatsAppHistorico({ competencia }: { competencia: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["rh-envios-whatsapp", competencia],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_envios_whatsapp_listar" as any, {
        p_competencia: competencia,
        p_limite: 200,
      });
      if (error) throw error;
      return (data ?? []) as Envio[];
    },
  });

  return (
    <Card className="print:hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-serif">
          Enviados por WhatsApp{" "}
          <span className="text-xs font-sans font-normal text-muted-foreground">
            · {competenciaLabel(competencia)}
          </span>
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">Nenhum envio nesta competência.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground text-left border-b">
                  <th className="py-1.5 pr-3 font-medium">Quando</th>
                  <th className="py-1.5 pr-3 font-medium">Funcionária</th>
                  <th className="py-1.5 pr-3 font-medium">O que</th>
                  <th className="py-1.5 pr-3 font-medium">Destino</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 font-medium">Por</th>
                </tr>
              </thead>
              <tbody>
                {data.map((e, i) => (
                  <tr key={i} className="border-b last:border-0 align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums text-xs">
                      {dataHora(e.enviado_em ?? e.criado_em)}
                    </td>
                    <td className="py-1.5 pr-3">{e.nome ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-xs">
                      {e.tipo ?? "—"}
                      {e.documento_tipo ? ` · ${e.documento_tipo}` : ""}
                      {e.nome_arquivo ? (
                        <span className="block text-[10px] text-muted-foreground break-all">
                          {e.nome_arquivo}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3 text-xs tabular-nums">{telefoneBonito(e.destino)}</td>
                    <td className="py-1.5 pr-3">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          STATUS_CLASS[(e.status ?? "").toLowerCase()] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {e.status ?? "—"}
                      </span>
                      {e.erro && <p className="text-[10px] text-red-600 mt-0.5">{e.erro}</p>}
                    </td>
                    <td className="py-1.5 text-xs text-muted-foreground break-all">{e.enviado_por ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
