ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only access" ON public.rate_limits;
CREATE POLICY "Service role only access" ON public.rate_limits FOR ALL TO service_role USING (true);
GRANT ALL ON TABLE public.rate_limits TO service_role;
REVOKE ALL ON TABLE public.rate_limits FROM public, anon, authenticated;