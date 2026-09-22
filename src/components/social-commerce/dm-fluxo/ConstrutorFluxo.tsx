import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background, Controls, MiniMap, ReactFlow, addEdge as _addEdge, applyNodeChanges,
  type Connection, type Edge, type Node, type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle, ArrowLeft, Clock, Flag, GitBranch, HelpCircle, Loader2, MessageCircle,
  ShoppingBag, Sparkles, Tag, UserRound, CheckCircle2,
} from "lucide-react";
import { NoFluxoDm } from "./NoFluxo";
import { PainelNo } from "./PainelNo";
import { ResultadoFluxo } from "./ResultadoFluxo";
import { carregarProdutosPai, type ProdutoPai } from "../SeletorProdutos";
import {
  carregarFluxo, comDestino, definirFluxoDaLive, destinoDaSaida, novaChave, ROTULO_TIPO,
  saidasDoNo, salvarFluxo, type FluxoCompleto, type NoFluxoDados, type TipoNo, type ValidacaoFluxo,
} from "@/lib/igDmFluxos";

const TIPOS_PALETA: { tipo: TipoNo; icone: any }[] = [
  { tipo: "mensagem", icone: MessageCircle },
  { tipo: "pergunta", icone: HelpCircle },
  { tipo: "cartao", icone: ShoppingBag },
  { tipo: "espera", icone: Clock },
  { tipo: "condicao", icone: GitBranch },
  { tipo: "tag", icone: Tag },
  { tipo: "humano", icone: UserRound },
  { tipo: "anna", icone: Sparkles },
  { tipo: "fim", icone: Flag },
];

const tiposNo = { noDm: NoFluxoDm };

function configPadrao(tipo: TipoNo) {
  switch (tipo) {
    case "mensagem":
      return { texto: "", botoes: [], proximo: null };
    case "pergunta":
      return { texto: "", validacao: "livre", variavel: "", proximo: null, invalido: null, botoes: [] };
    case "cartao":
      return { usar_pecas_da_live: true, texto_botao: "Ver peça", proximo: null };
    case "espera":
      return { segundos: 60, proximo: null };
    case "condicao":
      return { campo: "email", operador: "existe", sim: null, nao: null };
    case "tag":
      return { tag: "", proximo: null };
    default:
      return {};
  }
}

export function ConstrutorFluxo({
  fluxoId,
  onVoltar,
  onMudou,
}: {
  fluxoId: number | null;
  onVoltar: () => void;
  onMudou: () => void;
}) {
  const [id, setId] = useState<number | null>(fluxoId);
  const [nome, setNome] = useState("Novo fluxo");
  const [descricao, setDescricao] = useState("");
  const [modelo, setModelo] = useState(false);
  const [status, setStatus] = useState("rascunho");
  const [noInicial, setNoInicial] = useState<string | null>(null);
  const [nos, setNos] = useState<NoFluxoDados[]>([]);
  const [metricas, setMetricas] = useState<FluxoCompleto["metricas"]>({});
  const [resumo, setResumo] = useState<FluxoCompleto["resumo"]>({});
  const [validacao, setValidacao] = useState<ValidacaoFluxo>({ ok: true, erros: [], avisos: [] });
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoPai[]>([]);

  useEffect(() => {
    carregarProdutosPai().then(setProdutos).catch(() => setProdutos([]));
  }, []);

  useEffect(() => {
    let vivo = true;
    const iniciar = async () => {
      if (fluxoId == null) {
        const chave = novaChave("msg");
        setNos([
          {
            chave,
            tipo: "mensagem",
            rotulo: "Boas-vindas",
            config: configPadrao("mensagem") as any,
            pos_x: 80,
            pos_y: 80,
          },
        ]);
        setNoInicial(chave);
        setCarregando(false);
        return;
      }
      try {
        const d = await carregarFluxo(fluxoId);
        if (!vivo) return;
        setId(d.fluxo.id ?? fluxoId);
        setNome(d.fluxo.nome ?? "");
        setDescricao(d.fluxo.descricao ?? "");
        setModelo(!!d.fluxo.modelo);
        setStatus(d.fluxo.status ?? "rascunho");
        setNoInicial(d.fluxo.no_inicial ?? d.nos[0]?.chave ?? null);
        setNos(d.nos.map((n) => ({ ...n, config: n.config ?? {} })));
        setMetricas(d.metricas ?? {});
        setResumo(d.resumo ?? {});
        setValidacao(d.validacao ?? { ok: true, erros: [], avisos: [] });
      } catch (e: any) {
        toast.error(e?.message ?? "Não foi possível abrir o fluxo.");
      } finally {
        if (vivo) setCarregando(false);
      }
    };
    iniciar();
    return () => {
      vivo = false;
    };
  }, [fluxoId]);

  const mapa = useMemo(() => new Map(nos.map((n) => [n.chave, n])), [nos]);

  const nodes: Node[] = useMemo(
    () =>
      nos.map((n) => ({
        id: n.chave,
        type: "noDm",
        position: { x: n.pos_x ?? 0, y: n.pos_y ?? 0 },
        selected: selecionado === n.chave,
        data: {
          tipo: n.tipo,
          rotulo: n.rotulo,
          config: n.config ?? {},
          inicial: noInicial === n.chave,
          erroInicio: noInicial === n.chave && n.tipo !== "mensagem",
          metricas: metricas?.[n.chave],
        },
      })),
    [nos, selecionado, noInicial, metricas],
  );

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    const inicialSemBotoes =
      noInicial && mapa.get(noInicial) && (mapa.get(noInicial)!.config?.botoes ?? []).length === 0;
    nos.forEach((n) => {
      saidasDoNo(n.tipo, n.config ?? {}).forEach((s) => {
        const destino = destinoDaSaida(n.config ?? {}, s.chave);
        if (!destino || !mapa.has(destino)) return;
        const esperaResposta = n.chave === noInicial && inicialSemBotoes;
        out.push({
          id: `${n.chave}:${s.chave}`,
          source: n.chave,
          sourceHandle: s.chave,
          target: destino,
          label: esperaResposta ? "espera ela responder" : s.rotulo,
          labelStyle: { fontSize: 10 },
          animated: esperaResposta,
        });
      });
    });
    return out;
  }, [nos, mapa, noInicial]);

  const atualizarNo = useCallback((chave: string, patch: Partial<NoFluxoDados>) => {
    setNos((prev) => prev.map((n) => (n.chave === chave ? { ...n, ...patch } : n)));
  }, []);

  const onNodesChange = useCallback((mud: NodeChange[]) => {
    setNos((prev) => {
      const atual = prev.map((n) => ({
        id: n.chave,
        type: "noDm",
        position: { x: n.pos_x ?? 0, y: n.pos_y ?? 0 },
        data: {},
      })) as Node[];
      const novos = applyNodeChanges(mud, atual);
      const pos = new Map(novos.map((n) => [n.id, n.position]));
      return prev.map((n) => {
        const p = pos.get(n.chave);
        return p ? { ...n, pos_x: Math.round(p.x), pos_y: Math.round(p.y) } : n;
      });
    });
    const sel = mud.find((m) => m.type === "select" && (m as any).selected) as any;
    if (sel) setSelecionado(sel.id);
  }, []);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return;
    const saida = c.sourceHandle ?? "proximo";
    setNos((prev) =>
      prev.map((n) =>
        n.chave === c.source ? { ...n, config: comDestino(n.config ?? {}, saida, c.target!) } : n,
      ),
    );
  }, []);

  const onEdgesDelete = useCallback((apagadas: Edge[]) => {
    setNos((prev) =>
      prev.map((n) => {
        const minhas = apagadas.filter((e) => e.source === n.chave);
        if (!minhas.length) return n;
        let cfg = n.config ?? {};
        minhas.forEach((e) => {
          cfg = comDestino(cfg, e.sourceHandle ?? "proximo", null);
        });
        return { ...n, config: cfg };
      }),
    );
  }, []);

  const adicionar = (tipo: TipoNo) => {
    const chave = novaChave(tipo.slice(0, 3));
    const novo: NoFluxoDados = {
      chave,
      tipo,
      rotulo: ROTULO_TIPO[tipo],
      config: configPadrao(tipo) as any,
      pos_x: 120 + (nos.length % 4) * 300,
      pos_y: 120 + Math.floor(nos.length / 4) * 240,
    };
    setNos((p) => [...p, novo]);
    setSelecionado(chave);
    if (!noInicial) setNoInicial(chave);
  };

  const excluir = (chave: string) => {
    setNos((prev) =>
      prev
        .filter((n) => n.chave !== chave)
        .map((n) => {
          let cfg = n.config ?? {};
          saidasDoNo(n.tipo, cfg).forEach((s) => {
            if (destinoDaSaida(cfg, s.chave) === chave) cfg = comDestino(cfg, s.chave, null);
          });
          return { ...n, config: cfg };
        }),
    );
    if (selecionado === chave) setSelecionado(null);
    if (noInicial === chave) setNoInicial(null);
  };

  const variaveisDoFluxo = useMemo(
    () =>
      Array.from(
        new Set(
          nos
            .filter((n) => n.tipo === "pergunta" && n.config?.variavel)
            .map((n) => String(n.config!.variavel)),
        ),
      ),
    [nos],
  );

  const salvar = async (novoStatus: "rascunho" | "pronto") => {
    setSalvando(true);
    try {
      const r = await salvarFluxo({
        id,
        nome: nome.trim() || "Novo fluxo",
        descricao,
        modelo,
        no_inicial: noInicial,
        status: novoStatus,
        nos: nos.map((n) => ({
          chave: n.chave,
          tipo: n.tipo,
          rotulo: n.rotulo,
          config: n.config ?? {},
          pos_x: Math.round(n.pos_x ?? 0),
          pos_y: Math.round(n.pos_y ?? 0),
        })),
      });
      if (r?.validacao) setValidacao(r.validacao);
      if (r?.ok === false) {
        toast.error(r.motivo || r.erro || "Não foi possível salvar.", {
          description: "Se há clientes paradas em passos removidos, duplique o fluxo e ajuste a cópia.",
        });
        return;
      }
      if (r?.id) setId(r.id);
      if (r?.status) setStatus(r.status);
      if (novoStatus === "pronto" && r?.status === "rascunho") {
        toast.warning("Salvo como rascunho: ainda há erros na validação.", {
          description: r.motivo ?? undefined,
        });
      } else {
        toast.success(novoStatus === "pronto" ? "Fluxo pronto para usar." : "Rascunho salvo.");
      }
      onMudou();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar o fluxo.");
    } finally {
      setSalvando(false);
    }
  };

  const usarNestaLive = async () => {
    if (id == null) return toast.error("Salve o fluxo antes de usar na live.");
    try {
      const r = await definirFluxoDaLive(id);
      if (r?.ok === false) {
        if (r.validacao) setValidacao(r.validacao);
        toast.error(r.erro || r.motivo || "O fluxo ainda tem erros.");
        return;
      }
      toast.success("Fluxo escolhido para esta live.");
      onMudou();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível usar o fluxo nesta live.");
    }
  };

  const noSel = selecionado ? mapa.get(selecionado) ?? null : null;

  const selecionarPorErro = (texto: string) => {
    const alvo = nos.find((n) => n.rotulo && texto.startsWith(n.rotulo));
    if (alvo) setSelecionado(alvo.chave);
  };

  if (carregando) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[540px] w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[560px] flex-col gap-3">
      {/* barra superior */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8" onClick={onVoltar}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Fluxos
        </Button>
        <Input
          className="h-8 w-56"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do fluxo"
        />
        <Badge variant={status === "pronto" ? "default" : "outline"}>
          {status === "pronto" ? "Pronto" : "Rascunho"}
        </Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" disabled={salvando} onClick={() => salvar("rascunho")}>
            {salvando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Salvar rascunho
          </Button>
          <Button size="sm" className="h-8" disabled={salvando} onClick={() => salvar("pronto")}>
            Salvar e marcar pronto
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={usarNestaLive}>
            Usar nesta live
          </Button>
        </div>
      </div>

      <Tabs defaultValue="construtor" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="construtor">Construtor</TabsTrigger>
          <TabsTrigger value="resultado" disabled={id == null}>Resultado</TabsTrigger>
        </TabsList>

        <TabsContent value="construtor" className="mt-3 min-h-0 flex-1">
          <div className="flex h-full min-h-0 gap-3">
            {/* paleta */}
            <Card className="w-40 shrink-0 space-y-1 overflow-y-auto p-2">
              <p className="px-1 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Passos
              </p>
              {TIPOS_PALETA.map(({ tipo, icone: Icone }) => (
                <Button
                  key={tipo}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-start text-xs"
                  onClick={() => adicionar(tipo)}
                >
                  <Icone className="mr-1.5 h-3.5 w-3.5" /> {ROTULO_TIPO[tipo]}
                </Button>
              ))}
            </Card>

            {/* canvas */}
            <Card className="min-w-0 flex-1 overflow-hidden">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={tiposNo}
                onNodesChange={onNodesChange}
                onConnect={onConnect}
                onEdgesDelete={onEdgesDelete}
                onNodeClick={(_, n) => setSelecionado(n.id)}
                onPaneClick={() => setSelecionado(null)}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background />
                <Controls />
                <MiniMap pannable zoomable />
              </ReactFlow>
            </Card>

            {/* configuração + validação */}
            <Card className="flex w-80 shrink-0 flex-col overflow-hidden">
              {noSel ? (
                <PainelNo
                  no={noSel}
                  nos={nos}
                  variaveis={variaveisDoFluxo}
                  produtos={produtos}
                  inicial={noInicial === noSel.chave}
                  onChange={(patch) => atualizarNo(noSel.chave, patch)}
                  onDefinirInicio={() => setNoInicial(noSel.chave)}
                  onExcluir={() => excluir(noSel.chave)}
                />
              ) : (
                <div className="flex-1 overflow-y-auto p-3">
                  <p className="mb-3 text-xs text-muted-foreground">
                    Escolha um passo no quadro para configurar, ou adicione um novo pela lista da
                    esquerda.
                  </p>
                  <div className="space-y-2">
                    {validacao.erros?.length ? (
                      validacao.erros.map((e) => (
                        <button
                          key={e}
                          onClick={() => selecionarPorErro(e)}
                          className="flex w-full items-start gap-1.5 rounded-lg border border-danger/40 bg-danger/10 p-2 text-left text-[11px] text-danger"
                        >
                          <AlertTriangle className="mt-px h-3 w-3 shrink-0" /> {e}
                        </button>
                      ))
                    ) : (
                      <p className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 p-2 text-[11px] text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Sem erros na validação.
                      </p>
                    )}
                    {validacao.avisos?.map((a) => (
                      <button
                        key={a}
                        onClick={() => selecionarPorErro(a)}
                        className="flex w-full items-start gap-1.5 rounded-lg border border-warning/40 bg-warning/10 p-2 text-left text-[11px] text-warning"
                      >
                        <AlertTriangle className="mt-px h-3 w-3 shrink-0" /> {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resultado" className="mt-3 min-h-0 flex-1 overflow-hidden">
          {id != null && <ResultadoFluxo fluxoId={id} resumo={resumo} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
