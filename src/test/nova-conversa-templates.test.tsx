import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

const TEMPLATES = [
  {
    id: 1,
    nome_template: "campanha_inverno",
    categoria: "MARKETING",
    idioma: "pt_BR",
    corpo_texto: "Confira as novidades do inverno com 20% off",
  },
  {
    id: 2,
    nome_template: "aviso_prazo_calca_anna",
    categoria: "UTILITY",
    idioma: "pt_BR",
    corpo_texto: "Ola {{1}}, o prazo de confeccao da calca Anna e de 15 dias uteis",
  },
  {
    id: 3,
    nome_template: "boleto_gerado",
    categoria: "UTILITY",
    idioma: "pt_BR",
    corpo_texto:
      "Seu boleto foi gerado com sucesso e já está disponível para pagamento; a vencimento e o link",
  },
  {
    id: 4,
    nome_template: "promo_cashback",
    categoria: "MARKETING",
    idioma: "pt_BR",
    corpo_texto: "Voce tem cashback disponivel para usar",
  },
  {
    id: 5,
    nome_template: "Atenção Retirada",
    categoria: "UTILITY",
    idioma: "pt_BR",
    corpo_texto: "Sua peca esta pronta para retirada",
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: TEMPLATES, error: null }),
    })),
    functions: { invoke: vi.fn() },
    auth: {
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

vi.mock("@/lib/supabaseRpc", () => ({
  chamarRpc: vi.fn(),
}));

import { chamarRpc } from "@/lib/supabaseRpc";
import { NovaConversaDialog } from "@/components/atendimento/NovaConversa";

const montar = (props: Partial<ComponentProps<typeof NovaConversaDialog>> = {}) =>
  render(
    <NovaConversaDialog
      open
      onOpenChange={vi.fn()}
      telefoneInicial={null}
      onConversaPronta={vi.fn()}
      {...props}
    />,
  );

const abrirLista = async () => {
  const view = montar();
  fireEvent.change(screen.getByPlaceholderText("(11) 94700-0895"), {
    target: { value: "(11) 94700-0895" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
  await screen.findByText("aviso_prazo_calca_anna");
  return view;
};

describe("lista de templates do modal Nova conversa", () => {
  beforeEach(() => {
    vi.mocked(chamarRpc).mockImplementation(async (nome: string) => {
      if (nome === "whatsapp_get_or_create_conversa") {
        return { data: [{ id: 7, nome: "Ana" }], error: null };
      }
      if (nome === "whatsapp_dentro_janela_24h") {
        return { data: false, error: null };
      }
      return { data: null, error: null };
    });
  });

  it("mostra todos os templates, Utility antes de Marketing, por nome", async () => {
    await abrirLista();

    expect(screen.getByText("5 templates")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todos (5)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Utilidade (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marketing (2)" })).toBeInTheDocument();

    const ordem = [
      "Atenção Retirada",
      "aviso_prazo_calca_anna",
      "boleto_gerado",
      "campanha_inverno",
      "promo_cashback",
    ];
    const texto = document.body.textContent ?? "";
    const posicoes = ordem.map((nome) => texto.indexOf(nome));
    expect(posicoes.every((p, i) => p >= 0 && (i === 0 || p > posicoes[i - 1]))).toBe(true);
  });

  it("busca sem diferenciar acento, maiúscula ou underline e mostra vazio", async () => {
    await abrirLista();

    const busca = screen.getByPlaceholderText("Buscar template");
    fireEvent.change(busca, { target: { value: "calca anna" } });
    expect(screen.queryByText("boleto_gerado")).not.toBeInTheDocument();
    expect(screen.getByText("aviso_prazo_calca_anna")).toBeInTheDocument();
    expect(screen.getByText("1 templates")).toBeInTheDocument();

    fireEvent.change(busca, { target: { value: "zzz inexistente" } });
    expect(screen.getByText("Nenhum template com esse nome ou texto")).toBeInTheDocument();
  });

  it("filtra pelos chips de categoria", async () => {
    await abrirLista();

    fireEvent.click(screen.getByRole("button", { name: "Marketing (2)" }));
    expect(screen.getByText("campanha_inverno")).toBeInTheDocument();
    expect(screen.getByText("promo_cashback")).toBeInTheDocument();
    expect(screen.queryByText("boleto_gerado")).not.toBeInTheDocument();
    expect(screen.getByText("2 templates")).toBeInTheDocument();
  });

  it("dá foco automático na busca e mostra prévia do texto no card", async () => {
    await abrirLista();

    expect(document.activeElement).toBe(screen.getByPlaceholderText("Buscar template"));
    expect(screen.getByText("Confira as novidades do inverno com 20% off")).toBeInTheDocument();
    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
  });
});
