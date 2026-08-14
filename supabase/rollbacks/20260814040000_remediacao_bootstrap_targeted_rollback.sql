-- ROLLBACK DA REMEDIAÇÃO SEGURA DO BOOTSTRAP
-- Restaura as policies para o estado de dependência da função has_role_in_company

DROP POLICY IF EXISTS "Admins can manage invitations" ON public.company_invitations;
CREATE POLICY "Admins can manage invitations"
ON public.company_invitations FOR ALL
TO authenticated
USING (public.has_role_in_company(auth.uid(), empresa_id, 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can view their own companies" ON public.empresas;
CREATE POLICY "Users can view their own companies"
ON public.empresas FOR SELECT
TO authenticated
USING (
  (owner_id = auth.uid()) OR 
  (id IN (SELECT uca.empresa_id FROM user_company_access uca WHERE ((uca.user_id = auth.uid()) AND (uca.status = 'active'::text))))
);

DROP FUNCTION IF EXISTS public.check_current_user_is_admin(uuid);
DROP FUNCTION IF EXISTS public.check_current_user_is_active_member(uuid);
