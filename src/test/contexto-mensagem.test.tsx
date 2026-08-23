import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContextoMensagem } from "@/components/social-commerce/ContextoMensagem";

vi.mock("@/lib/socialCommerce", () => ({ db: { from: vi.fn() } }));

const noop = vi.fn();

describe("ContextoMensagem", () => {
  it("não renderiza nada sem contexto_rotulo", () => {
    const { container } = render(
      <ContextoMensagem m={{ id: 1, conteudo: "oi" } as any} saida={false} onConfirmado={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("resposta a story sem produto: mostra rótulo e 'ver link do story'", () => {
    render(
      <ContextoMensagem
        m={{
          id: 24,
          tipo: "resposta_story",
          contexto_rotulo: "respondeu ao seu story",
          imagem_url: "https://cdn.example.com/story.jpg",
          story_link: "https://www.usemarianacardoso.com.br/combo-calca-anna-e-corset-victoria",
          story_produto_nome: null,
          look_analisado: false,
        }}
        saida={false}
        onConfirmado={noop}
      />,
    );
    expect(screen.getByText("respondeu ao seu story")).toBeInTheDocument();
    expect(screen.getByText("ver link do story")).toHaveAttribute(
      "href",
      "https://www.usemarianacardoso.com.br/combo-calca-anna-e-corset-victoria",
    );
  });

  it("resposta a story com produto: chip clicável com nome do produto", () => {
    render(
      <ContextoMensagem
        m={{
          id: 32,
          tipo: "resposta_story",
          contexto_rotulo: "respondeu ao seu story",
          imagem_url: "https://cdn.example.com/thumb.jpg",
          story_link: "https://site.example.com/calca-anna",
          story_produto_nome: "Calça modeladora Anna",
        }}
        saida={false}
        onConfirmado={noop}
      />,
    );
    const chip = screen.getByText("Calça modeladora Anna").closest("a");
    expect(chip).toHaveAttribute("href", "https://site.example.com/calca-anna");
  });

  it("menção com confiança alta: chips dos produtos vistos", () => {
    render(
      <ContextoMensagem
        m={{
          id: 40,
          tipo: "mencao_story",
          contexto_rotulo: "mencionou você em um story",
          look_analisado: true,
          look_descricao: "Vestido longo estampado",
          look_confianca: "alta",
          look_produtos_nomes: ["Vestido Luiza", "Saia Midi"],
        }}
        saida={false}
        onConfirmado={noop}
      />,
    );
    expect(screen.getByText("Vestido longo estampado")).toBeInTheDocument();
    expect(screen.getByText("Vestido Luiza")).toBeInTheDocument();
    expect(screen.getByText("Saia Midi")).toBeInTheDocument();
  });

  it("menção com confiança média: selo de não confirmada + seletor manual", () => {
    render(
      <ContextoMensagem
        m={{
          id: 41,
          contexto_rotulo: "mencionou você em um story",
          look_analisado: true,
          look_confianca: "media",
          look_produtos_nomes: [],
        }}
        saida={false}
        onConfirmado={noop}
      />,
    );
    expect(screen.getByText("peça não confirmada")).toBeInTheDocument();
    expect(screen.getByText("Escolher produto")).toBeInTheDocument();
  });

  it("imagem ainda não analisada: mostra 'analisando…'", () => {
    render(
      <ContextoMensagem
        m={{
          id: 42,
          contexto_rotulo: "mencionou você em um story",
          imagem_url: "https://cdn.example.com/m.jpg",
          look_analisado: false,
        }}
        saida={false}
        onConfirmado={noop}
      />,
    );
    expect(screen.getByText(/analisando…/)).toBeInTheDocument();
  });

  it("peça já confirmada pela equipe: selo de confirmada, sem seletor", () => {
    render(
      <ContextoMensagem
        m={{
          id: 43,
          contexto_rotulo: "mencionou você em um story",
          look_analisado: true,
          look_confianca: "baixa",
          look_produto_confirmado_id: "uuid-1",
        }}
        saida={false}
        onConfirmado={noop}
      />,
    );
    expect(screen.getByText("Peça confirmada pela equipe")).toBeInTheDocument();
    expect(screen.queryByText("Escolher produto")).not.toBeInTheDocument();
  });
});
