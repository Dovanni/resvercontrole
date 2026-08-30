CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NULL,
  movement_at timestamptz NOT NULL DEFAULT now(),
  direction text NOT NULL CHECK (direction IN ('entrada','saida','saldo_inicial')),
  origin text NOT NULL,
  quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_cost numeric(14,2) NULL,
  balance_before numeric(14,3) NULL,
  balance_after numeric(14,3) NULL,
  document text NULL,
  purchase_id uuid NULL REFERENCES public.compras(id) ON DELETE SET NULL,
  sale_id uuid NULL REFERENCES public.sales(id) ON DELETE SET NULL,
  reference_id uuid NULL,
  notes text NULL,
  source_key text NULL,
  is_reconstructed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_empresa_product_date_idx
  ON public.stock_movements (empresa_id, product_id, movement_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_empresa_date_idx
  ON public.stock_movements (empresa_id, movement_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_source_key_uidx
  ON public.stock_movements (source_key) WHERE source_key IS NOT NULL;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_movements_select_active_company ON public.stock_movements;
CREATE POLICY stock_movements_select_active_company
ON public.stock_movements FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.empresa_id = stock_movements.empresa_id
      AND uca.status = 'active'
  )
);

CREATE OR REPLACE FUNCTION public.set_stock_context_from_purchase_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $$
DECLARE
  v_doc text;
BEGIN
  SELECT CASE
           WHEN c.numero_nf IS NOT NULL AND btrim(c.numero_nf) <> '' THEN 'NF ' || c.numero_nf
           ELSE 'Compra #' || substring(c.id::text, 1, 8)
         END
    INTO v_doc
  FROM public.compras c
  WHERE c.id = NEW.compra_id;

  PERFORM set_config('vejamais.stock_origin', 'compra', true);
  PERFORM set_config('vejamais.stock_reference_id', NEW.compra_id::text, true);
  PERFORM set_config('vejamais.stock_purchase_id', NEW.compra_id::text, true);
  PERFORM set_config('vejamais.stock_sale_id', '', true);
  PERFORM set_config('vejamais.stock_document', COALESCE(v_doc, 'Compra'), true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compras_itens_stock_context ON public.compras_itens;
CREATE TRIGGER trg_compras_itens_stock_context
AFTER INSERT ON public.compras_itens
FOR EACH ROW EXECUTE FUNCTION public.set_stock_context_from_purchase_item();

CREATE OR REPLACE FUNCTION public.set_stock_context_from_sale_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $$
BEGIN
  PERFORM set_config('vejamais.stock_origin', 'venda', true);
  PERFORM set_config('vejamais.stock_reference_id', NEW.sale_id::text, true);
  PERFORM set_config('vejamais.stock_purchase_id', '', true);
  PERFORM set_config('vejamais.stock_sale_id', NEW.sale_id::text, true);
  PERFORM set_config('vejamais.stock_document', 'Venda #' || substring(NEW.sale_id::text, 1, 8), true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_items_stock_context ON public.sale_items;
CREATE TRIGGER trg_sale_items_stock_context
BEFORE INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.set_stock_context_from_sale_item();

CREATE OR REPLACE FUNCTION public.set_stock_context_from_sale_item_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $$
BEGIN
  PERFORM set_config('vejamais.stock_origin', 'estorno_venda', true);
  PERFORM set_config('vejamais.stock_reference_id', OLD.sale_id::text, true);
  PERFORM set_config('vejamais.stock_purchase_id', '', true);
  PERFORM set_config('vejamais.stock_sale_id', OLD.sale_id::text, true);
  PERFORM set_config('vejamais.stock_document', 'Estorno venda #' || substring(OLD.sale_id::text, 1, 8), true);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_items_stock_context_delete ON public.sale_items;
CREATE TRIGGER trg_sale_items_stock_context_delete
BEFORE DELETE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.set_stock_context_from_sale_item_delete();

CREATE OR REPLACE FUNCTION public.log_product_stock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $$
DECLARE
  v_delta numeric;
  v_origin text;
  v_document text;
  v_reference uuid;
  v_purchase uuid;
  v_sale uuid;
  v_text text;
BEGIN
  IF NEW.stock IS NOT DISTINCT FROM OLD.stock THEN
    RETURN NEW;
  END IF;

  v_delta := NEW.stock - OLD.stock;
  v_origin := NULLIF(current_setting('vejamais.stock_origin', true), '');
  v_document := NULLIF(current_setting('vejamais.stock_document', true), '');

  v_text := NULLIF(current_setting('vejamais.stock_reference_id', true), '');
  IF v_text IS NOT NULL THEN
    BEGIN v_reference := v_text::uuid; EXCEPTION WHEN others THEN v_reference := NULL; END;
  END IF;
  v_text := NULLIF(current_setting('vejamais.stock_purchase_id', true), '');
  IF v_text IS NOT NULL THEN
    BEGIN v_purchase := v_text::uuid; EXCEPTION WHEN others THEN v_purchase := NULL; END;
  END IF;
  v_text := NULLIF(current_setting('vejamais.stock_sale_id', true), '');
  IF v_text IS NOT NULL THEN
    BEGIN v_sale := v_text::uuid; EXCEPTION WHEN others THEN v_sale := NULL; END;
  END IF;

  INSERT INTO public.stock_movements (
    empresa_id, product_id, user_id, movement_at, direction, origin, quantity,
    unit_cost, balance_before, balance_after, document,
    purchase_id, sale_id, reference_id, notes, is_reconstructed
  ) VALUES (
    NEW.empresa_id,
    NEW.id,
    auth.uid(),
    now(),
    CASE WHEN v_delta > 0 THEN 'entrada' ELSE 'saida' END,
    COALESCE(v_origin, 'ajuste_sistema'),
    abs(v_delta),
    NEW.cost_price,
    OLD.stock,
    NEW.stock,
    v_document,
    v_purchase,
    v_sale,
    v_reference,
    CASE WHEN v_origin IS NULL THEN 'Alteração de estoque capturada automaticamente pelo Kardex.' ELSE NULL END,
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_log_stock_change ON public.products;
CREATE TRIGGER trg_products_log_stock_change
AFTER UPDATE OF stock ON public.products
FOR EACH ROW
WHEN (OLD.stock IS DISTINCT FROM NEW.stock)
EXECUTE FUNCTION public.log_product_stock_change();

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
    WHERE user_id = v_uid AND empresa_id = p_empresa_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Acesso negado à empresa';
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
GRANT EXECUTE ON FUNCTION public.rpc_registrar_ajuste_estoque(uuid,uuid,text,numeric,text,text) TO authenticated;

INSERT INTO public.stock_movements (
  empresa_id, product_id, user_id, movement_at, direction, origin, quantity,
  unit_cost, balance_before, balance_after, document, purchase_id, reference_id,
  source_key, is_reconstructed, notes
)
SELECT
  ci.empresa_id,
  ci.produto_id,
  ci.user_id,
  COALESCE(c.data_compra::timestamptz, c.created_at, now()),
  'entrada',
  'compra',
  ci.quantidade,
  ci.preco_unitario,
  NULL,
  NULL,
  CASE WHEN c.numero_nf IS NOT NULL AND btrim(c.numero_nf) <> '' THEN 'NF ' || c.numero_nf ELSE 'Compra #' || substring(c.id::text,1,8) END,
  c.id,
  c.id,
  'legacy_compra_item:' || ci.id::text,
  true,
  'Histórico reconstruído a partir de compras_itens; saldos anterior/posterior não inferidos.'
FROM public.compras_itens ci
JOIN public.compras c ON c.id = ci.compra_id
WHERE c.status <> 'cancelada'
ON CONFLICT DO NOTHING;

INSERT INTO public.stock_movements (
  empresa_id, product_id, user_id, movement_at, direction, origin, quantity,
  unit_cost, balance_before, balance_after, document, sale_id, reference_id,
  source_key, is_reconstructed, notes
)
SELECT
  si.empresa_id,
  si.product_id,
  si.user_id,
  COALESCE(s.sold_at, s.created_at, now()),
  'saida',
  'venda',
  si.quantity,
  si.unit_cost,
  NULL,
  NULL,
  'Venda #' || substring(s.id::text,1,8),
  s.id,
  s.id,
  'legacy_sale_item:' || si.id::text,
  true,
  'Histórico reconstruído a partir de sale_items; saldos anterior/posterior não inferidos.'
FROM public.sale_items si
JOIN public.sales s ON s.id = si.sale_id
WHERE s.status <> 'cancelado'
  AND COALESCE(s.channel,'') <> 'recursos_financeiros'
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.stock_movements IS 'Kardex físico multiempresa: histórico append-only de entradas, saídas e ajustes. Não substitui products.stock nesta fase segura.';