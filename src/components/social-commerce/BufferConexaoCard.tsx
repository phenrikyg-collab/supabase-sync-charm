import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { listarCanaisBuffer, NOME_SERVICO, SERVICOS, type BufferCanal } from "@/lib/buffer";

/**
 * Card por canal da Buffer (TikTok, YouTube, Pinterest).
 * Quem conecta canal é a Buffer — aqui é só leitura de estado.
 */
export function BufferConexaoCard() {
  const [canais, setCanais] = useState<BufferCanal[] | null>(null);

  useEffect(() => {
    listarCanaisBuffer()
      .then(setCanais)
      .catch(() => setCanais([]));
  }, []);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {SERVICOS.map((s) => {
        const c = canais?.find((x) => x.servico === s) ?? null;
        return (
          <Card key={s}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-serif">{NOME_SERVICO[s]}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              {canais === null ? (
                <p className="text-muted-foreground">Carregando…</p>
              ) : !c ? (
                <p className="text-muted-foreground">Canal não conectado na Buffer.</p>
              ) : c.desconectado ? (
                <p className="text-danger flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                  Desconectado na Buffer. Reconecte por lá, senão os posts vão falhar.
                </p>
              ) : (
                <p className="text-muted-foreground flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-px" />
                  Publicando via Buffer{c.nome ? `, canal ${c.nome}` : ""}.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
