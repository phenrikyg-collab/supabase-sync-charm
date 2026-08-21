import type { AppModule } from "@/hooks/useUserModules";

export type Requirement = "admin" | "any" | AppModule[];

/** Mapa de rota -> permissão exigida. Prefixos mais longos têm prioridade. */
export const ROUTE_ACCESS: Record<string, Requirement> = {
  // Planejamento Estratégico / Gestão / Automações / Usuários -> admin
  "/planejamento": "admin",
  "/dashboard-comercial": "admin",
  "/dashboard-antigo": "admin",
  "/padroes-pedidos": "admin",
  "/plano-comercial": "admin",
  "/metas": "admin",
  "/admin": "admin",
  "/automacoes": "admin",
  "/gestao": "admin",
  "/importar": "admin",

  // Comercial
  "/lancamentos": ["comercial"],
  "/bonificacao-whatsapp": ["comercial"],
  "/produtos-campanha": ["comercial"],
  "/dashboard-rfm": ["comercial"],
  "/dashboard-produtos": ["comercial"],
  "/propor-carrinho": ["comercial"],
  // Atendimento (módulo comercial)
  "/atendimento": ["comercial"],
  "/audiencia": ["comercial"],
  "/carrinho-abandonado": ["comercial"],
  "/pedidos-cancelados": ["comercial"],
  "/rastreamento": ["comercial"],
  "/funil-whatsapp": ["comercial"],
  "/kpis-conversao": ["comercial"],
  "/provador-virtual": ["comercial"],

  // Produção
  "/ordens-producao": ["producao", "comercial"],
  "/produtos": ["producao"],
  "/cores": ["producao"],
  "/cadastro-tecidos": ["producao"],
  "/entrada-nf": ["producao"],
  "/estoque": ["producao"],
  "/ordens-corte": ["producao"],
  "/oficinas": ["producao"],
  "/oficina-interna": ["producao"],
  "/bonificacao": ["producao"],
  "/plano-producao": ["producao"],
  "/pagamento-oficinas": ["producao"],
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
  "/orcamento": ["financeiro"],
  "/custos-fixos": ["financeiro"],

  // Recursos Humanos (exige módulo 'rh')
  "/funcionarios": ["rh"],

  // Marketing
  "/marketing": ["marketing"],
  "/marketing-analytics": ["marketing"],
  "/marketing-whatsapp": ["marketing"],
  "/email-marketing": ["marketing"],
  "/embaixadoras": ["marketing"],
  "/planejamento-conteudo-mensal": ["marketing"],
  "/tendencias": ["marketing"],
  "/conteudo": ["marketing"],
  "/link-na-bio": ["marketing"],
  "/cupons": ["marketing"],
  "/prova-social": ["marketing"],

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
  comercial: "/atendimento",
  producao: "/ordens-producao",
  financeiro: "/dashboard-financeiro",
  logistica: "/bonificacao-expedicao",
  marketing: "/marketing",
  rh: "/funcionarios",
};
