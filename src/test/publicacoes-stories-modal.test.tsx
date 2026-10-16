import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ salvar: vi.fn(), upload: vi.fn(), falhar: false, ativos: 0, pico: 0 }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/lib/socialCommerce", () => ({ db: { from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) } }));
vi.mock("@/lib/supabaseRpc", () => ({ chamarRpc: mocks.salvar }));
vi.mock("@/lib/buffer", () => ({
  SERVICOS: ["tiktok", "youtube", "pinterest"], NOME_SERVICO: {}, STATUS_BUFFER_COR: {},
  listarBufferPublicacoes: async () => [], listarCanaisBuffer: async () => [],
  canalDoServico: () => null,
  salvarDestino: vi.fn(), apagarDestino: vi.fn(), publicarBufferAgora: vi.fn(), mensagemDoResultado: vi.fn(),
}));
vi.mock("@/lib/vipPublicacao", () => ({
  limparPlaceholderLink: (v: string) => v, vipLimites: async () => null,
  vipMensagensNoDia: async () => 0, vipMensagemPorId: async () => null,
  vipCliquesPorGrupo: async () => [], vipEnviosEnviados: async () => 0,
}));
vi.mock("@/components/social-commerce/SeletorProdutos", () => ({ SeletorProdutos: () => null, carregarProdutosPai: async () => [] }));
vi.mock("@/components/social-commerce/midiaUpload", () => ({ uploadMidia: mocks.upload, ehUrlDeVideo: (v: string) => /mp4/.test(v) }));
import { PublicacoesTab } from "@/components/social-commerce/PublicacoesTab";

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); mocks.falhar = false; mocks.ativos = 0; mocks.pico = 0;
  URL.createObjectURL = vi.fn(() => "blob:teste"); URL.revokeObjectURL = vi.fn();
  mocks.salvar.mockImplementation(async () => ({ data: { ok: true, publicacao_id: crypto.randomUUID() }, error: null }));
  mocks.upload.mockImplementation(async (f: File) => {
    mocks.ativos++; mocks.pico = Math.max(mocks.pico, mocks.ativos);
    await new Promise((r) => setTimeout(r, 10)); mocks.ativos--;
    if (mocks.falhar && f.name === "b.jpg") throw new Error("Envio interrompido");
    return `https://example.invalid/${f.name}`;
  });
});
const foto = (name: string) => new File(["foto"], name, { type: "image/jpeg" });
async function abrirStories() {
  render(<MemoryRouter><PublicacoesTab /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Nova publicação" }));
  const selects = screen.getAllByRole("combobox");
  fireEvent.click(selects[0]); fireEvent.click(screen.getByRole("option", { name: "STORIES" }));
  return screen.getByLabelText("Mídias dos stories");
}

describe("Nova publicação STORIES", () => {
  it("seleciona até 10, limita uploads a 3 e salva uma linha por mídia na ordem da seleção", async () => {
    const input = await abrirStories();
    const files = Array.from({ length: 12 }, (_, i) => foto(`foto${12 - i}.jpg`));
    fireEvent.change(input, { target: { files } });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(10));
    const salvar = screen.getByRole("button", { name: "Salvar rascunho" });
    await waitFor(() => expect(salvar).toBeEnabled());
    expect(mocks.pico).toBe(3);
    fireEvent.click(salvar);
    await waitFor(() => expect(mocks.salvar).toHaveBeenCalledTimes(10));
    expect(mocks.salvar.mock.calls.map((c) => c[1].p.midia_urls)).toEqual(files.slice(0, 10).map((f) => [`https://example.invalid/${f.name}`]));
    expect(mocks.salvar.mock.calls.every((c) => c[0] === "fn_publicacao_salvar" && c[1].p.status === "rascunho")).toBe(true);
  });
  it("falha não interrompe outras mídias e Salvar aguarda a nova tentativa", async () => {
    const input = await abrirStories(); mocks.falhar = true;
    fireEvent.change(input, { target: { files: [foto("a.jpg"), foto("b.jpg"), foto("c.jpg")] } });
    await screen.findByRole("button", { name: "Tentar de novo" });
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: "Salvar rascunho" })).toBeDisabled();
    mocks.falhar = false; fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar rascunho" })).toBeEnabled());
    expect(mocks.upload).toHaveBeenCalledTimes(4);
  });
  it("arquivo inválido não entra e arrastar vários arquivos mantém a seleção", async () => {
    const input = await abrirStories();
    const label = input.closest("label");
    if (!label) throw new Error("Campo de mídia não encontrado");
    fireEvent.drop(label, { dataTransfer: { files: [foto("z.jpg"), new File(["x"], "ruim.gif", { type: "image/gif" }), foto("a.jpg")] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar rascunho" })).toBeEnabled());
    expect(mocks.upload.mock.calls.map((c) => c[0].name)).toEqual(["z.jpg", "a.jpg"]);
    fireEvent.click(screen.getByRole("button", { name: "Remover story 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() => expect(mocks.salvar).toHaveBeenCalledTimes(1));
    expect(mocks.salvar.mock.calls[0][1].p.midia_urls).toEqual(["https://example.invalid/a.jpg"]);
  });
});