REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM public, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM public, anon, authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT ON public.plans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_company_access TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_registrar_venda TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_persistent TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role TO service_role;

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;