import { supabase } from "@/integrations/supabase/client";

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Primeiro nome, sem acentos e sem caracteres inválidos para nome de arquivo. */
export const primeiroNome = (nome: string | null | undefined) =>
  semAcento(String(nome ?? "Funcionario").trim().split(/\s+/)[0] || "Funcionario")
    .replace(/[^a-zA-Z0-9_-]/g, "");

/** "MM_AAAA" a partir de uma competência ISO (YYYY-MM-DD). */
export const mesTag = (competencia: string | null | undefined) => {
  const c = String(competencia ?? "").slice(0, 10);
  const [ano, mes] = c.split("-");
  if (!ano || !mes) return "00_0000";
  return `${mes}_${ano}`;
};

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
