import { describe, expect, it } from "vitest";
import { executarComLimite, prepararLote } from "@/lib/stories";

const f = (n: string, t = 0) => new File(["x"], n, { type: "image/jpeg", lastModified: t });

describe("lote de mídias dos stories", () => {
  it("aceita no máximo 10 e avisa quando passou", () => {
    const r = prepararLote(Array.from({ length: 12 }, (_, i) => f(`foto${i + 1}.jpg`)));
    expect(r.aceitos).toHaveLength(10);
    expect(r.excedeu).toBe(true);
    expect(r.aceitos[9].name).toBe("foto10.jpg");
  });
  it("ordem da seleção mantém a entrada", () => {
    const r = prepararLote([f("b.jpg"), f("a10.jpg"), f("a2.jpg")], "selecao");
    expect(r.aceitos.map((x) => x.name)).toEqual(["b.jpg", "a10.jpg", "a2.jpg"]);
  });
  it("data ordena da mais antiga para a mais nova", () => {
    const r = prepararLote([f("a.jpg", 300), f("b.jpg", 100), f("c.jpg", 200)], "data");
    expect(r.aceitos.map((x) => x.name)).toEqual(["b.jpg", "c.jpg", "a.jpg"]);
  });
  it("corta em 10 depois de ordenar", () => {
    const lista = Array.from({ length: 12 }, (_, i) => f(`f${i}.jpg`, 100 - i));
    const r = prepararLote(lista, "data");
    expect(r.aceitos[0].name).toBe("f11.jpg");
    expect(r.aceitos.map((x) => x.name)).not.toContain("f0.jpg");
  });
  it("ordena pelo nome do arquivo", () => {
    const r = prepararLote([f("b.jpg"), f("a2.jpg"), f("a10.jpg")], "nome");
    expect(r.aceitos.map((x) => x.name)).toEqual(["a2.jpg", "a10.jpg", "b.jpg"]);
    expect(r.excedeu).toBe(false);
  });
  it("roda no máximo 3 ao mesmo tempo e continua após falha", async () => {
    let ativos = 0, pico = 0; const feitos: number[] = [];
    await executarComLimite([1, 2, 3, 4, 5, 6], 3, async (n) => {
      ativos++; pico = Math.max(pico, ativos);
      await new Promise((r) => setTimeout(r, 5));
      ativos--;
      if (n === 2) throw new Error("x");
      feitos.push(n);
    });
    expect(pico).toBe(3);
    expect(feitos.sort()).toEqual([1, 3, 4, 5, 6]);
  });
});
