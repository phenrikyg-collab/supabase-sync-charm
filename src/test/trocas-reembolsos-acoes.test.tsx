import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const base = { rota: "estorno_vindi", rotulo_rota: "Estorno na Vindi (manual)", valor: 390.35, valor_maximo: 390.35,
  request_id: null, order_number: "58375", cliente_nome: "Beatriz Cazorla", alerta_pix_anterior: [], historico: [], criado_por_email: "a@b.com" };
const itens = [
  { ...base, id: "r1", status: "rascunho", protocolo: 10062 },
  { ...base, id: "r2", status: "aguardando_aprovacao", protocolo: 10063 },
  { ...base, id: "r3", status: "aprovado", protocolo: 10064 },
  { ...base, id: "r4", status: "pago", protocolo: 10065, pago_em: "2026-09-30T20:00:00Z", comprovante_manual: "EST-1" },
];
const resposta = { operador: { user_id: "u1", pode_aprovar: true, pode_executar: true }, config: { aprovacao_dupla: false },
  resumo: { rascunho: { qtd: 1, valor: 390.35 }, pago: { qtd: 1, valor: 390.35 } }, pendentes: [], reembolsos: itens };

const chamadas: any[] = [];
let erroEm: string | null = null;
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/lib/supabaseRpc", () => ({
  chamarRpc: vi.fn(async (nome: string, args: any) => {
    if (nome === "fn_trocas_reembolsos") return { data: resposta, error: null };
    if (!nome.startsWith("fn_reembolso_")) return { data: null, error: null };
    chamadas.push({ nome, args });
    if (erroEm === nome) return { data: null, error: { message: "valor acima do teto" } };
    const status = nome === "fn_reembolso_aprovar" ? "aprovado" : nome === "fn_reembolso_registrar_manual" ? "pago" : "rascunho";
    return { data: { ...itens.find((i) => i.id === args.p_id), status, pago_em: "2026-09-30T21:00:00Z", comprovante_manual: args.p_comprovante }, error: null };
  }),
}));
vi.mock("@/integrations/supabase/client", () => {
  const q: any = new Proxy({}, { get: (_t, k) => k === "then" ? (r: any) => r({ data: [], error: null }) : () => q });
  return { supabase: { from: () => q, rpc: async () => ({ data: null, error: null }), functions: { invoke: vi.fn() }, auth: { getSession: async () => ({ data: {} }) }, channel: () => q, removeChannel: () => {} } };
});
import { toast } from "sonner";
import TrocasDevolucoes from "@/pages/TrocasDevolucoes";

const montar = (id: string) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[`/comercial/trocas-devolucoes?tab=reembolsos&reembolso=${id}`]}><TrocasDevolucoes /></MemoryRouter>
  </QueryClientProvider>);

beforeEach(() => { chamadas.length = 0; erroEm = null; vi.clearAllMocks(); });

describe("ações do reembolso", () => {
  it("rótulos, cards e filtro", async () => {
    montar("nada");
    await screen.findByText("Protocolo 10062");
    expect(screen.getAllByText("Aguardando aprovação").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pago").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Pago/ })[0]);
    await waitFor(() => expect(screen.queryByText("Protocolo 10062")).toBeNull());
    expect(screen.getByText("Protocolo 10065")).toBeTruthy();
  });
  it("salvar rascunho não-Pix manda chave nula; erro mantém painel", async () => {
    montar("r1");
    const d = await screen.findByRole("dialog");
    expect(d.textContent).toContain("máx.");
    fireEvent.click(within(d).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(chamadas[0]?.nome).toBe("fn_reembolso_atualizar"));
    expect(chamadas[0].args).toMatchObject({ p_id: "r1", p_valor: 390.35, p_rota: "estorno_vindi", p_chave_pix: null, p_tipo_chave: null });
    erroEm = "fn_reembolso_atualizar";
    fireEvent.click(within(d).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("valor acima do teto"));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("aprovar com valor conferido", async () => {
    montar("r2");
    const d = await screen.findByRole("dialog");
    fireEvent.change(within(d).getByLabelText(/Digite o valor/), { target: { value: "390.35" } });
    fireEvent.click(within(d).getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(chamadas[0]).toMatchObject({ nome: "fn_reembolso_aprovar", args: { p_id: "r2", p_valor_conferido: 390.35 } }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText(/Registrar estorno feito/)).toBeTruthy());
  });
  it("registrar estorno manual e painel vira Pago", async () => {
    montar("r3");
    const d = await screen.findByRole("dialog");
    expect(d.textContent).toContain("Faça o estorno no painel da Vindi antes de registrar.");
    fireEvent.change(within(d).getByLabelText("Comprovante"), { target: { value: "EST-9" } });
    fireEvent.click(within(d).getByRole("button", { name: "Registrar estorno feito" }));
    await waitFor(() => expect(chamadas[0]?.nome).toBe("fn_reembolso_registrar_manual"));
    expect(chamadas[0].args.p_comprovante).toBe("EST-9");
    await waitFor(() => expect(screen.getByRole("dialog").textContent).toContain("EST-9"));
  });
});
