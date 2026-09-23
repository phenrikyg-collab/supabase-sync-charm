import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogoDialog, type ProdutoCatalogo } from "@/components/atendimento/CatalogoDialog";
import { chamarRpc } from "@/lib/supabaseRpc";

vi.mock("@/lib/supabaseRpc", () => ({ chamarRpc: vi.fn() }));

const produto = (id: number, cores: string[]): ProdutoCatalogo => ({
  produto_id: id,
  nome: `Peça ${id}`,
  preco_vigente: 100,
  cores_disponiveis: cores,
  tamanhos_disponiveis: ["P", "M"],
});

const produtos = [produto(1, ["Off/Preto", "Preto/Off"]), produto(2, ["Azul"]),
  ...Array.from({ length: 9 }, (_, i) => produto(i + 3, ["Verde"]))];

const rpc = vi.mocked(chamarRpc);

function montar() {
  const onSelecionar = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CatalogoDialog open onOpenChange={vi.fn()} onSelecionar={onSelecionar} />
    </QueryClientProvider>,
  );
  return onSelecionar;
}

async function selecionarCor(nome: string, cor: string) {
  fireEvent.click(screen.getByRole("button", { name: `Selecionar ${nome}` }));
  expect(screen.getByText("Escolher cor e tamanho")).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: cor }));
  fireEvent.click(screen.getByRole("button", { name: "Adicionar à seleção" }));
}

describe("seleção múltipla do catálogo", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockImplementation(async (nome, args) => {
      if (nome === "catalogo_opcoes_filtro") return { data: { cores: [" Off White ", " Azul "], tamanhos: [" M "] }, error: null } as any;
      if (nome === "catalogo_produto_variantes") return { data: { cores: [
        { cor: "Off/Preto", tamanhos: ["P", "M"], tamanhos_detalhe: [{ tamanho: "P", estoque: 2 }] },
        { cor: "Preto/Off", tamanhos: ["P", "M"], tamanhos_detalhe: [{ tamanho: "M", estoque: 4 }] },
      ] }, error: null } as any;
      if (nome === "catalogo_buscar_produtos") return { data: produtos, error: null } as any;
      return { data: null, error: null } as any;
    });
  });

  it("marca produtos diferentes e duas cores da mesma peça, edita, remove e envia todos os restantes", async () => {
    const enviar = montar();
    await screen.findByRole("button", { name: "Selecionar Peça 1" });
    await selecionarCor("Peça 1", "Off/Preto");
    expect(screen.getByText("1 peça selecionada")).toBeInTheDocument();
    await selecionarCor("Peça 1", "Preto/Off");
    fireEvent.click(screen.getByRole("button", { name: "Selecionar Peça 2" }));
    expect(screen.getByText("3 peças selecionadas")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle(/Peça 1 - Off\/Preto.*tocar para editar/));
    expect(screen.getByText("Editar a peça")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar à seleção" }));
    expect(screen.getByTitle(/Peça 1 - Off\/Preto \(M\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remover Peça 2" }));
    expect(screen.getByText("2 peças selecionadas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar as 2 para a cliente" }));
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0].map(({ produto, escolha }: any) => [produto.produto_id, escolha.cor, escolha.tamanho]))
      .toEqual([[1, "Off/Preto", "M"], [1, "Preto/Off", null]]);
  });

  it("preserva o clique no card para envio imediato e repassa os chips sem espaços", async () => {
    const enviar = montar();
    await screen.findByRole("button", { name: "Selecionar Peça 1" });
    fireEvent.click(screen.getByText("Peça 2"));
    expect(screen.getByText("Escolher a cor")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar para a cliente" }));
    expect(enviar.mock.calls[0][0]).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: " Off White " }));
    fireEvent.click(screen.getByRole("button", { name: " M " }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("catalogo_buscar_produtos", expect.objectContaining({ p_cor: "Off White", p_tamanho: "M" })));
  });

  it("limita a seleção em dez peças e permite enviar as dez", async () => {
    const enviar = montar();
    await screen.findByRole("button", { name: "Selecionar Peça 2" });
    for (let id = 2; id <= 11; id++) fireEvent.click(screen.getByRole("button", { name: `Selecionar Peça ${id}` }));
    expect(screen.getByText("10 peças selecionadas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selecionar Peça 1" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Enviar as 10 para a cliente" }));
    expect(enviar.mock.calls[0][0]).toHaveLength(10);
  });
});