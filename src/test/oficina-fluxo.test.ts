import { describe, expect, it } from "vitest";
import { agruparOps, pecasCortadas, somaMetragem, totalPorTamanho, valorOp } from "@/lib/oficinaFluxo";

describe("fluxo corte -> OP -> pagamento", () => {
  const grade = [
    { produto_id: "a", cor_id: "preto", tamanho: "P", quantidade: pecasCortadas(2, 10) },
    { produto_id: "a", cor_id: "preto", tamanho: "M", quantidade: pecasCortadas(3, 10) },
    { produto_id: "a", cor_id: "off", tamanho: "P", quantidade: pecasCortadas(1, 5) },
    { produto_id: "b", cor_id: "preto", tamanho: "M", quantidade: 0 },
  ];
  it("multiplica grade por folhas e soma por tamanho", () => {
    expect(totalPorTamanho(grade)).toEqual({ P: 25, M: 30 });
  });
  it("gera uma OP por produto + cor, ignorando zero", () => {
    expect(agruparOps(grade)).toEqual([
      { produto_id: "a", cor_id: "preto", quantidade: 50 },
      { produto_id: "a", cor_id: "off", quantidade: 5 },
    ]);
  });
  it("soma metragem dos rolos", () => {
    expect(somaMetragem([{ metragem_utilizada: 10.5 }, { metragem_utilizada: 4.5 }])).toBe(15);
  });
  it("paga pelas peças entregues quando houver", () => {
    expect(valorOp({ quantidade_entregue: 48, quantidade: 50 }, 3)).toBe(144);
    expect(valorOp({ quantidade: 50 }, 3)).toBe(150);
  });
});
