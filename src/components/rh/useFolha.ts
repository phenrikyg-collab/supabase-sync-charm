import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { comoLista, comoMapaPorTipo, comoTotais } from "@/lib/rh";

export interface PagamentoFolha {
  id: string;
  tipo?: string;
  valor?: number | null;
  valor_bruto?: number | null;
  valor_liquido?: number | null;
  status?: string | null;
  vencimento?: string | null;
  pago_em?: string | null;
  descricao?: string | null;
  observacao?: string | null;
}

export interface FuncionarioFolha {
  id: string;
  nome: string;
  cargo?: string | null;
  salario_base?: number | null;
  chave_pix?: string | null;
  tipo_chave_pix?: string | null;
  admissao?: string | null;
  custo_mes?: number | null;
  faltas?: number | null;
  vt_diaria?: number | null;
  pagamentos?: Record<string, PagamentoFolha>;
}

export interface FolhaMes {
  competencia?: string;
  dias_uteis?: number | null;
  gerado_em?: string | null;
  tiles?: {
    custo_total?: number;
    a_pagar?: number;
    pago?: number;
    beneficios?: number;
    funcionarios_ativos?: number;
    vencendo_qtd?: number;
    vencendo_total?: number;
  };
  totais_por_tipo?: Record<string, number>;
  funcionarios?: FuncionarioFolha[];
}

export function useFolhaMes(competencia: string) {
  return useQuery({
    queryKey: ["rh-folha-mes", competencia],
    queryFn: async (): Promise<FolhaMes> => {
      const { data, error } = await supabase.rpc("rh_folha_mes", { p_competencia: competencia });
      if (error) throw error;
      const d = (data ?? {}) as any;
      return {
        ...d,
        totais_por_tipo: comoTotais(d.totais_por_tipo),
        funcionarios: comoLista<any>(d.funcionarios).map((f: any) => ({
          ...f,
          pagamentos: comoMapaPorTipo<any>(f?.pagamentos),
        })),
      } as FolhaMes;
    },
    enabled: !!competencia,
  });
}
