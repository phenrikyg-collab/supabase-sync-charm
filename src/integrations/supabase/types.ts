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
      bonus_costureiras: {
        Row: {
          bonus_prazo: number
          bonus_qualidade: number
          costureira_id: string
          created_at: string
          id: string
          ordem_producao_id: string
          status: string
          total: number
        }
        Insert: {
          bonus_prazo?: number
          bonus_qualidade?: number
          costureira_id: string
          created_at?: string
          id?: string
          ordem_producao_id: string
          status?: string
          total?: number
        }
        Update: {
          bonus_prazo?: number
          bonus_qualidade?: number
          costureira_id?: string
          created_at?: string
          id?: string
          ordem_producao_id?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_costureiras_costureira_id_fkey"
            columns: ["costureira_id"]
            isOneToOne: false
            referencedRelation: "costureiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_costureiras_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_revisoras: {
        Row: {
          bonus_prazo: number
          bonus_qualidade: number
          created_at: string
          id: string
          mes_referencia: string
          revisora_id: string
          status: string
          total: number
        }
        Insert: {
          bonus_prazo?: number
          bonus_qualidade?: number
          created_at?: string
          id?: string
          mes_referencia: string
          revisora_id: string
          status?: string
          total?: number
        }
        Update: {
          bonus_prazo?: number
          bonus_qualidade?: number
          created_at?: string
          id?: string
          mes_referencia?: string
          revisora_id?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_revisoras_revisora_id_fkey"
            columns: ["revisora_id"]
            isOneToOne: false
            referencedRelation: "revisoras"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_credito: {
        Row: {
          ativo: boolean
          created_at: string
          dia_vencimento: number
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_vencimento?: number
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_vencimento?: number
          id?: string
          nome?: string
        }
        Relationships: []
      }
      cartoes_faturas: {
        Row: {
          cartao_nome: string
          created_at: string
          data_vencimento: string | null
          id: string
          mes_referencia: string
          saldo_em_aberto: number | null
          status: string
          valor_pago: number
          valor_total: number
        }
        Insert: {
          cartao_nome: string
          created_at?: string
          data_vencimento?: string | null
          id?: string
          mes_referencia: string
          saldo_em_aberto?: number | null
          status?: string
          valor_pago?: number
          valor_total?: number
        }
        Update: {
          cartao_nome?: string
          created_at?: string
          data_vencimento?: string | null
          id?: string
          mes_referencia?: string
          saldo_em_aberto?: number | null
          status?: string
          valor_pago?: number
          valor_total?: number
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
      config_bonificacao_costureiras: {
        Row: {
          bonus_prazo_1_dia_atraso: number
          bonus_prazo_2_dias_atraso: number
          bonus_prazo_acima_2_dias: number
          bonus_prazo_no_prazo: number
          bonus_qualidade_0_pct: number
          bonus_qualidade_acima_3_pct: number
          bonus_qualidade_ate_1_pct: number
          bonus_qualidade_ate_3_pct: number
          created_at: string
          id: string
        }
        Insert: {
          bonus_prazo_1_dia_atraso?: number
          bonus_prazo_2_dias_atraso?: number
          bonus_prazo_acima_2_dias?: number
          bonus_prazo_no_prazo?: number
          bonus_qualidade_0_pct?: number
          bonus_qualidade_acima_3_pct?: number
          bonus_qualidade_ate_1_pct?: number
          bonus_qualidade_ate_3_pct?: number
          created_at?: string
          id?: string
        }
        Update: {
          bonus_prazo_1_dia_atraso?: number
          bonus_prazo_2_dias_atraso?: number
          bonus_prazo_acima_2_dias?: number
          bonus_prazo_no_prazo?: number
          bonus_qualidade_0_pct?: number
          bonus_qualidade_acima_3_pct?: number
          bonus_qualidade_ate_1_pct?: number
          bonus_qualidade_ate_3_pct?: number
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      config_bonificacao_revisoras: {
        Row: {
          bonus_defeito_0_pct: number
          bonus_defeito_acima_3_pct: number
          bonus_defeito_ate_1_pct: number
          bonus_defeito_ate_3_pct: number
          bonus_prazo_dentro: number
          bonus_prazo_fora: number
          created_at: string
          id: string
          prazo_revisao_dias_uteis: number
        }
        Insert: {
          bonus_defeito_0_pct?: number
          bonus_defeito_acima_3_pct?: number
          bonus_defeito_ate_1_pct?: number
          bonus_defeito_ate_3_pct?: number
          bonus_prazo_dentro?: number
          bonus_prazo_fora?: number
          created_at?: string
          id?: string
          prazo_revisao_dias_uteis?: number
        }
        Update: {
          bonus_defeito_0_pct?: number
          bonus_defeito_acima_3_pct?: number
          bonus_defeito_ate_1_pct?: number
          bonus_defeito_ate_3_pct?: number
          bonus_prazo_dentro?: number
          bonus_prazo_fora?: number
          created_at?: string
          id?: string
          prazo_revisao_dias_uteis?: number
        }
        Relationships: []
      }
      config_maquinas: {
        Row: {
          created_at: string
          dias_uteis_mes: number
          horas_por_dia: number
          id: string
          quantidade_maquinas: number
          tipo_maquina: string
        }
        Insert: {
          created_at?: string
          dias_uteis_mes?: number
          horas_por_dia?: number
          id?: string
          quantidade_maquinas?: number
          tipo_maquina: string
        }
        Update: {
          created_at?: string
          dias_uteis_mes?: number
          horas_por_dia?: number
          id?: string
          quantidade_maquinas?: number
          tipo_maquina?: string
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
      costureiras: {
        Row: {
          ativa: boolean
          created_at: string
          funcao: string
          id: string
          nome: string
          participacao_pct: number
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          funcao?: string
          id?: string
          nome: string
          participacao_pct?: number
        }
        Update: {
          ativa?: boolean
          created_at?: string
          funcao?: string
          id?: string
          nome?: string
          participacao_pct?: number
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
      defeitos_mensais: {
        Row: {
          created_at: string
          id: string
          mes_referencia: string
          total_defeitos_reportados: number
          total_pecas_expedidas: number
        }
        Insert: {
          created_at?: string
          id?: string
          mes_referencia: string
          total_defeitos_reportados?: number
          total_pecas_expedidas?: number
        }
        Update: {
          created_at?: string
          id?: string
          mes_referencia?: string
          total_defeitos_reportados?: number
          total_pecas_expedidas?: number
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
      fichas_tecnicas_tempo: {
        Row: {
          created_at: string
          cronometrado_por: string | null
          data_medicao: string | null
          id: string
          num_amostras: number | null
          numero_etapa: number
          observacao: string | null
          operacao: string
          produto_id: string
          tempo_minutos: number
          tipo_peca: string
        }
        Insert: {
          created_at?: string
          cronometrado_por?: string | null
          data_medicao?: string | null
          id?: string
          num_amostras?: number | null
          numero_etapa?: number
          observacao?: string | null
          operacao: string
          produto_id: string
          tempo_minutos?: number
          tipo_peca?: string
        }
        Update: {
          created_at?: string
          cronometrado_por?: string | null
          data_medicao?: string | null
          id?: string
          num_amostras?: number | null
          numero_etapa?: number
          observacao?: string | null
          operacao?: string
          produto_id?: string
          tempo_minutos?: number
          tipo_peca?: string
        }
        Relationships: [
          {
            foreignKeyName: "fichas_tecnicas_tempo_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
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
          conta_tipo: string | null
          created_at: string
          data: string
          data_envio: string | null
          data_vencimento: string | null
          descricao: string | null
          entrada_tecido_id: string | null
          fatura_id: string | null
          frequencia: string | null
          id: string
          impacta_dre: boolean
          impacta_fluxo: boolean
          origem: string | null
          parcela_info: string | null
          status_bling: string | null
          status_pagamento: string | null
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
          conta_tipo?: string | null
          created_at?: string
          data?: string
          data_envio?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          entrada_tecido_id?: string | null
          fatura_id?: string | null
          frequencia?: string | null
          id?: string
          impacta_dre?: boolean
          impacta_fluxo?: boolean
          origem?: string | null
          parcela_info?: string | null
          status_bling?: string | null
          status_pagamento?: string | null
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
          conta_tipo?: string | null
          created_at?: string
          data?: string
          data_envio?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          entrada_tecido_id?: string | null
          fatura_id?: string | null
          frequencia?: string | null
          id?: string
          impacta_dre?: boolean
          impacta_fluxo?: boolean
          origem?: string | null
          parcela_info?: string | null
          status_bling?: string | null
          status_pagamento?: string | null
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
          {
            foreignKeyName: "movimentacoes_financeiras_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "cartoes_faturas"
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
      orcamentos: {
        Row: {
          ano: number
          categoria_id: string
          created_at: string
          id: string
          mes: number
          updated_at: string
          valor_orcado: number
        }
        Insert: {
          ano: number
          categoria_id: string
          created_at?: string
          id?: string
          mes: number
          updated_at?: string
          valor_orcado?: number
        }
        Update: {
          ano?: number
          categoria_id?: string
          created_at?: string
          id?: string
          mes?: number
          updated_at?: string
          valor_orcado?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
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
          cac_percentual: number | null
          chargeback_percentual: number | null
          codigo_sku: string | null
          comissao_percentual: number | null
          consumo_de_tecido: number | null
          conteudo_percentual: number | null
          created_at: string | null
          cupom_percentual: number | null
          custo_bling: number | null
          custo_corte: number | null
          custo_costura: number | null
          custo_embalagem: number | null
          custo_frete: number | null
          custo_marketing: number | null
          devolucao_percentual: number | null
          id: string
          imposto_percentual: number | null
          margem_real_percentual: number | null
          nome_do_produto: string
          origem_custo: string | null
          overhead_percentual: number | null
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
          cac_percentual?: number | null
          chargeback_percentual?: number | null
          codigo_sku?: string | null
          comissao_percentual?: number | null
          consumo_de_tecido?: number | null
          conteudo_percentual?: number | null
          created_at?: string | null
          cupom_percentual?: number | null
          custo_bling?: number | null
          custo_corte?: number | null
          custo_costura?: number | null
          custo_embalagem?: number | null
          custo_frete?: number | null
          custo_marketing?: number | null
          devolucao_percentual?: number | null
          id?: string
          imposto_percentual?: number | null
          margem_real_percentual?: number | null
          nome_do_produto: string
          origem_custo?: string | null
          overhead_percentual?: number | null
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
          cac_percentual?: number | null
          chargeback_percentual?: number | null
          codigo_sku?: string | null
          comissao_percentual?: number | null
          consumo_de_tecido?: number | null
          conteudo_percentual?: number | null
          created_at?: string | null
          cupom_percentual?: number | null
          custo_bling?: number | null
          custo_corte?: number | null
          custo_costura?: number | null
          custo_embalagem?: number | null
          custo_frete?: number | null
          custo_marketing?: number | null
          devolucao_percentual?: number | null
          id?: string
          imposto_percentual?: number | null
          margem_real_percentual?: number | null
          nome_do_produto?: string
          origem_custo?: string | null
          overhead_percentual?: number | null
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
      registros_producao_diaria: {
        Row: {
          costureira_id: string
          created_at: string
          data: string
          id: string
          ordem_producao_id: string
          pecas_defeituosas: number
          pecas_produzidas: number
          tempo_galoneira: number
          tempo_overloque: number
          tempo_reta: number
        }
        Insert: {
          costureira_id: string
          created_at?: string
          data?: string
          id?: string
          ordem_producao_id: string
          pecas_defeituosas?: number
          pecas_produzidas?: number
          tempo_galoneira?: number
          tempo_overloque?: number
          tempo_reta?: number
        }
        Update: {
          costureira_id?: string
          created_at?: string
          data?: string
          id?: string
          ordem_producao_id?: string
          pecas_defeituosas?: number
          pecas_produzidas?: number
          tempo_galoneira?: number
          tempo_overloque?: number
          tempo_reta?: number
        }
        Relationships: [
          {
            foreignKeyName: "registros_producao_diaria_costureira_id_fkey"
            columns: ["costureira_id"]
            isOneToOne: false
            referencedRelation: "costureiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_producao_diaria_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_revisao: {
        Row: {
          created_at: string
          data_conclusao: string | null
          data_recebimento: string
          dentro_prazo: boolean | null
          dias_uteis_gastos: number | null
          id: string
          observacao: string | null
          ordem_producao_id: string
          pecas_aprovadas: number
          pecas_reprovadas: number
          quantidade_pecas: number
          revisora_id: string
        }
        Insert: {
          created_at?: string
          data_conclusao?: string | null
          data_recebimento: string
          dentro_prazo?: boolean | null
          dias_uteis_gastos?: number | null
          id?: string
          observacao?: string | null
          ordem_producao_id: string
          pecas_aprovadas?: number
          pecas_reprovadas?: number
          quantidade_pecas?: number
          revisora_id: string
        }
        Update: {
          created_at?: string
          data_conclusao?: string | null
          data_recebimento?: string
          dentro_prazo?: boolean | null
          dias_uteis_gastos?: number | null
          id?: string
          observacao?: string | null
          ordem_producao_id?: string
          pecas_aprovadas?: number
          pecas_reprovadas?: number
          quantidade_pecas?: number
          revisora_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_revisao_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_revisao_revisora_id_fkey"
            columns: ["revisora_id"]
            isOneToOne: false
            referencedRelation: "revisoras"
            referencedColumns: ["id"]
          },
        ]
      }
      revisoras: {
        Row: {
          ativa: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome?: string
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
      vw_revisao_mensal: {
        Row: {
          mes: string | null
          pct_prazo: number | null
          revisoes_fora_prazo: number | null
          revisoes_no_prazo: number | null
          revisora_id: string | null
          revisora_nome: string | null
          total_aprovadas: number | null
          total_pecas: number | null
          total_reprovadas: number | null
          total_revisoes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_revisao_revisora_id_fkey"
            columns: ["revisora_id"]
            isOneToOne: false
            referencedRelation: "revisoras"
            referencedColumns: ["id"]
          },
        ]
      }
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
