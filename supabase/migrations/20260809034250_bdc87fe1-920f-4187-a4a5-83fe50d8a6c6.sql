-- Corrective Migration for Stripe Checkout targeted security gaps
-- Date: 2026-08-09
-- Version: 1.1

-- Step 1: Add event tracking columns to subscriptions if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'stripe_last_event_created') THEN
        ALTER TABLE public.subscriptions ADD COLUMN stripe_last_event_created BIGINT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'stripe_last_event_priority') THEN
        ALTER TABLE public.subscriptions ADD COLUMN stripe_last_event_priority INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'stripe_last_event_id') THEN
        ALTER TABLE public.subscriptions ADD COLUMN stripe_last_event_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'stripe_last_event_type') THEN
        ALTER TABLE public.subscriptions ADD COLUMN stripe_last_event_type TEXT;
    END IF;
END $$;

-- Step 2: Add provider_event_created_at to payment_events
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_events' AND column_name = 'provider_event_created_at') THEN
        ALTER TABLE public.payment_events ADD COLUMN provider_event_created_at BIGINT;
    END IF;
END $$;

-- Step 3: Refine reserve_checkout_attempt with p_verified_user_id and membership validation
-- Dropping first because we are changing parameter names
DROP FUNCTION IF EXISTS public.reserve_checkout_attempt(UUID, UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.reserve_checkout_attempt(
    p_empresa_id UUID,
    p_subscription_id UUID,
    p_verified_user_id UUID,
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
    -- 0. STRICTOR VALIDATION
    -- Verify membership, status active, and role admin
    IF NOT EXISTS (
        SELECT 1 
        FROM public.user_company_access 
        WHERE empresa_id = p_empresa_id 
          AND user_id = p_verified_user_id 
          AND status = 'active' 
          AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Forbidden: Admin membership required';
    END IF;

    -- Verify the subscription belongs to the company
    IF NOT EXISTS (
        SELECT 1 
        FROM public.subscriptions 
        WHERE id = p_subscription_id 
          AND empresa_id = p_empresa_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: Subscription mismatch';
    END IF;

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
        p_verified_user_id,
        gen_random_uuid()::text,
        'creating',
        v_now + interval '24 hours'
    )
    RETURNING * INTO v_attempt;

    RETURN v_attempt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_checkout_attempt(UUID, UUID, UUID, TEXT) TO service_role;

-- Step 4: Refine process_stripe_webhook_event with finance validation and ordering
CREATE OR REPLACE FUNCTION public.process_stripe_webhook_event(
    p_provider_event_id TEXT,
    p_event_type TEXT,
    p_payload_sha256 TEXT,
    p_livemode BOOLEAN,
    p_event_data JSONB,
    p_event_created BIGINT,
    p_canonical_plan_code TEXT DEFAULT 'enterprise_monthly',
    p_canonical_price_id TEXT DEFAULT NULL,
    p_canonical_currency TEXT DEFAULT 'brl',
    p_canonical_amount BIGINT DEFAULT 3590
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
    v_internal_sub_id UUID;
    v_empresa_id UUID;
    v_object JSONB;
    v_metadata JSONB;
    v_event_priority INTEGER;
    v_last_event_created BIGINT;
    v_last_event_priority INTEGER;
    v_is_out_of_order BOOLEAN := FALSE;
    v_is_retryable BOOLEAN := FALSE;
    
    -- Extracted values for validation
    v_obs_price_id TEXT;
    v_obs_currency TEXT;
    v_obs_amount BIGINT;
    v_obs_quantity INTEGER;
    v_obs_plan_code TEXT;
    v_stripe_sub_id TEXT;
    v_stripe_customer_id TEXT;
    v_current_period_end BIGINT;
    v_existing_current_period_end TIMESTAMPTZ;
BEGIN
    -- 1. Security Check: Environment
    IF p_livemode THEN
        RAISE EXCEPTION 'Livemode events are strictly prohibited.';
    END IF;

    -- 2. Idempotency (Strict)
    IF EXISTS (SELECT 1 FROM public.payment_events WHERE provider = 'stripe' AND provider_event_id = p_provider_event_id AND processing_status = 'processed') THEN
        RETURN jsonb_build_object('status', 'ignored', 'reason', 'Duplicate event');
    END IF;

    -- 3. Priority Mapping
    v_event_priority := CASE p_event_type
        WHEN 'checkout.session.completed' THEN 10
        WHEN 'customer.subscription.created' THEN 20
        WHEN 'customer.subscription.updated' THEN 30
        WHEN 'invoice.payment_failed' THEN 40
        WHEN 'invoice.paid' THEN 50
        WHEN 'customer.subscription.deleted' THEN 60
        ELSE 100
    END;

    -- 4. Initial Record or Claim Retry
    INSERT INTO public.payment_events (
        provider, provider_event_id, event_type, payload_sha256, 
        provider_event_created_at, processing_status
    )
    VALUES (
        'stripe', p_provider_event_id, p_event_type, p_payload_sha256, 
        p_event_created, 'processing'
    )
    ON CONFLICT (provider, provider_event_id) DO UPDATE 
    SET processing_status = 'processing', updated_at = now()
    RETURNING id INTO v_event_id;

    v_object := p_event_data->'object';
    v_metadata := v_object->'metadata';
    v_stripe_sub_id := v_object->>'subscription';
    v_stripe_customer_id := v_object->>'customer';

    -- 5. Resolve Context
    v_internal_sub_id := (v_metadata->>'internal_subscription_id')::UUID;
    v_empresa_id := (v_metadata->>'empresa_id')::UUID;
    v_obs_plan_code := v_metadata->>'plan_code';

    -- 6. Link Check / Retryable Logic
    IF v_internal_sub_id IS NULL THEN
        -- Fallback to DB lookup if metadata fails (for update/deleted events)
        IF v_stripe_sub_id IS NOT NULL THEN
            SELECT id, empresa_id INTO v_internal_sub_id, v_empresa_id 
            FROM public.subscriptions WHERE stripe_subscription_id = v_stripe_sub_id;
        END IF;
    END IF;

    IF v_internal_sub_id IS NULL THEN
        -- VALID EVENT BUT NO LINK YET -> RETRYABLE
        UPDATE public.payment_events 
        SET processing_status = 'failed_retryable', sanitized_error_code = 'UNLINKED' 
        WHERE id = v_event_id;
        
        RETURN jsonb_build_object('status', 'retryable_unlinked', 'event_id', v_event_id);
    END IF;

    -- 7. Ordering Logic
    SELECT stripe_last_event_created, stripe_last_event_priority, current_period_ends_at
    INTO v_last_event_created, v_last_event_priority, v_existing_current_period_end
    FROM public.subscriptions WHERE id = v_internal_sub_id
    FOR UPDATE;

    IF v_last_event_created IS NOT NULL THEN
        IF p_event_created < v_last_event_created THEN
            v_is_out_of_order := TRUE;
        ELSIF p_event_created = v_last_event_created AND v_event_priority < v_last_event_priority THEN
            v_is_out_of_order := TRUE;
        END IF;
    END IF;

    IF v_is_out_of_order THEN
        UPDATE public.payment_events 
        SET processing_status = 'ignored_out_of_order', updated_at = now() 
        WHERE id = v_event_id;
        
        RETURN jsonb_build_object('status', 'ignored_out_of_order', 'event_id', v_event_id);
    END IF;

    -- 8. Financial & Contract Validation
    -- Resolve observed values from event object
    IF p_event_type IN ('customer.subscription.created', 'customer.subscription.updated') THEN
        v_obs_price_id := v_object->'items'->'data'->0->'price'->>'id';
        v_obs_currency := v_object->'items'->'data'->0->'price'->>'currency';
        v_obs_amount := (v_object->'items'->'data'->0->'price'->>'unit_amount')::BIGINT;
        v_obs_quantity := (v_object->'items'->'data'->0->>'quantity')::INTEGER;
    ELSIF p_event_type = 'invoice.paid' THEN
        v_obs_currency := v_object->>'currency';
        v_obs_amount := (v_object->>'amount_paid')::BIGINT;
        -- Quantity and Price usually resolved from lines if needed, but for Vejamais monthly it's flat
    END IF;

    -- Strict validation against canonicals
    IF v_obs_plan_code IS NOT NULL AND v_obs_plan_code <> p_canonical_plan_code THEN
        RAISE EXCEPTION 'Contract violation: plan_code mismatch';
    END IF;

    IF v_obs_currency IS NOT NULL AND LOWER(v_obs_currency) <> LOWER(p_canonical_currency) THEN
        RAISE EXCEPTION 'Contract violation: currency mismatch';
    END IF;

    IF p_event_type = 'invoice.paid' AND v_obs_amount < p_canonical_amount THEN
        RAISE EXCEPTION 'Contract violation: insufficient amount';
    END IF;

    -- 9. Atomic Application
    CASE p_event_type
        WHEN 'checkout.session.completed' THEN
            UPDATE public.subscriptions SET 
                stripe_customer_id = v_stripe_customer_id,
                stripe_subscription_id = v_stripe_sub_id,
                stripe_checkout_session_id = v_object->>'id',
                updated_at = now()
            WHERE id = v_internal_sub_id;

        WHEN 'customer.subscription.created', 'customer.subscription.updated' THEN
            v_current_period_end := (v_object->>'current_period_end')::BIGINT;
            
            UPDATE public.subscriptions SET 
                status = CASE 
                    WHEN v_object->>'status' = 'active' THEN 'active'::public.subscription_status
                    WHEN v_object->>'status' = 'past_due' THEN 'past_due'::public.subscription_status
                    WHEN v_object->>'status' = 'unpaid' THEN 'past_due'::public.subscription_status
                    WHEN v_object->>'status' = 'canceled' THEN 'canceled'::public.subscription_status
                    WHEN v_object->>'status' = 'trialing' THEN 'trialing'::public.subscription_status
                    ELSE status
                END,
                current_period_ends_at = GREATEST(v_existing_current_period_end, to_timestamp(v_current_period_end)),
                cancel_at_period_end = (v_object->>'cancel_at_period_end')::BOOLEAN,
                updated_at = now()
            WHERE id = v_internal_sub_id;

        WHEN 'invoice.paid' THEN
            UPDATE public.subscriptions SET 
                status = 'active', 
                last_payment_status = 'paid',
                updated_at = now()
            WHERE id = v_internal_sub_id;

        WHEN 'customer.subscription.deleted' THEN
            UPDATE public.subscriptions SET 
                status = 'canceled', 
                canceled_at = now(),
                updated_at = now()
            WHERE id = v_internal_sub_id;
            
        ELSE
            -- No-op for unsupported events
    END CASE;

    -- 10. Finalize State
    UPDATE public.subscriptions SET 
        stripe_last_event_created = p_event_created,
        stripe_last_event_priority = v_event_priority,
        stripe_last_event_id = p_provider_event_id,
        stripe_last_event_type = p_event_type
    WHERE id = v_internal_sub_id;

    UPDATE public.payment_events SET 
        processing_status = 'processed',
        processed_at = now(),
        subscription_id = v_internal_sub_id,
        empresa_id = v_empresa_id,
        updated_at = now()
    WHERE id = v_event_id;

    RETURN jsonb_build_object('status', 'success', 'event_id', v_event_id);

EXCEPTION WHEN OTHERS THEN
    UPDATE public.payment_events SET 
        processing_status = 'failed',
        sanitized_error_code = SQLSTATE,
        updated_at = now()
    WHERE id = v_event_id;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_stripe_webhook_event(TEXT, TEXT, TEXT, BOOLEAN, JSONB, BIGINT, TEXT, TEXT, TEXT, BIGINT) TO service_role;
