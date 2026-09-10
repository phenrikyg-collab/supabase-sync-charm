import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { videosMetricas, formatarMoeda, type VideosMetricas } from "@/lib/videosVitrine";

const PERIODOS = [7, 30, 90];

const ONDE_LABEL: Record<string, string> = {
  trilho: "Carrossel abaixo da descrição",
  galeria: "Galeria de fotos do produto",
  full: "Tela cheia",
};

const num = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : Math.round(n).toLocaleString("pt-BR");

const pctTxt = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${Number(n).toFixed(1).replace(".", ",")}%`;

const razao = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1).replace(".", ",")}%` : "—");

function Topo({ label, valor, sub, destaque }: { label: string; valor: string; sub: string; destaque?: boolean }) {
  return (
    <div className="flex-1 px-4 py-3 first:pl-0 last:pr-0">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`font-serif tabular-nums ${destaque ? "text-3xl text-primary" : "text-2xl"} font-bold`}>{valor}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

export function MetricasVideosTab({ onAbrirVideo }: { onAbrirVideo?: (videoId: string) => void }) {
  const { toast } = useToast();
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<VideosMetricas | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = async (d: number) => {
    setCarregando(true);
    try {
      setDados(await videosMetricas(d));
    } catch (e: any) {
      toast({ title: "Não deu para carregar as métricas", description: e.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(dias); /* eslint-disable-next-line */ }, [dias]);

  const r = dados?.resumo;
  const porDia = dados?.por_dia ?? [];
  const porVideo = useMemo(
    () => [...(dados?.por_video ?? [])].sort((a, b) => (b.impressoes ?? 0) - (a.impressoes ?? 0)),
    [dados],
  );
  const maxDia = Math.max(1, ...porDia.map((d) => (d.impressoes ?? 0) + (d.plays ?? 0)));

  const etapas = r
    ? [
        { nome: "Impressões", valor: r.impressoes, rel: null as string | null },
        { nome: "Plays", valor: r.plays, rel: razao(r.plays, r.impressoes) },
        { nome: "Tela cheia", valor: r.tela_cheia, rel: null },
        { nome: "Cliques na peça", valor: r.cliques, rel: razao(r.cliques, r.plays) },
        { nome: "Pedidos", valor: r.pedidos, rel: null },
      ]
    : [];
  const base = Math.max(1, r?.impressoes ?? 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {dados?.gerado_em && `Última leitura às ${new Date(dados.gerado_em).toLocaleTimeString("pt-BR")}`}
        </p>
        <div className="flex items-center gap-1.5">
          {PERIODOS.map((d) => (
            <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>
              {d} dias
            </Button>
          ))}
          <Button size="icon" variant="ghost" onClick={() => carregar(dias)} title="Atualizar">
            <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {carregando && !dados ? (
        <Skeleton className="h-24 w-full" />
      ) : r ? (
        <div className="flex flex-wrap divide-x divide-border rounded-lg border p-2">
          <Topo label="Impressões" valor={num(r.impressoes)} sub={`${num(r.visitantes)} visitantes`} />
          <Topo label="Plays" valor={num(r.plays)} sub={`${pctTxt(r.pct_play)} das impressões`} />
          <Topo label="Tela cheia" valor={num(r.tela_cheia)} sub={`${num(r.concluiu)} até o fim`} />
          <Topo label="Cliques na peça" valor={num(r.cliques)} sub={`${pctTxt(r.pct_clique)} dos plays`} />
          <Topo label="Receita atribuída" valor={formatarMoeda(r.receita)} sub={`${num(r.pedidos)} pedidos`} destaque />
        </div>
      ) : null}

      {r && (
        <Card>
          <CardHeader><CardTitle className="text-base">Do card ao pedido</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {etapas.map((e) => (
              <div key={e.nome} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm text-muted-foreground">{e.nome}</span>
                <div className="h-4 flex-1 rounded bg-muted">
                  <div
                    className="h-4 rounded bg-primary"
                    style={{ width: `${Math.min(100, ((e.valor ?? 0) / base) * 100)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-sm tabular-nums">{num(e.valor)}</span>
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{e.rel ?? ""}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {porDia.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Dia a dia</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-1">
              {porDia.map((d) => {
                const imp = d.impressoes ?? 0;
                const pl = d.plays ?? 0;
                return (
                  <div
                    key={d.dia}
                    className="flex flex-1 flex-col justify-end"
                    title={`${d.dia}: ${num(imp)} impressões, ${num(pl)} plays`}
                  >
                    <div className="rounded-t bg-primary" style={{ height: `${(pl / maxDia) * 100}%` }} />
                    <div className="bg-muted" style={{ height: `${(imp / maxDia) * 100}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-muted" /> impressões</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-primary" /> plays</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Vídeo por vídeo</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vídeo</TableHead>
                <TableHead className="text-right">Impressões</TableHead>
                <TableHead className="text-right">Plays</TableHead>
                <TableHead className="text-right">% play</TableHead>
                <TableHead className="text-right">Tela cheia</TableHead>
                <TableHead className="text-right">Meio</TableHead>
                <TableHead className="text-right">Concluiu</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Receita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porVideo.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                    Sem dados no período.
                  </TableCell>
                </TableRow>
              ) : porVideo.map((v) => (
                <TableRow
                  key={v.video_id}
                  className="cursor-pointer"
                  onClick={() => onAbrirVideo?.(v.video_id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {v.poster_url
                        ? <img src={v.poster_url} alt="" className="h-12 w-8 rounded object-cover" />
                        : <div className="h-12 w-8 rounded bg-muted" />}
                      <div className="min-w-0">
                        <p className="max-w-[200px] truncate text-sm">{v.titulo ?? v.video_id}</p>
                        {v.tem_audio && !v.som_liberado && (
                          <Badge className="mt-1 border-amber-300 bg-amber-100 text-amber-800" variant="outline">mudo</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(v.impressoes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(v.plays)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pctTxt(v.pct_play)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(v.tela_cheia)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(v.meio)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(v.concluiu)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(v.cliques)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(v.pedidos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarMoeda(v.receita)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Onde o play acontece</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(dados?.por_superficie ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (dados?.por_superficie ?? []).map((s) => (
              <div key={s.onde} className="flex items-center justify-between text-sm">
                <span>{ONDE_LABEL[s.onde] ?? s.onde}</span>
                <span className="tabular-nums">{num(s.plays)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Peça clicada no vídeo</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(dados?.por_produto ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (dados?.por_produto ?? []).map((p) => (
              <div key={p.tray_product_id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{p.nome ?? p.tray_product_id}</span>
                <span className="tabular-nums">{num(p.cliques)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Receita atribuída soma pedidos de quem viu o vídeo, em janela de 7 dias a partir do primeiro contato.
        É atribuição por contato, e não prova de causa.
      </p>
    </div>
  );
}
