-- VEJAMAIS — REMEDIAÇÃO SEGURA DO BOOTSTRAP E ISOLAMENTO MULTIEMPRESA
-- SHA256: d41d8cd98f00b204e9800998ecf8427e (placeholder)

CREATE OR REPLACE FUNCTION public.check_current_user_is_active_member(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_company_access 
    WHERE user_id = auth.uid() 
      AND empresa_id = _empresa_id
      AND status = 'active'
  ) AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.check_current_user_is_active_member(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_current_user_is_active_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_current_user_is_admin(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_company_access 
    WHERE user_id = auth.uid() 
      AND empresa_id = _empresa_id
      AND status = 'active'
      AND role = 'admin'
  ) AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.check_current_user_is_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_current_user_is_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view their own companies" ON public.empresas;
CREATE POLICY "Users can view their own companies"
ON public.empresas FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() OR 
  public.check_current_user_is_active_member(id)
);

DROP POLICY IF EXISTS "Admins can manage invitations" ON public.company_invitations;
CREATE POLICY "Admins can manage invitations"
ON public.company_invitations FOR ALL
TO authenticated
USING (public.check_current_user_is_admin(empresa_id))
WITH CHECK (public.check_current_user_is_admin(empresa_id));

COMMENT ON FUNCTION public.check_current_user_is_active_member(uuid) IS 'Verifica se o usuário autenticado atual é membro ativo da empresa sem aceitar user_id externo.';
COMMENT ON FUNCTION public.check_current_user_is_admin(uuid) IS 'Verifica se o usuário autenticado atual é administrador da empresa sem aceitar user_id externo.';