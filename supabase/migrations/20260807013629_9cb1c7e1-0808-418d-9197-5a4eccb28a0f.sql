
-- Identificação do Erro Material (Recursão)
-- postgres_error_code_before: 42P17
-- recursive_policy_names: "Users can view memberships of their companies"
-- recursion_chain: user_company_access (SELECT) -> USING (empresa_id IN (SELECT ... FROM user_company_access ...)) -> user_company_access (RECURSION)

BEGIN;

-- 1. Remoção das policies recursivas
DROP POLICY IF EXISTS "Users can view memberships of their companies" ON public.user_company_access;
-- policies_removed: "Users can view memberships of their companies"

-- 2. Criação da policy simples (não recursiva) para o próprio vínculo
-- own_membership_policy_expression: user_id = auth.uid()
CREATE POLICY "Users can view their own memberships"
ON public.user_company_access FOR SELECT
TO authenticated
USING (user_id = auth.uid());
-- policies_created: "Users can view their own memberships"

-- 3. Criação da RPC administrativa para listagem de membros
-- admin_member_listing_rpc: public.list_my_company_members(p_empresa_id uuid)
-- admin_rpc_accepts_user_id: false
-- admin_rpc_uses_auth_uid: true
-- admin_rpc_search_path_fixed: true
CREATE OR REPLACE FUNCTION public.list_my_company_members(p_empresa_id uuid)
RETURNS TABLE (
    user_id UUID,
    role public.app_role,
    status TEXT,
    is_primary BOOLEAN,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validar internamente que auth.uid() possui membership ativo e papel admin na empresa solicitada
    IF NOT EXISTS (
        SELECT 1 
        FROM public.user_company_access 
        WHERE user_company_access.user_id = auth.uid() 
          AND user_company_access.empresa_id = p_empresa_id 
          AND user_company_access.role = 'admin' 
          AND user_company_access.status = 'active'
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        uca.user_id,
        uca.role,
        uca.status,
        uca.is_primary,
        uca.created_at
    FROM public.user_company_access uca
    WHERE uca.empresa_id = p_empresa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_company_members(uuid) FROM public;
REVOKE ALL ON FUNCTION public.list_my_company_members(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_company_members(uuid) TO authenticated;

-- 4. Ajuste da policy de empresas para evitar recursão indireta
DROP POLICY IF EXISTS "Users can view companies they belong to" ON public.empresas;
CREATE POLICY "Users can view their own companies"
ON public.empresas FOR SELECT
TO authenticated
USING (
    owner_id = auth.uid() OR
    id IN (
        SELECT uca.empresa_id 
        FROM public.user_company_access uca 
        WHERE uca.user_id = auth.uid() 
          AND uca.status = 'active'
    )
);

COMMIT;
