-- ROLLBACK: VEJAMAIS — REMEDIAÇÃO SEGURA DAS POLICIES DE PAPÉIS
-- ATENÇÃO: Este rollback restaura um estado operacionalmente defeituoso (has_role_in_company original)
-- Utilizar apenas para reversão técnica emergencial em caso de falha de aplicação.

DROP POLICY IF EXISTS "Admins can manage invitations" ON public.company_invitations;
-- Restaura política anterior (que dependia de has_role_in_company com user_id explícito)
CREATE POLICY "Admins can manage invitations" 
ON public.company_invitations 
FOR ALL 
TO authenticated
USING (public.has_role_in_company(auth.uid(), empresa_id, 'admin'::public.app_role));

-- Remover função segura
DROP FUNCTION IF EXISTS public.current_user_has_role_in_company(uuid, public.app_role);

