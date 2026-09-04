import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToastAction } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { brl, dataBRCompleta, hojeISO } from "@/lib/rh";
import { erroRh } from "./useRhAuth";
import type { ValeFolha } from "./useFolha";

export function ValesSection({
  funcionarioId,
  competencia,
  onMudou,
}: {
  funcionarioId: string;
  competencia: string;
  onMudou: () => void;
}) {
  const { toast } = useToast();
  const [novo, setNovo] = useState(false);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [regerando, setRegerando] = useState(false);

  const { data: vales, isLoading, refetch } = useQuery({
    queryKey: ["rh-vales", competencia, funcionarioId],
    queryFn: async (): Promise<ValeFolha[]> => {
      const { data, error } = await supabase.rpc("rh_vales_listar", {
        p_competencia: competencia,
        p_funcionario_id: funcionarioId,
      } as any);
      if (error) throw error;
      const arr = Array.isArray(data) ? data : ((data as any)?.vales ?? []);
      return arr as ValeFolha[];
    },
    enabled: !!competencia && !!funcionarioId,
  });

  const regerar = async () => {
    setRegerando(true);
    const { error } = await supabase.rpc("rh_holerites_gerar", {
      p_competencia: competencia,
      p_tipo: "fechamento",
    } as any);
    setRegerando(false);
    if (error)
      return toast({ title: "Erro ao regerar holerite", description: erroRh(error).mensagem, variant: "destructive" });
    toast({ title: "Holerite de fechamento regerado" });
    onMudou();
  };

  const avisar = (aviso?: string | null, titulo = "Vale atualizado") =>
    toast({
      title: titulo,
      description: aviso ?? "Regere o holerite de fechamento para atualizar o líquido.",
      action: (
        <ToastAction altText="Regerar holerite de fechamento" onClick={regerar}>
          Regerar holerite
        </ToastAction>
      ),
    });

  const registrar = async () => {
    const v = Number(String(valor).replace(",", "."));
    if (!v || v <= 0) return toast({ title: "Informe um valor válido", variant: "destructive" });
    if (!funcionarioId)
      return toast({
        title: "Não foi possível registrar o vale",
        description: "Funcionário não identificado. Recarregue a folha e tente novamente.",
        variant: "destructive",
      });
    setSalvando(true);
    const { data: r, error } = await supabase.rpc("rh_vale_registrar", {
      p_funcionario_id: funcionarioId,
      p_competencia: competencia,
      p_valor: v,
      p_descricao: motivo || null,
      p_data: data || hojeISO(),
    } as any);
    setSalvando(false);
    if (error)
      return toast({ title: "Erro ao registrar vale", description: erroRh(error).mensagem, variant: "destructive" });
    const res: any = Array.isArray(r) ? r[0] : r;
    setNovo(false);
    setValor("");
    setMotivo("");
    setData(hojeISO());
    refetch();
    onMudou();
    avisar(res?.aviso, "Vale registrado");
  };

  const remover = async (id: string) => {
    const { data: r, error } = await supabase.rpc("rh_vale_remover", { p_id: id } as any);
    if (error)
      return toast({ title: "Erro ao excluir vale", description: erroRh(error).mensagem, variant: "destructive" });
    const res: any = Array.isArray(r) ? r[0] : r;
    refetch();
    onMudou();
    avisar(res?.aviso, "Vale excluído");
  };

  const lista = vales ?? [];
  const total = lista.reduce((s, v) => s + (Number(v.valor) || 0), 0);

  return (
    <div className="mt-4 rounded-lg border bg-background p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Vales do mês</p>
          <p className="text-[10px] text-muted-foreground max-w-md">
            Vales são descontados no fechamento da competência escolhida e aparecem no holerite como um único
            evento (5077).
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={regerar} disabled={regerando}>
            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${regerando ? "animate-spin" : ""}`} />
            Regerar holerite de fechamento
          </Button>
          <Button size="sm" onClick={() => { setValor(""); setMotivo(""); setData(hojeISO()); setNovo(true); }}>
            <Plus className="h-3.5 w-3.5 mr-2" />Registrar vale
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando vales...</p>
      ) : !lista.length ? (
        <p className="text-xs text-muted-foreground">Nenhum vale registrado nesta competência.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground uppercase tracking-wide">
              <th className="text-left py-1">Data</th>
              <th className="text-left py-1">Motivo</th>
              <th className="text-right py-1">Valor</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lista.map((v) => (
              <tr key={v.id} className="border-t">
                <td className="py-1.5">{dataBRCompleta(v.data)}</td>
                <td className="py-1.5">{v.descricao ?? v.motivo ?? "—"}</td>
                <td className="py-1.5 text-right tabular-nums">{brl(v.valor)}</td>
                <td className="py-1.5 text-right">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remover(v.id)} title="Excluir">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            <tr className="border-t font-medium">
              <td className="py-1.5" colSpan={2}>Total</td>
              <td className="py-1.5 text-right tabular-nums">{brl(total)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      )}

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar vale</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$)</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Adiantamento extra..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button>
            <Button onClick={registrar} disabled={salvando}>Salvar vale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
