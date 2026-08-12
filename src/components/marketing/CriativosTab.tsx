import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Film, Image as ImageIcon, LayoutGrid, ShoppingBag } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Delta, NivelBadge } from "./FunilLeitura";
import {
  CriativoPeriodo,
  FORMATO_LABEL,
  NIVEL_COR,
  QUALITY_LABEL,
  SELO_META,
  brl,
  corFrequencia,
  freqFmt,

  delta,
  int,
  isVideo,
  n,
  nivelDe,
  pct,
  roasFmt,
  scoreFadiga,
  seloDe,
  useMetaDiversidade,
} from "./metaCriativos";

const TODOS = "__todos__";

function IconeFormato({ formato, className }: { formato: string | null; className?: string }) {
  const f = (formato || "").toLowerCase();
  if (f === "video") return <Film className={className} />;
  if (f === "carrossel") return <LayoutGrid className={className} />;
  if (f === "catalogo") return <ShoppingBag className={className} />;
  return <ImageIcon className={className} />;
}

function Thumb({ c, alto }: { c: CriativoPeriodo; alto?: boolean }) {
  const [erro, setErro] = useState(false);
  const altura = alto ? "h-64" : "h-[160px]";
  const link = c.instagram_permalink || c.thumbnail_url || null;
  const arred = alto ? "rounded-lg" : "rounded-t-lg";
  return (
    <div className={cn("relative w-full overflow-hidden bg-muted", altura, arred)}>
      {!c.thumbnail_url || erro ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
          <IconeFormato formato={c.formato} className="h-8 w-8" />
          <span className="text-xs">Prévia indisponível</span>
        </div>
      ) : (
        <img
          src={c.thumbnail_url}
          alt={c.ad_name || "Criativo"}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setErro(true)}
          className="h-full w-full object-cover"
        />
      )}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-1 text-[11px] font-medium backdrop-blur hover:bg-background"
        >
          Ver criativo <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}


function Metrica({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold", cor)}>{valor}</p>
    </div>
  );
}

function CardCriativo({ c, onClick }: { c: CriativoPeriodo; onClick: () => void }) {
  const selo = SELO_META[seloDe(c)];
  const video = isVideo(c.formato);
  return (
    <button onClick={onClick} className="text-left rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <Thumb c={c} />
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-[10px] font-semibold">
            {FORMATO_LABEL[(c.formato || "outro").toLowerCase()] || c.formato || "Outro"}
          </span>
          {c.tipo_criativo && (
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {c.tipo_criativo}
            </span>
          )}
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", selo.className)}>
            {selo.label}
          </span>
        </div>

        <div>
          <p className="text-sm font-medium line-clamp-2">{c.ad_name || "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{c.campaign_name || "—"}</p>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ROAS</p>
            <p className={cn("text-2xl font-serif font-bold", NIVEL_COR[nivelDe("roas", c.roas)])}>{roasFmt(c.roas)}</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Delta atual={c.roas} anterior={c.prev_roas} />
            <Delta atual={c.ctr_link} anterior={c.prev_ctr_link} />
            <Delta atual={c.cpa} anterior={c.prev_cpa} menorMelhor />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metrica label="Investimento" valor={brl(c.spend)} />
          <Metrica label="Impressões" valor={int(c.impressions)} />
          <Metrica label="Compras" valor={int(c.purchases)} />
          <Metrica label="3 segundos" valor={video ? pct(c.thumb_stop_rate) : "—"} cor={video ? NIVEL_COR[nivelDe("thumb_stop", c.thumb_stop_rate)] : undefined} />
          <Metrica label="CTR" valor={pct(c.ctr_link, 2)} cor={NIVEL_COR[nivelDe("ctr", c.ctr_link)]} />
          <Metrica label="CPM" valor={brl(c.cpm)} cor={NIVEL_COR[nivelDe("cpm", c.cpm)]} />
          <Metrica label="CPA" valor={n(c.purchases) > 0 ? brl(c.cpa) : "—"} />
          <Metrica label="Freq." valor={freqFmt(c.frequency)} cor={corFrequencia(c.frequency)} />

        </div>
      </div>
    </button>
  );
}

// ===== Modal de detalhe =====
function BarraFunil({ label, valor, max }: { label: string; valor: number; max: number }) {
  const w = max > 0 ? Math.max((valor / max) * 100, 1) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{int(valor)}</span>
      </div>
      <div className="h-2.5 rounded bg-muted">
        <div className="h-2.5 rounded bg-primary" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function DetalheCriativo({ c, dias, onClose }: { c: CriativoPeriodo | null; dias: number; onClose: () => void }) {
  const [serie, setSerie] = useState<any[]>([]);
  const [quartis, setQuartis] = useState<any | null>(null);

  useEffect(() => {
    if (!c) return;
    const ini = new Date();
    ini.setDate(ini.getDate() - dias);
    const iso = ini.toISOString().slice(0, 10);
    supabase
      .from("meta_ads_anuncios" as any)
      .select("dia, spend, purchase_value, video_p25, video_p50, video_p75, video_p100, video_avg_watch_s")
      .eq("ad_id", c.ad_id)
      .gte("dia", iso)
      .order("dia")
      .then(({ data }: any) => {
        const rows = (data as any[]) || [];
        setSerie(rows.map((r) => ({ dia: r.dia, spend: n(r.spend), receita: n(r.purchase_value) })));
        if (rows.length) {
          const soma = (k: string) => rows.reduce((s, r) => s + n(r[k]), 0);
          const watch = rows.filter((r) => r.video_avg_watch_s != null);
          setQuartis({
            p25: soma("video_p25"),
            p50: soma("video_p50"),
            p75: soma("video_p75"),
            p100: soma("video_p100"),
            avg: watch.length ? watch.reduce((s, r) => s + n(r.video_avg_watch_s), 0) / watch.length : null,
          });
        } else setQuartis(null);
      }, () => { setSerie([]); setQuartis(null); });
  }, [c, dias]);

  if (!c) return null;
  const video = isVideo(c.formato);
  const maxFunil = n(c.impressions);

  const linhas: { label: string; atual: string; anterior: string }[] = [
    { label: "Investimento", atual: brl(c.spend), anterior: brl(c.prev_spend) },
    { label: "Impressões", atual: int(c.impressions), anterior: int(c.prev_impressions) },
    { label: "Taxa de 3 segundos", atual: video ? pct(c.thumb_stop_rate) : "—", anterior: video ? pct(c.prev_thumb_stop) : "—" },
    { label: "CTR (link)", atual: pct(c.ctr_link, 2), anterior: pct(c.prev_ctr_link, 2) },
    { label: "CPM", atual: brl(c.cpm), anterior: brl(c.prev_cpm) },
    { label: "CPA", atual: n(c.purchases) > 0 ? brl(c.cpa) : "—", anterior: brl(c.prev_cpa) },
    { label: "ROAS", atual: roasFmt(c.roas), anterior: roasFmt(c.prev_roas) },
    { label: "Frequência", atual: freqFmt(c.frequency), anterior: "—" },

  ];

  return (
    <Dialog open={!!c} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">{c.ad_name || "Criativo"}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Thumb c={c} alto />
            {c.instagram_permalink && (
              <a href={c.instagram_permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> Ver no Instagram
              </a>
            )}
            <p className="text-xs text-muted-foreground">
              {c.campaign_name || "—"} · {c.adset_name || "—"}
            </p>
            <p className="text-xs text-muted-foreground">Qualidade (Meta): {QUALITY_LABEL(c.quality_ranking)}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Funil individual</p>
              <BarraFunil label="Impressões" valor={n(c.impressions)} max={maxFunil} />
              <BarraFunil label="3 segundos" valor={n(c.video_3s_views)} max={maxFunil} />
              <BarraFunil label="ThruPlay" valor={n(c.video_thruplays)} max={maxFunil} />
              <BarraFunil label="Cliques no link" valor={n(c.link_clicks)} max={maxFunil} />
              <BarraFunil label="Compras" valor={n(c.purchases)} max={maxFunil} />
            </div>

            {video && (
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-sm font-semibold">Retenção de vídeo</p>
                <p className="text-xs text-muted-foreground">ThruPlay: {pct(c.retencao_rate)}</p>
                {quartis && (
                  <p className="text-xs text-muted-foreground">
                    25%: {int(quartis.p25)} · 50%: {int(quartis.p50)} · 75%: {int(quartis.p75)} · 100%: {int(quartis.p100)}
                    {quartis.avg !== null ? ` · Tempo médio: ${quartis.avg.toFixed(1).replace(".", ",")}s` : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Atual vs período anterior</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">Atual</TableHead>
                <TableHead className="text-right">Anterior</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.label}>
                  <TableCell>{l.label}</TableCell>
                  <TableCell className="text-right font-medium">{l.atual}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{l.anterior}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {serie.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Investimento x Receita (diário)</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={serie} margin={{ left: 10, right: 20, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={80} tickFormatter={(v) => brl(v)} />
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="spend" name="Investimento" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="receita" name="Receita" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===== Diversidade =====
function Diversidade({ dias }: { dias: number }) {
  const { data, loading } = useMetaDiversidade(dias);
  if (loading) return <Skeleton className="h-[280px]" />;

  const bloco = (dimensao: "formato" | "tipo_criativo") => data.filter((d) => d.dimensao === dimensao);

  const render = (dimensao: "formato" | "tipo_criativo", titulo: string) => {
    const linhas = bloco(dimensao).sort((a, b) => n(b.investimento) - n(a.investimento));
    const total = linhas.reduce((s, l) => s + n(l.investimento), 0);
    const share = (l: typeof linhas[number]) => (total > 0 ? (n(l.investimento) / total) * 100 : 0);
    const alertas: string[] = [];
    if (dimensao === "formato") {
      const video = linhas.find((l) => (l.chave || "").toLowerCase() === "video");
      if (video && share(video) < 55) alertas.push("Vídeo abaixo de 55% do investimento — referência do feed Meta é ~70%.");
      const conc = linhas.find((l) => share(l) > 80);
      if (conc) alertas.push(`Concentração acima de 80% em "${conc.chave}" — diversificar formatos.`);
    } else {
      const conc = linhas.find((l) => share(l) > 50);
      if (conc) alertas.push(`Mais de 50% do investimento em "${conc.chave}" — ampliar variedade de abordagens.`);
    }

    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">{titulo}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período</p>
          ) : (
            <>
              {linhas.map((l) => (
                <div key={String(l.chave)} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">
                      {dimensao === "formato" ? FORMATO_LABEL[(l.chave || "").toLowerCase()] || l.chave : l.chave}
                      <span className="text-muted-foreground"> · {int(l.qtd_anuncios)} anúncio(s)</span>
                    </span>
                    <span className="text-muted-foreground">
                      {pct(share(l))} · {brl(l.investimento)} · <span className={NIVEL_COR[nivelDe("roas", l.roas)]}>{roasFmt(l.roas)}</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded bg-muted">
                    <div className="h-2.5 rounded bg-primary" style={{ width: `${Math.max(share(l), 1)}%` }} />
                  </div>
                </div>
              ))}
              {alertas.map((a) => (
                <p key={a} className="text-xs rounded border border-warning/20 bg-warning/5 p-2 text-warning">{a}</p>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {render("formato", "Diversidade por formato")}
      {render("tipo_criativo", "Diversidade por tipo de criativo")}
    </div>
  );
}

// ===== Fadiga =====
function Fadiga({ criativos }: { criativos: CriativoPeriodo[] }) {
  const linhas = criativos
    .map((c) => ({ c, ...scoreFadiga(c) }))
    .filter((l) => l.score >= 4)
    .sort((a, b) => b.score - a.score);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Fadiga &amp; Refresh</CardTitle>
        <p className="text-sm text-muted-foreground">Cadência de refresh: Always-On mensal · Remarketing quinzenal · Ações semanais</p>
      </CardHeader>
      <CardContent>
        {linhas.length === 0 ? (
          <p className="text-sm text-success">Nenhum criativo com sinal de fadiga no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anúncio</TableHead>
                  <TableHead className="text-right">Frequência</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Sinais</TableHead>
                  <TableHead>Recomendação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.c.ad_id}>
                    <TableCell className="max-w-[260px]">
                      <p className="text-sm font-medium truncate">{l.c.ad_name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{l.c.campaign_name || "—"}</p>
                    </TableCell>
                    <TableCell className="text-right">{l.c.frequency != null ? Number(l.c.frequency).toFixed(1).replace(".", ",") : "—"}</TableCell>
                    <TableCell className={cn("text-right font-semibold", l.score >= 8 ? "text-danger" : "text-warning")}>{l.score}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.motivos.join(" · ")}</TableCell>
                    <TableCell className="text-sm">{l.recomendacao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Aba principal =====
export function CriativosTab({ dias, criativos, loading }: { dias: number; criativos: CriativoPeriodo[]; loading: boolean }) {
  const [ordem, setOrdem] = useState("spend");
  const [fFormato, setFFormato] = useState(TODOS);
  const [fTipo, setFTipo] = useState(TODOS);
  const [fCampanha, setFCampanha] = useState(TODOS);
  const [detalhe, setDetalhe] = useState<CriativoPeriodo | null>(null);

  const base = useMemo(() => criativos.filter((c) => n(c.impressions) > 0), [criativos]);

  const opcoes = useMemo(() => ({
    formatos: [...new Set(base.map((c) => c.formato).filter(Boolean))] as string[],
    tipos: [...new Set(base.map((c) => c.tipo_criativo).filter(Boolean))] as string[],
    campanhas: [...new Set(base.map((c) => c.campaign_name).filter(Boolean))] as string[],
  }), [base]);

  const lista = useMemo(() => {
    const filtrados = base.filter((c) =>
      (fFormato === TODOS || c.formato === fFormato) &&
      (fTipo === TODOS || c.tipo_criativo === fTipo) &&
      (fCampanha === TODOS || c.campaign_name === fCampanha)
    );
    const chave = (c: CriativoPeriodo) => {
      switch (ordem) {
        case "roas": return n(c.roas);
        case "ctr": return n(c.ctr_link);
        case "thumb": return n(c.thumb_stop_rate);
        case "impressions": return n(c.impressions);
        case "cpa": return n(c.purchases) > 0 ? -n(c.cpa) : -Infinity;
        default: return n(c.spend);
      }
    };
    return [...filtrados].sort((a, b) => chave(b) - chave(a));
  }, [base, fFormato, fTipo, fCampanha, ordem]);

  const kpis = useMemo(() => {
    const soma = (arr: CriativoPeriodo[], k: keyof CriativoPeriodo) => arr.reduce((s, c) => s + n(c[k] as number), 0);
    const spend = soma(base, "spend");
    const prevSpend = soma(base, "prev_spend");
    const receita = soma(base, "purchase_value");
    const compras = soma(base, "purchases");
    const imp = soma(base, "impressions");
    const prevImp = soma(base, "prev_impressions");
    const clicks = soma(base, "link_clicks");
    const videos = base.filter((c) => isVideo(c.formato) && n(c.impressions) > 0);
    const media = (arr: CriativoPeriodo[], k: keyof CriativoPeriodo) => {
      const v = arr.map((c) => c[k]).filter((x) => x !== null && x !== undefined).map(Number);
      return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    };
    return {
      spend, prevSpend,
      roas: spend > 0 ? receita / spend : null,
      prevRoas: prevSpend > 0 ? null : null,
      cpa: compras > 0 ? spend / compras : null,
      thumb: media(videos, "thumb_stop_rate"),
      prevThumb: media(videos, "prev_thumb_stop"),
      ctr: imp > 0 ? (clicks / imp) * 100 : null,
      prevCtr: media(base, "prev_ctr_link"),
      freq: media(base, "frequency"),
      imp, prevImp,
      prevCpa: media(base, "prev_cpa"),
      prevRoasMedio: media(base, "prev_roas"),
    };
  }, [base]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <div className="grid md:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[380px]" />)}</div>
      </div>
    );
  }

  if (base.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Sem dados no período</CardContent>
      </Card>
    );
  }

  const kpiCards = [
    { label: "Investimento total", valor: brl(kpis.spend), atual: kpis.spend, anterior: kpis.prevSpend },
    { label: "ROAS médio", valor: roasFmt(kpis.roas), atual: kpis.roas, anterior: kpis.prevRoasMedio },
    { label: "CPA médio", valor: kpis.cpa === null ? "—" : brl(kpis.cpa), atual: kpis.cpa, anterior: kpis.prevCpa, menorMelhor: true },
    { label: "Thumb Stop médio (vídeos)", valor: pct(kpis.thumb), atual: kpis.thumb, anterior: kpis.prevThumb },
    { label: "CTR médio", valor: pct(kpis.ctr, 2), atual: kpis.ctr, anterior: kpis.prevCtr },
    { label: "Frequência média", valor: kpis.freq === null ? "—" : Number(kpis.freq).toFixed(1).replace(".", ","), atual: kpis.freq, anterior: null, menorMelhor: true },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="text-xl font-serif font-bold mt-1">{k.valor}</p>
            <Delta atual={k.atual} anterior={k.anterior} menorMelhor={k.menorMelhor} />
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-lg">Criativos ({lista.length})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={ordem} onValueChange={setOrdem}>
              <SelectTrigger className="w-[190px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="spend">Ordenar: Investimento</SelectItem>
                <SelectItem value="roas">Ordenar: ROAS</SelectItem>
                <SelectItem value="cpa">Ordenar: CPA</SelectItem>
                <SelectItem value="ctr">Ordenar: CTR</SelectItem>
                <SelectItem value="thumb">Ordenar: Thumb Stop</SelectItem>
                <SelectItem value="impressions">Ordenar: Impressões</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fFormato} onValueChange={setFFormato}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os formatos</SelectItem>
                {opcoes.formatos.map((f) => <SelectItem key={f} value={f}>{FORMATO_LABEL[f.toLowerCase()] || f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os tipos</SelectItem>
                {opcoes.tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fCampanha} onValueChange={setFCampanha}>
              <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as campanhas</SelectItem>
                {opcoes.campanhas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {lista.map((c) => <CardCriativo key={c.ad_id} c={c} onClick={() => setDetalhe(c)} />)}
          </div>
        </CardContent>
      </Card>


      <Diversidade dias={dias} />
      <Fadiga criativos={base} />

      <DetalheCriativo c={detalhe} dias={dias} onClose={() => setDetalhe(null)} />
    </div>
  );
}

export { NivelBadge };
