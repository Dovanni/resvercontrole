-- CP-04 SECURITY REVIEW ONLY — DO NOT RUN IN REMOTE SUPABASE YET.
-- Replace broad ALL ownership policy with separate read and financial write policies.
-- SELECT retains user ownership. All writes additionally require active company
-- membership with financial role. No SECURITY DEFINER or JWT user_metadata.
BEGIN;
DROP POLICY IF EXISTS "own payables" ON public.payables;
CREATE POLICY "cp04_read_own_payables" ON public.payables
 FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()));
CREATE POLICY "cp04_insert_financial_member" ON public.payables
 FOR INSERT TO authenticated WITH CHECK (
  user_id=(SELECT auth.uid()) AND EXISTS (
   SELECT 1 FROM public.user_company_access m
   JOIN public.empresas e ON e.id=m.empresa_id
   WHERE m.user_id=(SELECT auth.uid()) AND m.empresa_id=payables.empresa_id
    AND m.status='active' AND m.role::text IN ('admin','financeiro')
    AND e.status='active'
  )
 );
CREATE POLICY "cp04_update_financial_member" ON public.payables
 FOR UPDATE TO authenticated
 USING (user_id=(SELECT auth.uid()) AND EXISTS (
   SELECT 1 FROM public.user_company_access m
   JOIN public.empresas e ON e.id=m.empresa_id
   WHERE m.user_id=(SELECT auth.uid()) AND m.empresa_id=payables.empresa_id
    AND m.status='active' AND m.role::text IN ('admin','financeiro')
    AND e.status='active'
 ))
 WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS (
   SELECT 1 FROM public.user_company_access m
   JOIN public.empresas e ON e.id=m.empresa_id
   WHERE m.user_id=(SELECT auth.uid()) AND m.empresa_id=payables.empresa_id
    AND m.status='active' AND m.role::text IN ('admin','financeiro')
    AND e.status='active'
 ));
CREATE POLICY "cp04_delete_financial_member" ON public.payables
 FOR DELETE TO authenticated USING (
  user_id=(SELECT auth.uid()) AND EXISTS (
   SELECT 1 FROM public.user_company_access m
   JOIN public.empresas e ON e.id=m.empresa_id
   WHERE m.user_id=(SELECT auth.uid()) AND m.empresa_id=payables.empresa_id
    AND m.status='active' AND m.role::text IN ('admin','financeiro')
    AND e.status='active'
  )
 );
COMMIT;
-- Preflight: inspect all payables policies before applying. PostgreSQL permissive
-- policies combine with OR: any additional broad policy defeats these restrictions.
-- Regression: existing non-financial users may lose write access intentionally.
