import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtBRL } from "@/lib/dashComercial";

export interface Alerta {
  id: string;
  severidade: "critico" | "atencao";
  titulo: string;
  detalhe: string;
  impacto: number | null;
  ancora: string;
}

export function BarraAlertas({ alertas }: { alertas: Alerta[] }) {
  const [aberto, setAberto] = useState(true);
  const criticos = alertas.filter((a) => a.severidade === "critico").length;

  if (!alertas.length) {
    return (
      <Card className="border-pos/30 bg-pos/5">
        <CardContent className="flex items-center gap-2 px-4 py-3 text-sm text-pos">
          Nenhum alerta automático disparado neste período.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(criticos ? "border-neg/40" : "border-warn/40")}>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className={cn("h-4 w-4", criticos ? "text-neg" : "text-warn")} />
            {alertas.length} alerta{alertas.length > 1 ? "s" : ""} · {criticos} crítico{criticos === 1 ? "" : "s"}
          </span>
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {aberto && (
          <ul className="divide-y border-t">
            {alertas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-[240px] flex-1">
                  <p className="text-sm font-semibold">
                    <i className={cn("mr-2 inline-block h-2 w-2 rounded-full align-middle", a.severidade === "critico" ? "bg-neg" : "bg-warn")} />
                    {a.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">{a.detalhe}</p>
                </div>
                <div className="flex items-center gap-3">
                  {a.impacto !== null && (
                    <span className={cn("text-sm font-bold tabular-nums", a.severidade === "critico" ? "text-neg" : "text-warn")}>
                      {fmtBRL(a.impacto)}
                    </span>
                  )}
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`#${a.ancora}`}>Ver seção</a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
