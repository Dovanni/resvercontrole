-- V2 install (patch cirúrgico FOR UPDATE + array_agg, validado 30/30 no piloto owdjpgdstokiuqtmcttk)
REVOKE ALL ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM sandbox_exec;

CREATE OR REPLACE FUNCTION public.rpc_editar_compra_pendente(_compra_id uuid, _expected_updated_at timestamp with time zone, _fornecedor_id uuid, _data_compra date, _numero_nf text, _condicao text, _parcelas integer, _data_primeira date, _desconto numeric, _frete numeric, _observacoes text, _itens jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_compra public.compras%ROWTYPE;
  v_short text;
  v_pattern text;
  v_forn_name text;
  v_base_desc text;
  v_item jsonb;
  v_qty int;
  v_price_cents bigint;
  v_subtotal_cents bigint := 0;
  v_desc_cents bigint;
  v_frete_cents bigint;
  v_total_cents bigint;
  v_n int;
  v_base_cents bigint;
  v_rem bigint;
  v_pay_ids uuid[];
  v_pay_count int;
  v_i int;
  v_anchor_day int;
  v_month_start date;
  v_last_day int;
  v_due date;
  v_amount_cents bigint;
  v_new_desc text;
  v_prod record;
  v_new_stock int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '42501';
  END IF;

  -- OPTIMISTIC LOCK OBRIGATÓRIO
  IF _expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'CONFLITO_UPDATED_AT';
  END IF;

  IF _condicao NOT IN ('a_prazo','parcelado') THEN
    RAISE EXCEPTION 'condicao_invalida';
  END IF;

  -- Trava compra
  SELECT * INTO v_compra FROM public.compras
   WHERE id = _compra_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'compra_nao_encontrada'; END IF;
  IF v_compra.status <> 'confirmada' THEN RAISE EXCEPTION 'status_incompativel'; END IF;

  -- Comparação obrigatória
  IF v_compra.updated_at <> _expected_updated_at THEN
    RAISE EXCEPTION 'CONFLITO_UPDATED_AT';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = _fornecedor_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'fornecedor_invalido';
  END IF;

  IF _itens IS NULL OR jsonb_array_length(_itens) = 0 THEN
    RAISE EXCEPTION 'sem_itens';
  END IF;

  -- Trava itens antigos
  PERFORM 1 FROM public.compras_itens
    WHERE compra_id = _compra_id AND user_id = v_uid
    FOR UPDATE;

  -- Validação e cálculo do subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    v_qty := (v_item->>'quantidade')::int;
    IF v_qty IS NULL OR v_qty < 1 THEN RAISE EXCEPTION 'quantidade_invalida'; END IF;
    IF (v_item->>'quantidade')::numeric <> v_qty THEN RAISE EXCEPTION 'quantidade_nao_inteira'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.products
                    WHERE id = (v_item->>'produto_id')::uuid AND user_id = v_uid) THEN
      RAISE EXCEPTION 'produto_invalido';
    END IF;
    v_price_cents := round((v_item->>'preco_unitario')::numeric * 100)::bigint;
    IF v_price_cents < 0 THEN RAISE EXCEPTION 'preco_invalido'; END IF;
    IF round((v_item->>'preco_unitario')::numeric * 100) <> (v_item->>'preco_unitario')::numeric * 100 THEN
      RAISE EXCEPTION 'preco_com_precisao_excedida';
    END IF;
    v_subtotal_cents := v_subtotal_cents + v_price_cents * v_qty;
  END LOOP;

  v_desc_cents := round(COALESCE(_desconto,0) * 100)::bigint;
  v_frete_cents := round(COALESCE(_frete,0) * 100)::bigint;
  IF v_desc_cents < 0 OR v_frete_cents < 0 THEN RAISE EXCEPTION 'valores_invalidos'; END IF;
  IF v_desc_cents > v_subtotal_cents THEN RAISE EXCEPTION 'desconto_maior_que_subtotal'; END IF;
  v_total_cents := v_subtotal_cents - v_desc_cents + v_frete_cents;
  IF v_total_cents < 0 THEN RAISE EXCEPTION 'total_negativo'; END IF;

  -- Reconciliação de estoque com lock determinístico
  PERFORM p.id FROM public.products p
   WHERE p.user_id = v_uid
     AND p.id IN (
       SELECT ci.produto_id FROM public.compras_itens ci
         WHERE ci.compra_id = _compra_id AND ci.user_id = v_uid
       UNION
       SELECT (elem->>'produto_id')::uuid
         FROM jsonb_array_elements(_itens) AS elem
     )
   ORDER BY p.id
   FOR UPDATE;

  FOR v_prod IN
    WITH antigos AS (
      SELECT produto_id, SUM(quantidade)::int AS qtd
        FROM public.compras_itens
       WHERE compra_id = _compra_id AND user_id = v_uid
       GROUP BY produto_id
    ),
    novos AS (
      SELECT (elem->>'produto_id')::uuid AS produto_id,
             SUM((elem->>'quantidade')::int)::int AS qtd
        FROM jsonb_array_elements(_itens) AS elem
       GROUP BY (elem->>'produto_id')::uuid
    ),
    todos AS (
      SELECT produto_id FROM antigos
      UNION
      SELECT produto_id FROM novos
    )
    SELECT t.produto_id,
           COALESCE(n.qtd,0) - COALESCE(a.qtd,0) AS delta
      FROM todos t
      LEFT JOIN antigos a ON a.produto_id = t.produto_id
      LEFT JOIN novos   n ON n.produto_id = t.produto_id
     ORDER BY t.produto_id
  LOOP
    IF v_prod.delta <> 0 THEN
      SELECT stock + v_prod.delta INTO v_new_stock
        FROM public.products
       WHERE id = v_prod.produto_id AND user_id = v_uid;
      IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE_PARA_REDUCAO_DA_COMPRA';
      END IF;
      UPDATE public.products
         SET stock = v_new_stock, updated_at = now()
       WHERE id = v_prod.produto_id AND user_id = v_uid;
    END IF;
  END LOOP;

  -- Localiza parcelas (owner-safe: filtra por user_id)
  v_short := substring(v_compra.id::text, 1, 8);
  v_pattern := 'Compra #' || v_short || ' —%';

  -- LOCK OBRIGATÓRIO das payables antes de validação/DELETE
  -- V2: separa o lock (FOR UPDATE) da agregação (array_agg) para evitar SQLSTATE 0A000
  WITH locked AS MATERIALIZED (
    SELECT id, due_date
      FROM public.payables
     WHERE user_id = v_uid
       AND description LIKE v_pattern
     ORDER BY due_date, id
     FOR UPDATE
  )
  SELECT COALESCE(array_agg(id ORDER BY due_date, id), ARRAY[]::uuid[])
    INTO v_pay_ids
    FROM locked;

  v_pay_count := COALESCE(array_length(v_pay_ids,1), 0);

  IF v_pay_count = 0 THEN
    RAISE EXCEPTION 'parcelas_nao_encontradas';
  END IF;

  IF v_pay_count <> COALESCE(v_compra.parcelas, 1) THEN
    RAISE EXCEPTION 'correspondencia_ambigua_ou_incompleta';
  END IF;

  -- Revalida estado das payables JÁ TRAVADAS (concorrência bloqueada)
  IF EXISTS (
    SELECT 1 FROM public.payables
     WHERE id = ANY(v_pay_ids)
       AND (status <> 'pendente' OR COALESCE(paid_amount,0) > 0 OR bank_account_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'payables_incompativeis';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bank_movements
     WHERE origin = 'payable' AND reference_id = ANY(v_pay_ids)
  ) THEN
    RAISE EXCEPTION 'movimento_bancario_existente';
  END IF;

  SELECT name INTO v_forn_name FROM public.suppliers WHERE id = _fornecedor_id;
  v_base_desc := 'Compra #' || v_short || ' — ' || COALESCE(v_forn_name,'Fornecedor')
                 || CASE WHEN NULLIF(_numero_nf,'') IS NOT NULL THEN ' NF ' || _numero_nf ELSE '' END;

  UPDATE public.compras SET
    fornecedor_id = _fornecedor_id,
    data_compra = _data_compra,
    numero_nf = NULLIF(_numero_nf,''),
    condicao_pagamento = _condicao,
    forma_pagamento = NULL,
    bank_account_id = NULL,
    parcelas = CASE WHEN _condicao = 'parcelado' THEN GREATEST(_parcelas,1) ELSE 1 END,
    dia_vencimento = CASE WHEN _condicao = 'parcelado' THEN EXTRACT(day FROM _data_primeira)::int ELSE NULL END,
    data_vencimento = _data_primeira,
    subtotal = v_subtotal_cents::numeric / 100,
    desconto = v_desc_cents::numeric / 100,
    frete = v_frete_cents::numeric / 100,
    total = v_total_cents::numeric / 100,
    observacoes = NULLIF(_observacoes,''),
    updated_at = now()
  WHERE id = _compra_id;

  DELETE FROM public.compras_itens WHERE compra_id = _compra_id AND user_id = v_uid;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    v_qty := (v_item->>'quantidade')::int;
    v_price_cents := round((v_item->>'preco_unitario')::numeric * 100)::bigint;
    INSERT INTO public.compras_itens (user_id, compra_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES (v_uid, _compra_id, (v_item->>'produto_id')::uuid, v_qty,
            v_price_cents::numeric / 100, (v_price_cents * v_qty)::numeric / 100);
  END LOOP;

  DELETE FROM public.payables WHERE id = ANY(v_pay_ids);

  IF _condicao = 'parcelado' THEN
    v_n := GREATEST(_parcelas, 1);
    v_base_cents := v_total_cents / v_n;
    v_rem := v_total_cents - v_base_cents * v_n;
    v_anchor_day := EXTRACT(day FROM _data_primeira)::int;
    FOR v_i IN 0 .. v_n - 1 LOOP
      v_month_start := (date_trunc('month', _data_primeira) + (v_i || ' months')::interval)::date;
      v_last_day := EXTRACT(day FROM (v_month_start + interval '1 month - 1 day'))::int;
      v_due := v_month_start + (LEAST(v_anchor_day, v_last_day) - 1);
      v_amount_cents := v_base_cents + CASE WHEN v_i < v_rem THEN 1 ELSE 0 END;
      v_new_desc := v_base_desc || ' (' || (v_i + 1) || '/' || v_n || ')';
      INSERT INTO public.payables (user_id, supplier_id, description, category, amount, due_date, status)
      VALUES (v_uid, _fornecedor_id, v_new_desc, 'Fornecedor',
              v_amount_cents::numeric / 100, v_due, 'pendente');
    END LOOP;
  ELSE
    INSERT INTO public.payables (user_id, supplier_id, description, category, amount, due_date, status)
    VALUES (v_uid, _fornecedor_id, v_base_desc, 'Fornecedor',
            v_total_cents::numeric / 100, _data_primeira, 'pendente');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'compra_id', _compra_id,
    'parcelas_recriadas', CASE WHEN _condicao = 'parcelado' THEN GREATEST(_parcelas,1) ELSE 1 END,
    'total', v_total_cents::numeric / 100
  );
END;
$function$;

ALTER FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) FROM sandbox_exec;
GRANT EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, integer, date, numeric, numeric, text, jsonb) IS 'V2 instalada — patch FOR UPDATE/array_agg (piloto 30/30 PASS). SHA-256 fonte: 7460c3947ecd14a7cbbdba217507a4c4bf5ee3cc97b24f155039c481b78565af';