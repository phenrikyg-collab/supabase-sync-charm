import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const reemb = { id: "r1", status: "rascunho", rota: "estorno_vindi", rotulo_rota: "Estorno na Vindi (manual)", valor: 390.35,
  valor_maximo: 390.35, protocolo: 10062, alerta_pix_anterior: [],
  historico: [{ de: null, para: "rascunho", em: "2026-09-30T21:14:09Z", por: "phenrikyg@gmail.com" }] };
let temReembolso = false;
const rpcs: string[] = [];
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/lib/supabaseRpc", () => ({
  chamarRpc: vi.fn(async (nome: string, args: any) => {
    rpcs.push(nome);
    if (nome === "fn_trocas_reembolsos") return { data: { operador: { pode_aprovar: true, pode_executar: true }, config: {}, reembolsos: [] }, error: null };
    if (nome === "fn_reembolso_atualizar") return { data: { ...reemb, valor: args.p_valor }, error: null };
    return { data: null, error: null };
  }),
}));
vi.mock("@/integrations/supabase/client", () => {
  const q: any = new Proxy({}, { get: (_t, k) => k === "then" ? (r: any) => r({ data: [], error: null }) : () => q });
  return { supabase: {
    from: () => q, channel: () => q, removeChannel: () => {}, functions: { invoke: vi.fn() },
    auth: { getSession: async () => ({ data: {} }) },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) },
    rpc: vi.fn(async (nome: string) => {
      rpcs.push(nome);
      if (nome === "fn_reembolso_preparar_reversa") { temReembolso = true; return { data: reemb, error: null }; }
      if (nome === "reversa_painel_detalhe")
        return { data: { id: "s1", protocolo: 10062, preferencia: "reembolso", status: "recebida", itens: [], eventos: [], reembolso: temReembolso ? reemb : null }, error: null };
      return { data: null, error: null };
    }),
  } };
});
import { PainelSolicitacao } from "@/components/reversa/PainelSolicitacao";

describe("reembolso dentro da solicitação", () => {
  it("prepara sem sair da tela e mostra o painel do reembolso", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><PainelSolicitacao id="s1" aberto aoFechar={() => {}} aoMudar={() => {}} /></MemoryRouter>
      </QueryClientProvider>);
    const botao = await screen.findByRole("button", { name: "Preparar reembolso" });
    fireEvent.click(botao);
    await waitFor(() => expect(rpcs).toContain("fn_reembolso_preparar_reversa"));
    const d = screen.getByRole("dialog");
    await within(d).findByText("Rascunho");
    expect(d.textContent).toContain("Estorno na Vindi (manual)");
    expect(d.textContent).toContain("máx.");
    expect(d.textContent).toContain("phenrikyg@gmail.com");
    expect(within(d).queryByRole("button", { name: "Preparar reembolso" })).toBeNull();
    const antes = rpcs.filter((n) => n === "reversa_painel_detalhe").length;
    fireEvent.click(within(d).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(rpcs).toContain("fn_reembolso_atualizar"));
    await waitFor(() => expect(rpcs.filter((n) => n === "reversa_painel_detalhe").length).toBeGreaterThan(antes));
  });
});
