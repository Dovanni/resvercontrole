-- VEJAMAIS — REMEDIAÇÃO SEGURA DAS POLICIES DE PAPÉIS
-- Criar funções seguras baseadas exclusivamente em auth.uid()

CREATE OR REPLACE FUNCTION public.current_user_has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND role = _role
  ) AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.current_user_has_role(public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_has_role_in_company(_empresa_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.user_company_access uca ON ur.user_id = uca.user_id
    WHERE ur.user_id = auth.uid() 
      AND uca.empresa_id = _empresa_id
      AND ur.role = _role
  ) AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.current_user_has_role_in_company(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_role_in_company(uuid, public.app_role) TO authenticated;

-- Atualização das policies dependentes (Ex: company_invitations)
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.company_invitations;
CREATE POLICY "Admins can manage invitations" 
ON public.company_invitations 
FOR ALL 
TO authenticated
USING (public.current_user_has_role_in_company(empresa_id, 'admin'::public.app_role));

-- Comentários técnicos
COMMENT ON FUNCTION public.current_user_has_role IS 'Verifica papel do usuário autenticado atual sem aceitar user_id externo.';
COMMENT ON FUNCTION public.current_user_has_role_in_company IS 'Verifica papel do usuário autenticado atual em uma empresa específica sem aceitar user_id externo.';
