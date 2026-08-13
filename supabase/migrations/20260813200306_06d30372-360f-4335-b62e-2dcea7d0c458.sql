
-- VEJAMAIS_SALE_ATOMIC_RPC_FINAL_BLOCKERS_REMOVED
-- 1. Remover assinatura antiga com default
DROP FUNCTION IF EXISTS public.rpc_registrar_venda(uuid, jsonb, rpc_sale_item_input[], text);

-- 2. Recriar RPC com chave obrigatória e validações estritas
CREATE OR REPLACE FUNCTION public.rpc_registrar_venda(
  p_empresa_id uuid,
  p_payload jsonb,
  p_items public.rpc_sale_item_input[],
  p_idempotency_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sale_id uuid;
  v_item public.rpc_sale_item_input;
  v_existing_id uuid;
  v_total_items int;
BEGIN
  -- 1. Validar Autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validar Chave de Idempotência (Obrigatória, não vazia, formato razoável)
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'Chave de idempotência inválida ou ausente' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Validar Vínculo com a Empresa e Permissão
  IF NOT EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_id = v_user_id
      AND empresa_id = p_empresa_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Acesso negado à empresa' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Verificar Idempotência no Banco
  SELECT id INTO v_existing_id
  FROM public.sales
  WHERE empresa_id = p_empresa_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 5. Validar Venda sem Itens
  v_total_items := array_length(p_items, 1);
  IF p_items IS NULL OR v_total_items IS NULL OR v_total_items = 0 THEN
    RAISE EXCEPTION 'VENDA_SEM_ITENS' USING ERRCODE = 'P0001';
  END IF;

  -- 6. Validar Referências Cross-Tenant (Cliente, Conta)
  IF (p_payload->>'customer_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = (p_payload->>'customer_id')::uuid AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Cliente não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF (p_payload->>'bank_account_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE id = (p_payload->>'bank_account_id')::uuid AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Conta bancária não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 7. Inserir Venda
  INSERT INTO public.sales (
    user_id, empresa_id, customer_id, customer_name, channel, status, payment_method, 
    total, discount, mercado_pago_fees, frete_empresa, bank_account_id, 
    sold_at, aporte_type, notes, idempotency_key
  )
  VALUES (
    v_user_id, p_empresa_id, (p_payload->>'customer_id')::uuid, p_payload->>'customer_name', 
    p_payload->>'channel', p_payload->>'status', p_payload->>'payment_method',
    (p_payload->>'total')::numeric, (p_payload->>'discount')::numeric,
    COALESCE((p_payload->>'mercado_pago_fees')::numeric, 0),
    COALESCE((p_payload->>'frete_empresa')::numeric, 0),
    (p_payload->>'bank_account_id')::uuid,
    COALESCE((p_payload->>'sold_at')::timestamptz, now()),
    p_payload->>'aporte_type', p_payload->>'notes', p_idempotency_key
  )
  RETURNING id INTO v_sale_id;

  -- 8. Itens e Estoque
  FOREACH v_item IN ARRAY p_items LOOP
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_item.product_id AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Produto não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;

    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.sale_items (sale_id, user_id, empresa_id, product_id, quantity, unit_price, unit_cost)
    VALUES (v_sale_id, v_user_id, p_empresa_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.unit_cost);
  END LOOP;

  RETURN v_sale_id;
EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_existing_id FROM public.sales WHERE empresa_id = p_empresa_id AND idempotency_key = p_idempotency_key;
  IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_registrar_venda(uuid, jsonb, rpc_sale_item_input[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_registrar_venda(uuid, jsonb, rpc_sale_item_input[], text) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_registrar_venda(uuid, jsonb, rpc_sale_item_input[], text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_venda(uuid, jsonb, rpc_sale_item_input[], text) TO authenticated;
