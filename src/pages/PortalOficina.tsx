import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { chamarRpc } from "@/lib/supabaseRpc";
import { formatDateBR } from "@/lib/printUtils";
import { brl, pecasPagaveis, rpcAusente } from "@/lib/oficinaFluxo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, LogOut, PackageCheck, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { QrCodeOrdemDialog } from "@/components/QrCodeOrdemDialog";
import { urlOrdemProducao } from "@/lib/qrOrdem";
import { toast } from "sonner";

type Op = {
  id: string; produto_id: string | null; cor_id: string | null; ordem_corte_id: string | null;
  nome_produto: string | null; quantidade: number | null; quantidade_pecas_ordem: number | null;
  quantidade_entregue: number | null; data_entrega: string | null; data_previsao_termino: string | null;
  status_ordem: string | null; pagamento_oficina_status: string | null;
};

const TAM_ORDEM = ["PP", "P", "M", "G", "GG", "EG"];

export default function PortalOficina() {
  const { user, signOut } = useAuth() as any;
  const qc = useQueryClient();
  const [baixa, setBaixa] = useState<Op | null>(null);
  const [qtd, setQtd] = useState(0);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [enviando, setEnviando] = useState(false);
  const [qrOp, setQrOp] = useState<Op | null>(null);

  const { data: info, isLoading, error } = useQuery({
    queryKey: ["portal-oficina", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: vinc, error: e1 } = await supabase.from("oficina_usuarios").select("oficina_id").eq("user_id", user.id).maybeSingle();
      if (e1) throw e1;
      if (!vinc) return null;
      const oficinaId = (vinc as any).oficina_id as string;
      const [{ data: of }, { data: ops, error: e2 }] = await Promise.all([
        supabase.from("oficinas").select("id, nome_oficina, custo_por_peca").eq("id", oficinaId).maybeSingle(),
        supabase.from("ordens_producao").select("*").eq("oficina_id", oficinaId).order("created_at", { ascending: false }),
      ]);
      if (e2) throw e2;
      const lista = (ops ?? []) as unknown as Op[];
      const ocIds = [...new Set(lista.map((o) => o.ordem_corte_id).filter(Boolean))] as string[];
      const prodIds = [...new Set(lista.map((o) => o.produto_id).filter(Boolean))] as string[];
      const corIds = [...new Set(lista.map((o) => o.cor_id).filter(Boolean))] as string[];
      const [grade, prods, cores] = await Promise.all([
        ocIds.length ? supabase.from("ordens_corte_grade").select("ordem_corte_id, produto_id, cor_id, tamanho, quantidade").in("ordem_corte_id", ocIds) : { data: [] },
        prodIds.length ? supabase.from("produtos").select("id, nome_do_produto").in("id", prodIds) : { data: [] },
        corIds.length ? supabase.from("cores").select("id, nome_cor, cor_hex").in("id", corIds) : { data: [] },
      ]);
      return {
        oficina: of as any,
        ops: lista,
        grade: (grade.data ?? []) as any[],
        prods: Object.fromEntries(((prods.data ?? []) as any[]).map((p) => [p.id, p.nome_do_produto])),
        cores: Object.fromEntries(((cores.data ?? []) as any[]).map((c) => [c.id, c])),
      };
    },
  });

  const gradeDe = (o: Op) =>
    (info?.grade ?? [])
      .filter((g) => g.ordem_corte_id === o.ordem_corte_id && g.produto_id === o.produto_id && (g.cor_id ?? null) === (o.cor_id ?? null))
      .sort((a, b) => TAM_ORDEM.indexOf(a.tamanho) - TAM_ORDEM.indexOf(b.tamanho));

  const confirmarBaixa = async () => {
    if (!baixa) return;
    if (qtd <= 0) { toast.error("Informe a quantidade entregue"); return; }
    setEnviando(true);
    const { error } = await chamarRpc("oficina_dar_baixa", { p_op_id: baixa.id, p_quantidade: qtd, p_data: data });
    setEnviando(false);
    if (error) {
      toast.error(rpcAusente(error) ? "Portal ainda não configurado no sistema. Avise a loja." : error.message ?? "Erro ao dar baixa");
      return;
    }
    toast.success("Entrega registrada");
    setBaixa(null);
    qc.invalidateQueries({ queryKey: ["portal-oficina"] });
  };

  const abertas = (info?.ops ?? []).filter((o) => o.status_ordem !== "Entregue" && o.status_ordem !== "Finalizada");
  const entregues = (info?.ops ?? []).filter((o) => !abertas.includes(o));

  const Cartao = ({ o }: { o: Op }) => {
    const cor = o.cor_id ? info?.cores[o.cor_id] : null;
    const g = gradeDe(o);
    const entregue = !abertas.includes(o);
    return (
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to={`/op/${o.id}`} className="font-serif text-lg font-semibold text-foreground hover:underline">{(o.produto_id && info?.prods[o.produto_id]) || o.nome_produto || "-"}</Link>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {cor?.cor_hex && <span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: cor.cor_hex }} />}
                {cor?.nome_cor ?? "Sem cor"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge variant={entregue ? "secondary" : "outline"}>{o.status_ordem ?? "-"}</Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQrOp(o)} aria-label="QR Code"><QrCode className="h-4 w-4" /></Button>
            </div>
          </div>
          {g.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {g.map((x) => (
                <span key={x.tamanho} className="rounded-md border border-border px-2 py-1 text-sm">
                  <strong>{x.tamanho}</strong> {x.quantidade}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><p className="text-xs text-muted-foreground">Peças</p><p className="font-semibold">{o.quantidade ?? o.quantidade_pecas_ordem ?? 0}</p></div>
            <div><p className="text-xs text-muted-foreground">Prazo</p><p className="font-semibold">{formatDateBR(o.data_previsao_termino) || "-"}</p></div>
            {entregue && (
              <>
                <div><p className="text-xs text-muted-foreground">Entregue em</p><p className="font-semibold">{formatDateBR(o.data_entrega) || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Pagamento</p><p className="font-semibold">{o.pagamento_oficina_status ?? "-"} · {brl(pecasPagaveis(o) * (info?.oficina?.custo_por_peca ?? 0))}</p></div>
              </>
            )}
          </div>
          {!entregue && (
            <Button size="lg" className="w-full" onClick={() => { setBaixa(o); setQtd(o.quantidade ?? o.quantidade_pecas_ordem ?? 0); }}>
              <PackageCheck className="mr-2 h-4 w-4" /> Dar baixa
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-5 bg-background p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Portal da oficina</p>
          <h1 className="font-serif text-2xl font-bold text-foreground">{info?.oficina?.nome_oficina ?? "Minhas ordens"}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => signOut?.()}><LogOut className="mr-1 h-4 w-4" />Sair</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Não foi possível carregar. O portal pode ainda não estar configurado pela loja.</p>
      ) : !info ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Seu usuário ainda não está ligado a nenhuma oficina. Fale com a loja.</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-semibold text-foreground">Em aberto ({abertas.length})</h2>
            {abertas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma ordem em aberto.</p> : abertas.map((o) => <Cartao key={o.id} o={o} />)}
          </section>
          {entregues.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold text-foreground">Entregues</h2>
              {entregues.map((o) => <Cartao key={o.id} o={o} />)}
            </section>
          )}
        </>
      )}

      {qrOp && (
        <QrCodeOrdemDialog
          open={!!qrOp}
          onOpenChange={(v) => !v && setQrOp(null)}
          url={urlOrdemProducao(qrOp.id)}
          titulo={(qrOp.produto_id && info?.prods[qrOp.produto_id]) || qrOp.nome_produto || "Ordem"}
          subtitulo={`${(qrOp.cor_id && info?.cores[qrOp.cor_id]?.nome_cor) || "Sem cor"} · ${qrOp.quantidade ?? qrOp.quantidade_pecas_ordem ?? 0} peças`}
        />
      )}

      <Dialog open={!!baixa} onOpenChange={(v) => !v && setBaixa(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dar baixa na entrega</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Quantidade entregue</Label>
              <Input type="number" inputMode="numeric" min={1} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Data da entrega</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixa(null)}>Cancelar</Button>
            <Button onClick={confirmarBaixa} disabled={enviando}>{enviando ? "Salvando..." : "Confirmar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
