import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatarData } from "@/utils/formatters";
import { Info, Pencil, Search, Star, Trash2 } from "lucide-react";

type Exemplo = {
  id: string | number;
  conversa_id?: number | string | null;
  pergunta: string;
  resposta: string;
  ativo: boolean;
  curado: boolean;
  atualizado_em?: string | null;
};

type Filtro = "todos" | "curados" | "ativos" | "descartados";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "curados", rotulo: "Curados" },
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "descartados", rotulo: "Descartados" },
];

type Resumo = {
  total: number;
  curados: number;
  ativos: number;
  descartados: number;
};

export function AprendizadoAnnaTab() {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Exemplo | null>(null);
  const [editPergunta, setEditPergunta] = useState("");
  const [editResposta, setEditResposta] = useState("");
  const [excluindo, setExcluindo] = useState<Exemplo | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBusca(buscaInput.trim()), 400);
    return () => clearTimeout(t);
  }, [buscaInput]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["whatsapp-exemplos-treinamento", filtro, busca],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_exemplos_treinamento" as any, {
        p_busca: busca || null,
        p_filtro: filtro,
        p_limite: 200,
      });
      if (error) throw error;
      const payload = (Array.isArray(data) ? data[0] : data) as {
        resumo: Resumo;
        itens: Exemplo[];
      };
      return {
        resumo: payload?.resumo ?? { total: 0, curados: 0, ativos: 0, descartados: 0 },
        itens: payload?.itens ?? [],
      };
    },
  });

  const resumo = data?.resumo ?? { total: 0, curados: 0, ativos: 0, descartados: 0 };
  const itens = useMemo(() => {
    const lista = [...(data?.itens ?? [])];
    lista.sort((a, b) => Number(b.curado) - Number(a.curado));
    return lista;
  }, [data]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["whatsapp-exemplos-treinamento"] });
  };

  const curarMutation = useMutation({
    mutationFn: async ({ id, curado }: { id: Exemplo["id"]; curado: boolean }) => {
      const { error } = await supabase.rpc("whatsapp_curar_exemplo" as any, {
        p_id: id,
        p_curado: curado,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Exemplo atualizado" });
      invalidar();
    },
    onError: (e: Error) => toast({ title: "Não foi possível atualizar", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: Exemplo["id"]; ativo: boolean }) => {
      const { error } = await supabase.rpc("whatsapp_toggle_exemplo_treinamento" as any, {
        p_id: id,
        p_ativo: ativo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Exemplo atualizado" });
      invalidar();
    },
    onError: (e: Error) => toast({ title: "Não foi possível atualizar", description: e.message, variant: "destructive" }),
  });

  const editarMutation = useMutation({
    mutationFn: async ({ id, pergunta, resposta }: { id: Exemplo["id"]; pergunta: string; resposta: string }) => {
      const { data, error } = await supabase.rpc("whatsapp_editar_exemplo" as any, {
        p_id: id,
        p_pergunta: pergunta,
        p_resposta: resposta,
      });
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) as { ok?: boolean; erro?: string } | null;
      if (r && r.ok === false) throw new Error(r.erro ?? "Não foi possível salvar");
    },
    onSuccess: () => {
      toast({ title: "Exemplo salvo" });
      setEditando(null);
      invalidar();
    },
    onError: (e: Error) => toast({ title: "Não foi possível salvar", description: e.message, variant: "destructive" }),
  });

  const excluirMutation = useMutation({
    mutationFn: async (id: Exemplo["id"]) => {
      const { error } = await supabase.rpc("whatsapp_excluir_exemplo" as any, { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Exemplo excluído" });
      setExcluindo(null);
      invalidar();
    },
    onError: (e: Error) => toast({ title: "Não foi possível excluir", description: e.message, variant: "destructive" }),
  });

  const abrirEdicao = (ex: Exemplo) => {
    setEditando(ex);
    setEditPergunta(ex.pergunta);
    setEditResposta(ex.resposta);
  };

  const contadores = [
    { rotulo: "Total", valor: resumo.total },
    { rotulo: "Curados", valor: resumo.curados },
    { rotulo: "Ativos", valor: resumo.ativos },
    { rotulo: "Descartados", valor: resumo.descartados },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Os exemplos marcados com estrela ficam fixos no prompt da Anna. Os demais aparecem quando combinam com o assunto da conversa.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {contadores.map((c) => (
          <Card key={c.rotulo} className="px-3 py-2">
            <p className="text-xs text-muted-foreground">{c.rotulo}</p>
            <p className="text-xl font-semibold tabular-nums">{c.valor}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex rounded-md border border-border p-0.5">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltro(f.valor)}
              className={cn(
                "rounded px-3 py-1 text-xs transition-colors",
                filtro === f.valor
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            placeholder="Buscar na pergunta ou na resposta"
            className="pl-8"
          />
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      )}

      {error && (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar os exemplos.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </Card>
      )}

      {!isLoading && !error && itens.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum exemplo aqui ainda. Toda resposta de texto enviada pela equipe vira um exemplo automaticamente.
          </p>
        </Card>
      )}

      {!isLoading && !error && itens.length > 0 && (
        <div className="space-y-2">
          {itens.map((ex) => (
            <Card
              key={String(ex.id)}
              className={cn(
                "group relative p-4",
                ex.curado && "border-primary/50 bg-primary/5",
                !ex.ativo && "opacity-60",
              )}
            >
              <div className="absolute right-3 top-3 flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn("h-7 w-7", ex.curado ? "text-primary" : "text-muted-foreground/50")}
                      disabled={curarMutation.isPending}
                      onClick={() => curarMutation.mutate({ id: ex.id, curado: !ex.curado })}
                    >
                      <Star className={cn("h-4 w-4", ex.curado && "fill-current")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fixar no prompt da Anna</TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => abrirEdicao(ex)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setExcluindo(ex)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <p className="pr-24 text-xs text-muted-foreground">{ex.pergunta}</p>
              <p className="mt-2 whitespace-pre-wrap pr-24 text-sm">{ex.resposta}</p>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {ex.atualizado_em ? `Atualizado em ${formatarData(ex.atualizado_em)}` : null}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{ex.ativo ? "Ativo" : "Descartado"}</span>
                  <Switch
                    checked={ex.ativo}
                    disabled={toggleMutation.isPending}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: ex.id, ativo: v })}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar exemplo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ex-pergunta">Pergunta da cliente</Label>
              <Textarea
                id="ex-pergunta"
                value={editPergunta}
                onChange={(e) => setEditPergunta(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-resposta">Resposta da equipe</Label>
              <Textarea
                id="ex-resposta"
                value={editResposta}
                onChange={(e) => setEditResposta(e.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button
              disabled={editarMutation.isPending || !editPergunta.trim() || !editResposta.trim()}
              onClick={() =>
                editando &&
                editarMutation.mutate({
                  id: editando.id,
                  pergunta: editPergunta.trim(),
                  resposta: editResposta.trim(),
                })
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindo} onOpenChange={(open) => !open && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este exemplo?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O exemplo deixará de existir para sempre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => excluindo && excluirMutation.mutate(excluindo.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
