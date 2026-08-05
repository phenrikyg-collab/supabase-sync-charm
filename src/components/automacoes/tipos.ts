import { Zap, Clock, Mail, MessageSquare, Tag, GitBranch, Flag, type LucideIcon } from "lucide-react";

export type TipoNo =
  | "gatilho"
  | "espera"
  | "enviar_email"
  | "enviar_whatsapp"
  | "aplicar_tag"
  | "condicao"
  | "fim";

export type NoData = {
  tipo: TipoNo;
  config: Record<string, any>;
  gatilhoTipo?: string | null;
  gatilhoConfig?: Record<string, any> | null;
};

export const TIPOS_NO: Record<
  TipoNo,
  { label: string; icon: LucideIcon; cor: string; descricao: string; configPadrao: Record<string, any> }
> = {
  gatilho: {
    label: "Gatilho",
    icon: Zap,
    cor: "text-warning",
    descricao: "Ponto de partida do fluxo",
    configPadrao: {},
  },
  espera: {
    label: "Espera",
    icon: Clock,
    cor: "text-info",
    descricao: "Aguarda um tempo antes de seguir",
    configPadrao: { dias: 1, horas: 0 },
  },
  enviar_email: {
    label: "Enviar e-mail",
    icon: Mail,
    cor: "text-primary",
    descricao: "Dispara um e-mail para a cliente",
    configPadrao: { assunto: "", corpo: "" },
  },
  enviar_whatsapp: {
    label: "Enviar WhatsApp",
    icon: MessageSquare,
    cor: "text-success",
    descricao: "Envia mensagem no WhatsApp",
    configPadrao: { mensagem: "" },
  },
  aplicar_tag: {
    label: "Aplicar tag",
    icon: Tag,
    cor: "text-accent-foreground",
    descricao: "Marca a conversa com uma tag",
    configPadrao: { tag_id: null },
  },
  condicao: {
    label: "Condição",
    icon: GitBranch,
    cor: "text-warning",
    descricao: "Divide o fluxo em sim / não",
    configPadrao: { campo: "segmento_rfm", operador: "=", valor: "" },
  },
  fim: {
    label: "Fim",
    icon: Flag,
    cor: "text-muted-foreground",
    descricao: "Encerra o fluxo",
    configPadrao: {},
  },
};

export const TIPOS_ARRASTAVEIS: TipoNo[] = [
  "espera",
  "enviar_email",
  "enviar_whatsapp",
  "aplicar_tag",
  "condicao",
  "fim",
];

export const SEGMENTOS_RFM = [
  "Campeões",
  "Fiéis",
  "Potenciais Fiéis",
  "Novos Clientes",
  "Promissores",
  "Precisam de Atenção",
  "Em Risco",
  "Não Posso Perder",
  "Hibernando",
  "Perdidos",
];

export const GATILHOS: Record<string, string> = {
  rfm_segmento: "Segmento RFM",
  dias_sem_comprar: "Dias sem comprar",
  aniversario: "Aniversário",
  manual: "Manual",
};

export function resumoGatilho(tipo?: string | null, config?: any) {
  const c = config ?? {};
  switch (tipo) {
    case "rfm_segmento":
      return `Segmento: ${c.segmento ?? "—"}`;
    case "dias_sem_comprar":
      return `${c.dias ?? "—"} dias sem comprar`;
    case "aniversario":
      return "No aniversário da cliente";
    case "manual":
      return "Disparo manual";
    default:
      return GATILHOS[tipo ?? ""] ?? "—";
  }
}

export function resumoNo(tipo: TipoNo, config: Record<string, any> = {}) {
  switch (tipo) {
    case "espera":
      return `${config.dias ?? 0}d ${config.horas ?? 0}h`;
    case "enviar_email":
      return config.assunto || "Sem assunto";
    case "enviar_whatsapp":
      return config.mensagem ? String(config.mensagem).slice(0, 40) : "Sem mensagem";
    case "aplicar_tag":
      return config.tag_nome ? String(config.tag_nome) : config.tag_id ? `Tag #${config.tag_id}` : "Sem tag";
    case "condicao":
      return `${config.campo ?? "?"} ${config.operador ?? ""} ${config.valor ?? ""}`;
    default:
      return "";
  }
}
