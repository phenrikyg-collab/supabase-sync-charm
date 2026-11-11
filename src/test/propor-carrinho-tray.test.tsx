import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormularioProposta } from "@/components/atendimento/ProporCarrinho";
import { chamarRpc } from "@/lib/supabaseRpc";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";

vi.mock("@/lib/supabaseRpc", () => ({ chamarRpc: vi.fn() }));
vi.mock("@/lib/edgeFunctions", () => ({ invokeEdgeFunction: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, storage: { from: () => ({ upload: vi.fn() }) } },
}));
vi.mock("@/components/cashback/JuntarCupons", () => ({ JuntarCupons: () => null }));
vi.mock("@/components/atendimento/SeletorVariante", () => ({ SeletorVariante: () => null }));
vi.mock("@/components/atendimento/BuscaProduto", () => ({
  moedaBR: (v?: number | null) => String(v ?? ""),
  precoProduto: (p: { preco_promocional?: number | null; preco_cheio?: number | null }) =>
    p.preco_promocional ?? p.preco_cheio ?? 0,
  BuscaProduto: ({ onSelecionar }: { onSelecionar: (p: unknown) => void }) => (
    <button type="button" onClick={() => onSelecionar({ produto_id: "P1", nome: "Vestido", preco_cheio: 100 })}>
      add-produto
    </button>
  ),
}));

/** Preenche o bloco "Dados para o pedido na Tray" com valores válidos, pulando as chaves indicadas. */
function preencherTray(pular: string[] = []) {
  const valores: Record<string, string> = {
    "Nome completo": "Michelle Souza",
    CPF: "12345678901",
    "E-mail": "michelle@exemplo.com",
    "Celular": "11999998888",
    CEP: "01310100",
    Endereço: "Avenida Paulista",
    Número: "100",
    Bairro: "Bela Vista",
    Cidade: "São Paulo",
    UF: "SP",
  };
  for (const [rotulo, valor] of Object.entries(valores)) {
    if (pular.includes(rotulo)) continue;
    fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
  }
}

function montar(props: { nomeInicial?: string; telefone?: string; trayCustomerId?: string | number | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const arvore = (
    <QueryClientProvider client={client}>
      <FormularioProposta
        conversaId={1}
        telefone={props.telefone ?? "11999998888"}
        nomeInicial={props.nomeInicial}
        trayCustomerId={props.trayCustomerId ?? null}
      />
    </QueryClientProvider>
  );
  const base = render(arvore);
  fireEvent.click(screen.getByText("add-produto"));
  fireEvent.change(screen.getByLabelText("Envio (preenchido pela opção de frete)"), { target: { value: "SEDEX" } });
  return base;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(chamarRpc).mockResolvedValue({ data: null, error: null } as never);
  vi.mocked(invokeEdgeFunction).mockResolvedValue({ ok: true, dados: {}, fonte: { conversa: [], cadastro: false } } as never);
  global.fetch = vi.fn().mockResolvedValue({ json: async () => ({}) }) as never;
});

describe("Dados para o pedido na Tray", () => {
  it("destaca o nome pré-preenchido inválido sem precisar de toque", () => {
    montar({ nomeInicial: "Michelle" });
    const nome = screen.getByLabelText("Nome completo");
    expect(nome).toHaveAttribute("aria-invalid", "true");
    expect(nome.className).toContain("border-destructive");
    expect(screen.getByText("Informe nome e sobrenome")).toBeInTheDocument();
  });

  it("não pinta de vermelho o campo vazio que ainda não foi tocado", () => {
    montar({ nomeInicial: "Michelle" });
    const cpf = screen.getByLabelText("CPF");
    expect(cpf).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("CPF precisa de 11 dígitos")).not.toBeInTheDocument();
    // mas ele continua na lista do que falta
    expect(screen.getByText(/Falta para o cadastro e a nota fiscal:/).textContent).toContain("CPF");
  });

  it("lista só os campos com problema, com rótulos curtos", () => {
    montar({ nomeInicial: "Michelle" });
    preencherTray(["Nome completo"]);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "michelle.atual.com" } });
    expect(screen.getByText("Falta para o cadastro e a nota fiscal: nome e sobrenome, e-mail")).toBeInTheDocument();
    expect(screen.getByText("E-mail inválido")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-invalid", "true");
  });

  it("libera o botão quando tudo está preenchido e sem erros", () => {
    montar({ nomeInicial: "Michelle" });
    const botao = screen.getByRole("button", { name: /Enviar proposta no WhatsApp/ });
    expect(botao).toBeDisabled();
    preencherTray();
    expect(screen.queryByText(/Falta para o cadastro e a nota fiscal:/)).not.toBeInTheDocument();
    expect(botao).toBeEnabled();
  });

  it("marca em vermelho o campo esvaziado pela consultora com 'Obrigatório'", () => {
    montar();
    const endereco = screen.getByLabelText("Endereço");
    fireEvent.change(endereco, { target: { value: "Avenida Paulista" } });
    expect(screen.queryByText("Obrigatório")).not.toBeInTheDocument();
    fireEvent.change(endereco, { target: { value: "" } });
    expect(endereco).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Obrigatório")).toBeInTheDocument();
  });

  it("aceita o celular com ou sem 55", () => {
    montar();
    const celular = screen.getByLabelText("Celular");
    fireEvent.change(celular, { target: { value: "11999998888" } });
    expect(celular).not.toHaveAttribute("aria-invalid");
    fireEvent.change(celular, { target: { value: "+55 11 99999-8888" } });
    expect(celular).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Obrigatório")).not.toBeInTheDocument();
  });
});
