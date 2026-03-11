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
