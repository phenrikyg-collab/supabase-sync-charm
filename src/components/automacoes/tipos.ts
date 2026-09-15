import {
  Zap, Filter, GitBranch, Clock, Mail, MessageSquare, MessagesSquare, Tag, Flag,
  type LucideIcon,
} from "lucide-react";

export type TipoNo =
  | "gatilho"
  | "filtro"
  | "condicao"
  | "espera"
  | "enviar_email"
  | "whatsapp_template"
  | "whatsapp_janela"
  | "aplicar_tag"
  | "fim";

export type NoData = {
  tipo: TipoNo;
  rotulo?: string | null;
  config: Record<string, any>;
  bancoId?: number | string | null;
  gatilhoRotulo?: string | null;
  metricas?: any;
  comErro?: boolean;
  catalogo?: any;
};

export const TIPOS_NO: Record<
  TipoNo,
  { label: string; icon: LucideIcon; cor: string; descricao: string; configPadrao: Record<string, any> }
> = {
  gatilho: {
    label: "Gatilho",
    icon: Zap,
    cor: "text-warning",
    descricao: "Ponto de partida do fluxo.",
    configPadrao: {},
  },
  filtro: {
    label: "Filtro",
    icon: Filter,
    cor: "text-info",
    descricao: "Só segue quem passa. Quem não passa sai do fluxo.",
    configPadrao: { filtro: { e: [] } },
  },
  condicao: {
    label: "Condição",
    icon: GitBranch,
    cor: "text-warning",
    descricao: "Divide em sim e não.",
    configPadrao: { modo: "publico", filtro: { e: [] } },
  },
  espera: {
    label: "Espera",
    icon: Clock,
    cor: "text-info",
    descricao: "Aguarda um tempo ou um horário.",
    configPadrao: { dias: 1, horas: 0, minutos: 0 },
  },
  enviar_email: {
    label: "E-mail",
    icon: Mail,
    cor: "text-primary",
    descricao: "Envia um template de e-mail.",
    configPadrao: { template_id: null, cupom: "nao", incluir_pecas: true, respeitar_teto: true },
  },
  whatsapp_template: {
    label: "WhatsApp template",
    icon: MessageSquare,
    cor: "text-success",
    descricao: "Template aprovado pela Meta. Sai com ou sem janela aberta.",
    configPadrao: { template_id: null, variaveis: [], permite_fim_semana: false },
  },
  whatsapp_janela: {
    label: "WhatsApp janela aberta",
    icon: MessagesSquare,
    cor: "text-success",
    descricao: "Texto livre se a cliente falou nas últimas 24h. Senão, sai o template reserva.",
    configPadrao: { texto: "", template_id: null, variaveis: [], permite_fim_semana: false },
  },
  aplicar_tag: {
    label: "Tag",
    icon: Tag,
    cor: "text-accent-foreground",
    descricao: "Marca a conversa no atendimento.",
    configPadrao: { tag_id: null },
  },
  fim: {
    label: "Fim",
    icon: Flag,
    cor: "text-muted-foreground",
    descricao: "Encerra o fluxo.",
    configPadrao: {},
  },
};

export const TIPOS_ARRASTAVEIS: TipoNo[] = [
  "filtro",
  "condicao",
  "espera",
  "enviar_email",
  "whatsapp_template",
  "whatsapp_janela",
  "aplicar_tag",
  "fim",
];

export const TIPOS_ENVIO: TipoNo[] = ["enviar_email", "whatsapp_template", "whatsapp_janela"];

export const ROTULO_STATUS_FLUXO: Record<string, string> = {
  ativo: "No ar",
  pausado: "Pausado",
  rascunho: "Rascunho",
  arquivado: "Arquivado",
};

const corte = (t: string, n = 46) => (t.length > n ? `${t.slice(0, n)}…` : t);

/** Resumo de uma linha da configuração do nó, para aparecer no canvas. */
export function resumoNo(tipo: TipoNo, config: Record<string, any> = {}, catalogo?: any): string {
  const templatesEmail = catalogo?.templates_email ?? [];
  const templatesWpp = catalogo?.templates_whatsapp ?? [];
  const tags = catalogo?.tags ?? [];

  switch (tipo) {
    case "filtro":
      return "Só segue quem passa no filtro";
    case "condicao": {
      const modo = config.modo ?? "publico";
      if (modo === "comprou") return "Comprou desde que entrou?";
      if (modo === "janela_whatsapp") return "Janela de 24h aberta?";
      if (modo === "evento") return `Reação ao envio: ${config.evento ?? "sem evento"}`;
      return "Dados da cliente";
    }
    case "espera": {
      const partes: string[] = [];
      if (Number(config.dias)) partes.push(`${config.dias} dias`);
      if (Number(config.horas)) partes.push(`${config.horas} h`);
      if (Number(config.minutos)) partes.push(`${config.minutos} min`);
      const base = partes.length ? partes.join(" ") : "sem espera";
      return config.ate_hora != null && config.ate_hora !== ""
        ? `${base}, a partir das ${config.ate_hora}h`
        : base;
    }
    case "enviar_email": {
      const t = templatesEmail.find((x: any) => String(x.id) === String(config.template_id));
      const cupom =
        config.cupom === "rfm" ? "cupom por RFM"
          : config.cupom === "sempre" ? "sempre com cupom"
            : config.cupom === "herdar" ? "reusa cupom anterior"
              : "sem cupom";
      return `Template: ${t?.slug ?? t?.nome ?? "não escolhido"} · ${cupom}`;
    }
    case "whatsapp_template": {
      const t = templatesWpp.find((x: any) => String(x.id) === String(config.template_id));
      return `Template: ${t?.nome ?? "não escolhido"}`;
    }
    case "whatsapp_janela":
      return config.texto ? corte(String(config.texto)) : "Texto livre não escrito";
    case "aplicar_tag": {
      const t = tags.find((x: any) => String(x.id) === String(config.tag_id));
      return t ? `Tag: ${t.nome}` : "Tag não escolhida";
    }
    default:
      return "";
  }
}
