SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND (p.proname = 'ensure_empresa_defaults' OR p.proname = 'finalize_user_onboarding');

SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('pending_onboardings', 'empresas', 'user_company_access', 'user_roles') 
ORDER BY table_name, ordinal_position;
