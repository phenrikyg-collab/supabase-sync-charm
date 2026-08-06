import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";
export type SortState<T extends string> = { key: T | null; dir: SortDir };

export function useSortable<T extends string>(inicial?: { key: T; dir?: SortDir }) {
  const [sort, setSort] = useState<SortState<T>>({
    key: inicial?.key ?? null,
    dir: inicial?.dir ?? "desc",
  });

  const alternar = (key: T) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  return { sort, alternar };
}

/** Ordena localmente uma lista já carregada */
export function useOrdenado<R, T extends string>(
  linhas: R[],
  sort: SortState<T>,
  acessores: Record<T, (linha: R) => number | string | null | undefined>,
  ordenacaoFixa?: (a: R, b: R) => number
) {
  return useMemo(() => {
    const copia = [...linhas];
    if (!sort.key) return copia;
    const get = acessores[sort.key];
    if (!get) return copia;
    const fator = sort.dir === "asc" ? 1 : -1;
    copia.sort((a, b) => {
      if (ordenacaoFixa) {
        const fixo = ordenacaoFixa(a, b);
        if (fixo !== 0) return fixo;
      }
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * fator;
      return String(va).localeCompare(String(vb), "pt-BR") * fator;
    });
    return copia;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, sort.key, sort.dir]);
}

type Props<T extends string> = {
  campo: T;
  sort: SortState<T>;
  onSort: (campo: T) => void;
  className?: string;
  children: React.ReactNode;
};

export function SortableHead<T extends string>({ campo, sort, onSort, className, children }: Props<T>) {
  const ativo = sort.key === campo;
  const Icone = !ativo ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn("cursor-pointer select-none whitespace-nowrap", className)} onClick={() => onSort(campo)}>
      <span className={cn("inline-flex items-center gap-1", ativo && "text-foreground font-semibold")}>
        {children}
        <Icone className={cn("h-3.5 w-3.5", ativo ? "opacity-100" : "opacity-40")} />
      </span>
    </TableHead>
  );
}
