-- 1. Garantir que a policy de empresas permita leitura baseada no user_company_access
DROP POLICY IF EXISTS "Users can view companies they belong to" ON public.empresas;
CREATE POLICY "Users can view companies they belong to"
ON public.empresas FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_company_access 
        WHERE user_company_access.empresa_id = public.empresas.id 
        AND user_company_access.user_id = auth.uid()
    )
);

-- 2. Garantir que a policy de user_company_access permita leitura do próprio membership
-- e de outros membros da mesma empresa se for admin
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.user_company_access;
DROP POLICY IF EXISTS "Users can view memberships of their companies" ON public.user_company_access;
CREATE POLICY "Users can view memberships of their companies"
ON public.user_company_access FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.user_company_access AS my_access
        WHERE my_access.empresa_id = public.user_company_access.empresa_id
        AND my_access.user_id = auth.uid()
        AND my_access.status = 'active'
    )
);

-- 3. GRANT SELECT nas tabelas essenciais para o authenticated
GRANT SELECT ON public.empresas TO authenticated;
GRANT SELECT ON public.user_company_access TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
