import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { moeda, painelCriar, texto } from "@/lib/reversaPainel";
import { reversa, chaveMotivo, chavePreferencia, type RespostaBuscar } from "@/lib/reversaPortal";

/**
 * Abertura pelo atendimento: repete o fluxo do portal, mas sem travar prazo.
 * Quem abre pelo painel assume a exceção.
 */
export function AbrirSolicitacaoDialog({
  aberto,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: (id?: string) => void;
}) {
  const { toast } = useToast();
  const [pedido, setPedido] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [dados, setDados] = useState<RespostaBuscar | null>(null);
  const [selecao, setSelecao] = useState<Record<string, { motivo?: string; comentario?: string }>>({});
  const [preferencia, setPreferencia] = useState("");
  const [celular, setCelular] = useState("");
  const [observacao, setObservacao] = useState("");
  const [ocupado, setOcupado] = useState(false);

  function limpar() {
    setPedido("");
    setIdentificador("");
    setDados(null);
    setSelecao({});
    setPreferencia("");
    setCelular("");
    setObservacao("");
  }

  async function buscar() {
    setOcupado(true);
    try {
      const r = await reversa<RespostaBuscar>({ acao: "buscar", pedido, identificador });
      setDados(r);
      setCelular(r.cliente?.celular ?? r.cliente?.telefone ?? "");
    } catch (e: any) {
      toast({ title: "Não encontramos", description: e.message, variant: "destructive" });
    } finally {
      setOcupado(false);
    }
  }

  async function criar() {
    const escolhidos = Object.entries(selecao);
    if (!escolhidos.length) return toast({ title: "Escolha ao menos uma peça", variant: "destructive" });
    if (!preferencia) return toast({ title: "Escolha a preferência", variant: "destructive" });
    setOcupado(true);
    try {
      const r = await painelCriar({
        pedido,
        identificador,
        preferencia,
        celular,
        email: dados?.cliente?.email,
        endereco: dados?.endereco,
        observacao,
        origem: "painel",
        itens: escolhidos.map(([id, v]) => ({
          tray_item_id: id,
          quantidade: 1,
          motivo: v.motivo,
          comentario: v.comentario || null,
          fotos: [],
        })),
      });
      toast({ title: `Solicitação aberta${r?.protocolo ? ` — ${r.protocolo}` : ""}` });
      aoCriar(r?.id);
      limpar();
      aoFechar();
    } catch (e: any) {
      toast({ title: "Não deu certo", description: e.message, variant: "destructive" });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && (limpar(), aoFechar())}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Abrir solicitação</DialogTitle>
          <DialogDescription>
            Para quem prefere resolver pelo WhatsApp. O painel não trava prazo: quem abre aqui
            assume a exceção.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ab-pedido">Número do pedido</Label>
            <Input id="ab-pedido" value={pedido} onChange={(e) => setPedido(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ab-ident">CPF ou e-mail</Label>
            <Input
              id="ab-ident"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={buscar} disabled={ocupado || !pedido || !identificador}>
          {ocupado && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Buscar pedido
        </Button>

        {dados && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              {(dados.itens ?? []).map((it) => {
                const id = String(it.tray_item_id);
                const marcado = !!selecao[id];
                return (
                  <div
                    key={id}
                    className={`rounded-lg border p-3 ${marcado ? "border-primary" : "border-border"}`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() =>
                        setSelecao((p) => {
                          const c = { ...p };
                          if (c[id]) delete c[id];
                          else c[id] = {};
                          return c;
                        })
                      }
                    >
                      {(it.foto || it.imagem) && (
                        <img src={it.foto || it.imagem} alt="" className="h-16 w-12 rounded object-cover" />
                      )}
                      <span>
                        <span className="block font-medium">{texto(it.nome)}</span>
                        <span className="block text-sm text-muted-foreground">
                          {[it.cor, it.tamanho].filter(Boolean).join(" · ")} · {moeda(it.valor)}
                        </span>
                      </span>
                    </button>

                    {marcado && (
                      <div className="mt-3 space-y-2">
                        <Label className="text-xs">Motivo</Label>
                        <div className="flex flex-wrap gap-2">
                          {(dados.motivos ?? []).map((m) => {
                            const cod = chaveMotivo(m);
                            return (
                              <Button
                                key={cod}
                                type="button"
                                size="sm"
                                variant={selecao[id]?.motivo === cod ? "default" : "outline"}
                                onClick={() =>
                                  setSelecao((p) => ({ ...p, [id]: { ...p[id], motivo: cod } }))
                                }
                              >
                                {m.rotulo}
                                {m.no_prazo === false ? " (fora do prazo)" : ""}
                              </Button>
                            );
                          })}
                        </div>
                        <Textarea
                          placeholder="Comentário (opcional)"
                          value={selecao[id]?.comentario ?? ""}
                          onChange={(e) =>
                            setSelecao((p) => ({ ...p, [id]: { ...p[id], comentario: e.target.value } }))
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div>
              <Label className="text-xs">Preferência</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {(dados.preferencias ?? []).map((p) => {
                  const cod = chavePreferencia(p);
                  return (
                    <Button
                      key={cod}
                      type="button"
                      size="sm"
                      variant={preferencia === cod ? "default" : "outline"}
                      onClick={() => setPreferencia(cod)}
                    >
                      {p.rotulo ?? cod}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="ab-cel">Celular com DDD</Label>
              <Input id="ab-cel" value={celular} onChange={(e) => setCelular(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ab-obs">Observação interna</Label>
              <Textarea id="ab-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </div>

            <Button onClick={criar} disabled={ocupado} className="w-full">
              {ocupado && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Abrir solicitação
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
