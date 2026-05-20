// Categorização de produtos por nome
export type CategoriaKey =
  | "todos" | "calca" | "blusa" | "body" | "vestido"
  | "macacao" | "bottom" | "kit" | "outro";

export const CATEGORIAS: { key: CategoriaKey; label: string }[] = [
  { key: "todos",    label: "Todos" },
  { key: "calca",    label: "Calça" },
  { key: "blusa",    label: "Blusa" },
  { key: "body",     label: "Body" },
  { key: "vestido",  label: "Vestido" },
  { key: "macacao",  label: "Macacão" },
  { key: "bottom",   label: "Short/Saia" },
  { key: "kit",      label: "Kit" },
  { key: "outro",    label: "Outro" },
];

function norm(s: string | null | undefined): string {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function categorizarProduto(nome: string | null | undefined): CategoriaKey {
  const n = norm(nome);
  if (!n) return "outro";
  if (n.includes("kit")) return "kit";
  if (n.includes("vestido")) return "vestido";
  if (n.includes("macacao")) return "macacao";
  if (n.includes("body")) return "body";
  if (n.includes("calca")) return "calca";
  if (n.includes("blusa") || n.includes("regata") || n.includes("cropped")) return "blusa";
  if (n.includes("short") || n.includes("saia")) return "bottom";
  return "outro";
}

export function filtrarPorCategoria<T>(
  itens: T[],
  cat: CategoriaKey,
  getNome: (x: T) => string | null | undefined,
): T[] {
  if (cat === "todos") return itens;
  return itens.filter((it) => categorizarProduto(getNome(it)) === cat);
}
