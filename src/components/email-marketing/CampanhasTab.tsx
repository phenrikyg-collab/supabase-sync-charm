import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Send, Loader2 } from "lucide-react";

type Campanha = {
  id: number | string;
  nome: string;
  assunto?: string | null;
  status?: string | null;
  total_destinatarios?: number | null;
  total_enviados?: number | null;
  total_falhas?: number | null;
  created_at?: string | null;
};

function statusInfo(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s.startsWith("envi") && s !== "enviando") return { label: "Concluída", variant: "default" as const };
  if (s === "enviando") return { label: "Enviando", variant: "secondary" as const };
  if (s === "concluida" || s === "concluída") return { label: "Concluída", variant: "default" as const };
  return { label: "Rascunho", variant: "outline" as const };
}

function NovaCampanhaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [listaId, setListaId] = useState("");

  const { data: templates = [] } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("templates_listar" as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const { data: listas = [] } = useQuery({
    queryKey: ["email-listas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listas_listar" as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("campanhas_criar" as any, {
        p_nome: nome,
        p_assunto: assunto,
        p_template_id: templateId,
        p_lista_id: listaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Campanha criada", description: "Ela ficou em rascunho." });
      queryClient.invalidateQueries({ queryKey: ["email-campanhas"] });
      onOpenChange(false);
      setNome(""); setAssunto(""); setTemplateId(""); setListaId("");
    },
    onError: (e: any) => toast({ title: "Erro ao criar campanha", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova campanha</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Assunto do e-mail</label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Template</label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecione o template" /></SelectTrigger>
              <SelectContent>
                {templates.map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Lista</label>
            <Select value={listaId} onValueChange={setListaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a lista" /></SelectTrigger>
              <SelectContent>
                {listas.map((l: any) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.nome} ({l.total_membros ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!nome.trim() || !assunto.trim() || !templateId || !listaId || criar.isPending}
            onClick={() => criar.mutate()}
          >
            {criar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CampanhasTab() {
  const queryClient = useQueryClient();
  const [novaAberta, setNovaAberta] = useState(false);
  const [pollingAtivo, setPollingAtivo] = useState(false);

  const { data: campanhas = [], isLoading } = useQuery({
    queryKey: ["email-campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("campanhas_listar" as any);
      if (error) throw error;
      return (data ?? []) as Campanha[];
    },
    refetchInterval: pollingAtivo ? 7000 : false,
  });

  useEffect(() => {
    setPollingAtivo(campanhas.some((c) => (c.status ?? "").toLowerCase() === "enviando"));
  }, [campanhas]);

  const enviar = useMutation({
    mutationFn: async (id: Campanha["id"]) => {
      const { error } = await supabase.rpc("campanhas_preparar_envio" as any, { p_campanha_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Envio iniciado", description: "Os destinatários foram enfileirados." });
      queryClient.invalidateQueries({ queryKey: ["email-campanhas"] });
    },
    onError: (e: any) => toast({ title: "Erro ao iniciar envio", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNovaAberta(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova campanha
        </Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Destinatários</TableHead>
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead className="text-right">Falhas</TableHead>
              <TableHead>Data</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && campanhas.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Nenhuma campanha criada ainda.</TableCell></TableRow>
            )}
            {campanhas.map((c) => {
              const st = (c.status ?? "rascunho").toLowerCase();
              const info = statusInfo(st);
              const total = c.total_destinatarios ?? 0;
              const enviados = c.total_enviados ?? 0;
              const pct = total > 0 ? Math.round((enviados / total) * 100) : 0;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{c.assunto}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={info.variant}>{info.label}</Badge>
                      {st === "enviando" && (
                        <div className="w-28">
                          <Progress value={pct} className="h-1.5" />
                          <span className="text-[10px] text-muted-foreground">{enviados}/{total}</span>
                        </div>
                      )}
                      {(st === "concluida" || st === "concluída") && (
                        <p className="text-[10px] text-muted-foreground">
                          {enviados} enviados, {c.total_falhas ?? 0} falhas
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{total}</TableCell>
                  <TableCell className="text-right">{enviados}</TableCell>
                  <TableCell className="text-right">{c.total_falhas ?? 0}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {st === "rascunho" && (
                      <Button size="sm" disabled={enviar.isPending} onClick={() => enviar.mutate(c.id)}>
                        <Send className="h-3.5 w-3.5 mr-1" /> Enviar agora
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <NovaCampanhaDialog open={novaAberta} onOpenChange={setNovaAberta} />
    </div>
  );
}
