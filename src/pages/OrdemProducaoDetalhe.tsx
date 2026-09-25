import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { formatDateBR } from "@/lib/printUtils";
import { urlOrdemProducao } from "@/lib/qrOrdem";
import { QrCodeOrdemDialog } from "@/components/QrCodeOrdemDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Printer, QrCode } from "lucide-react";

const TAM = ["PP", "P", "M", "G", "GG", "EG", "G1", "G2", "G3"];
const ordTam = (a: string, b: string) => {
  const ia = TAM.indexOf(a), ib = TAM.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
};

export default function OrdemProducaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOficina } = useUserRole();
  const [qrOpen, setQrOpen] = useState(false);

  // A leitura passa pelas regras de acesso do banco: a oficina só recebe a ordem se ela for dela.
  const { data, isLoading } = useQuery({
    queryKey: ["op-detalhe", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: op, error } = await supabase.from("ordens_producao").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      if (!op) return null;
      const o = op as any;
      const [grade, prod, cor, of, oc] = await Promise.all([
        o.ordem_corte_id ? supabase.from("ordens_corte_grade").select("produto_id, cor_id, tamanho, quantidade").eq("ordem_corte_id", o.ordem_corte_id) : { data: [] },
        o.produto_id ? supabase.from("produtos").select("id, nome_do_produto").eq("id", o.produto_id).maybeSingle() : { data: null },
        o.cor_id ? supabase.from("cores").select("id, nome_cor, cor_hex").eq("id", o.cor_id).maybeSingle() : { data: null },
        o.oficina_id ? supabase.from("oficinas").select("id, nome_oficina").eq("id", o.oficina_id).maybeSingle() : { data: null },
        o.ordem_corte_id ? supabase.from("ordens_corte").select("id, numero_oc").eq("id", o.ordem_corte_id).maybeSingle() : { data: null },
      ]);
      const g = ((grade.data ?? []) as any[])
        .filter((x) => (!x.produto_id || x.produto_id === o.produto_id) && (x.cor_id ?? null) === (o.cor_id ?? null))
        .sort((a, b) => ordTam(a.tamanho, b.tamanho));
      return { op: o, grade: g, produto: prod.data as any, cor: cor.data as any, oficina: of.data as any, oc: oc.data as any };
    },
  });

  const voltar = () => navigate(isOficina ? "/portal-oficina" : "/ordens-producao");

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return (
    <div className="mx-auto max-w-md space-y-4 p-6 text-center">
      <p className="text-muted-foreground">Ordem de produção não encontrada, ou ela não pertence à sua oficina.</p>
      <Button variant="outline" onClick={voltar}>Voltar</Button>
    </div>
  );

  const { op, grade, produto, cor, oficina, oc } = data;
  const nome = produto?.nome_do_produto ?? op.nome_produto ?? "-";
  const url = urlOrdemProducao(op.id);
  const qtd = op.quantidade ?? op.quantidade_pecas_ordem ?? 0;

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-4 bg-background p-4 print:p-0">
      <style>{`@media print { .sem-impressao { display: none !important; } }`}</style>
      <div className="sem-impressao flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={voltar}><ArrowLeft className="mr-1 h-4 w-4" />{isOficina ? "Minhas ordens" : "Ordens de produção"}</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}><QrCode className="mr-1 h-4 w-4" />QR Code</Button>
          <Button size="sm" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ordem de produção{oc?.numero_oc ? ` · ${oc.numero_oc}` : ""}</p>
              <h1 className="font-serif text-2xl font-bold text-foreground">{nome}</h1>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {cor?.cor_hex && <span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: cor.cor_hex }} />}
                {cor?.nome_cor ?? "Sem cor"}
              </p>
              <Badge variant="outline" className="mt-2">{op.status_ordem ?? "-"}</Badge>
            </div>
            <div className="shrink-0 rounded-md border border-border bg-card p-2">
              <QRCodeSVG value={url} size={96} marginSize={1} bgColor="#ffffff" fgColor="#000000" />
            </div>
          </div>

          {grade.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {grade.map((x: any, i: number) => (
                <span key={i} className="rounded-md border border-border px-2 py-1 text-sm"><strong>{x.tamanho}</strong> {x.quantidade}</span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Peças</p><p className="font-semibold">{qtd}</p></div>
            <div><p className="text-xs text-muted-foreground">Prazo</p><p className="font-semibold">{formatDateBR(op.data_previsao_termino) || "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Oficina</p><p className="font-semibold">{oficina?.nome_oficina ?? "A definir"}</p></div>
            <div><p className="text-xs text-muted-foreground">Início</p><p className="font-semibold">{formatDateBR(op.data_inicio) || "-"}</p></div>
            {op.data_entrega && <div><p className="text-xs text-muted-foreground">Entregue em</p><p className="font-semibold">{formatDateBR(op.data_entrega)}</p></div>}
            {op.quantidade_entregue != null && <div><p className="text-xs text-muted-foreground">Qtd. entregue</p><p className="font-semibold">{op.quantidade_entregue}</p></div>}
            <div><p className="text-xs text-muted-foreground">Pagamento</p><p className="font-semibold">{op.pagamento_oficina_status ?? "-"}</p></div>
          </div>

          {isOficina && op.status_ordem !== "Entregue" && op.status_ordem !== "Finalizada" && (
            <Button size="lg" className="sem-impressao w-full" onClick={() => navigate("/portal-oficina")}>Dar baixa no portal</Button>
          )}
        </CardContent>
      </Card>

      <QrCodeOrdemDialog open={qrOpen} onOpenChange={setQrOpen} url={url} titulo={oc?.numero_oc ? `${oc.numero_oc} · ${nome}` : nome} subtitulo={`${cor?.nome_cor ?? "Sem cor"} · ${qtd} peças`} onImprimirFicha={() => { setQrOpen(false); setTimeout(() => window.print(), 200); }} />
    </div>
  );
}
