import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Copy, Pause, Play, Pencil, Archive, Plus, AlertTriangle } from "lucide-react";
import {
  popupsApi, ROTULO_FORMATO, ROTULO_OFERTA, dataHoraBR, nBR, pctBR,
  type Popup, type StatusPopup, type Validacao,
} from "@/lib/popups";
import { GaleriaModelos } from "@/components/popups/GaleriaModelos";
import { NotaCirculo } from "@/components/popups/NotaCirculo";
import { TabelaLeads } from "@/components/popups/TabelaLeads";

function ChipStatus({ p }: { p: Popup }) {
  if (p.status === "ativo" && p.no_ar_agora)
    return (
      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
        <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-success" />
        Ativo
      </Badge>
    );
  if (p.status === "ativo")
    return <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">Agendado</Badge>;
  if (p.status === "pausado")
    return <Badge variant="outline" className="border-border bg-foreground/10 text-foreground">Pausado</Badge>;
  if (p.status === "arquivado")
    return <Badge variant="outline" className="text-muted-foreground">Arquivado</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Rascunho</Badge>;
}

export default function Popups() {
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [galeria, setGaleria] = useState(false);
  const [incluirArquivados, setIncluirArquivados] = useState(false);
  const [errosAtivar, setErrosAtivar] = useState<string[] | null>(null);
  const [confirmarAtivar, setConfirmarAtivar] = useState<Popup | null>(null);

  const { data: lista, isLoading } = useQuery({
    queryKey: ["popups-listar", incluirArquivados],
    queryFn: () => popupsApi.listar(incluirArquivados),
  });

  const { data: config } = useQuery({ queryKey: ["popups-config"], queryFn: () => popupsApi.configObter() });

  const mudarStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: StatusPopup }) => popupsApi.alterarStatus(id, status),
    onSuccess: (r: { ok: boolean; validacao?: Validacao }, vars) => {
      if (!r?.ok) {
        setErrosAtivar(r?.validacao?.erros ?? ["Não foi possível ativar este popup."]);
        return;
      }
      qc.invalidateQueries({ queryKey: ["popups-listar"] });
      if (vars.status === "ativo") toast.success("Popup ativado. O site pode levar até 5 minutos para mostrar.");
      if (vars.status === "pausado") toast.success("Popup pausado. O site pode levar até 5 minutos para parar de mostrar.");
      if (vars.status === "arquivado") toast.success("Popup arquivado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicar = useMutation({
    mutationFn: (id: number) => popupsApi.duplicar(id),
    onSuccess: (novo) => {
      qc.invalidateQueries({ queryKey: ["popups-listar"] });
      toast.success("Cópia criada.");
      navegar(`/popups/${novo.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const linhas = useMemo(() => {
    const itens = (lista ?? []).filter((p) => (p.destino ?? "site") === "site");
    const grupos = new Map<string, Popup[]>();
    for (const p of itens) {
      const g = p.status === "ativo" && p.teste_ab_grupo ? String(p.teste_ab_grupo) : "";
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g)!.push(p);
    }
    const saida: { grupo: string | null; itens: Popup[] }[] = [];
    const soltos = grupos.get("") ?? [];
    for (const [g, arr] of grupos) {
      if (g && arr.length > 1) saida.push({ grupo: g, itens: arr });
      else if (g) soltos.push(...arr);
    }
    if (soltos.length) saida.unshift({ grupo: null, itens: soltos });
    return saida;
  }, [lista]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">Popups do site</h1>
          <p className="text-sm text-muted-foreground">Capture leads sem atrapalhar quem está comprando.</p>
        </div>
        <Button onClick={() => setGaleria(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo popup
        </Button>
      </div>

      {config && config.ativo === false && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Todos os popups estão desligados no site.
        </div>
      )}

      <Tabs defaultValue="popups">
        <TabsList>
          <TabsTrigger value="popups">Popups</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="popups" className="space-y-4 pt-4">
          <div className="flex items-center gap-2">
            <Switch id="arq" checked={incluirArquivados} onCheckedChange={setIncluirArquivados} />
            <Label htmlFor="arq" className="text-sm text-muted-foreground">Mostrar arquivados</Label>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !(lista ?? []).length ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhum popup ainda. Clique em Novo popup e escolha um modelo pronto.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>Oferta</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead className="text-right">Prioridade</TableHead>
                    <TableHead className="text-right">Impressões 7d</TableHead>
                    <TableHead className="text-right">Conversões 7d</TableHead>
                    <TableHead className="text-right">Taxa 7d</TableHead>
                    <TableHead>Atualizado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((bloco) => (
                    <Fragment key={bloco.grupo ?? "soltos"}>
                      {bloco.grupo && (
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={11} className="text-xs font-semibold uppercase tracking-wide">
                            Teste A/B: {bloco.grupo}
                          </TableCell>
                        </TableRow>
                      )}
                      {bloco.itens.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.nome}</TableCell>
                          <TableCell><ChipStatus p={p} /></TableCell>
                          <TableCell className="text-xs">{ROTULO_FORMATO[p.formato ?? ""] ?? p.formato}</TableCell>
                          <TableCell className="text-xs">{ROTULO_OFERTA[p.oferta?.tipo ?? "nenhuma"]}</TableCell>
                          <TableCell><NotaCirculo nota={p.diagnostico?.nota ?? p.nota} tamanho="sm" /></TableCell>
                          <TableCell className="text-right text-xs">{nBR(p.prioridade)}</TableCell>
                          <TableCell className="text-right text-xs">{nBR(p.impressoes_7d)}</TableCell>
                          <TableCell className="text-right text-xs">{nBR(p.conversoes_7d)}</TableCell>
                          <TableCell className="text-right text-xs">{pctBR(p.taxa_7d)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{dataHoraBR(p.atualizado_em)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" title="Editar" onClick={() => navegar(`/popups/${p.id}`)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Duplicar" onClick={() => duplicar.mutate(Number(p.id))}>
                                <Copy className="h-4 w-4" />
                              </Button>
                              {p.status === "ativo" ? (
                                <Button
                                  variant="ghost" size="icon" title="Pausar"
                                  onClick={() => mudarStatus.mutate({ id: Number(p.id), status: "pausado" })}
                                >
                                  <Pause className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button variant="ghost" size="icon" title="Ativar" onClick={() => setConfirmarAtivar(p)}>
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost" size="icon" title="Arquivar"
                                onClick={() => mudarStatus.mutate({ id: Number(p.id), status: "arquivado" })}
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="leads" className="pt-4">
          <TabelaLeads popupId={null} limite={500} />
        </TabsContent>

        <TabsContent value="config" className="pt-4">
          <AbaConfiguracoes />
        </TabsContent>
      </Tabs>

      <GaleriaModelos
        aberto={galeria}
        aoFechar={() => setGaleria(false)}
        aoCriar={(id) => { setGaleria(false); navegar(`/popups/${id}`); }}
      />

      <Dialog open={!!errosAtivar} onOpenChange={(v) => !v && setErrosAtivar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ainda não dá para ativar</DialogTitle></DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-danger">
            {(errosAtivar ?? []).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmarAtivar} onOpenChange={(v) => !v && setConfirmarAtivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar {confirmarAtivar?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Este popup vai aparecer para as clientes no site em até 5 minutos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmarAtivar?.id) mudarStatus.mutate({ id: Number(confirmarAtivar.id), status: "ativo" });
                setConfirmarAtivar(null);
              }}
            >
              Ativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AbaConfiguracoes() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["popups-config"], queryFn: () => popupsApi.configObter() });
  const [rascunho, setRascunho] = useState<any>(null);
  const [confirmarDesligar, setConfirmarDesligar] = useState(false);

  const atual = rascunho ?? data ?? null;

  const salvar = useMutation({
    mutationFn: (p: any) => popupsApi.configSalvar(p),
    onSuccess: (novo) => {
      setRascunho(null);
      qc.setQueryData(["popups-config"], novo);
      qc.invalidateQueries({ queryKey: ["popups-config"] });
      toast.success("Configuração salva.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !atual) return <Skeleton className="h-64 w-full" />;

  const mudar = (patch: any) => setRascunho({ ...atual, ...patch });

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Popups ligados no site</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Desligado, nenhum popup aparece para as clientes, mesmo os que estão ativos.
          </p>
          <Switch
            checked={!!atual.ativo}
            onCheckedChange={(v) => {
              if (!v) setConfirmarDesligar(true);
              else salvar.mutate({ ...atual, ativo: true });
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Limites gerais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Páginas excluídas em todos os popups (uma por linha)</Label>
            <Textarea
              rows={5}
              value={(atual.paginas_excluidas ?? []).join("\n")}
              onChange={(e) => mudar({ paginas_excluidas: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Máximo de popups por sessão</Label>
              <Input
                type="number" min={1} max={5}
                value={atual.max_por_sessao ?? 1}
                onChange={(e) => mudar({ max_por_sessao: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Intervalo mínimo entre popups (s)</Label>
              <Input
                type="number" min={0}
                value={atual.intervalo_min_s ?? 0}
                onChange={(e) => mudar({ intervalo_min_s: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Conversões por IP por hora</Label>
              <Input
                type="number" min={0}
                value={atual.limite_ip_hora ?? 0}
                onChange={(e) => mudar({ limite_ip_hora: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
          </div>
          <Button disabled={!rascunho || salvar.isPending} onClick={() => salvar.mutate(atual)}>
            {salvar.isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmarDesligar} onOpenChange={setConfirmarDesligar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desligar todos os popups?</AlertDialogTitle>
            <AlertDialogDescription>
              Nenhum popup vai aparecer no site enquanto esta chave estiver desligada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { salvar.mutate({ ...atual, ativo: false }); setConfirmarDesligar(false); }}>
              Desligar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
