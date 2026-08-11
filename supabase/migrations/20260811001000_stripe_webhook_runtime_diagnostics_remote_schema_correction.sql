-- PROTOCOLO: VEJAMAIS_STRIPE_DURABLE_DIAGNOSTICS_REMOTE_RECONCILIATION_CONTROLLED_EPHEMERAL_MODE
-- Reconciliação remota da infraestrutura temporária de diagnóstico.

-- 1. Normalização da Tabela
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stripe_webhook_runtime_diagnostics' AND column_name = 'error_payload') THEN
        ALTER TABLE public.stripe_webhook_runtime_diagnostics DROP COLUMN error_payload;
    END IF;
END $$;

-- 2. Constraints e Indexes
-- Limpar constraints antigas para evitar conflitos
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'stripe_webhook_runtime_diagnostics' AND constraint_type IN ('CHECK', 'UNIQUE')) LOOP
        IF r.constraint_name != 'stripe_webhook_runtime_diagnostics_pkey' THEN
            EXECUTE 'ALTER TABLE public.stripe_webhook_runtime_diagnostics DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END IF;
    END LOOP;
END $$;

-- UNIQUE constraint
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_trace_stage_unique UNIQUE(trace_id, stage);

-- CHECK event_id_hash (SHA-256)
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_event_hash_check CHECK (event_id_hash ~ '^[0-9a-f]{64}$');

-- CHECK event_type (Allowlist de 7 eventos)
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_event_type_check CHECK (
    event_type IN (
        'checkout.session.completed',
        'checkout.session.expired',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.paid',
        'invoice.payment_failed',
        'UNKNOWN'
    )
);

-- CHECK stage (Allowlist de 5 checkpoints)
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_stage_check CHECK (
    stage IN (
        'SIGNATURE_VALIDATED',
        'PAYLOAD_SANITIZED',
        'RPC_CALL_STARTED',
        'RPC_RESPONSE_RECEIVED',
        'HTTP_RESPONSE_READY'
    )
);

-- CHECK reason_code (Allowlist canônica)
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_reason_code_check CHECK (
    reason_code IS NULL OR reason_code IN (
        'RAW_BODY_READ_FAILED',
        'SIGNATURE_INVALID',
        'EVENT_PARSE_FAILED',
        'LIVEMODE_REJECTED',
        'UNSUPPORTED_EVENT',
        'PAYLOAD_CONTRACT_FAILED',
        'RPC_TRANSPORT_FAILED',
        'RPC_REJECTED_RETRYABLE',
        'RPC_REJECTED_PERMANENT',
        'RPC_RESPONSE_INVALID',
        'UNEXPECTED_HANDLER_FAILURE'
    )
);

-- CHECK http_status
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_http_status_check CHECK (http_status BETWEEN 100 AND 599);

-- CHECK expires_at
ALTER TABLE public.stripe_webhook_runtime_diagnostics ADD CONSTRAINT stripe_webhook_runtime_diagnostics_expires_at_check CHECK (expires_at > created_at);

-- Set DEFAULT for expires_at
ALTER TABLE public.stripe_webhook_runtime_diagnostics ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- 3. RLS
ALTER TABLE public.stripe_webhook_runtime_diagnostics ENABLE ROW LEVEL SECURITY;

-- 4. RPC de Registro Canônica
CREATE OR REPLACE FUNCTION public.log_stripe_webhook_diagnostic(
    p_trace_id uuid,
    p_event_id_hash text,
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
DECLARE
    v_total_rows integer;
    v_rows_per_trace integer;
BEGIN
    -- 1. Limpeza oportunística de expirados
    DELETE FROM public.stripe_webhook_runtime_diagnostics
    WHERE expires_at <= now();

    -- 2. Limite de Volume Total (Global)
    SELECT count(*) INTO v_total_rows FROM public.stripe_webhook_runtime_diagnostics;
    IF v_total_rows >= 100 THEN
        RETURN;
    END IF;

    -- 3. Limite de Volume por Trace
    SELECT count(*) INTO v_rows_per_trace 
    FROM public.stripe_webhook_runtime_diagnostics 
    WHERE trace_id = p_trace_id;
    
    IF v_rows_per_trace >= 5 THEN
        RETURN;
    END IF;

    -- 4. Inserção Canônica
    INSERT INTO public.stripe_webhook_runtime_diagnostics (
        trace_id,
        event_id_hash,
        event_type,
        stage,
        reason_code,
        http_status
    ) VALUES (
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

ALTER FUNCTION public.log_stripe_webhook_diagnostic(uuid, text, text, text, text, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.log_stripe_webhook_diagnostic(uuid, text, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_stripe_webhook_diagnostic(uuid, text, text, text, text, integer) TO service_role;

-- 5. RPCs de Purge
CREATE OR REPLACE FUNCTION public.purge_expired_stripe_webhook_runtime_diagnostics()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM public.stripe_webhook_runtime_diagnostics
    WHERE expires_at <= now();
$$;

ALTER FUNCTION public.purge_expired_stripe_webhook_runtime_diagnostics() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.purge_expired_stripe_webhook_runtime_diagnostics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_stripe_webhook_runtime_diagnostics() TO service_role;

CREATE OR REPLACE FUNCTION public.purge_all_stripe_webhook_runtime_diagnostics()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM public.stripe_webhook_runtime_diagnostics;
$$;

ALTER FUNCTION public.purge_all_stripe_webhook_runtime_diagnostics() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.purge_all_stripe_webhook_runtime_diagnostics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_all_stripe_webhook_runtime_diagnostics() TO service_role;
