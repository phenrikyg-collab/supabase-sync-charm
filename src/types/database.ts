// Database table types derived from Supabase schema

export interface Produto {
  id: string;
  nome_do_produto: string;
  codigo_sku: string | null;
  preco_venda: number | null;
  preco_custo: number | null;
  margem_real_percentual: number | null;
  ativo: boolean | null;
  consumo_de_tecido: number | null;
  tipo_do_produto: string | null;
  tecido_do_produto: string | null;
  bling_id: string | null;
  bling_produto_id: number | null;
  custo_bling: number | null;
  origem_custo: string | null;
  created_at: string | null;
  atualizado_em: string | null;
  updated_from_bling: string | null;
}

export interface Cor {
  id: string;
  nome_cor: string | null;
  cor_hex: string | null;
  ativo: boolean | null;
  created_at: string;
}

export interface Tecido {
  id: string;
  nome_tecido: string | null;
  custo_por_metro: number | null;
  fornecedor: string | null;
  metragem_estoque: number | null;
  rendimento_metro_por_kg: number | null;
  created_at: string;
}

export interface RoloTecido {
  id: string;
  tecido_id: string | null;
  cor_id: string | null;
  cor_nome: string | null;
  cor_hex: string | null;
  codigo_rolo: string | null;
  metragem_inicial: number | null;
  metragem_disponivel: number | null;
  peso_kg: number | null;
  fornecedor: string | null;
  status_rolo: string | null;
  entrada_id: string | null;
  entrada_tecido_id: string | null;
  lote: string | null;
  created_at: string;
}

export interface EntradaTecido {
  id: string;
  tecido_id: string | null;
  data_entrada: string | null;
  fornecedor: string | null;
  numero_nf: number | null;
  lote: number | null;
  quantidade_kg: number | null;
  quantidade_metros: number | null;
  custo_por_kg: number | null;
  estoque_disponivel_metros: number | null;
  valor_total: number | null;
  cor_id: string | null;
  created_at: string;
}

export interface OrdemCorte {
  id: string;
  numero_oc: string;
  grade_tamanhos: string[];
  metragem_risco: number;
  metragem_total_utilizada: number | null;
  quantidade_folhas: number | null;
  status: string | null;
  created_at: string | null;
}

export interface OrdemCorteGrade {
  id: string;
  ordem_corte_id: string | null;
  cor_id: string | null;
  tamanho: string;
  quantidade: number;
  created_at: string | null;
}

export interface OrdemCorteProduto {
  id: string;
  ordem_corte_id: string | null;
  produto_id: string | null;
  nome_produto: string | null;
  created_at: string | null;
}

export interface OrdemCorteRolo {
  id: string;
  ordem_corte_id: string | null;
  rolo_id: string | null;
  metragem_utilizada: number;
  created_at: string | null;
}

export interface OrdemProducao {
  id: string;
  produto_id: string | null;
  cor_id: string | null;
  oficina_id: string | null;
  ordem_corte_id: string | null;
  nome_produto: string | null;
  quantidade: number | null;
  quantidade_pecas_ordem: number | null;
  status_ordem: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  metragem_consumida: number | null;
  metragem_tecido_utilizada: number | null;
  tecido_id: string | null;
  entrada_tecido_id: string | null;
  risco_id: string | null;
  created_at: string;
}

export interface Oficina {
  id: string;
  nome_oficina: string | null;
  tipo_oficina: string | null;
  custo_por_peca: number | null;
  contato: string | null;
  observacao: string | null;
  created_at: string;
}

export interface Aviamento {
  id: string;
  nome_aviamento: string;
  unidade_medida: string | null;
  estoque_atual: number | null;
  custo_aviamento: number | null;
  created_at: string;
}

export interface ProdutoAviamento {
  id: string;
  produto_id: string | null;
  aviamento_id: string | null;
  quantidade_por_peca: number | null;
  custo_unitario: number | null;
  created_at: string | null;
}

export interface MovimentacaoFinanceira {
  id: string;
  tipo: string | null;
  descricao: string | null;
  valor: number;
  data: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  origem: string | null;
  cliente: string | null;
  bling_pedido_id: string | null;
  status_bling: string | null;
  valor_bruto: number | null;
  valor_desconto: number | null;
  valor_frete: number | null;
  valor_liquido: number | null;
  valor_produtos_bruto: number | null;
  valor_total_pago: number | null;
  data_envio: string | null;
  codigo_rastreamento: string | null;
  created_at: string | null;
}

export interface MetaFinanceira {
  id: number;
  mes: string | null;
  meta_mensal: number | null;
  dias_uteis: number | null;
  meta_ticket_medio: number | null;
  ponto_equilibrio: number | null;
  lucro_desejado: number | null;
  created_at: string | null;
}

export interface CategoriaFinanceira {
  id: string;
  nome_categoria: string | null;
  tipo: string | null;
  codigo: string | null;
  grupo_dre: string | null;
  ordem_exibicao: number | null;
  categoria_pai_id: string | null;
  created_at: string;
}

export interface CentroCusto {
  id: string;
  nome_centro: string | null;
  ativo: boolean | null;
  created_at: string;
}

// Views
export interface DashboardExecutivo {
  meta_mensal: number | null;
  vendido: number | null;
  bruto: number | null;
  restante: number | null;
  dias_uteis: number | null;
  dias_restantes: number | null;
  meta_diaria_necessaria: number | null;
  desconto_medio_percentual: number | null;
}

export interface TicketMedioMes {
  ticket_medio_real: number | null;
  total_pedidos: number | null;
  faturamento_total: number | null;
}

export interface IndicadorRiscoMeta {
  meta_mensal: number | null;
  faturamento_realizado: number | null;
  dias_restantes: number | null;
  media_necessaria_diaria: number | null;
  media_real_diaria: number | null;
  nivel_risco: string | null;
}

export interface ResumoProducaoAndamento {
  id: string | null;
  nome_produto: string | null;
  nome_cor: string | null;
  cor_hex: string | null;
  nome_oficina: string | null;
  oficina_id: string | null;
  status_ordem: string | null;
  grade_resumo: string | null;
  quantidade_pecas_ordem: number | null;
}

export interface Conserto {
  id: string;
  created_at: string | null;
  ordem_producao_id: string;
  cor_id: string | null;
  tamanho: string;
  quantidade: number;
  oficina_id: string | null;
  observacao: string | null;
  status: string | null;
}

export interface ResumoEstoqueTecidos {
  nome_tecido: string | null;
  nome_cor: string | null;
  cor_hex: string | null;
  metragem_total: number | null;
}

export interface ExpedicaoStatus {
  id: string | null;
  bling_pedido_id: string | null;
  cliente: string | null;
  data_pedido: string | null;
  status_bling: string | null;
  dias_corridos: number | null;
  prazo_dias: number | null;
  nivel_risco: string | null;
}

export interface MovimentacaoProducao {
  id: string;
  ordem_id: string | null;
  etapa: string | null;
  quantidade_movimentada: number | null;
  data_movimentacao: string | null;
  responsavel: string | null;
  observacao: string | null;
  created_at: string;
}
