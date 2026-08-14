REVOKE ALL ON TABLE public.rate_limits FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only access" ON public.rate_limits FOR ALL TO service_role USING (true);

REVOKE EXECUTE ON FUNCTION public.check_rate_limit_persistent(text, integer, interval) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_persistent(text, integer, interval) TO service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_registrar_venda(uuid, jsonb, rpc_sale_item_input[], text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_venda(uuid, jsonb, rpc_sale_item_input[], text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;