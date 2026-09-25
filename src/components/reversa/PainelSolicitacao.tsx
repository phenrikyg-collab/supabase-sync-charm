import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AvisoCashbackUsado } from "./AvisoCashbackUsado";
import { AcoesTroca } from "./AcoesTroca";
import {
  CONDICOES,
  DESTINOS,
  cancelarSolicitacao,
  conferir,
  consultoraContato,
  converterPreferencia,
  correios,
  definirDocumento,
  formatarData,
  formatarDataHora,
  mascararDocumento,
  moeda,
  painelDetalhe,
  prepararReembolso,
  texto,
  traco,
  urlFoto,
  vincularPedidoNovo,
} from "@/lib/reversaPainel";

type Conferencia = { quantidade: number; condicao: string; destino: string };

export function PainelSolicitacao({
  id,
  aberto,
  aoFechar,
  aoMudar,
}: {
  id: string | null;
  aberto: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [dados, setDados] = useState<Record<string, any> | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState("");
  const [conf, setConf] = useState<Record<string, Conferencia>>({});
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [obsConsultora, setObsConsultora] = useState("");
  const [pedidoNovo, setPedidoNovo] = useState("");
  const [credito, setCredito] = useState("");
  const [motivoCancelar, setMotivoCancelar] = useState("");
  const [documento, setDocumento] = useState("");
  const [converterAberto, setConverterAberto] = useState(false);
  const [motivoConversao, setMotivoConversao] = useState("");

  async function carregar() {
    if (!id) return;
    setCarregando(true);
    try {
      const d = await painelDetalhe(id);
      setDados(d);
      const itens: any[] = d?.itens ?? [];
      const inicial: Record<string, Conferencia> = {};
      itens.forEach((it, i) => {
        const chave = String(it.id ?? it.item_id ?? i);
        inicial[chave] = {
          quantidade: Number(it.quantidade_recebida ?? it.quantidade ?? 1),
          condicao: it.condicao ?? "perfeita",
          destino: it.destino ?? "reestoque",
        };
      });
      setConf(inicial);
    } catch (e: any) {
      toast({ title: "Não foi possível abrir", description: e.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (aberto && id) {
      setMotivoRecusa("");
      setObsConsultora("");
      setPedidoNovo("");
      setCredito("");
      setMotivoCancelar("");
      setDocumento("");
      setConverterAberto(false);
      setMotivoConversao("");
      carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, id]);

  async function acao(nome: string, fn: () => Promise<any>, mensagem: string) {
    setOcupado(nome);
    try {
      await fn();
      toast({ title: mensagem });
      await carregar();
      aoMudar();
    } catch (e: any) {
      toast({ title: "Não deu certo", description: e.message, variant: "destructive" });
    } finally {
      setOcupado("");
    }
  }

  async function abrirFoto(caminho: string) {
    try {
      const url = await urlFoto(caminho);
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast({ title: "Foto indisponível", description: e.message, variant: "destructive" });
    }
  }

  const s = dados ?? {};
  const postagem = s.postagem ?? {};
  const itens: any[] = s.itens ?? [];
  const eventos: any[] = s.linha_do_tempo ?? s.eventos ?? [];
  const ehTroca = /troc/i.test(String(s.preferencia ?? ""));
  const ehTrocaExata = String(s.preferencia ?? "") === "troca";
  const chegou = Boolean(s.chegou ?? /entregue|recebid|conferi/i.test(String(s.status ?? "")));
  const escolha: Record<string, any> | null = s.escolha_troca ?? null;
  const docCliente = String(s.cliente?.documento ?? s.cliente_documento ?? "").replace(/\D/g, "");
  const semDocumento = !docCliente;

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif">
            {carregando ? "Carregando..." : `Protocolo ${texto(s.protocolo)}`}
          </SheetTitle>
        </SheetHeader>

        {carregando && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!carregando && dados && (
          <div className="space-y-6 pt-4 text-sm">
            {/* Topo */}
            <div className="grid grid-cols-2 gap-3">
              <Info rotulo="Cliente" valor={texto(s.cliente_nome ?? s.cliente?.nome)} />
              <Info
                rotulo="Contato"
                valor={texto(s.celular ?? s.cliente?.celular ?? s.email ?? s.cliente?.email)}
              />
              <Info
                rotulo="CPF/CNPJ"
                valor={semDocumento ? traco : mascararDocumento(s.cliente?.documento ?? s.cliente_documento)}
              />
              <Info rotulo="Pedido" valor={texto(s.pedido)} />
              <Info rotulo="Preferência" valor={texto(s.preferencia_rotulo ?? s.preferencia)} />
              <Info rotulo="Status" valor={texto(s.status_rotulo ?? s.status)} />
              <Info rotulo="Valor" valor={moeda(s.valor ?? s.valor_total)} />
            </div>

            <AvisoCashbackUsado dados={s} />

            {semDocumento && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                <p className="text-xs font-medium text-amber-800">
                  Sem CPF, a etiqueta sai sem rastreio
                </p>
                <div className="flex gap-2">
                  <Input
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    placeholder="CPF ou CNPJ da cliente"
                    className="bg-white"
                  />
                  <Button
                    size="sm"
                    disabled={!!ocupado || !documento.trim()}
                    onClick={() =>
                      acao(
                        "documento",
                        () => definirDocumento(s.id, documento.trim()),
                        "Documento salvo",
                      )
                    }
                  >
                    {ocupado === "documento" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Peças */}
            <section>
              <h3 className="font-serif text-base mb-2">Peças</h3>
              <div className="space-y-3">
                {itens.map((it, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex gap-3">
                      {(it.foto || it.imagem) && (
                        <img
                          src={it.foto || it.imagem}
                          alt=""
                          className="h-20 w-16 rounded object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">{texto(it.nome)}</p>
                        <p className="text-muted-foreground">
                          {[it.cor, it.tamanho].filter(Boolean).join(" · ") || traco} · qtd{" "}
                          {texto(it.quantidade)}
                        </p>
                        <p className="text-muted-foreground">
                          Motivo: {texto(it.motivo_rotulo ?? it.motivo)}
                        </p>
                        {it.tamanho_desejado && (
                          <p className="text-muted-foreground">
                            Tamanho desejado: {it.tamanho_desejado}
                          </p>
                        )}
                        {it.comentario && <p className="mt-1 italic">“{it.comentario}”</p>}
                      </div>
                    </div>
                    {!!(it.fotos ?? []).length && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(it.fotos as string[]).map((f, k) => (
                          <Button
                            key={k}
                            size="sm"
                            variant="outline"
                            onClick={() => abrirFoto(f)}
                          >
                            Foto {k + 1}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!itens.length && <p className="text-muted-foreground">{traco}</p>}
              </div>
            </section>

            <Separator />

            {/* Escolha da troca */}
            <section>
              <h3 className="font-serif text-base mb-2">O que a cliente quer no lugar</h3>
              <div className="rounded-lg border border-border p-3 space-y-2">
                {!escolha || escolha.tipo === "indeciso" ? (
                  <p className="text-muted-foreground">A cliente ainda nao escolheu</p>
                ) : escolha.tipo === "cupom" ? (
                  <div className="space-y-1">
                    <p>Cliente prefere cupom de {texto(escolha.credito_br)}</p>
                    <p className="text-xs text-muted-foreground">Válido por 7 dias</p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    {escolha.imagem && (
                      <img
                        src={escolha.imagem}
                        alt=""
                        className="h-20 w-16 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{texto(escolha.produto)}</p>
                      <p className="text-muted-foreground">{texto(escolha.cor)}</p>
                      <p className="text-lg font-semibold">{texto(escolha.tamanho)}</p>
                      <p className="text-xs text-muted-foreground">
                        Peça {texto(escolha.preco_br)} · Crédito {texto(escolha.credito_br)}
                      </p>
                      <DiferencaBadge sentido={escolha.diferenca_sentido} valor={escolha.diferenca_br} />
                    </div>
                  </div>
                )}
                {escolha?.observacao && (
                  <blockquote className="border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
                    Recado da cliente: {texto(escolha.observacao)}
                  </blockquote>
                )}
                {escolha?.escolhido_em_br && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Escolhido em {texto(escolha.escolhido_em_br)}
                  </p>
                )}
              </div>
            </section>

            <Separator />

            {/* Postagem */}
            <section>
              <h3 className="font-serif text-base mb-2">Postagem</h3>
              <div className="grid grid-cols-2 gap-3">
                <Info rotulo="Serviço" valor={texto(postagem.servico)} />
                <Info rotulo="Código" valor={texto(postagem.codigo_autorizacao ?? postagem.codigo)} />
                <Info rotulo="Rastreio" valor={texto(postagem.rastreio ?? s.rastreio)} />
                <Info rotulo="Validade" valor={formatarData(postagem.valido_ate)} />
                <Info rotulo="Situação" valor={texto(postagem.status)} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!!ocupado}
                  onClick={() => acao("autorizar", () => correios("autorizar", s.id), "Código gerado")}
                >
                  {ocupado === "autorizar" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gerar código
                </Button>
                {semDocumento && (
                  <p className="w-full text-xs font-medium text-amber-800">
                    Sem CPF, o código sai sem rastreio
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!ocupado}
                  onClick={() => acao("revalidar", () => correios("revalidar", s.id), "Prazo estendido")}
                >
                  Estender prazo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!ocupado}
                  onClick={() => acao("cancelar", () => correios("cancelar", s.id), "Código cancelado")}
                >
                  Cancelar código
                </Button>
              </div>
            </section>

            {/* Conferência */}
            {chegou && (
              <>
                <Separator />
                <section>
                  <h3 className="font-serif text-base mb-2">Conferência</h3>
                  <div className="space-y-3">
                    {itens.map((it, i) => {
                      const chave = String(it.id ?? it.item_id ?? i);
                      const c = conf[chave] ?? { quantidade: 1, condicao: "perfeita", destino: "reestoque" };
                      return (
                        <div key={chave} className="rounded-lg border border-border p-3 space-y-2">
                          <p className="font-medium">{texto(it.nome)}</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label htmlFor={`q-${chave}`} className="text-xs">
                                Recebida
                              </Label>
                              <Input
                                id={`q-${chave}`}
                                type="number"
                                min={0}
                                value={c.quantidade}
                                onChange={(e) =>
                                  setConf({
                                    ...conf,
                                    [chave]: { ...c, quantidade: Number(e.target.value) },
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Condição</Label>
                              <Select
                                value={c.condicao}
                                onValueChange={(v) => setConf({ ...conf, [chave]: { ...c, condicao: v } })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONDICOES.map((o) => (
                                    <SelectItem key={o.valor} value={o.valor}>
                                      {o.rotulo}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Destino</Label>
                              <Select
                                value={c.destino}
                                onValueChange={(v) => setConf({ ...conf, [chave]: { ...c, destino: v } })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DESTINOS.map((o) => (
                                    <SelectItem key={o.valor} value={o.valor}>
                                      {o.rotulo}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 space-y-2">
                    <Label htmlFor="recusa">Motivo da recusa (se for recusar)</Label>
                    <Textarea
                      id="recusa"
                      value={motivoRecusa}
                      onChange={(e) => setMotivoRecusa(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={!!ocupado}
                        onClick={() =>
                          acao(
                            "aprovar",
                            () =>
                              conferir({
                                p_id: s.id,
                                p_itens: itens.map((it, i) => {
                                  const chave = String(it.id ?? it.item_id ?? i);
                                  return { item_id: it.id ?? it.item_id, ...conf[chave] };
                                }),
                                p_aprovar: true,
                              }),
                            "Conferência aprovada",
                          )
                        }
                      >
                        Aprovar conferência
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!ocupado || !motivoRecusa.trim()}
                        onClick={() =>
                          acao(
                            "recusar",
                            () =>
                              conferir({
                                p_id: s.id,
                                p_itens: itens.map((it, i) => {
                                  const chave = String(it.id ?? it.item_id ?? i);
                                  return { item_id: it.id ?? it.item_id, ...conf[chave] };
                                }),
                                p_aprovar: false,
                                p_recusa_motivo: motivoRecusa,
                              }),
                            "Conferência recusada",
                          )
                        }
                      >
                        Recusar
                      </Button>
                    </div>
                  </div>
                </section>
              </>
            )}

            <Separator />

            {/* Troca ou devolução */}
            {ehTroca ? (
              <section className="space-y-3">
                <h3 className="font-serif text-base">Troca</h3>
                <div>
                  <Label htmlFor="obs-cons">Contato da consultora</Label>
                  <Textarea
                    id="obs-cons"
                    value={obsConsultora}
                    onChange={(e) => setObsConsultora(e.target.value)}
                    placeholder="O que ficou combinado com a cliente"
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={!!ocupado || !obsConsultora.trim()}
                    onClick={() =>
                      acao(
                        "contato",
                        () => consultoraContato(s.id, obsConsultora),
                        "Contato registrado",
                      )
                    }
                  >
                    Registrar contato
                  </Button>
                </div>
                {ehTrocaExata ? (
                  <AcoesTroca
                    s={s}
                    aoMudar={async () => {
                      await carregar();
                      aoMudar();
                    }}
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="pedido-novo">Pedido novo na Tray</Label>
                        <Input
                          id="pedido-novo"
                          value={pedidoNovo}
                          onChange={(e) => setPedidoNovo(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="credito">Crédito aplicado</Label>
                        <Input
                          id="credito"
                          type="number"
                          step="0.01"
                          value={credito}
                          onChange={(e) => setCredito(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!!ocupado || !pedidoNovo.trim()}
                      onClick={() =>
                        acao(
                          "vincular",
                          () =>
                            vincularPedidoNovo(s.id, pedidoNovo, credito ? Number(credito) : null),
                          "Pedido novo vinculado - solicitação concluída",
                        )
                      }
                    >
                      Vincular pedido novo
                    </Button>
                  </>
                )}
              </section>
            ) : (
              <section className="space-y-2">
                <h3 className="font-serif text-base">Devolução</h3>
                <Button
                  size="sm"
                  disabled={!!ocupado}
                  onClick={() =>
                    acao("reembolso", async () => {
                      await prepararReembolso(s.id);
                      navigate("/comercial/trocas-devolucoes?tab=reembolsos");
                    }, "Reembolso preparado")
                  }
                >
                  Preparar reembolso
                </Button>
              </section>
            )}

            <Separator />

            {/* Linha do tempo */}
            <section>
              <h3 className="font-serif text-base mb-2">Linha do tempo</h3>
              <ul className="space-y-2">
                {eventos.map((e, i) => (
                  <li key={i} className="border-l-2 border-border pl-3">
                    <p className="font-medium">{texto(e.rotulo ?? e.titulo ?? e.evento)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatarDataHora(e.data ?? e.criado_em)}
                      {e.autor ? ` · ${e.autor}` : ""}
                    </p>
                    {e.detalhe && <p className="text-muted-foreground">{e.detalhe}</p>}
                  </li>
                ))}
                {!eventos.length && <p className="text-muted-foreground">{traco}</p>}
              </ul>
            </section>

            <Separator />

            {/* Cancelar */}
            <section className="space-y-2">
              <Label htmlFor="cancelar">Cancelar solicitação</Label>
              <Textarea
                id="cancelar"
                value={motivoCancelar}
                onChange={(e) => setMotivoCancelar(e.target.value)}
                placeholder="Motivo do cancelamento"
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={!!ocupado || !motivoCancelar.trim()}
                onClick={() =>
                  acao(
                    "cancelar-sol",
                    () => cancelarSolicitacao(s.id, motivoCancelar),
                    "Solicitação cancelada",
                  )
                }
              >
                Cancelar solicitação
              </Button>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="font-medium break-words">{valor}</p>
    </div>
  );
}

export function ChipStatus({ valor }: { valor?: string | null }) {
  if (!valor) return <span className="text-muted-foreground">{traco}</span>;
  return <Badge variant="secondary">{valor}</Badge>;
}

function DiferencaBadge({ sentido, valor }: { sentido?: string; valor?: string }) {
  if (sentido === "cliente_paga") {
    return (
      <span className="inline-flex items-center rounded-full border border-warning/20 bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">
        Cliente paga {texto(valor)}
      </span>
    );
  }
  if (sentido === "sobra_credito") {
    return (
      <span className="inline-flex items-center rounded-full border border-info/20 bg-info/10 px-2.5 py-0.5 text-xs font-semibold text-info">
        Sobra {texto(valor)} de crédito
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
      Valor igual ao crédito
    </span>
  );
}
