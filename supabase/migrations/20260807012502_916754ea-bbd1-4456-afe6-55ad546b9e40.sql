
-- 1. Criação da RPC Canônica
CREATE OR REPLACE FUNCTION public.get_my_multiempresa_context()
RETURNS TABLE (
    empresa_id UUID,
    nome TEXT,
    razao_social TEXT,
    tipo TEXT,
    role public.app_role,
    status TEXT,
    is_primary BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id as empresa_id,
        e.nome,
        e.razao_social,
        e.tipo,
        uca.role,
        uca.status,
        uca.is_primary
    FROM public.empresas e
    JOIN public.user_company_access uca ON e.id = uca.empresa_id
    WHERE uca.user_id = auth.uid()
      AND uca.status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_multiempresa_context() FROM public;
REVOKE ALL ON FUNCTION public.get_my_multiempresa_context() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_multiempresa_context() TO authenticated;

-- 2. Reforço de RLS para evitar recursão
DROP POLICY IF EXISTS "Users can view companies they belong to" ON public.empresas;
CREATE POLICY "Users can view companies they belong to"
ON public.empresas FOR SELECT
TO authenticated
USING (
    owner_id = auth.uid() OR
    id IN (SELECT empresa_id FROM public.user_company_access WHERE user_id = auth.uid() AND status = 'active')
);

DROP POLICY IF EXISTS "Users can view memberships of their companies" ON public.user_company_access;
CREATE POLICY "Users can view memberships of their companies"
ON public.user_company_access FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    empresa_id IN (SELECT empresa_id FROM public.user_company_access WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active')
);

-- 3. Backfill Idempotente (Safe Repair)
DO $$
DECLARE
    u_id UUID;
    new_emp_id UUID;
BEGIN
    -- Identificar usuários que operam dados (legacy_owners) mas não tem membership
    FOR u_id IN 
        SELECT DISTINCT user_id FROM public.bank_accounts 
        WHERE user_id NOT IN (SELECT user_id FROM public.user_company_access)
    LOOP
        -- Tentar encontrar empresa órfã deste owner ou criar
        SELECT id INTO new_emp_id FROM public.empresas WHERE owner_id = u_id LIMIT 1;
        
        IF new_emp_id IS NULL THEN
            INSERT INTO public.empresas (nome, owner_id)
            VALUES ('Minha Empresa', u_id)
            RETURNING id INTO new_emp_id;
        END IF;

        -- Criar membership se não existir
        INSERT INTO public.user_company_access (user_id, empresa_id, role, is_primary, status)
        VALUES (u_id, new_emp_id, 'admin', true, 'active')
        ON CONFLICT (user_id, empresa_id) DO UPDATE SET role = 'admin', status = 'active';
    END LOOP;
END $$;
