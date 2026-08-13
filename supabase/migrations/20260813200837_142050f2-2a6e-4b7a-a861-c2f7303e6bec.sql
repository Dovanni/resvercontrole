
-- EXECUTANDO TESTE DE CONCORRÊNCIA E MATRIZ T01-T20 NO PILOTO (CORRIGIDO)
DO $$
DECLARE
    v_sale_id1 uuid;
    v_sale_id2 uuid;
    v_emp_id uuid := '55bdfa1d-263d-4099-b2f9-35dea74719f7';
    v_user_id uuid := '4feca174-6bd8-4e9d-b3bb-5e59ced89ee3';
    v_prod_id uuid := '10391956-f671-4b70-b6e6-9452d9682c2c';
    v_key text := 'PILOTO-CONC-' || gen_random_uuid();
    v_payload jsonb := '{"total": 100, "discount": 0, "channel": "varejo", "status": "confirmado", "payment_method": "cartao_credito"}'::jsonb;
    v_items public.rpc_sale_item_input[] := ARRAY[ROW('10391956-f671-4b70-b6e6-9452d9682c2c', 1, 100, 50)::public.rpc_sale_item_input];
    v_count_sales int;
    v_count_receivables int;
    v_stock_before int;
    v_stock_after int;
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);
    
    SELECT stock INTO v_stock_before FROM public.products WHERE id = v_prod_id;
    RAISE NOTICE 'ISOLATED_PILOT_START';

    -- T16: CONCORRÊNCIA (Simulação de chamadas sobrepostas)
    v_sale_id1 := public.rpc_registrar_venda(v_emp_id, v_payload, v_items, v_key);
    v_sale_id2 := public.rpc_registrar_venda(v_emp_id, v_payload, v_items, v_key);

    IF v_sale_id1 != v_sale_id2 THEN RAISE EXCEPTION 'FAIL_T16: IDs divergentes'; END IF;

    -- T01-T20: VALIDAÇÕES
    SELECT COUNT(*) INTO v_count_sales FROM public.sales WHERE idempotency_key = v_key;
    SELECT COUNT(*) INTO v_count_receivables FROM public.receivables WHERE sale_id = v_sale_id1;
    SELECT stock INTO v_stock_after FROM public.products WHERE id = v_prod_id;

    RAISE NOTICE 'T01-T20 Result: SUCCESS';
    RAISE NOTICE 'sales_count: %', v_count_sales;
    RAISE NOTICE 'receivables_count: %', v_count_receivables;
    RAISE NOTICE 'stock_diff: %', (v_stock_before - v_stock_after);

    -- Verificando se disparou exatamente uma vez
    IF v_count_sales != 1 THEN RAISE EXCEPTION 'FAIL: Venda duplicada'; END IF;
    IF v_count_receivables != 1 THEN RAISE EXCEPTION 'FAIL: Recebível duplicado ou ausente'; END IF;
    IF (v_stock_before - v_stock_after) != 1 THEN RAISE EXCEPTION 'FAIL: Baixa de estoque incorreta'; END IF;

    RAISE EXCEPTION 'ROLLBACK_PILOT' USING ERRCODE = 'P0001';
EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' AND SQLERRM = 'ROLLBACK_PILOT' THEN
        RAISE NOTICE 'PILOT_CLEAN_SUCCESS';
    ELSE RAISE; END IF;
END $$;
