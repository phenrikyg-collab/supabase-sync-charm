import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BalaoMensagem } from "@/pages/Atendimento";
import type { ComponentProps } from "react";

const montar = (mensagem: Record<string, unknown>) => {
  const responder = vi.fn();
  const menu = vi.fn();
  const props: ComponentProps<typeof BalaoMensagem> = {
    nomeCliente: "Mariana",
    m: { id: 42, direcao: "entrada", conteudo: "Olá", tipo: "texto", ...mensagem } as ComponentProps<typeof BalaoMensagem>["m"],
    divisorKora: false,
    divisorProprio: false,
    destacado: false,
    menuAberto: false,
    toqueRef: { current: { x: 0, y: 0, timer: null } },
    onRegistrarRef: vi.fn(),
    onResponder: responder,
    onCopiar: vi.fn(),
    onAbrirMenu: menu,
    onIrParaMensagem: vi.fn(),
    onReenviar: vi.fn(),
    onDescartar: vi.fn(),
    onEnviarTemplate: vi.fn(),
    onDesfazer: vi.fn(),
    onExcluir: vi.fn(),
  };
  const view = render(<BalaoMensagem {...props} />);
  return { ...view, props, responder, menu };
};

describe("resposta a uma mensagem do Atendimento", () => {
  afterEach(() => vi.useRealTimers());

  it.each(["entrada", "saida"] as const)("permite responder à mensagem de %s quando há wamid", (direcao) => {
    const { responder } = montar({ wamid: "wamid.123", direcao });
    fireEvent.click(screen.getByRole("button", { name: "Responder" }));
    expect(responder).toHaveBeenCalledWith(expect.objectContaining({ id: 42, direcao }));
  });

  it("não oferece Responder sem wamid, mesmo quando o menu está aberto", () => {
    const { rerender, props } = montar({ wamid: null });
    expect(screen.queryByRole("button", { name: "Responder" })).not.toBeInTheDocument();
    rerender(<BalaoMensagem {...props} menuAberto />);
    expect(screen.queryByRole("button", { name: "Responder" })).not.toBeInTheDocument();
  });

  it("abre o menu no toque longo e responde à mensagem da cliente", () => {
    vi.useFakeTimers();
    const { menu, responder, rerender, props } = montar({ wamid: "wamid.123" });
    fireEvent.touchStart(screen.getByText("Olá"), { touches: [{ clientX: 20, clientY: 20 }] });
    act(() => vi.advanceTimersByTime(500));
    expect(menu).toHaveBeenCalledWith("42");
    rerender(<BalaoMensagem {...props} menuAberto />);
    fireEvent.click(screen.getAllByRole("button", { name: "Responder" })[1]);
    expect(responder).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
  });

  it("mostra a citação de mídia recebida com o rótulo em vez de texto", () => {
    montar({ wamid: "wamid.456", citada_id: 5, citada_direcao: "saida", citada_tipo: "video", citada_texto: "Legenda", citada_media_url: null });
    expect(screen.getByText("Vídeo")).toBeInTheDocument();
    expect(screen.getByText("Você")).toBeInTheDocument();
  });
});