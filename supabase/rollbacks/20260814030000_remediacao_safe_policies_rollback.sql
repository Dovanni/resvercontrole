-- ROLLBACK DA REMEDIAÇÃO SEGURA DAS POLICIES DE PAPÉIS
-- Remove as novas funções e restaura as antigas (opcional dependendo do estado desejado)

DROP POLICY IF EXISTS "Admins can manage invitations" ON public.company_invitations;
CREATE POLICY "Admins can manage invitations" 
ON public.company_invitations 
FOR ALL 
TO authenticated
USING (public.has_role_in_company(auth.uid(), empresa_id, 'admin'::public.app_role));

DROP FUNCTION IF EXISTS public.current_user_has_role_in_company(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.current_user_has_role(public.app_role);

-- Restaura grants básicos para evitar bloqueio total caso necessário (opcional)
-- GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
