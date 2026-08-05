import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Users, Search, X, ArrowLeft, Loader2 } from "lucide-react";

type Lista = {
  id: number | string;
  nome: string;
  descricao?: string | null;
  criterio_tipo?: string | null;
  criterio_config?: any;
  total_membros?: number | null;
};

const SEGMENTOS_RFM = [
  "Campeões",
  "Clientes Fiéis",
  "Potenciais Fiéis",
  "Novos Clientes",
  "Promissores",
  "Precisam Atenção",
  "Em Risco",
  "Não Posso Perdê-los",
  "Hibernando",
  "Perdidos",
];

const LABEL_CRITERIO: Record<string, string> = {
  manual: "Manual",
  rfm: "Segmento RFM",
  segmento: "Segmento RFM",
  tag: "Tag",
};

function NovaListaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<"manual" | "rfm" | "tag">("manual");
  const [segmento, setSegmento] = useState("");
  const [tagId, setTagId] = useState("");

  const { data: tags = [] } = useQuery({
    queryKey: ["whatsapp-tags"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_listar_tags" as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const criar = useMutation({
    mutationFn: async () => {
      const criterio_config =
        tipo === "manual" ? {} : tipo === "rfm" ? { segmento } : { tag_id: Number(tagId) };
      const { error } = await supabase.rpc("listas_criar" as any, {
        p_nome: nome,
        p_descricao: descricao || null,
        p_criterio_tipo: tipo,
        p_criterio_config: criterio_config,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lista criada" });
      queryClient.invalidateQueries({ queryKey: ["email-listas"] });
      onOpenChange(false);
      setNome(""); setDescricao(""); setTipo("manual"); setSegmento(""); setTagId("");
    },
    onError: (e: any) => toast({ title: "Erro ao criar lista", description: e.message, variant: "destructive" }),
  });

  const podeSalvar = nome.trim() && (tipo === "manual" || (tipo === "rfm" ? segmento : tagId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova lista</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Clientes VIP" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descrição</label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tipo de critério</label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (escolher clientes um a um)</SelectItem>
                <SelectItem value="rfm">Segmento RFM</SelectItem>
                <SelectItem value="tag">Tag</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipo === "rfm" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Segmento</label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger>
                <SelectContent>
                  {SEGMENTOS_RFM.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {tipo === "tag" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tag</label>
              <Select value={tagId} onValueChange={setTagId}>
                <SelectTrigger><SelectValue placeholder="Selecione a tag" /></SelectTrigger>
                <SelectContent>
                  {tags.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.nome ?? t.tag ?? `Tag ${t.id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!podeSalvar || criar.isPending} onClick={() => criar.mutate()}>
            {criar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar lista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalheLista({ lista, onVoltar }: { lista: Lista; onVoltar: () => void }) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const manual = (lista.criterio_tipo ?? "manual") === "manual";

  const { data: membros = [], isLoading: carregandoMembros } = useQuery({
    queryKey: ["email-lista-membros", lista.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listas_listar_membros" as any, { p_lista_id: lista.id });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: manual,
  });

  const { data: resultados = [], isFetching: buscando } = useQuery({
    queryKey: ["email-lista-busca", busca],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listas_buscar_clientes" as any, { p_busca: busca });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: manual && busca.trim().length >= 2,
  });

  const adicionar = useMutation({
    mutationFn: async (clienteId: any) => {
      const { error } = await supabase.rpc("listas_adicionar_membro" as any, {
        p_lista_id: lista.id,
        p_cliente_id: clienteId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-lista-membros", lista.id] });
      queryClient.invalidateQueries({ queryKey: ["email-listas"] });
    },
    onError: (e: any) => toast({ title: "Erro ao adicionar", description: e.message, variant: "destructive" }),
  });

  const remover = useMutation({
    mutationFn: async (clienteId: any) => {
      const { error } = await supabase.rpc("listas_remover_membro" as any, {
        p_lista_id: lista.id,
        p_cliente_id: clienteId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-lista-membros", lista.id] });
      queryClient.invalidateQueries({ queryKey: ["email-listas"] });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onVoltar}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div>
          <h2 className="font-serif text-xl">{lista.nome}</h2>
          <p className="text-xs text-muted-foreground">{lista.descricao}</p>
        </div>
      </div>

      {!manual ? (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-semibold">{lista.total_membros ?? 0}</p>
              <p className="text-sm text-muted-foreground">
                membros — lista dinâmica ({LABEL_CRITERIO[lista.criterio_tipo ?? ""] ?? lista.criterio_tipo}), atualizada automaticamente.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4 space-y-3">
            <p className="text-sm font-medium">Adicionar clientes</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por nome, e-mail ou telefone"
                value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {buscando && <p className="text-xs text-muted-foreground">Buscando…</p>}
              {!buscando && busca.trim().length >= 2 && resultados.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
              )}
              {resultados.map((c: any) => (
                <div key={c.id ?? c.cliente_id} className="flex items-center justify-between rounded border p-2">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{c.nome ?? c.cliente ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.email ?? c.telefone ?? ""}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => adicionar.mutate(c.id ?? c.cliente_id)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <p className="text-sm font-medium">Membros ({membros.length})</p>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {carregandoMembros && <p className="text-xs text-muted-foreground">Carregando…</p>}
              {!carregandoMembros && membros.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum cliente na lista ainda.</p>
              )}
              {membros.map((m: any) => (
                <div key={m.cliente_id ?? m.id} className="flex items-center justify-between rounded border p-2">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{m.nome ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email ?? m.telefone ?? ""}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remover.mutate(m.cliente_id ?? m.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function ListasTab() {
  const [novaAberta, setNovaAberta] = useState(false);
  const [selecionada, setSelecionada] = useState<Lista | null>(null);

  const { data: listas = [], isLoading } = useQuery({
    queryKey: ["email-listas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listas_listar" as any);
      if (error) throw error;
      return (data ?? []) as Lista[];
    },
  });

  const atual = selecionada ? listas.find((l) => String(l.id) === String(selecionada.id)) ?? selecionada : null;

  if (atual) return <DetalheLista lista={atual} onVoltar={() => setSelecionada(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNovaAberta(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova lista
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando listas…</p>
      ) : listas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma lista criada ainda.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listas.map((l) => (
            <Card key={l.id} className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelecionada(l)}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{l.nome}</h3>
                <Badge variant="secondary">{LABEL_CRITERIO[l.criterio_tipo ?? ""] ?? l.criterio_tipo ?? "—"}</Badge>
              </div>
              {l.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{l.descricao}</p>}
              <div className="flex items-center gap-1.5 mt-3 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{l.total_membros ?? 0}</span>
                <span className="text-muted-foreground">membros</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NovaListaDialog open={novaAberta} onOpenChange={setNovaAberta} />
    </div>
  );
}
