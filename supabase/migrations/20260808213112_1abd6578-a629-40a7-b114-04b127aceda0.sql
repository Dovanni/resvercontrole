-- Testes de segurança e isolamento
DO $$
DECLARE
    v_c610_id uuid := 'c610705d-e900-4b6f-8460-1a0633b7962a';
    v_55bd_id uuid := '55bdfa1d-263d-4099-b2f9-35dea74719f7';
    v_f958_id uuid := 'f958365e-3951-46e6-8595-e4f111115a90';
    v_result jsonb;
BEGIN
    -- 1. Verificar volumetria e preservação
    IF (SELECT count(*) FROM public.plans) != 2 THEN RAISE EXCEPTION 'Plans count mismatch'; END IF;
    IF (SELECT count(*) FROM public.subscriptions WHERE empresa_id = v_f958_id) != 1 THEN RAISE EXCEPTION 'F958 subscription missing'; END IF;
    IF (SELECT count(*) FROM public.subscriptions WHERE empresa_id IN (v_c610_id, v_55bd_id)) != 0 THEN RAISE EXCEPTION 'Cross-company data pollution'; END IF;

    -- 2. Verificar GRANTs (simulado via verificação de privilégios)
    IF NOT HAS_TABLE_PRIVILEGE('service_role', 'public.subscriptions', 'SELECT') THEN RAISE EXCEPTION 'service_role permission denied'; END IF;
    
    -- 3. Verificar RPC
    v_result := public.get_company_subscription_context(v_f958_id);
    IF v_result->>'plan_code' != 'essential_trial' THEN RAISE EXCEPTION 'RPC returned wrong plan'; END IF;
    IF v_result ? 'stripe_subscription_id' OR v_result ? 'stripe_customer_id' THEN RAISE EXCEPTION 'RPC leaked stripe IDs'; END IF;
END $$;
