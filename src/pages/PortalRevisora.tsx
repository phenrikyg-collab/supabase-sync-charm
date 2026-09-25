import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { chamarRpc } from "@/lib/supabaseRpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Loader2, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PortalLogin, dataBR } from "@/components/portal/PortalLogin";

type OpRev = {
  op_id: string; nome_produto: string | null; cor_nome: string | null; quantidade: number | null;
  grade: { tamanho: string; quantidade: number }[] | null; data_previsao_termino: string | null;
};

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const gradeTexto = (op: OpRev) => (op.grade ?? []).map((g) => `${g.tamanho}: ${g.quantidade}`).join(", ") || "-";

function Revisar({ op, onVoltar }: { op: OpRev; onVoltar: () => void }) {
  const qc = useQueryClient();
  const grade = op.grade ?? [];
  const [linhas, setLinhas] = useState(grade.map((g) => ({ tamanho: g.tamanho, max: Number(g.quantidade) || 0, aprovadas: String(g.quantidade ?? ""), reprovadas: "" })));
  const [receb, setReceb] = useState(hoje());
  const [concl, setConcl] = useState(hoje());
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);

  const n = (s: string) => parseInt(s) || 0;
  const tA = linhas.reduce((s, l) => s + n(l.aprovadas), 0);
  const tR = linhas.reduce((s, l) => s + n(l.reprovadas), 0);
  const estouro = linhas.filter((l) => n(l.aprovadas) + n(l.reprovadas) > l.max);

  const salvar = async () => {
    if (!receb) { toast.error("Informe a data de recebimento"); return; }
    if (estouro.length) { toast.error(`Passou da quantidade no tamanho ${estouro.map((l) => l.tamanho).join(", ")}`); return; }
    if (tA + tR === 0) { toast.error("Informe as peças revisadas"); return; }
    setEnviando(true);
    const { error } = await chamarRpc<any>("revisao_salvar_por_tamanho", {
      p: {
        op_id: op.op_id, data_recebimento: receb, data_conclusao: concl || null, observacao: obs.trim() || null,
        tamanhos: linhas.map((l) => ({ tamanho: l.tamanho, aprovadas: n(l.aprovadas), reprovadas: n(l.reprovadas) })),
      },
    });
    setEnviando(false);
    if (error) { toast.error(error.message || "Erro ao salvar revisão"); return; }
    toast.success("Revisão salva");
    qc.invalidateQueries({ queryKey: ["revisora-pendentes"] });
    onVoltar();
  };

  return (
    <div className="space-y-4 pb-28">
      <Button variant="ghost" size="sm" onClick={onVoltar} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
      <Card><CardContent className="space-y-1 pt-4">
        <p className="font-serif text-xl font-semibold text-foreground">{op.nome_produto ?? "-"}</p>
        <p className="text-sm text-muted-foreground">{op.cor_nome ?? "-"} | {op.quantidade ?? 0} peças</p>
      </CardContent></Card>

      <div className="space-y-2">
        <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 text-xs text-muted-foreground"><span>Tam.</span><span>Aprovadas</span><span>Reprovadas</span></div>
        {linhas.map((l, i) => {
          const ruim = n(l.aprovadas) + n(l.reprovadas) > l.max;
          return (
            <div key={l.tamanho} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2">
              <div><p className="font-medium">{l.tamanho}</p><p className="text-[10px] text-muted-foreground">de {l.max}</p></div>
              <Input inputMode="numeric" value={l.aprovadas} className={ruim ? "border-destructive" : ""}
                onChange={(e) => setLinhas((x) => x.map((y, j) => j === i ? { ...y, aprovadas: e.target.value.replace(/\D/g, "") } : y))} />
              <Input inputMode="numeric" value={l.reprovadas} className={ruim ? "border-destructive" : ""}
                onChange={(e) => setLinhas((x) => x.map((y, j) => j === i ? { ...y, reprovadas: e.target.value.replace(/\D/g, "") } : y))} />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Recebimento</Label><Input type="date" value={receb} onChange={(e) => setReceb(e.target.value)} /></div>
        <div className="space-y-1"><Label>Conclusão</Label><Input type="date" value={concl} onChange={(e) => setConcl(e.target.value)} /></div>
      </div>
      <div className="space-y-1"><Label>Observação</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} /></div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card p-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{tA} aprovadas, {tR} reprovadas</span>
          <Button onClick={salvar} disabled={enviando} className="gap-2">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Salvar revisão
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PortalRevisora() {
  const { user, loading, signOut } = useAuth();
  const [aberta, setAberta] = useState<OpRev | null>(null);
  const q = useQuery({
    queryKey: ["revisora-pendentes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await chamarRpc<OpRev[]>("revisora_ops_pendentes", {});
      if (error) throw error;
      return (data ?? []) as OpRev[];
    },
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <PortalLogin dominio="revisora" titulo="Portal da Revisão" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <h1 className="font-serif text-xl font-bold text-foreground">Revisão</h1>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" title="Recarregar" onClick={() => q.refetch()}><RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /></Button>
          <Button variant="ghost" size="icon" title="Sair" onClick={() => signOut()}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        {aberta ? <Revisar op={aberta} onVoltar={() => setAberta(null)} />
          : q.isLoading ? <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-primary" />
          : q.error ? <p className="py-8 text-center text-sm text-destructive">{(q.error as any).message}</p>
          : (q.data ?? []).length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma ordem esperando revisão.</p>
          : q.data!.map((op) => (
            <Card key={op.op_id} className="cursor-pointer hover:border-primary" onClick={() => setAberta(op)}>
              <CardContent className="space-y-1 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-serif text-lg font-semibold text-foreground">{op.nome_produto ?? "-"}</p>
                  {op.data_previsao_termino && <span className="shrink-0 text-xs text-muted-foreground">Prazo {dataBR(op.data_previsao_termino)}</span>}
                </div>
                <p className="text-sm text-muted-foreground">{op.cor_nome ?? "-"} | {op.quantidade ?? 0} peças</p>
                <p className="text-sm">{gradeTexto(op)}</p>
              </CardContent>
            </Card>
          ))}
      </main>
    </div>
  );
}
