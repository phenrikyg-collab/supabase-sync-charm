import type { AppModule } from "@/hooks/useUserModules";

export type Requirement = "admin" | "any" | AppModule[];

/**
 * Mapa de rota -> permissão exigida (seções do menu, 1 módulo por seção).
 * Páginas com dois pontos de entrada listam TODOS os módulos que liberam a rota.
 * Prefixos mais longos têm prioridade.
 */
export const ROUTE_ACCESS: Record<string, Requirement> = {
  // Gestão & Estratégia
  "/gestao": ["gestao"],
  "/gestao/planejamento": ["gestao"],
  "/gestao/midia-paga": ["gestao"],
  "/gestao/analises": ["gestao"],
  "/dashboard-comercial": ["gestao"],
  "/google-ads": ["gestao"],
  "/jornada-compra": ["gestao"],
  "/dashboard-antigo": ["gestao"],
  "/dashboard-rfm": ["gestao"],
  "/kpis-conversao": ["gestao"],
  "/padroes-pedidos": ["gestao"],
  "/metas": ["gestao"],
  "/planejamento": ["gestao"],
  "/plano-comercial": ["gestao"],
  "/importar": ["gestao"],

  // Comercial
  "/produtos-campanha": ["comercial"],
  "/lancamentos": ["comercial"],
  "/dashboard-produtos": ["comercial"],
  "/bonificacao-whatsapp": ["comercial"],

  // Marketing (Meta Ads / GA4 também aparecem em Gestão & Estratégia)
  "/marketing": ["marketing", "gestao"],
  "/marketing-analytics": ["marketing"],
  "/planejamento-conteudo-mensal": ["marketing"],
  "/tendencias": ["marketing"],
  "/embaixadoras": ["marketing"],
  "/link-na-bio": ["marketing"],
  "/prova-social": ["marketing"],
  "/social-commerce": ["marketing"],

  // CRM & Relacionamento
  "/email-marketing": ["crm"],
  "/marketing-whatsapp": ["crm"],
  "/cupons": ["crm"],
  "/conteudo": ["crm"],
  "/automacoes": ["crm"],

  // Atendimento & Venda Direta
  "/atendimento": ["atendimento"],
  "/vendas-ao-vivo": ["atendimento"],
  "/funil-whatsapp": ["atendimento"],
  "/propor-carrinho": ["atendimento"],
  "/carrinho-abandonado": ["atendimento"],
  "/pedidos-cancelados": ["atendimento"],
  "/rastreamento": ["atendimento"],
  "/audiencia": ["atendimento"],
  "/provador-virtual": ["atendimento"],

  // Produção & Estoque (Ordens de Produção também está em Comercial)
  "/ordens-producao": ["producao", "comercial"],
  "/plano-producao": ["producao"],
  "/ordens-corte": ["producao"],
  "/oficinas": ["producao"],
  "/oficina-interna": ["producao"],
  "/estoque": ["producao"],
  "/entrada-nf": ["producao"],
  "/aviamentos": ["producao"],

  // Logística
  "/bonificacao-expedicao": ["logistica"],

  // Financeiro
  "/dashboard-financeiro": ["financeiro"],
  "/fluxo-caixa": ["financeiro"],
  "/financeiro": ["financeiro"],
  "/contas-pagar": ["financeiro"],
  "/contas-receber": ["financeiro"],
  "/dre": ["financeiro"],
  "/importar-extrato": ["financeiro"],
  "/faturas": ["financeiro"],
  "/transacoes-site": ["financeiro"],
  "/vindi-yapay": ["financeiro"],
  "/banco-inter": ["financeiro"],
  "/conciliacao-pix-whatsapp": ["financeiro"],
  "/orcamento": ["financeiro"],
  "/custos-fixos": ["financeiro"],
  "/pagamento-oficinas": ["financeiro", "producao"],

  // Recursos Humanos (folha, holerites, lotes PIX)
  "/funcionarios": ["rh"],

  // Bonificação Produção pertence a Produção & Estoque
  "/bonificacao": ["producao"],

  // Cadastros
  "/produtos": ["cadastros"],
  "/cores": ["cadastros"],
  "/cadastro-tecidos": ["cadastros"],

  // Acessos
  "/admin": "admin",

  // Qualquer usuário logado
  "/tv-interna": "any",
};

const SORTED_ROUTES = Object.keys(ROUTE_ACCESS).sort((a, b) => b.length - a.length);

export function requirementForPath(pathname: string): Requirement {
  const path = pathname.replace(/\/+$/, "") || "/";
  const match = SORTED_ROUTES.find((r) => path === r || path.startsWith(r + "/"));
  return match ? ROUTE_ACCESS[match] : "any";
}

export function canAccess(
  requirement: Requirement,
  isAdmin: boolean,
  modules: AppModule[],
): boolean {
  if (isAdmin) return true;
  if (requirement === "any") return true;
  if (requirement === "admin") return false;
  return requirement.some((m) => modules.includes(m));
}

/** Home por módulo (usado no redirecionamento inicial). */
export const MODULE_HOME: Record<AppModule, string> = {
  gestao: "/gestao",
  comercial: "/produtos-campanha",
  marketing: "/marketing",
  crm: "/email-marketing",
  atendimento: "/atendimento",
  producao: "/ordens-producao",
  logistica: "/bonificacao-expedicao",
  financeiro: "/dashboard-financeiro",
  rh: "/funcionarios",
  cadastros: "/produtos",
};
