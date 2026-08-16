CREATE OR REPLACE FUNCTION public.rpc_registrar_compra_test(
  p_empresa_id UUID,
  p_payload JSONB,
  p_items public.rpc_purchase_item_input[],
  p_payables public.rpc_purchase_payable_input[],
  p_idempotency_key TEXT,
  p_mock_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_compra_id UUID;
  v_item public.rpc_purchase_item_input;
  v_payable public.rpc_purchase_payable_input;
  v_existing_id UUID;
BEGIN
  -- 1. Validar Chave de Idempotência
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;

  -- 2. Verificar Idempotência
  SELECT id INTO v_existing_id
  FROM public.compras
  WHERE empresa_id = p_empresa_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 3. Inserir Compra
  INSERT INTO public.compras (
    user_id, empresa_id, fornecedor_id, data_compra, total, status, idempotency_key
  )
  VALUES (
    p_mock_user_id, p_empresa_id, (p_payload->>'fornecedor_id')::UUID, (p_payload->>'data_compra')::DATE, 
    (p_payload->>'total')::NUMERIC, COALESCE(p_payload->>'status', 'confirmada'), p_idempotency_key
  )
  RETURNING id INTO v_compra_id;

  -- 4. Inserir Itens
  FOREACH v_item IN ARRAY p_items LOOP
    INSERT INTO public.compras_itens (compra_id, user_id, empresa_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES (v_compra_id, p_mock_user_id, p_empresa_id, v_item.produto_id, v_item.quantidade, v_item.preco_unitario, (v_item.quantidade * v_item.preco_unitario));
  END LOOP;

  RETURN v_compra_id;
END;
$function$;