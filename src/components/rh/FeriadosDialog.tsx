import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { dataBRCompleta } from "@/lib/rh";
import { erroRh } from "./useRhAuth";

export function FeriadosDialog({
  open,
  onOpenChange,
  ano,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ano: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [data_, setData] = useState("");
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: feriados, isLoading } = useQuery({
    queryKey: ["rh-feriados", ano],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_feriados_listar", { p_ano: ano } as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["rh-feriados"] });
    qc.invalidateQueries({ queryKey: ["rh-folha-mes"] });
  };

  const adicionar = async () => {
    if (!data_ || !nome) return;
    setSalvando(true);
    const { error } = await supabase.rpc("rh_feriado_salvar", { p_data: data_, p_nome: nome } as any);
    setSalvando(false);
    if (error) return toast({ title: "Erro ao salvar feriado", description: erroRh(error).mensagem, variant: "destructive" });
    toast({ title: "Feriado adicionado" });
    setData("");
    setNome("");
    recarregar();
  };

  const remover = async (d: string) => {
    const { error } = await supabase.rpc("rh_feriado_remover", { p_data: String(d).slice(0, 10) } as any);
    if (error) return toast({ title: "Erro ao remover", description: erroRh(error).mensagem, variant: "destructive" });
    toast({ title: "Feriado removido" });
    recarregar();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-serif">Feriados · {ano}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Feriados alteram o cálculo do VT dos próximos meses gerados; já vem carregado com nacionais, SP e Santo André.
        </p>

        <div className="grid gap-3 sm:grid-cols-[150px_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Data</Label>
            <Input type="date" value={data_} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Aniversário da cidade" />
          </div>
          <Button size="sm" onClick={adicionar} disabled={salvando || !data_ || !nome}>Adicionar</Button>
        </div>

        <div className="max-h-72 overflow-y-auto border rounded-md">
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : !feriados?.length ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Nenhum feriado cadastrado.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {feriados.map((f: any) => (
                  <tr key={String(f.data)} className="border-b last:border-0">
                    <td className="px-3 py-2 tabular-nums w-28">{dataBRCompleta(f.data)}</td>
                    <td className="px-3 py-2">{f.nome ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => remover(f.data)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
