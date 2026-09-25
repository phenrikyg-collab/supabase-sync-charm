import { useQuery } from "@tanstack/react-query";
import { CreditCard, QrCode, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chamarRpc } from "@/lib/supabaseRpc";
import { EncerrarCobrancaButton } from "@/components/atendimento/EncerrarCobrancaButton";

export type CobrancaAberta = {
  tipo: "cartao" | "pix";
  id: number;
  valor: number | string | null;
  criado_em: string | null;
  link?: string | null;
};

const moeda = (v: number | string | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-";
};
const dataCurta = (v: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export function useCobrancasAbertas(conversaId: string | number) {
  return useQuery({
    queryKey: ["cobrancas-abertas", String(conversaId)],
    refetchInterval: 30000,
    queryFn: async () => {
      const id = Number(conversaId);
      const { data, error } = await chamarRpc<CobrancaAberta[]>("whatsapp_cobrancas_abertas" as any, {
        p_conversa_id: Number.isNaN(id) ? conversaId : id,
      });
      if (error) throw error;
      return ((data ?? []) as CobrancaAberta[]).sort(
        (a, b) => new Date(b.criado_em ?? 0).getTime() - new Date(a.criado_em ?? 0).getTime(),
      );
    },
  });
}

const rpcDe = (t: CobrancaAberta["tipo"]): "banco_inter_cobranca_encerrar" | "pagamentos_link_encerrar" =>
  t === "pix" ? "banco_inter_cobranca_encerrar" : "pagamentos_link_encerrar";

/** Bloco compacto com as cobranças em aberto da conversa. */
export function CobrancasAbertas({ conversaId }: { conversaId: string | number }) {
  const { data: cobrancas = [] } = useCobrancasAbertas(conversaId);
  if (cobrancas.length === 0) return null;
  return (
    <div className="shrink-0 border-b border-border bg-warning/5 px-3 py-2">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cobranças em aberto</p>
      <div className="flex flex-wrap gap-2">
        {cobrancas.map((c) => (
          <div key={`${c.tipo}-${c.id}`} className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
            {c.tipo === "pix" ? <QrCode className="h-4 w-4 shrink-0 text-muted-foreground" /> : <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="text-sm font-semibold">{moeda(c.valor)}</span>
            <span className="text-[11px] text-muted-foreground">{dataCurta(c.criado_em)}</span>
            <EncerrarCobrancaButton
              id={c.id}
              valor={moeda(c.valor)}
              rpc={rpcDe(c.tipo)}
              conversaId={conversaId}
              gatilho={<Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">Cancelar</Button>}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tipo de cobrança anunciado em uma mensagem de saída, ou null. */
export function tipoCobrancaDaMensagem(texto?: string | null): CobrancaAberta["tipo"] | null {
  const t = (texto ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("aqui está o link pra pagamento") || t.includes("yapay")) return "cartao";
  if (t.includes("qr code pix enviado") || t.includes("código pix") || t.includes("codigo pix")) return "pix";
  return null;
}

/** Botão pequeno na bolha: cancela a cobrança mais recente daquele tipo. */
export function CancelarCobrancaBolha({ conversaId, tipo }: { conversaId: string | number; tipo: CobrancaAberta["tipo"] }) {
  const { data: cobrancas = [] } = useCobrancasAbertas(conversaId);
  const alvo = cobrancas.find((c) => c.tipo === tipo);
  if (!alvo) return null;
  return (
    <div className="mt-1">
      <EncerrarCobrancaButton
        id={alvo.id}
        valor={moeda(alvo.valor)}
        rpc={rpcDe(tipo)}
        conversaId={conversaId}
        gatilho={
          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">
            <XCircle className="mr-1 h-3 w-3" />
            Cancelar cobrança
          </Button>
        }
      />
    </div>
  );
}
