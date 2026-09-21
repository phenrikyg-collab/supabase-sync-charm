export const ETAPAS_FUNIL_WHATSAPP = [
  {
    nome: "Novo Lead",
    ordem: 1,
    cor: "muted",
    topoClassName: "border-t-muted-foreground/40",
    badgeClassName: "bg-muted text-muted-foreground border-border",
  },
  {
    nome: "Carrinho Abandonado",
    ordem: 2,
    cor: "warning",
    topoClassName: "border-t-warning/70",
    badgeClassName: "bg-warning/10 text-warning border-warning/20",
  },
  {
    nome: "Negociando",
    ordem: 3,
    cor: "primary",
    topoClassName: "border-t-primary/60",
    badgeClassName: "bg-primary/10 text-primary border-primary/20",
  },
  {
    nome: "Aguardando Pagamento",
    ordem: 4,
    cor: "#0EA5E9",
    topoClassName: "border-t-funil-pagamento/70",
    badgeClassName: "bg-funil-pagamento/10 text-funil-pagamento border-funil-pagamento/20",
  },
  {
    nome: "Fechado",
    ordem: 5,
    cor: "success",
    topoClassName: "border-t-success/70",
    badgeClassName: "bg-success/10 text-success border-success/20",
  },
  {
    nome: "Perdido",
    ordem: 6,
    cor: "danger",
    topoClassName: "border-t-danger/70",
    badgeClassName: "bg-danger/10 text-danger border-danger/20",
  },
] as const;

export type EtapaFunilWhatsApp = (typeof ETAPAS_FUNIL_WHATSAPP)[number]["nome"];

export const ETAPAS_FUNIL_WHATSAPP_NOMES = ETAPAS_FUNIL_WHATSAPP.map((etapa) => etapa.nome);

export const ETAPAS_FINAIS_FUNIL_WHATSAPP = ["Fechado", "Perdido"] as const;

export function normalizarEtapaFunil(valor: string | null | undefined) {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function etapaFunilWhatsappPorNome(valor: string | null | undefined) {
  const normalizado = normalizarEtapaFunil(valor);
  return ETAPAS_FUNIL_WHATSAPP.find((etapa) => normalizarEtapaFunil(etapa.nome) === normalizado) ?? null;
}

export function ehEtapaFinalFunilWhatsapp(valor: string | null | undefined) {
  const normalizado = normalizarEtapaFunil(valor);
  return ETAPAS_FINAIS_FUNIL_WHATSAPP.some((etapa) => normalizarEtapaFunil(etapa) === normalizado);
}