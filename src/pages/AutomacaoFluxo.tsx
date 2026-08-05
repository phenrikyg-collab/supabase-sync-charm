import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useEdgesState, useNodesState,
  type Connection, type Edge, type Node, type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save } from "lucide-react";
import { nodeTypes } from "@/components/automacoes/FluxoNode";
import { ConfigNoPanel } from "@/components/automacoes/ConfigNoPanel";
import { TIPOS_ARRASTAVEIS, TIPOS_NO, resumoGatilho, type NoData, type TipoNo } from "@/components/automacoes/tipos";
import { ExecucoesTab } from "@/components/automacoes/ExecucoesTab";

let contador = 1;
const novoId = () => `no-${Date.now()}-${contador++}`;

function Canvas({ fluxoId }: { fluxoId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [instancia, setInstancia] = useState<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["automacoes-fluxo", fluxoId],
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc("automacoes_get_fluxo" as any, { p_fluxo_id: fluxoId });
      if (error) throw error;
      return (d ?? {}) as { fluxo?: any; nos?: any[]; conexoes?: any[] };
    },
  });

  const fluxo = data?.fluxo;

  useEffect(() => {
    if (!data) return;
    const nos = data.nos ?? [];
    const idPorNo = new Map<string, string>();

    const novosNodes: Node[] = nos.map((n: any, i: number) => {
      const rfId = `db-${n.id ?? i}`;
      idPorNo.set(String(n.id ?? i), rfId);
      return {
        id: rfId,
        type: "fluxo",
        position: { x: Number(n.posicao_x ?? 80 + i * 220), y: Number(n.posicao_y ?? 120) },
        data: {
          tipo: (n.tipo ?? "fim") as TipoNo,
          config: n.config ?? {},
          gatilhoTipo: data.fluxo?.gatilho_tipo,
          gatilhoConfig: data.fluxo?.gatilho_config,
        } as unknown as Record<string, unknown>,
        deletable: n.tipo !== "gatilho",
      };
    });

    if (!novosNodes.some((n) => (n.data as any).tipo === "gatilho")) {
      novosNodes.unshift({
        id: novoId(),
        type: "fluxo",
        position: { x: 60, y: 140 },
        data: {
          tipo: "gatilho" as TipoNo,
          config: {},
          gatilhoTipo: data.fluxo?.gatilho_tipo,
          gatilhoConfig: data.fluxo?.gatilho_config,
        } as unknown as Record<string, unknown>,
        deletable: false,
      });
    }

    const novasEdges: Edge[] = (data.conexoes ?? []).map((c: any, i: number) => {
      const source = idPorNo.get(String(c.origem_no_id ?? c.origem_id ?? c.origem_temp_id)) ?? "";
      const target = idPorNo.get(String(c.destino_no_id ?? c.destino_id ?? c.destino_temp_id)) ?? "";
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

    setNodes(novosNodes);
    setEdges(novasEdges);
  }, [data, setNodes, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true, label: c.sourceHandle ?? undefined }, eds)),
    [setEdges],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const tipo = event.dataTransfer.getData("application/automacao-no") as TipoNo;
      if (!tipo || !instancia) return;
      const position = instancia.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setNodes((nds) =>
        nds.concat({
          id: novoId(),
          type: "fluxo",
          position,
          data: { tipo, config: { ...TIPOS_NO[tipo].configPadrao } } as unknown as Record<string, unknown>,
        }),
      );
    },
    [instancia, setNodes],
  );

  const noSelecionado = useMemo(() => nodes.find((n) => n.id === selecionado) ?? null, [nodes, selecionado]);

  const atualizarConfig = (config: Record<string, any>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === selecionado ? { ...n, data: { ...n.data, config } } : n)),
    );
  };

  const removerNo = () => {
    setNodes((nds) => nds.filter((n) => n.id !== selecionado));
    setEdges((eds) => eds.filter((e) => e.source !== selecionado && e.target !== selecionado));
    setSelecionado(null);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const nos = nodes.map((n) => ({
        tipo: (n.data as any).tipo,
        config: (n.data as any).config ?? {},
        posicao_x: n.position.x,
        posicao_y: n.position.y,
      }));
      const idParaIndice = Object.fromEntries(nodes.map((n, i) => [n.id, i]));
      const conexoes = edges
        .filter((e) => idParaIndice[e.source] !== undefined && idParaIndice[e.target] !== undefined)
        .map((e) => ({
          origem_temp_id: idParaIndice[e.source],
          destino_temp_id: idParaIndice[e.target],
          label: e.sourceHandle === "sim" ? "sim" : e.sourceHandle === "nao" ? "nao" : null,
        }));

      const { error } = await supabase.rpc("automacoes_salvar_fluxo" as any, {
        p_fluxo_id: fluxoId,
        p_nos: nos,
        p_conexoes: conexoes,
      });
      if (error) throw error;
      toast({ title: "Fluxo salvo" });
      refetch();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link to="/automacoes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-serif text-3xl text-foreground">{fluxo?.nome ?? "Fluxo"}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-[11px]">
                {resumoGatilho(fluxo?.gatilho_tipo, fluxo?.gatilho_config)}
              </Badge>
              <Badge variant={fluxo?.ativo ? "default" : "outline"} className="text-[11px]">
                {fluxo?.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
        </div>
        <Button onClick={salvar} disabled={salvando}>
          <Save className="h-4 w-4 mr-2" />
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[190px_1fr_300px] gap-4 h-[calc(100vh-260px)] min-h-[520px]">
        {/* Paleta */}
        <Card className="p-3 space-y-2 overflow-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Blocos</p>
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
                className="flex items-center gap-2 rounded-md border border-border px-2 py-2 cursor-grab active:cursor-grabbing hover:bg-accent/60"
              >
                <Icone className={`h-4 w-4 ${meta.cor}`} />
                <span className="text-xs">{meta.label}</span>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground pt-2">
            Arraste um bloco para o canvas e clique nele para configurar.
          </p>
        </Card>

        {/* Canvas */}
        <Card className="overflow-hidden" ref={wrapperRef as any}>
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando fluxo…</p>
          ) : (
            <div className="h-full w-full" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
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

        {/* Config */}
        <div className="hidden lg:block overflow-hidden">
          {noSelecionado ? (
            <ConfigNoPanel
              data={noSelecionado.data as unknown as NoData}
              onChange={atualizarConfig}
              onRemover={removerNo}
              onFechar={() => setSelecionado(null)}
            />
          ) : (
            <Card className="h-full flex items-center justify-center text-sm text-muted-foreground p-4 text-center">
              Selecione um nó para configurar
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AutomacaoFluxo() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      <Tabs defaultValue="canvas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="canvas">Canvas</TabsTrigger>
          <TabsTrigger value="execucoes">Execuções</TabsTrigger>
        </TabsList>
        <TabsContent value="canvas">
          <ReactFlowProvider>
            <Canvas fluxoId={id} />
          </ReactFlowProvider>
        </TabsContent>
        <TabsContent value="execucoes">
          <ExecucoesTab fluxoId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
