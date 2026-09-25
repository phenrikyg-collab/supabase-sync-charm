import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { chamarRpc } from "@/lib/supabaseRpc";
import { rpcAusente } from "@/lib/oficinaFluxo";
import { diasUteisSegSab, somaRevisao } from "@/lib/revisaoTamanho";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Linha = { tamanho: string; esperado: number; aprovadas: number; reprovadas: number };

type Props = {
  opId: string;
  totalOp: number;
  grade: { tamanho: string; quantidade: number }[];
};

const hoje = () => new Date().toISOString().slice(0, 10);

export function RevisaoPorTamanho({ opId, totalOp, grade }: Props) {
  const qc = useQueryClient();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [revisora, setRevisora] = useState("");
  const [recebido, setRecebido] = useState(hoje());
  const [concluido, setConcluido] = useState(hoje());
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: base, isLoading } = useQuery({
    queryKey: ["revisao-op", opId],
    queryFn: async () => {
      const [rev, reg, cfg] = await Promise.all([
        supabase.from("revisoras").select("id, nome").eq("ativa", true).order("nome"),
        supabase.from("registros_revisao").select("*").eq("ordem_producao_id", opId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("config_bonificacao_revisoras").select("prazo_revisao_dias_uteis").limit(1).maybeSingle(),
      ]);
      const registro = reg.data as any;
      let detalhe: any[] = [];
      if (registro) {
        const { data } = await supabase.from("registros_revisao_grade" as any).select("tamanho, pecas_aprovadas, pecas_reprovadas").eq("registro_revisao_id", registro.id);
        detalhe = (data ?? []) as any[];
      }
      return {
        revisoras: (rev.data ?? []) as { id: string; nome: string }[],
        registro,
        detalhe,
        prazo: (cfg.data as any)?.prazo_revisao_dias_uteis ?? 3,
      };
    },
  });

  // Monta as linhas a partir da grade do corte (e do que já foi salvo, se houver)
  useEffect(() => {
    if (!base) return;
    const salvo = Object.fromEntries(base.detalhe.map((d) => [d.tamanho, d]));
    const tams = grade.length ? grade : [{ tamanho: "Único", quantidade: totalOp }];
    setLinhas(
      tams.map((g) => ({
        tamanho: g.tamanho,
        esperado: g.quantidade ?? 0,
        aprovadas: salvo[g.tamanho]?.pecas_aprovadas ?? (base.registro ? 0 : g.quantidade ?? 0),
        reprovadas: salvo[g.tamanho]?.pecas_reprovadas ?? 0,
      })),
    );
    if (base.registro) {
      setRevisora(base.registro.revisora_id ?? "");
      setRecebido(base.registro.data_recebimento ?? hoje());
      setConcluido(base.registro.data_conclusao ?? hoje());
      setObs(base.registro.observacao ?? "");
    }
  }, [base, grade, totalOp]);

  const soma = useMemo(() => somaRevisao(linhas), [linhas]);
  const confere = soma.total === totalOp;

  const mudar = (i: number, campo: "aprovadas" | "reprovadas", v: string) => {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: n } : l)));
  };

  const salvar = async () => {
    if (!revisora) { toast.error("Escolha a revisora"); return; }
    if (soma.total === 0) { toast.error("Informe as peças revisadas"); return; }
    const dias = concluido ? diasUteisSegSab(recebido, concluido) : null;
    setSalvando(true);
    const { error } = await chamarRpc("revisao_salvar_por_tamanho", {
      p: {
        op_id: opId,
        revisora_id: revisora,
        data_recebimento: recebido,
        data_conclusao: concluido || null,
        observacao: obs,
        dias_uteis_gastos: dias,
        dentro_prazo: dias === null ? null : dias <= (base?.prazo ?? 3),
        tamanhos: linhas.map((l) => ({ tamanho: l.tamanho, aprovadas: l.aprovadas, reprovadas: l.reprovadas })),
      },
    });
    setSalvando(false);
    if (error) {
      toast.error(rpcAusente(error) ? "A revisão por tamanho ainda não foi ativada no banco." : error.message ?? "Erro ao salvar");
      return;
    }
    toast.success("Revisão salva. Ordem marcada como Revisada.");
    qc.invalidateQueries({ queryKey: ["revisao-op", opId] });
    qc.invalidateQueries({ queryKey: ["op-detalhe", opId] });
    qc.invalidateQueries({ queryKey: ["registros_revisao"] });
    qc.invalidateQueries({ queryKey: ["ordens-producao"] });
  };

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <Card className="sem-impressao">
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-foreground"><ClipboardCheck className="h-5 w-5 text-primary" />Revisão por tamanho</h2>
          {base?.registro && <span className="text-xs text-muted-foreground">Já revisada - editar</span>}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-3">
            <Label>Revisora</Label>
            <Select value={revisora} onValueChange={setRevisora}>
              <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>{(base?.revisoras ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Recebida em</Label><Input type="date" value={recebido} onChange={(e) => setRecebido(e.target.value)} /></div>
          <div className="space-y-1"><Label>Concluída em</Label><Input type="date" value={concluido} onChange={(e) => setConcluido(e.target.value)} /></div>
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <div className="grid grid-cols-[1fr_4rem_5.5rem_5.5rem] gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Tamanho</span><span className="text-right">Cortado</span><span className="text-center">Aprovadas</span><span className="text-center">Reprovadas</span>
          </div>
          {linhas.map((l, i) => {
            const difere = l.aprovadas + l.reprovadas !== l.esperado;
            return (
              <div key={l.tamanho} className="grid grid-cols-[1fr_4rem_5.5rem_5.5rem] items-center gap-2 border-t border-border px-3 py-2">
                <span className="font-semibold">{l.tamanho}</span>
                <span className={`text-right text-sm ${difere ? "text-destructive" : "text-muted-foreground"}`}>{l.esperado}</span>
                <Input type="number" inputMode="numeric" min={0} className="h-10 text-center" value={l.aprovadas} onChange={(e) => mudar(i, "aprovadas", e.target.value)} aria-label={`Aprovadas ${l.tamanho}`} />
                <Input type="number" inputMode="numeric" min={0} className="h-10 text-center" value={l.reprovadas} onChange={(e) => mudar(i, "reprovadas", e.target.value)} aria-label={`Reprovadas ${l.tamanho}`} />
              </div>
            );
          })}
          <div className="grid grid-cols-[1fr_4rem_5.5rem_5.5rem] gap-2 border-t border-border bg-muted/30 px-3 py-2 text-sm font-semibold">
            <span>Total</span><span className="text-right">{totalOp}</span><span className="text-center">{soma.aprovadas}</span><span className="text-center">{soma.reprovadas}</span>
          </div>
        </div>

        <p className={`text-sm ${confere ? "text-muted-foreground" : "text-destructive"}`}>
          {confere
            ? `Soma confere: ${soma.total} de ${totalOp} peças.`
            : `A soma (${soma.total}) não bate com as ${totalOp} peças da ordem. Confira antes de salvar.`}
        </p>

        <div className="space-y-1"><Label>Observação</Label><Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Defeitos encontrados, por exemplo" /></div>

        <Button size="lg" className="w-full" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : confere ? "Salvar revisão" : "Salvar mesmo assim"}
        </Button>
      </CardContent>
    </Card>
  );
}
