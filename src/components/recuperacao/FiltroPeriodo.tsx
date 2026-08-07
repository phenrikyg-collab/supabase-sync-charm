import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Periodo = { inicio: string | null; fim: string | null };

function isoDiasAtras(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export function periodoUltimosDias(dias: number): Periodo {
  return { inicio: isoDiasAtras(dias), fim: hojeIso() };
}

type Props = {
  periodo: Periodo;
  onChange: (p: Periodo) => void;
};

export function FiltroPeriodo({ periodo, onChange }: Props) {
  const atalhos: { label: string; valor: Periodo }[] = [
    { label: "Últimos 7 dias", valor: periodoUltimosDias(7) },
    { label: "30 dias", valor: periodoUltimosDias(30) },
    { label: "90 dias", valor: periodoUltimosDias(90) },
    { label: "Tudo", valor: { inicio: null, fim: null } },
  ];

  const ativo = (p: Periodo) => p.inicio === periodo.inicio && p.fim === periodo.fim;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">De</Label>
        <Input
          type="date"
          className="h-9 w-[150px]"
          value={periodo.inicio ?? ""}
          onChange={(e) => onChange({ ...periodo, inicio: e.target.value || null })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Até</Label>
        <Input
          type="date"
          className="h-9 w-[150px]"
          value={periodo.fim ?? ""}
          onChange={(e) => onChange({ ...periodo, fim: e.target.value || null })}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {atalhos.map((a) => (
          <Button
            key={a.label}
            size="sm"
            variant={ativo(a.valor) ? "default" : "outline"}
            className="h-9"
            onClick={() => onChange(a.valor)}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
