import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Plus, X } from "lucide-react";

const LIMITE_PADRAO = 280;
const MINIMO_RECOMENDADO = 3;

type Props = {
  value: string[];
  onChange: (v: string[]) => void;
  limite?: number;
};

/**
 * Lista editável de variações da resposta pública (anti-spam).
 * A cada comentário o sistema sorteia uma variação — poucas variações
 * fazem a resposta repetida ser tratada como spam pelo Instagram.
 */
export function ListaVariacoesRespostas({ value, onChange, limite = LIMITE_PADRAO }: Props) {
  const atualizar = (i: number, texto: string) =>
    onChange(value.map((v, j) => (j === i ? texto.slice(0, limite) : v)));
  const remover = (i: number) => onChange(value.filter((_, j) => j !== i));
  const adicionar = () => onChange([...value, ""]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Respostas públicas</Label>
        <span className="text-[10px] text-muted-foreground">
          {value.length} {value.length === 1 ? "variação" : "variações"}
        </span>
      </div>

      {value.length < MINIMO_RECOMENDADO && (
        <p className="text-[11px] rounded border border-warning/30 bg-warning/10 p-2 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-px" />
          <span>Poucas variações. Resposta repetida em massa é tratada como spam.</span>
        </p>
      )}

      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((v, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                value={v}
                onChange={(e) => atualizar(i, e.target.value)}
                placeholder='Ex.: "Te mandei no Direct 💛"'
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-danger"
                onClick={() => remover(i)}
                aria-label="Remover variação"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div>
        <Button type="button" variant="outline" size="sm" onClick={adicionar} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Adicionar variação
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        A cada comentário o sistema sorteia uma variação. Todas devem apontar para o Direct,
        nunca dizer que a resposta vem no próprio comentário.
      </p>
    </div>
  );
}
