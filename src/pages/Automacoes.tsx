import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Workflow, Users } from "lucide-react";
import { NovoFluxoDialog } from "@/components/automacoes/NovoFluxoDialog";
import { resumoGatilho } from "@/components/automacoes/tipos";

type Fluxo = {
  id: number | string;
  nome: string;
  descricao?: string | null;
  ativo?: boolean | null;
  gatilho_tipo?: string | null;
  gatilho_config?: any;
  execucoes_ativas?: number | null;
};

export default function Automacoes() {
  const queryClient = useQueryClient();
  const [novoAberto, setNovoAberto] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<Fluxo | null>(null);

  const { data: fluxos = [], isLoading } = useQuery({
    queryKey: ["automacoes-fluxos"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("automacoes_listar_fluxos" as any);
      if (error) throw error;
      return (data ?? []) as Fluxo[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: Fluxo["id"]; ativo: boolean }) => {
      const { error } = await supabase.rpc("automacoes_toggle_ativo" as any, {
        p_fluxo_id: id,
        p_ativo: ativo,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automacoes-fluxos"] }),
    onError: (e: any) => toast({ title: "Erro ao alterar status", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async (id: Fluxo["id"]) => {
      const { error } = await supabase.rpc("automacoes_deletar_fluxo" as any, { p_fluxo_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Fluxo excluído" });
      setParaExcluir(null);
      queryClient.invalidateQueries({ queryKey: ["automacoes-fluxos"] });
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl text-foreground">Automações</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Fluxos de relacionamento executados automaticamente a cada 15 minutos.
          </p>
        </div>
        <Button onClick={() => setNovoAberto(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo fluxo
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando fluxos…</p>}
      {!isLoading && fluxos.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          <Workflow className="h-10 w-10 mx-auto opacity-40 mb-3" />
          <p className="text-sm">Nenhum fluxo criado ainda.</p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fluxos.map((f) => (
          <Card key={String(f.id)} className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <Link to={`/automacoes/${f.id}`} className="min-w-0 hover:underline">
                <h2 className="font-medium truncate">{f.nome}</h2>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{f.descricao || "Sem descrição"}</p>
              </Link>
              <Switch
                checked={!!f.ativo}
                onCheckedChange={(v) => toggle.mutate({ id: f.id, ativo: v })}
                aria-label="Ativar fluxo"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[11px]">
                {resumoGatilho(f.gatilho_tipo, f.gatilho_config)}
              </Badge>
              <Badge variant="outline" className="text-[11px] gap-1">
                <Users className="h-3 w-3" />
                {f.execucoes_ativas ?? 0} ativas
              </Badge>
            </div>

            <div className="flex items-center gap-2 mt-auto pt-1">
              <Button asChild size="sm" variant="outline" className="flex-1">
                <Link to={`/automacoes/${f.id}`}>Abrir canvas</Link>
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setParaExcluir(f)} title="Excluir fluxo">
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <NovoFluxoDialog open={novoAberto} onOpenChange={setNovoAberto} />

      <AlertDialog open={!!paraExcluir} onOpenChange={(v) => !v && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
            <AlertDialogDescription>
              O fluxo "{paraExcluir?.nome}" e todos os seus nós serão removidos. Esta ação não pode ser desfeita.
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
