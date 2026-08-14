CREATE POLICY "Service role only" ON public.checkout_attempts FOR ALL TO service_role USING (true);
CREATE POLICY "Service role only" ON public.auth_rate_limits FOR ALL TO service_role USING (true);
CREATE POLICY "Service role only" ON public.payment_events FOR ALL TO service_role USING (true);
GRANT ALL ON public.checkout_attempts TO service_role;
GRANT ALL ON public.auth_rate_limits TO service_role;
GRANT ALL ON public.payment_events TO service_role;
REVOKE ALL ON public.checkout_attempts FROM public, anon, authenticated;
REVOKE ALL ON public.auth_rate_limits FROM public, anon, authenticated;
REVOKE ALL ON public.payment_events FROM public, anon, authenticated;