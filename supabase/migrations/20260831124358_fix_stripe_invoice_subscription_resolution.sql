-- Baseline record of the migration already applied to Supabase staging.
-- Supabase migration version: 20260831124358
-- Migration name: fix_stripe_invoice_subscription_resolution
-- Captured from pg_get_functiondef(public.process_stripe_webhook_event) after validation.
-- This file is stored on the baseline branch as a restoration/reference artifact.

CREATE OR REPLACE FUNCTION public.process_stripe_webhook_event(
  p_provider_event_id text,
  p_event_type text,
  p_payload_sha256 text,
  p_livemode boolean,
  p_event_data jsonb,
  p_event_created bigint,
  p_canonical_plan_code text DEFAULT 'enterprise_monthly'::text,
  p_canonical_price_id text DEFAULT NULL::text,
  p_canonical_currency text DEFAULT 'brl'::text,
  p_canonical_amount bigint DEFAULT 3590
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
    v_provider_session_id TEXT;

    v_locked_attempt_id UUID;
    v_locked_empresa_id UUID;
    v_locked_subscription_id UUID;
    v_locked_status TEXT;

    v_meta_internal_sub_id UUID;
    v_meta_empresa_id UUID;
    v_meta_attempt_id UUID;
    v_meta_plan_code TEXT;

    v_invoice_payload_sub_count INTEGER := 0;
    v_invoice_payload_sub_id TEXT;
    v_invoice_resolved_count INTEGER := 0;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.payment_events
        WHERE provider = 'stripe'
          AND provider_event_id = p_provider_event_id
          AND processing_status = 'processed'
    ) THEN
        RETURN jsonb_build_object('status', 'processed', 'reason', 'Duplicate event');
    END IF;

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
    v_provider_session_id := v_object->>'id';

    IF p_event_type = 'checkout.session.expired' THEN
        IF v_provider_session_id IS NULL OR v_provider_session_id = '' THEN
            UPDATE public.payment_events
            SET processing_status = 'rejected_permanent', sanitized_error_code = 'MISSING_SESSION_ID'
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
            SET processing_status = 'failed_retryable', sanitized_error_code = 'UNLINKED_SESSION'
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
           OR (v_meta_plan_code IS NOT NULL AND v_meta_plan_code <> p_canonical_plan_code)
        THEN
            UPDATE public.payment_events
            SET processing_status = 'rejected_permanent', sanitized_error_code = 'METADATA_MISMATCH'
            WHERE id = v_event_id;
            RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Metadata mismatch with locked session');
        END IF;

        IF v_locked_status IN ('open', 'expired') THEN
            UPDATE public.checkout_attempts
            SET status = 'expired', updated_at = now()
            WHERE id = v_locked_attempt_id;
        END IF;

        UPDATE public.payment_events
        SET processing_status = 'processed', processed_at = now(),
            subscription_id = v_locked_subscription_id, empresa_id = v_locked_empresa_id, updated_at = now()
        WHERE id = v_event_id;

        RETURN jsonb_build_object('status', 'processed', 'event_id', v_event_id);
    END IF;

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
        SET processing_status = 'rejected_permanent', sanitized_error_code = 'MALFORMED_METADATA'
        WHERE id = v_event_id;
        RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Malformed metadata');
    END;

    IF v_empresa_id IS NULL AND v_internal_sub_id IS NOT NULL THEN
        SELECT empresa_id INTO v_empresa_id
        FROM public.subscriptions
        WHERE id = v_internal_sub_id;
    END IF;

    IF v_internal_sub_id IS NULL AND v_stripe_sub_id IS NOT NULL THEN
        SELECT id, empresa_id INTO v_internal_sub_id, v_empresa_id
        FROM public.subscriptions
        WHERE stripe_subscription_id = v_stripe_sub_id;
    END IF;

    IF p_event_type IN ('invoice.paid', 'invoice.payment_failed')
       AND v_internal_sub_id IS NULL
    THEN
        SELECT
            count(DISTINCT candidate.stripe_subscription_id),
            min(candidate.stripe_subscription_id)
        INTO
            v_invoice_payload_sub_count,
            v_invoice_payload_sub_id
        FROM (
            SELECT NULLIF(
                line.item #>> '{parent,subscription_item_details,subscription}',
                ''
            ) AS stripe_subscription_id
            FROM jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(v_object->'lines'->'data') = 'array'
                        THEN v_object->'lines'->'data'
                    ELSE '[]'::jsonb
                END
            ) AS line(item)
        ) AS candidate
        WHERE candidate.stripe_subscription_id IS NOT NULL;

        IF v_invoice_payload_sub_count > 1 THEN
            UPDATE public.payment_events
            SET processing_status = 'rejected_permanent',
                sanitized_error_code = 'AMBIGUOUS_INVOICE_SUBSCRIPTION'
            WHERE id = v_event_id;
            RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Ambiguous invoice subscription');

        ELSIF v_invoice_payload_sub_count = 1 THEN
            SELECT
                count(*),
                min(s.id::text)::UUID,
                min(s.empresa_id::text)::UUID
            INTO
                v_invoice_resolved_count,
                v_internal_sub_id,
                v_empresa_id
            FROM public.subscriptions s
            WHERE s.stripe_subscription_id = v_invoice_payload_sub_id;

            IF v_invoice_resolved_count <> 1 THEN
                v_internal_sub_id := NULL;
                v_empresa_id := NULL;
            END IF;
        END IF;
    END IF;

    IF v_internal_sub_id IS NULL THEN
        UPDATE public.payment_events
        SET processing_status = 'failed_retryable', sanitized_error_code = 'UNLINKED'
        WHERE id = v_event_id;
        RETURN jsonb_build_object('status', 'failed_retryable', 'event_id', v_event_id);
    END IF;

    SELECT stripe_last_event_created, stripe_last_event_priority, current_period_ends_at, status
    INTO v_last_event_created, v_last_event_priority, v_existing_current_period_end, v_existing_status
    FROM public.subscriptions
    WHERE id = v_internal_sub_id
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
        SET processing_status = 'ignored_out_of_order'
        WHERE id = v_event_id;
        RETURN jsonb_build_object('status', 'ignored_out_of_order', 'event_id', v_event_id);
    END IF;

    IF p_event_type IN ('customer.subscription.created', 'customer.subscription.updated') THEN
        v_obs_price_id := v_object->'items'->'data'->0->'price'->>'id';
        v_obs_currency := v_object->'items'->'data'->0->'price'->>'currency';

    ELSIF p_event_type = 'invoice.paid' THEN
        v_obs_currency := lower(v_object->>'currency');

        BEGIN
            v_obs_amount := COALESCE(NULLIF(v_object->>'amount_paid', '')::BIGINT, 0);
        EXCEPTION WHEN OTHERS THEN
            UPDATE public.payment_events
            SET processing_status = 'rejected_permanent', sanitized_error_code = 'MALFORMED_AMOUNT'
            WHERE id = v_event_id;
            RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Malformed invoice amount');
        END;

        IF v_obs_currency IS DISTINCT FROM lower(p_canonical_currency) THEN
            UPDATE public.payment_events
            SET processing_status = 'rejected_permanent', sanitized_error_code = 'CURRENCY_MISMATCH'
            WHERE id = v_event_id;
            RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Invoice currency mismatch');
        END IF;

        IF v_obs_amount <> 0 AND v_obs_amount <> p_canonical_amount THEN
            UPDATE public.payment_events
            SET processing_status = 'rejected_permanent', sanitized_error_code = 'AMOUNT_MISMATCH'
            WHERE id = v_event_id;
            RETURN jsonb_build_object('status', 'rejected_permanent', 'reason', 'Invoice amount mismatch');
        END IF;
    END IF;

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
                updated_at = now(),
                plan_id = COALESCE((SELECT id FROM public.plans WHERE code = 'enterprise_monthly' LIMIT 1), plan_id)
            WHERE id = v_internal_sub_id;

        WHEN 'invoice.paid' THEN
            IF v_obs_amount = 0 THEN
                UPDATE public.subscriptions
                SET source = 'stripe', updated_at = now()
                WHERE id = v_internal_sub_id;
            ELSE
                UPDATE public.subscriptions
                SET status = 'active',
                    source = 'stripe',
                    last_payment_status = 'paid',
                    updated_at = now(),
                    plan_id = COALESCE((SELECT id FROM public.plans WHERE code = 'enterprise_monthly' LIMIT 1), plan_id)
                WHERE id = v_internal_sub_id;
            END IF;

        WHEN 'customer.subscription.deleted' THEN
            UPDATE public.subscriptions
            SET status = 'canceled', canceled_at = now(), updated_at = now()
            WHERE id = v_internal_sub_id;

        ELSE
    END CASE;

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
        sanitized_error_code = NULL,
        updated_at = now()
    WHERE id = v_event_id;

    RETURN jsonb_build_object('status', 'processed', 'event_id', v_event_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.process_stripe_webhook_event(text,text,text,boolean,jsonb,bigint,text,text,text,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_stripe_webhook_event(text,text,text,boolean,jsonb,bigint,text,text,text,bigint) FROM anon;
REVOKE ALL ON FUNCTION public.process_stripe_webhook_event(text,text,text,boolean,jsonb,bigint,text,text,text,bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_stripe_webhook_event(text,text,text,boolean,jsonb,bigint,text,text,text,bigint) TO service_role;
