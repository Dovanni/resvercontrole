-- PROTOCOLO: VEJAMAIS_STRIPE_DURABLE_SANITIZED_RUNTIME_DIAGNOSTICS_INFRA

CREATE TABLE public.stripe_webhook_runtime_diagnostics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id uuid NOT NULL,
    event_id_hash text NOT NULL,
    event_type text NOT NULL,
    stage text NOT NULL,
    reason_code text,
    http_status int,
    error_payload jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);

GRANT INSERT ON public.stripe_webhook_runtime_diagnostics TO authenticated;
GRANT ALL ON public.stripe_webhook_runtime_diagnostics TO service_role;

ALTER TABLE public.stripe_webhook_runtime_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything" 
ON public.stripe_webhook_runtime_diagnostics 
FOR ALL 
TO service_role 
USING (true);

CREATE OR REPLACE FUNCTION public.log_stripe_webhook_diagnostic(
    p_trace_id uuid,
    p_event_id_hash text,
    p_event_type text,
    p_stage text,
    p_reason_code text DEFAULT NULL,
    p_http_status int DEFAULT NULL,
    p_error_payload jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.stripe_webhook_runtime_diagnostics (
        trace_id,
        event_id_hash,
        event_type,
        stage,
        reason_code,
        http_status,
        error_payload
    ) VALUES (
        p_trace_id,
        p_event_id_hash,
        p_event_type,
        p_stage,
        p_reason_code,
        p_http_status,
        p_error_payload
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_stripe_webhook_diagnostic TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_stripe_webhook_diagnostic TO service_role;
