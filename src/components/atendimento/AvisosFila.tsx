import { Bell, BellOff, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAvisosFila } from "@/hooks/useAvisosFila";

function textoAparelhos(quantidade: number) {
  return `${quantidade} ${quantidade === 1 ? "aparelho seu recebendo" : "aparelhos seus recebendo"}`;
}

export function AvisosFila() {
  const { situacao, suportado, carregando, alterando, ativar, desativar } = useAvisosFila();
  const bloqueado = typeof Notification !== "undefined" && Notification.permission === "denied";
  const ativo = !!situacao?.ativo_neste_aparelho;

  return (
    <Card className="mx-3 mt-3 flex shrink-0 flex-col gap-2 p-3 sm:mx-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Avisos no celular</h2>
          {carregando && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        {!suportado ? (
          <p className="mt-1 text-xs text-muted-foreground">No iPhone, adicione primeiro à Tela de Início pelo botão Compartilhar do Safari.</p>
        ) : bloqueado ? (
          <p className="mt-1 text-xs text-danger">Os avisos foram bloqueados. Libere a permissão nas configurações do navegador.</p>
        ) : (
          <>
            {situacao && (
              <p className="mt-1 text-xs text-muted-foreground">
                {textoAparelhos(Number(situacao.meus_aparelhos ?? 0))}{situacao.janela ? `, das ${situacao.janela}` : ""}.
              </p>
            )}
            {situacao?.aviso_de_fila_ligado === false && (
              <p className="mt-1 text-xs text-warning">O envio automático ainda está desligado no servidor.</p>
            )}
          </>
        )}
      </div>
      {suportado && !bloqueado && (
        <Button
          size="sm"
          variant={ativo ? "outline" : "default"}
          disabled={carregando || alterando}
          onClick={() => void (ativo ? desativar() : ativar())}
          className="shrink-0"
        >
          {alterando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : ativo ? <BellOff className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
          {ativo ? "Desativar" : "Ativar avisos neste aparelho"}
        </Button>
      )}
    </Card>
  );
}