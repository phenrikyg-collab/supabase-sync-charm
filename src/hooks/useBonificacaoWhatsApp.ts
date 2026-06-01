import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef } from "react";
import { calcularBonus, CONFIG_PADRAO, ConfigBonificacao } from "@/lib/bonificacaoWhatsApp";
import { startOfMonth, endOfMonth, format, parse } from "date-fns";


async function fetchAll<T = any>(table: string, build: (q: any) => any): Promise<T[]> {
  const acc: T[] = [];
  let from = 0;
  const size = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await build(supabase.from(table).select("*").range(from, from + size - 1));
    if (error) throw error;
    const rows = (data ?? []) as T[];
    acc.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return acc;
}

export interface Consultora {
  id: string;
  nome: string;
  apelido_canal: string | null;
  point_sale_patterns: string[] | null;
  telefone: string | null;
  meta_individual: number | null;
  ativa: boolean;
}

export interface MetaWA {
  id: string;
  mes_referencia: string;
  meta_total: number;
  ticket_medio_meta: number;
  modo_distribuicao: "individual" | "proporcional";
}

interface TrayOrder {
  id: number;
  date: string | null;
  total: number | null;
  discount: number | null;
  discount_coupon: string | null;
  point_sale: string | null;
  orderstatus_status: string | null;
  orderstatus_type: string | null;
}

const parseCupomValor = (s?: string | null): number => {
  if (!s) return 0;
  const parts = String(s).split("/");
  if (parts.length < 2) return 0;
  const n = parseFloat(parts[parts.length - 1].replace(",", "."));
  return isNaN(n) ? 0 : n;
};
const descontoTotal = (p: TrayOrder) =>
  Number(p.discount ?? 0) + parseCupomValor(p.discount_coupon);

// mesma regra do Dashboard Comercial: exclui apenas pedidos com type "canceled"
function pedidoValido(p: TrayOrder): boolean {
  const t = (p.orderstatus_type ?? "").toLowerCase();
  return t !== "canceled";
}

export function useConsultoras() {
  return useQuery<Consultora[]>({
    queryKey: ["consultoras-wa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoras_whatsapp" as any)
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Consultora[];
    },
  });
}

export function useMetaMes(mesRef: string) {
  return useQuery<MetaWA | null>({
    queryKey: ["meta-wa", mesRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas_whatsapp" as any)
        .select("*")
        .eq("mes_referencia", mesRef)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as MetaWA | null;
    },
  });
}

export function useMetasIndividuais(mesRef: string) {
  return useQuery({
    queryKey: ["metas-wa-individuais", mesRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas_whatsapp_consultoras" as any)
        .select("*")
        .eq("mes_referencia", mesRef);
      if (error) throw error;
      return (data ?? []) as Array<{ consultora_id: string; meta_valor: number }>;
    },
  });
}

export function useConfigBonificacao() {
  return useQuery<ConfigBonificacao>({
    queryKey: ["config-bonus-wa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_bonificacao_whatsapp" as any)
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return CONFIG_PADRAO;
      const r = data as any;
      return {
        faixas_meta: r.faixas_meta,
        regras_desconto: r.regras_desconto,
        faixas_ticket: r.faixas_ticket,
      };
    },
  });
}

export function useApurarMes(mesRef: string) {
  const { data: consultoras = [] } = useConsultoras();
  const { data: meta } = useMetaMes(mesRef);
  const { data: metasInd = [] } = useMetasIndividuais(mesRef);
  const { data: config = CONFIG_PADRAO } = useConfigBonificacao();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-wa", mesRef],
    queryFn: async () => {
      const dt = parse(mesRef + "-01", "yyyy-MM-dd", new Date());
      const di = format(startOfMonth(dt), "yyyy-MM-dd");
      const df = format(endOfMonth(dt), "yyyy-MM-dd");
      return await fetchAll<TrayOrder>("tray_orders", (q: any) =>
        q.gte("date", di).lte("date", df)
         .ilike("point_sale", "%whatsapp%")
         .neq("orderstatus_type", "canceled")
      );
    },
  });

  const resultado = useMemo(() => {
    const ativas = consultoras.filter((c) => c.ativa);
    const validos = pedidos.filter(pedidoValido);

    // associa pedido -> consultora
    function consultoraDoPedido(p: TrayOrder): Consultora | null {
      const ps = (p.point_sale ?? "").toLowerCase();
      for (const c of ativas) {
        const patterns = (c.point_sale_patterns ?? []).filter(Boolean);
        if (patterns.some((pat) => ps.includes(pat.toLowerCase()))) return c;
        if (c.apelido_canal && ps.includes(c.apelido_canal.toLowerCase())) return c;
      }
      return null;
    }

    type Bucket = {
      consultora: Consultora;
      faturamento_bruto: number;
      faturamento_liquido: number;
      desconto: number;
      qtd_pedidos: number;
    };
    const buckets = new Map<string, Bucket>();
    let semConsultora = { faturamento_bruto: 0, faturamento_liquido: 0, qtd_pedidos: 0 };

    for (const p of validos) {
      const c = consultoraDoPedido(p);
      const bruto = Number(p.total ?? 0);
      const desc = descontoTotal(p);
      if (!c) {
        semConsultora.faturamento_bruto += bruto;
        semConsultora.faturamento_liquido += bruto;
        semConsultora.qtd_pedidos += 1;
        continue;
      }
      const cur = buckets.get(c.id) ?? {
        consultora: c, faturamento_bruto: 0, faturamento_liquido: 0, desconto: 0, qtd_pedidos: 0,
      };
      cur.faturamento_bruto += bruto;
      cur.faturamento_liquido += bruto;
      cur.desconto += desc;
      cur.qtd_pedidos += 1;
      buckets.set(c.id, cur);
    }

    // garante todas as consultoras na lista (mesmo zeradas)
    for (const c of ativas) {
      if (!buckets.has(c.id)) {
        buckets.set(c.id, {
          consultora: c, faturamento_bruto: 0, faturamento_liquido: 0, desconto: 0, qtd_pedidos: 0,
        });
      }
    }

    const metaTotal = meta?.meta_total ?? 0;
    const modo = meta?.modo_distribuicao ?? "proporcional";

    // soma de metas individuais cadastradas (para validar split)
    const metasIndMap = new Map(metasInd.map((m) => [m.consultora_id, Number(m.meta_valor)]));

    const linhas = Array.from(buckets.values()).map((b) => {
      let metaConsultora = 0;
      if (modo === "individual") {
        metaConsultora =
          metasIndMap.get(b.consultora.id) ??
          Number(b.consultora.meta_individual ?? 0);
      } else {
        const n = ativas.length || 1;
        metaConsultora = metaTotal / n;
      }
      // Alinhado ao Dashboard Comercial: faturamento e ticket usam o BRUTO (total dos pedidos)
      const ticket = b.qtd_pedidos > 0 ? b.faturamento_bruto / b.qtd_pedidos : 0;
      const descPct = b.faturamento_bruto > 0 ? (b.desconto / b.faturamento_bruto) * 100 : 0;
      const calc = calcularBonus(b.faturamento_bruto, metaConsultora, ticket, descPct, config);
      return {
        consultora: b.consultora,
        faturamento_bruto: b.faturamento_bruto,
        // mantém o nome do campo por compatibilidade com a UI, mas agora reflete o BRUTO (igual ao card do canal)
        faturamento_liquido: b.faturamento_bruto,
        desconto: b.desconto,
        desconto_medio_pct: descPct,
        qtd_pedidos: b.qtd_pedidos,
        ticket_medio: ticket,
        meta: metaConsultora,
        ...calc,
      };
    }).sort((a, b) => b.faturamento_bruto - a.faturamento_bruto);

    const totalPedidos = linhas.reduce((a, l) => a + l.qtd_pedidos, 0);
    const totalDesc = linhas.reduce((a, l) => a + l.desconto, 0);
    const totalBruto = linhas.reduce((a, l) => a + l.faturamento_bruto, 0);
    const totalFatLiquido = totalBruto;
    const totalBonus = linhas.reduce((a, l) => a + l.bonus_final, 0);

    return {
      isLoading,
      linhas,
      meta,
      modo,
      semConsultora,
      pedidos: validos,
      totais: {
        faturamento_liquido: totalFatLiquido,
        faturamento_bruto: totalBruto,
        meta: metaTotal,
        ticket_medio_meta: Number(meta?.ticket_medio_meta ?? 0),
        pct: metaTotal > 0 ? (totalFatLiquido / metaTotal) * 100 : 0,
        ticket_medio: totalPedidos > 0 ? totalFatLiquido / totalPedidos : 0,
        desconto_medio_pct: totalBruto > 0 ? (totalDesc / totalBruto) * 100 : 0,
        qtd_pedidos: totalPedidos,
        bonus: totalBonus,
      },
      config,
    };
  }, [consultoras, pedidos, meta, metasInd, config, isLoading]);

  // Auto-persiste a projeção do mês em bonus_whatsapp_apurados (status 'projetado'),
  // desde que ainda não exista um snapshot aprovado/pago para a consultora no mês.
  const lastSnapshotKey = useRef<string>("");
  useEffect(() => {
    if (resultado.isLoading) return;
    if (!resultado.linhas.length) return;
    const key = `${mesRef}:${resultado.linhas.map((l) => `${l.consultora.id}:${l.bonus_final.toFixed(2)}:${l.faturamento_bruto.toFixed(2)}`).join("|")}`;
    if (key === lastSnapshotKey.current) return;
    lastSnapshotKey.current = key;

    (async () => {
      const { data: existentes } = await supabase
        .from("bonus_whatsapp_apurados" as any)
        .select("consultora_id,status")
        .eq("mes_referencia", mesRef);
      const congelados = new Set(
        ((existentes ?? []) as Array<{ consultora_id: string; status: string }>)
          .filter((r) => r.status === "aprovado" || r.status === "pago")
          .map((r) => r.consultora_id)
      );
      const rows = resultado.linhas
        .filter((l) => !congelados.has(l.consultora.id))
        .map((l) => ({
          mes_referencia: mesRef,
          consultora_id: l.consultora.id,
          faturamento_liquido: l.faturamento_liquido,
          meta: l.meta,
          pct_atingimento: l.pct_atingimento,
          ticket_medio: l.ticket_medio,
          desconto_medio_pct: l.desconto_medio_pct,
          qtd_pedidos: l.qtd_pedidos,
          bonus_base: l.bonus_base,
          multiplicador_desconto: l.multiplicador_desconto,
          acelerador_ticket: l.acelerador_ticket,
          bonus_final: l.bonus_final,
          status: "projetado",
          data_pagamento: null as string | null,
        }));
      if (rows.length === 0) return;
      await supabase
        .from("bonus_whatsapp_apurados" as any)
        .upsert(rows, { onConflict: "mes_referencia,consultora_id" });
    })();
  }, [resultado, mesRef]);

  return resultado;
}

}
