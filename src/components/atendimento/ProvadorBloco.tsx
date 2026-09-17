import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { chamarRpc } from "@/lib/supabaseRpc";

export type ProvaCliente = {
  prova_id?: string | number;
  produto_nome?: string | null;
  foto_resultado_url?: string | null;
  status?: string | null;
  status_funil?: string | null;
  criado_em?: string | null;
  ja_contatada?: boolean | null;
  template_enviado?: string | null;
  texto_abordagem?: string | null;
};

function quando(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ProvadorBloco({
  telefone,
  onUsarTexto,
}: {
  telefone: string;
  onUsarTexto: (texto: string) => void;
}) {
  const [foto, setFoto] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["provador-provas-cliente", telefone],
    enabled: !!telefone,
    queryFn: async () => {
      const { data, error } = await chamarRpc("provador_provas_da_cliente" as any, { p_telefone: telefone });
      if (error) throw error;
      return (Array.isArray(data) ? data : data ? [data] : []) as ProvaCliente[];
    },
  });

  const provas = data ?? [];
  if (provas.length === 0) return null;

  return (
    <section className="border-t border-border">
      <div className="flex items-center gap-1.5 border-b border-border p-3">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-sm font-semibold">Provador virtual</h3>
        <span className="text-xs text-muted-foreground">({provas.length})</span>
      </div>

      <div className="space-y-2 p-3">
        {provas.map((p, i) => (
          <div key={String(p.prova_id ?? i)} className="flex gap-2 rounded-md border border-border p-2">
            {p.foto_resultado_url ? (
              <button
                type="button"
                onClick={() => setFoto(p.foto_resultado_url ?? null)}
                className="h-16 w-12 shrink-0 overflow-hidden rounded-sm border border-border"
              >
                <img src={p.foto_resultado_url} alt={p.produto_nome ?? "Prova"} className="h-full w-full object-cover" />
              </button>
            ) : (
              <div className="h-16 w-12 shrink-0 rounded-sm border border-dashed border-border" />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium">{p.produto_nome ?? "Peça"}</p>
                {p.ja_contatada && (
                  <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    já abordada
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{quando(p.criado_em)}</p>
              <Button
                size="sm"
                variant={p.ja_contatada ? "outline" : "default"}
                className={cn("h-7 w-full text-xs")}
                disabled={!p.texto_abordagem}
                onClick={() => onUsarTexto(p.texto_abordagem ?? "")}
              >
                Enviar mensagem do provador
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!foto} onOpenChange={(v) => !v && setFoto(null)}>
        <DialogContent className="max-w-lg p-2">
          {foto && <img src={foto} alt="Prova do provador" className="max-h-[80vh] w-full rounded-md object-contain" />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
