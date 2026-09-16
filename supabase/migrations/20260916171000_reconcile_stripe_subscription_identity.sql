-- VEJAMAIS_BILLING_STRIPE_SUBSCRIPTION_IDENTITY_RECONCILIATION
-- Repository-only migration. Do not apply without explicit approval.
-- Purpose:
--   1. Make Stripe subscription object.id the canonical provider subscription identity.
--   2. Allow a newer customer.subscription.created event to promote a replacement subscription.
--   3. Prevent delayed events from a superseded Stripe subscription from restoring/canceling it.
--   4. Reject cross-record/cross-company identity conflicts.

BEGIN;

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
    v_resolved_empresa_id UUID;
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
    v_incoming_stripe_sub_id TEXT;
    v_existing_stripe_sub_id TEXT;
    v_stripe_customer_id TEXT;
    v_current_period_end BIGINT;
    v_existing_current_period_end TIMESTAMPTZ;
    v_existing_status TEXT;
    v_checkout_attempt_id UUID;
    v_provider_session_id TEXT;

    -- Local block variables for checkout.session.expired
    v_locked_attempt_id UUID;
    v_locked_empresa_id UUID;
    v_locked_subscription_id UUID;
    v_locked_status TEXT;

    -- Metadata validation variables
    v_meta_internal_sub_id UUID;
    v_meta_empresa_id UUID;
    v_meta_attempt_id UUID;
    v_meta_plan_code TEXT;
BEGIN
    -- 1. Security Check: Environment (kept compatible with current live-mode contract)

    -- 2. Idempotency (Strict)
    IF EXISTS (
        SELECT 1
        FROM public.payment_events
        WHERE provider = 'stripe'
          AND provider_event_id = p_provider_event_id
          AND processing_status = 'processed'
    ) THEN
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
        provider,
        provider_event_id,
        event_type,
        payload_sha256,
        provider_event_created_at,
        processing_status
    )
    VALUES (
        'stripe',
        p_provider_event_id,
        p_event_type,
        p_payload_sha256,
        p_event_created,
        'processing'
    )
    ON CONFLICT (provider, provider_event_id) DO UPDATE
    SET updated_at = now()
    RETURNING id INTO v_event_id;

    v_object := p_event_data->'object';
    v_metadata := v_object->'metadata';
    v_stripe_sub_id := NULLIF(v_object->>'subscription', '');
    v_provider_session_id := NULLIF(v_object->>'id', '');

    -- Subscription events identify the provider subscription by object.id, not object.subscription.
    v_incoming_stripe_sub_id := CASE
        WHEN p_event_type IN (
            'customer.subscription.created',
            'customer.subscription.updated',
            'customer.subscription.deleted'
        ) THEN NULLIF(v_object->>'id', '')
        ELSE v_stripe_sub_id
    END;

    -- 5. Specialized branch: checkout.session.expired
    IF p_event_type = 'checkout.session.expired' THEN
        IF v_provider_session_id IS NULL THEN
            UPDATE public.payment_events
            SET processing_status = 'rejected_permanent',
                sanitized_error_code = 'MISSING_SESSION_ID'
            WHERE id = v_event_id;

            RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Missing Session ID');
        END IF;

        SELECT id, empresa_id, subscription_id, status
        INTO v_locked_attempt_id, v_locked_empresa_id, v_locked_subscription_id, v_locked_status
        FROM public.checkout_attempts
        WHERE provider = 'stripe'
          AND provider_checkout_session_id = v_provider_session_id
        FOR UPDATE;

        IF v_locked_attempt_id IS NULL THEN
            UPDATE public.payment_events
            SET processing_status = 'failed_retryable',
                sanitized_error_code = 'UNLINKED_SESSION'
            WHERE id = v_event_id;

            RETURN jsonb_build_object('status', 'failed_retryable', 'event_id', v_event_id);
        END IF;

        BEGIN
            v_meta_internal_sub_id := (v_metadata->>'internal_subscription_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_meta_internal_sub_id := NULL;
        END;
        BEGIN
            v_meta_empresa_id := (v_metadata->>'empresa_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_meta_empresa_id := NULL;
        END;
        BEGIN
            v_meta_attempt_id := (v_metadata->>'attempt_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_meta_attempt_id := NULL;
        END;
        v_meta_plan_code := v_metadata->>'plan_code';

        IF (v_meta_internal_sub_id IS NOT NULL AND v_meta_internal_sub_id <> v_locked_subscription_id)
           OR (v_meta_empresa_id IS NOT NULL AND v_meta_empresa_id <> v_locked_empresa_id)
           OR (v_meta_attempt_id IS NOT NULL AND v_meta_attempt_id <> v_locked_attempt_id)
           OR (v_meta_plan_code IS NOT NULL AND v_meta_plan_code <> p_canonical_plan_code) THEN
            UPDATE public.payment_events
            SET processing_status = 'rejected_permanent',
                sanitized_error_code = 'METADATA_MISMATCH'
            WHERE id = v_event_id;

            RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Metadata mismatch with locked session');
        END IF;

        IF v_locked_status IN ('open', 'expired') THEN
            UPDATE public.checkout_attempts
            SET status = 'expired', updated_at = now()
            WHERE id = v_locked_attempt_id;
        END IF;

        UPDATE public.payment_events
        SET processing_status = 'processed',
            processed_at = now(),
            subscription_id = v_locked_subscription_id,
            empresa_id = v_locked_empresa_id,
            updated_at = now()
        WHERE id = v_event_id;

        RETURN jsonb_build_object('status', 'processed', 'event_id', v_event_id);
    END IF;

    -- 6. Resolve Context (other events)
    BEGIN
        v_internal_sub_id := (v_metadata->>'subscription_id')::UUID;
        IF v_internal_sub_id IS NULL THEN
            v_internal_sub_id := (v_metadata->>'internal_subscription_id')::UUID;
        END IF;
        v_empresa_id := (v_metadata->>'empresa_id')::UUID;
        v_obs_plan_code := v_metadata->>'plan_code';
        v_checkout_attempt_id := (v_metadata->>'attempt_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
        UPDATE public.payment_events
        SET processing_status = 'rejected_permanent',
            sanitized_error_code = 'MALFORMED_METADATA'
        WHERE id = v_event_id;

        RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Malformed metadata');
    END;

    -- Fallback to the existing canonical provider identity when metadata is absent.
    IF v_internal_sub_id IS NULL AND v_incoming_stripe_sub_id IS NOT NULL THEN
        SELECT id, empresa_id
        INTO v_internal_sub_id, v_empresa_id
        FROM public.subscriptions
        WHERE stripe_subscription_id = v_incoming_stripe_sub_id;
    END IF;

    IF v_internal_sub_id IS NULL THEN
        UPDATE public.payment_events
        SET processing_status = 'failed_retryable',
            sanitized_error_code = 'UNLINKED'
        WHERE id = v_event_id;

        RETURN jsonb_build_object('status', 'failed_retryable', 'event_id', v_event_id);
    END IF;

    -- Subscription lifecycle events must carry their own Stripe subscription ID.
    IF p_event_type IN (
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted'
    ) AND v_incoming_stripe_sub_id IS NULL THEN
        UPDATE public.payment_events
        SET processing_status = 'rejected_permanent',
            sanitized_error_code = 'MISSING_STRIPE_SUBSCRIPTION_ID',
            subscription_id = v_internal_sub_id,
            updated_at = now()
        WHERE id = v_event_id;

        RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Missing Stripe subscription id');
    END IF;

    -- 7. Ordering + tenant/identity validation under row lock.
    SELECT
        empresa_id,
        stripe_subscription_id,
        stripe_last_event_created,
        stripe_last_event_priority,
        current_period_ends_at,
        status
    INTO
        v_resolved_empresa_id,
        v_existing_stripe_sub_id,
        v_last_event_created,
        v_last_event_priority,
        v_existing_current_period_end,
        v_existing_status
    FROM public.subscriptions
    WHERE id = v_internal_sub_id
    FOR UPDATE;

    IF NOT FOUND THEN
        UPDATE public.payment_events
        SET processing_status = 'failed_retryable',
            sanitized_error_code = 'UNLINKED'
        WHERE id = v_event_id;

        RETURN jsonb_build_object('status', 'failed_retryable', 'event_id', v_event_id);
    END IF;

    IF v_empresa_id IS NOT NULL AND v_empresa_id <> v_resolved_empresa_id THEN
        UPDATE public.payment_events
        SET processing_status = 'rejected_permanent',
            sanitized_error_code = 'EMPRESA_METADATA_MISMATCH',
            subscription_id = v_internal_sub_id,
            empresa_id = v_resolved_empresa_id,
            updated_at = now()
        WHERE id = v_event_id;

        RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Company metadata mismatch');
    END IF;

    v_empresa_id := v_resolved_empresa_id;

    -- A Stripe subscription ID can never be transferred between internal subscriptions/tenants.
    IF v_incoming_stripe_sub_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.subscriptions s
        WHERE s.stripe_subscription_id = v_incoming_stripe_sub_id
          AND s.id <> v_internal_sub_id
    ) THEN
        UPDATE public.payment_events
        SET processing_status = 'rejected_permanent',
            sanitized_error_code = 'STRIPE_SUBSCRIPTION_ID_CONFLICT',
            subscription_id = v_internal_sub_id,
            empresa_id = v_empresa_id,
            updated_at = now()
        WHERE id = v_event_id;

        RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Stripe subscription id already linked');
    END IF;

    IF v_last_event_created IS NOT NULL THEN
        IF p_event_created < v_last_event_created THEN
            v_is_out_of_order := TRUE;
        ELSIF p_event_created = v_last_event_created AND v_event_priority < v_last_event_priority THEN
            v_is_out_of_order := TRUE;
        END IF;
    END IF;

    IF v_is_out_of_order THEN
        UPDATE public.payment_events
        SET processing_status = 'ignored_out_of_order',
            subscription_id = v_internal_sub_id,
            empresa_id = v_empresa_id,
            updated_at = now()
        WHERE id = v_event_id;

        RETURN jsonb_build_object('status', 'ignored_out_of_order', 'event_id', v_event_id);
    END IF;

    -- Once a replacement subscription is canonical, delayed updated/deleted events from the
    -- superseded Stripe subscription must not mutate the current internal subscription.
    IF p_event_type IN ('customer.subscription.updated', 'customer.subscription.deleted')
       AND v_existing_stripe_sub_id IS NOT NULL
       AND v_existing_stripe_sub_id <> v_incoming_stripe_sub_id THEN
        UPDATE public.payment_events
        SET processing_status = 'ignored_out_of_order',
            sanitized_error_code = 'STALE_STRIPE_SUBSCRIPTION',
            subscription_id = v_internal_sub_id,
            empresa_id = v_empresa_id,
            updated_at = now()
        WHERE id = v_event_id;

        RETURN jsonb_build_object(
            'status', 'ignored_out_of_order',
            'reason', 'Event belongs to superseded Stripe subscription',
            'event_id', v_event_id
        );
    END IF;

    -- 8. Financial extraction by event type (existing contract preserved)
    IF p_event_type IN ('customer.subscription.created', 'customer.subscription.updated') THEN
        v_obs_price_id := v_object->'items'->'data'->0->'price'->>'id';
        v_obs_currency := v_object->'items'->'data'->0->'price'->>'currency';
    ELSIF p_event_type = 'invoice.paid' THEN
        v_obs_currency := v_object->>'currency';
    END IF;

    -- 9. Atomic Application
    CASE p_event_type
        WHEN 'checkout.session.completed' THEN
            UPDATE public.subscriptions
            SET stripe_customer_id = v_object->>'customer',
                stripe_subscription_id = v_object->>'subscription',
                stripe_checkout_session_id = v_object->>'id',
                updated_at = now()
            WHERE id = v_internal_sub_id;

            IF v_checkout_attempt_id IS NOT NULL THEN
                UPDATE public.checkout_attempts
                SET status = 'completed', updated_at = now()
                WHERE id = v_checkout_attempt_id
                  AND empresa_id = v_empresa_id;
            END IF;

        WHEN 'customer.subscription.created', 'customer.subscription.updated' THEN
            v_current_period_end := (v_object->>'current_period_end')::BIGINT;

            UPDATE public.subscriptions
            SET stripe_subscription_id = CASE
                    WHEN p_event_type = 'customer.subscription.created'
                        THEN v_incoming_stripe_sub_id
                    ELSE stripe_subscription_id
                END,
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
                updated_at = now(),
                plan_id = COALESCE(
                    (SELECT id FROM public.plans WHERE code = p_canonical_plan_code LIMIT 1),
                    plan_id
                )
            WHERE id = v_internal_sub_id;

        WHEN 'invoice.paid' THEN
            UPDATE public.subscriptions
            SET status = 'active',
                last_payment_status = 'paid',
                updated_at = now(),
                plan_id = COALESCE(
                    (SELECT id FROM public.plans WHERE code = p_canonical_plan_code LIMIT 1),
                    plan_id
                )
            WHERE id = v_internal_sub_id;

        WHEN 'customer.subscription.deleted' THEN
            UPDATE public.subscriptions
            SET status = 'canceled',
                canceled_at = now(),
                updated_at = now()
            WHERE id = v_internal_sub_id;
        ELSE
    END CASE;

    -- 10. Finalize ordering state only for events that actually mutated/confirmed canonical state.
    UPDATE public.subscriptions
    SET stripe_last_event_created = p_event_created,
        stripe_last_event_priority = v_event_priority,
        stripe_last_event_id = p_provider_event_id,
        stripe_last_event_type = p_event_type
    WHERE id = v_internal_sub_id;

    UPDATE public.payment_events
    SET processing_status = 'processed',
        processed_at = now(),
        subscription_id = v_internal_sub_id,
        empresa_id = v_empresa_id,
        updated_at = now()
    WHERE id = v_event_id;

    RETURN jsonb_build_object('status', 'processed', 'event_id', v_event_id);
END;
$$;

-- SECURITY DEFINER RPC is server-only. Make the privilege boundary explicit.
REVOKE ALL ON FUNCTION public.process_stripe_webhook_event(
    text, text, text, boolean, jsonb, bigint, text, text, text, bigint
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_stripe_webhook_event(
    text, text, text, boolean, jsonb, bigint, text, text, text, bigint
) FROM anon;
REVOKE ALL ON FUNCTION public.process_stripe_webhook_event(
    text, text, text, boolean, jsonb, bigint, text, text, text, bigint
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_stripe_webhook_event(
    text, text, text, boolean, jsonb, bigint, text, text, text, bigint
) TO service_role;

COMMIT;
