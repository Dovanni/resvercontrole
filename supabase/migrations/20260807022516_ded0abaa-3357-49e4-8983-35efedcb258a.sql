-- VMEAP_WAVE_B_RPC_EXECUTE_PRIVILEGE_REPAIR
-- Objetivo: Garantir privilégios EXECUTE e recarregar schema cache do PostgREST.

BEGIN;

-- 1. get_my_multiempresa_context()
REVOKE ALL ON FUNCTION public.get_my_multiempresa_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_multiempresa_context() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_multiempresa_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_multiempresa_context() TO service_role;

-- 2. list_my_company_members(uuid)
REVOKE ALL ON FUNCTION public.list_my_company_members(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_company_members(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_company_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_company_members(uuid) TO service_role;

-- 3. Recarregar cache de schema
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verificação final usando OIDs estáveis identificados no catálogo
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(oid) as identity_arguments,
    has_function_privilege('authenticated', oid, 'EXECUTE') as authenticated_execute,
    has_function_privilege('anon', oid, 'EXECUTE') as anon_execute,
    has_function_privilege('public', oid, 'EXECUTE') as public_execute
FROM pg_proc 
WHERE oid IN (27364, 27374);