import { Button } from "@/components/ui/button";

const OPCOES = [7, 30, 90];

export function SeletorDias({ valor, onChange }: { valor: number; onChange: (d: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {OPCOES.map((d) => (
        <Button
          key={d}
          size="sm"
          variant={valor === d ? "default" : "outline"}
          className="h-9"
          onClick={() => onChange(d)}
        >
          {d} dias
        </Button>
      ))}
    </div>
  );
}
