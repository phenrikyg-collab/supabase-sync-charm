// Portal público de trocas e devoluções.
// Regra: nenhuma chave de banco no front — só a URL da função pública.
const REVERSA_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/reversa-portal";

export type Motivo = {
  codigo?: string;
  valor?: string;
  rotulo: string;
  no_prazo?: boolean;
  prazo_ate?: string;
  pede_tamanho?: boolean;
  exige_foto?: boolean;
};

export type ItemPedido = {
  tray_item_id: string | number;
  nome?: string;
  cor?: string;
  tamanho?: string;
  valor?: number;
  foto?: string;
  imagem?: string;
  disponivel?: number;
};

export type Preferencia = {
  codigo?: string;
  valor?: string;
  rotulo?: string;
  descricao?: string;
};

export type Endereco = Record<string, string | undefined>;

export type Solicitacao = {
  protocolo: string;
  token?: string;
  status?: string;
  criado_em?: string;
};

export type RespostaBuscar = {
  pedido?: string;
  data_compra?: string;
  data_base?: string;
  prazos?: Record<string, any>;
  cliente?: { nome?: string; email?: string; celular?: string; telefone?: string };
  endereco?: Endereco;
  motivos?: Motivo[];
  itens?: ItemPedido[];
  preferencias?: Preferencia[];
  solicitacoes?: Solicitacao[];
};

export type RespostaCriar = {
  protocolo: string;
  token?: string;
  postagem?: {
    codigo_autorizacao?: string;
    valido_ate?: string;
    servico?: string;
  } | null;
  aviso?: string;
  mensagem?: string;
};

export type RespostaStatus = {
  protocolo?: string;
  status?: string;
  linha_do_tempo?: Array<{ rotulo?: string; titulo?: string; data?: string; concluido?: boolean }>;
  timeline?: Array<{ rotulo?: string; titulo?: string; data?: string; concluido?: boolean }>;
  itens?: Array<Record<string, any>>;
  postagem?: RespostaCriar["postagem"];
  aviso?: string;
};

/** Chama a função pública. Erros voltam como { erro } e são repassados como texto. */
export async function reversa<T = any>(corpo: Record<string, any>): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(REVERSA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error("Não conseguimos falar com o servidor. Verifique sua internet e tente de novo.");
  }

  let dados: any = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (dados && typeof dados.erro === "string") throw new Error(dados.erro);
  if (!resposta.ok) throw new Error("Não foi possível concluir agora. Tente novamente em instantes.");
  return dados as T;
}

/** Pede a URL assinada, envia o arquivo e devolve o caminho salvo. */
export async function enviarFoto(
  arquivo: File,
  pedido: string,
  identificador: string,
): Promise<string> {
  const { caminho, url } = await reversa<{ caminho: string; url: string; token?: string }>({
    acao: "upload_url",
    pedido,
    identificador,
    tipo: arquivo.type || "image/jpeg",
  });

  const envio = await fetch(url, {
    method: "PUT",
    headers: { "content-type": arquivo.type || "image/jpeg" },
    body: arquivo,
  });
  if (!envio.ok) throw new Error("Não conseguimos enviar a foto. Tente outra imagem.");
  return caminho;
}

export const moeda = (v?: number | null) =>
  typeof v === "number"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

export function formatarData(valor?: string | null) {
  if (!valor) return "—";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("pt-BR");
}

export function chaveMotivo(m: Motivo) {
  return m.codigo ?? m.valor ?? m.rotulo;
}

export function chavePreferencia(p: Preferencia) {
  return p.codigo ?? p.valor ?? p.rotulo ?? "";
}

const CHAVE_LS = "reversa_acompanhamento";

export function salvarAcompanhamento(protocolo: string, token?: string) {
  try {
    localStorage.setItem(CHAVE_LS, JSON.stringify({ protocolo, token }));
  } catch {
    /* localStorage indisponível */
  }
}

export function lerAcompanhamento(): { protocolo?: string; token?: string } {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_LS) || "{}");
  } catch {
    return {};
  }
}
