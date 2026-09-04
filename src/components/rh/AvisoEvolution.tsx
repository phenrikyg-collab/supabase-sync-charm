import { AlertTriangle } from "lucide-react";

export function AvisoEvolution() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <p>
        As mensagens saem pelo mesmo número do Grupo VIP. É API não oficial do WhatsApp: mantenha o volume
        baixo e não use para aviso em massa.
      </p>
    </div>
  );
}
