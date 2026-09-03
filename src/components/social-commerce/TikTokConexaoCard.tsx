import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Music2 } from "lucide-react";
import { lerTikTokConfig, type TikTokConfig } from "@/lib/tiktok";

/**
 * Estado da publicação no TikTok (Configurações › Integrações).
 * Desde 03/09 quem publica é a Buffer — não há mais OAuth do TikTok aqui.
 * A chave da Buffer é configurada pelo responsável técnico, direto no banco.
 */
export function TikTokConexaoCard() {
  const [cfg, setCfg] = useState<TikTokConfig | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      setCfg(await lerTikTokConfig());
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler a configuração do TikTok");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const conectado = cfg?.buffer_conectado === true;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-foreground/5 flex items-center justify-center">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-serif text-lg font-semibold">TikTok</p>
              <p className="text-xs text-muted-foreground">
                Publique e agende no TikTok direto pelo painel.
              </p>
            </div>
          </div>

          {carregando ? (
            <Skeleton className="h-9 w-56" />
          ) : conectado ? (
            <p className="text-sm">
              Publicando no TikTok via Buffer, canal{" "}
              <strong>@{cfg?.buffer_channel_nome ?? "—"}</strong>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Publicação no TikTok desligada. A chave da Buffer não está configurada.
            </p>
          )}
        </div>

        {!carregando && cfg?.ultimo_erro && (
          <p className="text-xs text-danger">{cfg.ultimo_erro}</p>
        )}
      </CardContent>
    </Card>
  );
}
