import { Button } from "@/components/ui/button";
import { CATEGORIAS, CategoriaKey } from "@/lib/categorias";

interface Props {
  value: CategoriaKey;
  onChange: (v: CategoriaKey) => void;
  counts?: Partial<Record<CategoriaKey, number>>;
}

export function CategoryFilter({ value, onChange, counts }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIAS.map((c) => {
        const active = value === c.key;
        const n = counts?.[c.key];
        return (
          <Button
            key={c.key}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            onClick={() => onChange(c.key)}
            className="rounded-full"
          >
            {c.label}
            {typeof n === "number" && (
              <span className="ml-2 text-xs opacity-70">({n})</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
