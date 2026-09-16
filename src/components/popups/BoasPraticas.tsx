import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check, AlertTriangle, X } from "lucide-react";
import type { Diagnostico } from "@/lib/popups";

const ORDEM = { ruim: 0, atencao: 1, ok: 2 } as const;

function Icone({ status }: { status: string }) {
  if (status === "ok") return <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />;
  if (status === "atencao") return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />;
  return <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" />;
}

export function BoasPraticas({
  aberto,
  aoFechar,
  diagnostico,
  aoCriarVariacao,
}: {
  aberto: boolean;
  aoFechar: () => void;
  diagnostico: Diagnostico | null | undefined;
  aoCriarVariacao: (ideia: string) => void;
}) {
  const itens = [...(diagnostico?.itens ?? [])].sort(
    (a, b) => (ORDEM[a.status] ?? 3) - (ORDEM[b.status] ?? 3)
  );
  const grupos = Array.from(new Set(itens.map((i) => i.grupo)));

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-[420px] overflow-y-auto sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>Boas práticas</SheetTitle>
        </SheetHeader>

        <p className="mt-2 text-xs text-muted-foreground">
          A nota é orientação. Só os erros de validação impedem ativar.
        </p>

        <div className="mt-4 space-y-5 pb-8">
          {grupos.map((g) => (
            <div key={g} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</p>
              {itens
                .filter((i) => i.grupo === g)
                .map((i) => (
                  <div key={i.chave} className="flex gap-2 rounded-md border border-border p-3">
                    <Icone status={i.status} />
                    <div>
                      <p className="text-sm font-semibold">{i.titulo}</p>
                      <p className="text-xs text-muted-foreground">{i.detalhe}</p>
                    </div>
                  </div>
                ))}
            </div>
          ))}

          {!!(diagnostico?.ideias_teste ?? []).length && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ideias para testar
              </p>
              {diagnostico!.ideias_teste!.map((ideia, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm">{ideia}</p>
                  <Button size="sm" variant="outline" onClick={() => aoCriarVariacao(ideia)}>
                    Criar variação A/B
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
