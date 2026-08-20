export const brl = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataBR = (d: string | null | undefined) => {
  if (!d) return "—";
  const iso = String(d).slice(0, 10);
  const p = iso.split("-");
  if (p.length !== 3) return String(d);
  return `${p[2]}/${p[1]}`;
};

export const dataBRCompleta = (d: string | null | undefined) => {
  if (!d) return "—";
  const iso = String(d).slice(0, 10);
  const p = iso.split("-");
  if (p.length !== 3) return String(d);
  return `${p[2]}/${p[1]}/${p[0]}`;
};

export const hojeISO = () => new Date().toISOString().slice(0, 10);

export const TIPO_LABEL: Record<string, string> = {
  adiantamento: "Adiant. 40%",
  saldo: "Saldo 60%",
  vt: "VT",
  va: "VA (Ticket)",
  cesta: "Cesta",
};

export const TIPOS_ORDEM = ["adiantamento", "saldo", "vt", "va", "cesta"];

export const competenciaLabel = (c: string | null | undefined) => {
  if (!c) return "—";
  const [a, m] = String(c).slice(0, 10).split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const idx = Number(m) - 1;
  return `${meses[idx] ?? m}/${a}`;
};

export const LOTE_STATUS: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  aprovado: { label: "Aprovado", className: "bg-blue-100 text-blue-700" },
  executando: { label: "Executando", className: "bg-amber-100 text-amber-700 animate-pulse" },
  concluido: { label: "Concluído", className: "bg-green-100 text-green-700" },
  concluido_com_falhas: { label: "Concluído com falhas", className: "bg-orange-100 text-orange-700" },
  cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground line-through" },
};

export const ITEM_STATUS: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  enviado: "bg-blue-100 text-blue-700",
  pago: "bg-green-100 text-green-700",
  falha: "bg-red-100 text-red-700",
};
