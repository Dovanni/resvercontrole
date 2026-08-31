-- Trigger-only billing state function must never be callable through PostgREST.
REVOKE ALL ON FUNCTION public.apply_processed_stripe_payment_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_processed_stripe_payment_state() FROM anon;
REVOKE ALL ON FUNCTION public.apply_processed_stripe_payment_state() FROM authenticated;
