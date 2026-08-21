-- VEJAMAIS ERP — CANONICAL BASELINE CANDIDATE v1
-- Phase 2-D certified for controlled application exclusively to empty Supabase staging hoalgniwydgydqaugqph; executable SQL unchanged.
-- Synthesized statically from 173 byte-attested historical migrations.
-- Operational DML, historical data corrections, blog pilot objects, private incident
-- snapshots, duplicate migrations and test RPCs are intentionally excluded.


CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'financeiro');

CREATE TYPE public.rpc_sale_item_input AS (
  product_id uuid,
  quantity numeric,
  unit_price numeric,
  unit_cost numeric
);

CREATE TYPE public.rpc_purchase_item_input AS (
  produto_id uuid,
  quantidade numeric,
  preco_unitario numeric
);

CREATE TYPE public.rpc_purchase_payable_input AS (
  description text,
  amount numeric,
  due_date date,
  status text,
  paid_amount numeric,
  paid_at timestamptz,
  bank_account_id uuid
);

-- source: 20260620005951_3c08501e-92ee-43eb-b230-7a801bafb8dc.sql | object: public.audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  table_name text NOT NULL,
  op text NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  row_id uuid,
  old_data jsonb,
  new_data jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

-- source: 20260807222045_4c51f9a1-8aae-420e-896b-d247b76e118b.sql | object: public.auth_rate_limits
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL,
    identity_kind TEXT NOT NULL,
    identity_hash TEXT NOT NULL,
    failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    escalation_level INTEGER NOT NULL DEFAULT 0 CHECK (escalation_level >= 0),
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    blocked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(scope, identity_kind, identity_hash)
);

-- source: 20260617012255_d7e23bc3-3295-4778-b4fb-1e2f704b45c0.sql | object: public.bank_accounts
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  bank text NOT NULL,
  account_type text NOT NULL DEFAULT 'corrente' CHECK (account_type IN ('corrente','poupanca','digital')),
  agency text,
  account_number text,
  initial_balance numeric(14,2) NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#ec4899',
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','inativa')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- source: 20260617221702_08d2fa92-e44a-4958-9cf8-b75653eb06d9.sql | object: public.categorias_contas_pagar
CREATE TABLE public.categorias_contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome)
);

-- source: 20260616215411_25ada916-2e42-410c-a1a9-a47819029dce.sql | object: public.company_settings
CREATE TABLE public.company_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text,
  cnpj text,
  logo_url text,
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- source: 20260617002237_80220513-bc4e-43be-b99e-a474b31267e4.sql | object: public.controle_vendas_diario
CREATE TABLE public.controle_vendas_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data date NOT NULL,
  mes integer NOT NULL,
  ano integer NOT NULL,
  loja numeric(12,2) NOT NULL DEFAULT 0,
  custo numeric(12,2) NOT NULL DEFAULT 0,
  juros_ml numeric(12,2) NOT NULL DEFAULT 0,
  frete_empresa numeric(12,2) NOT NULL DEFAULT 0,
  frete_cliente numeric(12,2) NOT NULL DEFAULT 0,
  receber numeric(12,2) NOT NULL DEFAULT 0,
  rateio numeric(12,2) NOT NULL DEFAULT 0,
  lucro numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- source: 20260617002237_80220513-bc4e-43be-b99e-a474b31267e4.sql | object: public.controle_vendas_fornecedor
CREATE TABLE public.controle_vendas_fornecedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes integer NOT NULL,
  ano integer NOT NULL,
  valor_fornecedor numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mes, ano)
);

-- source: 20260617204956_e3fa217e-6550-4efa-95c4-43cec18c18f5.sql | object: public.controle_vendas_fornecedor_historico
CREATE TABLE public.controle_vendas_fornecedor_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes integer NOT NULL,
  ano integer NOT NULL,
  valor_anterior numeric(14,2) NOT NULL DEFAULT 0,
  valor_novo numeric(14,2) NOT NULL DEFAULT 0,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | object: public.customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  person_type TEXT NOT NULL DEFAULT 'pf' CHECK (person_type IN ('pf','pj')),
  document TEXT,
  customer_type TEXT NOT NULL DEFAULT 'varejo' CHECK (customer_type IN ('varejo','atacado')),
  email TEXT,
  phone TEXT,
  zip TEXT,
  address TEXT,
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | object: public.dre_classificacoes
CREATE TABLE public.dre_classificacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  dre_group text NOT NULL,
  treatment text NOT NULL DEFAULT 'DRE',
  justification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dre_class_source_table_chk CHECK (source_table IN ('payables','receivables','sales','sale_items','compras','cartoes_lancamentos','bank_movements','finance_entries')),
  CONSTRAINT dre_class_treatment_chk CHECK (treatment IN ('DRE','FORA_DRE')),
  CONSTRAINT dre_class_group_chk CHECK (dre_group IN (
    'RECEITA_PRODUTOS','RECEITA_SERVICOS','RECEITA_FRETE','RECEITA_OUTRAS',
    'DEDUCAO_DESCONTO','DEDUCAO_DEVOLUCAO','DEDUCAO_CANCELAMENTO','DEDUCAO_TRIBUTO',
    'CMV','DESP_COMERCIAL','DESP_LOGISTICA','DESP_ADMINISTRATIVA','DESP_MANUTENCAO_TI',
    'DESP_PESSOAL','DESP_OCUPACAO','DESP_TRIBUTARIA','DESP_OUTRAS',
    'DEPRECIACAO','REC_FINANCEIRA','DESP_FINANCEIRA','IRPJ_CSLL',
    'FORA_PESSOAL_SOCIOS','FORA_ESTOQUE_ATIVO','FORA_LIQUIDACAO','FORA_APORTE','NAO_CLASSIFICADO'
  )),
  CONSTRAINT dre_class_unq UNIQUE (tenant_id, source_table, source_id)
);

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | object: public.dre_regras
CREATE TABLE public.dre_regras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  source_table text NOT NULL,
  match_category text,
  match_supplier_id uuid,
  dre_group text NOT NULL,
  treatment text NOT NULL DEFAULT 'DRE',
  justification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dre_regras_source_table_chk CHECK (source_table IN ('payables','receivables','sales','compras','cartoes_lancamentos')),
  CONSTRAINT dre_regras_treatment_chk CHECK (treatment IN ('DRE','FORA_DRE')),
  CONSTRAINT dre_regras_group_chk CHECK (dre_group IN (
    'RECEITA_PRODUTOS','RECEITA_SERVICOS','RECEITA_FRETE','RECEITA_OUTRAS',
    'DEDUCAO_DESCONTO','DEDUCAO_DEVOLUCAO','DEDUCAO_CANCELAMENTO','DEDUCAO_TRIBUTO',
    'CMV','DESP_COMERCIAL','DESP_LOGISTICA','DESP_ADMINISTRATIVA','DESP_MANUTENCAO_TI',
    'DESP_PESSOAL','DESP_OCUPACAO','DESP_TRIBUTARIA','DESP_OUTRAS',
    'DEPRECIACAO','REC_FINANCEIRA','DESP_FINANCEIRA','IRPJ_CSLL',
    'FORA_PESSOAL_SOCIOS','FORA_ESTOQUE_ATIVO','FORA_LIQUIDACAO','FORA_APORTE','NAO_CLASSIFICADO'
  )),
  CONSTRAINT dre_regras_match_chk CHECK (match_category IS NOT NULL OR match_supplier_id IS NOT NULL)
);

-- source: 20260806000000_vmeap_wave_a_structural.sql | object: public.empresas
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    documento TEXT, -- CNPJ/CPF
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    owner_id UUID REFERENCES auth.users(id) NOT NULL
);

-- source: 20260807224646_3a0e178a-3af3-4776-aed1-dc7695a9136a.sql | object: public.pending_onboardings
CREATE TABLE IF NOT EXISTS public.pending_onboardings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID, -- Vinculado após inviteUserByEmail
    nome_admin TEXT NOT NULL,
    nome_empresa TEXT NOT NULL,
    cnpj_formatado TEXT,
    cnpj_limpo TEXT,
    email_hash TEXT NOT NULL, -- HMAC-SHA256 do e-mail para busca segura
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'activated', 'expired', 'cancelled')),
    consent_version_terms TEXT NOT NULL,
    consent_version_privacy TEXT NOT NULL,
    consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- source: 20260808211557_0e6933d5-b96f-42c2-b37a-e6835149ea31.sql | object: public.plans
CREATE TABLE IF NOT EXISTS public.plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    description text,
    amount_cents integer NOT NULL CHECK (amount_cents >= 0),
    currency text NOT NULL DEFAULT 'BRL',
    billing_interval text CHECK (billing_interval IN ('month', 'year', NULL)),
    trial_days integer NOT NULL DEFAULT 0,
    grace_days integer NOT NULL DEFAULT 0,
    max_users integer NOT NULL,
    all_features_enabled boolean NOT NULL DEFAULT true,
    priority_suggestions boolean NOT NULL DEFAULT false,
    requires_payment_method boolean NOT NULL DEFAULT false,
    stripe_product_id text UNIQUE,
    stripe_price_id text UNIQUE,
    is_public boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | object: public.products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | object: public.profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  business_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- source: 20260813173838_4ee7a7ca-e540-4b92-a5d2-346ae1bec401.sql | object: public.rate_limits
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    hits INTEGER DEFAULT 1,
    last_hit TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | object: public.sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT,
  payment_method TEXT NOT NULL DEFAULT 'dinheiro',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- source: 20260810223044_10e683fa-8346-4c15-b61c-63442c18203e.sql | object: public.stripe_webhook_runtime_diagnostics
CREATE TABLE public.stripe_webhook_runtime_diagnostics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id uuid NOT NULL,
    event_id_hash text NOT NULL,
    event_type text NOT NULL,
    stage text NOT NULL,
    reason_code text,
    http_status int,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | object: public.suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  delivery_days INTEGER DEFAULT 0,
  payment_terms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- source: 20260616215411_25ada916-2e42-410c-a1a9-a47819029dce.sql | object: public.user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- source: 20260617012255_d7e23bc3-3295-4778-b4fb-1e2f704b45c0.sql | object: public.bank_movements
CREATE TABLE public.bank_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  movement_date date NOT NULL DEFAULT (now()::date),
  type text NOT NULL CHECK (type IN ('entrada','saida','transferencia')),
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  destination_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','payable','receivable','transfer')),
  reference_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- source: 20260618003809_45d879f6-9304-417c-8d89-550d5a3fd24c.sql | object: public.cartoes_credito
CREATE TABLE public.cartoes_credito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  bandeira text NOT NULL,
  limite_total numeric(14,2) NOT NULL DEFAULT 0,
  dia_vencimento integer NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  dia_fechamento integer NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  cor text NOT NULL DEFAULT '#7c3aed',
  conta_bancaria_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- source: 20260806235353_017bf93e-5b22-4892-b934-c198d5c6d7ac.sql | object: public.company_invitations
CREATE TABLE IF NOT EXISTS public.company_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.app_role NOT NULL DEFAULT 'vendedor',
    token_hash TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ
);

-- source: 20260618005921_414315c7-4ece-4d34-bac6-e710a982434e.sql | object: public.compras
CREATE TABLE public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fornecedor_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  data_compra date NOT NULL DEFAULT CURRENT_DATE,
  numero_nf text,
  condicao_pagamento text NOT NULL DEFAULT 'a_vista',
  forma_pagamento text,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  parcelas integer NOT NULL DEFAULT 1,
  dia_vencimento integer,
  data_vencimento date,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(12,2) NOT NULL DEFAULT 0,
  frete numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  observacoes text,
  status text NOT NULL DEFAULT 'confirmada',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | object: public.finance_entries
CREATE TABLE public.finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category TEXT NOT NULL DEFAULT 'outros',
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  entry_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | object: public.payables
CREATE TABLE public.payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'fornecedor',
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado','cancelado')),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  recurrence TEXT NOT NULL DEFAULT 'nenhuma' CHECK (recurrence IN ('nenhuma','semanal','mensal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- source: 20260617014243_516061f3-55a6-45c7-8403-d7b9f1e0f41f.sql | object: public.payment_routing_rules
CREATE TABLE IF NOT EXISTS public.payment_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method text NOT NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  fixo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, payment_method)
);

-- source: 20260616214246_53c304ae-016a-44fe-86ce-7d7427d857d9.sql | object: public.receivables
CREATE TABLE public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  received_amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  received_at timestamptz,
  payment_method text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','recebido','parcial','atrasado','cancelado')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | object: public.sale_items
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- source: 20260808211557_0e6933d5-b96f-42c2-b37a-e6835149ea31.sql | object: public.subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id uuid NOT NULL REFERENCES public.empresas(id),
    plan_id uuid NOT NULL REFERENCES public.plans(id),
    status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'grace_read_only', 'restricted', 'incomplete', 'canceled')),
    source text NOT NULL CHECK (source IN ('onboarding', 'stripe', 'legacy', 'administrative')),
    trial_started_at timestamptz,
    trial_ends_at timestamptz,
    grace_ends_at timestamptz,
    current_period_started_at timestamptz,
    current_period_ends_at timestamptz,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    canceled_at timestamptz,
    restricted_at timestamptz,
    stripe_customer_id text UNIQUE,
    stripe_subscription_id text UNIQUE,
    stripe_checkout_session_id text UNIQUE,
    last_payment_status text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- source: 20260806000000_vmeap_wave_a_structural.sql | object: public.user_company_access
CREATE TABLE IF NOT EXISTS public.user_company_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL DEFAULT 'vendedor',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, empresa_id)
);

-- source: 20260619235639_ea8cd248-5c49-4ff7-b04a-5510f2b202dd.sql | object: public.aportes_financeiros
CREATE TABLE IF NOT EXISTS public.aportes_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  bank_movement_id uuid REFERENCES public.bank_movements(id) ON DELETE SET NULL,
  aporte_type text NOT NULL DEFAULT 'investidor',
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'recebido',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- source: 20260618003809_45d879f6-9304-417c-8d89-550d5a3fd24c.sql | object: public.cartoes_faturas
CREATE TABLE public.cartoes_faturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id uuid NOT NULL REFERENCES public.cartoes_credito(id) ON DELETE CASCADE,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano integer NOT NULL,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberta',
  data_pagamento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cartao_id, ano, mes)
);

-- source: 20260618003809_45d879f6-9304-417c-8d89-550d5a3fd24c.sql | object: public.cartoes_lancamentos
CREATE TABLE public.cartoes_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id uuid NOT NULL REFERENCES public.cartoes_credito(id) ON DELETE CASCADE,
  data date NOT NULL,
  descricao text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('combustivel','casa','pessoal')),
  valor numeric(14,2) NOT NULL,
  parcelado boolean NOT NULL DEFAULT false,
  total_parcelas integer NOT NULL DEFAULT 1,
  parcela_atual integer NOT NULL DEFAULT 1,
  grupo_parcela uuid,
  mes_fatura integer NOT NULL,
  ano_fatura integer NOT NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- source: 20260809032053_ec238ebc-e305-426e-98cb-36000d5ce04e.sql | object: public.checkout_attempts
CREATE TABLE public.checkout_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id),
    created_by_user_id UUID NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    provider_checkout_session_id TEXT UNIQUE,
    provider_customer_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('creating', 'open', 'completed', 'expired', 'cancelled', 'failed')),
    expires_at TIMESTAMPTZ,
    last_error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- source: 20260618005921_414315c7-4ece-4d34-bac6-e710a982434e.sql | object: public.compras_itens
CREATE TABLE public.compras_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  compra_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantidade numeric(12,3) NOT NULL,
  preco_unitario numeric(12,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- source: 20260808211557_0e6933d5-b96f-42c2-b37a-e6835149ea31.sql | object: public.payment_events
CREATE TABLE IF NOT EXISTS public.payment_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    provider_event_id text NOT NULL UNIQUE,
    event_type text NOT NULL,
    empresa_id uuid REFERENCES public.empresas(id),
    subscription_id uuid REFERENCES public.subscriptions(id),
    payload_sha256 text NOT NULL,
    processing_status text NOT NULL DEFAULT 'pending',
    processing_attempts integer NOT NULL DEFAULT 0,
    processed_at timestamptz,
    sanitized_error_code text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | structural projection: public.sales
ALTER TABLE public.sales
  ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN channel TEXT NOT NULL DEFAULT 'varejo' CHECK (channel IN ('varejo','atacado')),
  ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('orcamento','confirmado','separacao','enviado','entregue','cancelado'));

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | structural projection: public.products
ALTER TABLE public.products
  ADD COLUMN sku TEXT,
  ADD COLUMN wholesale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN image_url TEXT,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo'));

-- source: 20260616215411_25ada916-2e42-410c-a1a9-a47819029dce.sql | structural projection: public.products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS photo_url text;

-- source: 20260617012255_d7e23bc3-3295-4778-b4fb-1e2f704b45c0.sql | structural projection: public.payables
ALTER TABLE public.payables ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- source: 20260617012255_d7e23bc3-3295-4778-b4fb-1e2f704b45c0.sql | structural projection: public.receivables
ALTER TABLE public.receivables ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- source: 20260617015858_c2f9e7bb-c94b-43dd-96e5-458de759606c.sql | structural projection: public.sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- source: 20260617020940_25c0c4d7-74e8-4f0c-84e7-3696025a11ad.sql | structural projection: public.bank_movements
ALTER TABLE public.bank_movements DROP CONSTRAINT IF EXISTS bank_movements_origin_check;

-- source: 20260618140528_253f68bf-d2b4-4bdb-9bcc-7489c267c073.sql | structural projection: public.sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS mercado_pago_fees NUMERIC DEFAULT 0;

-- source: 20260618183655_c6bd5232-4ec3-4f3b-b506-ab732ba174cc.sql | structural projection: public.cartoes_lancamentos
ALTER TABLE public.cartoes_lancamentos DROP CONSTRAINT IF EXISTS cartoes_lancamentos_categoria_check;

-- source: 20260618183655_c6bd5232-4ec3-4f3b-b506-ab732ba174cc.sql | structural projection: public.cartoes_lancamentos
ALTER TABLE public.cartoes_lancamentos ADD CONSTRAINT cartoes_lancamentos_categoria_check CHECK (categoria = ANY (ARRAY['combustivel'::text, 'casa'::text, 'pessoal'::text, 'fornecedores'::text]));

-- source: 20260619184948_90fa7661-9a75-4b9b-a8c2-e1c4d608f565.sql | structural projection: public.bank_movements
ALTER TABLE public.bank_movements ADD CONSTRAINT bank_movements_origin_check CHECK (origin = ANY (ARRAY['manual'::text, 'payable'::text, 'receivable'::text, 'transfer'::text, 'saldo_inicial'::text, 'sale'::text, 'sale_cancellation'::text, 'cartao_fatura'::text]));

-- source: 20260619234315_d44b6ca6-d2b7-402d-bca3-be71412a207b.sql | structural projection: public.customers
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS aporte_type text,
  ADD COLUMN IF NOT EXISTS aporte_notes text;

-- source: 20260619234315_d44b6ca6-d2b7-402d-bca3-be71412a207b.sql | structural projection: public.sales
ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS aporte_type text;

-- source: 20260620000257_548da6ff-f3f7-4a3f-b395-f3a40913f566.sql | structural projection: public.customers
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_customer_type_check;

-- source: 20260620000257_548da6ff-f3f7-4a3f-b395-f3a40913f566.sql | structural projection: public.customers
ALTER TABLE public.customers ADD CONSTRAINT customers_customer_type_check CHECK (customer_type IN ('atacado','varejo','recursos_financeiros'));

-- source: 20260620000257_548da6ff-f3f7-4a3f-b395-f3a40913f566.sql | structural projection: public.sales
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_channel_check;

-- source: 20260620000257_548da6ff-f3f7-4a3f-b395-f3a40913f566.sql | structural projection: public.sales
ALTER TABLE public.sales ADD CONSTRAINT sales_channel_check CHECK (channel IN ('atacado','varejo','recursos_financeiros'));

-- source: 20260620001255_b27ec4e3-e2b7-4007-b545-9e608ce8fee7.sql | structural projection: public.cartoes_lancamentos
ALTER TABLE public.cartoes_lancamentos ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- source: 20260620162259_98a46119-7d6b-4770-9c89-e0d6c7ff6e6e.sql | structural projection: public.controle_vendas_diario
ALTER TABLE public.controle_vendas_diario
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

-- source: 20260620162259_98a46119-7d6b-4770-9c89-e0d6c7ff6e6e.sql | structural projection: public.controle_vendas_diario
ALTER TABLE public.controle_vendas_diario
  DROP CONSTRAINT IF EXISTS controle_vendas_diario_origem_check;

-- source: 20260620162259_98a46119-7d6b-4770-9c89-e0d6c7ff6e6e.sql | structural projection: public.controle_vendas_diario
ALTER TABLE public.controle_vendas_diario
  ADD CONSTRAINT controle_vendas_diario_origem_check
  CHECK (origem IN ('manual','venda_automatica'));

-- source: 20260622193807_0a286ca0-2c0a-4dab-ae34-0bb16fdfdb5e.sql | structural projection: public.sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS frete_empresa numeric(12,2) NOT NULL DEFAULT 0;

-- source: 20260702204229_ee2188fa-d547-4e26-957d-0e34a612abcc.sql | structural projection: public.sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS bank_movement_generated boolean NOT NULL DEFAULT false;

-- source: 20260729004655_7da4e2ac-e294-4f09-9ec3-2899bd3d9be6.sql | structural projection: public.dre_classificacoes
ALTER TABLE public.dre_classificacoes DROP CONSTRAINT dre_class_group_chk;

-- source: 20260729004655_7da4e2ac-e294-4f09-9ec3-2899bd3d9be6.sql | structural projection: public.dre_classificacoes
ALTER TABLE public.dre_classificacoes ADD CONSTRAINT dre_class_group_chk CHECK (dre_group = ANY (ARRAY['RECEITA_PRODUTOS','RECEITA_SERVICOS','RECEITA_FRETE','RECEITA_OUTRAS','DEDUCAO_DESCONTO','DEDUCAO_DEVOLUCAO','DEDUCAO_CANCELAMENTO','DEDUCAO_TRIBUTO','CMV','DESP_COMERCIAL','DESP_LOGISTICA','DESP_ADMINISTRATIVA','DESP_MANUTENCAO_TI','DESP_PESSOAL','DESP_OCUPACAO','DESP_TRIBUTARIA','DESP_OUTRAS','DEPRECIACAO','REC_FINANCEIRA','DESP_FINANCEIRA','IRPJ_CSLL','FORA_PESSOAL_SOCIOS','FORA_ESTORNO_PESSOAL','FORA_ESTOQUE_ATIVO','FORA_LIQUIDACAO','FORA_APORTE','NAO_CLASSIFICADO']::text[]));

-- source: 20260729004655_7da4e2ac-e294-4f09-9ec3-2899bd3d9be6.sql | structural projection: public.dre_regras
ALTER TABLE public.dre_regras DROP CONSTRAINT dre_regras_group_chk;

-- source: 20260729004655_7da4e2ac-e294-4f09-9ec3-2899bd3d9be6.sql | structural projection: public.dre_regras
ALTER TABLE public.dre_regras ADD CONSTRAINT dre_regras_group_chk CHECK (dre_group = ANY (ARRAY['RECEITA_PRODUTOS','RECEITA_SERVICOS','RECEITA_FRETE','RECEITA_OUTRAS','DEDUCAO_DESCONTO','DEDUCAO_DEVOLUCAO','DEDUCAO_CANCELAMENTO','DEDUCAO_TRIBUTO','CMV','DESP_COMERCIAL','DESP_LOGISTICA','DESP_ADMINISTRATIVA','DESP_MANUTENCAO_TI','DESP_PESSOAL','DESP_OCUPACAO','DESP_TRIBUTARIA','DESP_OUTRAS','DEPRECIACAO','REC_FINANCEIRA','DESP_FINANCEIRA','IRPJ_CSLL','FORA_PESSOAL_SOCIOS','FORA_ESTORNO_PESSOAL','FORA_ESTOQUE_ATIVO','FORA_LIQUIDACAO','FORA_APORTE','NAO_CLASSIFICADO']::text[]));

-- source: 20260806235353_017bf93e-5b22-4892-b934-c198d5c6d7ac.sql | structural projection: public.empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS razao_social TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'matriz',
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.empresas(id),
ADD COLUMN IF NOT EXISTS configuracoes JSONB DEFAULT '{}'::jsonb;

-- source: 20260806235353_017bf93e-5b22-4892-b934-c198d5c6d7ac.sql | structural projection: public.user_company_access
ALTER TABLE public.user_company_access 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- source: 20260806235353_017bf93e-5b22-4892-b934-c198d5c6d7ac.sql | structural projection: public.company_invitations
ALTER TABLE public.company_invitations DROP CONSTRAINT IF EXISTS company_invitations_status_check;

-- source: 20260806235353_017bf93e-5b22-4892-b934-c198d5c6d7ac.sql | structural projection: public.company_invitations
ALTER TABLE public.company_invitations ADD CONSTRAINT company_invitations_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));

-- source: 20260807000150_9c67a433-eaf9-43b9-9ae2-578bb84da29a.sql | structural projection: public.controle_vendas_diario
ALTER TABLE public.controle_vendas_diario ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- source: 20260807000150_9c67a433-eaf9-43b9-9ae2-578bb84da29a.sql | structural projection: public.controle_vendas_diario
ALTER TABLE public.controle_vendas_diario ALTER COLUMN empresa_id SET NOT NULL;

-- source: 20260808164303_659f4c89-ac74-4aca-8faa-fa5ac53e4436.sql | structural projection: public.payment_routing_rules
ALTER TABLE public.payment_routing_rules ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.payment_routing_rules DROP CONSTRAINT IF EXISTS payment_routing_rules_user_id_payment_method_key;

-- source: 20260808164303_659f4c89-ac74-4aca-8faa-fa5ac53e4436.sql | structural projection: public.payment_routing_rules
ALTER TABLE public.payment_routing_rules ADD CONSTRAINT payment_routing_rules_empresa_id_payment_method_key UNIQUE (empresa_id, payment_method);

-- source: 20260808164303_659f4c89-ac74-4aca-8faa-fa5ac53e4436.sql | structural projection: public.categorias_contas_pagar
ALTER TABLE public.categorias_contas_pagar ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.categorias_contas_pagar DROP CONSTRAINT IF EXISTS categorias_contas_pagar_user_id_nome_key;

-- source: 20260808164303_659f4c89-ac74-4aca-8faa-fa5ac53e4436.sql | structural projection: public.categorias_contas_pagar
ALTER TABLE public.categorias_contas_pagar ADD CONSTRAINT categorias_contas_pagar_empresa_id_nome_key UNIQUE (empresa_id, nome);

-- source: 20260809004556_05f33495-f316-4387-a9ce-4d3d9e7faef2.sql | structural projection: public.payment_events
ALTER TABLE public.payment_events ALTER COLUMN provider SET NOT NULL;

-- source: 20260809004556_05f33495-f316-4387-a9ce-4d3d9e7faef2.sql | structural projection: public.payment_events
ALTER TABLE public.payment_events ALTER COLUMN provider_event_id SET NOT NULL;

-- source: 20260809004556_05f33495-f316-4387-a9ce-4d3d9e7faef2.sql | structural projection: public.payment_events
ALTER TABLE public.payment_events DROP CONSTRAINT IF EXISTS payment_events_provider_event_id_key;

-- source: 20260809004556_05f33495-f316-4387-a9ce-4d3d9e7faef2.sql | structural projection: public.payment_events
ALTER TABLE public.payment_events ADD CONSTRAINT payment_events_provider_event_id_unique UNIQUE(provider, provider_event_id);

-- source: 20260809183257_44928dfa-9f9d-47ba-ac75-452e5fceb831.sql | structural projection: public.checkout_attempts
ALTER TABLE public.checkout_attempts
ADD CONSTRAINT checkout_attempts_provider_session_unique UNIQUE (provider, provider_checkout_session_id);

-- source: 20260809183341_0da4f7a6-90db-4176-a12c-8b98a8f2fe7e.sql | structural projection: public.checkout_attempts
ALTER TABLE public.checkout_attempts
ADD CONSTRAINT checkout_attempts_open_status_requires_session_id
CHECK (
  status <> 'open'
  OR provider_checkout_session_id IS NOT NULL
);

-- source: 20260811001000_stripe_webhook_runtime_diagnostics_remote_schema_correction.sql | structural projection: public.stripe_webhook_runtime_diagnostics
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_trace_stage_unique UNIQUE(trace_id, stage);

-- source: 20260811001000_stripe_webhook_runtime_diagnostics_remote_schema_correction.sql | structural projection: public.stripe_webhook_runtime_diagnostics
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_event_hash_check CHECK (event_id_hash ~ '^[0-9a-f]{64}$');

-- source: 20260811001000_stripe_webhook_runtime_diagnostics_remote_schema_correction.sql | structural projection: public.stripe_webhook_runtime_diagnostics
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_event_type_check CHECK (
    event_type IN (
        'checkout.session.completed',
        'checkout.session.expired',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.paid',
        'invoice.payment_failed',
        'UNKNOWN'
    )
);

-- source: 20260811001000_stripe_webhook_runtime_diagnostics_remote_schema_correction.sql | structural projection: public.stripe_webhook_runtime_diagnostics
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_stage_check CHECK (
    stage IN (
        'SIGNATURE_VALIDATED',
        'PAYLOAD_SANITIZED',
        'RPC_CALL_STARTED',
        'RPC_RESPONSE_RECEIVED',
        'HTTP_RESPONSE_READY'
    )
);

-- source: 20260811001000_stripe_webhook_runtime_diagnostics_remote_schema_correction.sql | structural projection: public.stripe_webhook_runtime_diagnostics
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_reason_code_check CHECK (
    reason_code IS NULL OR reason_code IN (
        'RAW_BODY_READ_FAILED',
        'SIGNATURE_INVALID',
        'EVENT_PARSE_FAILED',
        'LIVEMODE_REJECTED',
        'UNSUPPORTED_EVENT',
        'PAYLOAD_CONTRACT_FAILED',
        'RPC_TRANSPORT_FAILED',
        'RPC_REJECTED_RETRYABLE',
        'RPC_REJECTED_PERMANENT',
        'RPC_RESPONSE_INVALID',
        'UNEXPECTED_HANDLER_FAILURE'
    )
);

-- source: 20260811001000_stripe_webhook_runtime_diagnostics_remote_schema_correction.sql | structural projection: public.stripe_webhook_runtime_diagnostics
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_http_status_check CHECK (http_status BETWEEN 100 AND 599);

-- source: 20260811001000_stripe_webhook_runtime_diagnostics_remote_schema_correction.sql | structural projection: public.stripe_webhook_runtime_diagnostics
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_expires_at_check CHECK (expires_at > created_at);

-- source: 20260811001000_stripe_webhook_runtime_diagnostics_remote_schema_correction.sql | structural projection: public.stripe_webhook_runtime_diagnostics
ALTER TABLE public.stripe_webhook_runtime_diagnostics ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- Phase 2-B canonical projection of final columns originally introduced inside
-- dynamic DO blocks. This baseline targets an empty staging database, so no
-- historical backfill or operational DML is required or included.
ALTER TABLE public.aportes_financeiros ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.bank_accounts ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.bank_movements ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.cartoes_credito ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.cartoes_faturas ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.cartoes_lancamentos ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.compras ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.compras_itens ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.customers ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.finance_entries ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.payables ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.products ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.receivables ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.sale_items ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.sales ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.suppliers ADD COLUMN empresa_id UUID NOT NULL REFERENCES public.empresas(id);

ALTER TABLE public.checkout_attempts ADD COLUMN livemode BOOLEAN NOT NULL;
ALTER TABLE public.payment_events ADD COLUMN provider_event_created_at BIGINT;
ALTER TABLE public.subscriptions ADD COLUMN stripe_last_event_created BIGINT;
ALTER TABLE public.subscriptions ADD COLUMN stripe_last_event_priority INTEGER;
ALTER TABLE public.subscriptions ADD COLUMN stripe_last_event_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN stripe_last_event_type TEXT;

-- source: 20260812000000_checkout_attempts_isolation.sql | structural projection: public.checkout_attempts
ALTER TABLE public.checkout_attempts ALTER COLUMN livemode SET NOT NULL;

-- source: 20260813192228_7dda7a3a-e09c-4a20-8c8a-28c207e96d21.sql | structural projection: public.sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- source: 20260816133125_22b6bda5-9bd2-4774-9630-38a7a0d8728b.sql | structural projection: public.compras
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX idx_aportes_financeiros_empresa_id ON public.aportes_financeiros (empresa_id);
CREATE INDEX idx_bank_accounts_empresa_id ON public.bank_accounts (empresa_id);
CREATE INDEX idx_bank_movements_empresa_id ON public.bank_movements (empresa_id);
CREATE INDEX idx_cartoes_credito_empresa_id ON public.cartoes_credito (empresa_id);
CREATE INDEX idx_cartoes_faturas_empresa_id ON public.cartoes_faturas (empresa_id);
CREATE INDEX idx_cartoes_lancamentos_empresa_id ON public.cartoes_lancamentos (empresa_id);
CREATE INDEX idx_categorias_contas_pagar_empresa_id ON public.categorias_contas_pagar (empresa_id);
CREATE INDEX idx_compras_empresa_id ON public.compras (empresa_id);
CREATE INDEX idx_compras_itens_empresa_id ON public.compras_itens (empresa_id);
CREATE INDEX idx_customers_empresa_id ON public.customers (empresa_id);
CREATE INDEX idx_finance_entries_empresa_id ON public.finance_entries (empresa_id);
CREATE INDEX idx_payables_empresa_id ON public.payables (empresa_id);
CREATE INDEX idx_payment_routing_rules_empresa_id ON public.payment_routing_rules (empresa_id);
CREATE INDEX idx_products_empresa_id ON public.products (empresa_id);
CREATE INDEX idx_receivables_empresa_id ON public.receivables (empresa_id);
CREATE INDEX idx_sale_items_empresa_id ON public.sale_items (empresa_id);
CREATE INDEX idx_sales_empresa_id ON public.sales (empresa_id);
CREATE INDEX idx_suppliers_empresa_id ON public.suppliers (empresa_id);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | final index: products_user_idx
CREATE INDEX products_user_idx ON public.products(user_id);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | final index: sales_user_idx
CREATE INDEX sales_user_idx ON public.sales(user_id, sold_at DESC);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | final index: sale_items_sale_idx
CREATE INDEX sale_items_sale_idx ON public.sale_items(sale_id);

-- source: 20260616212546_83c62ddb-7c1a-4959-81bd-79319b6bf67c.sql | final index: finance_user_idx
CREATE INDEX finance_user_idx ON public.finance_entries(user_id, entry_date DESC);

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | final index: customers_user_idx
CREATE INDEX customers_user_idx ON public.customers(user_id);

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | final index: suppliers_user_idx
CREATE INDEX suppliers_user_idx ON public.suppliers(user_id);

-- source: 20260616213419_069279da-c7e6-448d-a23b-4a6899e98df5.sql | final index: payables_user_idx
CREATE INDEX payables_user_idx ON public.payables(user_id, due_date);

-- source: 20260616214246_53c304ae-016a-44fe-86ce-7d7427d857d9.sql | final index: receivables_user_idx
CREATE INDEX receivables_user_idx ON public.receivables(user_id, due_date);

-- source: 20260617002237_80220513-bc4e-43be-b99e-a474b31267e4.sql | final index: idx_cvd_user_mes_ano
CREATE INDEX idx_cvd_user_mes_ano ON public.controle_vendas_diario(user_id, ano, mes);

-- source: 20260617012255_d7e23bc3-3295-4778-b4fb-1e2f704b45c0.sql | final index: bank_accounts_user_idx
CREATE INDEX bank_accounts_user_idx ON public.bank_accounts(user_id, status);

-- source: 20260617012255_d7e23bc3-3295-4778-b4fb-1e2f704b45c0.sql | final index: bank_movements_user_idx
CREATE INDEX bank_movements_user_idx ON public.bank_movements(user_id, account_id, movement_date);

-- source: 20260617204956_e3fa217e-6550-4efa-95c4-43cec18c18f5.sql | final index: idx_cvfh_user_mes_ano
CREATE INDEX idx_cvfh_user_mes_ano ON public.controle_vendas_fornecedor_historico(user_id, ano, mes, created_at DESC);

-- source: 20260618003809_45d879f6-9304-417c-8d89-550d5a3fd24c.sql | final index: cartoes_lancamentos_cartao_fatura_idx
CREATE INDEX cartoes_lancamentos_cartao_fatura_idx ON public.cartoes_lancamentos(cartao_id, ano_fatura, mes_fatura);

-- source: 20260618005921_414315c7-4ece-4d34-bac6-e710a982434e.sql | final index: compras_user_idx
CREATE INDEX compras_user_idx ON public.compras(user_id, data_compra DESC);

-- source: 20260618005921_414315c7-4ece-4d34-bac6-e710a982434e.sql | final index: compras_itens_compra_idx
CREATE INDEX compras_itens_compra_idx ON public.compras_itens(compra_id);

-- source: 20260619235639_ea8cd248-5c49-4ff7-b04a-5510f2b202dd.sql | final index: idx_aportes_financeiros_user_date
CREATE INDEX IF NOT EXISTS idx_aportes_financeiros_user_date ON public.aportes_financeiros(user_id, movement_date DESC);

-- source: 20260619235639_ea8cd248-5c49-4ff7-b04a-5510f2b202dd.sql | final index: idx_aportes_financeiros_customer
CREATE INDEX IF NOT EXISTS idx_aportes_financeiros_customer ON public.aportes_financeiros(customer_id);

-- source: 20260619235639_ea8cd248-5c49-4ff7-b04a-5510f2b202dd.sql | final index: idx_aportes_financeiros_bank_account
CREATE INDEX IF NOT EXISTS idx_aportes_financeiros_bank_account ON public.aportes_financeiros(bank_account_id);

-- source: 20260620001255_b27ec4e3-e2b7-4007-b545-9e608ce8fee7.sql | final index: cartoes_lancamentos_deleted_at_idx
CREATE INDEX IF NOT EXISTS cartoes_lancamentos_deleted_at_idx ON public.cartoes_lancamentos(deleted_at);

-- source: 20260620005951_3c08501e-92ee-43eb-b230-7a801bafb8dc.sql | final index: audit_log_user_table_at_idx
CREATE INDEX IF NOT EXISTS audit_log_user_table_at_idx
  ON public.audit_log(user_id, table_name, at DESC);

-- source: 20260620005951_3c08501e-92ee-43eb-b230-7a801bafb8dc.sql | final index: audit_log_row_idx
CREATE INDEX IF NOT EXISTS audit_log_row_idx
  ON public.audit_log(table_name, row_id);

-- source: 20260620162259_98a46119-7d6b-4770-9c89-e0d6c7ff6e6e.sql | final index: cvd_sale_unique
CREATE UNIQUE INDEX IF NOT EXISTS cvd_sale_unique
  ON public.controle_vendas_diario(sale_id) WHERE sale_id IS NOT NULL;

-- source: 20260624131503_216b8707-e114-40bd-93f8-7bf60c9c77c6.sql | final index: payables_unique_pendente
CREATE UNIQUE INDEX IF NOT EXISTS payables_unique_pendente
  ON public.payables (user_id, description, due_date, amount)
  WHERE status IN ('pendente','atrasado');

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final index: dre_regras_unq
CREATE UNIQUE INDEX dre_regras_unq ON public.dre_regras (
  tenant_id, source_table, COALESCE(match_supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(match_category, '')
);

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final index: dre_regras_tenant_idx
CREATE INDEX dre_regras_tenant_idx ON public.dre_regras (tenant_id, source_table);

-- source: 20260729002312_4cf08130-6dc5-496a-9cd0-4537053df901.sql | final index: dre_class_tenant_idx
CREATE INDEX dre_class_tenant_idx ON public.dre_classificacoes (tenant_id, source_table);

-- source: 20260806235353_017bf93e-5b22-4892-b934-c198d5c6d7ac.sql | final index: company_invitations_active_idx
CREATE UNIQUE INDEX IF NOT EXISTS company_invitations_active_idx ON public.company_invitations (empresa_id, email) WHERE (status = 'pending');

-- source: 20260806235353_017bf93e-5b22-4892-b934-c198d5c6d7ac.sql | final index: company_invitations_token_hash_idx
CREATE UNIQUE INDEX IF NOT EXISTS company_invitations_token_hash_idx ON public.company_invitations (token_hash);

-- source: 20260807000150_9c67a433-eaf9-43b9-9ae2-578bb84da29a.sql | final index: idx_controle_vendas_diario_empresa_id
CREATE INDEX IF NOT EXISTS idx_controle_vendas_diario_empresa_id ON public.controle_vendas_diario (empresa_id);

-- source: 20260807222045_4c51f9a1-8aae-420e-896b-d247b76e118b.sql | final index: idx_auth_rate_limits_blocked_until
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_blocked_until ON public.auth_rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

-- source: 20260807222045_4c51f9a1-8aae-420e-896b-d247b76e118b.sql | final index: idx_auth_rate_limits_expires_at
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_expires_at ON public.auth_rate_limits(expires_at);

-- source: 20260807224646_3a0e178a-3af3-4776-aed1-dc7695a9136a.sql | final index: idx_pending_onboardings_auth_user_id
CREATE INDEX IF NOT EXISTS idx_pending_onboardings_auth_user_id ON public.pending_onboardings(auth_user_id);

-- source: 20260807224646_3a0e178a-3af3-4776-aed1-dc7695a9136a.sql | final index: idx_pending_onboardings_email_hash
CREATE INDEX IF NOT EXISTS idx_pending_onboardings_email_hash ON public.pending_onboardings(email_hash);

-- source: 20260807224646_3a0e178a-3af3-4776-aed1-dc7695a9136a.sql | final index: idx_pending_onboardings_status
CREATE INDEX IF NOT EXISTS idx_pending_onboardings_status ON public.pending_onboardings(status);

-- source: 20260808211557_0e6933d5-b96f-42c2-b37a-e6835149ea31.sql | final index: idx_subscriptions_active_empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_active_empresa 
ON public.subscriptions (empresa_id) 
WHERE status NOT IN ('canceled', 'incomplete');

-- source: 20260812141554_9146bbb3-2d0d-4574-b580-5f63e990ab56.sql | final index: idx_checkout_attempts_active_per_sub
CREATE UNIQUE INDEX idx_checkout_attempts_active_per_sub 
ON public.checkout_attempts (empresa_id, subscription_id, livemode) 
WHERE (status IN ('creating', 'open'));

-- source: 20260813173838_4ee7a7ca-e540-4b92-a5d2-346ae1bec401.sql | final index: idx_empresas_documento_unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_documento_unique ON public.empresas (documento);

-- source: 20260813192228_7dda7a3a-e09c-4a20-8c8a-28c207e96d21.sql | final index: idx_sales_idempotency_empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_idempotency_empresa 
ON public.sales (empresa_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- source: 20260816235959_final_purchase_harden.sql | final index: compras_empresa_idempotency_idx
CREATE UNIQUE INDEX compras_empresa_idempotency_idx ON public.compras (empresa_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
