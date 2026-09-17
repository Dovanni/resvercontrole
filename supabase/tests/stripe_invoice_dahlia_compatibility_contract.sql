-- VEJAMAIS Stripe Invoice Dahlia compatibility contract
-- READ/WRITE TEST HARNESS ONLY.
-- Run only against an isolated/dev database.
-- Every mutation is enclosed in one transaction and rolled back.

BEGIN;

DO $$
DECLARE
    v_target public.subscriptions%ROWTYPE;

    v_legacy_event_id TEXT :=
        'evt_invoice_legacy_' ||
        replace(gen_random_uuid()::text, '-', '');

    v_dahlia_event_id TEXT :=
        'evt_invoice_dahlia_' ||
        replace(gen_random_uuid()::text, '-', '');

    v_stripe_sub_id TEXT :=
        'sub_invoice_contract_' ||
        replace(gen_random_uuid()::text, '-', '');

    v_result JSONB;
    v_payment_status TEXT;
    v_event_status TEXT;
    v_linked_subscription_id UUID;
    v_linked_empresa_id UUID;
BEGIN

    SELECT *
    INTO v_target
    FROM public.subscriptions
    ORDER BY created_at
    LIMIT 1;

    IF v_target.id IS NULL THEN
        RAISE EXCEPTION
            'CONTRACT_PRECONDITION: public.subscriptions requires a fixture row';
    END IF;

    -- Establish one canonical provider identity for both contracts.
    UPDATE public.subscriptions
    SET stripe_subscription_id = v_stripe_sub_id,
        stripe_last_event_created = 1000,
        stripe_last_event_priority = 20,
        stripe_last_event_id = 'evt_invoice_contract_seed',
        stripe_last_event_type = 'customer.subscription.created',
        last_payment_status = NULL
    WHERE id = v_target.id;

    -- ============================================================
    -- TEST 1: Legacy Stripe invoice
    -- ============================================================

    SELECT public.process_stripe_webhook_event(
        v_legacy_event_id,
        'invoice.paid',
        repeat('a', 64),
        FALSE,
        jsonb_build_object(
            'object',
            jsonb_build_object(
                'id', 'in_contract_legacy',
                'subscription', v_stripe_sub_id,
                'metadata',
                jsonb_build_object(
                    'subscription_id', v_target.id::text,
                    'empresa_id', v_target.empresa_id::text
                )
            )
        ),
        2000
    )
    INTO v_result;

    SELECT last_payment_status
    INTO v_payment_status
    FROM public.subscriptions
    WHERE id = v_target.id;

    SELECT
        processing_status,
        subscription_id,
        empresa_id
    INTO
        v_event_status,
        v_linked_subscription_id,
        v_linked_empresa_id
    FROM public.payment_events
    WHERE provider = 'stripe'
      AND provider_event_id = v_legacy_event_id;

    IF v_result->>'status' <> 'processed'
       OR v_payment_status <> 'paid'
       OR v_event_status <> 'processed'
       OR v_linked_subscription_id <> v_target.id
       OR v_linked_empresa_id <> v_target.empresa_id THEN

        RAISE EXCEPTION
            'TEST 1 FAILED: legacy invoice contract';
    END IF;

    RAISE NOTICE
        'TEST 1 PASS: legacy invoice contract preserved';

    -- Reset only ordering/payment fields needed for TEST 2.
    UPDATE public.subscriptions
    SET stripe_last_event_created = 3000,
        stripe_last_event_priority = 20,
        stripe_last_event_id = 'evt_invoice_contract_seed_dahlia',
        stripe_last_event_type = 'customer.subscription.created',
        last_payment_status = NULL
    WHERE id = v_target.id;

    -- ============================================================
    -- TEST 2: Stripe Basil/Dahlia subscription invoice
    -- Top-level metadata is intentionally empty.
    -- ============================================================

    SELECT public.process_stripe_webhook_event(
        v_dahlia_event_id,
        'invoice.paid',
        repeat('b', 64),
        FALSE,
        jsonb_build_object(
            'object',
            jsonb_build_object(
                'id', 'in_contract_dahlia',
                'metadata', '{}'::jsonb,
                'parent',
                jsonb_build_object(
                    'type', 'subscription_details',
                    'subscription_details',
                    jsonb_build_object(
                        'subscription', v_stripe_sub_id,
                        'metadata',
                        jsonb_build_object(
                            'attempt_id',
                            'e0b61b36-efe4-4f0d-afc9-b7ca4084e600',
                            'subscription_id',
                            v_target.id::text,
                            'empresa_id',
                            v_target.empresa_id::text
                        )
                    )
                )
            )
        ),
        4000
    )
    INTO v_result;

    SELECT last_payment_status
    INTO v_payment_status
    FROM public.subscriptions
    WHERE id = v_target.id;

    SELECT
        processing_status,
        subscription_id,
        empresa_id
    INTO
        v_event_status,
        v_linked_subscription_id,
        v_linked_empresa_id
    FROM public.payment_events
    WHERE provider = 'stripe'
      AND provider_event_id = v_dahlia_event_id;

    IF v_result->>'status' <> 'processed'
       OR v_payment_status <> 'paid'
       OR v_event_status <> 'processed'
       OR v_linked_subscription_id <> v_target.id
       OR v_linked_empresa_id <> v_target.empresa_id THEN

        RAISE EXCEPTION
            'TEST 2 FAILED: Dahlia invoice contract';
    END IF;

    RAISE NOTICE
        'TEST 2 PASS: Dahlia parent.subscription_details resolved';

END;
$$;

ROLLBACK;