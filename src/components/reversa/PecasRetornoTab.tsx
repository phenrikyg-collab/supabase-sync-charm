import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { pecasRetorno, texto, traco, type RespostaPecasRetorno } from "@/lib/reversaPainel";

const LIMITE = 200;

/** Etapas fora do fluxo principal: aparecem depois e mais discretas. */
const FORA_DO_FLUXO = ["nao_volta_estoque", "nao_volta", "nao_chegou", "recusada", "recusado"];

const foraDoFluxo = (chave: string) => FORA_DO_FLUXO.some((c) => chave.includes(c));

/** Cor do badge de etapa, do início do fluxo até a peça disponível. */
function corEtapa(chave: string) {
  if (foraDoFluxo(chave)) return "bg-muted text-muted-foreground";
  if (chave.includes("liberada")) return "bg-success/15 text-success";
  if (chave.includes("estoque")) return "bg-primary/15 text-primary";
  if (chave.includes("nf")) return "bg-warning/15 text-warning";
  if (chave.includes("conferir") || chave.includes("chegou")) return "bg-accent text-accent-foreground";
  return "bg-secondary text-secondary-foreground";
}

/** Data que importa em cada etapa da jornada. */
function dataDaEtapa(l: Record<string, any>) {
  const e = String(l.etapa ?? "");
  if (e.includes("liberada") || e.includes("estoque"))
    return { rotulo: "Conferida em", valor: l.reestoque_em_br ?? l.conferida_em_br };
  if (e.includes("nf")) return { rotulo: "Conferida em", valor: l.conferida_em_br };
  if (e.includes("chegou") || e.includes("conferir"))
    return { rotulo: "Entregue em", valor: l.entregue_em_br };
  if (e.includes("transito") || e.includes("caminho"))
    return { rotulo: "Postada em", valor: l.entregue_em_br ?? l.criado_em_br };
  return { rotulo: "Aberta em", valor: l.criado_em_br };
}

type Props = { aoAbrirSolicitacao: (id: string) => void };

export function PecasRetornoTab({ aoAbrirSolicitacao }: Props) {
  const { toast } = useToast();
  const [dados, setDados] = useState<RespostaPecasRetorno | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [detalhe, setDetalhe] = useState<Record<string, any> | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const r = await pecasRetorno({
        ...(etapa ? { etapa } : {}),
        ...(buscaAtiva ? { busca: buscaAtiva } : {}),
        limite: LIMITE,
      });
      setDados(r ?? null);
    } catch (e: any) {
      toast({ title: "Não foi possível carregar", description: e.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, buscaAtiva]);

  const linhas = useMemo(() => dados?.linhas ?? [], [dados]);
  const resumo = dados?.resumo ?? {};
  const horasAlerta = Number(dados?.horas_alerta ?? 12);

  const etapas = dados?.etapas ?? [];
  const principais = etapas.filter((e) => !foraDoFluxo(e.chave));
  const secundarias = etapas.filter((e) => foraDoFluxo(e.chave));

  const rotuloEtapa = (chave: string) =>
    etapas.find((e) => e.chave === chave)?.rotulo ?? String(chave ?? traco);

  /** Uma etapa entra em destaque quando tem peça parada esperando alguém olhar. */
  const temAlerta = (chave: string) =>
    linhas.some((l) => l.etapa === chave && l.alerta === true);

  const cartao = (e: { chave: string; rotulo: string }, discreto: boolean) => {
    const ativo = etapa === e.chave;
    const alerta = temAlerta(e.chave);
    const pecas = Number(resumo[e.chave]?.pecas ?? resumo[e.chave]?.linhas ?? 0);
    return (
      <button
        key={e.chave}
        onClick={() => setEtapa(ativo ? null : e.chave)}
        className={`min-w-[150px] rounded-xl border px-4 py-3 text-left transition ${
          ativo ? "border-primary ring-2 ring-primary/30" : "border-border"
        } ${discreto ? "bg-muted/40" : alerta ? "bg-warning/10" : "bg-card"}`}
      >
        <p
          className={`text-2xl font-semibold tabular-nums ${
            discreto ? "text-muted-foreground" : alerta ? "text-warning" : ""
          }`}
        >
          {pecas}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {e.rotulo}
          {alerta && <AlertTriangle className="h-3 w-3 text-warning" />}
        </p>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">{principais.map((e) => cartao(e, false))}</div>
      {secundarias.length > 0 && (
        <div className="flex flex-wrap gap-3">{secundarias.map((e) => cartao(e, true))}</div>
      )}

      <p className="text-xs text-muted-foreground">
        Peça conferida que passa de {horasAlerta}h sem o estoque subir na Tray vira alerta: vale
        conferir a integração do Bling com a Tray.
      </p>

      <div className="flex gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Peça, SKU, cliente, protocolo, pedido ou rastreio"
            value={busca}
            onChange={(ev) => setBusca(ev.target.value)}
            onKeyDown={(ev) => ev.key === "Enter" && setBuscaAtiva(busca.trim())}
          />
        </div>
        <Button variant="outline" onClick={() => setBuscaAtiva(busca.trim())}>
          Buscar
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="h-[560px] overflow-auto">
          {carregando && (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {!carregando && !linhas.length && (
            <p className="py-16 text-center text-muted-foreground">
              Nenhuma peça em retorno neste filtro.
            </p>
          )}

          {!carregando &&
            linhas.map((l) => {
              const data = dataDaEtapa(l);
              return (
                <button
                  key={String(l.item_id)}
                  onClick={() => setDetalhe(l)}
                  className={`flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition hover:bg-accent/40 ${
                    l.alerta ? "bg-warning/10" : ""
                  }`}
                >
                  {l.imagem ? (
                    <img
                      src={l.imagem}
                      alt={texto(l.produto)}
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded border border-border object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded border border-dashed border-border" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {texto(l.produto)}
                      {l.cor || l.tamanho ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {texto(l.cor)} · {texto(l.tamanho)}
                        </span>
                      ) : null}
                    </p>
                  <p className="truncate text-xs text-muted-foreground">SKU {texto(l.sku)}</p>
                  {l.rastreio_evento && (
                    <p className="truncate text-xs text-muted-foreground">
                      {texto(l.rastreio_evento)}
                      {l.rastreio_local ? ` · ${texto(l.rastreio_local)}` : ""}
                      {l.rastreio_em_br ? ` · ${texto(l.rastreio_em_br)}` : ""}
                    </p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">
                    {texto(l.cliente_nome)} · {texto(l.protocolo)}
                  </p>
                    {l.alerta && l.aviso && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        {l.aviso}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <Badge className={`${corEtapa(String(l.etapa ?? ""))} border-0`}>
                      {rotuloEtapa(String(l.etapa ?? ""))}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.rotulo}: {texto(data.valor)}
                    </p>
                    {Number(l.parada_ha_dias ?? 0) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        parada há {l.parada_ha_dias} dias
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </Card>

      <DetalhePeca
        linha={detalhe}
        rotuloEtapa={rotuloEtapa}
        aoFechar={() => setDetalhe(null)}
        aoAbrirSolicitacao={(id) => {
          setDetalhe(null);
          aoAbrirSolicitacao(id);
        }}
      />
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: any }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right">{texto(valor)}</span>
    </div>
  );
}

function DetalhePeca({
  linha,
  rotuloEtapa,
  aoFechar,
  aoAbrirSolicitacao,
}: {
  linha: Record<string, any> | null;
  rotuloEtapa: (chave: string) => string;
  aoFechar: () => void;
  aoAbrirSolicitacao: (id: string) => void;
}) {
  const l = linha ?? {};
  const jornada = [
    { rotulo: "Solicitação aberta", valor: l.criado_em_br },
    { rotulo: "Postagem autorizada", valor: l.codigo_postagem ? l.valido_ate_br : null },
    { rotulo: "Entregue na loja", valor: l.entregue_em_br },
    { rotulo: "Conferida", valor: l.conferida_em_br },
    { rotulo: "NF de entrada", valor: l.nf_numero ?? l.nf_status },
    { rotulo: "Estoque na Tray", valor: l.reestoque_em_br },
  ];

  return (
    <Sheet open={!!linha} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <SheetContent className="w-full overflow-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-serif">{texto(l.produto)}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pt-4">
          <div className="flex gap-3">
            {l.imagem && (
              <img
                src={l.imagem}
                alt={texto(l.produto)}
                className="h-24 w-24 rounded border border-border object-cover"
              />
            )}
            <div className="text-sm">
              <p>
                {texto(l.cor)} · {texto(l.tamanho)}
              </p>
              <p className="text-xs text-muted-foreground">SKU {texto(l.sku)}</p>
              <p className="text-xs text-muted-foreground">
                {texto(l.cliente_nome)} · pedido {texto(l.tray_order_id)}
              </p>
              <Badge className="mt-2" variant="secondary">
                {rotuloEtapa(String(l.etapa ?? ""))}
              </Badge>
            </div>
          </div>

          {l.alerta && l.aviso && (
            <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{l.aviso}</span>
            </div>
          )}

          <section>
            <h3 className="mb-2 text-sm font-medium">Jornada da peça</h3>
            <ol className="space-y-2 border-l border-border pl-4">
              {jornada.map((p) => (
                <li key={p.rotulo} className="relative text-sm">
                  <span
                    className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${
                      p.valor ? "bg-primary" : "bg-border"
                    }`}
                  />
                  <p className={p.valor ? "" : "text-muted-foreground"}>{p.rotulo}</p>
                  <p className="text-xs text-muted-foreground">{texto(p.valor)}</p>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-medium">Conferência</h3>
            <Linha rotulo="Quantidade pedida" valor={l.quantidade} />
            <Linha rotulo="Quantidade recebida" valor={l.qtd_recebida} />
            <Linha rotulo="Motivo" valor={l.motivo_rotulo} />
            <Linha rotulo="Condição" valor={l.condicao} />
            <Linha rotulo="Destino" valor={l.destino} />
            <Linha rotulo="Preferência" valor={l.preferencia} />
            {l.conferencia_obs && (
              <p className="mt-2 rounded bg-muted p-2 text-sm">{l.conferencia_obs}</p>
            )}
          </section>

          <section>
            <h3 className="mb-1 text-sm font-medium">Correios</h3>
            <Linha rotulo="Código de postagem" valor={l.codigo_postagem} />
            <Linha rotulo="Rastreio" valor={l.rastreio} />
            <Linha rotulo="Válido até" valor={l.valido_ate_br} />
            {l.rastreio_evento && (
              <div className="flex justify-between gap-4 py-1 text-sm">
                <span className="text-muted-foreground">Último evento</span>
                <div className="text-right">
                  <span>
                    {texto(l.rastreio_evento)}
                    {l.rastreio_local ? ` · ${texto(l.rastreio_local)}` : ""}
                    {l.rastreio_em_br ? ` · ${texto(l.rastreio_em_br)}` : ""}
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    consultado em {texto(l.rastreio_visto_em_br)}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-1 text-sm font-medium">NF de entrada</h3>
            <Linha rotulo="Situação" valor={l.nf_status} />
            <Linha rotulo="Número" valor={l.nf_numero} />
          </section>

          <section className="rounded-lg border border-border p-3">
            <h3 className="mb-1 text-sm font-medium">Estoque na Tray</h3>
            <p className="text-sm">
              antes: {texto(l.estoque_tray_antes)} na Tray / agora: {texto(l.estoque_tray)} na Tray
            </p>
            <p className="text-xs text-muted-foreground">
              {l.produto_ativo === false ? "Produto inativo na Tray" : "Produto ativo na Tray"}
            </p>
          </section>

          <Button
            className="w-full"
            variant="outline"
            onClick={() => l.solicitacao_id && aoAbrirSolicitacao(String(l.solicitacao_id))}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir solicitação completa
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
