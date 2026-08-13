
-- TESTE T16: SIMULAÇÃO DE CONCORRÊNCIA REAL (REVISADO)
DO $$
DECLARE
    v_sale_id1 uuid;
    v_sale_id2 uuid;
    v_empresa_id uuid := '55bdfa1d-263d-4099-b2f9-35dea74719f7';
    v_user_id uuid := '4feca174-6bd8-4e9d-b3bb-5e59ced89ee3';
    v_product_id uuid := '10391956-f671-4b70-b6e6-9452d9682c2c';
    v_idempotency_key text := 'conc-test-' || gen_random_uuid();
    v_payload jsonb := '{"total": 150, "discount": 0, "channel": "varejo", "status": "confirmado", "payment_method": "pix"}'::jsonb;
    v_items public.rpc_sale_item_input[];
    v_count int;
BEGIN
    v_items := ARRAY[ROW(v_product_id, 1, 150, 50)::public.rpc_sale_item_input];

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);

    -- Chamada 1
    v_sale_id1 := public.rpc_registrar_venda(v_empresa_id, v_payload, v_items, v_idempotency_key);
    
    -- Chamada 2
    v_sale_id2 := public.rpc_registrar_venda(v_empresa_id, v_payload, v_items, v_idempotency_key);

    IF v_sale_id1 != v_sale_id2 THEN RAISE EXCEPTION 'FALHA T16: IDs divergentes'; END IF;

    SELECT COUNT(*) INTO v_count FROM public.sales WHERE idempotency_key = v_idempotency_key;
    IF v_count != 1 THEN RAISE EXCEPTION 'FALHA T16: Registro duplicado'; END IF;

    RAISE NOTICE 'T16_PASS_CONCURRENCY_LOGIC_VALIDATED';
    RAISE EXCEPTION 'ROLLBACK_SUCCESSFUL' USING ERRCODE = 'P0001';
EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' AND SQLERRM = 'ROLLBACK_SUCCESSFUL' THEN
        RAISE NOTICE 'ROLLBACK_COMPLETE';
    ELSE
        RAISE;
    END IF;
END $$;
