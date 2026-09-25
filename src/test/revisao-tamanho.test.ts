import { describe, it, expect } from "vitest";
import { somaRevisao, diasUteisSegSab } from "@/lib/revisaoTamanho";
describe("revisão por tamanho", () => {
  it("soma aprovadas e reprovadas", () => {
    expect(somaRevisao([{ aprovadas: 10, reprovadas: 1 }, { aprovadas: 5, reprovadas: 0 }])).toEqual({ aprovadas: 15, reprovadas: 1, total: 16 });
  });
  it("conta dias úteis seg-sáb sem domingo", () => {
    expect(diasUteisSegSab("2026-09-19", "2026-09-21")).toBe(2); // sáb, dom, seg
  });
});
