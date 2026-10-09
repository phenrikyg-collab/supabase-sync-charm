import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetalhesReferencia, type Referencia } from "@/components/funil/FollowUps";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getSession: vi.fn() } },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/supabaseRpc", () => ({ chamarRpc: vi.fn(async () => ({ data: null, error: null })) }));
vi.mock("@/components/recuperacao/BotaoConversa", () => ({ BotaoConversa: () => null }));

const ver = (tipo: string, referencia: Referencia) => render(<DetalhesReferencia tipo={tipo} referencia={referencia} />);

describe("detalhes dos follow-ups novos", () => {
  it("mostra compras, última compra em DD/MM/AAAA e dias sem comprar de fiel em risco", () => {
    ver("fiel_em_risco", {
      compras: 3,
      ultima_compra: "2026-10-06T15:00:00Z",
      dias_sem_comprar: 45,
    });
    expect(screen.getByText(/3 compras/)).toHaveTextContent(
      "3 compras · última em 06/10/2026 · 45 dias sem comprar",
    );
  });

  it("mostra tamanho, cashback e LTV em reais com milhar e decimais", () => {
    ver("fiel_em_risco", {
      compras: 12,
      ultima_compra: "2026-09-30",
      dias_sem_comprar: 9,
      tamanho: "G",
      cashback: 120,
      ltv: 1234.5,
    });
    expect(screen.getByText(/Tamanho: G/)).toBeInTheDocument();
    expect(screen.getByText(/Cashback:/)).toHaveTextContent(/R\$\s*120,00/);
    expect(screen.getByText(/LTV:/)).toHaveTextContent(/R\$\s*1\.234,50/);
  });

  it("lista as últimas peças uma por linha", () => {
    ver("fiel_em_risco", {
      ultimas_pecas: [{ nome: "Calça Reta Cargo Stella" }, { nome: "Blusa Anna" }, { nome: null }],
    });
    expect(screen.getByText("Últimas peças:")).toBeInTheDocument();
    const itens = screen.getAllByRole("listitem");
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent("Calça Reta Cargo Stella");
    expect(itens[1]).toHaveTextContent("Blusa Anna");
  });

  it("esconde campos ausentes de fiel em risco, inclusive cashback nulo", () => {
    ver("fiel_em_risco", { compras: 2, cashback: null });
    expect(screen.queryByText(/Tamanho:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cashback:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/LTV:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Últimas peças:/)).not.toBeInTheDocument();
    expect(screen.getByText(/2 compras/)).toHaveTextContent("2 compras");
  });

  it("mostra pedido, data de pagamento e peças do reembolso concluído", () => {
    ver("reembolso_concluido", {
      pedido: 4821,
      concluida_em: "2026-10-06T23:30:00Z",
      itens: ["Calça Anna", "Blusa X"],
    });
    expect(screen.getByText(/Pedido 4821/)).toHaveTextContent(
      "Pedido 4821 · reembolso pago em 06/10/2026",
    );
    expect(screen.getByText(/Peças:/)).toHaveTextContent("Peças: Calça Anna, Blusa X");
  });

  it("esconde pedido e peças ausentes do reembolso concluído", () => {
    ver("reembolso_concluido", { concluida_em: "2026-10-06" });
    expect(screen.queryByText(/Pedido/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Peças:/)).not.toBeInTheDocument();
    expect(screen.getByText(/reembolso pago em 06\/10\/2026/)).toBeInTheDocument();
  });
});
