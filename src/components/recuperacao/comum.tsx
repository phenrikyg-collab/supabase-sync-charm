import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CORES_SEGMENTO: Record<string, string> = {
  campeas: "bg-success/10 text-success border-success/30",
  campeãs: "bg-success/10 text-success border-success/30",
  fieis: "bg-info/10 text-info border-info/30",
  fiéis: "bg-info/10 text-info border-info/30",
  "clientes fiéis": "bg-info/10 text-info border-info/30",
  potenciais: "bg-primary/10 text-primary border-primary/30",
  "potenciais fiéis": "bg-primary/10 text-primary border-primary/30",
  novas: "bg-primary/10 text-primary border-primary/30",
  novos: "bg-primary/10 text-primary border-primary/30",
  promissoras: "bg-primary/10 text-primary border-primary/30",
  promissores: "bg-primary/10 text-primary border-primary/30",
  "atenção": "bg-warning/10 text-warning border-warning/30",
  atencao: "bg-warning/10 text-warning border-warning/30",
  "precisam de atenção": "bg-warning/10 text-warning border-warning/30",
  "em risco": "bg-warning/10 text-warning border-warning/30",
  risco: "bg-warning/10 text-warning border-warning/30",
  hibernando: "bg-muted text-muted-foreground border-border",
  inativas: "bg-danger/10 text-danger border-danger/30",
  inativos: "bg-danger/10 text-danger border-danger/30",
  perdidas: "bg-danger/10 text-danger border-danger/30",
  perdidos: "bg-danger/10 text-danger border-danger/30",
};

export function SegmentoBadge({ segmento }: { segmento?: string | null }) {
  const chave = (segmento ?? "").trim().toLowerCase();
  const classe = CORES_SEGMENTO[chave] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", classe)}>
      {segmento?.trim() || "Sem segmento"}
    </span>
  );
}

export function moeda(v?: number | null) {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function limparHtml(texto: string) {
  return texto
    .replace(/<br\s*\/?>/gi, " · ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type ItemBruto = Record<string, any>;

export function nomesItens(itens: unknown): string[] {
  if (!Array.isArray(itens)) return [];
  return (itens as ItemBruto[]).map((i) => {
    const nome = limparHtml(String(i?.name ?? i?.nome ?? i?.produto ?? "Item"));
    const qtd = Number(i?.quantity ?? i?.quantidade ?? 1);
    return qtd > 1 ? `${qtd}x ${nome}` : nome;
  });
}

export function CelulaItens({ itens }: { itens: unknown }) {
  const [aberto, setAberto] = useState(false);
  const lista = nomesItens(itens);
  if (lista.length === 0) return <span className="text-xs text-muted-foreground">—</span>;

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-left text-xs text-muted-foreground hover:text-foreground max-w-[260px] block"
      >
        <span className="line-clamp-2">{lista[0]}</span>
        {lista.length > 1 && (
          <span className="text-[11px] font-medium text-primary">+{lista.length - 1} item(ns) · ver</span>
        )}
      </button>
    );
  }

  return (
    <div className="max-w-[280px] space-y-1">
      <ul className="list-disc pl-4 text-xs">
        {lista.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
      <Button variant="link" size="sm" className="h-auto p-0 text-[11px]" onClick={() => setAberto(false)}>
        recolher
      </Button>
    </div>
  );
}
