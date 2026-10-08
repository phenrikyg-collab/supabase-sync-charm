const FUSO = "America/Sao_Paulo";

function lerData(valor: unknown): Date | null {
  if (valor === null || valor === undefined || valor === "") return null;
  let data: Date;
  if (valor instanceof Date) {
    data = valor;
  } else if (typeof valor === "string") {
    const texto = valor.trim();
    if (!texto) return null;
    // DATE é um dia civil, não um instante UTC à meia-noite.
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      data = new Date(`${texto}T12:00:00Z`);
    } else {
      // Timestamps sem offset vindos do banco também representam UTC.
      const iso = texto.replace(" ", "T");
      const semFuso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(iso);
      data = new Date(semFuso ? `${iso}Z` : iso);
    }
  } else if (typeof valor === "number") {
    data = new Date(valor);
  } else {
    return null;
  }
  return Number.isNaN(data.getTime()) ? null : data;
}

export function formatarData(valor: unknown): string {
  const data = lerData(valor);
  return data?.toLocaleDateString("pt-BR", {
    timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric",
  }) ?? "-";
}

export function formatarDataHora(valor: unknown): string {
  const data = lerData(valor);
  return data?.toLocaleString("pt-BR", {
    timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).replace(",", "") ?? "-";
}