import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useEdgesState, useNodesState,
  type Connection, type Edge, type Node, type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowLeft, MoreHorizontal, Save } from "lucide-react";
import { nodeTypes } from "@/components/automacoes/FluxoNode";
import { ConfigNoPanel } from "@/components/automacoes/ConfigNoPanel";
import { ConfiguracoesTab } from "@/components/automacoes/ConfiguracoesTab";
import { PessoasTab } from "@/components/automacoes/PessoasTab";
import {
  TIPOS_ARRASTAVEIS, TIPOS_NO, ROTULO_STATUS_FLUXO, type NoData, type TipoNo,
} from "@/components/automacoes/tipos";
import { rpcFluxos, useCatalogoFluxos, useFluxo, dataHoraBR, type Validacao } from "@/components/automacoes/api";

let contador = 1;
const novoRef = () => `novo-${Date.now()}-${contador++}`;

/** Ids numéricos do banco viram o ref usado no canvas (35 vira db-35). */
const paraRef = (valor: any) => {
  if (valor == null || valor === "") return valor;
  if (typeof valor === "number") return `db-${valor}`;
  if (typeof valor === "string" && /^\d+$/.test(valor)) return `db-${valor}`;
  return valor;
};

const configComRefs = (config: Record<string, any>) => {
  const c = { ...(config ?? {}) };
  if (c.no_id != null) c.no_id = paraRef(c.no_id);
  if (c.cupom_de_no != null) c.cupom_de_no = paraRef(c.cupom_de_no);
  return c;
};

type Aba = "canvas" | "pessoas" | "config";

function Editor({ fluxoId }: { fluxoId: string }) {
  const queryClient = useQueryClient();
  const [dias, setDias] = useState(30);
  const { data, isLoading } = useFluxo(fluxoId, dias);
  const { data: catalogo } = useCatalogoFluxos();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [fluxo, setFluxo] = useState<Record<string, any>>({});
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("canvas");
  const [sujo, setSujo] = useState(false);
  const [validacao, setValidacao] = useState<Validacao>({ ok: true, erros: [], avisos: [] });
  const [instancia, setInstancia] = useState<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [simulacao, setSimulacao] = useState<any>(null);
  const [disparoAberto, setDisparoAberto] = useState(false);
  const [testeAberto, setTesteAberto] = useState(false);
  const [errosDialogo, setErrosDialogo] = useState<string[] | null>(null);
  const [testeEmail, setTesteEmail] = useState("");
  const [testeTelefone, setTesteTelefone] = useState("");
  const [testeProdutos, setTesteProdutos] = useState("");
  const [resultadoTeste, setResultadoTeste] = useState<any>(null);

  // Carrega o fluxo no canvas
  useEffect(() => {
    if (!data) return;
    setFluxo(data.fluxo ?? {});
    setValidacao(data.validacao ?? { ok: true, erros: [], avisos: [] });

    const metricasNos = data.metricas?.nos ?? {};
    const refPorId = new Map<string, string>();
    const novos: Node[] = (data.nos ?? []).map((n, i) => {
      const ref = `db-${n.id}`;
      refPorId.set(String(n.id), ref);
      return {
        id: ref,
        type: "fluxo",
        position: { x: Number(n.x ?? 120), y: Number(n.y ?? 80 + i * 160) },
        deletable: n.tipo !== "gatilho",
        data: {
          tipo: (n.tipo ?? "fim") as TipoNo,
          rotulo: n.rotulo ?? "",
          config: configComRefs(n.config ?? {}),
          bancoId: n.id ?? null,
          gatilhoRotulo: data.fluxo?.gatilho_rotulo,
          metricas: metricasNos[String(n.id)] ?? null,
        } as unknown as Record<string, unknown>,
      };
    });

    if (!novos.some((n) => (n.data as any).tipo === "gatilho")) {
      novos.unshift({
        id: novoRef(),
        type: "fluxo",
        position: { x: 120, y: 40 },
        deletable: false,
        data: {
          tipo: "gatilho" as TipoNo,
          rotulo: "",
          config: {},
          bancoId: null,
          gatilhoRotulo: data.fluxo?.gatilho_rotulo,
        } as unknown as Record<string, unknown>,
      });
    }

    const novasEdges: Edge[] = (data.conexoes ?? []).map((c, i) => {
      const source = refPorId.get(String(c.origem)) ?? "";
      const target = refPorId.get(String(c.destino)) ?? "";
      const label = c.label ?? null;
      return {
        id: `edge-${c.id ?? i}`,
        source,
        target,
        sourceHandle: label === "sim" || label === "nao" ? label : null,
        label: label ?? undefined,
        animated: true,
      } as Edge;
    }).filter((e) => e.source && e.target);

    setNodes(novos);
    setEdges(novasEdges);
    setSujo(false);
  }, [data, setNodes, setEdges]);

  // Aviso ao sair com alterações não salvas
  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sujo]);

  const marcarSujo = () => setSujo(true);

  const onConnect = useCallback(
    (c: Connection) => {
      marcarSujo();
      setEdges((eds) =>
        addEdge({ ...c, animated: true, label: c.sourceHandle ?? undefined }, eds),
      );
    },
    [setEdges],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const tipo = event.dataTransfer.getData("application/automacao-no") as TipoNo;
      if (!tipo || !instancia) return;
      const posicao = instancia.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const meta = TIPOS_NO[tipo];
      setNodes((ns) => [
        ...ns,
        {
          id: novoRef(),
          type: "fluxo",
          position: posicao,
          data: {
            tipo,
            rotulo: "",
            config: { ...meta.configPadrao },
            bancoId: null,
          } as unknown as Record<string, unknown>,
        },
      ]);
      marcarSujo();
    },
    [instancia, setNodes],
  );

  const noSelecionado = nodes.find((n) => n.id === selecionado);

  const nosDoFluxo = useMemo(
    () =>
      nodes.map((n) => {
        const d = n.data as unknown as NoData;
        return { ref: n.id, tipo: d.tipo, rotulo: d.rotulo || TIPOS_NO[d.tipo]?.label || d.tipo };
      }),
    [nodes],
  );

  const atualizarNo = (patch: { rotulo?: string; config?: Record<string, any> }) => {
    if (!selecionado) return;
    setNodes((ns) =>
      ns.map((n) => (n.id === selecionado ? { ...n, data: { ...(n.data as any), ...patch } } : n)),
    );
    marcarSujo();
  };

  const removerNo = () => {
    if (!selecionado) return;
    setNodes((ns) => ns.filter((n) => n.id !== selecionado));
    setEdges((es) => es.filter((e) => e.source !== selecionado && e.target !== selecionado));
    setSelecionado(null);
    marcarSujo();
  };

  // Nós com erro de validação (mensagem cita o rótulo entre aspas)
  const rotulosComErro = useMemo(() => {
    const erros = validacao.erros ?? [];
    return new Set(
      erros
        .map((e) => /^"([^"]+)"/.exec(e)?.[1])
        .filter(Boolean) as string[],
    );
  }, [validacao]);

  const nodesRenderizados = useMemo(
    () =>
      nodes.map((n) => {
        const d = n.data as unknown as NoData;
        const rotulo = d.rotulo || TIPOS_NO[d.tipo]?.label || "";
        return {
          ...n,
          data: {
            ...(n.data as any),
            catalogo,
            gatilhoRotulo: fluxo.gatilho_rotulo,
            comErro: rotulosComErro.has(rotulo),
          },
        };
      }),
    [nodes, catalogo, fluxo.gatilho_rotulo, rotulosComErro],
  );

  const salvar = useMutation({
    mutationFn: async () => {
      const pNos = nodes.map((n) => {
        const d = n.data as unknown as NoData;
        return {
          ...(d.bancoId ? { id: d.bancoId } : {}),
          ref: n.id,
          tipo: d.tipo,
          rotulo: d.rotulo || null,
          config: d.config ?? {},
          x: Math.round(n.position.x),
          y: Math.round(n.position.y),
        };
      });
      const pConexoes = edges.map((e) => ({
        origem: e.source,
        destino: e.target,
        label: e.sourceHandle === "sim" || e.sourceHandle === "nao" ? e.sourceHandle : null,
      }));
      return rpcFluxos<any>("fluxo_salvar", {
        p_fluxo_id: fluxoId,
        p_fluxo: {
          nome: fluxo.nome,
          descricao: fluxo.descricao,
          gatilho_tipo: fluxo.gatilho_tipo,
          gatilho_config: fluxo.gatilho_config ?? {},
          publico_filtro: fluxo.publico_filtro ?? null,
          sair_ao_comprar: !!fluxo.sair_ao_comprar,
          grupo_exclusivo: fluxo.grupo_exclusivo ?? null,
          prioridade: fluxo.prioridade ?? 0,
          lote_max: fluxo.lote_max ?? null,
          repetir_por_cliente: !!fluxo.repetir_por_cliente,
          intervalo_minimo_dias: fluxo.intervalo_minimo_dias ?? null,
        },
        p_nos: pNos,
        p_conexoes: pConexoes,
      });
    },
    onSuccess: (d) => {
      toast({ title: "Fluxo salvo" });
      if (d?.validacao) setValidacao(d.validacao);
      setSujo(false);
      queryClient.invalidateQueries({ queryKey: ["fluxo", fluxoId] });
    },
    onError: (e: any) => toast({ title: "Não deu para salvar", description: e.message, variant: "destructive" }),
  });

  const definirStatus = useMutation({
    mutationFn: async (status: string) =>
      rpcFluxos<any>("fluxo_definir_status", { p_fluxo_id: fluxoId, p_status: status }),
    onSuccess: (d) => {
      if (d?.ok === false) {
        setValidacao(d?.validacao ?? validacao);
        setErrosDialogo(d?.validacao?.erros ?? [d?.motivo ?? "Corrija antes de ativar"]);
        return;
      }
      toast({ title: "Status alterado" });
      queryClient.invalidateQueries({ queryKey: ["fluxo", fluxoId] });
    },
    onError: (e: any) => toast({ title: "Não deu para alterar", description: e.message, variant: "destructive" }),
  });

  const simular = useMutation({
    mutationFn: async () => rpcFluxos<any>("fluxo_simular", { p_fluxo_id: fluxoId }),
    onSuccess: (d) => setSimulacao(d),
    onError: (e: any) => toast({ title: "Não deu para simular", description: e.message, variant: "destructive" }),
  });

  const disparar = useMutation({
    mutationFn: async () => rpcFluxos<any>("fluxo_disparar_agora", { p_fluxo_id: fluxoId }),
    onSuccess: (d) => {
      if (d?.ok === false) {
        toast({ title: d?.motivo ?? "Não deu para disparar", variant: "destructive" });
        return;
      }
      toast({
        title: `${d?.entraram ?? 0} entraram no fluxo`,
        description: `${d?.restaram_para_proxima ?? 0} ficaram para as próximas rodadas.`,
      });
      setDisparoAberto(false);
      queryClient.invalidateQueries({ queryKey: ["fluxo", fluxoId] });
    },
    onError: (e: any) => toast({ title: "Não deu para disparar", description: e.message, variant: "destructive" }),
  });

  const duplicar = useMutation({
    mutationFn: async () => rpcFluxos<any>("fluxo_duplicar", { p_fluxo_id: fluxoId }),
    onSuccess: () => toast({ title: "Fluxo duplicado" }),
    onError: (e: any) => toast({ title: "Não deu para duplicar", description: e.message, variant: "destructive" }),
  });

  const testar = useMutation({
    mutationFn: async () => {
      await salvar.mutateAsync();
      const ids = testeProdutos.split(",").map((s) => s.trim()).filter(Boolean);
      return rpcFluxos<any>("fluxo_testar", {
        p_fluxo_id: fluxoId,
        p_email: testeEmail.trim(),
        p_telefone: testeTelefone.trim() || null,
        p_produto_ids: ids.length ? ids : null,
      });
    },
    onSuccess: (d) => {
      if (d?.ok === false) {
        toast({ title: d?.motivo ?? "Não deu para testar", variant: "destructive" });
        return;
      }
      setResultadoTeste(d);
      toast({ title: "Teste disparado" });
    },
    onError: (e: any) => toast({ title: "Não deu para testar", description: e.message, variant: "destructive" }),
  });

  const status = String(fluxo.status ?? "rascunho");
  const erros = validacao.erros ?? [];
  const avisos = validacao.avisos ?? [];

  return (
    <div className="mx-auto max-w-[1700px] space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="icon" variant="ghost">
          <Link to="/automacoes" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <Input
          className="h-9 w-[280px] font-medium"
          value={fluxo.nome ?? ""}
          onChange={(e) => { setFluxo((f) => ({ ...f, nome: e.target.value })); marcarSujo(); }}
        />
        <Badge variant="outline" className="text-[11px]">{ROTULO_STATUS_FLUXO[status] ?? status}</Badge>
        {sujo && <span className="text-xs text-warning">Alterações não salvas</span>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            <Save className="mr-2 h-4 w-4" /> Salvar
          </Button>
          <Button size="sm" variant="outline" onClick={() => simular.mutate()} disabled={simular.isPending}>
            Simular
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setResultadoTeste(null); setTesteAberto(true); }}>
            Testar
          </Button>
          {status === "ativo" ? (
            <Button size="sm" variant="outline" onClick={() => definirStatus.mutate("pausado")}>Pausar</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => definirStatus.mutate("ativo")}>Ativar</Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {status === "ativo" && (
                <DropdownMenuItem onClick={() => { simular.mutate(); setDisparoAberto(true); }}>
                  Disparar agora
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => duplicar.mutate()}>Duplicar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => definirStatus.mutate("arquivado")}>Arquivar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {erros.length > 0 && (
        <Card className="border-danger/40 bg-danger/5 p-3">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-danger">
            <AlertTriangle className="h-4 w-4" /> Corrija antes de ativar
          </p>
          <ul className="list-inside list-disc text-xs text-danger">
            {erros.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </Card>
      )}
      {avisos.length > 0 && (
        <Card className="border-warning/40 bg-warning/5 p-3">
          <ul className="list-inside list-disc text-xs text-warning">
            {avisos.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </Card>
      )}

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="canvas">Canvas</TabsTrigger>
          <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="canvas">
          <div className="grid h-[calc(100vh-17rem)] grid-cols-1 gap-3 lg:grid-cols-[210px_1fr_340px]">
            <Card className="space-y-2 overflow-y-auto p-3">
              <p className="text-xs font-medium text-muted-foreground">Passos</p>
              {TIPOS_ARRASTAVEIS.map((t) => {
                const meta = TIPOS_NO[t];
                const Icone = meta.icon;
                return (
                  <div
                    key={t}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/automacao-no", t);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="cursor-grab rounded-md border border-border px-2 py-2 hover:bg-accent/60 active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2">
                      <Icone className={cn("h-4 w-4", meta.cor)} />
                      <span className="text-xs font-medium">{meta.label}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{meta.descricao}</p>
                  </div>
                );
              })}
            </Card>

            <Card className="relative overflow-hidden" ref={wrapperRef as any}>
              <div className="absolute right-3 top-3 z-10 flex gap-1">
                {[7, 30, 90].map((d) => (
                  <Badge
                    key={d}
                    variant={dias === d ? "default" : "outline"}
                    className="cursor-pointer text-[11px]"
                    onClick={() => setDias(d)}
                  >
                    {d} dias
                  </Badge>
                ))}
              </div>
              {isLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Carregando fluxo…</p>
              ) : (
                <div className="h-full w-full" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
                  <ReactFlow
                    nodes={nodesRenderizados}
                    edges={edges}
                    onNodesChange={(c) => { onNodesChange(c); if (c.some((x) => x.type !== "select")) marcarSujo(); }}
                    onEdgesChange={(c) => { onEdgesChange(c); marcarSujo(); }}
                    onConnect={onConnect}
                    onInit={setInstancia}
                    nodeTypes={nodeTypes}
                    onNodeClick={(_, n) => setSelecionado(n.id)}
                    onPaneClick={() => setSelecionado(null)}
                    fitView
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background />
                    <Controls />
                    <MiniMap pannable zoomable className="!bg-muted" />
                  </ReactFlow>
                </div>
              )}
            </Card>

            <div className="hidden overflow-hidden lg:block">
              {noSelecionado ? (
                <ConfigNoPanel
                  data={noSelecionado.data as unknown as NoData}
                  catalogo={catalogo}
                  nosDoFluxo={nosDoFluxo}
                  onChange={atualizarNo}
                  onRemover={removerNo}
                  onFechar={() => setSelecionado(null)}
                  onIrConfiguracoes={() => setAba("config")}
                />
              ) : (
                <Card className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                  Escolha um passo para configurar.
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pessoas">
          <PessoasTab fluxoId={fluxoId} />
        </TabsContent>

        <TabsContent value="config">
          <ConfiguracoesTab
            fluxo={fluxo}
            catalogo={catalogo}
            onChange={(p) => { setFluxo((f) => ({ ...f, ...p })); marcarSujo(); }}
          />
        </TabsContent>
      </Tabs>

      {/* Simulação */}
      <Dialog open={!!simulacao && !disparoAberto} onOpenChange={(v) => !v && setSimulacao(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Quem entraria agora</DialogTitle></DialogHeader>
          <p className="text-sm">Entrariam agora: {Number(simulacao?.entrariam ?? 0).toLocaleString("pt-BR")}</p>
          <p className="text-sm">
            Nesta rodada: {Number(simulacao?.entram_nesta_rodada ?? 0).toLocaleString("pt-BR")} (lote de{" "}
            {Number(simulacao?.lote_max ?? 0).toLocaleString("pt-BR")})
          </p>
          <div className="space-y-1">
            {(simulacao?.amostra ?? []).map((p: any, i: number) => (
              <p key={i} className="text-xs text-muted-foreground">
                {p.nome ? `${p.nome}: ` : ""}{p.email}{p.telefone ? `, ${p.telefone}` : ""}
              </p>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Disparo manual */}
      <Dialog open={disparoAberto} onOpenChange={(v) => { setDisparoAberto(v); if (!v) setSimulacao(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disparar agora</DialogTitle>
            <DialogDescription>
              Entrariam agora: {Number(simulacao?.entrariam ?? 0).toLocaleString("pt-BR")}. Nesta rodada:{" "}
              {Number(simulacao?.entram_nesta_rodada ?? 0).toLocaleString("pt-BR")}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisparoAberto(false)}>Cancelar</Button>
            <Button onClick={() => disparar.mutate()} disabled={disparar.isPending}>Disparar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teste */}
      <Dialog open={testeAberto} onOpenChange={setTesteAberto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Testar o fluxo</DialogTitle>
            <DialogDescription>O teste envia de verdade para esse e-mail e telefone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">E-mail</Label>
              <Input value={testeEmail} onChange={(e) => setTesteEmail(e.target.value)} placeholder="voce@exemplo.com.br" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input value={testeTelefone} onChange={(e) => setTesteTelefone(e.target.value)} placeholder="para testar WhatsApp" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Produtos</Label>
              <Input
                value={testeProdutos}
                onChange={(e) => setTesteProdutos(e.target.value)}
                placeholder="ids separados por vírgula, opcional"
              />
            </div>

            {resultadoTeste?.timeline && (
              <div className="space-y-1 rounded-md border border-border p-2">
                {(resultadoTeste.timeline?.passos ?? []).map((p: any, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {dataHoraBR(p.em)} {p.no ?? p.tipo}: {p.acao}
                  </p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTesteAberto(false)}>Fechar</Button>
            <Button disabled={!testeEmail.trim() || testar.isPending} onClick={() => testar.mutate()}>
              Salvar e testar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Erros ao ativar */}
      <Dialog open={!!errosDialogo} onOpenChange={(v) => !v && setErrosDialogo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Corrija antes de ativar</DialogTitle></DialogHeader>
          <ul className="list-inside list-disc text-sm text-danger">
            {(errosDialogo ?? []).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AutomacaoFluxo() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <ReactFlowProvider>
      <Editor fluxoId={id} />
    </ReactFlowProvider>
  );
}
