import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Send, Loader2, AlertTriangle } from "lucide-react";

type Campanha = {
  id: number | string;
  nome: string;
  status?: string | null;
  total_destinatarios?: number | null;
  total_enviados?: number | null;
  total_falhas?: number | null;
  created_at?: string | null;
  data_envio?: string | null;
  concluida_em?: string | null;
};

function fmtData(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("pt-BR");
}

function statusBadge(status?: string | null) {
  const s = (status ?? "rascunho").toLowerCase();
  if (s === "enviando") return <Badge variant="secondary">Enviando</Badge>;
  if (s.startsWith("conclu")) return <Badge>Concluída</Badge>;
  if (s === "erro" || s === "falha") return <Badge variant="destructive">Erro</Badge>;
  return <Badge variant="outline">Rascunho</Badge>;
}

function NovaCampanhaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [listaId, setListaId] = useState("");
  const [variaveis, setVariaveis] = useState<string[]>([]);

  const { data: templates = [] } = useQuery({
    queryKey: ["wpp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_templates_listar" as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const aprovados = templates.filter(
    (t: any) => (t.status_aprovacao ?? "").toLowerCase() === "aprovado"
  );

  const { data: listas = [] } = useQuery({
    queryKey: ["wpp-listas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listas_listar" as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const criar = useMutation({
    mutationFn: async () => {
      const variaveis_fixas: Record<string, string> = {};
      variaveis.forEach((v, i) => {
        if (v.trim() !== "") variaveis_fixas[String(i + 2)] = v;
      });
      const { error } = await supabase.rpc("campanhas_whatsapp_criar" as any, {
        p_nome: nome,
        p_template_id: templateId,
        p_lista_id: listaId,
        p_variaveis_fixas: variaveis_fixas,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Campanha criada" });
      queryClient.invalidateQueries({ queryKey: ["wpp-campanhas"] });
      onOpenChange(false);
      setNome(""); setTemplateId(""); setListaId(""); setVariaveis([]);
    },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova campanha</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Template aprovado</Label>
            {aprovados.length === 0 ? (
              <p className="text-sm text-destructive flex items-center gap-2 mt-1">
                <AlertTriangle className="h-4 w-4" /> Nenhum template aprovado ainda
              </p>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {aprovados.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Lista / segmento</Label>
            <Select value={listaId} onValueChange={setListaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {listas.map((l: any) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.nome} ({l.total_membros ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Variáveis fixas extras (opcional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              {"{{1}}"} é sempre o primeiro nome do cliente, preenchido automaticamente. Preencha
              aqui apenas {"{{2}}"}, {"{{3}}"}... com o mesmo valor para todos.
            </p>
            <div className="space-y-2">
              {variaveis.map((v, i) => (
                <Input
                  key={i}
                  value={v}
                  placeholder={`Valor para {{${i + 2}}}`}
                  onChange={(e) =>
                    setVariaveis((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                  }
                />
              ))}
              <Button variant="outline" size="sm" onClick={() => setVariaveis((p) => [...p, ""])}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar variável
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => criar.mutate()} disabled={!nome || !templateId || !listaId || criar.isPending}>
            {criar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FalhasDialog({ campanha, onOpenChange }: { campanha: Campanha | null; onOpenChange: (v: boolean) => void }) {
  const { data: falhas = [], isLoading } = useQuery({
    queryKey: ["wpp-campanha-falhas", campanha?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("campanhas_whatsapp_listar_falhas" as any, {
        p_campanha_id: campanha!.id,
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!campanha,
  });

  return (
    <Dialog open={!!campanha} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Falhas — {campanha?.nome}</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : falhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum detalhe de falha disponível.</p>
        ) : (
          <div className="space-y-2">
            {falhas.map((f: any, i: number) => (
              <div key={i} className="border rounded-md p-2 text-sm">
                <p className="font-medium">{f.nome ?? f.telefone ?? "Destinatário"}</p>
                <p className="text-xs text-destructive">{f.erro ?? f.mensagem_erro ?? "Erro desconhecido"}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CampanhasWppTab() {
  const queryClient = useQueryClient();
  const [nova, setNova] = useState(false);
  const [falhasDe, setFalhasDe] = useState<Campanha | null>(null);

  const { data: campanhas = [], isLoading } = useQuery({
    queryKey: ["wpp-campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("campanhas_whatsapp_listar" as any);
      if (error) throw error;
      return (data ?? []) as Campanha[];
    },
    refetchInterval: (query) => {
      const linhas = (query.state.data ?? []) as Campanha[];
      return linhas.some((c) => (c.status ?? "").toLowerCase() === "enviando") ? 7000 : false;
    },
  });

  const disparar = useMutation({
    mutationFn: async (id: number | string) => {
      const { error } = await supabase.rpc("campanhas_whatsapp_preparar_envio" as any, {
        p_campanha_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Campanha em envio", description: "O motor processa cerca de 50 mensagens por minuto." });
      queryClient.invalidateQueries({ queryKey: ["wpp-campanhas"] });
    },
    onError: (e: any) => toast({ title: "Erro ao disparar", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNova(true)}><Plus className="h-4 w-4 mr-2" /> Nova campanha</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : campanhas.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhuma campanha criada ainda.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Destinatários</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead className="text-right">Falhas</TableHead>
                <TableHead>Criada</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas.map((c) => {
                const status = (c.status ?? "rascunho").toLowerCase();
                const total = c.total_destinatarios ?? 0;
                const enviados = c.total_enviados ?? 0;
                const pct = total > 0 ? Math.round((enviados / total) * 100) : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">{c.nome}</p>
                      {status === "enviando" && (
                        <div className="mt-1 w-40">
                          <Progress value={pct} className="h-1.5" />
                          <p className="text-[11px] text-muted-foreground mt-0.5">{enviados}/{total}</p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(status)}</TableCell>
                    <TableCell className="text-right">{total}</TableCell>
                    <TableCell className="text-right">{enviados}</TableCell>
                    <TableCell className="text-right">
                      {(c.total_falhas ?? 0) > 0 ? (
                        <button className="text-destructive underline" onClick={() => setFalhasDe(c)}>
                          {c.total_falhas}
                        </button>
                      ) : 0}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtData(c.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {status === "rascunho" && (
                        <Button size="sm" variant="outline" onClick={() => disparar.mutate(c.id)} disabled={disparar.isPending}>
                          <Send className="h-4 w-4 mr-2" /> Disparar
                        </Button>
                      )}
                      {status.startsWith("conclu") && (
                        <span className="text-xs text-muted-foreground">
                          {enviados} enviados · {c.total_falhas ?? 0} falhas
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <NovaCampanhaDialog open={nova} onOpenChange={setNova} />
      <FalhasDialog campanha={falhasDe} onOpenChange={(v) => !v && setFalhasDe(null)} />
    </div>
  );
}
