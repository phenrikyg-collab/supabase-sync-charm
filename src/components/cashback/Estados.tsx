import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";

export function CarregandoBloco({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function EstadoVazio({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      {descricao && <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>}
    </div>
  );
}

export function EstadoErro({ mensagem, onTentar }: { mensagem: string; onTentar: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <AlertCircle className="h-6 w-6 text-danger" />
      <div>
        <p className="text-sm font-medium">Não foi possível carregar</p>
        <p className="mt-1 text-xs text-muted-foreground">{mensagem}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onTentar}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" />
        Tentar de novo
      </Button>
    </div>
  );
}
