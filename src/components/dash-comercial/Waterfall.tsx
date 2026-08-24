import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtBRL, fraseWaterfall, ResultadoLMDI } from "@/lib/dashComercial";
import { SeloAviso } from "./ui";

/**
 * Seção 3 — "Por que a receita mudou".
 * Waterfall horizontal LMDI: parcelas fecham exatamente com o gap.
 */
export function Waterfall({
  resultado,
  avisoJanela,
  onDriver,
  rotuloComparativo,
}: {
  resultado: ResultadoLMDI;
  avisoJanela?: string | null;
  onDriver?: (driver: string) => void;
  rotuloComparativo: string;
}) {
  const maxAbs = Math.max(1, ...resultado.parcelas.map((p) => Math.abs(p.valor)));
  const residuo = resultado.gap - resultado.soma;

  return (
    <Card className="border-primary/30 shadow-md">
      <CardContent className="p-5 md:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-serif text-2xl font-bold tracking-tight">Por que a receita mudou</h2>
            <p className="text-xs text-muted-foreground">
              Decomposição LMDI de Receita = Sessões × Conversão × Ticket × Aprovação · {rotuloComparativo}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Saldo</p>
            <p className={cn("font-serif text-2xl font-bold tabular-nums", resultado.gap < 0 ? "text-neg" : "text-pos")}>
              {resultado.gap < 0 ? "−" : "+"}{fmtBRL(Math.abs(resultado.gap))}
            </p>
          </div>
        </div>

        {avisoJanela && <SeloAviso texto={avisoJanela} />}

        {!resultado.valido ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem sessões nos dois períodos — não é possível decompor a variação.
          </p>
        ) : (
          <div className="space-y-2">
            {resultado.parcelas.map((p) => {
              const largura = (Math.abs(p.valor) / maxAbs) * 50; // % da largura total (metade p/ cada lado)
              const neg = p.valor < 0;
              return (
                <button
                  key={p.driver}
                  type="button"
                  onClick={() => onDriver?.(p.driver)}
                  className="group grid w-full grid-cols-[92px_1fr] items-center gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/60"
                >
                  <span className="text-sm font-medium">{p.driver}</span>
                  <div className="relative h-9">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                    <div
                      className={cn(
                        "absolute top-1 flex h-7 items-center rounded-sm px-2 text-xs font-semibold text-white",
                        neg ? "justify-start bg-neg" : "justify-end bg-pos",
                      )}
                      style={
                        neg
                          ? { right: "50%", width: `${Math.max(largura, 6)}%` }
                          : { left: "50%", width: `${Math.max(largura, 6)}%` }
                      }
                    >
                      <span className="truncate">{neg ? "−" : "+"}{fmtBRL(Math.abs(p.valor))}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="rounded-md bg-muted/60 p-3 text-sm leading-relaxed">{fraseWaterfall(resultado)}</p>

        <p className="text-[11px] text-muted-foreground">
          Clique numa barra para abrir o detalhamento do driver · Resíduo de fechamento: {fmtBRL(Math.abs(residuo))}
          {Math.abs(residuo) <= 0.01 ? " (dentro da tolerância de R$ 0,01)" : " ⚠︎ fora da tolerância"}
        </p>
      </CardContent>
    </Card>
  );
}
