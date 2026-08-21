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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aportes_financeiros: {
        Row: {
          amount: number
          aporte_type: string
          bank_account_id: string | null
          bank_movement_id: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          empresa_id: string
          id: string
          movement_date: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          aporte_type?: string
          bank_account_id?: string | null
          bank_movement_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          empresa_id: string
          id?: string
          movement_date?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          aporte_type?: string
          bank_account_id?: string | null
          bank_movement_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          empresa_id?: string
          id?: string
          movement_date?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aportes_financeiros_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aportes_financeiros_bank_movement_id_fkey"
            columns: ["bank_movement_id"]
            isOneToOne: false
            referencedRelation: "bank_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aportes_financeiros_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aportes_financeiros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          op: string
          row_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          op: string
          row_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          op?: string
          row_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      auth_rate_limits: {
        Row: {
          blocked_until: string | null
          created_at: string
          escalation_level: number
          expires_at: string
          failure_count: number
          id: string
          identity_hash: string
          identity_kind: string
          last_attempt_at: string
          scope: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string
          escalation_level?: number
          expires_at: string
          failure_count?: number
          id?: string
          identity_hash: string
          identity_kind: string
          last_attempt_at?: string
          scope: string
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string
          escalation_level?: number
          expires_at?: string
          failure_count?: number
          id?: string
          identity_hash?: string
          identity_kind?: string
          last_attempt_at?: string
          scope?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          agency: string | null
          bank: string
          color: string
          created_at: string
          empresa_id: string
          id: string
          initial_balance: number
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          agency?: string | null
          bank: string
          color?: string
          created_at?: string
          empresa_id: string
          id?: string
          initial_balance?: number
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          agency?: string | null
          bank?: string
          color?: string
          created_at?: string
          empresa_id?: string
          id?: string
          initial_balance?: number
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_movements: {
        Row: {
          account_id: string
          amount: number
          category: string
          created_at: string
          description: string
          destination_account_id: string | null
          empresa_id: string
          id: string
          movement_date: string
          notes: string | null
          origin: string
          reference_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category: string
          created_at?: string
          description: string
          destination_account_id?: string | null
          empresa_id: string
          id?: string
          movement_date?: string
          notes?: string | null
          origin?: string
          reference_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string
          created_at?: string
          description?: string
          destination_account_id?: string | null
          empresa_id?: string
          id?: string
          movement_date?: string
          notes?: string | null
          origin?: string
          reference_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_movements_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_movements_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_credito: {
        Row: {
          bandeira: string
          conta_bancaria_id: string | null
          cor: string
          created_at: string
          dia_fechamento: number
          dia_vencimento: number
          empresa_id: string
          id: string
          limite_total: number
          nome: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bandeira: string
          conta_bancaria_id?: string | null
          cor?: string
          created_at?: string
          dia_fechamento: number
          dia_vencimento: number
          empresa_id: string
          id?: string
          limite_total?: number
          nome: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bandeira?: string
          conta_bancaria_id?: string | null
          cor?: string
          created_at?: string
          dia_fechamento?: number
          dia_vencimento?: number
          empresa_id?: string
          id?: string
          limite_total?: number
          nome?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_credito_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_credito_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_faturas: {
        Row: {
          ano: number
          cartao_id: string
          created_at: string
          data_pagamento: string | null
          empresa_id: string
          id: string
          mes: number
          status: string
          updated_at: string
          user_id: string
          valor_total: number
        }
        Insert: {
          ano: number
          cartao_id: string
          created_at?: string
          data_pagamento?: string | null
          empresa_id: string
          id?: string
          mes: number
          status?: string
          updated_at?: string
          user_id: string
          valor_total?: number
        }
        Update: {
          ano?: number
          cartao_id?: string
          created_at?: string
          data_pagamento?: string | null
          empresa_id?: string
          id?: string
          mes?: number
          status?: string
          updated_at?: string
          user_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_faturas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes_credito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_faturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_lancamentos: {
        Row: {
          ano_fatura: number
          cartao_id: string
          categoria: string
          created_at: string
          data: string
          deleted_at: string | null
          descricao: string
          empresa_id: string
          grupo_parcela: string | null
          id: string
          mes_fatura: number
          observacoes: string | null
          parcela_atual: number
          parcelado: boolean
          total_parcelas: number
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          ano_fatura: number
          cartao_id: string
          categoria: string
          created_at?: string
          data: string
          deleted_at?: string | null
          descricao: string
          empresa_id: string
          grupo_parcela?: string | null
          id?: string
          mes_fatura: number
          observacoes?: string | null
          parcela_atual?: number
          parcelado?: boolean
          total_parcelas?: number
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          ano_fatura?: number
          cartao_id?: string
          categoria?: string
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao?: string
          empresa_id?: string
          grupo_parcela?: string | null
          id?: string
          mes_fatura?: number
          observacoes?: string | null
          parcela_atual?: number
          parcelado?: boolean
          total_parcelas?: number
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_lancamentos_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes_credito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_contas_pagar: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          nome: string
          padrao: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          padrao?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          padrao?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_contas_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_attempts: {
        Row: {
          created_at: string
          created_by_user_id: string
          empresa_id: string
          expires_at: string | null
          id: string
          idempotency_key: string
          last_error_code: string | null
          livemode: boolean
          provider: string
          provider_checkout_session_id: string | null
          provider_customer_id: string | null
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          empresa_id: string
          expires_at?: string | null
          id?: string
          idempotency_key: string
          last_error_code?: string | null
          livemode: boolean
          provider: string
          provider_checkout_session_id?: string | null
          provider_customer_id?: string | null
          status: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          empresa_id?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string
          last_error_code?: string | null
          livemode?: boolean
          provider?: string
          provider_checkout_session_id?: string | null
          provider_customer_id?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_attempts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_attempts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          empresa_id: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          empresa_id: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          empresa_id?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invitations_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          cnpj: string | null
          company_name: string | null
          logo_url: string | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          company_name?: string | null
          logo_url?: string | null
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cnpj?: string | null
          company_name?: string | null
          logo_url?: string | null
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compras: {
        Row: {
          bank_account_id: string | null
          condicao_pagamento: string
          created_at: string
          data_compra: string
          data_vencimento: string | null
          desconto: number
          dia_vencimento: number | null
          empresa_id: string
          forma_pagamento: string | null
          fornecedor_id: string | null
          frete: number
          id: string
          idempotency_key: string | null
          numero_nf: string | null
          observacoes: string | null
          parcelas: number
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account_id?: string | null
          condicao_pagamento?: string
          created_at?: string
          data_compra?: string
          data_vencimento?: string | null
          desconto?: number
          dia_vencimento?: number | null
          empresa_id: string
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          frete?: number
          id?: string
          idempotency_key?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          parcelas?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account_id?: string | null
          condicao_pagamento?: string
          created_at?: string
          data_compra?: string
          data_vencimento?: string | null
          desconto?: number
          dia_vencimento?: number | null
          empresa_id?: string
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          frete?: number
          id?: string
          idempotency_key?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          parcelas?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compras_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      compras_itens: {
        Row: {
          compra_id: string
          created_at: string
          empresa_id: string
          id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          user_id: string
        }
        Insert: {
          compra_id: string
          created_at?: string
          empresa_id: string
          id?: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          user_id: string
        }
        Update: {
          compra_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compras_itens_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      controle_vendas_diario: {
        Row: {
          ano: number
          created_at: string
          custo: number
          data: string
          empresa_id: string
          frete_cliente: number
          frete_empresa: number
          id: string
          juros_ml: number
          loja: number
          lucro: number
          mes: number
          origem: string
          rateio: number
          receber: number
          sale_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          custo?: number
          data: string
          empresa_id: string
          frete_cliente?: number
          frete_empresa?: number
          id?: string
          juros_ml?: number
          loja?: number
          lucro?: number
          mes: number
          origem?: string
          rateio?: number
          receber?: number
          sale_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          custo?: number
          data?: string
          empresa_id?: string
          frete_cliente?: number
          frete_empresa?: number
          id?: string
          juros_ml?: number
          loja?: number
          lucro?: number
          mes?: number
          origem?: string
          rateio?: number
          receber?: number
          sale_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "controle_vendas_diario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_vendas_diario_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      controle_vendas_fornecedor: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          updated_at: string
          user_id: string
          valor_fornecedor: number
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          updated_at?: string
          user_id: string
          valor_fornecedor?: number
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          updated_at?: string
          user_id?: string
          valor_fornecedor?: number
        }
        Relationships: []
      }
      controle_vendas_fornecedor_historico: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          motivo: string | null
          user_id: string
          valor_anterior: number
          valor_novo: number
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          motivo?: string | null
          user_id: string
          valor_anterior?: number
          valor_novo?: number
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          motivo?: string | null
          user_id?: string
          valor_anterior?: number
          valor_novo?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          aporte_notes: string | null
          aporte_type: string | null
          created_at: string
          credit_limit: number
          customer_type: string
          document: string | null
          email: string | null
          empresa_id: string
          id: string
          name: string
          notes: string | null
          person_type: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          aporte_notes?: string | null
          aporte_type?: string | null
          created_at?: string
          credit_limit?: number
          customer_type?: string
          document?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          name: string
          notes?: string | null
          person_type?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          aporte_notes?: string | null
          aporte_type?: string | null
          created_at?: string
          credit_limit?: number
          customer_type?: string
          document?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          name?: string
          notes?: string | null
          person_type?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_classificacoes: {
        Row: {
          created_at: string
          dre_group: string
          id: string
          justification: string | null
          source_id: string
          source_table: string
          tenant_id: string
          treatment: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dre_group: string
          id?: string
          justification?: string | null
          source_id: string
          source_table: string
          tenant_id: string
          treatment?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          dre_group?: string
          id?: string
          justification?: string | null
          source_id?: string
          source_table?: string
          tenant_id?: string
          treatment?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dre_regras: {
        Row: {
          created_at: string
          dre_group: string
          id: string
          justification: string | null
          match_category: string | null
          match_supplier_id: string | null
          source_table: string
          tenant_id: string
          treatment: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dre_group: string
          id?: string
          justification?: string | null
          match_category?: string | null
          match_supplier_id?: string | null
          source_table: string
          tenant_id: string
          treatment?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          dre_group?: string
          id?: string
          justification?: string | null
          match_category?: string | null
          match_supplier_id?: string | null
          source_table?: string
          tenant_id?: string
          treatment?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          configuracoes: Json | null
          created_at: string
          documento: string | null
          id: string
          logo_url: string | null
          nome: string
          owner_id: string
          parent_id: string | null
          razao_social: string | null
          status: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          configuracoes?: Json | null
          created_at?: string
          documento?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          owner_id: string
          parent_id?: string | null
          razao_social?: string | null
          status?: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          configuracoes?: Json | null
          created_at?: string
          documento?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          owner_id?: string
          parent_id?: string | null
          razao_social?: string | null
          status?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          empresa_id: string
          entry_date: string
          id: string
          sale_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          description?: string | null
          empresa_id: string
          entry_date?: string
          id?: string
          sale_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          empresa_id?: string
          entry_date?: string
          id?: string
          sale_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          amount: number
          bank_account_id: string | null
          category: string
          created_at: string
          description: string
          due_date: string
          empresa_id: string
          id: string
          paid_amount: number
          paid_at: string | null
          payment_method: string | null
          recurrence: string
          status: string
          supplier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category?: string
          created_at?: string
          description: string
          due_date: string
          empresa_id: string
          id?: string
          paid_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          recurrence?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category?: string
          created_at?: string
          description?: string
          due_date?: string
          empresa_id?: string
          id?: string
          paid_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          recurrence?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          event_type: string
          id: string
          payload_sha256: string
          processed_at: string | null
          processing_attempts: number
          processing_status: string
          provider: string
          provider_event_created_at: number | null
          provider_event_id: string
          sanitized_error_code: string | null
          subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          event_type: string
          id?: string
          payload_sha256: string
          processed_at?: string | null
          processing_attempts?: number
          processing_status?: string
          provider: string
          provider_event_created_at?: number | null
          provider_event_id: string
          sanitized_error_code?: string | null
          subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          event_type?: string
          id?: string
          payload_sha256?: string
          processed_at?: string | null
          processing_attempts?: number
          processing_status?: string
          provider?: string
          provider_event_created_at?: number | null
          provider_event_id?: string
          sanitized_error_code?: string | null
          subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_routing_rules: {
        Row: {
          bank_account_id: string | null
          created_at: string
          empresa_id: string
          fixo: boolean
          id: string
          payment_method: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account_id?: string | null
          created_at?: string
          empresa_id: string
          fixo?: boolean
          id?: string
          payment_method: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account_id?: string | null
          created_at?: string
          empresa_id?: string
          fixo?: boolean
          id?: string
          payment_method?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_routing_rules_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_routing_rules_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_onboardings: {
        Row: {
          auth_user_id: string | null
          cnpj_formatado: string | null
          cnpj_limpo: string | null
          consent_version_privacy: string
          consent_version_terms: string
          consented_at: string
          created_at: string
          email_hash: string
          expires_at: string
          id: string
          nome_admin: string
          nome_empresa: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          cnpj_formatado?: string | null
          cnpj_limpo?: string | null
          consent_version_privacy: string
          consent_version_terms: string
          consented_at?: string
          created_at?: string
          email_hash: string
          expires_at: string
          id?: string
          nome_admin: string
          nome_empresa: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          cnpj_formatado?: string | null
          cnpj_limpo?: string | null
          consent_version_privacy?: string
          consent_version_terms?: string
          consented_at?: string
          created_at?: string
          email_hash?: string
          expires_at?: string
          id?: string
          nome_admin?: string
          nome_empresa?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          all_features_enabled: boolean
          amount_cents: number
          billing_interval: string | null
          code: string
          created_at: string | null
          currency: string
          description: string | null
          grace_days: number
          id: string
          is_active: boolean
          is_public: boolean
          max_users: number
          name: string
          priority_suggestions: boolean
          requires_payment_method: boolean
          sort_order: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          trial_days: number
          updated_at: string | null
        }
        Insert: {
          all_features_enabled?: boolean
          amount_cents: number
          billing_interval?: string | null
          code: string
          created_at?: string | null
          currency?: string
          description?: string | null
          grace_days?: number
          id?: string
          is_active?: boolean
          is_public?: boolean
          max_users: number
          name: string
          priority_suggestions?: boolean
          requires_payment_method?: boolean
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_days?: number
          updated_at?: string | null
        }
        Update: {
          all_features_enabled?: boolean
          amount_cents?: number
          billing_interval?: string | null
          code?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          grace_days?: number
          id?: string
          is_active?: boolean
          is_public?: boolean
          max_users?: number
          name?: string
          priority_suggestions?: boolean
          requires_payment_method?: boolean
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_days?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string | null
          category: string | null
          cost_price: number
          created_at: string
          empresa_id: string
          id: string
          image_url: string | null
          min_stock: number
          name: string
          photo_url: string | null
          sale_price: number
          sku: string | null
          status: string
          stock: number
          updated_at: string
          user_id: string
          wholesale_price: number
        }
        Insert: {
          brand?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          empresa_id: string
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          photo_url?: string | null
          sale_price?: number
          sku?: string | null
          status?: string
          stock?: number
          updated_at?: string
          user_id: string
          wholesale_price?: number
        }
        Update: {
          brand?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          empresa_id?: string
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          photo_url?: string | null
          sale_price?: number
          sku?: string | null
          status?: string
          stock?: number
          updated_at?: string
          user_id?: string
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_name: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          expires_at: string
          hits: number | null
          key: string
          last_hit: string | null
        }
        Insert: {
          expires_at: string
          hits?: number | null
          key: string
          last_hit?: string | null
        }
        Update: {
          expires_at?: string
          hits?: number | null
          key?: string
          last_hit?: string | null
        }
        Relationships: []
      }
      receivables: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          customer_id: string | null
          description: string
          due_date: string
          empresa_id: string
          id: string
          notes: string | null
          payment_method: string | null
          received_amount: number
          received_at: string | null
          sale_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          customer_id?: string | null
          description: string
          due_date: string
          empresa_id: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          received_amount?: number
          received_at?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string
          due_date?: string
          empresa_id?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          received_amount?: number
          received_at?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          product_id: string
          quantity: number
          sale_id: string
          unit_cost: number
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          product_id: string
          quantity: number
          sale_id: string
          unit_cost?: number
          unit_price: number
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_cost?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          aporte_type: string | null
          bank_account_id: string | null
          bank_movement_generated: boolean
          channel: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          discount: number
          empresa_id: string
          frete_empresa: number
          id: string
          idempotency_key: string | null
          mercado_pago_fees: number | null
          notes: string | null
          payment_method: string
          sold_at: string
          status: string
          total: number
          user_id: string
        }
        Insert: {
          aporte_type?: string | null
          bank_account_id?: string | null
          bank_movement_generated?: boolean
          channel?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          empresa_id: string
          frete_empresa?: number
          id?: string
          idempotency_key?: string | null
          mercado_pago_fees?: number | null
          notes?: string | null
          payment_method?: string
          sold_at?: string
          status?: string
          total?: number
          user_id: string
        }
        Update: {
          aporte_type?: string | null
          bank_account_id?: string | null
          bank_movement_generated?: boolean
          channel?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          empresa_id?: string
          frete_empresa?: number
          id?: string
          idempotency_key?: string | null
          mercado_pago_fees?: number | null
          notes?: string | null
          payment_method?: string
          sold_at?: string
          status?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_runtime_diagnostics: {
        Row: {
          created_at: string
          event_id_hash: string
          event_type: string
          http_status: number | null
          id: string
          reason_code: string | null
          stage: string
          trace_id: string
        }
        Insert: {
          created_at?: string
          event_id_hash: string
          event_type: string
          http_status?: number | null
          id?: string
          reason_code?: string | null
          stage: string
          trace_id: string
        }
        Update: {
          created_at?: string
          event_id_hash?: string
          event_type?: string
          http_status?: number | null
          id?: string
          reason_code?: string | null
          stage?: string
          trace_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string | null
          current_period_ends_at: string | null
          current_period_started_at: string | null
          empresa_id: string
          grace_ends_at: string | null
          id: string
          last_payment_status: string | null
          plan_id: string
          restricted_at: string | null
          source: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_last_event_created: number | null
          stripe_last_event_id: string | null
          stripe_last_event_priority: number | null
          stripe_last_event_type: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string | null
          current_period_ends_at?: string | null
          current_period_started_at?: string | null
          empresa_id: string
          grace_ends_at?: string | null
          id?: string
          last_payment_status?: string | null
          plan_id: string
          restricted_at?: string | null
          source: string
          status: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_last_event_created?: number | null
          stripe_last_event_id?: string | null
          stripe_last_event_priority?: number | null
          stripe_last_event_type?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string | null
          current_period_ends_at?: string | null
          current_period_started_at?: string | null
          empresa_id?: string
          grace_ends_at?: string | null
          id?: string
          last_payment_status?: string | null
          plan_id?: string
          restricted_at?: string | null
          source?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_last_event_created?: number | null
          stripe_last_event_id?: string | null
          stripe_last_event_priority?: number | null
          stripe_last_event_type?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_name: string | null
          created_at: string
          delivery_days: number | null
          document: string | null
          email: string | null
          empresa_id: string
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          delivery_days?: number | null
          document?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          delivery_days?: number | null
          document?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_access: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          is_primary: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          is_primary?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          is_primary?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_access_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_company_invitation: {
        Args: { _token_hash: string }
        Returns: boolean
      }
      can_company_invite_member: {
        Args: { p_empresa_id: string }
        Returns: Json
      }
      cancel_pending_onboarding: {
        Args: { p_onboarding_id: string }
        Returns: undefined
      }
      check_current_user_is_active_member: {
        Args: { _empresa_id: string }
        Returns: boolean
      }
      check_current_user_is_admin: {
        Args: { _empresa_id: string }
        Returns: boolean
      }
      check_rate_limit_persistent: {
        Args: { _key: string; _limit: number; _window_interval: string }
        Returns: boolean
      }
      cleanup_expired_auth_rate_limits: { Args: never; Returns: undefined }
      create_pending_onboarding:
        | {
            Args: {
              _cnpj_formatado: string
              _cnpj_limpo: string
              _email_hash: string
              _nome_admin: string
              _nome_empresa: string
              _privacy_version: string
              _terms_version: string
            }
            Returns: string
          }
        | {
            Args: {
              p_cnpj_formatado: string
              p_cnpj_limpo: string
              p_email_hash: string
              p_expires_in_hours?: number
              p_nome_admin: string
              p_nome_empresa: string
              p_privacy_version: string
              p_terms_version: string
            }
            Returns: string
          }
      ensure_default_routing: { Args: { _user_id: string }; Returns: undefined }
      ensure_empresa_defaults: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: undefined
      }
      fail_checkout_attempt_initialization: {
        Args: {
          p_attempt_id: string
          p_empresa_id: string
          p_expected_updated_at: string
          p_livemode: boolean
          p_reason_code: string
          p_subscription_id: string
        }
        Returns: string
      }
      finalize_checkout_attempt: {
        Args: {
          p_attempt_id: string
          p_empresa_id: string
          p_expires_at: string
          p_provider_session_id: string
          p_subscription_id: string
        }
        Returns: {
          created_at: string
          created_by_user_id: string
          empresa_id: string
          expires_at: string | null
          id: string
          idempotency_key: string
          last_error_code: string | null
          livemode: boolean
          provider: string
          provider_checkout_session_id: string | null
          provider_customer_id: string | null
          status: string
          subscription_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "checkout_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_checkout_attempt_v2: {
        Args: {
          p_attempt_id: string
          p_expires_at: string
          p_provider: string
          p_provider_checkout_session_id: string
        }
        Returns: Json
      }
      finalize_user_onboarding:
        | { Args: { p_auth_user_id: string }; Returns: Json }
        | {
            Args: { p_auth_user_id: string; p_onboarding_id: string }
            Returns: Json
          }
      get_auth_rate_limit_status: {
        Args: {
          p_identity_hash: string
          p_identity_kind: string
          p_scope: string
        }
        Returns: {
          escalation_level: number
          failure_count: number
          is_blocked: boolean
          retry_after_seconds: number
        }[]
      }
      get_company_subscription_context_admin: {
        Args: { p_empresa_id: string; p_verified_user_id: string }
        Returns: Json
      }
      get_my_multiempresa_context: {
        Args: never
        Returns: {
          empresa_id: string
          is_primary: boolean
          nome: string
          razao_social: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          tipo: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_company: {
        Args: {
          _empresa_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_auth_user_to_onboarding: {
        Args: { p_auth_user_id: string; p_onboarding_id: string }
        Returns: undefined
      }
      list_my_company_members: {
        Args: { p_empresa_id: string }
        Returns: {
          created_at: string
          is_primary: boolean
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
        }[]
      }
      log_stripe_webhook_diagnostic: {
        Args: {
          p_event_id_hash: string
          p_event_type: string
          p_http_status?: number
          p_reason_code?: string
          p_stage: string
          p_trace_id: string
        }
        Returns: undefined
      }
      process_stripe_checkout_session_expired: {
        Args: {
          p_event_created: number
          p_livemode: boolean
          p_payload_sha256: string
          p_provider_event_id: string
          p_provider_session_id: string
        }
        Returns: string
      }
      process_stripe_webhook_event: {
        Args: {
          p_canonical_amount?: number
          p_canonical_currency?: string
          p_canonical_plan_code?: string
          p_canonical_price_id?: string
          p_event_created: number
          p_event_data: Json
          p_event_type: string
          p_livemode: boolean
          p_payload_sha256: string
          p_provider_event_id: string
        }
        Returns: Json
      }
      purge_expired_stripe_webhook_runtime_diagnostics: {
        Args: never
        Returns: undefined
      }
      reconcile_and_finalize_onboarding: { Args: never; Returns: Json }
      record_auth_failure: {
        Args: {
          p_cooldown_minutes: number[]
          p_identity_hash: string
          p_identity_kind: string
          p_limit: number
          p_scope: string
          p_window_ms: number
        }
        Returns: {
          new_escalation_level: number
          new_failure_count: number
          retry_after_seconds: number
        }[]
      }
      reserve_checkout_attempt:
        | {
            Args: {
              p_empresa_id: string
              p_livemode: boolean
              p_provider?: string
              p_subscription_id: string
              p_verified_user_id: string
            }
            Returns: {
              created_at: string
              created_by_user_id: string
              empresa_id: string
              expires_at: string | null
              id: string
              idempotency_key: string
              last_error_code: string | null
              livemode: boolean
              provider: string
              provider_checkout_session_id: string | null
              provider_customer_id: string | null
              status: string
              subscription_id: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "checkout_attempts"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_empresa_id: string
              p_provider?: string
              p_subscription_id: string
              p_verified_user_id: string
            }
            Returns: {
              created_at: string
              created_by_user_id: string
              empresa_id: string
              expires_at: string | null
              id: string
              idempotency_key: string
              last_error_code: string | null
              livemode: boolean
              provider: string
              provider_checkout_session_id: string | null
              provider_customer_id: string | null
              status: string
              subscription_id: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "checkout_attempts"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      reset_auth_rate_limit: {
        Args: {
          p_identity_hash: string
          p_identity_kind: string
          p_scope: string
        }
        Returns: undefined
      }
      rpc_editar_compra_pendente: {
        Args: {
          _compra_id: string
          _condicao: string
          _data_compra: string
          _data_primeira: string
          _desconto: number
          _expected_updated_at: string
          _fornecedor_id: string
          _frete: number
          _itens: Json
          _numero_nf: string
          _observacoes: string
          _parcelas: number
        }
        Returns: Json
      }
      rpc_registrar_compra: {
        Args: {
          p_empresa_id: string
          p_idempotency_key: string
          p_items: Database["public"]["CompositeTypes"]["rpc_purchase_item_input"][]
          p_payables: Database["public"]["CompositeTypes"]["rpc_purchase_payable_input"][]
          p_payload: Json
        }
        Returns: string
      }
      rpc_registrar_venda: {
        Args: {
          p_empresa_id: string
          p_idempotency_key: string
          p_items: Database["public"]["CompositeTypes"]["rpc_sale_item_input"][]
          p_payload: Json
        }
        Returns: string
      }
      seed_default_categorias_contas_pagar: {
        Args: { _user_id: string }
        Returns: undefined
      }
      sync_cvd_from_sale: { Args: { _sale_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "financeiro"
    }
    CompositeTypes: {
      rpc_purchase_item_input: {
        produto_id: string | null
        quantidade: number | null
        preco_unitario: number | null
      }
      rpc_purchase_payable_input: {
        description: string | null
        amount: number | null
        due_date: string | null
        status: string | null
        paid_amount: number | null
        paid_at: string | null
        bank_account_id: string | null
      }
      rpc_sale_item_input: {
        product_id: string | null
        quantity: number | null
        unit_price: number | null
        unit_cost: number | null
      }
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
    Enums: {
      app_role: ["admin", "vendedor", "financeiro"],
    },
  },
} as const
