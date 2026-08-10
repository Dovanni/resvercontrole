-- 1. Limpeza de objetos obsoletos
DROP FUNCTION IF EXISTS public.log_stripe_webhook_diagnostic(uuid, text, text, text, text, integer, jsonb);
DROP FUNCTION IF EXISTS public.purge_expired_stripe_webhook_runtime_diagnostics();

-- 2. Tabela Canônica
CREATE TABLE IF NOT EXISTS public.stripe_webhook_runtime_diagnostics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id uuid NOT NULL,
    event_id_hash char(64) NOT NULL,
    event_type text NOT NULL,
    stage text NOT NULL,
    reason_code text,
    http_status integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    
    -- Restrições de Integridade
    CONSTRAINT stripe_webhook_diagnostics_trace_stage_unique UNIQUE(trace_id, stage),
    CONSTRAINT stripe_webhook_diagnostics_hash_check CHECK (event_id_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT stripe_webhook_diagnostics_event_type_check CHECK (event_type IN (
        'checkout.session.completed',
        'checkout.session.expired',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.paid',
        'invoice.payment_failed'
    )),
    CONSTRAINT stripe_webhook_diagnostics_stage_check CHECK (stage IN (
        'SIGNATURE_VALIDATED',
        'PAYLOAD_SANITIZED',
        'RPC_CALL_STARTED',
        'RPC_RESPONSE_RECEIVED',
        'HTTP_RESPONSE_READY'
    )),
    CONSTRAINT stripe_webhook_diagnostics_http_status_check CHECK (http_status BETWEEN 100 AND 599)
);

-- 3. ACL e Segurança da Tabela
REVOKE ALL ON public.stripe_webhook_runtime_diagnostics FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.stripe_webhook_runtime_diagnostics TO service_role;
ALTER TABLE public.stripe_webhook_runtime_diagnostics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stripe_webhook_runtime_diagnostics' 
        AND policyname = 'Service role can do everything'
    ) THEN
        CREATE POLICY "Service role can do everything" ON public.stripe_webhook_runtime_diagnostics
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- 4. RPC Canônica
CREATE OR REPLACE FUNCTION public.log_stripe_webhook_diagnostic(
    p_trace_id uuid,
    p_event_id_hash char(64),
    p_event_type text,
    p_stage text,
    p_reason_code text DEFAULT NULL,
    p_http_status integer DEFAULT 200
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
        http_status
    )
    VALUES (
        p_trace_id,
        p_event_id_hash,
        p_event_type,
        p_stage,
        p_reason_code,
        p_http_status
    )
    ON CONFLICT (trace_id, stage) DO NOTHING;
END;
$$;

ALTER FUNCTION public.log_stripe_webhook_diagnostic(uuid, char, text, text, text, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.log_stripe_webhook_diagnostic(uuid, char, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_stripe_webhook_diagnostic(uuid, char, text, text, text, integer) TO service_role;

-- 5. Limpeza Física Real (Scheduler Gerenciado)
CREATE OR REPLACE FUNCTION public.purge_expired_stripe_webhook_runtime_diagnostics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.stripe_webhook_runtime_diagnostics
    WHERE expires_at <= now();
END;
$$;

ALTER FUNCTION public.purge_expired_stripe_webhook_runtime_diagnostics() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.purge_expired_stripe_webhook_runtime_diagnostics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_stripe_webhook_runtime_diagnostics() TO service_role;
