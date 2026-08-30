CREATE OR REPLACE FUNCTION public.rpc_registrar_ajuste_estoque(
  p_empresa_id uuid,
  p_product_id uuid,
  p_direction text,
  p_quantity numeric,
  p_reason text,
  p_document text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_product public.products%ROWTYPE;
  v_new_stock numeric;
  v_movement_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_direction NOT IN ('entrada','saida') THEN RAISE EXCEPTION 'Tipo de movimento inválido'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser maior que zero'; END IF;
  IF p_quantity <> trunc(p_quantity) THEN RAISE EXCEPTION 'Quantidade física deve ser inteira'; END IF;
  IF btrim(COALESCE(p_reason,'')) = '' THEN RAISE EXCEPTION 'Informe o motivo do ajuste'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_id = v_uid
      AND empresa_id = p_empresa_id
      AND status = 'active'
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Somente administradores da empresa podem registrar ajuste físico de estoque';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id AND empresa_id = p_empresa_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado na empresa ativa'; END IF;

  v_new_stock := CASE WHEN p_direction = 'entrada'
    THEN v_product.stock + p_quantity
    ELSE v_product.stock - p_quantity
  END;
  IF v_new_stock < 0 THEN RAISE EXCEPTION 'Estoque insuficiente para esta saída física'; END IF;

  PERFORM set_config('vejamais.stock_origin', 'ajuste_fisico', true);
  PERFORM set_config('vejamais.stock_reference_id', '', true);
  PERFORM set_config('vejamais.stock_purchase_id', '', true);
  PERFORM set_config('vejamais.stock_sale_id', '', true);
  PERFORM set_config('vejamais.stock_document', COALESCE(NULLIF(btrim(p_document),''), 'Ajuste físico'), true);

  UPDATE public.products
  SET stock = v_new_stock,
      updated_at = now()
  WHERE id = v_product.id;

  SELECT sm.id INTO v_movement_id
  FROM public.stock_movements sm
  WHERE sm.empresa_id = p_empresa_id
    AND sm.product_id = p_product_id
    AND sm.origin = 'ajuste_fisico'
    AND sm.created_at >= transaction_timestamp()
  ORDER BY sm.created_at DESC
  LIMIT 1;

  UPDATE public.stock_movements
  SET notes = p_reason
  WHERE id = v_movement_id;

  RETURN v_movement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_registrar_ajuste_estoque(uuid,uuid,text,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_ajuste_estoque(uuid,uuid,text,numeric,text,text) TO authenticated;