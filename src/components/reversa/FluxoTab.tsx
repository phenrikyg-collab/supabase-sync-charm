import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { painelFluxo, texto, type LinhaFluxo } from "@/lib/reversaPainel";

export type AbaFluxo = "transito" | "tratamento";

interface Props {
  aba: AbaFluxo;
  aoAbrirSolicitacao: (id: string) => void;
  aoContagens?: (c: { transito: number; tratamento: number }) => void;
}

export function FluxoTab({ aba, aoAbrirSolicitacao, aoContagens }: Props) {
  const { toast } = useToast();
  const [linhas, setLinhas] = useState<LinhaFluxo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await painelFluxo(aba, 100);
      const lista = Array.isArray(r?.linhas) ? (r.linhas as LinhaFluxo[]) : [];
      setLinhas(
        aba === "tratamento"
          ? [...lista].sort((a, b) => Number(b.parado_ha_dias ?? 0) - Number(a.parado_ha_dias ?? 0))
          : lista,
      );
      if (r?.contagens) {
        aoContagens?.({
          transito: Number(r.contagens.transito ?? 0),
          tratamento: Number(r.contagens.tratamento ?? 0),
        });
      }
    } catch (e: any) {
      setErro(e.message ?? "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (erro) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16">
        <p className="text-sm text-muted-foreground">{erro}</p>
        <Button variant="outline" onClick={carregar}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar de novo
        </Button>
      </Card>
    );
  }

  if (!linhas.length) {
    return (
      <Card className="py-16 text-center text-sm text-muted-foreground">
        {aba === "transito"
          ? "Nenhuma solicitação a caminho da loja agora."
          : "Nenhuma solicitação em tratamento no momento."}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {linhas.map((l) => (
        <Card
          key={String(l.id)}
          onClick={() => l.id && aoAbrirSolicitacao(String(l.id))}
          className="cursor-pointer space-y-3 p-4 transition hover:border-primary/50"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{texto(l.protocolo)}</span>
              <span className="text-sm">{texto(l.cliente_nome)}</span>
              <span className="text-sm text-muted-foreground">{texto(l.pedido)}</span>
              <Badge variant="secondary">{texto(l.status_rotulo)}</Badge>
              <Badge variant="outline">{texto(l.preferencia_rotulo)}</Badge>
              {aba === "tratamento" && Number(l.parado_ha_dias ?? 0) > 0 && (
                <span className="text-xs font-medium text-warning">
                  parada há {Number(l.parado_ha_dias)} {Number(l.parado_ha_dias) === 1 ? "dia" : "dias"}
                </span>
              )}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div className="flex items-center justify-end gap-2">
                <span className="font-mono text-sm font-medium text-foreground">{texto(l.codigo)}</span>
                {l.postagem_compartilhada && (
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    mesma caixa
                  </Badge>
                )}
              </div>
              <div>
                {texto(l.servico)}
                {l.valido_ate_br ? ` · válido até ${texto(l.valido_ate_br)}` : ""}
              </div>
              {l.postagem_compartilhada && l.protocolo_da_postagem && (
                <div className="text-[11px]">vai junto com o protocolo {texto(l.protocolo_da_postagem)}</div>
              )}
            </div>
          </div>

          {(l.fotos ?? []).length > 0 && (
            <div className="flex gap-2">
              {(l.fotos as string[]).slice(0, 4).map((f, i) => (
                <img key={i} src={f} alt="" className="h-10 w-10 rounded border border-border object-cover" />
              ))}
            </div>
          )}

          {aba === "transito" ? <BlocoCorreios l={l} /> : <BlocoTratamento l={l} />}
        </Card>
      ))}
    </div>
  );
}

function BlocoCorreios({ l }: { l: LinhaFluxo }) {
  const eventos = Array.isArray(l.eventos) ? l.eventos : [];
  if (!eventos.length) {
    return <p className="text-xs text-muted-foreground">Sem movimentação nos Correios ainda</p>;
  }
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="space-y-1.5">
        {eventos.slice(0, 5).map((ev, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`}
            />
            <p className={`text-xs ${i === 0 ? "font-medium" : "text-muted-foreground"}`}>
              {texto(ev.descricao)}
              {ev.local ? ` · ${texto(ev.local)}` : ""}
              {ev.quando_br ? ` · ${texto(ev.quando_br)}` : ""}
            </p>
          </div>
        ))}
      </div>
      {l.consultado_em_br && (
        <p className="text-[11px] text-muted-foreground/70">consultado em {texto(l.consultado_em_br)}</p>
      )}
    </div>
  );
}

function BlocoTratamento({ l }: { l: LinhaFluxo }) {
  const pendencias = Array.isArray(l.pendencias) ? l.pendencias : [];
  return (
    <div className="space-y-2 border-t border-border pt-3">
      {pendencias.length ? (
        <ul className="space-y-1">
          {pendencias.map((p, i) => (
            <li key={i} className="flex items-center gap-2 text-sm font-medium text-warning">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {texto(p)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Sem pendências, aguardando</p>
      )}

      {l.escolha && (
        <p className="text-xs text-muted-foreground">
          Escolha: {l.escolha.tipo === "cupom" ? "Cupom" : "Peça"}
          {l.escolha.produto ? ` · ${texto(l.escolha.produto)}` : ""}
          {l.escolha.tamanho ? ` · ${texto(l.escolha.tamanho)}` : ""}
          {l.escolha.credito_br ? ` · crédito ${texto(l.escolha.credito_br)}` : ""}
          {l.escolha.diferenca_br ? ` · diferença ${texto(l.escolha.diferenca_br)}` : ""}
        </p>
      )}

      {(l.nf_status || l.nf_numero) && (
        <p className="text-xs text-muted-foreground">
          NF de entrada: {texto(l.nf_status)}
          {l.nf_numero ? ` · nº ${texto(l.nf_numero)}` : ""}
        </p>
      )}

      {(l.entregue_em_br || l.conferida_em_br) && (
        <p className="text-xs text-muted-foreground">
          {l.entregue_em_br ? `entregue em ${texto(l.entregue_em_br)}` : ""}
          {l.entregue_em_br && l.conferida_em_br ? " · " : ""}
          {l.conferida_em_br ? `conferida em ${texto(l.conferida_em_br)}` : ""}
        </p>
      )}
    </div>
  );
}
