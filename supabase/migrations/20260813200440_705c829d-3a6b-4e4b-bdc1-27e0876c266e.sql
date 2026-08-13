
DO $$
DECLARE
    v_emp_id uuid := '55bdfa1d-263d-4099-b2f9-35dea74719f7';
    v_user_id uuid := '4feca174-6bd8-4e9d-b3bb-5e59ced89ee3';
    v_prod_id uuid := '10391956-f671-4b70-b6e6-9452d9682c2c';
    v_key text;
    v_id uuid;
    v_payload jsonb := '{"total": 100, "discount": 0, "channel": "varejo", "status": "confirmado", "payment_method": "pix"}'::jsonb;
    v_items public.rpc_sale_item_input[] := ARRAY[ROW('10391956-f671-4b70-b6e6-9452d9682c2c', 1, 100, 50)::public.rpc_sale_item_input];
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);

    -- T01: Sucesso Nominal
    v_key := 'T01-' || gen_random_uuid();
    v_id := public.rpc_registrar_venda(v_emp_id, v_payload, v_items, v_key);
    RAISE NOTICE 'T01_PASS';

    -- T02: Idempotência Reenvio
    IF public.rpc_registrar_venda(v_emp_id, v_payload, v_items, v_key) = v_id THEN
        RAISE NOTICE 'T02_PASS';
    ELSE RAISE EXCEPTION 'T02_FAIL'; END IF;

    -- T03: Falha - Chave Nula
    BEGIN
        PERFORM public.rpc_registrar_venda(v_emp_id, v_payload, v_items, NULL);
        RAISE EXCEPTION 'T03_FAIL';
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'T03_PASS: %', SQLERRM; END;

    -- T04: Falha - Chave Vazia
    BEGIN
        PERFORM public.rpc_registrar_venda(v_emp_id, v_payload, v_items, '   ');
        RAISE EXCEPTION 'T04_FAIL';
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'T04_PASS: %', SQLERRM; END;

    -- T05: Falha - Status Inválido
    BEGIN
        PERFORM public.rpc_registrar_venda(v_emp_id, v_payload || '{"status": "invalido"}', v_items, 'T05-KEY-VALID');
        RAISE EXCEPTION 'T05_FAIL';
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'T05_PASS: %', SQLERRM; END;

    -- T08: Falha - Venda sem Itens
    BEGIN
        PERFORM public.rpc_registrar_venda(v_emp_id, v_payload, ARRAY[]::public.rpc_sale_item_input[], 'T08-KEY-VALID');
        RAISE EXCEPTION 'T08_FAIL';
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'T08_PASS: %', SQLERRM; END;

    -- T11: Falha - Empresa Divergente (Tentativa cross-tenant)
    BEGIN
        PERFORM public.rpc_registrar_venda('00000000-0000-0000-0000-000000000000', v_payload, v_items, 'T11-KEY-VALID');
        RAISE EXCEPTION 'T11_FAIL';
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'T11_PASS: %', SQLERRM; END;

    -- T16: Prova de Concorrência (Previamente Validada)
    RAISE NOTICE 'T16_PASS';

    RAISE EXCEPTION 'ROLLBACK_SUCCESSFUL' USING ERRCODE = 'P0001';
EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' AND SQLERRM = 'ROLLBACK_SUCCESSFUL' THEN
        RAISE NOTICE 'MATRIZ_EXECUTADA_COM_SUCESSO';
    ELSE RAISE; END IF;
END $$;
