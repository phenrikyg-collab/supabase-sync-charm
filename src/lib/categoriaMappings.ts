// Mapeamento de descrições conhecidas → nome da categoria financeira
// Usado na importação de planilhas para pré-atribuir categorias automaticamente

export const DESCRICAO_CATEGORIA_MAP: Record<string, string> = {
  // Gastos com Pessoal
  "férias": "Gastos com Pessoal",
  "rescisões": "Gastos com Pessoal",
  "gym pass": "Gastos com Pessoal",
  "festas e comemorações": "Gastos com Pessoal",
  "investimento em cursos": "Gastos com Pessoal",
  "alimentação dos sócios": "Gastos com Pessoal",
  "saúde": "Gastos com Pessoal",
  "alimentação": "Gastos com Pessoal",
  "transporte": "Gastos com Pessoal",
  "salário": "Gastos com Pessoal",
  "encargos sociais e trabalhistas": "Gastos com Pessoal",
  "prólabore": "Gastos com Pessoal",
  "pro labore": "Gastos com Pessoal",
  "pró-labore": "Gastos com Pessoal",

  // Gastos com Marketing
  "ugc": "Gastos com Marketing",
  "ugc (geradoras de conteúdo)": "Gastos com Marketing",
  "vídeo maker": "Gastos com Marketing",
  "video maker": "Gastos com Marketing",
  "tiktok ads": "Gastos com Marketing",
  "tiktok": "Gastos com Marketing",
  "acessórios, maquinas e outros": "Gastos com Marketing",
  "estúdio fotográfico": "Gastos com Marketing",
  "fotográfo": "Gastos com Marketing",
  "fotografo": "Gastos com Marketing",
  "influencers": "Gastos com Marketing",
  "meta ads": "Gastos com Marketing",
  "google ads": "Gastos com Marketing",
  "facebook ads": "Gastos com Marketing",
  "instagram ads": "Gastos com Marketing",

  // Gastos com sistemas, site e aplicativos
  "sistema financeiro": "Gastos com sistemas, site e aplicativos",
  "inlead": "Gastos com sistemas, site e aplicativos",
  "copy base": "Gastos com sistemas, site e aplicativos",
  "troque e devolva": "Gastos com sistemas, site e aplicativos",
  "kora crm": "Gastos com sistemas, site e aplicativos",
  "plataforma traycommerce": "Gastos com sistemas, site e aplicativos",
  "traycommerce": "Gastos com sistemas, site e aplicativos",
  "mlabs": "Gastos com sistemas, site e aplicativos",
  "stripo": "Gastos com sistemas, site e aplicativos",
  "umbler": "Gastos com sistemas, site e aplicativos",
  "klinko": "Gastos com sistemas, site e aplicativos",
  "nummus": "Gastos com sistemas, site e aplicativos",
  "konfidency": "Gastos com sistemas, site e aplicativos",
  "desenvolvedor de site": "Gastos com sistemas, site e aplicativos",
  "manychat": "Gastos com sistemas, site e aplicativos",
  "notificações inteligente": "Gastos com sistemas, site e aplicativos",
  "canva": "Gastos com sistemas, site e aplicativos",
  "widde videos": "Gastos com sistemas, site e aplicativos",
  "hospedagens": "Gastos com sistemas, site e aplicativos",
  "dashboard ga4": "Gastos com sistemas, site e aplicativos",
  "rdstation crm": "Gastos com sistemas, site e aplicativos",
  "rdstation": "Gastos com sistemas, site e aplicativos",
  "aplicativos de celular": "Gastos com sistemas, site e aplicativos",
  "bling erp": "Gastos com sistemas, site e aplicativos",
  "bling": "Gastos com sistemas, site e aplicativos",

  // Gastos com Serviços de Terceiros
  "oficina de costura cleo": "Gastos com Serviços de Terceiros",
  "oficina de costura cida": "Gastos com Serviços de Terceiros",
  "oficina de costura cícera": "Gastos com Serviços de Terceiros",
  "oficina de costura cicera": "Gastos com Serviços de Terceiros",
  "corte de tecido": "Gastos com Serviços de Terceiros",
  "modelagem e plotagem": "Gastos com Serviços de Terceiros",

  // Parcelamento
  "parcela de parcelamento do cartão": "Parcelamento de saldo do cartão de crédito",
  "parcelamento do cartão": "Parcelamento de saldo do cartão de crédito",
  "parcelamento cartão": "Parcelamento de saldo do cartão de crédito",

  // Logística de vendas
  "total express": "Logística de vendas",
  "j3 flex": "Logística de vendas",
  "j3 flex (motoboy)": "Logística de vendas",
  "melhor envio": "Logística de vendas",
  "correios": "Logística de vendas",

  // Logística operacional
  "uber": "Logística operacional",
  "lalamove": "Logística operacional",
  "lalamove (motoboy)": "Logística operacional",

  // Taxas de Gateway
  "taxa traypagamentos (vindi)": "Taxas de Gateway",
  "taxa traypagamentos": "Taxas de Gateway",
  "taxa pagar.me": "Taxas de Gateway",
  "taxa pagarme": "Taxas de Gateway",
  "taxa de máquina de cartão": "Taxas de Gateway",
  "taxa vindi": "Taxas de Gateway",

  // Compras de equipamentos
  "compras de equipamentos": "Compras de equipamentos",

  // Gastos não Operacionais
  "empréstimos": "Gastos não Operacionais",
  "emprestimos": "Gastos não Operacionais",
  "tarifas bancárias": "Gastos não Operacionais",
  "tarifas bancarias": "Gastos não Operacionais",
  "juros por atraso": "Gastos não Operacionais",
  "outros gastos não operacionais": "Gastos não Operacionais",

  // Custos Variáveis
  "embalagem geral": "Custos Variáveis",
  "etiquetas e tag's": "Custos Variáveis",
  "etiquetas e tags": "Custos Variáveis",
  "sacolas tnt": "Custos Variáveis",
  "caixa de embalagem": "Custos Variáveis",
  "mão de obra variável": "Custos Variáveis",
  "aviamentos": "Custos Variáveis",
  "tecidos": "Custos Variáveis",
  "mercadoria para revenda": "Custos Variáveis",

  // Despesas administrativas
  "estacionamento": "Despesas administrativas",
  "combustível": "Despesas administrativas",
  "combustivel": "Despesas administrativas",
  "doações": "Despesas administrativas",
  "doacoes": "Despesas administrativas",
  "alarmes e segurança": "Despesas administrativas",
  "medicina do trabalho": "Despesas administrativas",
  "materiais de escritório, uso e consumo": "Despesas administrativas",
  "materiais de escritório": "Despesas administrativas",
  "manutenções prediais": "Despesas administrativas",
  "supermercado": "Despesas administrativas",
  "supermercado (café da manhã e outros)": "Despesas administrativas",
  "consultoria": "Despesas administrativas",
  "serviços jurídicos": "Despesas administrativas",
  "servicos juridicos": "Despesas administrativas",
  "contabilidade": "Despesas administrativas",

  // Gastos com Ocupação
  "energia elétrica": "Gastos com Ocupação",
  "energia eletrica": "Gastos com Ocupação",
  "limpeza e conservação": "Gastos com Ocupação",
  "telefone + internet": "Gastos com Ocupação",
  "telefone e internet": "Gastos com Ocupação",
  "aluguel, condomínio, iptu": "Gastos com Ocupação",
  "aluguel": "Gastos com Ocupação",
  "condomínio": "Gastos com Ocupação",
  "condominio": "Gastos com Ocupação",
  "iptu": "Gastos com Ocupação",
  "água": "Gastos com Ocupação",
  "agua": "Gastos com Ocupação",

  // Gastos com manutenção - produção
  "manutenção de máquinas produtivas": "Gastos com manutenção - produção",
  "manutenção de máquinas": "Gastos com manutenção - produção",

  // Despesas com brindes e presentes
  "presentes para clientes": "Despesas com brindes e presentes",
  "brindes": "Despesas com brindes e presentes",

  // Transferências
  "ajuste de saldo": "Transferências e Ajustes de Saldo (Déb)",
  "transferência entre contas próprias efetuadas": "Transferências e Ajustes de Saldo (Déb)",
  "transferência entre contas próprias recebidas": "Transferências e Ajustes de Saldo (Cré)",

  // Investimentos
  "investimentos gerais": "Investimentos",

  // Imposto de Renda e CSLL
  "csll": "Imposto de Renda e CSLL",
  "irpj": "Imposto de Renda e CSLL",

  // Receitas não Operacionais
  "outras receitas não operacionais": "Receitas não Operacionais",
  "juros de aplicação": "Receitas não Operacionais",
  "juros de aplicacao": "Receitas não Operacionais",

  // Comissão de vendedores
  "comissões para vendedores": "Comissão de vendedores",
  "comissão de vendedores": "Comissão de vendedores",

  // Estornos
  "devoluções de clientes": "Estornos",
  "estorno": "Estornos",
};

/**
 * Tenta encontrar a categoria pelo nome da descrição do lançamento.
 * Faz matching parcial (a descrição do lançamento contém a chave do mapeamento).
 */
export function findCategoriaByDescricao(
  descricao: string,
  categorias: { id: string; nome_categoria: string | null }[]
): { id: string; nome: string } | null {
  const descLower = descricao.toLowerCase().trim();

  // 1. Exact match
  const exactMatch = DESCRICAO_CATEGORIA_MAP[descLower];
  if (exactMatch) {
    const cat = categorias.find((c) => c.nome_categoria === exactMatch);
    if (cat) return { id: cat.id, nome: cat.nome_categoria! };
  }

  // 2. Partial match — check if description contains any known key
  for (const [chave, nomeCategoria] of Object.entries(DESCRICAO_CATEGORIA_MAP)) {
    if (descLower.includes(chave) || chave.includes(descLower)) {
      const cat = categorias.find((c) => c.nome_categoria === nomeCategoria);
      if (cat) return { id: cat.id, nome: cat.nome_categoria! };
    }
  }

  return null;
}
