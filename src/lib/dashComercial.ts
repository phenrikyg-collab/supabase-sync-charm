import { supabase } from "@/integrations/supabase/client";

/* ============================================================================
 * Dashboard Comercial v2 — camada canônica de dados
 * ---------------------------------------------------------------------------
 * REGRAS DE FONTE (ver PARTE 1 do briefing):
 *  1.1 A data do pedido NUNCA sofre conversão de fuso. A view public.tray_orders
 *      já expõe `date` como data crua (equivalente a date_purchase::date).
 *  1.2 Fonte única de pedidos: public.tray_orders (aponta para tray_direto).
 *      Proibido usar qualquer objeto do schema kondado (ETL morto em 09/08/2026).
 *  1.3 Fonte única de sessões: ga4_aquisicao_canais. windsor_canais só como
 *      fallback quando o GA4 estiver com > 24 h de atraso (exibir selo).
 *  1.4 Percentual de aquisição sempre rotulado com a base (cliente x pedido).
 *  1.5 Meta de receita e ticket: metas_financeiras. Demais drivers:
 *      planejamento_drivers. planejamento_mensal é ignorada.
 *  1.6 Aprovação usa a regra "cancelados reais" (± 7 dias, mesmo cliente).
 * ==========================================================================*/

export const CANAIS_PAGOS = ["01. Facebook CPC", "02. Google CPC", "09. TikTok"];

export const fmtBRL = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));
export const fmtBRL0 = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(n ?? 0));
export const fmtNum = (n: number | null | undefined, d = 0) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n ?? 0));
export const fmtPct = (n: number | null | undefined, d = 1) =>
  `${Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

/** "2026-08-17" -> "17/08" */
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** "2026-08-17" -> "17/08/2026" */
export const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Data local (America/Sao_Paulo é o fuso de exibição) em ISO curto, sem UTC. */
export const isoDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const somaDias = (iso: string, n: number) => {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d + n);
  return isoDia(dt);
};
export const diffDias = (a: string, b: string) => {
  const p = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(a) - p(b)) / 86400000);
};
export const listaDias = (ini: string, fim: string) => {
  const out: string[] = [];
  let d = ini;
  let guard = 0;
  while (d <= fim && guard++ < 800) { out.push(d); d = somaDias(d, 1); }
  return out;
};
export const ehFimDeSemana = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return wd === 0 || wd === 6;
};
export const diasUteis = (ini: string, fim: string) => listaDias(ini, fim).filter((d) => !ehFimDeSemana(d)).length;

const compact = (iso: string) => iso.replace(/-/g, "");
const nz = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/* ------------------------------- tipos ---------------------------------- */

export interface Pedido {
  id: string;
  dia: string;
  customer_id: string | null;
  receita_liquida: number;
  desconto: number;
  receita_bruta: number;
  status: string;
  cancelado: boolean;
  payment_method: string;
  point_sale: string;
  cupom: string | null;
}

export interface SessaoDia {
  dia: string;
  canal: string;
  sessoes: number;
  carrinho: number;
  checkout: number;
  compras: number;
  receita: number;
}

export interface MidiaDia {
  dia: string;
  campanha: string;
  spend: number;
  cliques: number;
  impressoes: number;
  receita_atribuida: number;
  compras: number;
}

export interface ItemPedido {
  order_id: string;
  product_id: string | null;
  nome: string;
  preco: number;
  quantidade: number;
}

/* ---------------------------- normalizadores ---------------------------- */

/** desconto de cupom no formato "NOME/24.90" */
export function valorCupom(s: string | null | undefined): number {
  if (!s) return 0;
  const p = String(s).split("/");
  if (p.length < 2) return 0;
  const n = parseFloat(p[p.length - 1].replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function ehCancelado(status: string | null | undefined, tipo?: string | null): boolean {
  const s = `${status ?? ""} ${tipo ?? ""}`.toLowerCase();
  return s.includes("cancel") || s.includes("estorn");
}

function mapPedido(r: any): Pedido {
  const liquida = nz(r.total);
  const desconto = nz(r.discount) + valorCupom(r.discount_coupon);
  return {
    id: String(r.id),
    dia: String(r.date ?? "").slice(0, 10), // 1.1 — data crua, sem conversão de fuso
    customer_id: r.customer_id != null ? String(r.customer_id) : null,
    receita_liquida: liquida,
    desconto,
    receita_bruta: liquida + desconto,
    status: r.status ?? r.orderstatus_status ?? "",
    cancelado: ehCancelado(r.status ?? r.orderstatus_status, r.orderstatus_type),
    payment_method: (r.payment_form ?? "").trim(),
    point_sale: (r.point_sale ?? "").trim(),
    cupom: r.discount_coupon ?? null,
  };
}

/* ------------------------------- fetchers -------------------------------- */

async function paginado<T>(run: (from: number, to: number) => any, map: (r: any) => T): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; from < 60000; from += size) {
    const { data, error } = await run(from, from + size - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows.map(map));
    if (rows.length < size) break;
  }
  return out;
}

/** 1.2 — fonte única de pedidos. */
export async function fetchPedidos(ini: string, fim: string): Promise<Pedido[]> {
  return paginado<Pedido>(
    (from, to) =>
      supabase
        .from("tray_orders" as any)
        .select("id,date,total,discount,discount_coupon,customer_id,payment_form,point_sale,status,orderstatus_type")
        .gte("date", ini)
        .lte("date", fim)
        .order("date", { ascending: true })
        .range(from, to),
    mapPedido,
  );
}

/** 1.3 — sessões oficiais (GA4). event_date é texto YYYYMMDD. */
export async function fetchGa4(ini: string, fim: string): Promise<SessaoDia[]> {
  return paginado<SessaoDia>(
    (from, to) =>
      supabase
        .from("ga4_aquisicao_canais" as any)
        .select("event_date,canal,sessoes,adicionou_carrinho,iniciou_checkout,compras,receita")
        .gte("event_date", compact(ini))
        .lte("event_date", compact(fim))
        .range(from, to),
    (r): SessaoDia => {
      const e = String(r.event_date ?? "");
      return {
        dia: `${e.slice(0, 4)}-${e.slice(4, 6)}-${e.slice(6, 8)}`,
        canal: r.canal ?? "(sem canal)",
        sessoes: nz(r.sessoes),
        carrinho: nz(r.adicionou_carrinho),
        checkout: nz(r.iniciou_checkout),
        compras: nz(r.compras),
        receita: nz(r.receita),
      };
    },
  );
}

/** 1.3 — fallback de sessões. */
export async function fetchWindsor(ini: string, fim: string): Promise<SessaoDia[]> {
  return paginado<SessaoDia>(
    (from, to) =>
      supabase
        .from("windsor_canais" as any)
        .select("date,session_custom_channel_group,sessions,add_to_carts,checkouts,ecommerce_purchases,purchase_revenue")
        .gte("date", ini)
        .lte("date", fim)
        .range(from, to),
    (r): SessaoDia => ({
      dia: String(r.date ?? "").slice(0, 10),
      canal: r.session_custom_channel_group ?? "(sem canal)",
      sessoes: nz(r.sessions),
      carrinho: nz(r.add_to_carts),
      checkout: nz(r.checkouts),
      compras: nz(r.ecommerce_purchases),
      receita: nz(r.purchase_revenue),
    }),
  );
}

export async function fetchMidia(ini: string, fim: string): Promise<MidiaDia[]> {
  return paginado<MidiaDia>(
    (from, to) =>
      supabase
        .from("meta_ads_campanhas" as any)
        .select("data,campaign_name,spend,link_clicks,clicks,impressions,purchase_value,purchases")
        .gte("data", ini)
        .lte("data", fim)
        .range(from, to),
    (r): MidiaDia => ({
      dia: String(r.data ?? "").slice(0, 10),
      campanha: r.campaign_name ?? "(sem campanha)",
      spend: nz(r.spend),
      cliques: nz(r.link_clicks) || nz(r.clicks),
      impressoes: nz(r.impressions),
      receita_atribuida: nz(r.purchase_value),
      compras: nz(r.purchases),
    }),
  );
}

export async function fetchItens(orderIds: string[]): Promise<ItemPedido[]> {
  const out: ItemPedido[] = [];
  for (let i = 0; i < orderIds.length; i += 150) {
    const lote = orderIds.slice(i, i + 150);
    const { data, error } = await supabase
      .from("tray_productssold" as any)
      .select("order_id,product_id,name,price,quantity")
      .in("order_id", lote);
    if (error) throw error;
    for (const r of (data ?? []) as any[]) {
      out.push({
        order_id: String(r.order_id),
        product_id: r.product_id != null ? String(r.product_id) : null,
        nome: r.name ?? "(sem nome)",
        preco: nz(r.price),
        quantidade: nz(r.quantity),
      });
    }
  }
  return out;
}

export interface MetaOficial {
  meta_mensal: number | null;
  meta_ticket_medio: number | null;
  dias_uteis: number | null;
  encontrada: boolean;
}

/** 1.5 — metas_financeiras é a fonte oficial de receita e ticket. */
export async function fetchMetaOficial(mesRef: string): Promise<MetaOficial> {
  const { data, error } = await supabase
    .from("metas_financeiras" as any)
    .select("mes,meta_mensal,meta_ticket_medio,dias_uteis")
    .order("mes", { ascending: false })
    .limit(200);
  if (error) return { meta_mensal: null, meta_ticket_medio: null, dias_uteis: null, encontrada: false };
  const row = ((data ?? []) as any[]).find((r) => String(r.mes ?? "").slice(0, 7) === mesRef);
  if (!row) return { meta_mensal: null, meta_ticket_medio: null, dias_uteis: null, encontrada: false };
  return {
    meta_mensal: row.meta_mensal != null ? Number(row.meta_mensal) : null,
    meta_ticket_medio: row.meta_ticket_medio != null ? Number(row.meta_ticket_medio) : null,
    dias_uteis: row.dias_uteis != null ? Number(row.dias_uteis) : null,
    encontrada: true,
  };
}

/** 1.5 — metas dos demais drivers. Tolerante a variações de nome de coluna. */
export async function fetchDrivers(ano: number, mes: number): Promise<Record<string, any> | null> {
  try {
    const { data, error } = await supabase
      .from("planejamento_drivers" as any)
      .select("*")
      .eq("ano", ano)
      .eq("mes", mes)
      .limit(1);
    if (error) return null;
    return ((data ?? []) as any[])[0] ?? null;
  } catch {
    return null;
  }
}

export function pickNum(row: Record<string, any> | null, chaves: string[]): number | null {
  if (!row) return null;
  for (const k of chaves) {
    const hit = Object.keys(row).find((c) => c.toLowerCase() === k.toLowerCase());
    if (hit && row[hit] != null && Number.isFinite(Number(row[hit]))) return Number(row[hit]);
  }
  for (const k of chaves) {
    const hit = Object.keys(row).find((c) => c.toLowerCase().includes(k.toLowerCase()));
    if (hit && row[hit] != null && Number.isFinite(Number(row[hit]))) return Number(row[hit]);
  }
  return null;
}

/* ------------------------------ métricas -------------------------------- */

export interface Resumo {
  receita_liquida: number;
  receita_bruta: number;
  desconto_total: number;
  desconto_medio_pct: number;
  pedidos: number;
  pedidos_captados: number;
  ticket_medio: number;
  receita_cancelada: number;
  clientes_unicos: number;
}

export function resumoPeriodo(pedidos: Pedido[], ini: string, fim: string): Resumo {
  const jan = pedidos.filter((p) => p.dia >= ini && p.dia <= fim);
  const ok = jan.filter((p) => !p.cancelado);
  const receita_liquida = ok.reduce((s, p) => s + p.receita_liquida, 0);
  const receita_bruta = ok.reduce((s, p) => s + p.receita_bruta, 0);
  const desconto_total = ok.reduce((s, p) => s + p.desconto, 0);
  return {
    receita_liquida,
    receita_bruta,
    desconto_total,
    desconto_medio_pct: receita_bruta > 0 ? (desconto_total / receita_bruta) * 100 : 0,
    pedidos: ok.length,
    pedidos_captados: jan.length,
    ticket_medio: ok.length ? receita_liquida / ok.length : 0,
    receita_cancelada: jan.filter((p) => p.cancelado).reduce((s, p) => s + p.receita_liquida, 0),
    clientes_unicos: new Set(ok.map((p) => p.customer_id).filter(Boolean)).size,
  };
}

export interface Aprovacao {
  taxa: number;            // regra oficial (cancelados reais)
  taxa_simples: number;    // regra ingênua, só para contraste
  cancelados: number;
  cancelados_reais: number;
  retrabalho: number;      // cancelados recomprados em até 7 dias
  receita_retrabalho: number;
}

/**
 * 1.6 — Aprovação por "cancelados reais": cancelamento não conta como perda se
 * o mesmo cliente tem outro pedido não-cancelado em ±7 dias.
 * `todos` precisa conter uma janela 7 dias maior que [ini, fim] nos dois lados.
 */
export function aprovacaoCanceladosReais(todos: Pedido[], ini: string, fim: string): Aprovacao {
  const jan = todos.filter((p) => p.dia >= ini && p.dia <= fim);
  const okPorCliente = new Map<string, string[]>();
  for (const p of todos) {
    if (p.cancelado || !p.customer_id) continue;
    const arr = okPorCliente.get(p.customer_id) ?? [];
    arr.push(p.dia);
    okPorCliente.set(p.customer_id, arr);
  }
  const cancelados = jan.filter((p) => p.cancelado);
  let reais = 0;
  let retrabalho = 0;
  let receita_retrabalho = 0;
  for (const c of cancelados) {
    const dias = c.customer_id ? okPorCliente.get(c.customer_id) ?? [] : [];
    const recomprou = dias.some((d) => Math.abs(diffDias(d, c.dia)) <= 7);
    if (recomprou) { retrabalho++; receita_retrabalho += c.receita_liquida; } else reais++;
  }
  const captados = jan.length;
  return {
    taxa: captados ? ((captados - reais) / captados) * 100 : 0,
    taxa_simples: captados ? ((captados - cancelados.length) / captados) * 100 : 0,
    cancelados: cancelados.length,
    cancelados_reais: reais,
    retrabalho,
    receita_retrabalho,
  };
}

export interface Funil {
  sessoes: number;
  sessoes_pagas: number;
  sessoes_organicas: number;
  carrinho: number;
  checkout: number;
  compras_ga4: number;
  dias_com_dado: string[];
}

export function funilSessoes(linhas: SessaoDia[], ini: string, fim: string): Funil {
  const jan = linhas.filter((l) => l.dia >= ini && l.dia <= fim);
  const pago = (c: string) => CANAIS_PAGOS.includes(c);
  return {
    sessoes: jan.reduce((s, l) => s + l.sessoes, 0),
    sessoes_pagas: jan.filter((l) => pago(l.canal)).reduce((s, l) => s + l.sessoes, 0),
    sessoes_organicas: jan.filter((l) => !pago(l.canal)).reduce((s, l) => s + l.sessoes, 0),
    carrinho: jan.reduce((s, l) => s + l.carrinho, 0),
    checkout: jan.reduce((s, l) => s + l.checkout, 0),
    compras_ga4: jan.reduce((s, l) => s + l.compras, 0),
    dias_com_dado: Array.from(new Set(jan.filter((l) => l.sessoes > 0).map((l) => l.dia))).sort(),
  };
}

export interface ResumoMidia {
  invest: number;
  cliques: number;
  receita_atribuida: number;
  cpc: number;
  cps: number;
  roas: number;
}

export function resumoMidia(linhas: MidiaDia[], ini: string, fim: string, sessoesPagas: number): ResumoMidia {
  const jan = linhas.filter((l) => l.dia >= ini && l.dia <= fim);
  const invest = jan.reduce((s, l) => s + l.spend, 0);
  const cliques = jan.reduce((s, l) => s + l.cliques, 0);
  const receita = jan.reduce((s, l) => s + l.receita_atribuida, 0);
  return {
    invest,
    cliques,
    receita_atribuida: receita,
    cpc: cliques ? invest / cliques : 0,
    cps: sessoesPagas ? invest / sessoesPagas : 0,
    roas: invest ? receita / invest : 0,
  };
}

/* --------------------------------- LMDI ---------------------------------- */

export interface ParcelaLMDI { driver: string; valor: number }
export interface ResultadoLMDI {
  parcelas: ParcelaLMDI[];
  gap: number;
  soma: number;
  valido: boolean;
  atual: Record<string, number>;
  anterior: Record<string, number>;
}

/**
 * Decomposição LMDI aditiva exata de Receita = Sessões × Conversão × Ticket × Aprovação.
 * L = (R1 - R0) / ln(R1/R0);  contribuição_i = L * ln(x_i1 / x_i0);  Σ = R1 - R0.
 */
export function lmdi(
  atual: { sessoes: number; conversao: number; ticket: number; aprovacao: number },
  anterior: { sessoes: number; conversao: number; ticket: number; aprovacao: number },
): ResultadoLMDI {
  const R1 = atual.sessoes * (atual.conversao / 100) * atual.ticket * (atual.aprovacao / 100);
  const R0 = anterior.sessoes * (anterior.conversao / 100) * anterior.ticket * (anterior.aprovacao / 100);
  const gap = R1 - R0;
  const chaves: Array<[string, keyof typeof atual]> = [
    ["Sessões", "sessoes"], ["Conversão", "conversao"], ["Ticket", "ticket"], ["Aprovação", "aprovacao"],
  ];
  const valido = R1 > 0 && R0 > 0 && chaves.every(([, k]) => atual[k] > 0 && anterior[k] > 0);
  if (!valido) {
    return {
      parcelas: chaves.map(([n]) => ({ driver: n, valor: 0 })),
      gap, soma: 0, valido: false, atual, anterior,
    };
  }
  const L = Math.abs(R1 - R0) < 1e-9 ? R1 : (R1 - R0) / Math.log(R1 / R0);
  const parcelas = chaves.map(([nome, k]) => ({ driver: nome, valor: L * Math.log(atual[k] / anterior[k]) }));
  const soma = parcelas.reduce((s, p) => s + p.valor, 0);
  // fecha resíduo numérico (< R$ 0,01) na maior parcela
  const resid = gap - soma;
  if (Math.abs(resid) > 1e-9 && parcelas.length) {
    const idx = parcelas.reduce((bi, p, i, a) => (Math.abs(p.valor) > Math.abs(a[bi].valor) ? i : bi), 0);
    parcelas[idx].valor += resid;
  }
  return { parcelas, gap, soma: parcelas.reduce((s, p) => s + p.valor, 0), valido: true, atual, anterior };
}

/** Frase automática abaixo do waterfall. */
export function fraseWaterfall(r: ResultadoLMDI): string {
  if (!r.valido) return "Sem dados suficientes nos dois períodos para decompor a variação.";
  const neg = r.parcelas.filter((p) => p.valor < 0).sort((a, b) => a.valor - b.valor);
  const pos = r.parcelas.filter((p) => p.valor >= 0).sort((a, b) => b.valor - a.valor);
  const nome = (d: string) => (d === "Ticket" ? "Ticket médio" : d);
  const partes: string[] = [];
  if (neg.length) {
    partes.push(
      neg.length === 1
        ? `${nome(neg[0].driver)} derrubou ${fmtBRL(Math.abs(neg[0].valor))}.`
        : `${nome(neg[0].driver)} derrubou ${fmtBRL(Math.abs(neg[0].valor))} e ${nome(neg[1].driver).toLowerCase()} ${fmtBRL(Math.abs(neg[1].valor))}.`,
    );
  }
  if (pos.length) {
    const soma = pos.reduce((s, p) => s + p.valor, 0);
    partes.push(
      pos.length === 1
        ? `${nome(pos[0].driver)} compensou ${fmtBRL(soma)}.`
        : `${pos.map((p) => nome(p.driver)).join(" e ")} compensaram ${fmtBRL(soma)}.`,
    );
  }
  partes.push(`Saldo: ${r.gap < 0 ? "−" : "+"}${fmtBRL(Math.abs(r.gap))}.`);
  return partes.join(" ");
}
