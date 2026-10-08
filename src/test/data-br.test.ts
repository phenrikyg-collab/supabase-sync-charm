import { describe, expect, it } from "vitest";
import { formatarData, formatarDataHora } from "@/lib/dataBr";

describe("datas brasileiras de Avaliações", () => {
  it("exibe 6 de outubro de 2026 como 06/10/2026", () => {
    expect(formatarData("2026-10-06T15:00:00Z")).toBe("06/10/2026");
  });
  it("mantém 21h de São Paulo no dia 6 apesar de UTC já ser dia 7", () => {
    expect(formatarData("2026-10-07T00:00:00Z")).toBe("06/10/2026");
    expect(formatarDataHora("2026-10-07T00:00:00Z")).toBe("06/10/2026 21:00");
  });
  it("preserva o dia civil de campos DATE", () => {
    expect(formatarData("2026-10-06")).toBe("06/10/2026");
  });
  it("formata timestamps com offset ou sem fuso como dados UTC", () => {
    expect(formatarDataHora("2026-10-06T21:00:00-03:00")).toBe("06/10/2026 21:00");
    expect(formatarDataHora("2026-10-07 00:00:00")).toBe("06/10/2026 21:00");
  });
  it.each([null, undefined, "", "   ", "inválida"])("não quebra com valor vazio ou inválido: %s", (valor) => {
    expect(formatarData(valor)).toBe("-");
    expect(formatarDataHora(valor)).toBe("-");
  });
});