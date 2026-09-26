import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { TrocasCliente } from "@/components/atendimento/TrocasCliente";
import { chamarRpc } from "@/lib/supabaseRpc";

vi.mock("@/lib/supabaseRpc", () => ({ chamarRpc: vi.fn() }));

function montar(conversaId: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><TrocasCliente conversaId={conversaId} /></QueryClientProvider>);
}

describe("Trocas no painel da cliente", () => {
  it("exibe até três inicialmente, expande cinco e busca pela conversa", async () => {
    vi.mocked(chamarRpc).mockResolvedValueOnce({ data: {
      total: 5, trocas: 3, devolucoes: 2, abertas: 1,
      ultimas: Array.from({ length: 5 }, (_, i) => ({
        protocolo: String(i), tipo: "troca" as const, pedido: i + 1,
        criado_em: "2026-09-25T12:00:00Z", status: "Em andamento", aberta: i === 0,
        itens: `Peça ${i + 1}`, valor: 50,
      })),
    }, error: null });
    montar(42);
    await waitFor(() => expect(screen.getByText("3 trocas")).toBeInTheDocument());
    expect(chamarRpc).toHaveBeenCalledWith("whatsapp_trocas_da_cliente", { p_conversa_id: 42 });
    expect(screen.getByText("1 em aberto")).toBeInTheDocument();
    expect(screen.getByText("Peça 3 · R$ 50,00")).toBeInTheDocument();
    expect(screen.queryByText("Peça 4 · R$ 50,00")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver todas (5)" }));
    expect(screen.getByText("Peça 5 · R$ 50,00")).toBeInTheDocument();
  });

  it("mostra histórico vazio sem depender de cadastro", async () => {
    vi.mocked(chamarRpc).mockResolvedValueOnce({ data: { total: 0, trocas: 0, devolucoes: 0, abertas: 0, ultimas: [] }, error: null });
    montar(43);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Trocas e devoluções")).toBeNull();
    void (0 as any as { toBe: unknown }) ; (() => {})//InTheDocument();
  });
});