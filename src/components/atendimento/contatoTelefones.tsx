import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ContatoTelefone = {
  telefone_in: string | null;
  conversa_id: number | string | null;
  nome: string | null;
  status: string | null;
  ultima_saida: string | null;
  ultima_saida_humana: string | null;
  houve_contato: boolean | null;
  houve_contato_humano: boolean | null;
  cliente_respondeu: boolean | null;
  horas_desde_contato: number | null;
  tags: unknown;
};

export const digitos = (t?: string | null) => String(t ?? "").replace(/\D/g, "");

/** Rótulo curto do tempo: horas até 48h, depois dias. */
export function tempoContato(horas?: number | null): string {
  const h = Number(horas);
  if (!Number.isFinite(h) || h < 0) return "";
  if (h < 1) return "menos de 1h";
  if (h <= 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)} dias`;
}

/**
 * Uma única chamada por tela: recebe todos os telefones dos cards
 * e devolve o mapa de contato por telefone.
 */
export function useContatoPorTelefones(telefones: (string | null | undefined)[]) {
  const lista = useMemo(() => {
    const set = new Set<string>();
    for (const t of telefones) {
      const d = digitos(t);
      if (d.length >= 8) set.add(d);
    }
    return Array.from(set).sort();
  }, [telefones]);

  const chave = lista.join(",");

  const { data = [] } = useQuery({
    queryKey: ["whatsapp-contato-telefones", chave],
    enabled: lista.length > 0,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("whatsapp_contato_por_telefones" as any, {
        p_telefones: lista,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as ContatoTelefone[];
    },
  });

  const mapa = useMemo(() => {
    const m = new Map<string, ContatoTelefone>();
    for (const c of data) {
      const d = digitos(c.telefone_in);
      if (d) m.set(d, c);
    }
    return m;
  }, [data]);

  const contatoDe = (tel?: string | null) => {
    const d = digitos(tel);
    if (!d) return undefined;
    return mapa.get(d) ?? mapa.get(d.replace(/^55/, "")) ?? mapa.get(`55${d}`);
  };

  return { mapa, contatoDe };
}

/** Selos de contato: já falamos, o bot falou, e se a cliente respondeu. */
export function BadgesContato({
  contato,
  className,
}: {
  contato?: ContatoTelefone | null;
  className?: string;
}) {
  if (!contato) return null;
  const tempo = tempoContato(contato.horas_desde_contato);
  const selos: JSX.Element[] = [];

  if (contato.houve_contato_humano) {
    selos.push(
      <span
        key="humano"
        className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning whitespace-nowrap"
      >
        {tempo ? `Você já falou há ${tempo}` : "Você já falou"}
      </span>,
    );
  } else if (contato.houve_contato) {
    selos.push(
      <span
        key="bot"
        className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap"
      >
        {tempo ? `Bot já falou há ${tempo}` : "Bot já falou"}
      </span>,
    );
  }

  if (contato.cliente_respondeu) {
    selos.push(
      <span
        key="respondeu"
        className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success whitespace-nowrap"
      >
        Respondeu
      </span>,
    );
  }

  if (selos.length === 0) return null;
  return <span className={`inline-flex flex-wrap items-center gap-1 ${className ?? ""}`}>{selos}</span>;
}
