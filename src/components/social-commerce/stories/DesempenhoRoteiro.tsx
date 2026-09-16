import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { desempenhoRoteiro, enqueteDoSlide, numBR, pctBR, type Enquete } from "@/lib/stories";

export default function DesempenhoRoteiro({ roteiroId }: { roteiroId: number }) {
  const [linhas, setLinhas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enquete, setEnquete] = useState<{ slideId: number; dados: Enquete } | null>(null);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    desempenhoRoteiro(roteiroId)
      .then((d) => {
        if (!vivo) return;
        setLinhas([...d].sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0)));
      })
      .catch((e) => toast.error("Não deu para carregar o desempenho", { description: e?.message }))
      .finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [roteiroId]);

  const abrirEnquete = async (slideId: number) => {
    try {
      const dados = await enqueteDoSlide(slideId);
      setEnquete({ slideId, dados });
    } catch (e: any) {
      toast.error("Não deu para carregar a enquete", { description: e?.message });
    }
  };

  if (carregando) return <Skeleton className="h-72 w-full" />;
  if (!linhas.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
        Ainda não há números deste roteiro. Os dados do Instagram chegam depois da publicação.
      </Card>
    );
  }

  const serie = linhas.map((l) => ({
    ordem: `Slide ${l.ordem ?? ""}`,
    retencao: l.retencao_vs_slide1 === null || l.retencao_vs_slide1 === undefined ? null : Number(l.retencao_vs_slide1),
  }));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-medium mb-2">Retenção por posição</p>
        <p className="text-xs text-muted-foreground mb-3">
          Quanto do alcance do slide 1 ainda estava assistindo em cada slide.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={serie}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="ordem" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v: any) => pctBR(v)} />
            <Line type="monotone" dataKey="retencao" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="space-y-2">
        {linhas.map((l) => (
          <Card key={l.slide_id ?? l.ordem} className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">Slide {l.ordem}</Badge>
              <span className="text-xs">Views {numBR(l.views)}</span>
              <span className="text-xs">Alcance {numBR(l.reach)}</span>
              <span className="text-xs">Respostas {numBR(l.replies)}</span>
              <span className="text-xs">Saída {pctBR(l.taxa_saida_pct)}</span>
              <span className="text-xs">Taxa de resposta {pctBR(l.taxa_resposta_pct)}</span>
              <span className="text-xs">Retenção {pctBR(l.retencao_vs_slide1)}</span>
              {Number(l.votos ?? 0) > 0 && (
                <>
                  <span className="text-xs">Votos {numBR(l.votos)} ({pctBR(l.taxa_voto_pct)})</span>
                  <Button size="sm" variant="outline" onClick={() => abrirEnquete(Number(l.slide_id))}>
                    Ver placar
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!enquete} onOpenChange={(v) => !v && setEnquete(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Placar da enquete</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Total de votos: {numBR(enquete?.dados.total)}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(enquete?.dados.por_opcao ?? {}).map(([opcao, qtd]) => (
                <Badge key={opcao} variant="secondary">{opcao}: {numBR(qtd)}</Badge>
              ))}
            </div>
            <div className="max-h-72 overflow-y-auto divide-y">
              {(enquete?.dados.pessoas ?? []).map((p, i) => (
                <div key={i} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{p.nome || p.username || `Conversa ${p.conversa_id}`}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.opcao} {p.texto ? `— ${p.texto}` : ""}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/social-commerce?tab=atendimento&conversa=${p.conversa_id}`}>Abrir conversa</Link>
                  </Button>
                </div>
              ))}
              {(enquete?.dados.pessoas ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground py-2">Ninguém votou ainda.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
