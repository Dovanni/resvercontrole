CREATE OR REPLACE FUNCTION public.rpc_editar_compra_pendente(
  _compra_id uuid,
  _expected_updated_at timestamptz,
  _fornecedor_id uuid,
  _data_compra date,
  _numero_nf text,
  _condicao text,
  _parcelas int,
  _data_primeira date,
  _desconto numeric,
  _frete numeric,
  _observacoes text,
  _itens jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;

  IF _condicao NOT IN ('a_prazo','parcelado') THEN
    RAISE EXCEPTION 'condicao_invalida';
  END IF;

  SELECT * INTO v_compra FROM public.compras
   WHERE id = _compra_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'compra_nao_encontrada'; END IF;
  IF v_compra.status <> 'confirmada' THEN RAISE EXCEPTION 'status_incompativel'; END IF;
  IF _expected_updated_at IS NOT NULL AND v_compra.updated_at <> _expected_updated_at THEN
    RAISE EXCEPTION 'conflito_atualizacao';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = _fornecedor_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'fornecedor_invalido';
  END IF;

  IF _itens IS NULL OR jsonb_array_length(_itens) = 0 THEN
    RAISE EXCEPTION 'sem_itens';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    v_qty := (v_item->>'quantidade')::int;
    IF v_qty IS NULL OR v_qty < 1 THEN RAISE EXCEPTION 'quantidade_invalida'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.products
                    WHERE id = (v_item->>'produto_id')::uuid AND user_id = v_uid) THEN
      RAISE EXCEPTION 'produto_invalido';
    END IF;
    v_price_cents := round((v_item->>'preco_unitario')::numeric * 100)::bigint;
    IF v_price_cents < 0 THEN RAISE EXCEPTION 'preco_invalido'; END IF;
    v_subtotal_cents := v_subtotal_cents + v_price_cents * v_qty;
  END LOOP;

  v_desc_cents := round(COALESCE(_desconto,0) * 100)::bigint;
  v_frete_cents := round(COALESCE(_frete,0) * 100)::bigint;
  IF v_desc_cents < 0 OR v_frete_cents < 0 THEN RAISE EXCEPTION 'valores_invalidos'; END IF;
  v_total_cents := v_subtotal_cents - v_desc_cents + v_frete_cents;
  IF v_total_cents < 0 THEN RAISE EXCEPTION 'total_negativo'; END IF;

  v_short := substring(v_compra.id::text, 1, 8);
  v_pattern := 'Compra #' || v_short || ' —%';

  SELECT COALESCE(array_agg(id ORDER BY due_date, id), '{}')
    INTO v_pay_ids
    FROM public.payables
   WHERE user_id = v_uid AND description LIKE v_pattern
   FOR UPDATE;

  v_pay_count := COALESCE(array_length(v_pay_ids,1), 0);

  IF v_pay_count = 0 THEN
    RAISE EXCEPTION 'parcelas_nao_encontradas';
  END IF;

  IF v_pay_count <> COALESCE(v_compra.parcelas, 1) THEN
    RAISE EXCEPTION 'correspondencia_ambigua_ou_incompleta';
  END IF;

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
$$;

REVOKE ALL ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, int, date, numeric, numeric, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, int, date, numeric, numeric, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_editar_compra_pendente(uuid, timestamptz, uuid, date, text, text, int, date, numeric, numeric, text, jsonb) TO authenticated;