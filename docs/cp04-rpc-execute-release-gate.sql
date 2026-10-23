-- CP-04 — post-validation release gate, execute only after schema, RLS,
-- settled guard and RPC have been applied and inspected on the target DB.
-- Never execute this before the transactional migration has succeeded.
BEGIN;
GRANT EXECUTE ON FUNCTION public.edit_payables_series_cp04(uuid,uuid,text,numeric,date,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.edit_payables_series_cp04(uuid,uuid,text,numeric,date,jsonb) FROM PUBLIC,anon;
COMMIT;
-- Verification:
-- SELECT has_function_privilege('authenticated',
-- 'public.edit_payables_series_cp04(uuid,uuid,text,numeric,date,jsonb)','EXECUTE');
-- SELECT has_function_privilege('anon',
-- 'public.edit_payables_series_cp04(uuid,uuid,text,numeric,date,jsonb)','EXECUTE');
-- Expected: true, false.
