DROP POLICY IF EXISTS "Service role only access" ON public.rate_limits;
CREATE POLICY "Service role only access" ON public.rate_limits FOR ALL TO service_role USING (true);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;