
-- TEST PROCEDURE: process_stripe_webhook_event_correction_audit
-- PROTOCOLO: VEJAMAIS_STRIPE_CHECKOUT_EXPIRED_INTERNAL_SESSION_LINKAGE_MINIMAL_CORRECTION

DO $$
DECLARE
    -- Mock Entities
    v_empresa_id UUID := '550e8400-e29b-41d4-a716-446655440000';
    v_sub_id UUID := '660e8400-e29b-41d4-a716-446655440001';
    v_attempt_id UUID := '770e8400-e29b-41d4-a716-446655440002';
    v_provider_session_id TEXT := 'cs_test_expired_123';
    
    v_result JSONB;
    v_attempt_status TEXT;
    v_event_count INTEGER;
BEGIN
    RAISE NOTICE 'sql_transaction_test_started';

    -- 1. Setup Test Data
    -- Assumindo que empresa já existe (ou criando se necessário para o teste)
    INSERT INTO public.empresas (id, nome) VALUES (v_empresa_id, 'Test Company') ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.subscriptions (id, empresa_id, status, plan_id)
    VALUES (v_sub_id, v_empresa_id, 'trialing', (SELECT id FROM public.plans LIMIT 1))
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.checkout_attempts (id, empresa_id, subscription_id, provider, provider_checkout_session_id, status)
    VALUES (v_attempt_id, v_empresa_id, v_sub_id, 'stripe', v_provider_session_id, 'open')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Scenario 1: sessao persistida + metadata ausente -> processed
    v_result := public.process_stripe_webhook_event(
        'evt_1', 'checkout.session.expired', 'sha_1', false,
        jsonb_build_object('object', jsonb_build_object('id', v_provider_session_id, 'metadata', '{}')),
        extract(epoch from now())::bigint
    );
    IF v_result->>'status' <> 'processed' THEN RAISE EXCEPTION 'Scenario 1 failed: %', v_result; END IF;
    
    SELECT status INTO v_attempt_status FROM public.checkout_attempts WHERE id = v_attempt_id;
    IF v_attempt_status <> 'expired' THEN RAISE EXCEPTION 'Scenario 1 state failure: status is %', v_attempt_status; END IF;

    -- 3. Scenario 2: sessao persistida + subscription_id legado -> processed
    -- Reset status
    UPDATE public.checkout_attempts SET status = 'open' WHERE id = v_attempt_id;
    v_result := public.process_stripe_webhook_event(
        'evt_2', 'checkout.session.expired', 'sha_2', false,
        jsonb_build_object('object', jsonb_build_object('id', v_provider_session_id, 'metadata', jsonb_build_object('subscription_id', v_sub_id))),
        extract(epoch from now())::bigint
    );
    IF v_result->>'status' <> 'processed' THEN RAISE EXCEPTION 'Scenario 2 failed'; END IF;

    -- 4. Scenario 5: chaves divergentes -> rejected_permanent
    UPDATE public.checkout_attempts SET status = 'open' WHERE id = v_attempt_id;
    v_result := public.process_stripe_webhook_event(
        'evt_3', 'checkout.session.expired', 'sha_3', false,
        jsonb_build_object('object', jsonb_build_object('id', v_provider_session_id, 'metadata', jsonb_build_object('empresa_id', '00000000-0000-0000-0000-000000000000'))),
        extract(epoch from now())::bigint
    );
    IF v_result->>'status' <> 'rejected_permanent' THEN RAISE EXCEPTION 'Scenario 5 failed: expected rejected_permanent, got %', v_result; END IF;

    -- 5. Scenario 7: sessao desconhecida -> failed_retryable
    v_result := public.process_stripe_webhook_event(
        'evt_4', 'checkout.session.expired', 'sha_4', false,
        jsonb_build_object('object', jsonb_build_object('id', 'cs_unknown', 'metadata', '{}')),
        extract(epoch from now())::bigint
    );
    IF v_result->>'status' <> 'failed_retryable' THEN RAISE EXCEPTION 'Scenario 7 failed: expected failed_retryable, got %', v_result; END IF;

    -- 6. Scenario 9: tentativa já expired -> idempotente
    UPDATE public.checkout_attempts SET status = 'expired' WHERE id = v_attempt_id;
    v_result := public.process_stripe_webhook_event(
        'evt_5', 'checkout.session.expired', 'sha_5', false,
        jsonb_build_object('object', jsonb_build_object('id', v_provider_session_id, 'metadata', '{}')),
        extract(epoch from now())::bigint
    );
    IF v_result->>'status' <> 'processed' THEN RAISE EXCEPTION 'Scenario 9 failed'; END IF;

    -- 7. Verification of row counts
    SELECT count(*) INTO v_event_count FROM public.payment_events WHERE provider_event_id IN ('evt_1', 'evt_2', 'evt_3', 'evt_4', 'evt_5');
    IF v_event_count <> 5 THEN RAISE EXCEPTION 'Event count mismatch: %', v_event_count; END IF;

    RAISE NOTICE 'sql_test_count: 5';
    RAISE NOTICE 'sql_tests_passed: 5';
    RAISE NOTICE 'sql_tests_failed: 0';
    RAISE NOTICE 'sql_transaction_test_rolled_back';
    
    -- Mandatory ROLLBACK
    RAISE EXCEPTION 'ROLLBACK_TRIGGERED';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'ROLLBACK_TRIGGERED' THEN
        RETURN;
    ELSE
        RAISE;
    END IF;
END $$;
