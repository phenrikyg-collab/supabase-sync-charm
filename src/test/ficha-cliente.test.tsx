import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FichaCliente, type RespostaFicha } from "@/components/atendimento/FichaCliente";
import { chamarRpc } from "@/lib/supabaseRpc";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { toast } from "sonner";

vi.mock("@/lib/supabaseRpc", () => ({ chamarRpc: vi.fn() }));
vi.mock("@/lib/edgeFunctions", () => ({ invokeEdgeFunction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const dados: RespostaFicha = {
  ficha: { resumo: "Escolheu vestido verde M", bola_com: "loja", pecas: [{ produto: "Vestido", cor: "Verde", tamanho: "M", qtd: 2 }], pendencia_da_loja: "Confirmar estoque", proximo_passo: "Enviar proposta", nao_perguntar_de_novo: ["Tamanho M"], confusao: "Duas cores citadas" },
  gerada_em: new Date().toISOString(), desatualizada: true,
};
function montar(id: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const arvore = (conversa: number) => <QueryClientProvider client={client}><FichaCliente conversaId={conversa} /></QueryClientProvider>;
  return { ...render(arvore(id)), arvore, client };
}
/** A ficha abre recolhida: o conteúdo só aparece depois de clicar no título. */
async function abrir() {
  fireEvent.click(await screen.findByRole("button", { name: "Ficha da cliente" }));
}
beforeEach(() => vi.resetAllMocks());

describe("Ficha da cliente", () => {
  it("abre recolhida, consulta a conversa e mostra o conteúdo ao expandir", async () => {
    vi.mocked(chamarRpc).mockResolvedValue({ data: dados, error: null });
    const { client } = montar(42);
    expect(screen.queryByText(dados.ficha?.resumo ?? "")).not.toBeInTheDocument();
    abrir();
    await screen.findByText(dados.ficha?.resumo ?? "");
    expect(chamarRpc).toHaveBeenCalledWith("whatsapp_ficha", { p_conversa: 42 });
    const query = client.getQueryCache().getAll()[0];
    expect(query.options).toMatchObject({ refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
    expect(chamarRpc).toHaveBeenCalledTimes(1);
  });
  it("gera ficha com a conversa atual e lê novamente após terminar", async () => {
    vi.mocked(chamarRpc).mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: dados, error: null });
    let terminar: ((value: object) => void) | undefined;
    vi.mocked(invokeEdgeFunction).mockImplementation(() => new Promise((resolve) => { terminar = resolve; }));
    montar(43);
    fireEvent.click(await screen.findByRole("button", { name: "Gerar ficha" }));
    await waitFor(() => expect(invokeEdgeFunction).toHaveBeenCalledWith("whatsapp-ficha-lead", { conversa_id: 43 }));
    expect(screen.getByRole("button", { name: "Gerar ficha" })).toBeDisabled();
    expect(chamarRpc).toHaveBeenCalledTimes(1);
    terminar?.({});
    abrir();
    await screen.findByText(dados.ficha?.resumo ?? "");
    expect(chamarRpc).toHaveBeenCalledTimes(2);
  });
  it("recarrega e abre a ficha ao trocar de conversa sem mostrar dados anteriores", async () => {
    vi.mocked(chamarRpc).mockResolvedValueOnce({ data: dados, error: null }).mockResolvedValueOnce({ data: { ficha: { resumo: "Outra cliente" } }, error: null });
    const { rerender, arvore } = montar(44);
    abrir();
    await screen.findByText(dados.ficha?.resumo ?? "");
    rerender(arvore(45));
    expect(screen.queryByText("Outra cliente")).not.toBeInTheDocument();
    abrir();
    await screen.findByText("Outra cliente");
    expect(screen.queryByText(dados.ficha?.resumo ?? "")).not.toBeInTheDocument();
    expect(chamarRpc).toHaveBeenLastCalledWith("whatsapp_ficha", { p_conversa: 45 });
  });
  it("mantém a ficha existente quando a geração falha", async () => {
    vi.mocked(chamarRpc).mockResolvedValue({ data: dados, error: null });
    vi.mocked(invokeEdgeFunction).mockRejectedValue(new Error("Falha na geração"));
    montar(46);
    abrir();
    fireEvent.click(await screen.findByRole("button", { name: "Atualizar ficha" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha na geração"));
    expect(chamarRpc).toHaveBeenCalledTimes(1);
    expect(screen.getByText(dados.ficha?.resumo ?? "")).toBeInTheDocument();
  });
});
