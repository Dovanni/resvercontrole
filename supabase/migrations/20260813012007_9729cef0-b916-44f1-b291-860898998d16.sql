-- CORREÇÃO DE SEGURANÇA: supabase_lov/aportes_financeiros_redundant_owner_policy
BEGIN;
DROP POLICY IF EXISTS "Users can manage own financial contributions" ON public.aportes_financeiros;
COMMIT;