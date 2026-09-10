import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ChevronRight } from "lucide-react";
import {
  listarVideos, produtosPorIds, videosConfigLer,
  type ProdutoPai, type VideoLinha, type VideosConfig,
} from "@/lib/videosVitrine";
import { OrdemPecaDialog } from "./OrdemPecaDialog";

interface Destino {
  tipo: string;
  alvo: string;
  formato: string;
  quantos: number;
}

const simNao = (v: unknown) => (v ? "sim" : "não");

export function OndeApareceTab() {
  const [videos, setVideos] = useState<VideoLinha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [config, setConfig] = useState<VideosConfig | null>(null);
  const [produtos, setProdutos] = useState<Record<string, ProdutoPai>>({});
  const [peca, setPeca] = useState<{ id: string; nome: string } | null>(null);

  const carregar = () => {
    listarVideos()
      .then(async (lista) => {
        setVideos(lista);
        const ids = lista.flatMap((v) => (v.videos_produtos ?? []).map((p) => String(p.tray_product_id)));
        if (ids.length) setProdutos(await produtosPorIds(ids).catch(() => ({})));
      })
      .catch(() => setVideos([]))
      .finally(() => setCarregando(false));
    videosConfigLer().then(setConfig).catch(() => setConfig(null));
  };

  useEffect(carregar, []);

  const pecas = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const v of videos) {
      for (const p of v.videos_produtos ?? []) {
        const id = String(p.tray_product_id);
        mapa[id] = (mapa[id] ?? 0) + 1;
      }
    }
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [videos]);

  const porTipo = useMemo(() => {
    const mapa: Record<string, Record<string, Destino>> = {};
    for (const v of videos) {
      for (const p of v.videos_placement ?? []) {
        if (!p.ativo) continue;
        const alvo = p.alvo ?? "—";
        const chave = `${alvo}|${p.formato}`;
        const grupo = (mapa[p.tipo] ??= {});
        grupo[chave] ??= { tipo: p.tipo, alvo, formato: p.formato, quantos: 0 };
        grupo[chave].quantos++;
      }
    }
    return mapa;
  }, [videos]);

  if (carregando) return <Skeleton className="h-48 w-full" />;

  const tipos = Object.keys(porTipo);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Padrão da loja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!config ? (
            <p className="text-muted-foreground">Padrão da loja ainda não configurado.</p>
          ) : (
            <ul className="space-y-1">
              <li>Galeria de fotos do produto: <strong>{simNao(config.galeria_ativa)}</strong></li>
              <li>Posição do vídeo na galeria: <strong>{config.galeria_posicao ?? "—"}</strong></li>
              <li>Carrossel abaixo da descrição: <strong>{simNao(config.carrossel_ativo)}</strong></li>
              <li>Título do bloco: <strong>{config.titulo_bloco || "—"}</strong></li>
              <li>Quantos vídeos entram na galeria: <strong>{config.max_galeria ?? "—"}</strong></li>
            </ul>
          )}
          <p className="pt-1 text-xs text-muted-foreground">
            Todo vídeo com peça marcada segue este padrão. A lista abaixo é só para as exceções.
          </p>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Cada vídeo escolhe onde aparece dentro do próprio cadastro, na aba Vídeos. Aqui você vê o
        resumo de quantos vídeos caem em cada destino hoje.
      </p>


      {tipos.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum destino configurado ainda.
        </p>
      ) : (
        tipos.map((tipo) => (
          <Card key={tipo}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base capitalize">{tipo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.values(porTipo[tipo])
                .sort((a, b) => b.quantos - a.quantos)
                .map((d) => (
                  <div key={`${d.alvo}-${d.formato}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 rounded-md border p-2">
                      <span className="truncate text-sm">{d.alvo}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{d.formato}</Badge>
                        <span className="text-sm font-medium">{d.quantos} vídeos</span>
                      </div>
                    </div>
                    {d.quantos > 12 && (
                      <Alert className="border-warning/40 bg-warning/10">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <AlertDescription className="text-xs">
                          Carrossel muito longo, a cliente não chega no fim.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        ))
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ordem por peça</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pecas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma peça com vídeo ainda.
            </p>
          ) : (
            pecas.map(([id, quantos]) => {
              const p = produtos[id];
              return (
                <button
                  key={id}
                  onClick={() => setPeca({ id, nome: p?.nome ?? id })}
                  className="flex w-full items-center gap-3 rounded-md border p-2 text-left transition hover:bg-muted/50"
                >
                  {p?.imagem
                    ? <img src={p.imagem} alt="" className="h-12 w-12 rounded object-cover" />
                    : <div className="h-12 w-12 rounded bg-muted" />}
                  <span className="min-w-0 flex-1 truncate text-sm">{p?.nome ?? id}</span>
                  <span className="text-sm text-muted-foreground">
                    {quantos} {quantos === 1 ? "vídeo" : "vídeos"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      <OrdemPecaDialog
        aberto={!!peca}
        trayProductId={peca?.id ?? null}
        nomeProduto={peca?.nome}
        onFechar={() => setPeca(null)}
      />
    </div>
  );
}
