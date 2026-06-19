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
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          agency: string | null
          bank: string
          color: string
          created_at: string
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
          id?: string
          initial_balance?: number
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_movements: {
        Row: {
          account_id: string
          amount: number
          category: string
          created_at: string
          description: string
          destination_account_id: string | null
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
        ]
      }
      cartoes_faturas: {
        Row: {
          ano: number
          cartao_id: string
          created_at: string
          data_pagamento: string | null
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
        ]
      }
      cartoes_lancamentos: {
        Row: {
          ano_fatura: number
          cartao_id: string
          categoria: string
          created_at: string
          data: string
          descricao: string
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
          descricao: string
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
          descricao?: string
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
        ]
      }
      categorias_contas_pagar: {
        Row: {
          created_at: string
          id: string
          nome: string
          padrao: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          padrao?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          padrao?: boolean
          user_id?: string
        }
        Relationships: []
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
          forma_pagamento: string | null
          fornecedor_id: string | null
          frete: number
          id: string
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
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          frete?: number
          id?: string
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
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          frete?: number
          id?: string
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
          frete_cliente: number
          frete_empresa: number
          id: string
          juros_ml: number
          loja: number
          lucro: number
          mes: number
          rateio: number
          receber: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          custo?: number
          data: string
          frete_cliente?: number
          frete_empresa?: number
          id?: string
          juros_ml?: number
          loja?: number
          lucro?: number
          mes: number
          rateio?: number
          receber?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          custo?: number
          data?: string
          frete_cliente?: number
          frete_empresa?: number
          id?: string
          juros_ml?: number
          loja?: number
          lucro?: number
          mes?: number
          rateio?: number
          receber?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        Relationships: []
      }
      finance_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
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
          entry_date?: string
          id?: string
          sale_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
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
            foreignKeyName: "payables_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_routing_rules: {
        Row: {
          bank_account_id: string | null
          created_at: string
          fixo: boolean
          id: string
          payment_method: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account_id?: string | null
          created_at?: string
          fixo?: boolean
          id?: string
          payment_method: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account_id?: string | null
          created_at?: string
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
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string | null
          cost_price: number
          created_at: string
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
        Relationships: []
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
      receivables: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          customer_id: string | null
          description: string
          due_date: string
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
          channel: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          discount: number
          id: string
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
          channel?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          id?: string
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
          channel?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          id?: string
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
        ]
      }
      suppliers: {
        Row: {
          contact_name: string | null
          created_at: string
          delivery_days: number | null
          document: string | null
          email: string | null
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
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      ensure_default_routing: { Args: { _user_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      seed_default_categorias_contas_pagar: {
        Args: { _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "financeiro"
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
    Enums: {
      app_role: ["admin", "vendedor", "financeiro"],
    },
  },
} as const
