import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarIcon, Loader2, Maximize2, RefreshCw, Sparkles, Target,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { callClaude } from "@/lib/claudeApi";
import {
  aprovacaoCanceladosReais, ddmm, ddmmyyyy, diasUteis, diffDias, fetchDrivers, fetchGa4,
  fetchItens, fetchMetaOficial, fetchMidia, fetchPedidos, fetchWindsor, fmtBRL, fmtNum, fmtPct, funilSessoes,
  isoDia, listaDias, lmdi, pickNum, resumoMidia, resumoPeriodo, somaDias,
} from "@/lib/dashComercial";
import { SeloAviso, SkeletonBloco, SkeletonCard, Tile, variacaoPct } from "@/components/dash-comercial/ui";
import { Waterfall } from "@/components/dash-comercial/Waterfall";
import { DriverLinha, PlacarDrivers } from "@/components/dash-comercial/Drivers";
import { DadosDetalhe, DetalheDriver } from "@/components/dash-comercial/Detalhes";
import { Alerta, BarraAlertas } from "@/components/dash-comercial/Alertas";
import {
  CanaisEProdutos, LinhaFonte, MixClientes, RitmoDiario, SaudeFontes,
} from "@/components/dash-comercial/Blocos";
import { SessoesDetalhe } from "@/components/dash-comercial/SessoesDetalhe";
import {
  fetchSessoesComparativo, integridadePeriodo, rotuloFontes, serieComposta,
} from "@/lib/sessoesComposta";


type Preset = "hoje" | "semana" | "mes" | "mes-anterior" | "personalizado";
type ModoComp = "anterior" | "mes-passado";

const HOJE = isoDia(new Date());

function inicioSemana(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = (dt.getDay() + 6) % 7; // segunda = 0
  return somaDias(iso, -wd);
}
const inicioMes = (iso: string) => `${iso.slice(0, 7)}-01`;
function fimMes(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return isoDia(new Date(y, m, 0));
}
function mesAnteriorIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 2, 1);
  const ultimo = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  return isoDia(new Date(dt.getFullYear(), dt.getMonth(), Math.min(d, ultimo)));
}
const dataDeIso = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };

export default function DashboardComercialPage() {
  const [preset, setPreset] = useState<Preset>("mes");
  const [custom, setCustom] = useState<{ from?: Date; to?: Date }>({});
  const [modoComp, setModoComp] = useState<ModoComp>("anterior");
  const [drawer, setDrawer] = useState<string | null>(null);
  const [lancamento, setLancamento] = useState<DriverLinha | null>(null);
  const [ia, setIa] = useState("");
  const [loadingIa, setLoadingIa] = useState(false);

  /* ------------------------------ período ------------------------------- */
  const { ini, fim, rotulo } = useMemo(() => {
    if (preset === "hoje") return { ini: HOJE, fim: HOJE, rotulo: "Hoje" };
    if (preset === "semana") {
      const i = inicioSemana(HOJE);
      return { ini: i, fim: HOJE, rotulo: "Esta semana" };
    }
    if (preset === "mes") return { ini: inicioMes(HOJE), fim: HOJE, rotulo: "Este mês" };
    if (preset === "mes-anterior") {
      const ref = mesAnteriorIso(HOJE);
      return { ini: inicioMes(ref), fim: fimMes(ref), rotulo: "Mês anterior" };
    }
    const i = custom.from ? isoDia(custom.from) : inicioMes(HOJE);
    const f = custom.to ? isoDia(custom.to) : HOJE;
    return { ini: i, fim: f, rotulo: `${ddmmyyyy(i)} – ${ddmmyyyy(f)}` };
  }, [preset, custom]);

  const { compIni, compFim } = useMemo(() => {
    if (modoComp === "mes-passado") return { compIni: mesAnteriorIso(ini), compFim: mesAnteriorIso(fim) };
    const dur = diffDias(fim, ini) + 1;
    const cf = somaDias(ini, -1);
    return { compIni: somaDias(cf, -(dur - 1)), compFim: cf };
  }, [ini, fim, modoComp]);

  const rotuloComp = `vs ${ddmm(compIni)}–${ddmm(compFim)} (${modoComp === "anterior" ? `${diffDias(fim, ini) + 1} dias anteriores` : "mesmo período do mês passado"})`;

  const mesRef = fim.slice(0, 7);
  const mesIni = `${mesRef}-01`;
  const mesFim = fimMes(fim);
  const janIni = [compIni, mesIni, ini].sort()[0];
  const fetchIni = somaDias(janIni, -35);
  const fetchFim = [fim, HOJE].sort().slice(-1)[0];

  /* ------------------------------ queries ------------------------------- */
  const qPedidos = useQuery({
    queryKey: ["dc2-pedidos", fetchIni, fetchFim],
    queryFn: () => fetchPedidos(fetchIni, fetchFim),
    staleTime: 5 * 60_000,
  });
  const qGa4 = useQuery({
    queryKey: ["dc2-ga4", fetchIni, fetchFim],
    queryFn: () => fetchGa4(fetchIni, fetchFim),
    staleTime: 5 * 60_000,
  });
  const qWindsor = useQuery({
    queryKey: ["dc2-windsor", fetchIni, fetchFim],
    queryFn: () => fetchWindsor(fetchIni, fetchFim),
    staleTime: 5 * 60_000,
  });
  const qMidia = useQuery({
    queryKey: ["dc2-midia", fetchIni, fetchFim],
    queryFn: () => fetchMidia(fetchIni, fetchFim),
    staleTime: 5 * 60_000,
  });
  const qMeta = useQuery({ queryKey: ["dc2-meta", mesRef], queryFn: () => fetchMetaOficial(mesRef), staleTime: 10 * 60_000 });
  const qDrivers = useQuery({
    queryKey: ["dc2-drivers", mesRef],
    queryFn: () => fetchDrivers(Number(mesRef.slice(0, 4)), Number(mesRef.slice(5, 7))),
    staleTime: 10 * 60_000,
  });
  const qFontesVazias = useQuery({
    queryKey: ["dc2-fontes-vazias", mesRef],
    queryFn: async () => {
      const g = await supabase.from("google_ads_diario" as any).select("data").limit(1);
      const i = await supabase.from("investimentos_midia" as any).select("mes_referencia").eq("mes_referencia", mesRef).limit(1);
      return { googleAds: (g.data ?? []).length > 0, investMes: (i.data ?? []).length > 0 };
    },
    staleTime: 10 * 60_000,
  });

  const pedidos = qPedidos.data ?? [];
  const ga4 = qGa4.data ?? [];
  const windsor = qWindsor.data ?? [];
  const midia = qMidia.data ?? [];
  const carregando = qPedidos.isLoading || qGa4.isLoading || qMidia.isLoading;

  const qItens = useQuery({
    queryKey: ["dc2-itens", compIni, fim, pedidos.length],
    enabled: pedidos.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () =>
      fetchItens(pedidos.filter((p) => !p.cancelado && p.dia >= compIni && p.dia <= fim).map((p) => p.id)),
  });
  const itens = qItens.data ?? [];

  /* ---------------------- 1.3 GA4 x fallback Windsor -------------------- */
  const ga4UltimoDia = useMemo(() => ga4.map((g) => g.dia).sort().slice(-1)[0] ?? null, [ga4]);
  const ga4Atrasado = !ga4UltimoDia || diffDias(HOJE, ga4UltimoDia) > 1;
  const sessoesFonte = ga4Atrasado && windsor.length ? windsor : ga4;
  const nomeFonteSessoes = sessoesFonte === ga4 ? "GA4" : "Windsor (GA4 atrasado)";

  /* ------------------------------ métricas ------------------------------ */
  const resumo = useMemo(() => resumoPeriodo(pedidos, ini, fim), [pedidos, ini, fim]);
  const resumoComp = useMemo(() => resumoPeriodo(pedidos, compIni, compFim), [pedidos, compIni, compFim]);
  const aprov = useMemo(() => aprovacaoCanceladosReais(pedidos, ini, fim), [pedidos, ini, fim]);
  const aprovComp = useMemo(() => aprovacaoCanceladosReais(pedidos, compIni, compFim), [pedidos, compIni, compFim]);
  const aprovMes = useMemo(() => aprovacaoCanceladosReais(pedidos, mesIni, mesFim), [pedidos, mesIni, mesFim]);
  const funil = useMemo(() => funilSessoes(sessoesFonte, ini, fim), [sessoesFonte, ini, fim]);
  const funilComp = useMemo(() => funilSessoes(sessoesFonte, compIni, compFim), [sessoesFonte, compIni, compFim]);
  const mid = useMemo(() => resumoMidia(midia, ini, fim, funil.sessoes_pagas), [midia, ini, fim, funil.sessoes_pagas]);

  const mtd = useMemo(() => resumoPeriodo(pedidos, mesIni, [fim, HOJE].sort()[0]), [pedidos, mesIni, fim]);
  const meta = qMeta.data;
  const pctMeta = meta?.meta_mensal ? (mtd.receita_liquida / meta.meta_mensal) * 100 : null;
  const faltante = meta?.meta_mensal ? Math.max(meta.meta_mensal - mtd.receita_liquida, 0) : null;
  const uteisRestantes = Math.max(diasUteis([HOJE, mesIni].sort().slice(-1)[0], mesFim), 1);
  const metaDiaria = faltante !== null ? faltante / uteisRestantes : null;

  /* ------------------- Seção 3 — LMDI com janela ajustada ---------------- */
  const { resultado, avisoJanela } = useMemo(() => {
    const diasA = listaDias(ini, fim).filter((d) => funilDia(sessoesFonte, d) > 0);
    const diasB = listaDias(compIni, compFim).filter((d) => funilDia(sessoesFonte, d) > 0);
    const n = Math.min(diasA.length, diasB.length);
    const setA = diasA.slice(0, n);
    const setB = diasB.slice(0, n);
    const totalDias = diffDias(fim, ini) + 1;
    const faltando = listaDias(ini, fim).filter((d) => !setA.includes(d));
    const aviso =
      n === 0 ? "Sem dados de sessão nos dois períodos"
      : n < totalDias ? `Janela ajustada para ${n} dias — ${nomeFonteSessoes.startsWith("GA4") ? "GA4" : "Windsor"} sem ${faltando.map(ddmm).join(", ")}`
      : null;

    const agregar = (dias: string[]) => {
      const sessoes = sessoesFonte.filter((s) => dias.includes(s.dia)).reduce((s, l) => s + l.sessoes, 0);
      const jan = pedidos.filter((p) => dias.includes(p.dia));
      const ok = jan.filter((p) => !p.cancelado);
      const receita = ok.reduce((s, p) => s + p.receita_liquida, 0);
      return {
        sessoes,
        conversao: sessoes ? (jan.length / sessoes) * 100 : 0,
        ticket: ok.length ? receita / ok.length : 0,
        aprovacao: jan.length ? (ok.length / jan.length) * 100 : 0,
      };
    };
    return { resultado: lmdi(agregar(setA), agregar(setB)), avisoJanela: aviso };
  }, [pedidos, sessoesFonte, ini, fim, compIni, compFim, nomeFonteSessoes]);

  /* ------------------------- Seção 4 — 9 drivers ------------------------- */
  const drvRow = qDrivers.data;
  const clientesMes = useMemo(() => {
    const ok = pedidos.filter((p) => !p.cancelado && p.dia >= mesIni && p.dia <= mesFim && p.customer_id);
    const anteriores = new Set(
      pedidos.filter((p) => !p.cancelado && p.dia < mesIni && p.customer_id).map((p) => p.customer_id as string),
    );
    const unicos = new Set(ok.map((p) => p.customer_id as string));
    let novos = 0;
    unicos.forEach((c) => { if (!anteriores.has(c)) novos++; });
    return { unicos: unicos.size, novos, recorrentes: unicos.size - novos, pedidos: ok.length };
  }, [pedidos, mesIni, mesFim]);

  const ticketConflito = pickNum(drvRow, ["ticket_medio", "ticket"]);
  const investVipLancado = qFontesVazias.data?.investMes ?? false;

  const drivers: DriverLinha[] = useMemo(() => {
    const conversao = funil.sessoes ? (resumo.pedidos_captados / funil.sessoes) * 100 : null;
    const retencao = clientesMes.unicos ? (clientesMes.recorrentes / clientesMes.unicos) * 100 : null;
    const metaConv = pickNum(drvRow, ["taxa_conversao", "conversao"]);
    const metaApr = pickNum(drvRow, ["taxa_aprovacao", "aprovacao"]);
    const metaRet = pickNum(drvRow, ["taxa_retencao", "retencao"]);
    const metaSessOrg = pickNum(drvRow, ["sessoes_organicas", "organicas"]);
    const metaMidia = pickNum(drvRow, ["investimento_midia", "invest_midia", "midia"]);
    const metaVip = pickNum(drvRow, ["vip"]);
    const metaImprensa = pickNum(drvRow, ["imprensa", "pr_"]);
    const metaCps = pickNum(drvRow, ["cps_midia", "cps"]);
    const metaTicket = meta?.meta_ticket_medio ?? null;

    const impTicket = metaTicket ? (resumo.ticket_medio - metaTicket) * resumo.pedidos : null;
    const impApr = metaApr ? ((aprov.taxa - metaApr) / 100) * resumo.pedidos_captados * resumo.ticket_medio : null;
    const impConv = metaConv && conversao !== null
      ? ((conversao - metaConv) / 100) * funil.sessoes * resumo.ticket_medio * (aprov.taxa / 100) : null;
    const impSess = metaSessOrg && conversao !== null
      ? (funil.sessoes_organicas - metaSessOrg) * (conversao / 100) * resumo.ticket_medio * (aprov.taxa / 100) : null;
    const impRet = metaRet && retencao !== null
      ? ((retencao - metaRet) / 100) * clientesMes.unicos * resumo.ticket_medio : null;
    const impMidia = metaMidia ? (mid.invest - metaMidia) * (mid.roas || 1) : null;
    const impCps = metaCps && funil.sessoes_pagas ? (metaCps - mid.cps) * funil.sessoes_pagas : null;

    return [
      { id: "retencao", nome: "Retenção", unidade: "pct", meta: metaRet, realizado: retencao, impacto: impRet, nota: "% dos clientes únicos do mês" },
      { id: "aprovacao", nome: "Aprovação", unidade: "pct", meta: metaApr, realizado: aprov.taxa, impacto: impApr, nota: "regra cancelados reais (±7 dias)" },
      {
        id: "ticket", nome: "Ticket médio", unidade: "brl", meta: metaTicket, realizado: resumo.ticket_medio, impacto: impTicket,
        nota: ticketConflito && metaTicket && Math.abs(ticketConflito - metaTicket) > 0.01
          ? `⚠︎ planejamento_drivers diverge — ${fmtBRL(ticketConflito)} (vale metas_financeiras)` : "meta oficial: metas_financeiras",
      },
      { id: "conversao", nome: "Taxa de conversão", unidade: "pct", meta: metaConv, realizado: conversao, impacto: impConv, nota: "pedidos captados ÷ sessões" },
      { id: "midia", nome: "Invest. mídia", unidade: "brl", meta: metaMidia, realizado: mid.invest, impacto: impMidia, nota: "parcial: só Meta Ads" },
      { id: "vip", nome: "Invest. VIP", unidade: "brl", meta: metaVip, realizado: investVipLancado ? 0 : null, impacto: null, semDado: !investVipLancado },
      { id: "imprensa", nome: "Invest. imprensa", unidade: "brl", meta: metaImprensa, realizado: investVipLancado ? 0 : null, impacto: null, semDado: !investVipLancado },
      { id: "sessoes", nome: "Sessões orgânicas", unidade: "num", meta: metaSessOrg, realizado: funil.sessoes_organicas, impacto: impSess },
      { id: "cps", nome: "CPS de mídia", unidade: "brl", meta: metaCps, realizado: mid.cps, inverso: true, impacto: impCps, nota: "invest. mídia ÷ sessões pagas" },
    ];
  }, [drvRow, meta, funil, resumo, aprov, mid, clientesMes, ticketConflito, investVipLancado]);

  /* ---------------------------- drawers/detalhe -------------------------- */
  const dadosDetalhe: DadosDetalhe = useMemo(() => {
    const porPedido = new Map(pedidos.map((p) => [p.id, p]));
    const agItens = (di: string, df: string) => {
      let qtd = 0, receita = 0;
      const ids = new Set(pedidos.filter((p) => !p.cancelado && p.dia >= di && p.dia <= df).map((p) => p.id));
      for (const it of itens) {
        if (!ids.has(it.order_id)) continue;
        qtd += it.quantidade;
        receita += it.quantidade * it.preco;
      }
      const r = resumoPeriodo(pedidos, di, df);
      return {
        itens_por_pedido: r.pedidos ? qtd / r.pedidos : 0,
        preco_medio_item: qtd ? receita / qtd : 0,
        ticket: r.ticket_medio,
        pedidos: r.pedidos,
      };
    };

    const meios = new Map<string, { rec_atual: number; rec_comp: number; qtd_atual: number; qtd_comp: number }>();
    for (const p of pedidos) {
      if (!p.cancelado) continue;
      const dentro = p.dia >= ini && p.dia <= fim;
      const antes = p.dia >= compIni && p.dia <= compFim;
      if (!dentro && !antes) continue;
      const k = p.payment_method || "(sem meio de pagamento)";
      const cur = meios.get(k) ?? { rec_atual: 0, rec_comp: 0, qtd_atual: 0, qtd_comp: 0 };
      if (dentro) { cur.rec_atual += p.receita_liquida; cur.qtd_atual++; }
      if (antes) { cur.rec_comp += p.receita_liquida; cur.qtd_comp++; }
      meios.set(k, cur);
    }

    const canais = new Map<string, { atual: number; comp: number }>();
    for (const s of sessoesFonte) {
      const dentro = s.dia >= ini && s.dia <= fim;
      const antes = s.dia >= compIni && s.dia <= compFim;
      if (!dentro && !antes) continue;
      const cur = canais.get(s.canal) ?? { atual: 0, comp: 0 };
      if (dentro) cur.atual += s.sessoes;
      if (antes) cur.comp += s.sessoes;
      canais.set(s.canal, cur);
    }

    const camp = new Map<string, { spend: number; cliques: number; receita: number }>();
    for (const m of midia.filter((m) => m.dia >= ini && m.dia <= fim)) {
      const cur = camp.get(m.campanha) ?? { spend: 0, cliques: 0, receita: 0 };
      cur.spend += m.spend; cur.cliques += m.cliques; cur.receita += m.receita_atribuida;
      camp.set(m.campanha, cur);
    }

    return {
      ticket: { atual: agItens(ini, fim), comp: agItens(compIni, compFim) },
      aprovacao: Array.from(meios.entries()).map(([meio, v]) => ({ meio, ...v })),
      conversao: {
        atual: { sessoes: funil.sessoes, carrinho: funil.carrinho, checkout: funil.checkout, compras: funil.compras_ga4 },
        comp: { sessoes: funilComp.sessoes, carrinho: funilComp.carrinho, checkout: funilComp.checkout, compras: funilComp.compras_ga4 },
      },
      sessoes: Array.from(canais.entries()).map(([canal, v]) => ({ canal, ...v })),
      midia: Array.from(camp.entries()).map(([campanha, v]) => ({
        campanha, spend: v.spend, cliques: v.cliques,
        cpc: v.cliques ? v.spend / v.cliques : 0, roas: v.spend ? v.receita / v.spend : 0,
      })),
    };
  }, [pedidos, itens, sessoesFonte, midia, funil, funilComp, ini, fim, compIni, compFim]);

  /* ------------------------- Seção 5 — ritmo diário ---------------------- */
  const ritmo = useMemo(
    () => listaDias(ini, fim).map((d) => {
      const jan = pedidos.filter((p) => p.dia === d && !p.cancelado);
      return {
        dia: d,
        receita: jan.reduce((s, p) => s + p.receita_liquida, 0),
        meta_diaria: metaDiaria ?? 0,
        spend: midia.filter((m) => m.dia === d).reduce((s, m) => s + m.spend, 0),
        pedidos: jan.length,
      };
    }),
    [pedidos, midia, ini, fim, metaDiaria],
  );

  /* ------------------------------ Seção 6 -------------------------------- */
  const mix = useMemo(() => {
    const ok = pedidos.filter((p) => !p.cancelado && p.dia >= ini && p.dia <= fim);
    const okComp = pedidos.filter((p) => !p.cancelado && p.dia >= compIni && p.dia <= compFim);
    const origens = new Map<string, { receita: number; pedidos: number; receita_comp: number }>();
    for (const p of ok) {
      const k = p.point_sale || "(não informado)";
      const c = origens.get(k) ?? { receita: 0, pedidos: 0, receita_comp: 0 };
      c.receita += p.receita_liquida; c.pedidos++; origens.set(k, c);
    }
    for (const p of okComp) {
      const k = p.point_sale || "(não informado)";
      const c = origens.get(k) ?? { receita: 0, pedidos: 0, receita_comp: 0 };
      c.receita_comp += p.receita_liquida; origens.set(k, c);
    }
    return {
      clientes_unicos: clientesMes.unicos,
      novos: clientesMes.novos,
      recorrentes: clientesMes.recorrentes,
      taxa_recorrencia: clientesMes.unicos ? (clientesMes.recorrentes / clientesMes.unicos) * 100 : 0,
      taxa_aquisicao_cliente: clientesMes.unicos ? (clientesMes.novos / clientesMes.unicos) * 100 : 0,
      taxa_aquisicao_pedido: clientesMes.pedidos ? (clientesMes.novos / clientesMes.pedidos) * 100 : 0,
      cac_novos: clientesMes.novos ? mid.invest / clientesMes.novos : null,
      origens: Array.from(origens.entries())
        .map(([origem, v]) => ({ origem, ...v }))
        .sort((a, b) => b.receita - a.receita),
    };
  }, [pedidos, clientesMes, mid.invest, ini, fim, compIni, compFim]);

  /* ------------------------------ Seção 7 -------------------------------- */
  const canaisTabela = useMemo(() => {
    const m = new Map<string, { sessoes: number; receita: number; compras: number }>();
    for (const s of sessoesFonte.filter((s) => s.dia >= ini && s.dia <= fim)) {
      const c = m.get(s.canal) ?? { sessoes: 0, receita: 0, compras: 0 };
      c.sessoes += s.sessoes; c.receita += s.receita; c.compras += s.compras;
      m.set(s.canal, c);
    }
    return Array.from(m.entries()).map(([canal, v]) => ({ canal, ...v })).sort((a, b) => b.sessoes - a.sessoes);
  }, [sessoesFonte, ini, fim]);

  const topProdutos = useMemo(() => {
    const idsAtual = new Set(pedidos.filter((p) => !p.cancelado && p.dia >= ini && p.dia <= fim).map((p) => p.id));
    const idsComp = new Set(pedidos.filter((p) => !p.cancelado && p.dia >= compIni && p.dia <= compFim).map((p) => p.id));
    const m = new Map<string, { nome: string; receita: number; unidades: number; receita_comp: number }>();
    for (const it of itens) {
      const key = it.product_id ?? it.nome;
      const c = m.get(key) ?? { nome: it.nome, receita: 0, unidades: 0, receita_comp: 0 };
      const total = it.preco * it.quantidade;
      if (idsAtual.has(it.order_id)) { c.receita += total; c.unidades += it.quantidade; }
      else if (idsComp.has(it.order_id)) c.receita_comp += total;
      m.set(key, c);
    }
    return Array.from(m.entries())
      .map(([product_id, v]) => ({ product_id, ...v }))
      .filter((p) => p.receita > 0)
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 10);
  }, [itens, pedidos, ini, fim, compIni, compFim]);

  /* ------------------------- Parte 4 — alertas --------------------------- */
  const alertas: Alerta[] = useMemo(() => {
    const out: Alerta[] = [];
    const dias = listaDias(ini, fim);
    const mediaPedidos = dias.length
      ? dias.reduce((s, d) => s + pedidos.filter((p) => p.dia === d && !p.cancelado).length, 0) / dias.length : 0;
    const ticket = resumo.ticket_medio;

    // mídia zerada
    const zerados = ritmo.filter((r) => r.spend === 0 && r.pedidos < mediaPedidos);
    if (zerados.length) {
      out.push({
        id: "midia-zerada", severidade: "critico", titulo: "Mídia zerada",
        detalhe: `${zerados.map((z) => ddmm(z.dia)).join(", ")} sem investimento e com pedidos abaixo da média (${fmtNum(mediaPedidos, 1)}/dia)`,
        impacto: -zerados.reduce((s, z) => s + (mediaPedidos - z.pedidos) * ticket, 0),
        ancora: "ritmo",
      });
    }

    // anomalia de rastreamento
    const unassignedDias = sessoesFonte.filter((s) => /unassigned|não atribu|nao atribu/i.test(s.canal));
    const media14 = (() => {
      const janela = listaDias(somaDias(ini, -14), somaDias(ini, -1));
      const tot = unassignedDias.filter((s) => janela.includes(s.dia)).reduce((s, l) => s + l.sessoes, 0);
      return tot / 14;
    })();
    const unassignedPeriodo = unassignedDias.filter((s) => s.dia >= ini && s.dia <= fim);
    const somaUn = unassignedPeriodo.reduce((s, l) => s + l.sessoes, 0);
    const picos = unassignedPeriodo.filter((s) => media14 > 0 && s.sessoes > media14 * 3);
    if (picos.length) {
      out.push({
        id: "rastreamento", severidade: "critico", titulo: "Anomalia de rastreamento",
        detalhe: `${fmtNum(somaUn)} sessões Unassigned em ${picos.map((p) => ddmm(p.dia)).join(", ")} · conversão reportada inflada`,
        impacto: null, ancora: "canais",
      });
    }

    // Pix parado
    const pixCanc = (di: string, df: string) => pedidos
      .filter((p) => p.cancelado && /pix/i.test(p.payment_method) && p.dia >= di && p.dia <= df)
      .reduce((s, p) => s + p.receita_liquida, 0);
    const pixAtual = pixCanc(ini, fim);
    const media4sem = pixCanc(somaDias(ini, -28), somaDias(ini, -1)) / 4 * ((diffDias(fim, ini) + 1) / 7);
    if (media4sem > 0 && pixAtual > media4sem * 1.5) {
      out.push({
        id: "pix", severidade: "atencao", titulo: "Pix parado",
        detalhe: `Receita de Pix cancelado ${fmtBRL(pixAtual)} contra média de ${fmtBRL(media4sem)} nas últimas 4 semanas`,
        impacto: -(pixAtual - media4sem), ancora: "drivers",
      });
    }

    // checkout quebrado
    const semMeio = pedidos.filter((p) => p.dia >= ini && p.dia <= fim && !p.payment_method);
    if (resumo.pedidos_captados && semMeio.length / resumo.pedidos_captados > 0.05) {
      const canceladosSemMeio = semMeio.filter((p) => p.cancelado);
      out.push({
        id: "checkout", severidade: "critico", titulo: "Checkout quebrado",
        detalhe: `${semMeio.length} pedidos sem meio de pagamento (${fmtPct((semMeio.length / resumo.pedidos_captados) * 100, 1)} dos captados) · ${canceladosSemMeio.length} cancelados`,
        impacto: -semMeio.reduce((s, p) => s + p.receita_liquida, 0), ancora: "drivers",
      });
    }

    // fonte defasada
    const atrasos: string[] = [];
    if (ga4Atrasado) atrasos.push("GA4");
    const midiaUlt = midia.map((m) => m.dia).sort().slice(-1)[0];
    if (!midiaUlt || diffDias(HOJE, midiaUlt) > 1) atrasos.push("Meta Ads");
    const trayUlt = pedidos.map((p) => p.dia).sort().slice(-1)[0];
    if (!trayUlt || diffDias(HOJE, trayUlt) > 1) atrasos.push("Tray");
    if (atrasos.length) {
      out.push({
        id: "fonte", severidade: "atencao", titulo: "Fonte defasada",
        detalhe: `${atrasos.join(", ")} sem sincronização há mais de 24 h`, impacto: null, ancora: "fontes",
      });
    }

    // cross-sell caindo
    const itensPed = dadosDetalhe.ticket.atual.itens_por_pedido;
    const itensComp = dadosDetalhe.ticket.comp.itens_por_pedido;
    if (itensComp > 0 && itensPed < itensComp * 0.9) {
      out.push({
        id: "crosssell", severidade: "atencao", titulo: "Cross-sell caindo",
        detalhe: `${fmtNum(itensPed, 2)} itens por pedido contra ${fmtNum(itensComp, 2)} no comparativo`,
        impacto: -(itensComp - itensPed) * dadosDetalhe.ticket.atual.preco_medio_item * resumo.pedidos,
        ancora: "drivers",
      });
    }

    const ordem = { critico: 0, atencao: 1 } as const;
    return out.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
  }, [pedidos, ritmo, sessoesFonte, midia, resumo, dadosDetalhe, ini, fim, ga4Atrasado]);

  /* ------------------------ Parte 5 — saúde fontes ----------------------- */
  const fontes: LinhaFonte[] = useMemo(() => {
    const cobertura = (dias: string[]) => {
      const total = diffDias(fim, ini) + 1;
      const cobertos = new Set(dias.filter((d) => d >= ini && d <= fim)).size;
      return `${cobertos}/${total} dias`;
    };
    const ultima = (dias: string[]) => dias.sort().slice(-1)[0] ?? null;
    const diasPedidos = pedidos.map((p) => p.dia);
    const diasGa4 = ga4.filter((g) => g.sessoes > 0).map((g) => g.dia);
    const diasMidia = midia.map((m) => m.dia);
    const diasWindsor = windsor.map((w) => w.dia);
    const totalDias = diffDias(fim, ini) + 1;
    const coberturaGa4 = new Set(diasGa4.filter((d) => d >= ini && d <= fim)).size;
    return [
      { fonte: "tray_direto.tray_orders", ultima_carga: ultima([...diasPedidos]), status: "ok", cobertura: cobertura([...diasPedidos]) },
      {
        fonte: "ga4_aquisicao_canais", ultima_carga: ultima([...diasGa4]),
        status: coberturaGa4 >= totalDias ? "ok" : "atencao", cobertura: cobertura([...diasGa4]),
        nota: "fonte oficial de sessões e funil",
      },
      { fonte: "meta_ads_campanhas", ultima_carga: ultima([...diasMidia]), status: diasMidia.length ? "ok" : "vazia", cobertura: cobertura([...diasMidia]) },
      { fonte: "windsor_canais", ultima_carga: ultima([...diasWindsor]), status: "ok", cobertura: "fallback", nota: "usado só com GA4 atrasado > 24 h" },
      { fonte: "google_ads_diario", ultima_carga: null, status: qFontesVazias.data?.googleAds ? "ok" : "vazia", cobertura: qFontesVazias.data?.googleAds ? "—" : "vazia", nota: "CAC e ROAS globais subestimados" },
      { fonte: "investimentos_midia", ultima_carga: null, status: investVipLancado ? "ok" : "vazia", cobertura: investVipLancado ? "mês lançado" : "vazia", nota: "sem lançamento de VIP e imprensa" },
      { fonte: "kondado.*", ultima_carga: "09/08/2026", status: "descontinuada", cobertura: "ETL morto", nota: "proibido usar — qualquer view apontando para lá está congelada" },
    ];
  }, [pedidos, ga4, midia, windsor, ini, fim, qFontesVazias.data, investVipLancado]);

  /* --------------------------- sparklines 14d ---------------------------- */
  const spark = (fn: (dia: string) => number) =>
    listaDias(somaDias(fim, -13), fim).map((d) => ({ v: fn(d) }));
  const sparkReceita = useMemo(
    () => spark((d) => pedidos.filter((p) => p.dia === d && !p.cancelado).reduce((s, p) => s + p.receita_liquida, 0)),
    [pedidos, fim],
  );
  const sparkPedidos = useMemo(
    () => spark((d) => pedidos.filter((p) => p.dia === d && !p.cancelado).length), [pedidos, fim],
  );
  const sparkTicket = useMemo(() => spark((d) => {
    const j = pedidos.filter((p) => p.dia === d && !p.cancelado);
    return j.length ? j.reduce((s, p) => s + p.receita_liquida, 0) / j.length : 0;
  }), [pedidos, fim]);
  const sparkAprov = useMemo(() => spark((d) => {
    const j = pedidos.filter((p) => p.dia === d);
    return j.length ? (j.filter((p) => !p.cancelado).length / j.length) * 100 : 0;
  }), [pedidos, fim]);

  /* ------------- cards Sessões e Conversão (mesma base da LMDI) ---------- */
  const anomaliaRastreamento = useMemo(() => alertas.some((a) => a.id === "rastreamento"), [alertas]);

  const ultimoDiaComSessao = useMemo(() => {
    const dias = listaDias(ini, fim).filter((d) => funilDia(sessoesFonte, d) > 0);
    return dias.slice(-1)[0] ?? null;
  }, [sessoesFonte, ini, fim]);

  const conversaoPeriodo = funil.sessoes ? (resumo.pedidos_captados / funil.sessoes) * 100 : 0;
  const conversaoComp = funilComp.sessoes ? (resumoComp.pedidos_captados / funilComp.sessoes) * 100 : 0;
  const deltaConversaoPP = conversaoPeriodo - conversaoComp;

  /** Últimos 14 dias, ignorando dias sem sessão registrada (lag do GA4). */
  const diasSpark = useMemo(
    () => listaDias(somaDias(fim, -13), fim).filter((d) => funilDia(sessoesFonte, d) > 0),
    [sessoesFonte, fim],
  );
  const sparkSessoes = useMemo(
    () => diasSpark.map((d) => ({ v: funilDia(sessoesFonte, d) })), [diasSpark, sessoesFonte],
  );
  const sparkConversao = useMemo(
    () => diasSpark.map((d) => {
      const s = funilDia(sessoesFonte, d);
      return { v: s ? (pedidos.filter((p) => p.dia === d).length / s) * 100 : 0 };
    }),
    [diasSpark, sessoesFonte, pedidos],
  );

  const fonteEmFallback = sessoesFonte !== ga4 || ga4Atrasado;
  const subFonteSessoes = (
    <span className={cn("inline-flex items-center gap-1", fonteEmFallback && "text-warn")}>
      Fonte: {nomeFonteSessoes === "GA4" ? "GA4" : "Windsor — GA4 atrasado"}
      {ultimoDiaComSessao && ultimoDiaComSessao < fim && <> · até {ddmm(ultimoDiaComSessao)}</>}
    </span>
  );
  const seloAnomalia = anomaliaRastreamento ? (
    <TooltipProvider delayDuration={100}>
      <UITooltip>
        <TooltipTrigger asChild>
          <span className="text-warn" aria-label="Anomalia de rastreamento">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">
          Sessões infladas por anomalia de rastreamento — a conversão real é MAIOR que a exibida e as sessões reais são menores
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  ) : undefined;


  /* ------------------------------- IA ------------------------------------ */
  async function gerarInsights() {
    setLoadingIa(true);
    try {
      const txt = await callClaude(
        `Você é analista de e-commerce de moda feminina. Explique em até 6 bullets, em português do Brasil, por que a receita variou e o que fazer nesta semana.
Período ${ddmmyyyy(ini)}–${ddmmyyyy(fim)} · comparativo ${ddmmyyyy(compIni)}–${ddmmyyyy(compFim)}.
Receita líquida ${fmtBRL(resumo.receita_liquida)} (comp ${fmtBRL(resumoComp.receita_liquida)}), pedidos ${resumo.pedidos} (comp ${resumoComp.pedidos}), ticket ${fmtBRL(resumo.ticket_medio)} (comp ${fmtBRL(resumoComp.ticket_medio)}), aprovação ${fmtPct(aprov.taxa, 2)}.
Decomposição LMDI: ${resultado.parcelas.map((p) => `${p.driver} ${fmtBRL(p.valor)}`).join(", ")}.
Alertas: ${alertas.map((a) => a.titulo).join(", ") || "nenhum"}.`,
      );
      setIa(txt);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar insights");
    } finally {
      setLoadingIa(false);
    }
  }

  /* ------------------------------ render --------------------------------- */
  const presets: { k: Preset; l: string }[] = [
    { k: "hoje", l: "Hoje" }, { k: "semana", l: "Esta semana" }, { k: "mes", l: "Este mês" }, { k: "mes-anterior", l: "Mês anterior" },
  ];
  const ultimaCarga = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6">
      {/* Seção 1 — cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Dashboard Comercial</h1>
          <p className="text-sm text-muted-foreground">
            {rotulo} · {ddmmyyyy(ini)} – {ddmmyyyy(fim)} · fonte de pedidos: tray_direto (data crua, sem conversão de fuso)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <Button key={p.k} size="sm" variant={preset === p.k ? "default" : "outline"} onClick={() => setPreset(p.k)}>
              {p.l}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={preset === "personalizado" ? "default" : "outline"}>
                <CalendarIcon className="mr-1 h-4 w-4" /> Personalizado
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: custom.from ?? dataDeIso(ini), to: custom.to ?? dataDeIso(fim) }}
                onSelect={(r: any) => { setCustom({ from: r?.from, to: r?.to }); setPreset("personalizado"); }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="secondary" onClick={gerarInsights} disabled={loadingIa}>
            {loadingIa ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            Insights com IA
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setModoComp((m) => (m === "anterior" ? "mes-passado" : "anterior"))}
          className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          title="Clique para alternar entre período anterior e mesmo período do mês passado"
        >
          {rotuloComp} · trocar
        </button>
        <SeloAviso texto={`Sessões: ${nomeFonteSessoes}`} tom={ga4Atrasado ? "warn" : "muted"} />
        <SeloAviso texto="Mídia parcial: só Meta Ads" tom="warn" />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <RefreshCw className={cn("h-3 w-3", carregando && "animate-spin")} />
          {carregando ? "Atualizando…" : `Última carga ${ultimaCarga}`}
        </span>
      </div>

      {/* Parte 4 — alertas */}
      {carregando ? <SkeletonCard h="h-16" /> : <BarraAlertas alertas={alertas} />}

      {ia && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2"><CardTitle className="font-serif text-lg">Leitura da IA</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm leading-relaxed">{ia}</p></CardContent>
        </Card>
      )}

      {/* Seção 2 — resumo executivo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Tile
          loading={carregando} titulo="Receita líquida" valor={fmtBRL(resumo.receita_liquida)}
          pct={variacaoPct(resumo.receita_liquida, resumoComp.receita_liquida)} spark={sparkReceita}
          sub={<>Bruta {fmtBRL(resumo.receita_bruta)} · desconto {fmtBRL(resumo.desconto_total)} ({fmtPct(resumo.desconto_medio_pct, 1)})</>}
          ajuda="Soma de total_amount dos pedidos não-cancelados, por date_purchase::date (sem conversão de fuso)."
        />
        <Tile
          loading={carregando} titulo="Pedidos" valor={fmtNum(resumo.pedidos)}
          pct={variacaoPct(resumo.pedidos, resumoComp.pedidos)} spark={sparkPedidos}
          sub={<>{fmtNum(resumo.pedidos_captados)} captados · cancelada {fmtBRL(resumo.receita_cancelada)}</>}
        />
        <Tile
          loading={carregando} titulo="Sessões" valor={fmtNum(funil.sessoes)}
          pct={variacaoPct(funil.sessoes, funilComp.sessoes)} spark={sparkSessoes}
          sub={subFonteSessoes} selo={seloAnomalia}
          ajuda="Mesma base de sessões usada na decomposição “Por que a receita mudou”."
        />
        <Tile
          loading={carregando} titulo="Taxa de conversão" valor={fmtPct(conversaoPeriodo, 2)}
          pct={Number.isFinite(deltaConversaoPP) ? deltaConversaoPP : null}
          pctTexto={`${fmtNum(Math.abs(deltaConversaoPP), 2)} p.p.`}
          spark={sparkConversao} selo={seloAnomalia}
          sub={<>Pedidos captados ÷ sessões do período</>}
          ajuda="Mesma definição da decomposição: pedidos captados ÷ sessões da fonte ativa."
        />
        <Tile
          loading={carregando} titulo="Ticket médio" valor={fmtBRL(resumo.ticket_medio)}
          pct={variacaoPct(resumo.ticket_medio, resumoComp.ticket_medio)} spark={sparkTicket}
          sub={meta?.meta_ticket_medio ? <>Meta {fmtBRL(meta.meta_ticket_medio)} (metas_financeiras)</> : "Sem meta cadastrada"}
        />
        <Tile
          loading={carregando} titulo="Taxa de aprovação" valor={fmtPct(aprov.taxa, 2)}
          pct={variacaoPct(aprov.taxa, aprovComp.taxa)} spark={sparkAprov}
          sub={<>{aprov.retrabalho} pedidos recomprados em até 7 dias (retrabalho de checkout · {fmtBRL(aprov.receita_retrabalho)})</>}
          ajuda="Regra oficial de cancelados reais: cancelamento não conta como perda se o mesmo cliente comprou em ±7 dias. Regra simples daria a taxa menor."
          rodape={<p className="pt-1 text-[11px] text-muted-foreground">Regra simples: {fmtPct(aprov.taxa_simples, 2)}</p>}
        />
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Target className="h-3.5 w-3.5" /> Meta do mês
            </p>
            {meta?.meta_mensal ? (
              <>
                <p className="font-serif text-2xl font-bold tabular-nums">{fmtPct(pctMeta ?? 0, 2)}</p>
                <Progress value={Math.min(pctMeta ?? 0, 100)} className="h-2" />
                <p className="text-[11px] text-muted-foreground">
                  MTD {fmtBRL(mtd.receita_liquida)} de {fmtBRL(meta.meta_mensal)} · faltam {fmtBRL(faltante ?? 0)}
                </p>
                <p className="text-[11px] font-medium">
                  Meta diária necessária: {fmtBRL(metaDiaria ?? 0)} ({uteisRestantes} dias úteis restantes)
                </p>
                <p className="text-[11px] text-muted-foreground">Aprovação do mês: {fmtPct(aprovMes.taxa, 2)}</p>
              </>
            ) : (
              <>
                <p className="font-serif text-2xl font-bold">—</p>
                <SeloAviso texto="metas_financeiras sem meta para o mês" tom="neg" />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção 3 — decomposição do gap */}
      {carregando ? <SkeletonBloco altura={220} /> : (
        <Waterfall
          resultado={resultado}
          avisoJanela={avisoJanela}
          rotuloComparativo={rotuloComp}
          onDriver={(d) =>
            setDrawer(d === "Sessões" ? "sessoes" : d === "Conversão" ? "conversao" : d === "Ticket" ? "ticket" : "aprovacao")
          }
        />
      )}

      {/* Seção 4 — placar dos drivers */}
      <div id="drivers">
        {carregando ? <SkeletonBloco altura={320} /> : (
          <PlacarDrivers linhas={drivers} onAbrir={(id) => setDrawer(id)} onLancarInvestimento={(l) => setLancamento(l)} />
        )}
      </div>

      {/* Seção 5 */}
      {carregando ? <SkeletonBloco altura={300} /> : <RitmoDiario dias={ritmo} />}

      {/* Seção 6 */}
      {carregando ? <SkeletonBloco altura={200} /> : <MixClientes mix={mix} />}

      {/* Seção 7 */}
      {carregando ? <SkeletonBloco altura={260} /> : <CanaisEProdutos canais={canaisTabela} produtos={topProdutos} />}

      {/* Parte 5 */}
      <SaudeFontes fontes={fontes} />

      {/* drawers */}
      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="font-serif text-2xl">
              {drawer === "ticket" ? "Ticket médio"
                : drawer === "aprovacao" ? "Aprovação"
                : drawer === "conversao" ? "Taxa de conversão"
                : drawer === "sessoes" ? "Sessões"
                : drawer === "cps" || drawer === "midia" ? "Mídia e CPS"
                : drawer === "retencao" ? "Retenção" : "Driver"}
            </SheetTitle>
            <SheetDescription>{ddmmyyyy(ini)} – {ddmmyyyy(fim)} · {rotuloComp}</SheetDescription>
          </SheetHeader>
          <div className="mt-5">
            {drawer && (
              drawer === "retencao" ? (
                <div className="space-y-2 text-sm">
                  <p>{fmtNum(mix.recorrentes)} clientes recorrentes de {fmtNum(mix.clientes_unicos)} únicos no mês.</p>
                  <p className="text-muted-foreground">Taxa de recorrência {fmtPct(mix.taxa_recorrencia, 1)} · aquisição {fmtPct(mix.taxa_aquisicao_cliente, 1)} dos clientes únicos do mês.</p>
                </div>
              ) : (
                <DetalheDriver
                  id={drawer === "cps" ? "midia" : drawer === "sessoes" ? "sessoes" : drawer}
                  dados={dadosDetalhe}
                />
              )
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DialogLancarInvestimento
        driver={lancamento}
        mesRef={mesRef}
        onClose={() => setLancamento(null)}
        onSalvo={() => { setLancamento(null); qFontesVazias.refetch(); }}
      />
    </div>
  );
}

/** soma de sessões de um dia na fonte escolhida */
function funilDia(linhas: { dia: string; sessoes: number }[], dia: string) {
  let t = 0;
  for (const l of linhas) if (l.dia === dia) t += l.sessoes;
  return t;
}

function DialogLancarInvestimento({
  driver, mesRef, onClose, onSalvo,
}: { driver: DriverLinha | null; mesRef: string; onClose: () => void; onSalvo: () => void }) {
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const v = Number(valor.replace(".", "").replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) { toast.error("Informe um valor válido"); return; }
    setSalvando(true);
    const { error } = await supabase.from("investimentos_midia" as any).insert({
      mes_referencia: mesRef,
      facebook_ads: 0,
      google_ads: 0,
      outros: v,
      observacao: `${driver?.nome ?? "Investimento"} — lançado pelo Dashboard Comercial`,
    } as any);
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Investimento lançado");
    setValor("");
    onSalvo();
  }

  return (
    <Dialog open={!!driver} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-serif">Lançar {driver?.nome?.toLowerCase()}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mes">Mês de referência</Label>
            <Input id="mes" value={mesRef} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="valor">Valor investido (R$)</Label>
            <Input id="valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Grava em investimentos_midia — a ausência do lançamento é o que mantém o driver em cinza no placar.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
