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
    
    -- Extracted values for validation
    v_obs_price_id TEXT;
    v_obs_currency TEXT;
    v_obs_amount BIGINT;
    v_obs_plan_code TEXT;
    v_stripe_sub_id TEXT;
    v_stripe_customer_id TEXT;
    v_current_period_end BIGINT;
    v_existing_current_period_end TIMESTAMPTZ;
    v_existing_status TEXT;
    v_checkout_attempt_id UUID;
BEGIN
    -- 1. Security Check: Environment
    IF p_livemode THEN
        RAISE EXCEPTION 'Livemode events are strictly prohibited.';
    END IF;

    -- 2. Idempotency (Strict)
    IF EXISTS (SELECT 1 FROM public.payment_events WHERE provider = 'stripe' AND provider_event_id = p_provider_event_id AND processing_status = 'processed') THEN
        RETURN jsonb_build_object('status', 'processed', 'reason', 'Duplicate event');
    END IF;

    -- 3. Priority Mapping
    v_event_priority := CASE p_event_type
        WHEN 'checkout.session.completed' THEN 10
        WHEN 'checkout.session.expired' THEN 15
        WHEN 'customer.subscription.created' THEN 20
        WHEN 'customer.subscription.updated' THEN 30
        WHEN 'invoice.payment_failed' THEN 40
        WHEN 'invoice.paid' THEN 50
        WHEN 'customer.subscription.deleted' THEN 60
        ELSE 100
    END;

    -- 4. Initial Record
    INSERT INTO public.payment_events (
        provider, provider_event_id, event_type, payload_sha256, 
        provider_event_created_at, processing_status
    )
    VALUES (
        'stripe', p_provider_event_id, p_event_type, p_payload_sha256, 
        p_event_created, 'processing'
    )
    ON CONFLICT (provider, provider_event_id) DO UPDATE 
    SET updated_at = now()
    RETURNING id INTO v_event_id;

    v_object := p_event_data->'object';
    v_metadata := v_object->'metadata';
    v_stripe_sub_id := v_object->>'subscription';
    
    -- 5. Resolve Context
    v_internal_sub_id := (v_metadata->>'internal_subscription_id')::UUID;
    v_empresa_id := (v_metadata->>'empresa_id')::UUID;
    v_obs_plan_code := v_metadata->>'plan_code';
    v_checkout_attempt_id := (v_metadata->>'attempt_id')::UUID;

    IF v_internal_sub_id IS NULL AND v_stripe_sub_id IS NOT NULL THEN
        SELECT id, empresa_id INTO v_internal_sub_id, v_empresa_id 
        FROM public.subscriptions WHERE stripe_subscription_id = v_stripe_sub_id;
    END IF;

    IF v_internal_sub_id IS NULL THEN
        UPDATE public.payment_events 
        SET processing_status = 'failed_retryable', sanitized_error_code = 'UNLINKED' 
        WHERE id = v_event_id;
        RETURN jsonb_build_object('status', 'failed_retryable', 'event_id', v_event_id);
    END IF;

    -- 6. Ordering Logic (Row Lock)
    SELECT stripe_last_event_created, stripe_last_event_priority, current_period_ends_at, status
    INTO v_last_event_created, v_last_event_priority, v_existing_current_period_end, v_existing_status
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
        UPDATE public.payment_events SET processing_status = 'ignored_out_of_order' WHERE id = v_event_id;
        RETURN jsonb_build_object('status', 'ignored_out_of_order', 'event_id', v_event_id);
    END IF;

    -- 7. EXTRAÇÃO FINANCEIRA POR TIPO DE EVENTO
    IF p_event_type IN ('customer.subscription.created', 'customer.subscription.updated') THEN
        v_obs_price_id := v_object->'items'->'data'->0->'price'->>'id';
        v_obs_currency := v_object->'items'->'data'->0->'price'->>'currency';
        v_obs_amount := (v_object->'items'->'data'->0->'price'->>'unit_amount')::BIGINT;
    ELSIF p_event_type = 'invoice.paid' THEN
        v_obs_currency := v_object->>'currency';
        v_obs_amount := (v_object->>'amount_paid')::BIGINT;
        -- Validation of recurring line item
        IF NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_object->'lines'->'data') AS line
            WHERE (line->>'amount')::BIGINT >= p_canonical_amount 
              AND line->>'currency' = p_canonical_currency
        ) THEN
            UPDATE public.payment_events SET processing_status = 'rejected_permanent', sanitized_error_code = 'INVALID_FINANCIAL_LINE' WHERE id = v_event_id;
            RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Missing valid subscription line');
        END IF;
    END IF;

    -- Stricter validation
    IF (v_obs_plan_code IS NOT NULL AND v_obs_plan_code <> p_canonical_plan_code) OR
       (v_obs_currency IS NOT NULL AND LOWER(v_obs_currency) <> LOWER(p_canonical_currency)) OR
       (p_event_type = 'invoice.paid' AND v_obs_amount < p_canonical_amount) THEN
        UPDATE public.payment_events SET processing_status = 'rejected_permanent', sanitized_error_code = 'CONTRACT_VIOLATION' WHERE id = v_event_id;
        RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Contract violation');
    END IF;

    -- 8. Atomic Application
    CASE p_event_type
        WHEN 'checkout.session.completed' THEN
            UPDATE public.subscriptions SET 
                stripe_customer_id = v_object->>'customer',
                stripe_subscription_id = v_object->>'subscription',
                stripe_checkout_session_id = v_object->>'id',
                updated_at = now()
            WHERE id = v_internal_sub_id;

            IF v_checkout_attempt_id IS NOT NULL THEN
                UPDATE public.checkout_attempts 
                SET status = 'completed', updated_at = now() 
                WHERE id = v_checkout_attempt_id AND empresa_id = v_empresa_id;
            END IF;

        WHEN 'checkout.session.expired' THEN
            IF v_checkout_attempt_id IS NOT NULL THEN
                UPDATE public.checkout_attempts 
                SET status = 'expired', updated_at = now() 
                WHERE id = v_checkout_attempt_id AND empresa_id = v_empresa_id;
            END IF;

        WHEN 'customer.subscription.created', 'customer.subscription.updated' THEN
            v_current_period_end := (v_object->>'current_period_end')::BIGINT;
            UPDATE public.subscriptions SET 
                status = CASE 
                    WHEN v_object->>'status' = 'active' THEN 'active'
                    WHEN v_object->>'status' = 'past_due' THEN 'past_due'
                    WHEN v_object->>'status' = 'unpaid' THEN 'past_due'
                    WHEN v_object->>'status' = 'canceled' THEN 'canceled'
                    WHEN v_object->>'status' = 'trialing' THEN 'trialing'
                    ELSE status
                END,
                current_period_ends_at = GREATEST(v_existing_current_period_end, to_timestamp(v_current_period_end)),
                cancel_at_period_end = (v_object->>'cancel_at_period_end')::BOOLEAN,
                updated_at = now()
            WHERE id = v_internal_sub_id;

        WHEN 'invoice.paid' THEN
            UPDATE public.subscriptions SET status = 'active', last_payment_status = 'paid', updated_at = now() WHERE id = v_internal_sub_id;

        WHEN 'customer.subscription.deleted' THEN
            UPDATE public.subscriptions SET status = 'canceled', canceled_at = now(), updated_at = now() WHERE id = v_internal_sub_id;
        ELSE
    END CASE;

    -- 9. Finalize
    UPDATE public.subscriptions SET 
        stripe_last_event_created = p_event_created, stripe_last_event_priority = v_event_priority,
        stripe_last_event_id = p_provider_event_id, stripe_last_event_type = p_event_type
    WHERE id = v_internal_sub_id;

    UPDATE public.payment_events SET 
        processing_status = 'processed', processed_at = now(), 
        subscription_id = v_internal_sub_id, empresa_id = v_empresa_id, updated_at = now()
    WHERE id = v_event_id;

    RETURN jsonb_build_object('status', 'processed', 'event_id', v_event_id);
END;
$$;
