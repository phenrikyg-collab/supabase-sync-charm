export type MidiaPublicacaoStory = { key: string; url: string };

/** Uma chamada por mídia, em sequência, preserva também a ordem de criação dos rascunhos. */
export async function salvarPublicacoesStories(
  base: Record<string, unknown>,
  midias: MidiaPublicacaoStory[],
  agendadoPara: string | null,
  salvar: (payload: Record<string, unknown>, midia: MidiaPublicacaoStory) => Promise<void>,
) {
  for (const [indice, midia] of midias.entries()) {
    await salvar({
      ...base,
      tipo: "STORIES",
      chave_salvamento: midia.key,
      midia_urls: [midia.url],
      agendado_para: agendadoPara ? new Date(new Date(agendadoPara).getTime() + indice * 60_000).toISOString() : null,
      status: agendadoPara ? "agendado" : "rascunho",
    }, midia);
  }
}

export function mensagemStoriesSalvos(quantidade: number, agendadoPara: string | null) {
  if (!agendadoPara) return `${quantidade} stories salvos como rascunho`;
  const inicio = new Date(agendadoPara);
  const fim = new Date(inicio.getTime() + (quantidade - 1) * 60_000);
  const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${quantidade} stories agendados de ${hora(inicio)} a ${hora(fim)}`;
}