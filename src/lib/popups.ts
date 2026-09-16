import { supabase } from "@/integrations/supabase/client";

/* ============ Tipos ============ */

export type StatusPopup = "rascunho" | "ativo" | "pausado" | "arquivado";

export type ElementoPopup = {
  id: string;
  tipo:
    | "titulo"
    | "texto"
    | "badge"
    | "imagem"
    | "botao"
    | "link_fechar"
    | "espaco"
    | "divisor"
    | "timer"
    | "campo"
    | "consentimento"
    | "cupom"
    | "aviso";
  [k: string]: any;
};

export type EtapaPopup = {
  id: string;
  nome: string;
  elementos: ElementoPopup[];
};

export type Popup = {
  id?: number;
  versao?: number;
  nome: string;
  status?: StatusPopup;
  formato?: string;
  prioridade?: number;
  teste_ab_grupo?: string | null;
  peso?: number;
  inicio?: string | null;
  fim?: string | null;
  design?: any;
  regras?: any;
  oferta?: any;
  atualizado_em?: string | null;
  impressoes_7d?: number | null;
  visitantes_7d?: number | null;
  conversoes_7d?: number | null;
  taxa_7d?: number | null;
  no_ar_agora?: boolean | null;
  pode_ativar?: boolean | null;
  validacao?: Validacao;
  diagnostico?: Diagnostico;
  [k: string]: any;
};

export type Validacao = {
  erros: string[];
  avisos: string[];
  pode_ativar: boolean;
};

export type ItemDiagnostico = {
  grupo: string;
  chave: string;
  status: "ok" | "atencao" | "ruim";
  titulo: string;
  detalhe: string;
  peso: number;
};

export type Diagnostico = {
  nota: number;
  itens: ItemDiagnostico[];
  benchmark?: { tipo: string; de: number; ate: number } | null;
  ideias_teste?: string[];
};

export type Modelo = {
  chave: string;
  nome: string;
  objetivo?: string;
  quando_usar?: string;
  como_convive?: string;
  formato?: string;
  oferta_tipo?: string;
  nota?: number;
  design?: any;
  regras?: any;
  oferta?: any;
};

/* ============ RPCs ============ */

const rpc = supabase.rpc.bind(supabase) as any;

async function chamar<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(nome, args ?? {});
  if (error) throw new Error(error.message);
  return data as T;
}

export const popupsApi = {
  listar: (incluirArquivados = false) =>
    chamar<Popup[]>("popups_listar", { p_incluir_arquivados: incluirArquivados }),
  obter: (id: number) => chamar<Popup>("popups_obter", { p_id: id }),
  salvar: (p: Popup) => chamar<Popup>("popups_salvar", { p }),
  alterarStatus: (id: number, status: StatusPopup) =>
    chamar<{ ok: boolean; popup?: Popup; validacao?: Validacao }>("popups_alterar_status", {
      p_id: id,
      p_status: status,
    }),
  duplicar: (id: number) => chamar<Popup>("popups_duplicar", { p_id: id }),
  historico: (id: number) =>
    chamar<{ versao: number; nome: string; salvo_em: string }[]>("popups_historico", { p_id: id }),
  restaurar: (id: number, versao: number) =>
    chamar<Popup>("popups_restaurar", { p_id: id, p_versao: versao }),
  linkPrevia: (id: number, url?: string) =>
    chamar<{ url: string; expira_em: string }>("popups_link_previa", {
      p_id: id,
      ...(url ? { p_url: url } : {}),
    }),
  metricas: (id: number, de: string, ate: string) =>
    chamar<any>("popups_metricas", { p_id: id, p_de: de, p_ate: ate }),
  engajamento: (id: number, de: string, ate: string) =>
    chamar<any>("popups_engajamento", { p_id: id, p_de: de, p_ate: ate }),
  conversoes: (id: number | null, limite = 200, incluirTeste = false) =>
    chamar<any[]>("popups_conversoes", {
      p_id: id,
      p_limite: limite,
      p_incluir_teste: incluirTeste,
    }),
  configObter: () => chamar<any>("popups_config_obter"),
  configSalvar: (p: any) => chamar<any>("popups_config_salvar", { p }),
  modelos: () => chamar<Modelo[]>("popups_modelos"),
  criarDeModelo: (chave: string, nome?: string) =>
    chamar<Popup>("popups_criar_de_modelo", { p_chave: chave, ...(nome ? { p_nome: nome } : {}) }),
  diagnostico: (p: Popup) =>
    chamar<{ validacao: Validacao; diagnostico: Diagnostico }>("popups_diagnostico", { p }),
};

export const ERRO_CONFLITO = "Este popup foi alterado por outra pessoa. Recarregue antes de salvar.";

export function ehConflito(mensagem: string) {
  return (mensagem ?? "").includes("alterado por outra pessoa");
}

/* ============ Formatadores pt-BR ============ */

export function nBR(v: number | null | undefined, casas = 0) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "sem dados";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function moedaBR(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "sem dados";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pctBR(v: number | null | undefined, casas = 1) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "sem dados";
  return `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function dataHoraBR(iso: string | null | undefined) {
  if (!iso) return "sem dados";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sem dados";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function dataBR(iso: string | null | undefined) {
  if (!iso) return "sem dados";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sem dados";
  return d.toLocaleDateString("pt-BR");
}

export function desdeAgora(iso: string | null | undefined) {
  if (!iso) return "ainda não salvo";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 10) return "agora mesmo";
  if (s < 60) return `há ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `em ${dataHoraBR(iso)}`;
}

export function telefoneBR(v: string | null | undefined) {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length < 10) return v ?? "";
  const s = d.startsWith("55") ? d.slice(2) : d;
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
  return v ?? "";
}

export function linkWhats(v: string | null | undefined) {
  const d = (v ?? "").replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
}

/* ============ Rótulos ============ */

export const ROTULO_OFERTA: Record<string, string> = {
  cupom_tray: "Cupom automático",
  cupom_fixo: "Cupom fixo",
  nenhuma: "Só captura",
};

export const ROTULO_RESULTADO: Record<string, string> = {
  cupom_novo: "Cupom gerado",
  cupom_reenviado: "Cupom reenviado",
  ja_cliente: "Já é cliente",
  sem_oferta: "Lead",
  bloqueado: "Bloqueado",
  erro: "Erro",
};

export const ROTULO_GATILHO: Record<string, string> = {
  condicoes: "Condições cumpridas",
  saida: "Saída",
  saida_mobile: "Subida rápida no celular",
  reserva_mobile: "Tempo reserva no celular",
  inatividade: "Ficou parada",
  clique: "Clique",
  teaser: "Aba minimizada",
};

export const ROTULO_FECHOU: Record<string, string> = {
  x: "Botão X",
  overlay: "Clicou fora",
  esc: "Tecla Esc",
  link: "Agora não",
  botao: "Botão de fechar",
};

export const ROTULO_FORMATO: Record<string, string> = {
  modal: "Modal",
  lateral: "Lateral",
  barra: "Barra",
  tela_cheia: "Tela cheia",
};

/* ============ Diversos ============ */

export const TEM_TRAVESSAO = /\u2014/;

export const AJUDA_VARIAVEIS =
  "Variáveis: {primeiro_nome} {nome} {cupom} {valor} {validade} {expira_em}. Use **negrito** com dois asteriscos.";

export function corNota(nota: number) {
  if (nota >= 85) return "text-success border-success/40 bg-success/10";
  if (nota >= 60) return "text-warning border-warning/40 bg-warning/10";
  return "text-danger border-danger/40 bg-danger/10";
}

export function novoId(prefixo: string) {
  return `${prefixo}${Math.random().toString(36).slice(2, 8)}`;
}

const TIPOS_IMAGEM = ["image/webp", "image/png", "image/jpeg", "image/gif", "image/avif"];

export async function enviarImagem(arquivo: File, popupId: number | string) {
  if (!TIPOS_IMAGEM.includes(arquivo.type)) {
    throw new Error("Formato não aceito. Use webp, png, jpg, gif ou avif.");
  }
  if (arquivo.size > 3 * 1024 * 1024) {
    throw new Error("Arquivo acima de 3 MB.");
  }
  const caminho = `popups/${popupId}/${Date.now()}-${arquivo.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("popups").upload(caminho, arquivo, {
    cacheControl: "3600",
    upsert: false,
    contentType: arquivo.type,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("popups").getPublicUrl(caminho);
  return { url: data.publicUrl, pesada: arquivo.size > 400 * 1024 };
}

export function baixarCsv(nome: string, linhas: (string | number | null | undefined)[][]) {
  const corpo = linhas
    .map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\ufeff" + corpo], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}
