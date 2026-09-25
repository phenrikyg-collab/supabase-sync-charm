import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBR } from "@/lib/printUtils";
import { urlOrdemCorte, urlOrdemProducao } from "@/lib/qrOrdem";
import { QrCodeOrdemDialog } from "@/components/QrCodeOrdemDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Loader2, Printer, QrCode } from "lucide-react";

const TAM = ["PP", "P", "M", "G", "GG", "EG", "G1", "G2", "G3"];
const ordTam = (a: string, b: string) => {
  const ia = TAM.indexOf(a), ib = TAM.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
};

export default function OrdemCorteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [qrOpen, setQrOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["oc-detalhe", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: oc, error } = await supabase.from("ordens_corte").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      if (!oc) return null;
      const [grade, prods, rolos, ops] = await Promise.all([
        supabase.from("ordens_corte_grade").select("*").eq("ordem_corte_id", id!),
        supabase.from("ordens_corte_produtos").select("*").eq("ordem_corte_id", id!),
        supabase.from("ordens_corte_rolos").select("*").eq("ordem_corte_id", id!),
        supabase.from("ordens_producao").select("id, nome_produto, cor_id, quantidade, quantidade_pecas_ordem, status_ordem").eq("ordem_corte_id", id!),
      ]);
      const g = (grade.data ?? []) as any[];
      const r = (rolos.data ?? []) as any[];
      const o = (ops.data ?? []) as any[];
      const corIds = [...new Set([...g.map((x) => x.cor_id), ...o.map((x) => x.cor_id)].filter(Boolean))];
      const roloIds = r.map((x) => x.rolo_id).filter(Boolean);
      const [cores, rt] = await Promise.all([
        corIds.length ? supabase.from("cores").select("id, nome_cor, cor_hex").in("id", corIds) : { data: [] },
        roloIds.length ? supabase.from("rolos_tecido").select("id, codigo_rolo, lote, cor_nome, metragem_disponivel").in("id", roloIds) : { data: [] },
      ]);
      return {
        oc: oc as any,
        grade: g,
        produtos: (prods.data ?? []) as any[],
        rolos: r,
        ops: o,
        cores: Object.fromEntries(((cores.data ?? []) as any[]).map((c) => [c.id, c])),
        rolosInfo: Object.fromEntries(((rt.data ?? []) as any[]).map((x) => [x.id, x])),
      };
    },
  });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return (
    <div className="mx-auto max-w-md space-y-4 p-6 text-center">
      <p className="text-muted-foreground">Ordem de corte não encontrada, ou você não tem acesso a ela.</p>
      <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
    </div>
  );

  const { oc, grade, produtos, rolos, ops, cores, rolosInfo } = data;
  const url = urlOrdemCorte(oc.id);
  const total = grade.reduce((a, x) => a + (x.quantidade ?? 0), 0);
  const listaProd = produtos.length ? produtos : [{ id: "sem", produto_id: null, nome_produto: "Sem produto" }];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 print:p-0">
      <style>{`@media print { .sem-impressao { display: none !important; } }`}</style>
      <div className="sem-impressao flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ordens-corte")}><ArrowLeft className="mr-1 h-4 w-4" />Ordens de corte</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}><QrCode className="mr-1 h-4 w-4" />QR Code</Button>
          <Button size="sm" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Imprimir ficha</Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ordem de corte</p>
              <h1 className="font-serif text-3xl font-bold text-foreground">{oc.numero_oc}</h1>
              <div className="mt-1"><StatusBadge status={oc.status ?? "planejada"} /></div>
              <p className="mt-1 text-xs text-muted-foreground">Criada em {formatDateBR(oc.created_at) || "-"}</p>
            </div>
            <div className="shrink-0 rounded-md border border-border bg-card p-2">
              <QRCodeSVG value={url} size={96} marginSize={1} bgColor="#ffffff" fgColor="#000000" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Folhas</p><p className="font-semibold">{oc.quantidade_folhas ?? "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Risco (m)</p><p className="font-semibold">{oc.metragem_risco ?? "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Metragem usada</p><p className="font-semibold">{oc.metragem_total_utilizada ?? "-"}</p></div>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold text-foreground">Grade ({total} peças)</h2>
            {listaProd.map((p: any) => {
              const gp = grade.filter((x) => (x.produto_id ?? null) === (p.produto_id ?? null) || (!produtos.length));
              if (!gp.length) return null;
              const porCor = new Map<string, any[]>();
              gp.forEach((x) => { const k = x.cor_id ?? "sem"; porCor.set(k, [...(porCor.get(k) ?? []), x]); });
              return (
                <div key={p.id} className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-sm font-semibold">{p.nome_produto}</p>
                  {[...porCor.entries()].map(([k, itens]) => {
                    const cor = cores[k];
                    return (
                      <div key={k} className="space-y-1">
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: cor?.cor_hex ?? "transparent" }} />
                          {cor?.nome_cor ?? "Sem cor"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {itens.sort((a, b) => ordTam(a.tamanho, b.tamanho)).map((x) => (
                            <span key={x.id} className="rounded-md border border-border bg-background px-2 py-1 text-sm"><strong>{x.tamanho}</strong> {x.quantidade}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {rolos.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-semibold text-foreground">Rolos usados</h2>
              <div className="divide-y divide-border rounded-md border border-border text-sm">
                {rolos.map((r) => {
                  const info = rolosInfo[r.rolo_id];
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate">{info?.codigo_rolo ?? "-"}{info?.lote ? ` · lote ${info.lote}` : ""}{info?.cor_nome ? ` · ${info.cor_nome}` : ""}</span>
                      <span className="shrink-0 font-semibold">{r.metragem_utilizada} m</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {ops.length > 0 && (
            <div className="sem-impressao space-y-2">
              <h2 className="font-semibold text-foreground">Ordens de produção geradas</h2>
              <div className="divide-y divide-border rounded-md border border-border text-sm">
                {ops.map((o) => (
                  <Link key={o.id} to={`/op/${o.id}`} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50">
                    <span className="min-w-0 truncate">{o.nome_produto ?? "-"} · {cores[o.cor_id]?.nome_cor ?? "Sem cor"}</span>
                    <span className="shrink-0 text-muted-foreground">{o.quantidade ?? o.quantidade_pecas_ordem ?? 0} pç · {o.status_ordem ?? "-"}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <QrCodeOrdemDialog open={qrOpen} onOpenChange={setQrOpen} url={url} titulo={oc.numero_oc} subtitulo={`${total} peças`} onImprimirFicha={() => { setQrOpen(false); setTimeout(() => window.print(), 200); }} />
      {/* evita aviso de import não usado quando não há OPs */}
      <span className="hidden">{urlOrdemProducao.name}</span>
    </div>
  );
}
