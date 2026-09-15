import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Copy, Mail, MessageSquare, MoreHorizontal, Pause, Play, Plus, Trash2, Workflow } from "lucide-react";
import { NovoFluxoDialog } from "@/components/automacoes/NovoFluxoDialog";
import { ROTULO_STATUS_FLUXO } from "@/components/automacoes/tipos";
import { rpcFluxos, tempoRelativo, type FluxoLista } from "@/components/automacoes/api";

const FILTROS: [string, string][] = [
  ["todos", "Todos"],
  ["ativo", "No ar"],
  ["pausado", "Pausados"],
  ["rascunho", "Rascunhos"],
  ["arquivado", "Arquivados"],
];

function BadgeStatus({ status }: { status: string }) {
  const classe =
    status === "ativo" ? "border-success/40 bg-success/10 text-success"
      : status === "pausado" ? "border-warning/40 bg-warning/10 text-warning"
        : status === "arquivado" ? "text-muted-foreground line-through"
          : "text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("text-[11px]", classe)}>
      {ROTULO_STATUS_FLUXO[status] ?? status}
    </Badge>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: any }) {
  return (
    <div>
      <p className="text-sm font-semibold">{Number(valor ?? 0).toLocaleString("pt-BR")}</p>
      <p className="text-[10px] text-muted-foreground">{rotulo}</p>
    </div>
  );
}

export default function Automacoes() {
  const queryClient = useQueryClient();
  const [novoAberto, setNovoAberto] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [paraExcluir, setParaExcluir] = useState<FluxoLista | null>(null);

  const { data: fluxos = [], isLoading } = useQuery({
    queryKey: ["fluxos-listar"],
    queryFn: async () => (await rpcFluxos<FluxoLista[]>("fluxos_listar", { p_dias: 30 })) ?? [],
  });

  const recarregar = () => queryClient.invalidateQueries({ queryKey: ["fluxos-listar"] });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: FluxoLista["id"]; status: string }) =>
      rpcFluxos<any>("fluxo_definir_status", { p_fluxo_id: id, p_status: status }),
    onSuccess: (d) => {
      if (d?.ok === false) {
        const erros: string[] = d?.validacao?.erros ?? [];
        toast({
          title: d?.motivo || "Corrija antes de ativar",
          description: erros.join(" "),
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Status alterado" });
      recarregar();
    },
    onError: (e: any) => toast({ title: "Não deu para alterar", description: e.message, variant: "destructive" }),
  });

  const duplicar = useMutation({
    mutationFn: async (id: FluxoLista["id"]) => rpcFluxos<any>("fluxo_duplicar", { p_fluxo_id: id }),
    onSuccess: () => { toast({ title: "Fluxo duplicado" }); recarregar(); },
    onError: (e: any) => toast({ title: "Não deu para duplicar", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async (id: FluxoLista["id"]) => rpcFluxos<any>("fluxo_excluir", { p_fluxo_id: id }),
    onSuccess: (d) => {
      toast({
        title: d?.arquivado ? "Fluxo arquivado" : d?.excluido ? "Fluxo excluído" : "Pedido processado",
        description: d?.motivo ?? undefined,
      });
      setParaExcluir(null);
      recarregar();
    },
    onError: (e: any) => toast({ title: "Não deu para excluir", description: e.message, variant: "destructive" }),
  });

  const lista = fluxos.filter((f) => filtro === "todos" || f.status === filtro);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl text-foreground">Automações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fluxos de e-mail e WhatsApp num lugar só. O motor roda a cada 5 minutos.
          </p>
        </div>
        <Button onClick={() => setNovoAberto(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo fluxo
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map(([v, r]) => (
          <Badge
            key={v}
            variant={filtro === v ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFiltro(v)}
          >
            {r}
          </Badge>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando fluxos…</p>}
      {!isLoading && lista.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          <Workflow className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">Nenhum fluxo neste filtro.</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((f) => {
          const canais = f.canais ?? [];
          const erro = f.ultimo_resultado?.erro;
          return (
            <Card key={String(f.id)} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/automacoes/${f.id}`} className="min-w-0 hover:underline">
                  <h2 className="truncate font-medium">{f.nome}</h2>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {f.descricao || "Sem descrição"}
                  </p>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link to={`/automacoes/${f.id}`}>Abrir</Link></DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicar.mutate(f.id)}>
                      <Copy className="mr-2 h-4 w-4" /> Duplicar
                    </DropdownMenuItem>
                    {f.status === "ativo" ? (
                      <DropdownMenuItem onClick={() => mudarStatus.mutate({ id: f.id, status: "pausado" })}>
                        <Pause className="mr-2 h-4 w-4" /> Pausar
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => mudarStatus.mutate({ id: f.id, status: "ativo" })}>
                        <Play className="mr-2 h-4 w-4" /> Ativar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-danger" onClick={() => setParaExcluir(f)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <BadgeStatus status={f.status} />
                {f.gatilho_rotulo && <Badge variant="secondary" className="text-[11px]">{f.gatilho_rotulo}</Badge>}
                {canais.includes("email") && <Mail className="h-3.5 w-3.5 text-primary" />}
                {canais.includes("whatsapp") && <MessageSquare className="h-3.5 w-3.5 text-success" />}
                {f.grupo_exclusivo && <Badge variant="outline" className="text-[11px]">{f.grupo_exclusivo}</Badge>}
                {f.sair_ao_comprar && <Badge variant="outline" className="text-[11px]">Sai ao comprar</Badge>}
              </div>

              <div className="grid grid-cols-5 gap-1 border-t border-border pt-2">
                <Numero rotulo="Entraram" valor={f.entraram} />
                <Numero rotulo="No fluxo" valor={f.ativos} />
                <Numero rotulo="Compraram" valor={f.sairam_comprando} />
                <Numero rotulo="E-mails" valor={f.emails_enviados} />
                <Numero rotulo="WhatsApp" valor={f.whatsapp_enviados} />
              </div>

              <div className="mt-auto space-y-1 pt-1">
                <p className="text-[11px] text-muted-foreground">
                  Última rodada: {tempoRelativo(f.ultima_execucao_em)}
                </p>
                {erro && <p className="text-[11px] text-danger">{String(erro)}</p>}
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to={`/automacoes/${f.id}`}>Abrir</Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <NovoFluxoDialog open={novoAberto} onOpenChange={setNovoAberto} />

      <AlertDialog open={!!paraExcluir} onOpenChange={(v) => !v && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
            <AlertDialogDescription>
              O fluxo "{paraExcluir?.nome}" sai da lista. Se já tiver histórico, ele é arquivado no lugar de apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => paraExcluir && excluir.mutate(paraExcluir.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
