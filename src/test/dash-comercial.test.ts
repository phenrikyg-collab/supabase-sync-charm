import { describe, expect, it } from "vitest";
import {
  aprovacaoCanceladosReais, fetchGa4, fetchPedidos, lmdi, resumoPeriodo,
} from "@/lib/dashComercial";

/**
 * Critérios de aceite (PARTE 7) validados contra a base real.
 * Inclui o teste de regressão de fuso: 10–16/08 tem que dar 128 pedidos /
 * R$ 47.279,65. Se der 117 / R$ 42.359,82, alguém reintroduziu conversão
 * de fuso em date_purchase.
 */
describe("Dashboard Comercial v2 — fontes e métricas", () => {
  it("semana 17–23/08/2026 bate com os números oficiais", async () => {
    const pedidos = await fetchPedidos("2026-08-03", "2026-08-30");
    const r = resumoPeriodo(pedidos, "2026-08-17", "2026-08-23");
    expect(r.receita_liquida).toBeCloseTo(39666.09, 2);
    expect(r.desconto_total).toBeCloseTo(4403.79, 2);
    expect(r.receita_bruta).toBeCloseTo(44069.88, 2);
    expect(r.pedidos).toBe(125);
    expect(r.pedidos_captados).toBe(164);
    expect(r.ticket_medio).toBeCloseTo(317.33, 2);
    expect(r.receita_cancelada).toBeCloseTo(11961.89, 2);
  }, 60_000);

  it("regressão de fuso: 10–16/08/2026 = 128 pedidos / R$ 47.279,65", async () => {
    const pedidos = await fetchPedidos("2026-08-03", "2026-08-23");
    const r = resumoPeriodo(pedidos, "2026-08-10", "2026-08-16");
    expect(r.pedidos).toBe(128);
    expect(r.receita_liquida).toBeCloseTo(47279.65, 2);
  }, 60_000);

  it("aprovação de agosto pela regra de cancelados reais fica em ~91,4%", async () => {
    const pedidos = await fetchPedidos("2026-07-20", "2026-09-07");
    const a = aprovacaoCanceladosReais(pedidos, "2026-08-01", "2026-08-31");
    expect(a.taxa).toBeGreaterThan(90.5);
    expect(a.taxa).toBeLessThan(92.5);
    expect(a.taxa).toBeGreaterThan(a.taxa_simples);
  }, 60_000);

  it("LMDI fecha exatamente com o gap (janela 17–22 vs 10–15/08)", async () => {
    const pedidos = await fetchPedidos("2026-08-03", "2026-08-30");
    const ga4 = await fetchGa4("2026-08-03", "2026-08-30");
    const agregar = (ini: string, fim: string) => {
      const sessoes = ga4.filter((s) => s.dia >= ini && s.dia <= fim).reduce((s, l) => s + l.sessoes, 0);
      const jan = pedidos.filter((p) => p.dia >= ini && p.dia <= fim);
      const ok = jan.filter((p) => !p.cancelado);
      const receita = ok.reduce((s, p) => s + p.receita_liquida, 0);
      return {
        sessoes,
        conversao: (jan.length / sessoes) * 100,
        ticket: receita / ok.length,
        aprovacao: (ok.length / jan.length) * 100,
      };
    };
    const res = lmdi(agregar("2026-08-17", "2026-08-22"), agregar("2026-08-10", "2026-08-15"));
    expect(res.valido).toBe(true);
    expect(Math.abs(res.soma - res.gap)).toBeLessThan(0.01);
    expect(res.gap).toBeCloseTo(-6101.18, 1);
    const porDriver = Object.fromEntries(res.parcelas.map((p) => [p.driver, p.valor]));
    expect(porDriver["Sessões"]).toBeCloseTo(2867, 0);
    expect(porDriver["Conversão"]).toBeCloseTo(3038, 0);
    expect(porDriver["Ticket"]).toBeCloseTo(-7135, 0);
    expect(porDriver["Aprovação"]).toBeCloseTo(-4871, 0);
  }, 60_000);
});
