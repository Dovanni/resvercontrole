-- Corrige o vínculo canônico entre compras e contas a pagar.
-- O frontend identifica parcelas da compra pelo marcador "Compra #<8 chars do UUID>".
-- A implementação anterior removia #AUTO antes de chamar a RPC e gravava "Compra — ...",
-- fazendo os cards de pago/pendente e os status das compras perderem o vínculo.

CREATE OR REPLACE FUNCTION public.rpc_registrar_compra(
  p_empresa_id UUID,
  p_payload JSONB,
  p_items public.rpc_purchase_item_input[],
  p_payables public.rpc_purchase_payable_input[],
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_compra_id UUID;
  v_item public.rpc_purchase_item_input;
  v_payable public.rpc_purchase_payable_input;
  v_existing_id UUID;
  v_total_items INT;
  v_linked_description TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = 'P0001';
  END IF;

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'Chave de idempotência inválida ou ausente' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_id = v_user_id
      AND empresa_id = p_empresa_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Acesso negado à empresa' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.compras
  WHERE empresa_id = p_empresa_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  v_total_items := array_length(p_items, 1);
  IF p_items IS NULL OR v_total_items IS NULL OR v_total_items = 0 THEN
    RAISE EXCEPTION 'Compra sem itens' USING ERRCODE = 'P0001';
  END IF;

  IF (p_payload->>'fornecedor_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = (p_payload->>'fornecedor_id')::UUID AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Fornecedor não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF (p_payload->>'bank_account_id') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE id = (p_payload->>'bank_account_id')::UUID AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Conta bancária não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.compras (
    user_id, empresa_id, fornecedor_id, data_compra, numero_nf, condicao_pagamento,
    forma_pagamento, bank_account_id, parcelas, dia_vencimento, data_vencimento,
    subtotal, desconto, frete, total, observacoes, status, idempotency_key
  )
  VALUES (
    v_user_id, p_empresa_id, (p_payload->>'fornecedor_id')::UUID, (p_payload->>'data_compra')::DATE,
    p_payload->>'numero_nf', p_payload->>'condicao_pagamento', p_payload->>'forma_pagamento',
    (p_payload->>'bank_account_id')::UUID, (p_payload->>'parcelas')::INT,
    (p_payload->>'dia_vencimento')::INT, (p_payload->>'data_vencimento')::DATE,
    (p_payload->>'subtotal')::NUMERIC, (p_payload->>'desconto')::NUMERIC,
    (p_payload->>'frete')::NUMERIC, (p_payload->>'total')::NUMERIC,
    p_payload->>'observacoes', COALESCE(p_payload->>'status', 'confirmada'), p_idempotency_key
  )
  RETURNING id INTO v_compra_id;

  FOREACH v_item IN ARRAY p_items LOOP
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_item.produto_id AND empresa_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Produto não pertence à empresa' USING ERRCODE = 'P0001';
    END IF;

    IF v_item.quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.compras_itens (compra_id, user_id, empresa_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES (v_compra_id, v_user_id, p_empresa_id, v_item.produto_id, v_item.quantidade, v_item.preco_unitario, (v_item.quantidade * v_item.preco_unitario));

    UPDATE public.products
    SET stock = stock + v_item.quantidade,
        cost_price = v_item.preco_unitario,
        updated_at = now()
    WHERE id = v_item.produto_id;
  END LOOP;

  IF p_payables IS NOT NULL THEN
    FOREACH v_payable IN ARRAY p_payables LOOP
      IF v_payable.bank_account_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE id = v_payable.bank_account_id AND empresa_id = p_empresa_id) THEN
          RAISE EXCEPTION 'Conta bancária da parcela não pertence à empresa' USING ERRCODE = 'P0001';
        END IF;
      END IF;

      v_linked_description := CASE
        WHEN v_payable.description ~ '^Compra[[:space:]]*(#AUTO)?[[:space:]]*—' THEN
          regexp_replace(
            v_payable.description,
            '^Compra[[:space:]]*(#AUTO)?[[:space:]]*—',
            'Compra #' || left(v_compra_id::text, 8) || ' —'
          )
        ELSE v_payable.description
      END;

      INSERT INTO public.payables (
        user_id, empresa_id, supplier_id, description, category, amount,
        due_date, status, paid_amount, paid_at, bank_account_id, recurrence
      )
      VALUES (
        v_user_id, p_empresa_id, (p_payload->>'fornecedor_id')::UUID, v_linked_description,
        'Fornecedor', v_payable.amount, v_payable.due_date, v_payable.status,
        v_payable.paid_amount, v_payable.paid_at, v_payable.bank_account_id, 'nenhuma'
      );
    END LOOP;
  END IF;

  RETURN v_compra_id;
EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_existing_id
  FROM public.compras
  WHERE empresa_id = p_empresa_id AND idempotency_key = p_idempotency_key;
  IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;
  RAISE;
END;
$function$;

-- Recupera de forma conservadora os vínculos legados quando há exatamente uma
-- compra da mesma empresa/fornecedor com a NF numérica presente na descrição.
WITH matches AS (
  SELECT
    p.id AS payable_id,
    c.id AS compra_id,
    count(*) OVER (PARTITION BY p.id) AS match_count
  FROM public.payables p
  JOIN public.compras c
    ON c.empresa_id = p.empresa_id
   AND c.fornecedor_id = p.supplier_id
   AND c.numero_nf IS NOT NULL
   AND c.numero_nf ~ '^[0-9]+$'
   AND p.description LIKE '% NF ' || c.numero_nf || '%'
  WHERE p.description ~ '^Compra[[:space:]]*—'
)
UPDATE public.payables p
SET description = regexp_replace(
  p.description,
  '^Compra[[:space:]]*—',
  'Compra #' || left(m.compra_id::text, 8) || ' —'
)
FROM matches m
WHERE p.id = m.payable_id
  AND m.match_count = 1;
