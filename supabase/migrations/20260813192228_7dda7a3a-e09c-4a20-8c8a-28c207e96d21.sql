-- 1. Adicionar coluna de idempotência
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 2. Criar índice único de idempotência escopado por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_idempotency_empresa 
ON public.sales (empresa_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 3. Endurecer a RPC de Registro de Venda
CREATE OR REPLACE FUNCTION public.rpc_registrar_venda(
  p_empresa_id uuid,
  p_payload jsonb,
  p_items public.rpc_sale_item_input[],
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sale_id uuid;
  v_item public.rpc_sale_item_input;
  v_existing_id uuid;
BEGIN
  -- 1. Validar Autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validar Vínculo com a Empresa e Permissão
  IF NOT EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_id = v_user_id 
      AND empresa_id = p_empresa_id 
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Acesso negado à empresa' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Verificar Idempotência (Prevenção de Duplo Clique / Retry)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id 
    FROM public.sales 
    WHERE empresa_id = p_empresa_id 
      AND idempotency_key = p_idempotency_key;
    
    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  -- 4. Validar Referências Cross-Tenant
  -- Cliente
  IF (p_payload->>'customer_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = (p_payload->>'customer_id')::uuid AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Cliente não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Conta Bancária
  IF (p_payload->>'bank_account_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE id = (p_payload->>'bank_account_id')::uuid AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Conta bancária não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 5. Inserir Venda (Atomicamente)
  BEGIN
    INSERT INTO public.sales (
      user_id,
      empresa_id,
      customer_id,
      customer_name,
      channel,
      status,
      payment_method,
      total,
      discount,
      mercado_pago_fees,
      frete_empresa,
      bank_account_id,
      sold_at,
      aporte_type,
      notes,
      idempotency_key
    )
    VALUES (
      v_user_id,
      p_empresa_id,
      (p_payload->>'customer_id')::uuid,
      p_payload->>'customer_name',
      p_payload->>'channel',
      p_payload->>'status',
      p_payload->>'payment_method',
      (p_payload->>'total')::numeric,
      (p_payload->>'discount')::numeric,
      COALESCE((p_payload->>'mercado_pago_fees')::numeric, 0),
      COALESCE((p_payload->>'frete_empresa')::numeric, 0),
      (p_payload->>'bank_account_id')::uuid,
      COALESCE((p_payload->>'sold_at')::timestamptz, now()),
      p_payload->>'aporte_type',
      p_payload->>'notes',
      p_idempotency_key
    )
    RETURNING id INTO v_sale_id;
  EXCEPTION WHEN unique_violation THEN
    -- Fallback para concorrência extrema onde o SELECT inicial não pegou a chave
    IF p_idempotency_key IS NOT NULL THEN
      SELECT id INTO v_existing_id 
      FROM public.sales 
      WHERE empresa_id = p_empresa_id 
        AND idempotency_key = p_idempotency_key;
      IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
      END IF;
    END IF;
    RAISE;
  END;

  -- 6. Inserir Itens e Baixar Estoque
  IF p_items IS NOT NULL AND array_length(p_items, 1) > 0 THEN
    -- Ordenar itens por product_id para evitar deadlocks em inserções concorrentes
    FOR v_item IN (SELECT * FROM unnest(p_items) ORDER BY product_id) LOOP
      -- Validar Produto Cross-Tenant e Bloquear para Estoque
      IF NOT EXISTS (
        SELECT 1 FROM public.products 
        WHERE id = v_item.product_id AND empresa_id = p_empresa_id
        FOR UPDATE
      ) THEN
        RAISE EXCEPTION 'Produto % não pertence à empresa ou não encontrado', v_item.product_id;
      END IF;

      INSERT INTO public.sale_items (
        sale_id,
        user_id,
        empresa_id,
        product_id,
        quantity,
        unit_price,
        unit_cost
      )
      VALUES (
        v_sale_id,
        v_user_id,
        p_empresa_id,
        v_item.product_id,
        v_item.quantity,
        v_item.unit_price,
        v_item.unit_cost
      );
    END LOOP;
  END IF;

  RETURN v_sale_id;
END;
$$;

-- 4. Ajustar Permissões
REVOKE ALL ON FUNCTION public.rpc_registrar_venda(uuid, jsonb, public.rpc_sale_item_input[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_venda(uuid, jsonb, public.rpc_sale_item_input[], text) TO authenticated;

COMMENT ON FUNCTION public.rpc_registrar_venda IS 'Registra uma venda completa (venda, itens, estoque, financeiro) de forma atômica e idempotente.';