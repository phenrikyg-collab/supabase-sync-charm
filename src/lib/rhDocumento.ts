import { supabase } from "@/integrations/supabase/client";

/** Primeira palavra do nome: primeira letra maiúscula, resto minúsculo, sem acento/espaço/caracteres especiais. */
export const slug = (nome: string | null | undefined) => {
  const p = String(nome ?? "Funcionario")
    .trim()
    .split(/\s+/)[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "");
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

/** "MM_AAAA" a partir de uma competência ISO (YYYY-MM-DD). */
export const mesTag = (competencia: string | null | undefined) => {
  const c = String(competencia ?? "").slice(0, 10);
  const [ano, mes] = c.split("-");
  if (!ano || !mes) return "00_0000";
  return `${mes}_${ano}`;
};

/** Nome de arquivo individual: {PrimeiroNome}_{DOCUMENTO}_{MM}_{AAAA}.pdf */
export const nomeArquivo = (
  nome: string | null | undefined,
  documento: string,
  competencia: string | null | undefined,
) => `${slug(nome)}_${documento}_${mesTag(competencia)}.pdf`;

/** Nome de arquivo coletivo (vários funcionários no mesmo PDF). */
export const nomeArquivoColetivo = (
  documento: string,
  competencia: string | null | undefined,
) => `${documento}_${mesTag(competencia)}.pdf`;

export type TipoHoleriteRh = "adiantamento" | "fechamento" | "vt" | "va";

/** Prefixo do documento para holerites/recibos individuais. */
export const prefixoHolerite = (tipo: TipoHoleriteRh) => {
  if (tipo === "vt") return "RECIBO_VT";
  if (tipo === "va") return "RECIBO_VA";
  return `HOLERITE_${tipo.toUpperCase()}`;
};

/** Prefixo do documento para comprovantes (o tipo do pagamento). */
export const prefixoComprovante = (tipo: TipoHoleriteRh) => {
  if (tipo === "fechamento") return "COMPROVANTE_SALDO";
  return `COMPROVANTE_${tipo.toUpperCase()}`;
};

/** Prefixo para PDFs coletivos de holerites/recibos. */
export const prefixoHoleriteColetivo = (tipo: TipoHoleriteRh) => {
  if (tipo === "vt") return "RECIBOS_VT";
  if (tipo === "va") return "RECIBOS_VA";
  return `HOLERITES_${tipo.toUpperCase()}`;
};

/** Primeiro nome, sem acentos e sem caracteres inválidos para nome de arquivo. @deprecated use slug() */
export const primeiroNome = (nome: string | null | undefined) =>
  slug(nome);

/**
 * Baixa um PDF gerado pela edge function `rh-documento`.
 * O nome do arquivo é montado no front (a function invoke não expõe headers).
 */
export async function baixarDocumentoRh(
  tipo: "comprovante" | "holerite",
  id: string,
  nomeArquivo: string,
) {
  const { data, error } = await supabase.functions.invoke("rh-documento", {
    body: { tipo, id },
  });
  if (error) throw new Error(error.message || "Falha ao gerar o PDF");
  if (!data) throw new Error("A função não retornou nenhum documento.");

  const blob =
    data instanceof Blob ? data : new Blob([data as any], { type: "application/pdf" });
  if (blob.size === 0) throw new Error("Documento vazio retornado pela função.");

  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: nomeArquivo.endsWith(".pdf") ? nomeArquivo : `${nomeArquivo}.pdf`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
