import { supabase } from "@/integrations/supabase/client";

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args ?? {});
  if (error) throw new Error(error.message);
  return data as T;
}

export interface CatalogoCategoria {
  canal: "tray" | "bling";
  id: string;
  nome: string;
  pai: string | null;
  ativa: boolean;
}

export interface CatalogoCor {
  nome: string;
  sigla: string;
  tray_color_id: number | null;
}

export interface CatalogoTamanho {
  nome: string;
  sigla: string;
  rotulo_numerico: string | null;
  ordem: number;
}

export interface CatalogoSku {
  id: string;
  sku: string;
  cor: string | null;
  tamanho: string | null;
  preco?: number | null;
  custo?: number | null;
  ean?: string | null;
  ordem_cor?: number | null;
  ordem_tamanho?: number | null;
  conflito?: string | null;
  criado?: boolean;
  tray_sku_id?: string | null;
  bling_id?: string | null;
  vinculado?: boolean | null;
}

export interface CatalogoProduto {
  id: string;
  nome?: string | null;
  apelido?: string | null;
  categoria_tray?: string | null;
  categoria_bling?: string | null;
  peso?: number | null;
  altura?: number | null;
  largura?: number | null;
  comprimento?: number | null;
  ncm?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  descricao_curta?: string | null;
  descricao?: string | null;
  tray_produto_id?: string | null;
  bling_produto_id?: string | null;
  [k: string]: unknown;
}

export interface CatalogoValidacao {
  severidade: "erro" | "aviso";
  regra: string;
  detalhe: string;
}

export interface CatalogoCustos {
  preco_venda: number | null;
  preco_custo: number | null;
  custo_corte: number | null;
  custo_costura: number | null;
  custo_embalagem: number | null;
  margem_real_percentual: number | null;
  preco_venda_sugerido: number | null;
}

export interface CatalogoSugestaoNcm {
  tipo: string;
  ncm_sugerido: string;
  ocorrencias: number;
  confianca: string;
  alternativos: { ncm: string; ocorrencias: number }[];
}

export interface CatalogoListaItem {
  id: string;
  nome: string;
  skus: number;
  publicados_tray: number;
  vinculados: number;
  [k: string]: unknown;
}

export const catalogoCategorias = () => rpc<CatalogoCategoria[]>("catalogo_categorias_disponiveis");

export const catalogoCoresTamanhos = () =>
  rpc<{ cores: CatalogoCor[]; tamanhos: CatalogoTamanho[] }>("catalogo_cores_e_tamanhos");

export const catalogoSugerirNcm = (nome: string) =>
  rpc<CatalogoSugestaoNcm[]>("catalogo_sugerir_ncm", { p_nome: nome });

export const catalogoProdutoSalvar = (dados: Record<string, unknown>) =>
  rpc<string | { id: string }>("catalogo_produto_salvar", { p_dados: dados });

export const catalogoProdutoLer = (produtoId: string) =>
  rpc<{ produto: CatalogoProduto; skus: CatalogoSku[] }>("catalogo_produto_ler", {
    p_produto_id: produtoId,
  });

export const catalogoProdutosListar = (busca?: string, limite = 50) =>
  rpc<CatalogoListaItem[]>("catalogo_produtos_listar", { p_busca: busca ?? null, p_limite: limite });

export const catalogoGerarGrade = (args: {
  produtoId: string;
  cores: string[];
  tamanhos: string[];
  preco: number | null;
  custo: number | null;
}) =>
  rpc<CatalogoSku[]>("catalogo_gerar_grade", {
    p_produto_id: args.produtoId,
    p_cores: args.cores,
    p_tamanhos: args.tamanhos,
    p_preco: args.preco,
    p_custo: args.custo,
  });

export const catalogoSkuAtualizar = (skuId: string, dados: Record<string, unknown>) =>
  rpc("catalogo_sku_atualizar", { p_sku_id: skuId, p_dados: dados });

export const catalogoSkuRemover = (skuId: string) => rpc("catalogo_sku_remover", { p_sku_id: skuId });

export const catalogoValidarProduto = (produtoId: string) =>
  rpc<CatalogoValidacao[]>("catalogo_validar_produto", { p_produto_id: produtoId });

export const catalogoLigarCusto = (produtoId: string) =>
  rpc("catalogo_ligar_custo", { p_produto_id: produtoId });

export const catalogoCustosDoProduto = (produtoId: string) =>
  rpc<CatalogoCustos[] | CatalogoCustos | null>("catalogo_custos_do_produto", {
    p_produto_id: produtoId,
  });

export async function catalogoPublicar(body: {
  produto_id: string;
  dryRun: boolean;
  etapas: string[];
}) {
  const { data, error } = await supabase.functions.invoke("catalogo-publicar", { body });
  if (error) {
    let detalhe = error.message;
    const ctx: any = (error as any).context;
    try {
      if (ctx && typeof ctx.json === "function") {
        const corpo = await ctx.json();
        return { erro: true, corpo } as any;
      }
    } catch {
      /* ignore */
    }
    throw new Error(detalhe);
  }
  return data as any;
}

export const DESCRICAO_MODELO = `<h2>O que essa peça resolve</h2>
<p></p>
<h2>Como ela veste</h2>
<p></p>
<h2>Tecido e composição</h2>
<p></p>
<h2>Grade e medidas</h2>
<p></p>`;

export function chaveCatalogo(produtoId: string) {
  return `catalogo_produto:${produtoId}`;
}
