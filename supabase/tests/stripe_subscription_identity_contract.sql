-- VEJAMAIS Stripe subscription identity contract tests
-- READ/WRITE TEST HARNESS ONLY: run against an isolated/dev database after the migration.
-- Every mutation is enclosed in one transaction and is rolled back at the end.
-- The script intentionally reuses one existing subscription as a fixture so it does not need
-- to manufacture a tenant/user graph. It must never be run with transaction control removed.

BEGIN;

DO $$
DECLARE
    v_target public.subscriptions%ROWTYPE;
    v_conflict_internal_id UUID := gen_random_uuid();
    v_old_stripe_sub_id TEXT := 'sub_contract_old_' || replace(gen_random_uuid()::text, '-', '');
    v_first_stripe_sub_id TEXT := 'sub_contract_first_' || replace(gen_random_uuid()::text, '-', '');
    v_new_stripe_sub_id TEXT := 'sub_contract_new_' || replace(gen_random_uuid()::text, '-', '');
    v_conflict_stripe_sub_id TEXT := 'sub_contract_conflict_' || replace(gen_random_uuid()::text, '-', '');
    v_event_id TEXT;
    v_result JSONB;
    v_actual TEXT;
    v_event_status TEXT;
BEGIN
    SELECT *
    INTO v_target
    FROM public.subscriptions
    ORDER BY created_at
    LIMIT 1;

    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'CONTRACT_PRECONDITION: public.subscriptions requires at least one fixture row';
    END IF;

    -- ================================================================
    -- TEST 1: first Stripe subscription establishes canonical identity
    -- ================================================================
    UPDATE public.subscriptions
    SET stripe_subscription_id = NULL,
        stripe_last_event_created = NULL,
        stripe_last_event_priority = NULL,
        stripe_last_event_id = NULL,
        stripe_last_event_type = NULL
    WHERE id = v_target.id;

    v_event_id := 'evt_contract_first_' || replace(gen_random_uuid()::text, '-', '');

    SELECT public.process_stripe_webhook_event(
        v_event_id,
        'customer.subscription.created',
        repeat('a', 64),
        FALSE,
        jsonb_build_object(
            'object', jsonb_build_object(
                'id', v_first_stripe_sub_id,
                'status', 'active',
                'current_period_end', 2000000000,
                'cancel_at_period_end', FALSE,
                'metadata', jsonb_build_object(
                    'subscription_id', v_target.id::text,
                    'empresa_id', v_target.empresa_id::text,
                    'plan_code', 'enterprise_monthly'
                ),
                'items', jsonb_build_object(
                    'data', jsonb_build_array(
                        jsonb_build_object(
                            'price', jsonb_build_object('id', 'price_contract', 'currency', 'brl')
                        )
                    )
                )
            )
        ),
        1000
    ) INTO v_result;

    SELECT stripe_subscription_id INTO v_actual
    FROM public.subscriptions WHERE id = v_target.id;

    IF v_result->>'status' <> 'processed' OR v_actual <> v_first_stripe_sub_id THEN
        RAISE EXCEPTION 'TEST 1 FAILED: result=%, expected stripe id=%, actual=%',
            v_result, v_first_stripe_sub_id, v_actual;
    END IF;

    RAISE NOTICE 'TEST 1 PASS: first subscription established canonical identity';

    -- =====================================================================
    -- TEST 2: newer created event promotes paid subscription over old trial
    -- =====================================================================
    UPDATE public.subscriptions
    SET stripe_subscription_id = v_old_stripe_sub_id,
        stripe_last_event_created = 2000,
        stripe_last_event_priority = 20,
        stripe_last_event_id = 'evt_contract_seed_old',
        stripe_last_event_type = 'customer.subscription.created'
    WHERE id = v_target.id;

    v_event_id := 'evt_contract_replace_' || replace(gen_random_uuid()::text, '-', '');

    SELECT public.process_stripe_webhook_event(
        v_event_id,
        'customer.subscription.created',
        repeat('b', 64),
        FALSE,
        jsonb_build_object(
            'object', jsonb_build_object(
                'id', v_new_stripe_sub_id,
                'status', 'active',
                'current_period_end', 2000001000,
                'cancel_at_period_end', FALSE,
                'metadata', jsonb_build_object(
                    'subscription_id', v_target.id::text,
                    'empresa_id', v_target.empresa_id::text,
                    'plan_code', 'enterprise_monthly'
                ),
                'items', jsonb_build_object(
                    'data', jsonb_build_array(
                        jsonb_build_object(
                            'price', jsonb_build_object('id', 'price_contract', 'currency', 'brl')
                        )
                    )
                )
            )
        ),
        3000
    ) INTO v_result;

    SELECT stripe_subscription_id INTO v_actual
    FROM public.subscriptions WHERE id = v_target.id;

    IF v_result->>'status' <> 'processed' OR v_actual <> v_new_stripe_sub_id THEN
        RAISE EXCEPTION 'TEST 2 FAILED: result=%, expected stripe id=%, actual=%',
            v_result, v_new_stripe_sub_id, v_actual;
    END IF;

    RAISE NOTICE 'TEST 2 PASS: newer subscription replaced trial identity';

    -- =====================================================================
    -- TEST 3: later-delivered update from superseded subscription is ignored
    -- The event timestamp is deliberately newer than the canonical event so
    -- this proves the identity guard, not only timestamp ordering, blocks it.
    -- =====================================================================
    v_event_id := 'evt_contract_stale_' || replace(gen_random_uuid()::text, '-', '');

    SELECT public.process_stripe_webhook_event(
        v_event_id,
        'customer.subscription.updated',
        repeat('c', 64),
        FALSE,
        jsonb_build_object(
            'object', jsonb_build_object(
                'id', v_old_stripe_sub_id,
                'status', 'canceled',
                'current_period_end', 2000002000,
                'cancel_at_period_end', TRUE,
                'metadata', jsonb_build_object(
                    'subscription_id', v_target.id::text,
                    'empresa_id', v_target.empresa_id::text,
                    'plan_code', 'enterprise_monthly'
                ),
                'items', jsonb_build_object(
                    'data', jsonb_build_array(
                        jsonb_build_object(
                            'price', jsonb_build_object('id', 'price_contract', 'currency', 'brl')
                        )
                    )
                )
            )
        ),
        4000
    ) INTO v_result;

    SELECT stripe_subscription_id INTO v_actual
    FROM public.subscriptions WHERE id = v_target.id;

    SELECT processing_status INTO v_event_status
    FROM public.payment_events
    WHERE provider = 'stripe' AND provider_event_id = v_event_id;

    IF v_result->>'status' <> 'ignored_out_of_order'
       OR v_actual <> v_new_stripe_sub_id
       OR v_event_status <> 'ignored_out_of_order' THEN
        RAISE EXCEPTION 'TEST 3 FAILED: result=%, expected canonical=%, actual=%, payment_event=%',
            v_result, v_new_stripe_sub_id, v_actual, v_event_status;
    END IF;

    IF (SELECT status FROM public.subscriptions WHERE id = v_target.id) = 'canceled' THEN
        RAISE EXCEPTION 'TEST 3 FAILED: stale subscription event canceled the canonical subscription';
    END IF;

    RAISE NOTICE 'TEST 3 PASS: superseded subscription update could not restore/mutate canonical identity';

    -- =====================================================================
    -- TEST 4: provider ID already owned by another internal subscription
    -- must be rejected and never transferred between records/tenants.
    -- =====================================================================
    INSERT INTO public.subscriptions (
        id,
        empresa_id,
        plan_id,
        status,
        source,
        stripe_subscription_id
    ) VALUES (
        v_conflict_internal_id,
        v_target.empresa_id,
        v_target.plan_id,
        'canceled',
        'administrative',
        v_conflict_stripe_sub_id
    );

    v_event_id := 'evt_contract_conflict_' || replace(gen_random_uuid()::text, '-', '');

    SELECT public.process_stripe_webhook_event(
        v_event_id,
        'customer.subscription.created',
        repeat('d', 64),
        FALSE,
        jsonb_build_object(
            'object', jsonb_build_object(
                'id', v_conflict_stripe_sub_id,
                'status', 'active',
                'current_period_end', 2000003000,
                'cancel_at_period_end', FALSE,
                'metadata', jsonb_build_object(
                    'subscription_id', v_target.id::text,
                    'empresa_id', v_target.empresa_id::text,
                    'plan_code', 'enterprise_monthly'
                ),
                'items', jsonb_build_object(
                    'data', jsonb_build_array(
                        jsonb_build_object(
                            'price', jsonb_build_object('id', 'price_contract', 'currency', 'brl')
                        )
                    )
                )
            )
        ),
        5000
    ) INTO v_result;

    SELECT stripe_subscription_id INTO v_actual
    FROM public.subscriptions WHERE id = v_target.id;

    SELECT processing_status INTO v_event_status
    FROM public.payment_events
    WHERE provider = 'stripe' AND provider_event_id = v_event_id;

    IF v_result->>'status' <> 'rejected_permanent'
       OR v_actual <> v_new_stripe_sub_id
       OR v_event_status <> 'rejected_permanent' THEN
        RAISE EXCEPTION 'TEST 4 FAILED: result=%, canonical expected=%, actual=%, payment_event=%',
            v_result, v_new_stripe_sub_id, v_actual, v_event_status;
    END IF;

    IF (SELECT stripe_subscription_id FROM public.subscriptions WHERE id = v_conflict_internal_id)
       <> v_conflict_stripe_sub_id THEN
        RAISE EXCEPTION 'TEST 4 FAILED: conflicting Stripe ID was moved away from its existing owner';
    END IF;

    IF (SELECT sanitized_error_code FROM public.payment_events
        WHERE provider = 'stripe' AND provider_event_id = v_event_id)
       <> 'STRIPE_SUBSCRIPTION_ID_CONFLICT' THEN
        RAISE EXCEPTION 'TEST 4 FAILED: expected STRIPE_SUBSCRIPTION_ID_CONFLICT';
    END IF;

    RAISE NOTICE 'TEST 4 PASS: conflicting Stripe subscription ID rejected without transfer';
END;
$$;

-- Mandatory safety boundary: leave the database exactly as it was before this harness.
ROLLBACK;
