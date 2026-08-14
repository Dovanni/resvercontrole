CREATE POLICY "Service role only" ON public.pending_onboardings FOR ALL TO service_role USING (true);
GRANT ALL ON public.pending_onboardings TO service_role;
REVOKE ALL ON public.pending_onboardings FROM public, anon, authenticated;