import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/lib/supabaseRpc", () => ({ chamarRpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() }, storage: { from: vi.fn() } } }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
import { chamarRpc } from "@/lib/supabaseRpc";
import { InboxEmail, totalNaoLidasEmail } from "@/components/atendimento/InboxEmail";

const thread = {
  id: 12, caixa_id: 1, caixa: "SAC", caixa_endereco: "sac@example.com", assunto: "Pedido 123",
  cliente_email: "cliente@example.com", cliente_nome: "Cliente teste", status: "aberta", nao_lida: true,
  responsavel: null, ultima_mensagem_em: "2026-10-09T01:00:00Z", qtd_mensagens: 1,
  previa: "Dúvida", ultima_direcao: "entrada", categoria: "cliente", categoria_motivo: "Pedido encontrado", e_cliente: true,
};
const message = {
  id: 23, direcao: "entrada", corpo_html_limpo: "<p>Texto novo</p><script>alert(1)</script>", corpo_texto_limpo: "Texto novo",
  corpo_html: "<p>Texto novo</p><blockquote>Conteúdo citado</blockquote>", corpo_texto: "Texto novo Conteúdo citado",
  data_email: "2026-10-09T01:00:00Z", de: "cliente@example.com", anexos: [],
};
let currentThread = { ...thread };
let currentMessage = { ...message };
const clients: QueryClient[] = [];
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><TooltipProvider><InboxEmail /></TooltipProvider></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); currentThread = { ...thread }; currentMessage = { ...message };
  vi.mocked(chamarRpc).mockImplementation(async (name) => ({
    data: name === "inbox_email_caixas" ? [{ id: 1, endereco: "sac@example.com", rotulo: "SAC", abertas: 2, nao_lidas: 2, nao_lidas_outros: 8 }]
      : name === "inbox_email_listar" ? [currentThread]
      : name === "inbox_email_abrir" ? { thread: currentThread, mensagens: [currentMessage] }
      : currentThread,
    error: null,
  }));
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); });

describe("Inbox E-mail", () => {
  it("conta apenas não lidas importantes no menu", () => {
    expect(totalNaoLidasEmail([{ id: 1, endereco: "sac@example.com", rotulo: "SAC", abertas: 10, nao_lidas: 2, nao_lidas_outros: 8 }])).toBe(2);
  });
  it("envia importantes por padrão e categoria específica nos subfiltros", async () => {
    mount();
    await waitFor(() => expect(chamarRpc).toHaveBeenCalledWith("inbox_email_listar", expect.objectContaining({ p_categoria: "importantes" })));
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Outros/ }), { button: 0, ctrlKey: false });
    await waitFor(() => expect(chamarRpc).toHaveBeenCalledWith("inbox_email_listar", expect.objectContaining({ p_categoria: "outros" })));
    fireEvent.click(screen.getByRole("button", { name: "Sistemas" }));
    await waitFor(() => expect(chamarRpc).toHaveBeenCalledWith("inbox_email_listar", expect.objectContaining({ p_categoria: "sistema" })));
  });
  it("filtra códigos de acesso dentro de Importantes", async () => {
    mount();
    await waitFor(() => expect(chamarRpc).toHaveBeenCalledWith("inbox_email_listar", expect.objectContaining({ p_categoria: "importantes" })));
    fireEvent.click(screen.getByRole("button", { name: "Códigos de acesso" }));
    await waitFor(() => expect(chamarRpc).toHaveBeenCalledWith("inbox_email_listar", expect.objectContaining({ p_categoria: "acesso" })));
    fireEvent.click(screen.getByRole("button", { name: "Códigos de acesso" }));
    await waitFor(() => expect(chamarRpc).toHaveBeenCalledWith("inbox_email_listar", expect.objectContaining({ p_categoria: "importantes" })));
  });
  it("mostra selo de código de acesso e não mostra o de cliente", async () => {
    currentThread = { ...thread, categoria: "acesso", e_cliente: false, assunto: "Código de verificação" };
    mount();
    expect(await screen.findByText("Código de acesso")).toBeInTheDocument();
    expect(screen.queryByText("Cliente")).toBeNull();
  });
  it("não mostra selo de categoria em conversas de contato", async () => {
    currentThread = { ...thread, categoria: "contato", e_cliente: false };
    mount();
    await screen.findByRole("button", { name: /Cliente teste/ });
    expect(screen.queryByText("Código de acesso")).toBeNull();
    expect(screen.queryByText("Cliente")).toBeNull();
  });
  it("usa texto novo sanitizado e alterna para o corpo completo", async () => {
    const view = mount(); fireEvent.click(await screen.findByRole("button", { name: /Cliente teste/ }));
    await screen.findByText("Texto novo");
    expect(screen.queryByText("Conteúdo citado")).toBeNull();
    expect(view.container.querySelector("script")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar histórico" }));
    expect(screen.getByText("Conteúdo citado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar histórico" }));
    expect(screen.queryByText("Conteúdo citado")).toBeNull();
  });
  it("usa corpo completo quando os campos limpos são nulos", async () => {
    currentMessage = { ...message, corpo_html_limpo: null, corpo_texto_limpo: null } as unknown as typeof message;
    mount(); fireEvent.click(await screen.findByRole("button", { name: /Cliente teste/ }));
    expect(await screen.findByText("Conteúdo citado")).toBeInTheDocument();
  });
  it("move Outros para contato e passa categoria nula nas ações de status", async () => {
    currentThread = { ...thread, categoria: "spam" };
    mount(); fireEvent.click(await screen.findByRole("button", { name: /Cliente teste/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Mover para Importantes" }));
    await waitFor(() => expect(chamarRpc).toHaveBeenCalledWith("inbox_email_atualizar", { p_thread_id: 12, p_status: null, p_nao_lida: null, p_responsavel: null, p_categoria: "contato" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Arquivar" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Arquivar" }));
    await waitFor(() => expect(chamarRpc).toHaveBeenCalledWith("inbox_email_atualizar", { p_thread_id: 12, p_status: "arquivada", p_nao_lida: null, p_responsavel: null, p_categoria: null }));
  });
});