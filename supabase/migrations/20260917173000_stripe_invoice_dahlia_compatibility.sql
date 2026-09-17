-- VEJAMAIS_BILLING_STRIPE_INVOICE_DAHLIA_COMPATIBILITY
-- Incremental migration. Repository-only until explicitly approved.
--
-- Scope:
--   1. Preserve the complete PR #27 subscription identity reconciliation.
--   2. Preserve legacy Stripe invoice compatibility.
--   3. Resolve Basil/Dahlia subscription invoices through
--      object.parent.subscription_details.
--   4. Limit the new extraction path to invoice.paid and
--      invoice.payment_failed.
--   5. Do not alter checkout or subscription lifecycle semantics.
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
    v_existing_checkout_session_id TEXT;
    v_stripe_customer_id TEXT;
    v_current_period_start BIGINT;
    v_current_period_end BIGINT;
    v_existing_current_period_end TIMESTAMPTZ;
    v_existing_status TEXT;
    v_checkout_attempt_id UUID;
    v_provider_session_id TEXT;

    -- LAB-5W: checkout authority
    v_incoming_attempt_id UUID;
    v_incoming_attempt_empresa_id UUID;
    v_incoming_attempt_subscription_id UUID;
    v_incoming_attempt_status TEXT;
    v_incoming_attempt_livemode BOOLEAN;
    v_incoming_attempt_created_at TIMESTAMPTZ;

    v_canonical_attempt_id UUID;
    v_canonical_attempt_created_at TIMESTAMPTZ;

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

    -- Stripe Basil/Dahlia invoice compatibility.
    -- Legacy invoices expose object.subscription + object.metadata.
    -- Modern subscription invoices expose their canonical context under
    -- object.parent.subscription_details.
    IF p_event_type IN ('invoice.paid', 'invoice.payment_failed')
       AND v_object#>>'{parent,type}' = 'subscription_details' THEN

        v_metadata := COALESCE(
            NULLIF(v_object->'metadata', '{}'::jsonb),
            v_object#>'{parent,subscription_details,metadata}',
            '{}'::jsonb
        );

        v_stripe_sub_id := COALESCE(
            NULLIF(v_object->>'subscription', ''),
            NULLIF(
                v_object#>>'{parent,subscription_details,subscription}',
                ''
            )
        );
    ELSE
        v_metadata := v_object->'metadata';
        v_stripe_sub_id := NULLIF(v_object->>'subscription', '');
    END IF;

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
        stripe_checkout_session_id,
        stripe_last_event_created,
        stripe_last_event_priority,
        current_period_ends_at,
        status
    INTO
        v_resolved_empresa_id,
        v_existing_stripe_sub_id,
        v_existing_checkout_session_id,
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

    -- LAB-5W: checkout.session.completed authority is derived from the
    -- persisted checkout attempt/session, not from Stripe event arrival time.
    IF p_event_type = 'checkout.session.completed' THEN

        SELECT
            ca.id,
            ca.empresa_id,
            ca.subscription_id,
            ca.status,
            ca.livemode,
            ca.created_at
        INTO
            v_incoming_attempt_id,
            v_incoming_attempt_empresa_id,
            v_incoming_attempt_subscription_id,
            v_incoming_attempt_status,
            v_incoming_attempt_livemode,
            v_incoming_attempt_created_at
        FROM public.checkout_attempts ca
        WHERE ca.provider = 'stripe'
          AND ca.provider_checkout_session_id = v_provider_session_id
        FOR UPDATE;

        IF v_incoming_attempt_id IS NULL THEN
            UPDATE public.payment_events
            SET processing_status = 'failed_retryable',
                sanitized_error_code = 'UNLINKED_SESSION',
                subscription_id = v_internal_sub_id,
                empresa_id = v_empresa_id,
                updated_at = now()
            WHERE id = v_event_id;

            RETURN jsonb_build_object(
                'status', 'failed_retryable',
                'reason', 'Checkout session is not linked to an attempt',
                'event_id', v_event_id
            );
        END IF;

        IF v_checkout_attempt_id IS NULL
           OR v_checkout_attempt_id <> v_incoming_attempt_id
           OR v_incoming_attempt_empresa_id <> v_empresa_id
           OR v_incoming_attempt_subscription_id <> v_internal_sub_id
           OR v_incoming_attempt_livemode IS DISTINCT FROM p_livemode THEN

            UPDATE public.payment_events
            SET processing_status = 'rejected_permanent',
                sanitized_error_code = 'CHECKOUT_ATTEMPT_MISMATCH',
                subscription_id = v_internal_sub_id,
                empresa_id = v_empresa_id,
                updated_at = now()
            WHERE id = v_event_id;

            RETURN jsonb_build_object(
                'status', 'rejected_permanent',
                'reason', 'Checkout attempt does not match resolved context',
                'event_id', v_event_id
            );
        END IF;

        IF v_existing_checkout_session_id IS NOT NULL
           AND v_existing_checkout_session_id <> v_provider_session_id THEN

            SELECT ca.id, ca.created_at
            INTO v_canonical_attempt_id, v_canonical_attempt_created_at
            FROM public.checkout_attempts ca
            WHERE ca.provider = 'stripe'
              AND ca.provider_checkout_session_id =
                  v_existing_checkout_session_id
            FOR UPDATE;

            -- If the current canonical session cannot be related to an
            -- attempt, do not guess which differing checkout has authority.
            IF v_canonical_attempt_id IS NULL THEN
                UPDATE public.payment_events
                SET processing_status = 'failed_retryable',
                    sanitized_error_code = 'UNLINKED_CANONICAL_SESSION',
                    subscription_id = v_internal_sub_id,
                    empresa_id = v_empresa_id,
                    updated_at = now()
                WHERE id = v_event_id;

                RETURN jsonb_build_object(
                    'status', 'failed_retryable',
                    'reason', 'Canonical checkout session is not linked to an attempt',
                    'event_id', v_event_id
                );
            END IF;

            IF v_incoming_attempt_created_at <
                   v_canonical_attempt_created_at THEN

                UPDATE public.payment_events
                SET processing_status = 'ignored_out_of_order',
                    sanitized_error_code = 'STALE_CHECKOUT_SESSION',
                    subscription_id = v_internal_sub_id,
                    empresa_id = v_empresa_id,
                    updated_at = now()
                WHERE id = v_event_id;

                RETURN jsonb_build_object(
                    'status', 'ignored_out_of_order',
                    'reason', 'Checkout attempt is older than canonical checkout attempt',
                    'event_id', v_event_id
                );

            ELSIF v_incoming_attempt_created_at =
                      v_canonical_attempt_created_at THEN

                UPDATE public.payment_events
                SET processing_status = 'rejected_permanent',
                    sanitized_error_code = 'AMBIGUOUS_CHECKOUT_AUTHORITY',
                    subscription_id = v_internal_sub_id,
                    empresa_id = v_empresa_id,
                    updated_at = now()
                WHERE id = v_event_id;

                RETURN jsonb_build_object(
                    'status', 'rejected_permanent',
                    'reason', 'Checkout attempt authority is ambiguous',
                    'event_id', v_event_id
                );
            END IF;
        END IF;
    END IF;
    -- LAB-5Z-C: a delayed customer.subscription.created must not restore
    -- a Stripe subscription that belongs to an older checkout attempt.
    IF p_event_type = 'customer.subscription.created'
       AND v_existing_stripe_sub_id IS NOT NULL
       AND v_incoming_stripe_sub_id IS NOT NULL
       AND v_existing_stripe_sub_id <> v_incoming_stripe_sub_id THEN

        -- For subscription.created there is no Checkout Session id on the
        -- subscription object. Resolve the incoming authority by attempt_id
        -- from the Stripe subscription metadata.
        SELECT
            ca.id,
            ca.empresa_id,
            ca.subscription_id,
            ca.status,
            ca.livemode,
            ca.created_at
        INTO
            v_incoming_attempt_id,
            v_incoming_attempt_empresa_id,
            v_incoming_attempt_subscription_id,
            v_incoming_attempt_status,
            v_incoming_attempt_livemode,
            v_incoming_attempt_created_at
        FROM public.checkout_attempts ca
        WHERE ca.id = v_checkout_attempt_id
          AND ca.provider = 'stripe'
        FOR UPDATE;

        IF v_checkout_attempt_id IS NULL
           OR v_incoming_attempt_id IS NULL
           OR v_incoming_attempt_empresa_id <> v_empresa_id
           OR v_incoming_attempt_subscription_id <> v_internal_sub_id
           OR v_incoming_attempt_livemode IS DISTINCT FROM p_livemode THEN

            UPDATE public.payment_events
            SET processing_status = 'rejected_permanent',
                sanitized_error_code = 'CHECKOUT_ATTEMPT_MISMATCH',
                subscription_id = v_internal_sub_id,
                empresa_id = v_empresa_id,
                updated_at = now()
            WHERE id = v_event_id;

            RETURN jsonb_build_object(
                'status', 'rejected_permanent',
                'reason', 'Subscription created attempt does not match resolved context',
                'event_id', v_event_id
            );
        END IF;

        -- A replacement cannot be authorized when an existing canonical Stripe
        -- subscription has no canonical Checkout Session from which to resolve
        -- the attempt that established the current identity.
        IF v_existing_checkout_session_id IS NULL THEN

            UPDATE public.payment_events
            SET processing_status = 'failed_retryable',
                sanitized_error_code = 'CANONICAL_CHECKOUT_AUTHORITY_MISSING',
                subscription_id = v_internal_sub_id,
                empresa_id = v_empresa_id,
                updated_at = now()
            WHERE id = v_event_id;

            RETURN jsonb_build_object(
                'status', 'failed_retryable',
                'reason', 'Canonical Stripe subscription has no checkout authority',
                'event_id', v_event_id
            );
        END IF;


        -- The current canonical Checkout Session identifies the attempt that
        -- established the currently-authoritative Stripe identity.
        IF v_existing_checkout_session_id IS NOT NULL THEN

            SELECT
                ca.id,
                ca.created_at
            INTO
                v_canonical_attempt_id,
                v_canonical_attempt_created_at
            FROM public.checkout_attempts ca
            WHERE ca.provider = 'stripe'
              AND ca.provider_checkout_session_id =
                  v_existing_checkout_session_id
            FOR UPDATE;

            IF v_canonical_attempt_id IS NULL THEN
                UPDATE public.payment_events
                SET processing_status = 'failed_retryable',
                    sanitized_error_code = 'UNLINKED_CANONICAL_SESSION',
                    subscription_id = v_internal_sub_id,
                    empresa_id = v_empresa_id,
                    updated_at = now()
                WHERE id = v_event_id;

                RETURN jsonb_build_object(
                    'status', 'failed_retryable',
                    'reason', 'Canonical checkout session is not linked to an attempt',
                    'event_id', v_event_id
                );
            END IF;

            -- LAB-7H: one persisted checkout attempt cannot authorize two
            -- different Stripe subscription identities.
            IF v_incoming_attempt_id = v_canonical_attempt_id
               AND v_incoming_stripe_sub_id IS DISTINCT FROM
                   v_existing_stripe_sub_id THEN

                UPDATE public.payment_events
                SET processing_status = 'rejected_permanent',
                    sanitized_error_code =
                        'CHECKOUT_ATTEMPT_SUBSCRIPTION_CONFLICT',
                    subscription_id = v_internal_sub_id,
                    empresa_id = v_empresa_id,
                    updated_at = now()
                WHERE id = v_event_id;

                RETURN jsonb_build_object(
                    'status', 'rejected_permanent',
                    'reason',
                    'Checkout attempt already authorizes the canonical Stripe subscription',
                    'event_id', v_event_id
                );

            ELSIF v_incoming_attempt_created_at <
                   v_canonical_attempt_created_at THEN

                UPDATE public.payment_events
                SET processing_status = 'ignored_out_of_order',
                    sanitized_error_code = 'STALE_STRIPE_SUBSCRIPTION',
                    subscription_id = v_internal_sub_id,
                    empresa_id = v_empresa_id,
                    updated_at = now()
                WHERE id = v_event_id;

                RETURN jsonb_build_object(
                    'status', 'ignored_out_of_order',
                    'reason', 'Subscription created belongs to an older checkout attempt',
                    'event_id', v_event_id
                );

            ELSIF v_incoming_attempt_created_at =
                      v_canonical_attempt_created_at
                  AND v_incoming_attempt_id <>
                      v_canonical_attempt_id THEN

                UPDATE public.payment_events
                SET processing_status = 'rejected_permanent',
                    sanitized_error_code = 'AMBIGUOUS_CHECKOUT_AUTHORITY',
                    subscription_id = v_internal_sub_id,
                    empresa_id = v_empresa_id,
                    updated_at = now()
                WHERE id = v_event_id;

                RETURN jsonb_build_object(
                    'status', 'rejected_permanent',
                    'reason', 'Subscription created checkout authority is ambiguous',
                    'event_id', v_event_id
                );
            END IF;
        END IF;
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

    -- Invoice events must carry a verifiable Stripe subscription identity before
    -- they are allowed to mutate an already-canonical internal subscription.
    IF p_event_type IN (
        'invoice.paid',
        'invoice.payment_failed'
    )
       AND v_existing_stripe_sub_id IS NOT NULL
       AND v_incoming_stripe_sub_id IS NULL THEN

        UPDATE public.payment_events
        SET processing_status = 'rejected_permanent',
            sanitized_error_code = 'MISSING_STRIPE_SUBSCRIPTION_IDENTITY',
            subscription_id = v_internal_sub_id,
            empresa_id = v_empresa_id,
            updated_at = now()
        WHERE id = v_event_id;

        RETURN jsonb_build_object(
            'status', 'rejected_permanent',
            'reason', 'Invoice is missing Stripe subscription identity',
            'event_id', v_event_id
        );
    END IF;

    -- Once a replacement subscription is canonical, delayed updated/deleted events from the
    -- superseded Stripe subscription must not mutate the current internal subscription.
    IF p_event_type IN (
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.paid',
        'invoice.payment_failed'
    )
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

    -- LAB-7U: an authorized Stripe subscription replacement must carry
    -- the complete NEW billing period before canonical identity promotion.
    IF p_event_type = 'customer.subscription.created'
       AND v_existing_stripe_sub_id IS NOT NULL
       AND v_incoming_stripe_sub_id IS DISTINCT FROM v_existing_stripe_sub_id
       AND (
           COALESCE(v_object->>'current_period_start', v_object#>>'{items,data,0,current_period_start}') IS NULL
           OR COALESCE(v_object->>'current_period_end', v_object#>>'{items,data,0,current_period_end}') IS NULL
       ) THEN

        UPDATE public.payment_events
        SET processing_status = 'failed_retryable',
            sanitized_error_code = 'INCOMPLETE_REPLACEMENT_PERIOD',
            subscription_id = v_internal_sub_id,
            empresa_id = v_empresa_id,
            updated_at = now()
        WHERE id = v_event_id;

        RETURN jsonb_build_object(
            'status', 'failed_retryable',
            'reason', 'Replacement Stripe subscription is missing billing period',
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
            v_current_period_start := COALESCE(v_object->>'current_period_start', v_object#>>'{items,data,0,current_period_start}')::BIGINT;
            v_current_period_end := COALESCE(v_object->>'current_period_end', v_object#>>'{items,data,0,current_period_end}')::BIGINT;

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
                current_period_started_at = CASE
                    WHEN p_event_type = 'customer.subscription.created'
                     AND v_existing_stripe_sub_id IS NOT NULL
                     AND v_incoming_stripe_sub_id IS DISTINCT FROM v_existing_stripe_sub_id
                    THEN to_timestamp(v_current_period_start)
                    ELSE current_period_started_at
                END,
                current_period_ends_at = CASE
                    WHEN p_event_type = 'customer.subscription.created'
                     AND v_existing_stripe_sub_id IS NOT NULL
                     AND v_incoming_stripe_sub_id IS DISTINCT FROM v_existing_stripe_sub_id
                    THEN to_timestamp(v_current_period_end)
                    ELSE GREATEST(v_existing_current_period_end, to_timestamp(v_current_period_end))
                END,
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
