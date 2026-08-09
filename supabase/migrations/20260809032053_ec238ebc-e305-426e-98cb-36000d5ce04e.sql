-- Step 1: Create checkout_attempts table
CREATE TABLE public.checkout_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id),
    created_by_user_id UUID NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    provider_checkout_session_id TEXT UNIQUE,
    provider_customer_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('creating', 'open', 'completed', 'expired', 'cancelled', 'failed')),
    expires_at TIMESTAMPTZ,
    last_error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index to allow only one active (creating/open) attempt per empresa and subscription
CREATE UNIQUE INDEX idx_checkout_attempts_active_per_sub 
ON public.checkout_attempts (empresa_id, subscription_id) 
WHERE (status IN ('creating', 'open'));

-- Step 1.1: Security for checkout_attempts
ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.checkout_attempts TO service_role;
GRANT ALL ON public.checkout_attempts TO postgres;

-- Step 2: Atomic Reservation RPC
CREATE OR REPLACE FUNCTION public.reserve_checkout_attempt(
    p_empresa_id UUID,
    p_subscription_id UUID,
    p_user_id UUID,
    p_provider TEXT DEFAULT 'stripe'
)
RETURNS public.checkout_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempt public.checkout_attempts;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- 1. Lock and check for existing valid attempt
    SELECT * INTO v_attempt
    FROM public.checkout_attempts
    WHERE empresa_id = p_empresa_id 
      AND subscription_id = p_subscription_id
      AND status IN ('creating', 'open')
      AND (expires_at IS NULL OR expires_at > v_now)
    FOR UPDATE;

    IF v_attempt.id IS NOT NULL THEN
        RETURN v_attempt;
    END IF;

    -- 2. Create new attempt if none found (or previous expired)
    INSERT INTO public.checkout_attempts (
        provider,
        empresa_id,
        subscription_id,
        created_by_user_id,
        idempotency_key,
        status,
        expires_at
    )
    VALUES (
        p_provider,
        p_empresa_id,
        p_subscription_id,
        p_user_id,
        gen_random_uuid()::text, -- internal idempotency key
        'creating',
        v_now + interval '24 hours'
    )
    RETURNING * INTO v_attempt;

    RETURN v_attempt;
END;
$$;

ALTER FUNCTION public.reserve_checkout_attempt(UUID, UUID, UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reserve_checkout_attempt(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_checkout_attempt(UUID, UUID, UUID, TEXT) TO service_role;

-- Step 5: Webhook Transactional RPC
CREATE OR REPLACE FUNCTION public.process_stripe_webhook_event(
    p_provider_event_id TEXT,
    p_event_type TEXT,
    p_payload_sha256 TEXT,
    p_livemode BOOLEAN,
    p_event_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
    v_empresa_id UUID;
    v_subscription_id UUID;
    v_internal_sub_id UUID;
    v_stripe_customer_id TEXT;
    v_stripe_sub_id TEXT;
    v_stripe_session_id TEXT;
    v_plan_id UUID;
    v_current_period_end TIMESTAMPTZ;
    v_cancel_at_period_end BOOLEAN;
    v_status TEXT;
    v_object JSONB;
    v_metadata JSONB;
BEGIN
    -- 1. Security check: No livemode allowed
    IF p_livemode THEN
        RAISE EXCEPTION 'Livemode events are strictly prohibited in this environment.';
    END IF;

    -- 2. Idempotency check for payment_events
    IF EXISTS (SELECT 1 FROM public.payment_events WHERE provider = 'stripe' AND provider_event_id = p_provider_event_id) THEN
        RETURN jsonb_build_object('status', 'ignored', 'reason', 'Duplicate event');
    END IF;

    -- 3. Record event (Atomic)
    INSERT INTO public.payment_events (
        provider,
        provider_event_id,
        event_type,
        payload_sha256,
        processing_status
    )
    VALUES (
        'stripe',
        p_provider_event_id,
        p_event_type,
        p_payload_sha256,
        'processing'
    )
    RETURNING id INTO v_event_id;

    v_object := p_event_data->'object';
    v_metadata := v_object->'metadata';
    
    -- Extract common fields
    v_stripe_customer_id := v_object->>'customer';
    v_stripe_sub_id := v_object->>'subscription';
    
    -- Try to resolve internal subscription ID from metadata first
    IF v_metadata ? 'internal_subscription_id' THEN
        v_internal_sub_id := (v_metadata->>'internal_subscription_id')::UUID;
    END IF;

    -- If not in metadata, resolve by stripe_subscription_id or stripe_customer_id
    IF v_internal_sub_id IS NULL AND v_stripe_sub_id IS NOT NULL THEN
        SELECT id, empresa_id INTO v_internal_sub_id, v_empresa_id 
        FROM public.subscriptions 
        WHERE stripe_subscription_id = v_stripe_sub_id;
    END IF;

    IF v_internal_sub_id IS NULL AND v_stripe_customer_id IS NOT NULL THEN
        SELECT id, empresa_id INTO v_internal_sub_id, v_empresa_id 
        FROM public.subscriptions 
        WHERE stripe_customer_id = v_stripe_customer_id
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- 4. Process by event type
    CASE p_event_type
        WHEN 'checkout.session.completed' THEN
            v_stripe_session_id := v_object->>'id';
            v_empresa_id := (v_metadata->>'empresa_id')::UUID;
            v_internal_sub_id := (v_metadata->>'internal_subscription_id')::UUID;
            
            -- Bind IDs to internal subscription
            UPDATE public.subscriptions
            SET stripe_customer_id = v_stripe_customer_id,
                stripe_subscription_id = v_stripe_sub_id,
                stripe_checkout_session_id = v_stripe_session_id,
                updated_at = now()
            WHERE id = v_internal_sub_id;

            -- Update checkout attempt status
            UPDATE public.checkout_attempts
            SET status = 'completed',
                provider_checkout_session_id = v_stripe_session_id,
                provider_customer_id = v_stripe_customer_id,
                updated_at = now()
            WHERE provider_checkout_session_id = v_stripe_session_id 
               OR (empresa_id = v_empresa_id AND status = 'open');

        WHEN 'customer.subscription.created', 'customer.subscription.updated' THEN
            v_current_period_end := to_timestamp((v_object->>'current_period_end')::bigint);
            v_cancel_at_period_end := COALESCE((v_object->>'cancel_at_period_end')::boolean, false);
            v_status := v_object->>'status';
            
            -- Map Stripe status to internal status
            -- Only update if internal status is not already 'canceled' by a later event
            UPDATE public.subscriptions
            SET stripe_customer_id = v_stripe_customer_id,
                current_period_ends_at = v_current_period_end,
                cancel_at_period_end = v_cancel_at_period_end,
                updated_at = now()
            WHERE id = v_internal_sub_id
              AND status <> 'canceled';

        WHEN 'invoice.paid' THEN
            -- Activate/Renew
            UPDATE public.subscriptions
            SET status = 'active',
                last_payment_status = 'paid',
                updated_at = now()
            WHERE id = v_internal_sub_id;

        WHEN 'invoice.payment_failed' THEN
            UPDATE public.subscriptions
            SET status = 'past_due',
                last_payment_status = 'failed',
                updated_at = now()
            WHERE id = v_internal_sub_id;

        WHEN 'customer.subscription.deleted' THEN
            UPDATE public.subscriptions
            SET status = 'canceled',
                canceled_at = now(),
                updated_at = now()
            WHERE id = v_internal_sub_id;

        ELSE
            -- Unknown event
    END CASE;

    -- 5. Mark event as processed
    UPDATE public.payment_events
    SET processing_status = 'processed',
        processed_at = now(),
        subscription_id = v_internal_sub_id,
        empresa_id = v_empresa_id,
        updated_at = now()
    WHERE id = v_event_id;

    RETURN jsonb_build_object('status', 'success', 'event_id', v_event_id);
EXCEPTION WHEN OTHERS THEN
    IF v_event_id IS NOT NULL THEN
        UPDATE public.payment_events
        SET processing_status = 'failed',
            sanitized_error_code = SQLSTATE,
            updated_at = now()
        WHERE id = v_event_id;
    END IF;
    RAISE;
END;
$$;

ALTER FUNCTION public.process_stripe_webhook_event(TEXT, TEXT, TEXT, BOOLEAN, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.process_stripe_webhook_event(TEXT, TEXT, TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_stripe_webhook_event(TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO service_role;
