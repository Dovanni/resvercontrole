GRANT EXECUTE ON FUNCTION public.get_company_subscription_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_subscription_context(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_company_subscription_context(uuid) FROM PUBLIC, anon;