export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      avisos_mural: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          mensagem: string | null
          prioridade: number
          titulo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          mensagem?: string | null
          prioridade?: number
          titulo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          mensagem?: string | null
          prioridade?: number
          titulo?: string
        }
        Relationships: []
      }
      categorias_financeiras: {
        Row: {
          categoria_pai_id: string | null
          codigo: string | null
          created_at: string
          descricao_categoria: string | null
          grupo_dre: string | null
          id: string
          nome_categoria: string | null
          ordem_exibicao: number | null
          tipo: string | null
        }
        Insert: {
          categoria_pai_id?: string | null
          codigo?: string | null
          created_at?: string
          descricao_categoria?: string | null
          grupo_dre?: string | null
          id?: string
          nome_categoria?: string | null
          ordem_exibicao?: number | null
          tipo?: string | null
        }
        Update: {
          categoria_pai_id?: string | null
          codigo?: string | null
          created_at?: string
          descricao_categoria?: string | null
          grupo_dre?: string | null
          id?: string
          nome_categoria?: string | null
          ordem_exibicao?: number | null
          tipo?: string | null
        }
        Relationships: []
      }
      centros_custos: {
        Row: {
          ativo: boolean | null
          created_at: string
          id: string
          nome_centro: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          nome_centro?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          nome_centro?: string | null
        }
        Relationships: []
      }
      colaboradores: {
        Row: {
          ativo: boolean
          created_at: string
          data_nascimento: string | null
          foto_url: string | null
          id: string
          nome: string
          participa_limpeza: boolean
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_nascimento?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          participa_limpeza?: boolean
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_nascimento?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          participa_limpeza?: boolean
        }
        Relationships: []
      }
      consertos: {
        Row: {
          cor_id: string | null
          created_at: string
          id: string
          observacao: string | null
          oficina_id: string | null
          ordem_producao_id: string
          quantidade: number
          status: string | null
          tamanho: string
        }
        Insert: {
          cor_id?: string | null
          created_at?: string
          id?: string
          observacao?: string | null
          oficina_id?: string | null
          ordem_producao_id: string
          quantidade?: number
          status?: string | null
          tamanho: string
        }
        Update: {
          cor_id?: string | null
          created_at?: string
          id?: string
          observacao?: string | null
          oficina_id?: string | null
          ordem_producao_id?: string
          quantidade?: number
          status?: string | null
          tamanho?: string
        }
        Relationships: [
          {
            foreignKeyName: "consertos_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      cores: {
        Row: {
          ativo: boolean | null
          cor_hex: string | null
          created_at: string
          id: string
          nome_cor: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor_hex?: string | null
          created_at?: string
          id?: string
          nome_cor?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor_hex?: string | null
          created_at?: string
          id?: string
          nome_cor?: string | null
        }
        Relationships: []
      }
      custo_fixo_oficina: {
        Row: {
          created_at: string
          id: string
          mes: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          mes: string
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          mes?: string
          valor?: number
        }
        Relationships: []
      }
      entradas_tecido: {
        Row: {
          created_at: string
          data_entrada: string | null
          fornecedor: string | null
          id: string
          numero_nf: number | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string
          data_entrada?: string | null
          fornecedor?: string | null
          id?: string
          numero_nf?: number | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string
          data_entrada?: string | null
          fornecedor?: string | null
          id?: string
          numero_nf?: number | null
          valor_total?: number | null
        }
        Relationships: []
      }
      escala_limpeza: {
        Row: {
          colaborador_id: string
          created_at: string
          data: string
          id: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          data: string
          id?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          data?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escala_limpeza_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_financeiras: {
        Row: {
          bling_pedido_id: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          cliente: string | null
          codigo_rastreamento: string | null
          created_at: string
          data: string
          data_envio: string | null
          descricao: string | null
          entrada_tecido_id: string | null
          id: string
          origem: string | null
          parcela_info: string | null
          status_bling: string | null
          tipo: string | null
          valor: number
          valor_bruto: number | null
          valor_desconto: number | null
          valor_frete: number | null
          valor_liquido: number | null
          valor_produtos_bruto: number | null
          valor_total_pago: number | null
        }
        Insert: {
          bling_pedido_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente?: string | null
          codigo_rastreamento?: string | null
          created_at?: string
          data?: string
          data_envio?: string | null
          descricao?: string | null
          entrada_tecido_id?: string | null
          id?: string
          origem?: string | null
          parcela_info?: string | null
          status_bling?: string | null
          tipo?: string | null
          valor?: number
          valor_bruto?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_liquido?: number | null
          valor_produtos_bruto?: number | null
          valor_total_pago?: number | null
        }
        Update: {
          bling_pedido_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente?: string | null
          codigo_rastreamento?: string | null
          created_at?: string
          data?: string
          data_envio?: string | null
          descricao?: string | null
          entrada_tecido_id?: string | null
          id?: string
          origem?: string | null
          parcela_info?: string | null
          status_bling?: string | null
          tipo?: string | null
          valor?: number
          valor_bruto?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_liquido?: number | null
          valor_produtos_bruto?: number | null
          valor_total_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_financeiras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_financeiras_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_financeiras_entrada_tecido_id_fkey"
            columns: ["entrada_tecido_id"]
            isOneToOne: false
            referencedRelation: "entradas_tecido"
            referencedColumns: ["id"]
          },
        ]
      }
      oficinas: {
        Row: {
          contato: string | null
          created_at: string
          custo_por_peca: number | null
          id: string
          is_interna: boolean | null
          nome_oficina: string | null
          observacao: string | null
          tipo_oficina: string | null
        }
        Insert: {
          contato?: string | null
          created_at?: string
          custo_por_peca?: number | null
          id?: string
          is_interna?: boolean | null
          nome_oficina?: string | null
          observacao?: string | null
          tipo_oficina?: string | null
        }
        Update: {
          contato?: string | null
          created_at?: string
          custo_por_peca?: number | null
          id?: string
          is_interna?: boolean | null
          nome_oficina?: string | null
          observacao?: string | null
          tipo_oficina?: string | null
        }
        Relationships: []
      }
      ordens_corte: {
        Row: {
          created_at: string | null
          grade_tamanhos: string[] | null
          id: string
          metragem_risco: number | null
          metragem_total_utilizada: number | null
          numero_oc: string
          quantidade_folhas: number | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          grade_tamanhos?: string[] | null
          id?: string
          metragem_risco?: number | null
          metragem_total_utilizada?: number | null
          numero_oc: string
          quantidade_folhas?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          grade_tamanhos?: string[] | null
          id?: string
          metragem_risco?: number | null
          metragem_total_utilizada?: number | null
          numero_oc?: string
          quantidade_folhas?: number | null
          status?: string | null
        }
        Relationships: []
      }
      ordens_corte_grade: {
        Row: {
          cor_id: string | null
          created_at: string | null
          id: string
          ordem_corte_id: string | null
          quantidade: number
          tamanho: string
        }
        Insert: {
          cor_id?: string | null
          created_at?: string | null
          id?: string
          ordem_corte_id?: string | null
          quantidade?: number
          tamanho: string
        }
        Update: {
          cor_id?: string | null
          created_at?: string | null
          id?: string
          ordem_corte_id?: string | null
          quantidade?: number
          tamanho?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_corte_grade_ordem_corte_id_fkey"
            columns: ["ordem_corte_id"]
            isOneToOne: false
            referencedRelation: "ordens_corte"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_corte_produtos: {
        Row: {
          created_at: string | null
          id: string
          nome_produto: string | null
          ordem_corte_id: string | null
          produto_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome_produto?: string | null
          ordem_corte_id?: string | null
          produto_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome_produto?: string | null
          ordem_corte_id?: string | null
          produto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_corte_produtos_ordem_corte_id_fkey"
            columns: ["ordem_corte_id"]
            isOneToOne: false
            referencedRelation: "ordens_corte"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_corte_rolos: {
        Row: {
          created_at: string | null
          id: string
          metragem_utilizada: number
          ordem_corte_id: string | null
          rolo_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metragem_utilizada?: number
          ordem_corte_id?: string | null
          rolo_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metragem_utilizada?: number
          ordem_corte_id?: string | null
          rolo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_corte_rolos_ordem_corte_id_fkey"
            columns: ["ordem_corte_id"]
            isOneToOne: false
            referencedRelation: "ordens_corte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_corte_rolos_rolo_id_fkey"
            columns: ["rolo_id"]
            isOneToOne: false
            referencedRelation: "rolos_tecido"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_producao: {
        Row: {
          cor_id: string | null
          created_at: string
          custo_estimado_peca: number | null
          data_fim: string | null
          data_inicio: string | null
          data_previsao_termino: string | null
          entrada_tecido_id: string | null
          id: string
          metragem_consumida: number | null
          metragem_tecido_utilizada: number | null
          nome_produto: string | null
          oficina_id: string | null
          ordem_corte_id: string | null
          pagamento_oficina_status: string | null
          produto_id: string | null
          quantidade: number | null
          quantidade_pecas_ordem: number | null
          risco_id: string | null
          status_ordem: string | null
          tecido_id: string | null
        }
        Insert: {
          cor_id?: string | null
          created_at?: string
          custo_estimado_peca?: number | null
          data_fim?: string | null
          data_inicio?: string | null
          data_previsao_termino?: string | null
          entrada_tecido_id?: string | null
          id?: string
          metragem_consumida?: number | null
          metragem_tecido_utilizada?: number | null
          nome_produto?: string | null
          oficina_id?: string | null
          ordem_corte_id?: string | null
          pagamento_oficina_status?: string | null
          produto_id?: string | null
          quantidade?: number | null
          quantidade_pecas_ordem?: number | null
          risco_id?: string | null
          status_ordem?: string | null
          tecido_id?: string | null
        }
        Update: {
          cor_id?: string | null
          created_at?: string
          custo_estimado_peca?: number | null
          data_fim?: string | null
          data_inicio?: string | null
          data_previsao_termino?: string | null
          entrada_tecido_id?: string | null
          id?: string
          metragem_consumida?: number | null
          metragem_tecido_utilizada?: number | null
          nome_produto?: string | null
          oficina_id?: string | null
          ordem_corte_id?: string | null
          pagamento_oficina_status?: string | null
          produto_id?: string | null
          quantidade?: number | null
          quantidade_pecas_ordem?: number | null
          risco_id?: string | null
          status_ordem?: string | null
          tecido_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_producao_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_ordem_corte_id_fkey"
            columns: ["ordem_corte_id"]
            isOneToOne: false
            referencedRelation: "ordens_corte"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          bling_id: string | null
          bling_produto_id: number | null
          codigo_sku: string | null
          comissao_percentual: number | null
          consumo_de_tecido: number | null
          created_at: string | null
          cupom_percentual: number | null
          custo_bling: number | null
          custo_corte: number | null
          custo_costura: number | null
          custo_embalagem: number | null
          id: string
          imposto_percentual: number | null
          margem_real_percentual: number | null
          nome_do_produto: string
          origem_custo: string | null
          parcelamento_percentual: number | null
          preco_custo: number | null
          preco_venda: number | null
          preco_venda_sugerido: number | null
          tecido_do_produto: string | null
          tipo_do_produto: string | null
          updated_from_bling: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bling_id?: string | null
          bling_produto_id?: number | null
          codigo_sku?: string | null
          comissao_percentual?: number | null
          consumo_de_tecido?: number | null
          created_at?: string | null
          cupom_percentual?: number | null
          custo_bling?: number | null
          custo_corte?: number | null
          custo_costura?: number | null
          custo_embalagem?: number | null
          id?: string
          imposto_percentual?: number | null
          margem_real_percentual?: number | null
          nome_do_produto: string
          origem_custo?: string | null
          parcelamento_percentual?: number | null
          preco_custo?: number | null
          preco_venda?: number | null
          preco_venda_sugerido?: number | null
          tecido_do_produto?: string | null
          tipo_do_produto?: string | null
          updated_from_bling?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bling_id?: string | null
          bling_produto_id?: number | null
          codigo_sku?: string | null
          comissao_percentual?: number | null
          consumo_de_tecido?: number | null
          created_at?: string | null
          cupom_percentual?: number | null
          custo_bling?: number | null
          custo_corte?: number | null
          custo_costura?: number | null
          custo_embalagem?: number | null
          id?: string
          imposto_percentual?: number | null
          margem_real_percentual?: number | null
          nome_do_produto?: string
          origem_custo?: string | null
          parcelamento_percentual?: number | null
          preco_custo?: number | null
          preco_venda?: number | null
          preco_venda_sugerido?: number | null
          tecido_do_produto?: string | null
          tipo_do_produto?: string | null
          updated_from_bling?: string | null
        }
        Relationships: []
      }
      rolos_tecido: {
        Row: {
          codigo_rolo: string | null
          cor_hex: string | null
          cor_id: string | null
          cor_nome: string | null
          created_at: string
          custo_por_metro: number | null
          entrada_id: string | null
          entrada_tecido_id: string | null
          fornecedor: string | null
          id: string
          lote: string | null
          metragem_disponivel: number | null
          metragem_inicial: number | null
          peso_kg: number | null
          status_rolo: string | null
          tecido_id: string | null
        }
        Insert: {
          codigo_rolo?: string | null
          cor_hex?: string | null
          cor_id?: string | null
          cor_nome?: string | null
          created_at?: string
          custo_por_metro?: number | null
          entrada_id?: string | null
          entrada_tecido_id?: string | null
          fornecedor?: string | null
          id?: string
          lote?: string | null
          metragem_disponivel?: number | null
          metragem_inicial?: number | null
          peso_kg?: number | null
          status_rolo?: string | null
          tecido_id?: string | null
        }
        Update: {
          codigo_rolo?: string | null
          cor_hex?: string | null
          cor_id?: string | null
          cor_nome?: string | null
          created_at?: string
          custo_por_metro?: number | null
          entrada_id?: string | null
          entrada_tecido_id?: string | null
          fornecedor?: string | null
          id?: string
          lote?: string | null
          metragem_disponivel?: number | null
          metragem_inicial?: number | null
          peso_kg?: number | null
          status_rolo?: string | null
          tecido_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rolos_tecido_cor_id_fkey"
            columns: ["cor_id"]
            isOneToOne: false
            referencedRelation: "cores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rolos_tecido_entrada_tecido_id_fkey"
            columns: ["entrada_tecido_id"]
            isOneToOne: false
            referencedRelation: "entradas_tecido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rolos_tecido_tecido_id_fkey"
            columns: ["tecido_id"]
            isOneToOne: false
            referencedRelation: "tecidos"
            referencedColumns: ["id"]
          },
        ]
      }
      tecidos: {
        Row: {
          created_at: string
          custo_por_metro: number | null
          fornecedor: string | null
          id: string
          metragem_estoque: number | null
          nome_tecido: string | null
          rendimento_metro_por_kg: number | null
        }
        Insert: {
          created_at?: string
          custo_por_metro?: number | null
          fornecedor?: string | null
          id?: string
          metragem_estoque?: number | null
          nome_tecido?: string | null
          rendimento_metro_por_kg?: number | null
        }
        Update: {
          created_at?: string
          custo_por_metro?: number | null
          fornecedor?: string | null
          id?: string
          metragem_estoque?: number | null
          nome_tecido?: string | null
          rendimento_metro_por_kg?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
