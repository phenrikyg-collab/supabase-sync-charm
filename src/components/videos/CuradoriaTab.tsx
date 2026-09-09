import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Info, Search } from "lucide-react";
import {
  videosCandidatos,
  marcarNoSite,
  produtosPorIds,
  formatarViews,
  dataRelativa,
  type CandidatoVideo,
  type ProdutoPai,
} from "@/lib/videosVitrine";

function Selo({ c }: { c: CandidatoVideo }) {
  const estado = c.cache_estado ?? "nao marcado";
  if (estado === "pronto")
    return (
      <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-success-foreground">
        no site · {c.cache_mb ?? 0} MB
      </span>
    );
  if (estado === "na fila")
    return (
      <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
        baixando
      </span>
    );
  if (estado === "desistiu")
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-semibold text-danger-foreground">
            falhou
          </span>
        </TooltipTrigger>
        <TooltipContent>{c.cache_erro ?? "sem detalhe do erro"}</TooltipContent>
      </Tooltip>
    );
  return <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />;
}

export function CuradoriaTab() {
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [apenasMarcados, setApenasMarcados] = useState(false);
  const [itens, setItens] = useState<CandidatoVideo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [produtos, setProdutos] = useState<Record<string, ProdutoPai>>({});

  const carregar = async () => {
    setCarregando(true);
    try {
      const dados = await videosCandidatos(busca, apenasMarcados);
      setItens(dados);
      const ids = dados.flatMap((d) => d.produtos ?? []).map(String);
      if (ids.length) setProdutos(await produtosPorIds(ids));
    } catch (e: any) {
      toast({ title: "Não deu para carregar os reels", description: e.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, apenasMarcados]);

  const marcar = async (ids: string[], usar: boolean) => {
    try {
      await marcarNoSite(ids, usar);
      toast({
        title: usar ? "Entra na fila" : "Saiu do site",
        description: usar
          ? "Entra na fila, o vídeo aparece em até 10 minutos."
          : "O vídeo deixa de aparecer na vitrine.",
      });
      setSelecionados([]);
      carregar();
    } catch (e: any) {
      toast({ title: "Não deu para salvar", description: e.message, variant: "destructive" });
    }
  };

  const todosMarcados = useMemo(
    () => selecionados.length > 0 && selecionados.every((id) => itens.find((i) => i.media_id === id)?.usar_no_site),
    [selecionados, itens],
  );

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Nem todo reel libera o arquivo na API da Meta. Quando aparecer "falhou" com "sem media_url na Graph",
          o vídeo não pode ser puxado: suba o arquivo pela aba Vídeos.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pelo texto do reel..."
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={apenasMarcados} onCheckedChange={setApenasMarcados} />
          <span className="text-sm">Só os marcados</span>
        </div>
        {selecionados.length > 0 && (
          <Button size="sm" onClick={() => marcar(selecionados, !todosMarcados)}>
            {todosMarcados ? "Desmarcar" : "Marcar"} selecionados ({selecionados.length})
          </Button>
        )}
      </div>

      {carregando ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] w-full rounded-lg" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum reel encontrado.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {itens.map((c) => (
            <div key={c.media_id} className="overflow-hidden rounded-lg border bg-card">
              <div className="relative aspect-[9/16] w-full bg-muted">
                {c.capa && (
                  <img src={c.capa} alt={c.titulo ?? "reel"} className="h-full w-full object-cover" loading="lazy" />
                )}
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <Selo c={c} />
                </div>
                <div className="absolute left-2 top-2 rounded bg-background/80 p-1">
                  <Checkbox
                    checked={selecionados.includes(c.media_id)}
                    onCheckedChange={(v) =>
                      setSelecionados((s) =>
                        v ? [...s, c.media_id] : s.filter((id) => id !== c.media_id),
                      )
                    }
                  />
                </div>
              </div>

              <div className="space-y-2 p-3">
                <p className="line-clamp-2 text-sm font-medium">{c.titulo ?? "Sem legenda"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatarViews(c.views)} views · {dataRelativa(c.publicado_em)}
                </p>
                <div className="flex flex-wrap gap-1">
                  {(c.produtos ?? []).map((pid) => (
                    <Badge key={pid} variant="secondary" className="max-w-full truncate text-[10px]">
                      {produtos[String(pid)]?.nome ?? pid}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={c.usar_no_site}
                      onCheckedChange={(v) => marcar([c.media_id], v)}
                    />
                    <span className="text-xs">usar no site</span>
                  </div>
                  {c.permalink && (
                    <a
                      href={c.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      ver no Instagram <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
