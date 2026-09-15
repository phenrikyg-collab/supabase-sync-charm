import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Pencil, Plus, Search, Trash2, Zap } from "lucide-react";

export type RespostaRapida = {
  id: string | number;
  atalho: string;
  titulo: string;
  texto: string;
  categoria?: string | null;
  ativo?: boolean | null;
  usos?: number | null;
};

export function useRespostasRapidas(incluirInativas = false) {
  return useQuery({
    queryKey: ["whatsapp-respostas-rapidas", incluirInativas],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_respostas_rapidas" as any, {
        p_busca: null,
        p_incluir_inativas: incluirInativas,
      });
      if (error) throw error;
      return (data ?? []) as unknown as RespostaRapida[];
    },
  });
}

export function filtrarRespostas(lista: RespostaRapida[], termo: string) {
  const t = termo.trim().toLowerCase();
  if (!t) return lista;
  return lista.filter((r) =>
    [r.atalho, r.titulo, r.texto, r.categoria ?? ""].some((v) => (v ?? "").toLowerCase().includes(t)),
  );
}

export async function registrarUso(id: string | number) {
  await supabase.rpc("whatsapp_usar_resposta_rapida" as any, { p_id: id });
}

/** Lista navegável usada tanto pelo atalho "/" quanto pelo botão do compositor */
export function ListaRespostas({
  itens,
  indice,
  onIndice,
  onEscolher,
  vazio = "Nenhuma mensagem rápida encontrada.",
}: {
  itens: RespostaRapida[];
  indice: number;
  onIndice?: (i: number) => void;
  onEscolher: (r: RespostaRapida) => void;
  vazio?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    refs.current[indice]?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  if (itens.length === 0) {
    return <p className="p-3 text-xs text-muted-foreground">{vazio}</p>;
  }
  return (
    <div className="max-h-72 overflow-y-auto overscroll-contain p-1">
      {itens.map((r, i) => (
        <button
          key={String(r.id)}
          ref={(el) => (refs.current[i] = el)}
          type="button"
          onMouseEnter={() => onIndice?.(i)}
          onClick={() => onEscolher(r)}
          className={cn(
            "flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors",
            i === indice ? "bg-accent" : "hover:bg-accent/60",
          )}
        >
          <span className="flex w-full items-center gap-2">
            <span className="truncate text-xs font-semibold">{r.titulo}</span>
            <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              /{r.atalho}
            </span>
          </span>
          <span className="line-clamp-2 text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{r.texto}</span>
        </button>
      ))}
    </div>
  );
}

/** Botão de ícone no compositor que abre a mesma lista */
export function BotaoRespostasRapidas({ onEscolher }: { onEscolher: (r: RespostaRapida) => void }) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [indice, setIndice] = useState(0);
  const { data: lista = [] } = useRespostasRapidas(false);
  const itens = useMemo(() => filtrarRespostas(lista, termo), [lista, termo]);

  return (
    <Popover open={aberto} onOpenChange={(v) => { setAberto(v); setTermo(""); setIndice(0); }}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" title="Mensagens rápidas">
          <Zap className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b border-border p-2">
          <Input
            autoFocus
            value={termo}
            onChange={(e) => { setTermo(e.target.value); setIndice(0); }}
            placeholder="Buscar mensagem rápida"
            className="h-8 text-xs"
          />
        </div>
        <ListaRespostas
          itens={itens}
          indice={indice}
          onIndice={setIndice}
          onEscolher={(r) => { setAberto(false); onEscolher(r); }}
        />
      </PopoverContent>
    </Popover>
  );
}

function DialogResposta({
  aberto,
  onOpenChange,
  editando,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  editando: RespostaRapida | null;
}) {
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [atalho, setAtalho] = useState("");
  const [texto, setTexto] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setTitulo(editando?.titulo ?? "");
    setCategoria(editando?.categoria ?? "");
    setAtalho(editando?.atalho ?? "");
    setTexto(editando?.texto ?? "");
  }, [aberto, editando]);

  const salvar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_salvar_resposta_rapida" as any, {
        p_titulo: titulo.trim(),
        p_texto: texto.trim(),
        p_atalho: atalho.trim() || null,
        p_categoria: categoria.trim() || null,
        p_id: editando?.id ?? null,
        p_ativo: editando?.ativo ?? true,
      });
      if (error) throw error;
      const r = (data ?? {}) as any;
      if (r.ok === false) throw new Error(r.erro || "Não foi possível salvar");
      return r;
    },
    onSuccess: () => {
      toast({ title: editando ? "Mensagem atualizada" : "Mensagem criada" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-respostas-rapidas"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar mensagem rápida" : "Nova mensagem rápida"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Prazo de entrega" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Entrega" />
            </div>
            <div className="space-y-1.5">
              <Label>Atalho (opcional)</Label>
              <Input value={atalho} onChange={(e) => setAtalho(e.target.value)} placeholder="prazo-de-entrega" />
              <p className="text-[11px] text-muted-foreground">Se ficar vazio, o atalho sai do título.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Texto</Label>
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} placeholder="O que a atendente vai enviar" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || !titulo.trim() || !texto.trim()}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Aba de cadastro das mensagens rápidas */
export function MensagensRapidasTab() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<RespostaRapida | null>(null);
  const [excluir, setExcluir] = useState<RespostaRapida | null>(null);

  const { data: lista = [], isLoading } = useRespostasRapidas(true);
  const itens = useMemo(() => filtrarRespostas(lista, busca), [lista, busca]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, RespostaRapida[]>();
    for (const r of itens) {
      const chave = (r.categoria ?? "").trim() || "Sem categoria";
      mapa.set(chave, [...(mapa.get(chave) ?? []), r]);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [itens]);

  const alternarAtivo = useMutation({
    mutationFn: async (r: RespostaRapida) => {
      const { data, error } = await supabase.rpc("whatsapp_salvar_resposta_rapida" as any, {
        p_titulo: r.titulo,
        p_texto: r.texto,
        p_atalho: r.atalho,
        p_categoria: r.categoria ?? null,
        p_id: r.id,
        p_ativo: !(r.ativo ?? true),
      });
      if (error) throw error;
      const res = (data ?? {}) as any;
      if (res.ok === false) throw new Error(res.erro || "Não foi possível salvar");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp-respostas-rapidas"] }),
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const apagar = useMutation({
    mutationFn: async (id: string | number) => {
      const { error } = await supabase.rpc("whatsapp_excluir_resposta_rapida" as any, { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mensagem excluída" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-respostas-rapidas"] });
      setExcluir(null);
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar mensagem rápida" className="pl-8" />
        </div>
        <Button onClick={() => { setEditando(null); setDialogAberto(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nova mensagem rápida
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando mensagens rápidas…</p>}
      {!isLoading && itens.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma mensagem rápida cadastrada ainda.</p>
      )}

      {grupos.map(([categoria, itensGrupo]) => (
        <div key={categoria} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{categoria}</p>
          <div className="space-y-2">
            {itensGrupo.map((r) => (
              <Card key={String(r.id)} className={cn("p-3", !(r.ativo ?? true) && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{r.titulo}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        /{r.atalho}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{r.usos ?? 0} usos</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground [overflow-wrap:anywhere]">{r.texto}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      checked={r.ativo ?? true}
                      onCheckedChange={() => alternarAtivo.mutate(r)}
                      aria-label="Ativar ou desativar"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditando(r); setDialogAberto(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-danger" onClick={() => setExcluir(r)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <DialogResposta aberto={dialogAberto} onOpenChange={setDialogAberto} editando={editando} />

      <AlertDialog open={!!excluir} onOpenChange={(v) => !v && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta mensagem rápida?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir?.titulo} deixa de aparecer para a equipe. Essa ação não tem volta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluir && apagar.mutate(excluir.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
