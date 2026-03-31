// src/hooks/useClassifyCategory.ts
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClassificationResult {
  codigo: number;
  nome: string;
  tipo: "Débito" | "Crédito";
  confianca: number;
  motivo: string;
}

export interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  data_vencimento?: string | null;
  categoria?: ClassificationResult;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  _categoria_id?: string | null;
  classificando?: boolean;
  erro?: string;
}

export function useClassifyCategory() {
  const [carregando, setCarregando] = useState(false);

  const classificarUm = async (descricao: string, valor?: number): Promise<ClassificationResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("classify-category", {
        body: { descricao, valor },
      });
      if (error) throw new Error(error.message);
      return data as ClassificationResult;
    } catch {
      return null;
    }
  };

  const classificarLotes = async (
    lancamentos: Lancamento[],
    onAtualizar: (lancamentos: Lancamento[]) => void
  ) => {
    setCarregando(true);
    const resultado = [...lancamentos];

    for (let i = 0; i < resultado.length; i++) {
      // Skip items that already have a pre-matched categoria_id
      if (resultado[i].categoria_id) {
        resultado[i] = {
          ...resultado[i],
          classificando: false,
          categoria: resultado[i].categoria ?? {
            codigo: 0,
            nome: resultado[i].categoria_nome || "Pré-categorizado",
            tipo: "Débito" as const,
            confianca: 95,
            motivo: "Categorizado automaticamente pelo mapeamento de descrições",
          },
        };
        onAtualizar([...resultado]);
        continue;
      }

      // Marca como "classificando"
      resultado[i] = { ...resultado[i], classificando: true };
      onAtualizar([...resultado]);

      const categoria = await classificarUm(resultado[i].descricao, resultado[i].valor);

      resultado[i] = {
        ...resultado[i],
        classificando: false,
        categoria: categoria ?? undefined,
        erro: categoria ? undefined : "Não foi possível classificar",
      };
      onAtualizar([...resultado]);
    }

    setCarregando(false);
  };

  return { classificarUm, classificarLotes, carregando };
}
