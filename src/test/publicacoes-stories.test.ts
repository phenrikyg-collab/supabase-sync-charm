import { describe, expect, it } from "vitest";
import { salvarPublicacoesStories } from "@/lib/publicacoesStories";
import { validarMidia, validarDuracao } from "@/lib/stories";

const midias = [{ key: "a", url: "a.jpg" }, { key: "b", url: "b.mp4" }, { key: "c", url: "c.jpg" }];
describe("stories no modal de publicação", () => {
  it("salva uma linha por mídia e copia os campos compartilhados", async () => {
    const enviados: Record<string, unknown>[] = [];
    await salvarPublicacoesStories({ produto_ids: ["1305"], marcar_produtos: true, legenda: "Peças", modo_resposta: "sombra" }, midias, null, async (p) => { enviados.push(p); });
    expect(enviados).toHaveLength(3);
    expect(enviados.map((p) => p.midia_urls)).toEqual([["a.jpg"], ["b.mp4"], ["c.jpg"]]);
    for (const p of enviados) expect(p).toMatchObject({ tipo: "STORIES", produto_ids: ["1305"], marcar_produtos: true, legenda: "Peças", modo_resposta: "sombra" });
  });
  it("agenda os stories com um minuto de diferença", async () => {
    const datas: unknown[] = [];
    await salvarPublicacoesStories({}, midias, "2026-10-17T12:00:00.000Z", async (p) => { datas.push(p.agendado_para); expect(p.status).toBe("agendado"); });
    expect(datas).toEqual(["2026-10-17T12:00:00.000Z", "2026-10-17T12:01:00.000Z", "2026-10-17T12:02:00.000Z"]);
  });
  it("sem data salva rascunhos sequencialmente na ordem escolhida", async () => {
    const concluidos: string[] = [];
    await salvarPublicacoesStories({}, midias, null, async (p, m) => { expect(concluidos.length).toBe(midias.findIndex((i) => i.key === m.key)); await Promise.resolve(); expect(p.status).toBe("rascunho"); expect(p.agendado_para).toBeNull(); concluidos.push(m.key); });
    expect(concluidos).toEqual(["a", "b", "c"]);
  });
  it("reutiliza a chave da mídia ao repetir o salvamento", async () => {
    const chaves: unknown[] = [];
    for (let i = 0; i < 2; i++) await salvarPublicacoesStories({}, midias, null, async (p) => { chaves.push(p.chave_salvamento); });
    expect(chaves).toEqual(["a", "b", "c", "a", "b", "c"]);
  });
  it("JPEG aceita 8 MB e recusa acima", () => {
    expect(validarMidia(new File([new Uint8Array(8 * 1024 * 1024)], "foto.jpg", { type: "image/jpeg" })).ok).toBe(true);
    expect(validarMidia(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "foto.jpg", { type: "image/jpeg" })).ok).toBe(false);
  });
  it("vídeo aceita 100 MB e recusa acima", () => {
    expect(validarMidia(new File([new Uint8Array(100 * 1024 * 1024)], "video.mp4", { type: "video/mp4" })).ok).toBe(true);
    expect(validarMidia(new File([new Uint8Array(100 * 1024 * 1024 + 1)], "video.mp4", { type: "video/mp4" })).ok).toBe(false);
  });
  it("vídeo aceita de 3 a 60 segundos", () => {
    expect(validarDuracao(3).ok).toBe(true); expect(validarDuracao(60).ok).toBe(true);
    expect(validarDuracao(2).ok).toBe(false); expect(validarDuracao(61).ok).toBe(false);
  });
});