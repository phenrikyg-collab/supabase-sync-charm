import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const estado = vi.hoisted(() => ({
  preferencia: "troca", status: "em_transito", encerrada: false, erro: "", correios: "",
  toast: vi.fn(), aoMudar: vi.fn(), rpc: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: estado.toast }) }));
vi.mock("@/components/reversa/AcoesTroca", () => ({ AcoesTroca: () => null }));
vi.mock("@/components/reversa/EscolhaPecaTroca", () => ({ EscolhaPecaTroca: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: estado.rpc } }));
import { PainelSolicitacao } from "@/components/reversa/PainelSolicitacao";
import { motivoEncerramentoValido, podeEncerrarTroca } from "@/lib/reversaPainel";

const motivos = [{ codigo: "resolucao_nova", rotulo: "Motivo vindo do servidor" }, { codigo: "outro", rotulo: "Outro (descrever)" }];
function detalhe() {
  return { id: "s1", protocolo: 10062, preferencia: estado.preferencia, status: estado.encerrada ? "concluida" : estado.status,
    cliente: { documento: "12345678901" }, itens: [], eventos: [], correios: estado.correios,
    encerramento: estado.encerrada ? { motivo: "outro", motivo_rotulo: "Outro (descrever)", detalhe: "Resolvido", em_br: "16/10/2026", por: "Equipe" } : null };
}
beforeEach(() => {
  Object.assign(estado, { preferencia: "troca", status: "em_transito", encerrada: false, erro: "", correios: "" });
  vi.clearAllMocks();
  estado.rpc.mockImplementation(async (nome: string) => {
    if (nome === "reversa_encerrar_motivos") return { data: motivos, error: null };
    if (nome === "reversa_encerrar") {
      if (estado.erro) return { data: null, error: { message: estado.erro } };
      estado.encerrada = true;
    }
    return { data: detalhe(), error: null };
  });
});
function montar() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><PainelSolicitacao id="s1" aberto aoFechar={() => {}} aoMudar={estado.aoMudar} /></MemoryRouter>
  </QueryClientProvider>);
}
async function abrir() {
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Encerrar troca" }));
  const dialogo = await screen.findByRole("dialog", { name: "Encerrar troca do protocolo 10062" });
  await within(dialogo).findByRole("radio", { name: "Outro (descrever)" });
  return within(dialogo);
}
describe("regras de encerramento da troca", () => {
  it.each(["concluida", "cancelada", "recusada"])("não permite status %s", (status) => {
    expect(podeEncerrarTroca("troca", status)).toBe(false);
  });
  it.each(["aguardando_postagem", "em_transito", "recebida", "etapa_futura"])("permite troca em %s", (status) => {
    expect(podeEncerrarTroca("troca", status)).toBe(true);
  });
  it("não permite outra preferência", () => {
    expect(podeEncerrarTroca("reembolso", "em_transito")).toBe(false);
  });
  it("exige motivo da RPC e detalhe apenas em outro", () => {
    expect(motivoEncerramentoValido(motivos, "", "")).toBe(false);
    expect(motivoEncerramentoValido(motivos, "inexistente", "x")).toBe(false);
    expect(motivoEncerramentoValido(motivos, "outro", "  ")).toBe(false);
    expect(motivoEncerramentoValido(motivos, "outro", "Resolvido")).toBe(true);
    expect(motivoEncerramentoValido(motivos, "resolucao_nova", "")).toBe(true);
  });
  it("carrega motivos dinâmicos e encerra com detalhe, recarregando solicitação e lista", async () => {
    const d = await abrir();
    expect(d.getByRole("button", { name: "Encerrar" })).toBeDisabled();
    fireEvent.click(d.getByRole("radio", { name: "Outro (descrever)" }));
    expect(d.getByRole("button", { name: "Encerrar" })).toBeDisabled();
    fireEvent.change(d.getByLabelText(/Detalhe/), { target: { value: "Resolvido" } });
    fireEvent.click(d.getByRole("button", { name: "Encerrar" }));
    await waitFor(() => expect(estado.rpc).toHaveBeenCalledWith("reversa_encerrar", { p_id: "s1", p_motivo: "outro", p_detalhe: "Resolvido" }));
    await waitFor(() => expect(estado.aoMudar).toHaveBeenCalledOnce());
    expect(estado.rpc.mock.calls.filter(([nome]) => nome === "reversa_painel_detalhe")).toHaveLength(2);
    expect(estado.encerrada).toBe(true);
    expect(screen.queryByRole("button", { name: "Encerrar troca" })).toBeNull();
    expect(screen.getByText("Resolvido")).toBeTruthy();
  });
  it.each(["mantido_outro_protocolo_usa", "compartilhado_com_outro_protocolo"])("avisa código compartilhado: %s", async (correios) => {
    estado.correios = correios;
    const d = await abrir();
    fireEvent.click(d.getByRole("radio", { name: "Motivo vindo do servidor" }));
    fireEvent.click(d.getByRole("button", { name: "Encerrar" }));
    await waitFor(() => expect(estado.toast).toHaveBeenCalledWith({ title: "Troca encerrada", description: "O código dos Correios foi mantido porque outra solicitação usa a mesma caixa." }));
  });
  it("preserva diálogo e mensagem do Postgres no erro", async () => {
    estado.erro = "Solicitação não pode ser encerrada";
    const d = await abrir();
    fireEvent.click(d.getByRole("radio", { name: "Motivo vindo do servidor" }));
    fireEvent.click(d.getByRole("button", { name: "Encerrar" }));
    await waitFor(() => expect(estado.toast).toHaveBeenCalledWith({ title: "Não deu certo", description: estado.erro, variant: "destructive" }));
    expect(screen.getByRole("dialog", { name: "Encerrar troca do protocolo 10062" })).toBeTruthy();
    expect(estado.aoMudar).not.toHaveBeenCalled();
  });
});