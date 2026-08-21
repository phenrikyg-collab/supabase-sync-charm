import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  valor_override?: number | null;
  editado?: boolean | null;
  editavel?: boolean | null;
  obs?: string | null;
  pagamento_id?: string | null;
}

export interface ValeFolha {
  id: string;
  data?: string | null;
  valor?: number | null;
  descricao?: string | null;
  motivo?: string | null;
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
  vales?: number | null;
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
    vencendo_valor?: number;
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
      return (data ?? {}) as FolhaMes;
    },
    enabled: !!competencia,
  });
}
