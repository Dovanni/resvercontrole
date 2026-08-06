-- VMEAP WAVE A: ATUALIZAÇÃO ESTRUTURAL CONTROLADA
-- Corrected: Removed inventory_movements (not in current schema)

-- 1. EXPAND: Criar estrutura de empresas e vínculos
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    documento TEXT, -- CNPJ/CPF
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    owner_id UUID REFERENCES auth.users(id) NOT NULL
);

GRANT SELECT, INSERT, UPDATE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;

CREATE TABLE IF NOT EXISTS public.user_company_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL DEFAULT 'vendedor',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, empresa_id)
);

GRANT SELECT, INSERT, UPDATE ON public.user_company_access TO authenticated;
GRANT ALL ON public.user_company_access TO service_role;

-- 2. EXPAND: Adicionar empresa_id às tabelas de negócio (Safe Expand)
DO $$
DECLARE
    t_name TEXT;
    tables_to_migrate TEXT[] := ARRAY[
        'aportes_financeiros', 'bank_accounts', 'bank_movements', 'cartoes_credito',
        'cartoes_faturas', 'cartoes_lancamentos', 'categorias_contas_pagar',
        'compras', 'compras_itens', 'customers',
        'payables', 'products', 'receivables', 'sale_items', 'sales', 'suppliers'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_to_migrate LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = t_name AND column_name = 'empresa_id'
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN empresa_id UUID REFERENCES public.empresas(id)', t_name);
        END IF;
    END LOOP;
END $$;

-- 3. BACKFILL: Criar empresas para os donos atuais e associar registros
DO $$
DECLARE
    u_id UUID;
    new_emp_id UUID;
    t_name TEXT;
    tables_to_migrate TEXT[] := ARRAY[
        'aportes_financeiros', 'bank_accounts', 'bank_movements', 'cartoes_credito',
        'cartoes_faturas', 'cartoes_lancamentos', 'categorias_contas_pagar',
        'compras', 'compras_itens', 'customers',
        'payables', 'products', 'receivables', 'sale_items', 'sales', 'suppliers'
    ];
BEGIN
    FOR u_id IN SELECT DISTINCT user_id FROM public.bank_accounts LOOP
        IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE owner_id = u_id) THEN
            INSERT INTO public.empresas (nome, owner_id)
            VALUES ('Empresa Principal', u_id)
            RETURNING id INTO new_emp_id;
            
            INSERT INTO public.user_company_access (user_id, empresa_id, role)
            VALUES (u_id, new_emp_id, 'admin');
        ELSE
            SELECT id INTO new_emp_id FROM public.empresas WHERE owner_id = u_id LIMIT 1;
        END IF;

        FOREACH t_name IN ARRAY tables_to_migrate LOOP
            EXECUTE format('UPDATE public.%I SET empresa_id = %L WHERE user_id = %L AND empresa_id IS NULL', t_name, new_emp_id, u_id);
        END LOOP;
    END LOOP;
END $$;

-- 4. HARDEN: Adicionar NOT NULL após backfill e índices
DO $$
DECLARE
    t_name TEXT;
    tables_to_migrate TEXT[] := ARRAY[
        'aportes_financeiros', 'bank_accounts', 'bank_movements', 'cartoes_credito',
        'cartoes_faturas', 'cartoes_lancamentos', 'categorias_contas_pagar',
        'compras', 'compras_itens', 'customers',
        'payables', 'products', 'receivables', 'sale_items', 'sales', 'suppliers'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_to_migrate LOOP
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN empresa_id SET NOT NULL', t_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (empresa_id)', 'idx_' || t_name || '_empresa_id', t_name);
    END LOOP;
END $$;

-- 5. HARDEN: RLS Policies (Hybrid Transition)
CREATE OR REPLACE FUNCTION public.has_role_in_company(_user_id UUID, _empresa_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_company_access
    WHERE user_id = _user_id
      AND empresa_id = _empresa_id
      AND (role = _role OR role = 'admin')
      AND status = 'active'
  )
$$;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view companies they belong to"
ON public.empresas FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE user_company_access.empresa_id = empresas.id 
        AND user_company_access.user_id = auth.uid()
    )
);

DO $$
DECLARE
    t_name TEXT;
    tables_to_migrate TEXT[] := ARRAY[
        'aportes_financeiros', 'bank_accounts', 'bank_movements', 'cartoes_credito',
        'cartoes_faturas', 'cartoes_lancamentos', 'categorias_contas_pagar',
        'compras', 'compras_itens', 'customers',
        'payables', 'products', 'receivables', 'sale_items', 'sales', 'suppliers'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_to_migrate LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Multiempresa isolation" ON public.%I', t_name);
        EXECUTE format('CREATE POLICY "Multiempresa isolation" ON public.%I FOR ALL TO authenticated USING (
            EXISTS (
                SELECT 1 FROM public.user_company_access 
                WHERE user_company_access.empresa_id = %I.empresa_id 
                AND user_company_access.user_id = auth.uid()
            )
        )', t_name, t_name);
    END LOOP;
END $$;
