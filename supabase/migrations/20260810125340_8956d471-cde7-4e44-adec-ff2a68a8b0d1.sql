
REVOKE ALL ON FUNCTION public.process_stripe_webhook_event(
  text,
  text,
  text,
  boolean,
  jsonb,
  bigint,
  text,
  text,
  text,
  bigint
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.process_stripe_webhook_event(
  text,
  text,
  text,
  boolean,
  jsonb,
  bigint,
  text,
  text,
  text,
  bigint
) FROM anon;

REVOKE ALL ON FUNCTION public.process_stripe_webhook_event(
  text,
  text,
  text,
  boolean,
  jsonb,
  bigint,
  text,
  text,
  text,
  bigint
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.process_stripe_webhook_event(
  text,
  text,
  text,
  boolean,
  jsonb,
  bigint,
  text,
  text,
  text,
  bigint
) TO service_role;

ALTER FUNCTION public.process_stripe_webhook_event(
  text,
  text,
  text,
  boolean,
  jsonb,
  bigint,
  text,
  text,
  text,
  bigint
) SECURITY DEFINER;

ALTER FUNCTION public.process_stripe_webhook_event(
  text,
  text,
  text,
  boolean,
  jsonb,
  bigint,
  text,
  text,
  text,
  bigint
) SET search_path = public;

ALTER FUNCTION public.process_stripe_webhook_event(
  text,
  text,
  text,
  boolean,
  jsonb,
  bigint,
  text,
  text,
  text,
  bigint
) OWNER TO postgres;
