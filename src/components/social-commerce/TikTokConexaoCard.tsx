import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Music2, RefreshCw } from "lucide-react";
import { iniciarOAuthTikTok, lerTikTokConfig, type TikTokConfig } from "@/lib/tiktok";

/** Card de conexão da conta do TikTok (Configurações › Integrações). */
export function TikTokConexaoCard() {
  const [cfg, setCfg] = useState<TikTokConfig | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [conectando, setConectando] = useState(false);

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

  // Ao voltar o foco para a aba (depois da autorização), reler o estado.
  useEffect(() => {
    const aoFocar = () => carregar();
    window.addEventListener("focus", aoFocar);
    return () => window.removeEventListener("focus", aoFocar);
  }, [carregar]);

  const conectar = async () => {
    if (conectando) return;
    setConectando(true);
    try {
      const url = await iniciarOAuthTikTok();
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível iniciar a conexão com o TikTok");
    } finally {
      setConectando(false);
    }
  };

  const conectado = cfg?.conectado === true;
  const refreshVencido =
    !!cfg?.refresh_expira_em && new Date(cfg.refresh_expira_em).getTime() < Date.now();

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
                Agendamento e publicação automática pela fila do painel.
              </p>
            </div>
          </div>

          {carregando ? (
            <Skeleton className="h-9 w-36" />
          ) : conectado ? (
            <div className="flex items-center gap-3">
              {cfg?.creator_avatar_url && (
                <img
                  src={cfg.creator_avatar_url}
                  alt={cfg.creator_nickname ?? "Conta do TikTok"}
                  className="h-10 w-10 rounded-full object-cover border"
                />
              )}
              <div className="text-sm">
                <p className="font-medium leading-tight">{cfg?.creator_nickname ?? "Conta conectada"}</p>
                <p className="text-xs text-muted-foreground">@{cfg?.creator_username ?? "—"}</p>
              </div>
              <Button variant="outline" size="sm" onClick={conectar} disabled={conectando}>
                {conectando ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Reconectar
              </Button>
            </div>
          ) : (
            <Button onClick={conectar} disabled={conectando}>
              {conectando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Conectar TikTok
            </Button>
          )}
        </div>

        {!carregando && cfg?.auditado === false && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs">
              App em auditoria no TikTok. Até a aprovação, só dá para publicar em conta no modo
              privado, e o post sai como "Só eu". Use a conta de teste.
            </p>
          </div>
        )}

        {!carregando && refreshVencido && (
          <p className="text-xs text-danger font-medium">Reconecte a conta do TikTok</p>
        )}

        {!carregando && cfg?.ultimo_erro && (
          <p className="text-xs text-danger">{cfg.ultimo_erro}</p>
        )}

        {!carregando && cfg?.sandbox && (
          <p className="text-[11px] text-muted-foreground">Conta em ambiente de testes (sandbox).</p>
        )}
      </CardContent>
    </Card>
  );
}
