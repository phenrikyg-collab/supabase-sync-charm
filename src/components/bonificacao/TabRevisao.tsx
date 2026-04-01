import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { LancamentoRevisao, DefeitosMensais, HistoricoRevisoes } from "./RevisaoSections";
import CalculadoraBonusRevisoras from "./CalculadoraBonusRevisoras";

export default function TabRevisao() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");

  const { data: revisoras = [], isLoading } = useQuery({
    queryKey: ["revisoras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("revisoras").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const insert = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("revisoras").insert({ nome });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revisoras"] });
      toast.success("Revisora adicionada");
      setOpen(false);
      setNome("");
    },
    onError: () => toast.error("Erro ao salvar revisora"),
  });

  const toggleAtiva = useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) => {
      const { error } = await supabase.from("revisoras").update({ ativa }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["revisoras"] }),
  });

  return (
    <div className="space-y-6">
      {/* Revisoras */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-primary">Revisoras</CardTitle>
          <Button size="sm" onClick={() => { setNome(""); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova Revisora
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Ativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : revisoras.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Nenhuma revisora cadastrada</TableCell></TableRow>
              ) : (
                revisoras.map((r: any, i: number) => (
                  <TableRow key={r.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>
                      <Switch checked={r.ativa} onCheckedChange={(v) => toggleAtiva.mutate({ id: r.id, ativa: v })} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Revisora</DialogTitle></DialogHeader>
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => insert.mutate()} disabled={!nome.trim()}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>

      {/* Lançamento de Revisão */}
      <LancamentoRevisao />

      {/* Defeitos Mensais */}
      <DefeitosMensais />

      {/* Calculadora de Bônus */}
      <CalculadoraBonusRevisoras />

      {/* Histórico */}
      <HistoricoRevisoes />
    </div>
  );
}
