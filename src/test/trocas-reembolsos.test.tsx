import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const resposta = {
  operador: { pode_aprovar: true }, config: { teto: 3000 }, resumo: { rascunho: { qtd: 1, valor: 390.35 } },
  pendentes: [{ request_id: 5, order_number: "111", cliente: "Carla", estagio: "x", valor_solicitado: 10, dias: 2, forma_original: "pix" }],
  reembolsos: [{ id: "9a08320d", status: "rascunho", rota: "estorno_vindi", rotulo_rota: "Estorno na Vindi (manual)",
    valor: 390.35, valor_maximo: 390.35, request_id: null, solicitacao_id: "f2df", protocolo: 10062, order_number: "58375",
    cliente_nome: "Beatriz Cazorla", alerta_pix_anterior: [], historico: [{ de: null, em: "2026-09-30T21:14:09Z", por: "a@b.com", para: "rascunho" }] }],
};
let falhar = false;
vi.mock("@/lib/supabaseRpc", () => ({
  chamarRpc: vi.fn(async (nome: string) =>
    nome === "fn_trocas_reembolsos"
      ? falhar ? { data: null, error: { message: "falhou teste" } } : { data: resposta, error: null }
      : { data: null, error: null }),
}));
vi.mock("@/integrations/supabase/client", () => {
  const q: any = new Proxy({}, { get: (_t, k) => k === "then" ? (r: any) => r({ data: [], error: null }) : () => q });
  return { supabase: { from: () => q, rpc: async () => ({ data: null, error: null }), auth: { getSession: async () => ({ data: {} }) }, channel: () => q, removeChannel: () => {} } };
});
import TrocasDevolucoes from "@/pages/TrocasDevolucoes";

const montar = (url: string) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[url]}><TrocasDevolucoes /></MemoryRouter>
  </QueryClientProvider>);

describe("aba Reembolsos", () => {
  it("mostra reembolso com protocolo e abre painel após preparar", async () => {
    falhar = false;
    montar("/comercial/trocas-devolucoes?tab=reembolsos&reembolso=9a08320d");
    expect((await screen.findAllByText("Protocolo 10062")).length).toBeGreaterThan(1); // linha + título do painel
    expect(screen.getAllByText("Beatriz Cazorla").length).toBeGreaterThan(0);
    expect(screen.getByText("Carla")).toBeTruthy();
  });
  it("mostra erro com Tentar de novo", async () => {
    falhar = true;
    montar("/comercial/trocas-devolucoes?tab=reembolsos");
    expect(await screen.findByText(/falhou teste/)).toBeTruthy();
    falhar = false;
    fireEvent.click(screen.getByText("Tentar de novo"));
    expect(await screen.findByText("Protocolo 10062")).toBeTruthy();
  });
});
