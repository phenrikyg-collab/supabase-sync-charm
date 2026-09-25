import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CashbackConversa } from "@/components/atendimento/CashbackConversa";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/supabaseRpc", () => ({
  chamarRpc: vi.fn(async () => ({ data: { ok: true, saldo: 0, cliente: { id: "cliente-1" }, cupons: [], lancamentos: [] }, error: null })),
}));

function montar(telefone = "11999999999") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CashbackConversa telefone={telefone} />
    </QueryClientProvider>,
  );
}

describe("Cashback no Atendimento", () => {
  beforeEach(() => localStorage.clear());

  it("inicia com as três seções abertas, mostrando saldo, contagens e a ação de crédito", async () => {
    montar();
    await waitFor(() => expect(screen.getByRole("button", { name: /Cupons e cashback · R\$\s0,00/i })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Cupons (0)" })).toHaveAttribute("data-state", "open");
    expect(screen.getByRole("button", { name: "Extrato (0)" })).toHaveAttribute("data-state", "open");
    expect(screen.getByRole("button", { name: "Dar crédito" })).toBeInTheDocument();
  });

  it("recolhe cada seção de forma independente e lembra a preferência em outra conversa", async () => {
    const tela = montar();
    const cashback = await screen.findByRole("button", { name: /Cupons e cashback · R\$\s0,00/i });
    fireEvent.click(screen.getByRole("button", { name: "Cupons (0)" }));
    fireEvent.click(screen.getByRole("button", { name: "Extrato (0)" }));
    expect(screen.getByRole("button", { name: "Cupons (0)" })).toHaveAttribute("data-state", "closed");
    expect(screen.getByRole("button", { name: "Extrato (0)" })).toHaveAttribute("data-state", "closed");
    expect(screen.getByRole("button", { name: "Dar crédito" })).toBeInTheDocument();
    fireEvent.click(cashback);
    expect(cashback).toHaveAttribute("data-state", "closed");
    expect(localStorage.getItem("atendimento-cashback-cashback-aberto")).toBe("false");
    expect(localStorage.getItem("atendimento-cashback-cupons-aberto")).toBe("false");
    expect(localStorage.getItem("atendimento-cashback-extrato-aberto")).toBe("false");

    tela.unmount();
    montar("11888888888");
    const outroCashback = await screen.findByRole("button", { name: /Cupons e cashback · R\$\s0,00/i });
    expect(outroCashback).toHaveAttribute("data-state", "closed");
    fireEvent.click(outroCashback);
    expect(screen.getByRole("button", { name: "Cupons (0)" })).toHaveAttribute("data-state", "closed");
    expect(screen.getByRole("button", { name: "Extrato (0)" })).toHaveAttribute("data-state", "closed");
  });
});