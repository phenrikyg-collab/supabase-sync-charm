import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { MessageCircle, ExternalLink, Copy, RefreshCw, ChevronDown } from "lucide-react";
import { SeloSituacao, linkWhatsApp } from "./comum";

type Alerta = {
  alerta_id: number;
  rotulo: string | null;
  aberto_em_br: string | null;
  resolvido_em_br: string | null;
  resolvido_por: string | null;
  nota: string | null;
};

type Evento = {
  descricao: string | null;
  detalhe: string | null;
  local: string | null;
  em_br: string | null;
};

type Detalhe = {
  envio_id?: number;
  pedido?: string | number | null;
  tray_order_id?: string | number | null;
  situacao?: string | null;
  situacao_rotulo?: string | null;
  mensagem?: string | null;
  cliente?: { nome?: string | null; telefone?: string | null } | null;
  codigo?: string | null;
  transportadora?: string | null;
  servico?: string | null;
  destino?: string | null;
  destino_cep?: string | null;
  enviado_em_br?: string | null;
  postado_em_br?: string | null;
  previsao_br?: string | null;
  entregue_em_br?: string | null;
  tentativas_entrega?: number | null;
  endereco_retirada?: string | null;
  link_transportadora?: string | null;
  link_pagina?: string | null;
  pedido_dados?: unknown;
  produtos?: unknown;
  alertas?: Alerta[];
  eventos?: Evento[];
  consultado_em_br?: string | null;
  proxima_consulta_em_br?: string | null;
  erro?: string | null;
  outros_envios?: unknown;
};

type DetalheCompleto = Detalhe & {
  pedido_info?: { produtos?: unknown; endereco?: string | null } | null;
};

function Linha({ rotulo, valor }: { rotulo: string; valor?: string | number | null }) {
  if (valor === null || valor === undefined || valor === "") return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right">{valor}</span>
    </div>
  );
}

export function GavetaEnvio({
  envioId,
  onFechar,
}: {
  envioId: number | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const [notaDe, setNotaDe] = useState<number | null>(null);
  const [nota, setNota] = useState("");
  const [consultando, setConsultando] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["logistica-detalhe", envioId],
    enabled: !!envioId,
    queryFn: async () => {
      const { data, error } = await chamarRpc<DetalheCompleto>("logistica_painel_detalhe", { p_envio_id: envioId });
      if (error) throw error;
      return data ?? {};
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (data ?? {}) as any;
  const pedidoObj = d.pedido && typeof d.pedido === "object" ? d.pedido : d.pedido_info;
  const numeroPedido = typeof d.pedido === "object" ? d.pedido?.numero : d.pedido;
  const zap = linkWhatsApp(d.cliente?.telefone);

  async function resolverAlerta(alertaId: number) {
    const { data: resposta, error } = await chamarRpc<{ ok?: boolean; erro?: string | null }>(
      "logistica_alerta_resolver",
      { p_alerta_id: alertaId, p_nota: nota.trim() || null },
    );
    if (error) {
      toast.error(error.message || "Não foi possível resolver o alerta");
      return;
    }
    if (resposta && resposta.ok === false) {
      toast.error(resposta.erro || "Não foi possível resolver o alerta");
      return;
    }
    toast.success("Alerta resolvido");
    setNotaDe(null);
    setNota("");
    refetch();
    qc.invalidateQueries({ queryKey: ["logistica-lista"] });
    qc.invalidateQueries({ queryKey: ["logistica-resumo"] });
  }

  async function consultarAgora() {
    if (!envioId) return;
    setConsultando(true);
    const { data: resposta, error } = await chamarRpc<{ mensagem?: string }>("logistica_consultar_agora", {
      p_envio_ids: [envioId],
    });
    setConsultando(false);
    if (error) {
      toast.error(error.message || "Não foi possível consultar");
      return;
    }
    toast.success(resposta?.mensagem || "Consulta pedida");
    setTimeout(() => {
      refetch();
      qc.invalidateQueries({ queryKey: ["logistica-lista"] });
    }, 10000);
  }

  return (
    <Sheet open={!!envioId} onOpenChange={(aberto) => !aberto && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="space-y-2 text-left">
          <SheetTitle className="font-serif text-xl">
            #{numeroPedido ?? "sem número"}
            {d.tray_order_id ? <span className="ml-2 text-sm text-muted-foreground">Tray {d.tray_order_id}</span> : null}
          </SheetTitle>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{d.cliente?.nome || "sem nome"}</span>
            <SeloSituacao situacao={d.situacao} rotulo={d.situacao_rotulo} />
          </div>
          {d.mensagem && <p className="text-sm text-muted-foreground">{d.mensagem}</p>}
        </SheetHeader>

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap gap-2">
              {zap && (
                <Button size="sm" variant="outline" asChild>
                  <a href={zap} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1.5 h-4 w-4" />
                    WhatsApp da cliente
                  </a>
                </Button>
              )}
              {d.link_transportadora && (
                <Button size="sm" variant="outline" asChild>
                  <a href={d.link_transportadora} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    Ver na transportadora
                  </a>
                </Button>
              )}
              {d.link_pagina && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(String(d.link_pagina));
                    toast.success("Link copiado");
                  }}
                >
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copiar link de rastreio
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={consultarAgora} disabled={consultando}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Consultar agora
              </Button>
            </div>

            <div className="space-y-1.5 rounded-lg border p-3">
              <Linha rotulo="Código" valor={d.codigo} />
              <Linha
                rotulo="Transportadora"
                valor={[d.transportadora, d.servico].filter(Boolean).join(" · ") || null}
              />
              <Linha rotulo="Destino" valor={[d.destino, d.destino_cep].filter(Boolean).join(" · ") || null} />
              <Linha rotulo="Enviado em" valor={d.enviado_em_br} />
              <Linha rotulo="Postado em" valor={d.postado_em_br} />
              <Linha rotulo="Previsão" valor={d.previsao_br} />
              <Linha rotulo="Entregue em" valor={d.entregue_em_br} />
              <Linha rotulo="Tentativas de entrega" valor={d.tentativas_entrega} />
              <Linha rotulo="Endereço de retirada" valor={d.endereco_retirada} />
            </div>

            {pedidoObj && (
              <div className="space-y-2 rounded-lg border p-3">
                <h3 className="text-sm font-medium">Pedido</h3>
                {Array.isArray(pedidoObj.produtos) ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {pedidoObj.produtos.map((p: unknown, i: number) => (
                      <li key={i}>{typeof p === "string" ? p : JSON.stringify(p)}</li>
                    ))}
                  </ul>
                ) : pedidoObj.produtos ? (
                  <p className="text-sm text-muted-foreground">{String(pedidoObj.produtos)}</p>
                ) : null}
                {pedidoObj.endereco && <p className="text-sm text-muted-foreground">{String(pedidoObj.endereco)}</p>}
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Alertas</h3>
              {(d.alertas ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum alerta.</p>}
              {(d.alertas ?? []).map((a: Alerta) => (
                <div key={a.alerta_id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Badge variant="outline">{a.rotulo || "alerta"}</Badge>
                      {a.aberto_em_br && (
                        <span className="ml-2 text-xs text-muted-foreground">aberto em {a.aberto_em_br}</span>
                      )}
                    </div>
                    {!a.resolvido_em_br && (
                      <Button size="sm" variant="outline" onClick={() => setNotaDe(a.alerta_id)}>
                        Resolver
                      </Button>
                    )}
                  </div>
                  {a.resolvido_em_br && (
                    <p className="text-xs text-muted-foreground">
                      Resolvido em {a.resolvido_em_br}
                      {a.resolvido_por ? ` por ${a.resolvido_por}` : ""}
                      {a.nota ? `. ${a.nota}` : ""}
                    </p>
                  )}
                  {notaDe === a.alerta_id && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Nota (opcional)"
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => resolverAlerta(a.alerta_id)}>
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setNotaDe(null);
                            setNota("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Resolver tira o alerta da fila. Se o rastreio mudar de novo, ele volta.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Linha do tempo</h3>
              {(d.eventos ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
              )}
              <ol className="space-y-3">
                {(d.eventos ?? []).map((e: Evento, i: number) => (
                  <li key={i} className="border-l pl-3">
                    <p className="text-sm font-medium">{e.descricao || "evento"}</p>
                    {e.detalhe && <p className="text-sm text-muted-foreground">{e.detalhe}</p>}
                    <p className="text-xs text-muted-foreground">
                      {[e.local, e.em_br].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            <Separator />

            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground">
                <ChevronDown className="h-3 w-3" />
                Detalhes técnicos
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1 text-xs text-muted-foreground">
                {d.consultado_em_br && <p>Consultado em {d.consultado_em_br}</p>}
                {d.proxima_consulta_em_br && <p>Próxima consulta em {d.proxima_consulta_em_br}</p>}
                {d.erro && <p>Erro: {String(d.erro)}</p>}
                {d.outros_envios && <p>Outros envios: {JSON.stringify(d.outros_envios)}</p>}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
