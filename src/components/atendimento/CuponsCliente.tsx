import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { chamarRpc } from "@/lib/supabaseRpc";
import { toast } from "sonner";

type CupomCliente = {
  codigo?: string | null;
  status?: string | null;
  valor?: number | string | null;
  valor_minimo?: number | string | null;
  validade?: string | null;
  cupom_expira_em?: string | null;
  foi_usado?: boolean | null;
  expirou_sem_uso?: boolean | null;
};

const STATUS_COR: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-success/10 text-success border-success/30" },
  usado: { label: "Usado", cls: "bg-info/10 text-info border-info/30" },
  expirado: { label: "Expirado", cls: "bg-muted text-muted-foreground border-border" },
  cancelado: { label: "Cancelado", cls: "bg-danger/10 text-danger border-danger/30" },
  devolvido: { label: "Devolvido", cls: "bg-warning/10 text-warning border-warning/30" },
};

const RANK: Record<string, number> = { ativo: 0, usado: 1, expirado: 2, devolvido: 3, cancelado: 4 };

function statusDe(c: CupomCliente) {
  const chave = String(c.status ?? "").toLowerCase();
  if (STATUS_COR[chave]) return STATUS_COR[chave];
  if (c.foi_usado) return STATUS_COR.usado;
  if (c.expirou_sem_uso) return STATUS_COR.expirado;
  return STATUS_COR.ativo;
}

function moeda(v?: number | string | null) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("pt-BR");
}

export function CuponsCliente({ telefone }: { telefone: string }) {
  const [verTodos, setVerTodos] = useState(false);

  const { data: cupons = [], isLoading } = useQuery({
    queryKey: ["whatsapp-historico-cliente", telefone],
    enabled: !!telefone,
    queryFn: async () => {
      const { data, error } = await chamarRpc("whatsapp_get_historico_cliente" as any, {
        p_telefone: telefone,
      });
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      return (row?.cupons ?? []) as CupomCliente[];
    },
  });

  const ordenados = useMemo(() => {
    return [...cupons].sort((a, b) => {
      const ra = RANK[statusDe(a).label.toLowerCase()] ?? 5;
      const rb = RANK[statusDe(b).label.toLowerCase()] ?? 5;
      if (ra !== rb) return ra - rb;
      const va = new Date(a.validade ?? a.cupom_expira_em ?? "9999-12-31").getTime() || Infinity;
      const vb = new Date(b.validade ?? b.cupom_expira_em ?? "9999-12-31").getTime() || Infinity;
      return va - vb;
    });
  }, [cupons]);

  const visiveis = verTodos ? ordenados : ordenados.slice(0, 3);
  const restantes = ordenados.length - visiveis.length;

  const copiar = async (codigo?: string | null) => {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      toast({ title: "Código copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <section className="space-y-2 border-b border-border pb-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Ticket className="h-3.5 w-3.5" />
        Cupons da cliente
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando cupons…</p>}

      {!isLoading && ordenados.length === 0 && (
        <p className="text-sm text-muted-foreground">Sem cupom ativo</p>
      )}

      {visiveis.map((c, i) => {
        const st = statusDe(c);
        return (
          <div key={`${c.codigo ?? i}`} className="rounded-md border border-border p-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void copiar(c.codigo)}
                title="Copiar código"
                className="flex min-w-0 items-center gap-1.5 text-left"
              >
                <span className="truncate font-mono text-sm font-semibold">{c.codigo ?? "-"}</span>
                <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
              </button>
              <span className={cn("inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", st.cls)}>
                {st.label}
              </span>
            </div>
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              {c.valor != null && <span>{moeda(c.valor)}</span>}
              {c.valor_minimo != null && <span>mín. {moeda(c.valor_minimo)}</span>}
              {(c.validade ?? c.cupom_expira_em) && (
                <span>validade {dataCurta(c.validade ?? c.cupom_expira_em)}</span>
              )}
            </p>
          </div>
        );
      })}

      {restantes > 0 && (
        <button
          type="button"
          onClick={() => setVerTodos(true)}
          className="text-xs font-medium text-primary hover:underline"
        >
          ver todos ({ordenados.length})
        </button>
      )}
{verTodos && ordenados.length > 3 && (
        <button
          type="button"
          onClick={() => setVerTodos(false)}
          className="text-xs font-medium text-primary hover:underline"
        >
          mostrar menos
        </button>
      )}
    </section>
  );
}
