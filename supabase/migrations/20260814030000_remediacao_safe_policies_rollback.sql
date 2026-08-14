-- ROLLBACK: VEJAMAIS — REMEDIAÇÃO SEGURA DAS POLICIES DE PAPÉIS

-- Restaurar policy original (baseada em has_role_in_company se necessário, embora quebre para authenticated)
-- No projeto real, has_role_in_company foi restrito ao service_role.
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.company_invitations;
CREATE POLICY "Admins can manage invitations" 
ON public.company_invitations 
FOR ALL 
TO authenticated
USING (public.has_role_in_company(auth.uid(), empresa_id, 'admin'::public.app_role));

-- Remover novas funções
DROP FUNCTION IF EXISTS public.current_user_has_role(public.app_role);
DROP FUNCTION IF EXISTS public.current_user_has_role_in_company(uuid, public.app_role);
