import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CircleAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { rpcFluxos } from "@/components/automacoes/api";
import { useAuth } from "@/contexts/AuthContext";

export type AlertaAutomacao = {
  id: number;
  fluxo_id: number;
  fluxo_nome: string;
  fluxo_status?: string | null;
  tipo: string;
  gravidade: "grave" | "aviso";
  aberto_em?: string | null;
  resolvido_em?: string | null;
  resolvido_por?: string | null;
  nota?: string | null;
  detalhe?: Record<string, any> | null;
};

export function useAlertasAutomacoes(incluirResolvidos: boolean) {
  return useQuery({
    queryKey: ["automacoes-alertas", incluirResolvidos],
    queryFn: async () =>
      (await rpcFluxos<AlertaAutomacao[]>("automacoes_alertas_listar", {
        p_incluir_resolvidos: incluirResolvidos,
      })) ?? [],
  });
}

function fraseDoAlerta(alerta: AlertaAutomacao): { titulo: string; frase: string } {
  const d = (alerta.detalhe ?? {}) as Record<string, any>;
  switch (alerta.tipo) {
    case "parado":
      return {
        titulo: "Parou de rodar",
        frase: `Última execução há ${d.horas_parado}h. A cadência normal deste fluxo é a cada ${d.cadencia_tipica_horas}h.`,
      };
    case "nunca_rodou":
      return {
        titulo: "Nunca executou",
        frase: `Ativo desde ${d.ativo_desde} e nenhuma execução até agora.`,
      };
    case "repeticao":
      return {
        titulo: "Mensagem repetida",
        frase: `${d.execucoes} execuções para ${d.chaves_distintas} destinos em ${d.periodo}: ${d.mensagens_a_mais} mensagens a mais do que deveria.`,
      };
    case "repeticao_provavel":
      return {
        titulo: "Pode repetir",
        frase: `A janela de ${d.janela_horas}h é maior que o intervalo mínimo de ${d.intervalo_dias} dia(s): o mesmo cliente pode receber até ${d.repeticoes_possiveis} vezes.`,
      };
    case "falha_envio":
      return {
        titulo: "Envios falhando",
        frase: `${d.falhas} de ${d.total} envios falharam (${d.taxa}%). Exemplo: ${d.exemplo}`,
      };
    case "execucao_presa":
      return {
        titulo: "Execuções travadas",
        frase: `${d.quantidade} execuções esperando desde ${d.esperando_desde}.`,
      };
    case "erro_execucao":
      return {
        titulo: "Erro na execução",
        frase: `${d.quantidade} execuções com erro nas últimas 24h. Exemplo: ${d.exemplo}`,
      };
    case "config_vazia":
      return {
        titulo: "Gatilho sem configuração",
        frase: `Gatilho ${d.gatilho} está ativo mas sem nenhum status/situação selecionado: nunca vai disparar.`,
      };
    case "publico_vazio":
      return { titulo: "Público vazio", frase: "O filtro de público está vazio." };
    case "pico":
      return {
        titulo: "Volume acima do normal",
        frase: `${d.hoje} execuções hoje contra uma média de ${d.media_diaria} por dia.`,
      };
    case "numeros_invalidos":
      return {
        titulo: "Muitos contatos pulados",
        frase: `${d.pulados} de ${d.entradas} entradas foram puladas (${d.taxa}%).`,
      };
    default:
      return {
        titulo: alerta.tipo,
        frase: `\`\`\`json\n${JSON.stringify(alerta.detalhe ?? {}, null, 2)}\n\`\`\``.startsWith("```")
          ? JSON.stringify(alerta.detalhe ?? {}, null, 2)
          : "",
      };
  }
}

function abertoHa(iso?: string | null) {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return formatDistanceToNow(data, { locale: ptBR, addSuffix: false });
}

export function AlertasAutomacoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);
  const [resolvendo, setResolvendo] = useState<AlertaAutomacao | null>(null);
  const [nota, setNota] = useState("");
  const [silenciarDias, setSilenciarDias] = useState("7");
  const [salvando, setSalvando] = useState(false);
  const alertas = useAlertasAutomacoes(mostrarResolvidos);

  const ordenados = [...(alertas.data ?? [])].sort((a, b) => {
    const ga = a.gravidade === "grave" ? 0 : 1;
    const gb = b.gravidade === "grave" ? 0 : 1;
    if (ga !== gb) return ga - gb;
    return new Date(b.aberto_em ?? 0).getTime() - new Date(a.aberto_em ?? 0).getTime();
  });

  const abrirResolver = (alerta: AlertaAutomacao) => {
    setResolvendo(alerta);
    setNota("");
    setSilenciarDias("7");
  };

  const confirmarResolver = async () => {
    if (!resolvendo) return;
    setSalvando(true);
    try {
      const resposta = await rpcFluxos<{ ok: boolean; erro?: string }>("automacoes_alerta_resolver", {
        p_id: resolvendo.id,
        p_nota: nota.trim() || null,
        p_por: user?.email || "painel",
        p_silenciar_dias: Number(silenciarDias),
      });
      if (!resposta?.ok) throw new Error(resposta?.erro || "Não foi possível resolver o alerta.");
      toast.success("Alerta resolvido");
      setResolvendo(null);
      queryClient.invalidateQueries({ queryKey: ["automacoes-alertas"] });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível resolver o alerta.");
    } finally {
      setSalvando(false);
    }
  };

  if (alertas.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (alertas.isError) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-danger">Não foi possível carregar os alertas.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {alertas.error instanceof Error ? alertas.error.message : "Tente novamente."}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => alertas.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar de novo
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Switch
          id="mostrar-resolvidos"
          checked={mostrarResolvidos}
          onCheckedChange={setMostrarResolvidos}
        />
        <Label htmlFor="mostrar-resolvidos" className="text-sm">
          Mostrar resolvidos
        </Label>
      </div>

      {ordenados.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium">Nenhum alerta aberto.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            As automações estão rodando normalmente.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {ordenados.map((alerta) => {
            const { titulo, frase } = fraseDoAlerta(alerta);
            const grave = alerta.gravidade === "grave";
            const resolvido = !!alerta.resolvido_em;
            return (
              <Card key={alerta.id} className={`p-4 ${resolvido ? "opacity-60" : ""}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          grave
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-warning/30 bg-warning/10 text-warning"
                        }
                      >
                        {grave ? (
                          <CircleAlert className="mr-1 h-3 w-3" />
                        ) : (
                          <AlertTriangle className="mr-1 h-3 w-3" />
                        )}
                        {grave ? "Grave" : "Aviso"}
                      </Badge>
                      <Link
                        to={`/automacoes/${alerta.fluxo_id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {alerta.fluxo_nome}
                      </Link>
                    </div>
                    <p className="text-sm font-semibold">{titulo}</p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{frase}</p>
                    <p className="text-xs text-muted-foreground">
                      Aberto há {abertoHa(alerta.aberto_em)}
                      {resolvido && (
                        <>
                          {" · "}Resolvido por {alerta.resolvido_por ?? "painel"}
                          {alerta.nota ? `: ${alerta.nota}` : ""}
                        </>
                      )}
                    </p>
                  </div>
                  {!resolvido && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full shrink-0 sm:w-auto"
                      onClick={() => abrirResolver(alerta)}
                    >
                      Resolver
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!resolvendo} onOpenChange={(aberto) => !aberto && setResolvendo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver alerta</DialogTitle>
            <DialogDescription>
              {resolvendo?.fluxo_nome} · {resolvendo ? fraseDoAlerta(resolvendo).titulo : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nota-resolucao">O que foi feito? (opcional)</Label>
              <Textarea
                id="nota-resolucao"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ex.: ajustei a janela do gatilho para 24h"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Silenciar este alerta por</Label>
              <Select value={silenciarDias} onValueChange={setSilenciarDias}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 dias</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="0">Não silenciar</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Enquanto silenciado, este mesmo problema não volta a abrir alerta para este fluxo.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setResolvendo(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={confirmarResolver} disabled={salvando}>
              {salvando ? "Resolvendo..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
